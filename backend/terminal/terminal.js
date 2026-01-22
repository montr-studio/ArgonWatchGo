const pty = require('node-pty');
const os = require('os');

class TerminalHandler {
    constructor(wsHandler, config) {
        this.wsHandler = wsHandler;
        this.config = config;
        this.sessions = new Map();
        this.setupMessageHandler();
    }

    setupMessageHandler() {
        // Listen for terminal-related WebSocket messages
        this.wsHandler.on = (type, callback) => {
            if (type === 'TERMINAL_INPUT') {
                callback((data) => this.handleInput(data));
            } else if (type === 'TERMINAL_CREATE') {
                callback((data) => this.createSession(data));
            } else if (type === 'TERMINAL_CLOSE') {
                callback((data) => this.closeSession(data));
            }
        };
    }

    createSession(data) {
        const sessionId = data.sessionId || Date.now().toString();

        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: data.cols || 80,
            rows: data.rows || 24,
            cwd: process.env.HOME || process.cwd(),
            env: process.env
        });

        ptyProcess.onData((output) => {
            this.wsHandler.broadcast('TERMINAL_OUTPUT', {
                sessionId,
                data: output
            });
        });

        ptyProcess.onExit(() => {
            this.sessions.delete(sessionId);
            this.wsHandler.broadcast('TERMINAL_EXIT', { sessionId });
        });

        this.sessions.set(sessionId, ptyProcess);

        return sessionId;
    }

    handleInput(data) {
        const { sessionId, input } = data;
        const session = this.sessions.get(sessionId);

        if (session) {
            session.write(input);
        }
    }

    closeSession(data) {
        const { sessionId } = data;
        const session = this.sessions.get(sessionId);

        if (session) {
            session.kill();
            this.sessions.delete(sessionId);
        }
    }

    resizeSession(sessionId, cols, rows) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.resize(cols, rows);
        }
    }
}

module.exports = TerminalHandler;
