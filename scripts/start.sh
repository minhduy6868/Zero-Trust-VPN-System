#!/bin/bash

###############################################################################
# Start all Zero-Trust VPN services
###############################################################################

set -e

echo "=========================================="
echo "Starting Zero-Trust VPN Services"
echo "=========================================="

# Check if docker-compose.yml exists
if [[ ! -f docker-compose.yml ]]; then
    echo "❌ docker-compose.yml not found. Run from project root."
    exit 1
fi

# Pull latest images
echo ""
echo "📥 Pulling Docker images..."
docker compose pull

# Build custom images
echo ""
echo "🔨 Building custom images..."
docker compose build

# Start services
echo ""
echo "🚀 Starting services..."
docker compose up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to start..."
echo "This may take 2-3 minutes..."

sleep 10

# Check service health
echo ""
echo "🏥 Checking service health..."

SERVICES=("postgres" "redis" "vault" "keycloak" "backend" "frontend" "wireguard")
for SERVICE in "${SERVICES[@]}"; do
    if docker compose ps | grep -q "${SERVICE}.*Up"; then
        echo "✓ $SERVICE is running"
    else
        echo "❌ $SERVICE failed to start"
        docker compose logs $SERVICE | tail -n 20
    fi
done

echo ""
echo "=========================================="
echo "✅ Services started successfully!"
echo "=========================================="
echo ""
echo "Service URLs:"
echo "- Frontend:        http://localhost:3000"
echo "- Backend API:     http://localhost:5000"
echo "- Keycloak Admin:  http://localhost:8080 (admin/admin123)"
echo "- Vault UI:        http://localhost:8200 (token: myroot)"
echo "- WireGuard Port:  UDP 51820"
echo ""
echo "Next steps:"
echo "1. Initialize Vault:    sudo ./scripts/init-vault.sh"
echo "2. Setup Keycloak:      sudo ./scripts/init-keycloak.sh"
echo "3. Check status:        sudo ./scripts/status.sh"
echo "4. View logs:           docker compose logs -f"
echo ""
