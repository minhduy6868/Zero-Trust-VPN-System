#!/bin/bash

###############################################################################
# Complete deployment and test script
###############################################################################

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     ZERO-TRUST VPN - FULL DEPLOYMENT & TEST SCRIPT      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Step 1: Setup
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Setup Ubuntu environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/setup.sh

# Step 2: Start services
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Start Docker services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/start.sh

echo ""
echo "⏳ Waiting for services to be fully ready (60 seconds)..."
sleep 60

# Step 3: Initialize Vault
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Initialize Vault"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/init-vault.sh

# Step 4: Initialize Keycloak
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Initialize Keycloak"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/init-keycloak.sh

# Step 5: Check status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 5: Check services status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/status.sh

# Step 6: Test authentication
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 6: Test authentication flow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/test-login.sh

# Done
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✅ DEPLOYMENT COMPLETED!                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Web UI:         http://localhost:3000"
echo "🔑 Backend API:    http://localhost:5000"
echo "👤 Keycloak:       http://localhost:8080 (admin/admin123)"
echo "🔐 Vault:          http://localhost:8200 (token: myroot)"
echo ""
echo "📱 Test Accounts:"
echo "   john@company.com   / password123"
echo "   alice@company.com  / password123"
echo "   bob@company.com    / password123"
echo ""
echo "📖 Next steps:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Login with one of the test accounts"
echo "   3. Setup TOTP with Google Authenticator"
echo "   4. Download WireGuard config"
echo "   5. Connect and test!"
echo ""
echo "📚 Documentation: See QUICKSTART.md for detailed guide"
echo ""
