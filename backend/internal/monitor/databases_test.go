package monitor

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestCalculatePerSecond(t *testing.T) {
	rate := calculatePerSecond(30, 10*time.Second)
	if rate != 3 {
		t.Fatalf("calculatePerSecond() = %v, want 3", rate)
	}

	if calculatePerSecond(0, 10*time.Second) != 0 {
		t.Fatalf("calculatePerSecond() should return 0 for empty delta")
	}
}

func TestBuildMongoMetrics(t *testing.T) {
	serverStatus := bson.M{
		"connections": bson.M{
			"current":      int32(12),
			"available":    int32(838),
			"totalCreated": int32(144),
		},
		"opcounters": bson.M{
			"query":   int32(22),
			"insert":  int32(5),
			"update":  int32(8),
			"delete":  int32(2),
			"command": int32(41),
		},
		"mem": bson.M{
			"resident": int32(256),
			"virtual":  int32(1024),
		},
	}
	dbStats := bson.M{
		"dataSize":    int64(2048),
		"storageSize": int64(4096),
		"indexSize":   int64(1024),
		"collections": int32(9),
		"indexes":     int32(11),
	}

	metrics := buildMongoMetrics(serverStatus, dbStats, 7.5)

	if metrics.Connections.Current != 12 {
		t.Fatalf("current connections = %d, want 12", metrics.Connections.Current)
	}
	if metrics.Activity.OperationsPerSecond != 7.5 {
		t.Fatalf("ops/sec = %v, want 7.5", metrics.Activity.OperationsPerSecond)
	}
	if metrics.Storage.Collections != 9 {
		t.Fatalf("collections = %d, want 9", metrics.Storage.Collections)
	}
	if metrics.Memory.ResidentBytes != 256*1024*1024 {
		t.Fatalf("resident bytes = %d, want %d", metrics.Memory.ResidentBytes, 256*1024*1024)
	}
}

func TestBuildPostgresMetrics(t *testing.T) {
	stats := postgresDatabaseStats{
		NumBackends:   14,
		Commits:       1200,
		Rollbacks:     30,
		BlocksRead:    300,
		BlocksHit:     2700,
		TuplesReturn:  10000,
		TuplesFetch:   5000,
		TuplesInsert:  200,
		TuplesUpdate:  150,
		TuplesDelete:  25,
		DatabaseBytes: 1048576,
	}

	metrics := buildPostgresMetrics(stats, 4.2)

	if metrics.Connections.Current != 14 {
		t.Fatalf("current connections = %d, want 14", metrics.Connections.Current)
	}
	if metrics.Activity.TransactionsPerSecond != 4.2 {
		t.Fatalf("tx/sec = %v, want 4.2", metrics.Activity.TransactionsPerSecond)
	}
	if metrics.Cache.HitRatio != 90 {
		t.Fatalf("cache hit ratio = %v, want 90", metrics.Cache.HitRatio)
	}
	if metrics.Storage.DatabaseSizeBytes != 1048576 {
		t.Fatalf("database size = %d, want 1048576", metrics.Storage.DatabaseSizeBytes)
	}
}
