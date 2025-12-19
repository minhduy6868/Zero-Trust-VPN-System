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

# Start ngrok in background
nohup ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
echo "   Ngrok PID: $NGROK_PID"
sleep 5

# Try to get ngrok URL with retries
NGROK_URL=""
for i in {1..5}; do
    echo "   Attempt $i/5 to get Ngrok URL..."
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)
    if [ -n "$NGROK_URL" ]; then
        break
    fi
    sleep 2
done

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
    echo "🌍 PUBLIC ACCESS (Share this link):"
    echo ""
    echo "   🔗 $NGROK_URL"
    echo ""
    echo "   ⚠️  First-time visitors will see Ngrok warning page"
    echo "       Click 'Visit Site' to continue"
    echo ""
    echo "🏠 LAN ACCESS (Local network only):"
    echo "   http://$SERVER_IP:3000"
    echo ""
    echo "🔍 Ngrok Dashboard (Monitor traffic):"
    echo "   http://localhost:4040"
else
    echo "⚠️  Ngrok tunnel failed to start!"
    echo "   Check logs: tail -f /tmp/ngrok.log"
    echo "   Or check: http://localhost:4040"
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
echo "   To stop: Ctrl+C or run: pkill -f ngrok"
echo ""
echo "📝 Note: Ngrok free URLs expire after ~2 hours of inactivity"
echo "         Restart script to get a new URL if needed"
echo ""
