#!/bin/bash
set -e

echo "==> Updating packages..."
apt-get update && apt-get upgrade -y || true

echo "==> Installing dependencies..."
apt-get install -y curl nodejs npm || true

echo "==> Creating todo user..."
useradd -r -s /bin/false todo || true

echo "==> Setting up app directory..."
mkdir -p /opt/todo-app/public /opt/todo-app/data

echo "==> Copying app files..."
cp server.js /opt/todo-app/
cp public/index.html /opt/todo-app/public/
cp package.json /opt/todo-app/

echo "==> Installing Node dependencies..."
cd /opt/todo-app && npm install --production

echo "==> Setting permissions..."
chown -R todo:todo /opt/todo-app

echo "==> Installing systemd service..."
cp todo-app.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable todo-app
systemctl start todo-app

echo ""
echo "✅ Done! Todo app is running."
echo "   Access it at: http://$(hostname -I | awk '{print $1}'):3000"
