const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const WebSocketHandler = require('./utils/websocket');

// Load config
const configPath = path.join(__dirname, '../config/config.json');
let config = {};
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    console.error('Failed to load config:', e);
    process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize WebSocket
const wsHandler = new WebSocketHandler(server);

// Routes
app.get('/api/config', (req, res) => {
    // Only send non-sensitive config to frontend
    const safeConfig = {
        monitoring: config.monitoring,
        quickCommands: config.quickCommands
    };
    res.json(safeConfig);
});

app.get('/api/history/:type', (req, res) => {
    const { type } = req.params;
    const { duration = '1h' } = req.query;

    if (storage) {
        const data = storage.getHistoricalData(type, duration);
        res.json(data);
    } else {
        res.json([]);
    }
});

// Initialize Historical Storage
const HistoricalStorage = require('./storage/dbengine');
const storage = new HistoricalStorage(config.storage);

// Initialize Command Handler
const CommandHandler = require('./terminal/commands');
const commandHandler = new CommandHandler(wsHandler, config);

// Start Monitors
console.log('Starting monitors...');
const SystemMonitor = require('./monitors/system');
const systemMonitor = new SystemMonitor(wsHandler, config.monitoring.systemInterval, storage);

try {
    const Pm2Monitor = require('./monitors/pm2');
    const pm2Monitor = new Pm2Monitor(wsHandler, config.monitoring.pm2Interval);
} catch (e) {
    console.log('PM2 Monitor disabled (module not found or error)');
}

try {
    const RunnerMonitor = require('./monitors/github-runner');
    const runnerMonitor = new RunnerMonitor(wsHandler, config.githubRunner, config.monitoring.runnerInterval);
} catch (e) {
    console.log('GitHub Runner Monitor disabled (module not found or error)');
}

const PORT = config.server.port || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
