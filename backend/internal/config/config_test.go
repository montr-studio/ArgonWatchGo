package config

import (
	"encoding/json"
	"testing"
)

func TestDatabaseConfigUnmarshalSupportsUsernameAlias(t *testing.T) {
	input := []byte(`{
		"id": "pg-main",
		"name": "Postgres",
		"type": "PostgreSQL",
		"host": "localhost",
		"port": 5432,
		"username": "postgres",
		"password": "secret",
		"database": "app"
	}`)

	var cfg DatabaseConfig
	if err := json.Unmarshal(input, &cfg); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if cfg.User != "postgres" {
		t.Fatalf("User = %q, want %q", cfg.User, "postgres")
	}

	if cfg.Type != "postgres" {
		t.Fatalf("Type = %q, want %q", cfg.Type, "postgres")
	}

	if cfg.Database != "app" {
		t.Fatalf("Database = %q, want %q", cfg.Database, "app")
	}
}

func TestDatabaseConfigUnmarshalSupportsNumericDatabase(t *testing.T) {
	input := []byte(`{
		"name": "Redis Cache",
		"type": "redis",
		"host": "localhost",
		"port": 6379,
		"database": 2
	}`)

	var cfg DatabaseConfig
	if err := json.Unmarshal(input, &cfg); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if cfg.Database != "2" {
		t.Fatalf("Database = %q, want %q", cfg.Database, "2")
	}
}
