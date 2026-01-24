#!/bin/bash

# ArgonWatchGo Linux Uninstall Script

set -e

echo "==================================="
echo "ArgonWatchGo Uninstall Script"
echo "==================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

echo "Stopping service..."
systemctl stop argon-watch-go || true
systemctl disable argon-watch-go || true

echo "Removing service file..."
rm -f /etc/systemd/system/argon-watch-go.service
systemctl daemon-reload

echo "Removing binary..."
rm -f /usr/local/bin/argon-watch-go

echo "Removing configuration..."
rm -rf /etc/argon-watch-go

# Optional: Remove data
read -p "Do you want to remove all data files? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing data directory..."
    rm -rf /var/lib/argon-watch-go
fi

echo ""
echo "==================================="
echo "Uninstallation Complete!"
echo "==================================="
