package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"argon-watch-go/internal/alerts"
	"argon-watch-go/internal/api"
	"argon-watch-go/internal/assets"
	"argon-watch-go/internal/auth"
	"argon-watch-go/internal/config"
	"argon-watch-go/internal/monitor"
	"argon-watch-go/internal/realtime"
	"argon-watch-go/internal/storage"
)

func main() {
	// 1. Load Configuration
	configPath := "config.json"

	// Check if config exists, if not create default
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		log.Println("Config file not found, creating default config.json...")
		defaultCfg := config.GenerateDefaultConfig()
		if err := config.SaveConfig(defaultCfg, configPath); err != nil {
			log.Printf("Warning: Failed to create default config: %v", err)
			// Try fallback location
			configPath = "../config/config.json"
		} else {
			log.Println("✓ Created default config.json - Please review and update the jwtSecret!")
		}
	}

	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// 2. Setup Storage
	store := storage.NewStorage(cfg.Storage)

	// 3. Setup Realtime Hub
	hub := realtime.NewHub()
	go hub.Run()

	// Setup message handler for incoming WebSocket messages
	hub.SetMessageHandler(func(client *realtime.Client, msg realtime.Message) {
		switch msg.Type {
		case "GET_HISTORICAL_DATA":
			// Get duration from message data (default to 1h)
			duration := "1h"
			if data, ok := msg.Data.(map[string]interface{}); ok {
				if d, ok := data["duration"].(string); ok {
					duration = d
				}
			}

			// Get historical data from storage
			histData := store.GetAllHistory(duration)

			// Send to requesting client
			client.SendMessage("HISTORICAL_DATA", histData)
		}
	})

	// 4. Setup Alerts
	alertEngine := alerts.NewAlertEngine(cfg.Alerts, cfg.Notifications, hub.Broadcast)

	// 5. Setup System Monitor
	sysInterval := cfg.Monitoring.SystemInterval
	if sysInterval <= 0 {
		sysInterval = 2000
	}
	sysMon := monitor.NewSystemMonitor(
		time.Duration(sysInterval)*time.Millisecond,
		hub.Broadcast,
		store,
		alertEngine,
	)
	sysMon.Start()

	// 6. Setup Service Monitor
	svcInterval := cfg.Monitoring.ServicesInterval
	if svcInterval <= 0 {
		svcInterval = 30000
	}
	svcMon := monitor.NewServiceMonitor(
		cfg.Services,
		time.Duration(svcInterval)*time.Millisecond,
		hub.Broadcast,
	)
	svcMon.Start()

	// 7. Setup Database Monitor
	dbInterval := cfg.Monitoring.ServicesInterval
	if dbInterval <= 0 {
		dbInterval = 30000
	}
	dbMon := monitor.NewDatabaseMonitor(
		cfg.Databases,
		time.Duration(dbInterval)*time.Millisecond,
		hub.Broadcast,
	)
	dbMon.Start()

	// 8. Setup PM2 Monitor
	pm2Interval := cfg.Monitoring.PM2Interval
	if pm2Interval <= 0 {
		pm2Interval = 5000
	}
	pm2Mon := monitor.NewPM2Monitor(
		time.Duration(pm2Interval)*time.Millisecond,
		hub.Broadcast,
	)
	pm2Mon.Start()

	// 9. Setup Auth Manager
	var authManager *auth.Manager
	if cfg.Auth.Enabled {
		// Env Var Overrides
		if envSecret := os.Getenv("JWT_SECRET"); envSecret != "" {
			cfg.Auth.JWTSecret = envSecret
		}

		// Check for default or weak secret
		if cfg.Auth.JWTSecret == "CHANGE-THIS-TO-A-SECURE-RANDOM-SECRET-KEY" || cfg.Auth.JWTSecret == "change-this-secret-key-in-production" {
			// Generate a new secure secret
			log.Println("⚠️  Default JWT secret detected. Generating a new secure secret...")
			randomBytes := make([]byte, 32)
			_, err := rand.Read(randomBytes)
			if err != nil {
				log.Fatalf("Failed to generate random secret: %v", err)
			}
			cfg.Auth.JWTSecret = base64.StdEncoding.EncodeToString(randomBytes)

			// Save the new secret so valid tokens persist across restarts
			if err := config.SaveConfig(cfg, configPath); err != nil {
				log.Printf("Warning: Failed to save config with new secret: %v", err)
			} else {
				log.Println("✓ Updated config.json with new secure JWT secret")
			}
		}

		// SMTP Password from Env
		if smtpPass := os.Getenv("SMTP_PASSWORD"); smtpPass != "" {
			cfg.Notifications.Email.SMTP.Auth.Pass = smtpPass
		}

		if cfg.Auth.TokenExpiration == 0 {
			cfg.Auth.TokenExpiration = 24 // 24 hours default
		}
		if cfg.Auth.UsersFile == "" {
			cfg.Auth.UsersFile = "../data/users.json"
		}

		am, err := auth.NewManager(cfg.Auth.UsersFile, cfg.Auth.JWTSecret, cfg.Auth.TokenExpiration)
		if err != nil {
			log.Fatalf("Failed to initialize auth manager: %v", err)
		}
		authManager = am

		// Check if setup is required
		if !authManager.GetUserStore().HasUsers() {
			log.Println("⚠️  No users found. Please complete initial setup at /setup")
		}
	}

	// 10. Load Frontend Assets
	frontendFS, err := assets.GetFrontendAssets()
	if err != nil {
		log.Fatalf("Failed to get frontend assets: %v", err)
	}

	// 11. Setup Router
	r := api.NewRouter(cfg, hub, store, alertEngine, authManager, frontendFS)

	// Serve static files (CSS, JS, images, etc.)
	fileServer := http.FileServer(http.FS(frontendFS))
	r.PathPrefix("/").Handler(fileServer)

	// 11. Start Server
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	log.Printf("Starting server on http://%s", addr)

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
