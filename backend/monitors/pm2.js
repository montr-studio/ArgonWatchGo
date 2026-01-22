const pm2 = require('pm2');

class Pm2Monitor {
    constructor(wsHandler, interval = 5000) {
        this.wsHandler = wsHandler;
        this.interval = interval;
        this.timer = null;
        this.start();
    }

    start() {
        this.getData();
        this.timer = setInterval(() => this.getData(), this.interval);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
    }

    getData() {
        pm2.connect((err) => {
            if (err) {
                console.error('PM2 Connection Error:', err);
                return;
            }

            pm2.list((err, list) => {
                if (err) {
                    console.error('PM2 List Error:', err);
                    pm2.disconnect();
                    return;
                }

                const data = list.map(proc => ({
                    name: proc.name,
                    status: proc.pm2_env.status,
                    pid: proc.pid,
                    uptime: Date.now() - proc.pm2_env.pm_uptime,
                    restarts: proc.pm2_env.restart_time,
                    cpu: proc.monit.cpu,
                    memory: proc.monit.memory
                }));

                this.wsHandler.broadcast('PM2_METRICS', data);
                // pm2.disconnect(); // Keep connection open or disconnect? usually keep open for monitoring
            });
        });
    }
}

module.exports = Pm2Monitor;
