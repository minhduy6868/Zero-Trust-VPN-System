#!/bin/bash
# ============================================================================
# CHECK NGROK STATUS AND RESTART IF NEEDED
# ============================================================================

echo ""
echo "🔍 Checking Ngrok status..."
echo ""

# Check if ngrok is running
if ! pgrep -f "ngrok http" > /dev/null; then
    echo "❌ Ngrok is NOT running!"
    echo ""
    read -p "Start Ngrok now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🌐 Starting Ngrok..."
        pkill -f ngrok 2>/dev/null || true
        sleep 2
        nohup ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
        sleep 5
    else
        exit 0
    fi
fi

# Get Ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$NGROK_URL" ]; then
    echo "✅ Ngrok is running!"
    echo ""
    echo "🔗 PUBLIC URL:"
    echo "   $NGROK_URL"
    echo ""
    echo "🔍 Dashboard:"
    echo "   http://localhost:4040"
    echo ""
    
    # Test if URL is accessible
    echo "🧪 Testing URL accessibility..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$NGROK_URL" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ URL is accessible (HTTP $HTTP_CODE)"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo "   ❌ Cannot reach URL (Network error)"
    else
        echo "   ⚠️  URL returned HTTP $HTTP_CODE"
    fi
    echo ""
    
    # Show connection stats
    CONNECTIONS=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"count":[0-9]*' | head -1 | cut -d':' -f2)
    if [ -n "$CONNECTIONS" ]; then
        echo "📊 Total connections: $CONNECTIONS"
    fi
else
    echo "❌ Failed to get Ngrok URL!"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   1. Check if ngrok is authenticated:"
    echo "      ngrok config check"
    echo ""
    echo "   2. View ngrok logs:"
    echo "      tail -f /tmp/ngrok.log"
    echo ""
    echo "   3. Check dashboard:"
    echo "      http://localhost:4040"
    echo ""
    echo "   4. Restart ngrok:"
    echo "      pkill -f ngrok && bash START-REMOTE.sh"
fi

echo ""
