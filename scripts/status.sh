#!/bin/bash

###############################################################################
# Check status of all services
###############################################################################

echo "=========================================="
echo "Zero-Trust VPN Services Status"
echo "=========================================="

if [[ ! -f docker-compose.yml ]]; then
    echo "❌ docker-compose.yml not found. Run from project root."
    exit 1
fi

echo ""
docker compose ps

echo ""
echo "=========================================="
echo "Resource Usage"
echo "=========================================="
echo ""
docker stats --no-stream

echo ""
echo "=========================================="
echo "Service URLs"
echo "=========================================="
echo "- Frontend:        http://localhost:3000"
echo "- Backend API:     http://localhost:5000/api/health"
echo "- Keycloak:        http://localhost:8080"
echo "- Vault:           http://localhost:8200"
echo ""
