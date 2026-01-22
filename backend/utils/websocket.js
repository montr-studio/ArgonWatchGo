const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

class WebSocketHandler {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Set();
        this.messageHandlers = new Map();

        this.setupConnectionHandler();
        this.startHeartbeat();
    }

    setupConnectionHandler() {
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            ws.isAlive = true;

            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (e) {
                    console.error('Invalid JSON message received');
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
            });

            // Send initial connection success
            this.send(ws, { type: 'CONNECTION_ESTABLISHED' });
        });
    }

    startHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) return ws.terminate();

                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    handleMessage(ws, data) {
        // Handle incoming messages from frontend
        // This will be overridden by command handler
        console.log('Received message:', data.type);

        // Emit to registered handlers
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(ws, data.payload);
        }
    }

    on(type, callback) {
        this.messageHandlers.set(type, callback);
    }

    broadcast(type, payload) {
        const message = JSON.stringify({ type, payload, timestamp: Date.now() });
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ...data, timestamp: Date.now() }));
        }
    }
}

module.exports = WebSocketHandler;
