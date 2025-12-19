#!/bin/bash
# ============================================================================
# START REMOTE MODE - With Ngrok for public access
# ============================================================================
set -e

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║      🌐 STARTING REMOTE MODE (WITH NGROK)           ║"
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

# Start Ngrok
echo "🌐 Starting Ngrok tunnel..."
pkill -f ngrok 2>/dev/null || true
sleep 2

if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok not installed!"
    echo "   Install: https://ngrok.com/download"
    echo ""
    echo "Falling back to local mode..."
    echo "📱 ACCESS: http://$SERVER_IP:3000"
    exit 1
fi

nohup ngrok http 3000 > /tmp/ngrok.log 2>&1 &
sleep 8

NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

# Show status
echo ""
echo "✅ Services running:"
docker compose ps --format "  ✓ {{.Name}}"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║      ✅ REMOTE MODE READY!                          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

if [ -n "$NGROK_URL" ]; then
    echo "🌍 PUBLIC ACCESS:"
    echo "   $NGROK_URL"
    echo ""
    echo "🏠 LAN ACCESS:"
    echo "   http://$SERVER_IP:3000"
else
    echo "⚠️  Ngrok tunnel not ready yet"
    echo "   Check: http://localhost:4040"
    echo ""
    echo "🏠 LAN ACCESS:"
    echo "   http://$SERVER_IP:3000"
fi

echo ""
echo "🔐 LOGIN:"
echo "   Email:    zerotrust@gmail.com"
echo "   Password: password123"
echo ""
echo "💡 Keep this terminal open to maintain Ngrok tunnel!"
echo ""
