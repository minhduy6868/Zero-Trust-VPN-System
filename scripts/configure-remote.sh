#!/bin/bash

###############################################################################
# Configure Zero-Trust VPN for Remote Access
# Detects server IP and updates configuration
###############################################################################

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     CONFIGURE REMOTE ACCESS - ZERO-TRUST VPN            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Detect server IP
echo "🔍 Step 1: Detecting server IP address..."
PRIMARY_IP=$(hostname -I | awk '{print $1}')

if [[ -z "$PRIMARY_IP" ]]; then
    echo "❌ Cannot detect server IP address"
    exit 1
fi

echo "✓ Detected IP: $PRIMARY_IP"
echo ""

# Ask user to confirm or enter custom IP
read -p "Use this IP? (Y/n) or enter custom IP: " -r response

if [[ $response =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    SERVER_IP=$response
    echo "✓ Using custom IP: $SERVER_IP"
elif [[ $response =~ ^[Nn]$ ]]; then
    read -p "Enter server IP address: " SERVER_IP
    echo "✓ Using IP: $SERVER_IP"
else
    SERVER_IP=$PRIMARY_IP
    echo "✓ Using detected IP: $SERVER_IP"
fi

echo ""

# Create .env file
echo "📝 Step 2: Creating .env configuration..."

cat > .env << EOF
# Zero-Trust VPN Remote Access Configuration
# Generated: $(date)

# Server IP Address
SERVER_IP=$SERVER_IP

# Service Ports
FRONTEND_PORT=3000
BACKEND_PORT=5000
KEYCLOAK_PORT=8080
VAULT_PORT=8200
WIREGUARD_PORT=51820

# Keycloak Configuration
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin123
KEYCLOAK_REALM=company
KEYCLOAK_CLIENT_ID=vpn-client
KEYCLOAK_CLIENT_SECRET=change-me-in-production

# Vault Configuration
VAULT_TOKEN=myroot

# Database
POSTGRES_DB=keycloak
POSTGRES_USER=keycloak
POSTGRES_PASSWORD=keycloak123

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
EOF

echo "✓ Configuration saved to .env"
echo ""

# Update Keycloak redirect URIs
echo "📝 Step 3: Updating Keycloak configuration..."
echo "   (This will be done after Keycloak starts)"
echo ""

# Check firewall status
echo "🔥 Step 4: Checking firewall..."

if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status | head -1)
    echo "   Firewall status: $UFW_STATUS"
    
    if [[ $UFW_STATUS == *"active"* ]]; then
        echo ""
        echo "   ⚠️  Firewall is active. Open required ports? (Y/n)"
        read -r open_ports
        
        if [[ ! $open_ports =~ ^[Nn]$ ]]; then
            echo "   Opening ports..."
            sudo ufw allow 3000/tcp comment "Zero-Trust Frontend"
            sudo ufw allow 5000/tcp comment "Zero-Trust Backend"
            sudo ufw allow 8080/tcp comment "Zero-Trust Keycloak"
            sudo ufw allow 8200/tcp comment "Zero-Trust Vault"
            sudo ufw allow 51820/udp comment "Zero-Trust WireGuard"
            sudo ufw reload
            echo "   ✓ Firewall ports opened"
        fi
    fi
else
    echo "   ℹ️  ufw not installed, skipping firewall configuration"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✅ CONFIGURATION COMPLETED!                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Remote Access URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Frontend:       http://$SERVER_IP:3000"
echo "Backend API:    http://$SERVER_IP:5000"
echo "Keycloak Admin: http://$SERVER_IP:8080 (admin/admin123)"
echo "Vault UI:       http://$SERVER_IP:8200 (token: myroot)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Client Access:"
echo "   From any computer on the network:"
echo "   1. Open browser: http://$SERVER_IP:3000"
echo "   2. Login: john@company.com / password123"
echo "   3. Setup TOTP and access VPN"
echo ""
echo "🚀 Next Steps:"
echo "   1. Stop current services: sudo docker compose down"
echo "   2. Start with new config: sudo docker compose up -d"
echo "   3. Initialize services:"
echo "      sudo ./scripts/init-vault.sh"
echo "      sudo ./scripts/init-keycloak.sh"
echo ""
echo "   Or run all at once:"
echo "   sudo ./deploy.sh"
echo ""
