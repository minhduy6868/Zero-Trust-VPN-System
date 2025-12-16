#!/bin/bash

###############################################################################
# Setup Script for Zero-Trust VPN Infrastructure on Ubuntu
# Cài đặt dependencies và setup môi trường
###############################################################################

set -e

echo "=========================================="
echo "Zero-Trust VPN Infrastructure Setup"
echo "=========================================="

# Check if running on Ubuntu
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release; then
    echo "❌ This script is designed for Ubuntu. Exiting."
    exit 1
fi

echo ""
echo "✓ Detected Ubuntu system"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

echo "✓ Running with root privileges"

# Update system
echo ""
echo "📦 Updating system packages..."
apt-get update -qq

# Install Docker
echo ""
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Set up repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    echo "✓ Docker installed successfully"
else
    echo "✓ Docker already installed"
fi

# Install Docker Compose
echo ""
echo "🐳 Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose plugin not found. Please install Docker Compose v2."
    exit 1
else
    echo "✓ Docker Compose installed: $(docker compose version)"
fi

# Install WireGuard tools (for client testing)
echo ""
echo "🔐 Installing WireGuard tools..."
apt-get install -y wireguard wireguard-tools
echo "✓ WireGuard tools installed"

# Install other useful tools
echo ""
echo "🛠️  Installing additional tools..."
apt-get install -y \
    curl \
    wget \
    jq \
    git \
    vim \
    net-tools \
    iputils-ping \
    qrencode

echo "✓ Additional tools installed"

# Enable IP forwarding (required for VPN)
echo ""
echo "🌐 Enabling IP forwarding..."
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
sysctl -p > /dev/null
echo "✓ IP forwarding enabled"

# Create project directories
echo ""
echo "📁 Creating project directories..."
mkdir -p servers/{backend,frontend,vault/{config,policies},keycloak,wireguard}
mkdir -p scripts
mkdir -p mock-data
mkdir -p logs

echo "✓ Project directories created"

# Set permissions
echo ""
echo "🔑 Setting permissions..."
chmod +x scripts/*.sh 2>/dev/null || true
chown -R $SUDO_USER:$SUDO_USER . 2>/dev/null || true

echo "✓ Permissions set"

# Check if ports are available
echo ""
echo "🔍 Checking required ports..."
REQUIRED_PORTS=(8080 8200 5000 3000 51820)
for PORT in "${REQUIRED_PORTS[@]}"; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Warning: Port $PORT is already in use"
    else
        echo "✓ Port $PORT is available"
    fi
done

# Add current user to docker group
echo ""
echo "👥 Adding user to docker group..."
if [[ -n "$SUDO_USER" ]]; then
    usermod -aG docker $SUDO_USER
    echo "✓ User $SUDO_USER added to docker group"
    echo "⚠️  You may need to log out and back in for group changes to take effect"
fi

echo ""
echo "=========================================="
echo "✅ Setup completed successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Run: sudo ./scripts/start.sh"
echo "2. Wait for services to start (2-3 minutes)"
echo "3. Run: sudo ./scripts/init-vault.sh"
echo "4. Run: sudo ./scripts/init-keycloak.sh"
echo "5. Access: http://localhost:3000"
echo ""
echo "For more info, see README.md"
echo ""
