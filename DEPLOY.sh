#!/bin/bash

# ============================================================================
# ZERO-TRUST VPN DEPLOYMENT SCRIPT
# ============================================================================
# Thesis: Zero-Trust Infrastructure with WireGuard VPN + Vault + OIDC
# Author: VKU Student
# ============================================================================

set -e

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  🚀 DEPLOYING ZERO-TRUST VPN SYSTEM                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# ============================================================================
# STEP 1: ENVIRONMENT SETUP
# ============================================================================
echo -e "${BLUE}[1/7]${NC} Setting up environment..."

# Detect local IP
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "      Detected IP: $SERVER_IP"

# Create minimal .env file (not used by frontend anymore - using Nginx proxy)
cat > .env << EOF
SERVER_IP=$SERVER_IP
KC_HOSTNAME=$SERVER_IP
KC_PORT=8080
KEYCLOAK_ADDR=http://$SERVER_IP:8080
EOF

echo -e "      ${GREEN}✓${NC} Environment configured"
echo ""

# ============================================================================
# STEP 2: CLEANUP
# ============================================================================
echo -e "${BLUE}[2/7]${NC} Cleaning up previous deployment..."
docker compose down -v 2>/dev/null || true
pkill -f ngrok 2>/dev/null || true
sleep 3
echo -e "      ${GREEN}✓${NC} Cleanup complete"
echo ""

# ============================================================================
# STEP 3: BUILD & START SERVICES
# ============================================================================
echo -e "${BLUE}[3/7]${NC} Building and starting services..."
echo -e "${YELLOW}      ⏳ This may take 2-3 minutes on first run...${NC}"

docker compose up -d --build

echo -e "${YELLOW}      ⏳ Waiting for services to be healthy (30s)...${NC}"
sleep 30

echo -e "      ${GREEN}✓${NC} Services started"
echo ""

# ============================================================================
# STEP 4: INITIALIZE KEYCLOAK
# ============================================================================
echo -e "${BLUE}[4/7]${NC} Initializing Keycloak users..."
bash scripts/init-keycloak.sh 2>&1 | grep -E "Creating|Created|✓|initialized" || echo "      ${YELLOW}⚠${NC} Check Keycloak manually if needed"
echo ""

# ============================================================================
# STEP 5: INITIALIZE VAULT
# ============================================================================
echo -e "${BLUE}[5/7]${NC} Initializing Vault..."
bash scripts/init-vault.sh 2>&1 | grep -E "Initializing|✓|enabled" || echo "      ${YELLOW}⚠${NC} Check Vault manually if needed"
echo ""

# ============================================================================
# STEP 6: CHECK STATUS
# ============================================================================
echo -e "${BLUE}[6/7]${NC} Checking services status..."
echo ""
docker compose ps --format "table {{.Name}}\t{{.Status}}"
echo ""

# ============================================================================
# STEP 7: START NGROK (OPTIONAL FOR REMOTE ACCESS)
# ============================================================================
echo -e "${BLUE}[7/7]${NC} Setting up remote access (optional)..."

# Check if ngrok is available
if command -v ngrok &> /dev/null; then
    echo -e "      ${GREEN}✓${NC} Ngrok detected - starting tunnel..."
    pkill -f ngrok 2>/dev/null || true
    sleep 2
    
    # Start in background
    nohup ngrok http 3000 > /tmp/ngrok.log 2>&1 &
    sleep 8
    
    # Try to get URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    
    if [ -n "$NGROK_URL" ]; then
        echo "      🌐 Public URL: $NGROK_URL"
    else
        echo "      ${YELLOW}⚠${NC}  Ngrok started but URL not ready yet"
        echo "      Check: curl -s http://localhost:4040/api/tunnels"
    fi
else
    echo "      ${YELLOW}ℹ${NC}  Ngrok not installed - LAN access only"
    echo "      Install: https://ngrok.com/download"
    NGROK_URL=""
fi

echo ""

# ============================================================================
# DEPLOYMENT SUMMARY
# ============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✅ ZERO-TRUST VPN SYSTEM DEPLOYED                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📡 ACCESS URLS:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$NGROK_URL" ]; then
    echo "🌍 Public (Ngrok): $NGROK_URL"
    echo "🏠 LAN:            http://$SERVER_IP:3000"
else
    echo "🏠 LAN Only:       http://$SERVER_IP:3000"
fi

echo ""
echo -e "${YELLOW}🔑 TEST CREDENTIALS:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Email:    zerotrust@gmail.com"
echo "Password: password123"
echo ""
echo "Email:    admin@example.com"
echo "Password: admin123"
echo ""

echo -e "${GREEN}🎯 TESTING FLOW:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$NGROK_URL" ]; then
    echo "1. Open: $NGROK_URL"
else
    echo "1. Open: http://$SERVER_IP:3000"
fi
echo "2. Login with credentials above"
echo "3. Setup TOTP: Scan QR code with Google Authenticator"
echo "4. Enter 6-digit TOTP code"
echo "5. Dashboard: Click 'Download VPN Config'"
echo "6. Import .conf file to WireGuard"
echo "7. Connect VPN"
echo "8. Access internal resources"
echo ""

echo -e "${BLUE}📊 ARCHITECTURE:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Frontend (React + Nginx Proxy)"
echo "✅ Backend (Flask API)"
echo "✅ Keycloak (OIDC Authentication)"
echo "✅ HashiCorp Vault (Secret Management)"
echo "✅ WireGuard (VPN Server)"
echo "✅ PostgreSQL (Keycloak DB)"
echo "✅ Redis (Session Cache)"
echo ""

echo -e "${YELLOW}⚠️  IMPORTANT NOTES:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "• Frontend uses Nginx reverse proxy"
echo "• All API calls go through /api/* → backend:5000"
echo "• All Keycloak calls go through /auth/* → keycloak:8080"
echo "• Ngrok URL changes on every restart (free tier)"
if [ -n "$NGROK_URL" ]; then
    echo "• Keep terminal open to maintain Ngrok tunnel"
fi
echo "• VPN config downloaded from Vault"
echo "• Zero-Trust: No VPN = No access to internal resources"
echo ""

echo -e "${GREEN}✅ System ready! Start testing the complete flow.${NC}"
echo ""

# Save deployment info
cat > DEPLOYMENT-INFO.txt << EOF
Deployment Time: $(date)
Server IP: $SERVER_IP
LAN URL: http://$SERVER_IP:3000
$([ -n "$NGROK_URL" ] && echo "Public URL: $NGROK_URL" || echo "Public URL: Run 'ngrok http 3000' for remote access")

Test Credentials:
- zerotrust@gmail.com / password123
- admin@example.com / admin123

Services:
- Frontend: 3000 (Nginx + React)
- Backend: 5000 (Flask)
- Keycloak: 8080 (OIDC)
- Vault: 8200 (Secrets)
- WireGuard: 51820 (VPN)
- PostgreSQL: 5432
- Redis: 6379

Architecture:
Nginx Proxy Pattern
├─ /api/* → backend:5000
└─ /auth/* → keycloak:8080
EOF

echo "💾 Deployment info saved to DEPLOYMENT-INFO.txt"
echo ""
