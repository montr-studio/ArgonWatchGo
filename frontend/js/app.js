import { WebSocketClient } from './utils/websocket.js';
import { GaugeChart } from './utils/gauge.js';

class App {
    constructor() {
        this.ws = new WebSocketClient(`ws://${window.location.host}`);
        this.gauges = {};
        this.networkHistory = { rx: 0, tx: 0 };
        this.currentChart = null;
        this.currentGraphType = 'cpu';
        this.historicalData = {
            cpu: { labels: [], data: [] },
            memory: { labels: [], data: [] },
            network: { labels: [], datasets: [[], []] },
            temperature: { labels: [], data: [] }
        };
        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupUI();
        this.initializeGauges();
        this.initializeChart();
    }

    initializeGauges() {
        this.gauges.cpu = new GaugeChart('cpu-gauge', { maxValue: 100, color: '#3b82f6', label: 'CPU' });
        this.gauges.ram = new GaugeChart('ram-gauge', { maxValue: 100, color: '#8b5cf6', label: 'RAM' });
        this.gauges.disk = new GaugeChart('disk-gauge', { maxValue: 100, color: '#ec4899', label: 'DISK' });
        this.gauges.network = new GaugeChart('network-gauge', { maxValue: 100, color: '#10b981', label: 'NET I/O' });

        // Initial draw
        this.gauges.cpu.draw(0);
        this.gauges.ram.draw(0);
        this.gauges.disk.draw(0);
        this.gauges.network.draw(0);
    }

    setupWebSocket() {
        this.ws.connect();

        this.ws.on('CONNECTION_STATUS', ({ status }) => {
            const el = document.getElementById('connection-status');
            const text = el.querySelector('.status-text');
            if (status === 'connected') {
                el.classList.add('connected');
                text.textContent = 'Connected';
            } else {
                el.classList.remove('connected');
                text.textContent = 'Disconnected';
            }
        });

        this.ws.on('SYSTEM_METRICS', (data) => {
            this.updateSystemMetrics(data);
        });

        this.ws.on('PM2_METRICS', (data) => {
            this.updatePm2Table(data);
        });

        this.ws.on('RUNNER_STATUS', (data) => {
            this.updateRunnerStatus(data);
        });

        this.ws.on('COMMAND_RESULT', (data) => {
            this.handleCommandResult(data);
        });
    }

    setupUI() {
        // Theme toggle - simple one-click toggle
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            // Store preference
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        });

        // Load saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        }

        // Restart Server button
        const restartServerBtn = document.getElementById('restart-server-btn');
        if (restartServerBtn) {
            restartServerBtn.addEventListener('click', () => {
                this.showModal(
                    'Confirm Restart',
                    'Are you sure you want to restart the server? This will disconnect all clients temporarily.',
                    () => {
                        this.ws.send('EXECUTE_COMMAND', { command: 'echo "Simulated restart"' });
                    }
                );
            });
        }

        // Copy IP Address button
        const copyIpBtn = document.getElementById('copy-ip-btn');
        if (copyIpBtn) {
            copyIpBtn.addEventListener('click', () => {
                const ipAddress = document.getElementById('ip-address').textContent;
                navigator.clipboard.writeText(ipAddress).then(() => {
                    // Visual feedback
                    const originalHTML = copyIpBtn.innerHTML;
                    copyIpBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                    setTimeout(() => {
                        copyIpBtn.innerHTML = originalHTML;
                    }, 1500);
                }).catch(err => {
                    console.error('Failed to copy IP:', err);
                });
            });
        }

        // Modal handlers
        this.modal = document.getElementById('command-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalMessage = document.getElementById('modal-message');
        this.modalConfirm = document.getElementById('modal-confirm');
        this.modalCancel = document.getElementById('modal-cancel');

        this.modalCancel.addEventListener('click', () => {
            this.hideModal();
        });

        // Terminal toggle
        const terminalToggle = document.getElementById('toggle-terminal');
        if (terminalToggle) {
            terminalToggle.addEventListener('click', () => {
                const terminal = document.getElementById('runner-terminal');
                terminal.classList.toggle('collapsed');
                terminalToggle.textContent = terminal.classList.contains('collapsed') ? 'Expand' : 'Collapse';
            });
        }

        // Graph tabs
        const graphTabs = document.querySelectorAll('.graph-tab');
        graphTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                graphTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Switch graph
                this.currentGraphType = tab.dataset.graph;
                this.updateHistoricalChart();
            });
        });
    }

    initializeChart() {
        const ctx = document.getElementById('history-chart');
        if (!ctx) return;

        this.currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage (%)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                            maxRotation: 0,
                            maxTicksLimit: 10
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }

    updateHistoricalChart() {
        if (!this.currentChart) return;

        const data = this.historicalData[this.currentGraphType];

        // Update chart based on type
        switch (this.currentGraphType) {
            case 'cpu':
                this.currentChart.data.labels = data.labels;
                this.currentChart.data.datasets = [{
                    label: 'CPU Usage (%)',
                    data: data.data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }];
                this.currentChart.options.scales.y.max = 100;
                break;

            case 'memory':
                this.currentChart.data.labels = data.labels;
                this.currentChart.data.datasets = [{
                    label: 'Memory Usage (%)',
                    data: data.data,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }];
                this.currentChart.options.scales.y.max = 100;
                break;

            case 'network':
                this.currentChart.data.labels = data.labels;
                this.currentChart.data.datasets = [
                    {
                        label: 'Download (MB/s)',
                        data: data.datasets[0],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Upload (MB/s)',
                        data: data.datasets[1],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }
                ];
                delete this.currentChart.options.scales.y.max;
                break;

            case 'temperature':
                this.currentChart.data.labels = data.labels;
                this.currentChart.data.datasets = [{
                    label: 'CPU Temperature (°C)',
                    data: data.data,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }];
                this.currentChart.options.scales.y.max = 100;
                break;
        }

        this.currentChart.update();
    }

    addHistoricalDataPoint(cpuLoad, memPercent, networkRx, networkTx, cpuTemp) {
        const timestamp = new Date().toLocaleTimeString();
        const maxPoints = 60; // Keep last 60 points

        // CPU
        this.historicalData.cpu.labels.push(timestamp);
        this.historicalData.cpu.data.push(cpuLoad);
        if (this.historicalData.cpu.labels.length > maxPoints) {
            this.historicalData.cpu.labels.shift();
            this.historicalData.cpu.data.shift();
        }

        // Memory
        this.historicalData.memory.labels.push(timestamp);
        this.historicalData.memory.data.push(memPercent);
        if (this.historicalData.memory.labels.length > maxPoints) {
            this.historicalData.memory.labels.shift();
            this.historicalData.memory.data.shift();
        }

        // Network
        this.historicalData.network.labels.push(timestamp);
        this.historicalData.network.datasets[0].push(networkRx);
        this.historicalData.network.datasets[1].push(networkTx);
        if (this.historicalData.network.labels.length > maxPoints) {
            this.historicalData.network.labels.shift();
            this.historicalData.network.datasets[0].shift();
            this.historicalData.network.datasets[1].shift();
        }

        // Temperature
        if (cpuTemp !== null) {
            this.historicalData.temperature.labels.push(timestamp);
            this.historicalData.temperature.data.push(cpuTemp);
            if (this.historicalData.temperature.labels.length > maxPoints) {
                this.historicalData.temperature.labels.shift();
                this.historicalData.temperature.data.shift();
            }
        }

        // Update current chart
        this.updateHistoricalChart();
    }

    showModal(title, message, onConfirm) {
        this.modalTitle.textContent = title;
        // Use innerHTML to support pre-formatted content
        this.modalMessage.innerHTML = message;
        this.modal.style.display = 'flex';

        // Remove old listeners
        const newConfirmBtn = this.modalConfirm.cloneNode(true);
        this.modalConfirm.parentNode.replaceChild(newConfirmBtn, this.modalConfirm);
        this.modalConfirm = newConfirmBtn;

        this.modalConfirm.addEventListener('click', () => {
            this.hideModal();
            if (onConfirm) onConfirm();
        });
    }

    hideModal() {
        this.modal.style.display = 'none';
    }

    async updateSystemMetrics(data) {
        // Update system info header
        if (data.system) {
            document.getElementById('os-name').textContent = `${data.system.distro || data.system.os}`;
            document.getElementById('hostname').textContent = data.system.hostname;
            document.getElementById('server-name').textContent = data.system.hostname; // Can be customized
            document.getElementById('ip-address').textContent = data.system.ipAddress;
            document.getElementById('uptime').textContent = this.formatUptime(data.uptime * 1000);
        }

        // Update CPU gauge
        const cpuPercent = Math.round(data.cpu.load);
        this.gauges.cpu.update(cpuPercent);
        document.getElementById('cpu-gauge-value').textContent = `${cpuPercent}%`;

        // Update RAM gauge
        const ramPercent = Math.round(data.memory.percentage || 0);
        this.gauges.ram.update(ramPercent);
        const usedGB = (data.memory.active / 1024 / 1024 / 1024).toFixed(1);
        const totalGB = (data.memory.total / 1024 / 1024 / 1024).toFixed(1);
        document.getElementById('ram-gauge-value').textContent = `${ramPercent}% (${usedGB}/${totalGB}GB)`;

        // Update Disk gauge (average of all disks)
        if (data.disk && data.disk.length > 0) {
            const avgDiskUsage = data.disk.reduce((sum, d) => sum + d.use, 0) / data.disk.length;
            this.gauges.disk.update(Math.round(avgDiskUsage));
            document.getElementById('disk-gauge-value').textContent = `${Math.round(avgDiskUsage)}%`;
        }

        // Update Network gauge (calculate MB/s)
        if (data.network && data.network.length > 0) {
            const totalRx = data.network.reduce((sum, n) => sum + (n.rx_sec || 0), 0);
            const totalTx = data.network.reduce((sum, n) => sum + (n.tx_sec || 0), 0);
            const totalMBps = ((totalRx + totalTx) / 1024 / 1024).toFixed(2);

            // Scale to 0-100 for gauge (assuming max 100 MB/s)
            const networkPercent = Math.min((parseFloat(totalMBps) / 100) * 100, 100);
            this.gauges.network.update(networkPercent);
            document.getElementById('network-gauge-value').textContent = `${totalMBps} MB/s`;
        }

        // === NEW: Update Temperature Sensors ===
        if (data.temperatures && data.temperatures.main !== null) {
            const tempCard = document.getElementById('temp-card');
            tempCard.style.display = 'block';

            const cpuTemp = Math.round(data.temperatures.main);
            document.getElementById('cpu-temp').textContent = `${cpuTemp}°C`;

            // Color-coded temperature bar
            const tempFill = document.getElementById('cpu-temp-fill');
            const tempPercent = Math.min((cpuTemp / 100) * 100, 100);
            tempFill.style.width = `${tempPercent}%`;

            if (cpuTemp < 60) {
                tempFill.style.backgroundColor = '#10b981'; // Green
            } else if (cpuTemp < 80) {
                tempFill.style.backgroundColor = '#f59e0b'; // Yellow
            } else {
                tempFill.style.backgroundColor = '#ef4444'; // Red
            }

            // GPU temperatures
            if (data.temperatures.gpu && data.temperatures.gpu.length > 0) {
                const gpuContainer = document.getElementById('gpu-temps-container');
                gpuContainer.innerHTML = data.temperatures.gpu.map((gpu, idx) => {
                    const temp = gpu.temperature ? Math.round(gpu.temperature) : '--';
                    const fanSpeed = gpu.fanSpeed ? Math.round(gpu.fanSpeed) : '--';
                    return `
                        <div class="temp-item">
                            <div class="temp-label">GPU ${idx + 1} (${gpu.model || 'Unknown'})</div>
                            <div class="temp-value">${temp}°C | Fan: ${fanSpeed}%</div>
                            <div class="temp-bar">
                                <div class="temp-fill" style="width: ${Math.min(temp, 100)}%; background-color: ${temp < 70 ? '#10b981' : temp < 85 ? '#f59e0b' : '#ef4444'};"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // === NEW: Update CPU Details ===
        if (data.cpu) {
            // Load averages (show 0.00 on Windows where not supported)
            const la1 = data.cpu.loadAverage1 ? data.cpu.loadAverage1.toFixed(2) : '0.00';
            const la5 = data.cpu.loadAverage5 ? data.cpu.loadAverage5.toFixed(2) : '0.00';
            const la15 = data.cpu.loadAverage15 ? data.cpu.loadAverage15.toFixed(2) : '0.00';
            document.getElementById('load-averages').textContent = `${la1} / ${la5} / ${la15}`;

            // Current speed
            const speed = data.cpu.avgSpeed ? data.cpu.avgSpeed.toFixed(2) : data.cpu.speed;
            document.getElementById('cpu-current-speed').textContent = `${speed} GHz`;

            // Core counts
            document.getElementById('cpu-physical-cores').textContent = data.cpu.physicalCores || data.cpu.cores;
            document.getElementById('cpu-logical-cores').textContent = data.cpu.cores;

            // Per-core loads
            if (data.cpu.coreLoads && data.cpu.coreLoads.length > 0) {
                const perCoreSection = document.getElementById('per-core-section');
                perCoreSection.style.display = 'block';

                const coresGrid = document.getElementById('cores-grid');
                coresGrid.innerHTML = data.cpu.coreLoads.map((core, idx) => {
                    const load = Math.round(core.load);
                    return `
                        <div class="core-item">
                            <div class="core-label">Core ${idx}</div>
                            <div class="core-bar">
                                <div class="core-fill" style="width: ${load}%; background-color: ${load < 70 ? '#3b82f6' : load < 90 ? '#f59e0b' : '#ef4444'};"></div>
                            </div>
                            <div class="core-value">${load}%</div>
                        </div>
                    `;
                }).join('');
            }
        }

        // === NEW: Update Memory Details ===
        if (data.memory) {
            // Helper to safely format memory values (handle NaN/null/undefined)
            const formatMem = (val) => ((val || 0) / 1024 / 1024 / 1024).toFixed(2);
            const formatPct = (val) => Math.round(val || 0);

            document.getElementById('mem-active').textContent = `${formatMem(data.memory.active)} GB`;
            document.getElementById('mem-cached').textContent = `${formatMem(data.memory.cached)} GB`;
            document.getElementById('mem-buffers').textContent = `${formatMem(data.memory.buffers)} GB`;
            document.getElementById('swap-used').textContent = `${formatMem(data.memory.swapUsed)} GB`;
            document.getElementById('swap-total').textContent = `${formatMem(data.memory.swapTotal)} GB`;
            document.getElementById('swap-percentage').textContent = `${formatPct(data.memory.swapPercentage)}%`;
        }

        // === NEW: Update Disk I/O ===
        if (data.diskIO) {
            const readSpeed = (data.diskIO.rx_sec / 1024 / 1024).toFixed(2);
            const writeSpeed = (data.diskIO.wx_sec / 1024 / 1024).toFixed(2);
            const totalIO = (parseFloat(readSpeed) + parseFloat(writeSpeed)).toFixed(2);

            document.getElementById('disk-read-speed').textContent = `${readSpeed} MB/s`;
            document.getElementById('disk-write-speed').textContent = `${writeSpeed} MB/s`;
            document.getElementById('disk-total-io').textContent = `${totalIO} MB/s`;
        }

        // === NEW: Update Network Details Table ===
        if (data.network && data.network.length > 0) {
            const networkTableBody = document.getElementById('network-table-body');
            networkTableBody.innerHTML = data.network.map(iface => {
                const rxSpeed = (iface.rx_sec / 1024 / 1024).toFixed(2);
                const txSpeed = (iface.tx_sec / 1024 / 1024).toFixed(2);
                const statusClass = iface.operstate === 'up' ? 'status-active' : 'status-offline';

                return `
                    <tr>
                        <td><strong>${iface.iface}</strong></td>
                        <td><span class="runner-status-badge ${statusClass}">${iface.operstate}</span></td>
                        <td>${rxSpeed} MB/s</td>
                        <td>${txSpeed} MB/s</td>
                        <td>${iface.rx_errors || 0}</td>
                        <td>${iface.tx_errors || 0}</td>
                        <td>${(iface.rx_dropped || 0) + (iface.tx_dropped || 0)}</td>
                    </tr>
                `;
            }).join('');
        }

        // === NEW: Update Disk Health (SMART) ===
        if (data.diskHealth && data.diskHealth.length > 0) {
            const hasSmartData = data.diskHealth.some(disk => disk.smartStatus !== 'unknown');
            if (hasSmartData) {
                const diskHealthCard = document.getElementById('disk-health-card');
                diskHealthCard.style.display = 'block';

                const diskHealthBody = document.getElementById('disk-health-body');
                diskHealthBody.innerHTML = data.diskHealth.map(disk => {
                    const sizeGB = (disk.size / 1024 / 1024 / 1024).toFixed(0);
                    const statusClass = disk.smartStatus === 'Ok' || disk.smartStatus === 'PASSED' ? 'status-active' :
                        disk.smartStatus === 'unknown' ? 'status-idle' : 'status-offline';
                    const temp = disk.temperature ? `${disk.temperature}°C` : '--';

                    return `
                        <tr>
                            <td><strong>${disk.device || disk.name}</strong></td>
                            <td>${disk.type}</td>
                            <td>${sizeGB} GB</td>
                            <td><span class="runner-status-badge ${statusClass}">${disk.smartStatus}</span></td>
                            <td>${temp}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Add data point to historical charts
        const cpuLoad = Math.round(data.cpu.load);
        const memPercent = Math.round(data.memory.percentage || 0);
        const networkRx = data.network && data.network.length > 0
            ? data.network.reduce((sum, n) => sum + (n.rx_sec || 0), 0) / 1024 / 1024
            : 0;
        const networkTx = data.network && data.network.length > 0
            ? data.network.reduce((sum, n) => sum + (n.tx_sec || 0), 0) / 1024 / 1024
            : 0;
        const cpuTemp = data.temperatures && data.temperatures.main !== null
            ? Math.round(data.temperatures.main)
            : null;

        this.addHistoricalDataPoint(cpuLoad, memPercent, networkRx, networkTx, cpuTemp);
    }

    updatePm2Table(processes) {
        const tbody = document.getElementById('pm2-table-body');
        tbody.innerHTML = processes.map(proc => {
            let statusClass = 'status-offline';
            if (proc.status === 'online') statusClass = 'status-active';

            const memory = (proc.memory / 1024 / 1024).toFixed(1);
            const uptime = this.formatUptime(proc.uptime);

            // Dynamic button based on status
            const isOnline = proc.status === 'online';
            const actionBtn = isOnline
                ? `<button class="icon-btn pm2-action-btn" onclick="app.executeProcAction('${proc.name}', 'stop')" title="Stop Process">⏹</button>`
                : `<button class="icon-btn pm2-action-btn" onclick="app.executeProcAction('${proc.name}', 'start')" title="Start Process">▶</button>`;

            return `
                <tr>
                    <td><strong>${proc.name}</strong></td>
                    <td><span class="runner-status-badge ${statusClass}">${proc.status}</span></td>
                    <td>${proc.cpu}% / ${memory}MB</td>
                    <td>${uptime}</td>
                    <td>${proc.restarts}</td>
                    <td>
                        <button class="icon-btn pm2-action-btn" onclick="app.executeProcAction('${proc.name}', 'restart')" title="Restart Process">↺</button>
                        ${actionBtn}
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateRunnerStatus(data) {
        const badge = document.getElementById('runner-badge');
        const jobName = document.getElementById('job-name');
        const duration = document.getElementById('job-duration');

        badge.textContent = data.status;
        badge.className = `runner-status-badge status-${data.status}`;

        if (data.status === 'active') {
            jobName.textContent = data.jobName;
            duration.textContent = data.jobDuration;
        } else {
            jobName.textContent = '-';
            duration.textContent = '-';
        }
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    }

    executeProcAction(name, action) {
        // Use custom modal instead of browser confirm
        this.showModal(
            'Confirm Action',
            `Are you sure you want to ${action} the process "${name}"?`,
            () => {
                this.ws.send('EXECUTE_COMMAND', { command: `pm2 ${action} ${name}` });
            }
        );
    }

    handleCommandResult(data) {
        if (data.success) {
            const output = data.stdout || 'No output';
            this.showModal(
                'Command Executed Successfully',
                `<pre class="command-output">${this.escapeHtml(output)}</pre>`,
                null
            );
        } else {
            const errorMsg = `Error: ${data.error}\n\n${data.stderr || ''}`;
            this.showModal(
                'Command Failed',
                `<pre class="command-output error">${this.escapeHtml(errorMsg)}</pre>`,
                null
            );
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Start app
const app = new App();
// Make app global for inline onclick handlers
window.app = app;

