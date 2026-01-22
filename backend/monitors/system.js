const si = require('systeminformation');

class SystemMonitor {
    constructor(wsHandler, interval = 2000, storage = null) {
        this.wsHandler = wsHandler;
        this.interval = interval;
        this.storage = storage;
        this.timer = null;
        this.start();
    }

    start() {
        this.getData(); // Initial fetch
        this.timer = setInterval(() => this.getData(), this.interval);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
    }

    async getData() {
        try {
            const [cpu, mem, currentLoad, fsSize, networkStats, osInfo] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.currentLoad(),
                si.fsSize(),
                si.networkStats(),
                si.osInfo()
            ]);

            // Get network interfaces for IP
            const networkInterfaces = await si.networkInterfaces();
            const primaryInterface = networkInterfaces.find(iface =>
                iface.ip4 && !iface.internal && iface.operstate === 'up'
            ) || networkInterfaces[0];

            const data = {
                system: {
                    os: osInfo.platform,
                    distro: osInfo.distro,
                    hostname: osInfo.hostname,
                    ipAddress: primaryInterface ? primaryInterface.ip4 : 'N/A',
                    uptime: osInfo.uptime
                },
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    cores: cpu.cores,
                    speed: cpu.speed,
                    load: currentLoad.currentLoad,
                    loadUser: currentLoad.currentLoadUser,
                    loadSystem: currentLoad.currentLoadSystem
                },
                memory: {
                    total: mem.total,
                    free: mem.free,
                    used: mem.used,
                    active: mem.active,
                    available: mem.available,
                    percentage: (mem.active / mem.total) * 100
                },
                disk: fsSize.map(drive => ({
                    fs: drive.fs,
                    type: drive.type,
                    size: drive.size,
                    used: drive.used,
                    use: drive.use,
                    mount: drive.mount
                })),
                network: networkStats.map(iface => ({
                    iface: iface.iface,
                    rx_bytes: iface.rx_bytes,
                    tx_bytes: iface.tx_bytes,
                    rx_sec: iface.rx_sec,
                    tx_sec: iface.tx_sec,
                    operstate: iface.operstate
                })),
                uptime: si.time().uptime
            };

            // Store historical data
            if (this.storage) {
                this.storage.addDataPoint('cpu', currentLoad.currentLoad);
                this.storage.addDataPoint('memory', (mem.active / mem.total) * 100);
            }

            this.wsHandler.broadcast('SYSTEM_METRICS', data);
        } catch (error) {
            console.error('Error fetching system metrics:', error);
        }
    }
}

module.exports = SystemMonitor;
