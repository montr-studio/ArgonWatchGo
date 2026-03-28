package assets

import (
	"io/fs"
	"strings"
	"testing"
)

func TestEmbeddedAppUsesPageProtocolForWebSocket(t *testing.T) {
	frontendFS, err := GetFrontendAssets()
	if err != nil {
		t.Fatalf("GetFrontendAssets() error = %v", err)
	}

	content, err := fs.ReadFile(frontendFS, "js/app.js")
	if err != nil {
		t.Fatalf("ReadFile(js/app.js) error = %v", err)
	}

	source := string(content)

	if !strings.Contains(source, "window.location.protocol === 'https:' ? 'wss:' : 'ws:'") {
		t.Fatalf("embedded app.js does not derive websocket protocol from the current page protocol")
	}

	if strings.Contains(source, "new WebSocketClient(`ws://${window.location.host}/ws`)") {
		t.Fatalf("embedded app.js still hardcodes an insecure websocket URL")
	}
}

func TestEmbeddedDashboardIncludesDatabaseStatusSection(t *testing.T) {
	frontendFS, err := GetFrontendAssets()
	if err != nil {
		t.Fatalf("GetFrontendAssets() error = %v", err)
	}

	content, err := fs.ReadFile(frontendFS, "index.html")
	if err != nil {
		t.Fatalf("ReadFile(index.html) error = %v", err)
	}

	source := string(content)

	if !strings.Contains(source, `id="databases-card"`) {
		t.Fatalf("embedded dashboard is missing the database monitoring section")
	}

	if !strings.Contains(source, `id="databases-table-body"`) {
		t.Fatalf("embedded dashboard is missing the database monitoring table body")
	}

	systemResourcesIdx := strings.Index(source, "System Resources")
	performanceTrendsIdx := strings.Index(source, "Performance Trends")
	if systemResourcesIdx == -1 || performanceTrendsIdx == -1 {
		t.Fatalf("embedded dashboard is missing expected dashboard section headings")
	}

	if performanceTrendsIdx < systemResourcesIdx {
		t.Fatalf("historical graphs are not rendered below system resources")
	}
}

func TestEmbeddedAppHandlesDatabaseStatusMessages(t *testing.T) {
	frontendFS, err := GetFrontendAssets()
	if err != nil {
		t.Fatalf("GetFrontendAssets() error = %v", err)
	}

	content, err := fs.ReadFile(frontendFS, "js/app.js")
	if err != nil {
		t.Fatalf("ReadFile(js/app.js) error = %v", err)
	}

	source := string(content)

	if !strings.Contains(source, "this.ws.on('DATABASE_STATUS'") {
		t.Fatalf("embedded app.js does not subscribe to database status events")
	}

	if !strings.Contains(source, "updateDatabaseTable") {
		t.Fatalf("embedded app.js does not define database table rendering")
	}
}

func TestEmbeddedStylesPreventDashboardOverflow(t *testing.T) {
	frontendFS, err := GetFrontendAssets()
	if err != nil {
		t.Fatalf("GetFrontendAssets() error = %v", err)
	}

	content, err := fs.ReadFile(frontendFS, "css/styles.css")
	if err != nil {
		t.Fatalf("ReadFile(css/styles.css) error = %v", err)
	}

	source := string(content)

	if !strings.Contains(source, "overflow-x: hidden;") {
		t.Fatalf("embedded styles.css does not guard against horizontal overflow")
	}
}
