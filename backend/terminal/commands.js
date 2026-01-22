const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class CommandHandler {
    constructor(wsHandler, config) {
        this.wsHandler = wsHandler;
        this.config = config;
        this.setupMessageHandler();
    }

    setupMessageHandler() {
        // This will be called from WebSocket handler
        this.wsHandler.handleMessage = (ws, data) => {
            if (data.type === 'EXECUTE_COMMAND') {
                this.executeCommand(ws, data.payload);
            }
        };
    }

    async executeCommand(ws, payload) {
        const { command } = payload;

        try {
            const { stdout, stderr } = await execPromise(command, {
                timeout: 30000, // 30 second timeout
                maxBuffer: 1024 * 1024 // 1MB buffer
            });

            this.wsHandler.send(ws, {
                type: 'COMMAND_RESULT',
                payload: {
                    success: true,
                    command,
                    stdout,
                    stderr
                }
            });
        } catch (error) {
            this.wsHandler.send(ws, {
                type: 'COMMAND_RESULT',
                payload: {
                    success: false,
                    command,
                    error: error.message,
                    stdout: error.stdout || '',
                    stderr: error.stderr || ''
                }
            });
        }
    }

    getQuickCommands() {
        return this.config.quickCommands || [];
    }
}

module.exports = CommandHandler;
