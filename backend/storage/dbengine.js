const fs = require('fs');
const path = require('path');

class HistoricalStorage {
    constructor(config) {
        this.enabled = config.enabled;
        this.retentionDays = config.retentionDays || 7;
        this.dataPath = path.resolve(__dirname, '../../', config.dataPath || '../data');
        this.dataFile = path.join(this.dataPath, 'metrics.json');
        this.maxDataPoints = 60 * 60 * 24 * this.retentionDays / 2; // One point every 2 seconds
        
        if (this.enabled) {
            this.ensureDataDirectory();
            this.loadData();
        }
    }

    ensureDataDirectory() {
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const raw = fs.readFileSync(this.dataFile, 'utf8');
                this.data = JSON.parse(raw);
            } else {
                this.data = {
                    cpu: [],
                    memory: [],
                    network: [],
                    disk: []
                };
            }
        } catch (e) {
            console.error('Failed to load historical data:', e);
            this.data = { cpu: [], memory: [], network: [], disk: [] };
        }
    }

    saveData() {
        if (!this.enabled) return;
        
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data));
        } catch (e) {
            console.error('Failed to save historical data:', e);
        }
    }

    addDataPoint(type, value) {
        if (!this.enabled) return;

        const timestamp = Date.now();
        const point = { timestamp, value };

        if (!this.data[type]) {
            this.data[type] = [];
        }

        this.data[type].push(point);

        // Cleanup old data
        const cutoff = timestamp - (this.retentionDays * 24 * 60 * 60 * 1000);
        this.data[type] = this.data[type].filter(p => p.timestamp > cutoff);

        // Limit total points
        if (this.data[type].length > this.maxDataPoints) {
            this.data[type] = this.data[type].slice(-this.maxDataPoints);
        }

        // Save periodically (every 100 points)
        if (this.data[type].length % 100 === 0) {
            this.saveData();
        }
    }

    getHistoricalData(type, duration = '1h') {
        if (!this.enabled || !this.data[type]) return [];

        const now = Date.now();
        let cutoff;

        switch (duration) {
            case '1h':
                cutoff = now - (60 * 60 * 1000);
                break;
            case '6h':
                cutoff = now - (6 * 60 * 60 * 1000);
                break;
            case '24h':
                cutoff = now - (24 * 60 * 60 * 1000);
                break;
            case '7d':
                cutoff = now - (7 * 24 * 60 * 60 * 1000);
                break;
            default:
                cutoff = now - (60 * 60 * 1000);
        }

        return this.data[type].filter(p => p.timestamp > cutoff);
    }
}

module.exports = HistoricalStorage;
