package api

import (
	"encoding/json"
	"io/fs"
	"net/http"

	"argon-watch-go/internal/alerts"
	"argon-watch-go/internal/auth"
	"argon-watch-go/internal/config"
	"argon-watch-go/internal/realtime"
	"argon-watch-go/internal/storage"

	"github.com/gorilla/mux"
)

func NewRouter(cfg *config.Config, hub *realtime.Hub, store *storage.Storage, ae *alerts.AlertEngine, authManager *auth.Manager, frontendFS fs.FS) *mux.Router {
	r := mux.NewRouter()

	// Public auth routes (no authentication required)
	authRoutes := r.PathPrefix("/api/auth").Subrouter()
	authRoutes.HandleFunc("/check-setup", authManager.HandleCheckSetup).Methods("GET")
	authRoutes.HandleFunc("/setup", authManager.HandleSetup).Methods("POST")
	authRoutes.HandleFunc("/login", authManager.HandleLogin).Methods("POST")
	authRoutes.HandleFunc("/verify-2fa", authManager.HandleVerify2FA).Methods("POST")
	authRoutes.HandleFunc("/logout", authManager.HandleLogout).Methods("POST")

	// Serve setup and login pages (public access)
	r.HandleFunc("/setup", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, frontendFS, "setup.html")
	}).Methods("GET")

	r.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, frontendFS, "login.html")
	}).Methods("GET")

	// Protected routes (authentication required)
	if cfg.Auth.Enabled {
		// WebSocket with auth
		r.Handle("/ws", auth.Middleware(authManager.GetJWTManager())(http.HandlerFunc(hub.ServeWS)))

		// API Routes with auth
		api := r.PathPrefix("/api").Subrouter()
		api.Use(func(next http.Handler) http.Handler {
			return auth.Middleware(authManager.GetJWTManager())(next)
		})

		api.HandleFunc("/config", getConfigHandler(cfg)).Methods("GET")
		api.HandleFunc("/history/{type}", getHistoryHandler(store)).Methods("GET")
		api.HandleFunc("/alerts/active", getAlertsHandler(ae)).Methods("GET")
		api.HandleFunc("/alerts/history", getAlertHistoryHandler(ae)).Methods("GET")

		// User management routes
		api.HandleFunc("/auth/me", authManager.HandleGetMe).Methods("GET")
		api.HandleFunc("/auth/enable-2fa", authManager.HandleEnable2FA).Methods("POST")
		api.HandleFunc("/auth/disable-2fa", authManager.HandleDisable2FA).Methods("POST")
	} else {
		// No auth - all routes public
		r.HandleFunc("/ws", hub.ServeWS)

		api := r.PathPrefix("/api").Subrouter()
		api.HandleFunc("/config", getConfigHandler(cfg)).Methods("GET")
		api.HandleFunc("/history/{type}", getHistoryHandler(store)).Methods("GET")
		api.HandleFunc("/alerts/active", getAlertsHandler(ae)).Methods("GET")
		api.HandleFunc("/alerts/history", getAlertHistoryHandler(ae)).Methods("GET")
	}

	return r
}

func getConfigHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cfg.Sanitize())
	}
}

func getHistoryHandler(store *storage.Storage) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		metricType := vars["type"]
		duration := r.URL.Query().Get("duration")
		if duration == "" {
			duration = "1h"
		}

		data := store.GetHistory(metricType, duration)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(data)
	}
}

func getAlertsHandler(ae *alerts.AlertEngine) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data := ae.GetActiveAlerts()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(data)
	}
}

func getAlertHistoryHandler(ae *alerts.AlertEngine) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data := ae.GetHistory()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(data)
	}
}
