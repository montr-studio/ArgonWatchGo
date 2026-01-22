const nodemailer = require('nodemailer');
const axios = require('axios');

class Notifier {
    constructor(config = {}) {
        this.config = config;
        this.emailTransporter = null;

        // Initialize email if configured
        if (config.email && config.email.enabled) {
            this.initializeEmail();
        }
    }

    // Initialize email transporter
    initializeEmail() {
        try {
            this.emailTransporter = nodemailer.createTransporter(this.config.email.smtp);
            console.log('✉️  Email notifications enabled');
        } catch (error) {
            console.error('Failed to initialize email:', error.message);
        }
    }

    // Send notification through all configured channels
    async notify(alert, rule) {
        const channels = rule.notifications || [];
        const promises = [];

        for (const channel of channels) {
            switch (channel) {
                case 'email':
                    if (this.config.email && this.config.email.enabled) {
                        promises.push(this.sendEmail(alert, rule));
                    }
                    break;
                case 'discord':
                    if (this.config.discord && this.config.discord.enabled) {
                        promises.push(this.sendDiscord(alert, rule));
                    }
                    break;
                case 'slack':
                    if (this.config.slack && this.config.slack.enabled) {
                        promises.push(this.sendSlack(alert, rule));
                    }
                    break;
                case 'webhook':
                    if (this.config.webhook && this.config.webhook.enabled) {
                        promises.push(this.sendWebhook(alert, rule));
                    }
                    break;
                case 'desktop':
                    this.sendDesktopNotification(alert, rule);
                    break;
            }
        }

        try {
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('Notification error:', error);
        }
    }

    // Send email notification
    async sendEmail(alert, rule) {
        if (!this.emailTransporter) return;

        const subject = `[${alert.severity.toUpperCase()}] ${rule.name}`;
        const html = `
            <h2>Alert: ${rule.name}</h2>
            <p><strong>Status:</strong> ${alert.status}</p>
            <p><strong>Metric:</strong> ${rule.metric}</p>
            <p><strong>Current Value:</strong> ${alert.value}</p>
            <p><strong>Threshold:</strong> ${rule.threshold}</p>
            <p><strong>Severity:</strong> ${alert.severity}</p>
            <p><strong>Time:</strong> ${alert.timestamp}</p>
        `;

        try {
            await this.emailTransporter.sendMail({
                from: this.config.email.from,
                to: this.config.email.to,
                subject,
                html
            });
            console.log(`📧 Email sent: ${rule.name}`);
        } catch (error) {
            console.error('Email send failed:', error.message);
        }
    }

    // Send Discord webhook
    async sendDiscord(alert, rule) {
        const color = this.getSeverityColor(alert.severity);
        const emoji = alert.status === 'triggered' ? '🚨' : '✅';

        const embed = {
            title: `${emoji} ${rule.name}`,
            description: alert.status === 'triggered' ? 'Alert Triggered' : 'Alert Resolved',
            color: color,
            fields: [
                { name: 'Metric', value: rule.metric, inline: true },
                { name: 'Value', value: String(alert.value), inline: true },
                { name: 'Threshold', value: String(rule.threshold), inline: true },
                { name: 'Severity', value: alert.severity.toUpperCase(), inline: true }
            ],
            timestamp: alert.timestamp,
            footer: { text: 'ArgonWatch Server Monitor' }
        };

        try {
            await axios.post(this.config.discord.webhookUrl, {
                embeds: [embed]
            });
            console.log(`💬 Discord notification sent: ${rule.name}`);
        } catch (error) {
            console.error('Discord send failed:', error.message);
        }
    }

    // Send Slack webhook
    async sendSlack(alert, rule) {
        const emoji = alert.status === 'triggered' ? ':rotating_light:' : ':white_check_mark:';
        const color = alert.status === 'triggered' ? 'danger' : 'good';

        const payload = {
            text: `${emoji} *${rule.name}*`,
            attachments: [{
                color: color,
                fields: [
                    { title: 'Metric', value: rule.metric, short: true },
                    { title: 'Value', value: String(alert.value), short: true },
                    { title: 'Threshold', value: String(rule.threshold), short: true },
                    { title: 'Severity', value: alert.severity.toUpperCase(), short: true }
                ],
                footer: 'ArgonWatch',
                ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
            }]
        };

        try {
            await axios.post(this.config.slack.webhookUrl, payload);
            console.log(`💼 Slack notification sent: ${rule.name}`);
        } catch (error) {
            console.error('Slack send failed:', error.message);
        }
    }

    // Send custom webhook
    async sendWebhook(alert, rule) {
        const payload = {
            alert: {
                id: alert.id,
                name: rule.name,
                metric: rule.metric,
                value: alert.value,
                threshold: rule.threshold,
                severity: alert.severity,
                status: alert.status,
                timestamp: alert.timestamp
            }
        };

        try {
            await axios.post(this.config.webhook.url, payload, {
                headers: this.config.webhook.headers || {}
            });
            console.log(`🔗 Webhook sent: ${rule.name}`);
        } catch (error) {
            console.error('Webhook send failed:', error.message);
        }
    }

    // Send desktop notification (console log for now, can use node-notifier)
    sendDesktopNotification(alert, rule) {
        console.log(`🖥️  Desktop notification: ${rule.name} - ${alert.status}`);
        // Could implement node-notifier here if needed
    }

    // Get color based on severity
    getSeverityColor(severity) {
        const colors = {
            critical: 0xFF0000,  // Red
            error: 0xFF4444,     // Light Red
            warning: 0xFFAA00,   // Orange
            info: 0x3B82F6,      // Blue
            success: 0x10B981    // Green
        };
        return colors[severity] || colors.info;
    }

    // Test notification
    async test(channel) {
        const testAlert = {
            id: 'test-' + Date.now(),
            value: 99,
            threshold: 90,
            severity: 'warning',
            status: 'triggered',
            timestamp: new Date().toISOString()
        };

        const testRule = {
            name: 'Test Alert',
            metric: 'test.metric',
            notifications: [channel]
        };

        await this.notify(testAlert, testRule);
    }
}

module.exports = Notifier;
