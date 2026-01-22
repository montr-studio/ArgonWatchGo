import { WebSocketClient } from './utils/websocket.js';
import { GaugeChart } from './utils/gauge.js';

class App {
    constructor() {
        this.ws = new WebSocketClient(`ws://${window.location.host}`);
        this.gauges = {};
        this.networkHistory = { rx: 0, tx: 0 };
        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupUI();
        this.initializeGauges();
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
        const cpuLoad = Math.round(data.cpu.load);
        this.gauges.cpu.update(cpuLoad);
        document.getElementById('cpu-gauge-value').textContent = `${cpuLoad}%`;

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

