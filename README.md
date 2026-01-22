# Server Monitor

A lightweight, self-hostable server monitoring tool with minimal resource usage.

## Features

✅ **System Resource Monitoring**
- Real-time CPU, Memory, Disk, and Network monitoring
- Live charts and visualizations
- Historical data storage (7 days retention)

✅ **GitHub Actions Runner Status**
- Monitor self-hosted runner status (Idle/Active/Offline)
- View live terminal logs during job execution
- Track current job and duration

✅ **PM2 Process Management**
- View all PM2 processes in a table
- Monitor status, uptime, restarts, CPU, and memory
- Quick actions (restart, stop) via GUI buttons

✅ **Web-Based Terminal** (Coming Soon)
- Full terminal access via browser
- No SSH port 22 required
- Secure WebSocket communication

✅ **Quick Commands**
- Pre-defined command buttons for common tasks
- Configurable in `config/config.json`
- Confirmation dialogs for destructive actions

## Installation

### Prerequisites
- Node.js 16+ 
- PM2 (optional, for PM2 monitoring)
- GitHub Actions self-hosted runner (optional)

### Setup

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure the application**
   Edit `config/config.json` to match your setup:
   - Set GitHub runner path and user
   - Set PM2 user
   - Configure quick commands
   - Set authentication token

4. **Start the server**
   ```bash
   cd backend
   npm start
   ```

5. **Access the dashboard**
   Open your browser to `http://localhost:3000`

## Configuration

### Basic Configuration

Edit `config/config.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "githubRunner": {
    "runnerPath": "/home/runner/actions-runner",
    "runnerUser": "runner"
  },
  "pm2": {
    "pm2User": "root"
  },
  "permissions": {
    "useSudo": false,
    "runAsUser": "root"
  }
}
```

### Setting Up PM2 Monitoring

**Option 1: PM2 on Same User**
If PM2 is running under the same user as the monitoring tool:
```json
{
  "pm2": {
    "pm2User": "your-username"
  },
  "permissions": {
    "useSudo": false
  }
}
```

**Option 2: PM2 on Different User (Requires Sudo)**
If PM2 is running under a different user:

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Configure sudo access (edit `/etc/sudoers` or create file in `/etc/sudoers.d/`):
   ```bash
   # Allow monitoring user to run PM2 commands
   monitoring-user ALL=(pm2-user) NOPASSWD: /usr/bin/pm2
   ```

3. Update config:
   ```json
   {
     "pm2": {
       "pm2User": "pm2-user"
     },
     "permissions": {
       "useSudo": true,
       "runAsUser": "pm2-user"
     }
   }
   ```

**Option 3: Run Monitoring Tool as Root**
```bash
sudo npm start
```

### Setting Up GitHub Actions Runner Monitoring

**Step 1: Install GitHub Actions Self-Hosted Runner**

1. Go to your GitHub repository → Settings → Actions → Runners → New self-hosted runner

2. Follow GitHub's installation instructions:
   ```bash
   # Create a folder
   mkdir actions-runner && cd actions-runner
   
   # Download the latest runner package
   curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
   
   # Extract the installer
   tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
   
   # Configure the runner
   ./config.sh --url https://github.com/YOUR_ORG/YOUR_REPO --token YOUR_TOKEN
   
   # Install and start the service
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

**Step 2: Configure Monitoring Tool**

Update `config/config.json` with your runner path:

```json
{
  "githubRunner": {
    "runnerPath": "/home/runner/actions-runner",
    "logPath": "/home/runner/actions-runner/_diag",
    "runnerUser": "runner"
  }
}
```

**Step 3: Set Permissions**

If runner is under different user:
```bash
# Add monitoring user to runner group
sudo usermod -a -G runner monitoring-user

# Or run monitoring tool as root
sudo npm start
```

**Common Runner Paths:**
- Default: `/home/runner/actions-runner`
- Custom: `/opt/actions-runner`
- User-specific: `/home/YOUR_USER/actions-runner`

### Quick Commands Configuration

Add custom commands in `config/config.json`:

```json
{
  "quickCommands": [
    {
      "name": "Restart Nginx",
      "command": "sudo systemctl restart nginx",
      "requiresConfirmation": true,
      "description": "Restarts the Nginx web server"
    },
    {
      "name": "Check Disk Space",
      "command": "df -h",
      "requiresConfirmation": false,
      "description": "Shows disk usage"
    },
    {
      "name": "PM2 Restart All",
      "command": "pm2 restart all",
      "requiresConfirmation": true,
      "description": "Restarts all PM2 processes"
    }
  ]
}
```

## Resource Usage

- **Memory**: ~10-15MB RAM
- **CPU**: <2% when idle, <3% under load
- **Disk**: ~10-50MB (historical data)

## GUI-First Design

This tool is designed to be **non-technical user friendly**:
- ✅ Visual dashboard with real-time updates
- ✅ Color-coded status indicators
- ✅ One-click actions via buttons
- ✅ No command-line knowledge required
- ✅ Responsive design for mobile/tablet

## Security

- Token-based authentication (configurable)
- Can be disabled for local-only deployments
- Runs with configurable permissions (sudo/root)

## Development

```bash
# Install dependencies
cd backend
npm install

# Start development server
npm start
```

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
