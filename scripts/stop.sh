#!/bin/bash

###############################################################################
# Stop all Zero-Trust VPN services
###############################################################################

set -e

echo "=========================================="
echo "Stopping Zero-Trust VPN Services"
echo "=========================================="

if [[ ! -f docker-compose.yml ]]; then
    echo "❌ docker-compose.yml not found. Run from project root."
    exit 1
fi

echo ""
echo "🛑 Stopping services..."
docker compose down

echo ""
echo "✅ All services stopped"
echo ""
echo "To remove volumes (⚠️ WARNING: This will delete all data):"
echo "docker compose down -v"
echo ""
