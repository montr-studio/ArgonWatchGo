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
            const [
                cpu,
                mem,
                currentLoad,
                fsSize,
                networkStats,
                osInfo,
                cpuTemp,
                cpuCurrentSpeed,
                fsStats,
                graphics,
                diskLayout
            ] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.currentLoad(),
                si.fsSize(),
                si.networkStats(),
                si.osInfo(),
                si.cpuTemperature(),
                si.cpuCurrentSpeed(),
                si.fsStats(),
                si.graphics(),
                si.diskLayout()
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
                    physicalCores: cpu.physicalCores,
                    speed: cpu.speed,
                    speedMin: cpu.speedMin,
                    speedMax: cpu.speedMax,
                    // Overall load
                    load: currentLoad.currentLoad,
                    loadUser: currentLoad.currentLoadUser,
                    loadSystem: currentLoad.currentLoadSystem,
                    loadIdle: currentLoad.currentLoadIdle,
                    // Per-core loads
                    coreLoads: currentLoad.cpus ? currentLoad.cpus.map(core => ({
                        load: core.load,
                        loadUser: core.loadUser,
                        loadSystem: core.loadSystem,
                        loadIdle: core.loadIdle
                    })) : [],
                    // Current speeds per core
                    coreSpeeds: cpuCurrentSpeed.cores || [],
                    avgSpeed: cpuCurrentSpeed.avg,
                    // Load averages (Linux/Mac)
                    loadAverage1: currentLoad.avgLoad || 0,
                    loadAverage5: currentLoad.avgLoad5 || 0,
                    loadAverage15: currentLoad.avgLoad15 || 0
                },
                memory: {
                    total: mem.total,
                    free: mem.free,
                    used: mem.used,
                    active: mem.active,
                    available: mem.available,
                    percentage: (mem.active / mem.total) * 100,
                    // Swap memory
                    swapTotal: mem.swaptotal,
                    swapUsed: mem.swapused,
                    swapFree: mem.swapfree,
                    swapPercentage: mem.swaptotal > 0 ? (mem.swapused / mem.swaptotal) * 100 : 0,
                    // Cache and buffers
                    buffers: mem.buffers || 0,
                    cached: mem.cached || 0,
                    slab: mem.slab || 0
                },
                disk: fsSize.map(drive => ({
                    fs: drive.fs,
                    type: drive.type,
                    size: drive.size,
                    used: drive.used,
                    use: drive.use,
                    mount: drive.mount,
                    // Find matching I/O stats
                    rw_sec: drive.rw_sec || 0,
                    r_sec: drive.r_sec || 0,
                    w_sec: drive.w_sec || 0
                })),
                // Disk I/O statistics
                diskIO: fsStats ? {
                    rx: fsStats.rx || 0,
                    wx: fsStats.wx || 0,
                    tx: fsStats.tx || 0,
                    rx_sec: fsStats.rx_sec || 0,
                    wx_sec: fsStats.wx_sec || 0,
                    tx_sec: fsStats.tx_sec || 0,
                    ms: fsStats.ms || 0
                } : null,
                network: networkStats.map(iface => ({
                    iface: iface.iface,
                    rx_bytes: iface.rx_bytes,
                    tx_bytes: iface.tx_bytes,
                    rx_sec: iface.rx_sec,
                    tx_sec: iface.tx_sec,
                    operstate: iface.operstate,
                    // Errors and packet loss
                    rx_errors: iface.rx_errors || 0,
                    tx_errors: iface.tx_errors || 0,
                    rx_dropped: iface.rx_dropped || 0,
                    tx_dropped: iface.tx_dropped || 0
                })),
                // Temperature sensors
                temperatures: {
                    main: cpuTemp.main || null,
                    cores: cpuTemp.cores || [],
                    max: cpuTemp.max || null,
                    // GPU temperatures
                    gpu: graphics.controllers && graphics.controllers.length > 0
                        ? graphics.controllers.map(gpu => ({
                            model: gpu.model,
                            temperature: gpu.temperatureGpu || null,
                            temperatureMemory: gpu.temperatureMemory || null,
                            fanSpeed: gpu.fanSpeed || null,
                            utilizationGpu: gpu.utilizationGpu || null,
                            utilizationMemory: gpu.utilizationMemory || null,
                            memoryTotal: gpu.memoryTotal || null,
                            memoryUsed: gpu.memoryUsed || null,
                            memoryFree: gpu.memoryFree || null
                        }))
                        : []
                },
                // Disk health (SMART status)
                diskHealth: diskLayout.map(disk => ({
                    device: disk.device,
                    type: disk.type,
                    name: disk.name,
                    vendor: disk.vendor,
                    size: disk.size,
                    smartStatus: disk.smartStatus || 'unknown',
                    temperature: disk.temperature || null
                })),
                uptime: si.time().uptime
            };

            // Store historical data (enhanced)
            if (this.storage) {
                this.storage.addDataPoint('cpu', currentLoad.currentLoad);
                this.storage.addDataPoint('memory', (mem.active / mem.total) * 100);

                // Store temperature if available
                if (cpuTemp.main) {
                    this.storage.addDataPoint('cpu_temp', cpuTemp.main);
                }

                // Store disk I/O
                if (fsStats && fsStats.rx_sec !== undefined) {
                    this.storage.addDataPoint('disk_read', fsStats.rx_sec / 1024 / 1024); // MB/s
                    this.storage.addDataPoint('disk_write', fsStats.wx_sec / 1024 / 1024); // MB/s
                }

                // Store network I/O
                const totalRx = networkStats.reduce((sum, n) => sum + (n.rx_sec || 0), 0);
                const totalTx = networkStats.reduce((sum, n) => sum + (n.tx_sec || 0), 0);
                this.storage.addDataPoint('network_rx', totalRx / 1024 / 1024); // MB/s
                this.storage.addDataPoint('network_tx', totalTx / 1024 / 1024); // MB/s
            }

            this.wsHandler.broadcast('SYSTEM_METRICS', data);
        } catch (error) {
            console.error('Error fetching system metrics:', error);
        }
    }
}

module.exports = SystemMonitor;
