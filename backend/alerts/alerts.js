const EventEmitter = require('events');

class AlertEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.rules = config.rules || [];
        this.alertStates = new Map(); // Track alert states
        this.alertHistory = [];
        this.maintenanceMode = false;
    }

    // Add or update alert rule
    addRule(rule) {
        const existingIndex = this.rules.findIndex(r => r.id === rule.id);
        if (existingIndex >= 0) {
            this.rules[existingIndex] = { ...this.rules[existingIndex], ...rule };
        } else {
            this.rules.push(rule);
        }
        return rule;
    }

    // Remove alert rule
    removeRule(ruleId) {
        this.rules = this.rules.filter(r => r.id !== ruleId);
        this.alertStates.delete(ruleId);
    }

    // Check metrics against all rules
    checkMetrics(metrics) {
        if (this.maintenanceMode) return;

        this.rules.forEach(rule => {
            if (!rule.enabled) return;

            const value = this.getMetricValue(metrics, rule.metric);
            if (value === null || value === undefined) return;

            const triggered = this.evaluateCondition(value, rule.condition, rule.threshold);
            const state = this.alertStates.get(rule.id) || { triggered: false, since: null, acknowledged: false };

            if (triggered && !state.triggered) {
                // Alert just triggered
                state.triggered = true;
                state.since = Date.now();
                state.value = value;
                this.alertStates.set(rule.id, state);

                // Check if duration requirement met
                if (!rule.duration || rule.duration === 0) {
                    this.triggerAlert(rule, value);
                }
            } else if (triggered && state.triggered) {
                // Alert still triggered, check duration
                const elapsed = Date.now() - state.since;
                if (rule.duration && elapsed >= rule.duration && !state.alerted) {
                    state.alerted = true;
                    this.alertStates.set(rule.id, state);
                    this.triggerAlert(rule, value);
                }
            } else if (!triggered && state.triggered) {
                // Alert resolved
                this.resolveAlert(rule, value);
                this.alertStates.delete(rule.id);
            }
        });
    }

    // Get metric value from nested object
    getMetricValue(metrics, path) {
        const parts = path.split('.');
        let value = metrics;
        for (const part of parts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return null;
            }
        }
        return value;
    }

    // Evaluate condition
    evaluateCondition(value, condition, threshold) {
        switch (condition) {
            case '>':
            case 'greater_than':
                return value > threshold;
            case '<':
            case 'less_than':
                return value < threshold;
            case '>=':
            case 'greater_equal':
                return value >= threshold;
            case '<=':
            case 'less_equal':
                return value <= threshold;
            case '==':
            case 'equals':
                return value == threshold;
            case '!=':
            case 'not_equals':
                return value != threshold;
            default:
                return false;
        }
    }

    // Trigger alert
    triggerAlert(rule, value) {
        const alert = {
            id: `${rule.id}-${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            metric: rule.metric,
            value: value,
            threshold: rule.threshold,
            severity: rule.severity || 'warning',
            timestamp: new Date().toISOString(),
            status: 'triggered'
        };

        this.alertHistory.push(alert);
        this.emit('alert:triggered', alert, rule);

        console.log(`🚨 ALERT: ${rule.name} - ${rule.metric} = ${value} (threshold: ${rule.threshold})`);
    }

    // Resolve alert
    resolveAlert(rule, value) {
        const alert = {
            id: `${rule.id}-resolved-${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            metric: rule.metric,
            value: value,
            threshold: rule.threshold,
            timestamp: new Date().toISOString(),
            status: 'resolved'
        };

        this.alertHistory.push(alert);
        this.emit('alert:resolved', alert, rule);

        console.log(`✅ RESOLVED: ${rule.name} - ${rule.metric} = ${value}`);
    }

    // Acknowledge alert
    acknowledgeAlert(ruleId) {
        const state = this.alertStates.get(ruleId);
        if (state) {
            state.acknowledged = true;
            this.alertStates.set(ruleId, state);
            this.emit('alert:acknowledged', ruleId);
        }
    }

    // Get active alerts
    getActiveAlerts() {
        const active = [];
        this.alertStates.forEach((state, ruleId) => {
            if (state.triggered && state.alerted) {
                const rule = this.rules.find(r => r.id === ruleId);
                if (rule) {
                    active.push({
                        ruleId,
                        ruleName: rule.name,
                        metric: rule.metric,
                        value: state.value,
                        threshold: rule.threshold,
                        severity: rule.severity,
                        since: state.since,
                        acknowledged: state.acknowledged
                    });
                }
            }
        });
        return active;
    }

    // Get alert history
    getHistory(limit = 100) {
        return this.alertHistory.slice(-limit).reverse();
    }

    // Enable/disable maintenance mode
    setMaintenanceMode(enabled) {
        this.maintenanceMode = enabled;
        console.log(`Maintenance mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
}

module.exports = AlertEngine;
