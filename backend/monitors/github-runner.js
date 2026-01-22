const fs = require('fs');
const path = require('path');

class RunnerMonitor {
    constructor(wsHandler, config, interval = 5000) {
        this.wsHandler = wsHandler;
        this.config = config;
        this.interval = interval;
        this.timer = null;
        this.start();
    }

    start() {
        this.checkStatus();
        this.timer = setInterval(() => this.checkStatus(), this.interval);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
    }

    async checkStatus() {
        // Mock implementation for now as we don't have a real runner
        // In reality, this would check the .runner file or process list

        const data = {
            status: 'idle', // idle, active, offline
            jobName: null,
            jobDuration: null
        };

        // Simple check if path exists
        if (!fs.existsSync(this.config.runnerPath)) {
            data.status = 'offline';
        } else {
            // Check for worker process
            // const isRunning = ... check process list for 'Runner.Worker'

            // Mocking active state occasionally for demo
            if (Math.random() > 0.8) {
                data.status = 'active';
                data.jobName = 'build-deploy-production';
                data.jobDuration = '2m 15s';
            }
        }

        this.wsHandler.broadcast('RUNNER_STATUS', data);
    }
}

module.exports = RunnerMonitor;
