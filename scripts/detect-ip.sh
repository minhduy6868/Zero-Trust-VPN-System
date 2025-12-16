#!/bin/bash

###############################################################################
# Detect server IP address for remote access configuration
###############################################################################

echo "🔍 Detecting server IP addresses..."
echo ""

# Get primary IP address
PRIMARY_IP=$(hostname -I | awk '{print $1}')

# Get all network interfaces
echo "📡 Available network interfaces:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | while read ip; do
    if [[ $ip != "127.0.0.1" ]]; then
        interface=$(ip addr | grep "$ip" | awk '{print $NF}')
        echo "✓ $interface: $ip"
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Primary IP: $PRIMARY_IP"
echo ""
echo "📋 Use this IP for remote access:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Frontend:       http://$PRIMARY_IP:3000"
echo "Backend API:    http://$PRIMARY_IP:5000"
echo "Keycloak:       http://$PRIMARY_IP:8080"
echo "Vault:          http://$PRIMARY_IP:8200"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚙️  To configure remote access:"
echo "1. Edit .env file:"
echo "   SERVER_IP=$PRIMARY_IP"
echo ""
echo "2. Restart services:"
echo "   sudo docker compose down"
echo "   sudo docker compose up -d"
echo ""
echo "3. Update firewall (if needed):"
echo "   sudo ufw allow 3000/tcp  # Frontend"
echo "   sudo ufw allow 5000/tcp  # Backend"
echo "   sudo ufw allow 8080/tcp  # Keycloak"
echo "   sudo ufw allow 8200/tcp  # Vault"
echo "   sudo ufw allow 51820/udp # WireGuard"
echo ""

# Save to file
echo "SERVER_IP=$PRIMARY_IP" > .env.detected
echo "✓ IP saved to .env.detected"
