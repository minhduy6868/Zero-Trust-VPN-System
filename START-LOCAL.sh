#!/bin/bash
# ============================================================================
# START LOCAL MODE - For LAN access only
# ============================================================================
set -e

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║      🏠 STARTING LOCAL MODE (LAN ONLY)              ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Detect IP
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "📍 Server IP: $SERVER_IP"
echo ""

# Start services
echo "🚀 Starting services..."
docker compose up -d

# Wait for services
echo "⏳ Waiting for services (20s)..."
sleep 20

# Show status
echo ""
echo "✅ Services running:"
docker compose ps --format "  ✓ {{.Name}}"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║      ✅ LOCAL MODE READY!                           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "📱 ACCESS:"
echo "   http://$SERVER_IP:3000"
echo ""
echo "🔐 LOGIN:"
echo "   Email:    zerotrust@gmail.com"
echo "   Password: password123"
echo ""
echo "💡 Access from any device on same WiFi network!"
echo ""
