#!/bin/bash

###############################################################################
# Initialize HashiCorp Vault with policies and secrets
###############################################################################

set -e

echo "=========================================="
echo "Initializing HashiCorp Vault"
echo "=========================================="

VAULT_ADDR="http://localhost:8200"
VAULT_TOKEN="myroot"

export VAULT_ADDR
export VAULT_TOKEN

# Check if Vault is accessible
echo ""
echo "🔍 Checking Vault connection..."
if ! curl -s "$VAULT_ADDR/v1/sys/health" > /dev/null; then
    echo "❌ Cannot connect to Vault at $VAULT_ADDR"
    echo "Make sure Vault is running: docker compose ps vault"
    exit 1
fi
echo "✓ Vault is accessible"

# Enable KV secrets engine v2
echo ""
echo "🔐 Enabling KV secrets engine..."
vault secrets enable -path=secret -version=2 kv 2>/dev/null || echo "✓ KV engine already enabled"

# Enable JWT auth method
echo ""
echo "🔑 Enabling JWT auth method..."
vault auth enable jwt 2>/dev/null || echo "✓ JWT auth already enabled"

# Configure JWT auth with Keycloak
echo ""
echo "⚙️  Configuring JWT auth..."
vault write auth/jwt/config \
    oidc_discovery_url="http://keycloak:8080/realms/company" \
    default_role="employee" \
    bound_issuer="http://localhost:8080/realms/company"

echo "✓ JWT auth configured"

# Create employee policy
echo ""
echo "📋 Creating Vault policies..."
vault policy write employee - <<EOF
# Allow reading WireGuard configs
path "secret/data/wireguard/*" {
  capabilities = ["read"]
}

# Allow reading database credentials
path "secret/data/database/*" {
  capabilities = ["read"]
}

# Allow reading SSH keys
path "secret/data/ssh/*" {
  capabilities = ["read"]
}

# Allow reading permissions
path "secret/data/permissions/*" {
  capabilities = ["read"]
}
EOF

echo "✓ Employee policy created"

# Create admin policy
vault policy write admin - <<EOF
# Full access to secrets
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Manage policies
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Manage auth methods
path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
EOF

echo "✓ Admin policy created"

# Create JWT role for employees
echo ""
echo "👥 Creating JWT roles..."
vault write auth/jwt/role/employee \
    role_type="jwt" \
    bound_audiences="vpn-client" \
    user_claim="sub" \
    policies="employee" \
    ttl="8h"

echo "✓ Employee role created"

# Create sample WireGuard configs
echo ""
echo "🔐 Creating sample WireGuard secrets..."

# Generate WireGuard keys
WG_SERVER_PRIVATE=$(wg genkey)
WG_SERVER_PUBLIC=$(echo "$WG_SERVER_PRIVATE" | wg pubkey)

# User 1: john
WG_JOHN_PRIVATE=$(wg genkey)
WG_JOHN_PUBLIC=$(echo "$WG_JOHN_PRIVATE" | wg pubkey)

vault kv put secret/wireguard/john \
    private_key="$WG_JOHN_PRIVATE" \
    public_key="$WG_JOHN_PUBLIC" \
    address="10.0.0.100/32" \
    server_public_key="$WG_SERVER_PUBLIC" \
    endpoint="localhost:51820" \
    dns="1.1.1.1"

echo "✓ john@company.com WireGuard config created"

# User 2: alice
WG_ALICE_PRIVATE=$(wg genkey)
WG_ALICE_PUBLIC=$(echo "$WG_ALICE_PRIVATE" | wg pubkey)

vault kv put secret/wireguard/alice \
    private_key="$WG_ALICE_PRIVATE" \
    public_key="$WG_ALICE_PUBLIC" \
    address="10.0.0.101/32" \
    server_public_key="$WG_SERVER_PUBLIC" \
    endpoint="localhost:51820" \
    dns="1.1.1.1"

echo "✓ alice@company.com WireGuard config created"

# User 3: bob
WG_BOB_PRIVATE=$(wg genkey)
WG_BOB_PUBLIC=$(echo "$WG_BOB_PRIVATE" | wg pubkey)

vault kv put secret/wireguard/bob \
    private_key="$WG_BOB_PRIVATE" \
    public_key="$WG_BOB_PUBLIC" \
    address="10.0.0.102/32" \
    server_public_key="$WG_SERVER_PUBLIC" \
    endpoint="localhost:51820" \
    dns="1.1.1.1"

echo "✓ bob@company.com WireGuard config created"

# Create permissions
echo ""
echo "🔒 Creating user permissions..."

vault kv put secret/permissions/john \
    databases='["customer_db"]' \
    servers='["web-server-1"]' \
    apis='["customer-api"]'

vault kv put secret/permissions/alice \
    databases='["customer_db", "finance_db"]' \
    servers='["web-server-1", "web-server-2", "finance-server"]' \
    apis='["customer-api", "finance-api"]'

vault kv put secret/permissions/bob \
    databases='["customer_db", "finance_db", "hr_db"]' \
    servers='["*"]' \
    apis='["*"]'

echo "✓ User permissions created"

# Save server keys to file for WireGuard setup
echo ""
echo "💾 Saving WireGuard server keys..."
mkdir -p /tmp/wireguard-keys
echo "$WG_SERVER_PRIVATE" > /tmp/wireguard-keys/server_private.key
echo "$WG_SERVER_PUBLIC" > /tmp/wireguard-keys/server_public.key
chmod 600 /tmp/wireguard-keys/server_private.key

echo ""
echo "=========================================="
echo "✅ Vault initialization completed!"
echo "=========================================="
echo ""
echo "Server Keys:"
echo "- Private: $WG_SERVER_PRIVATE"
echo "- Public:  $WG_SERVER_PUBLIC"
echo ""
echo "Sample Users:"
echo "1. john@company.com   - IP: 10.0.0.100 (Employee)"
echo "2. alice@company.com  - IP: 10.0.0.101 (Financial Officer)"
echo "3. bob@company.com    - IP: 10.0.0.102 (DBA/Admin)"
echo ""
echo "Test Vault access:"
echo "  vault kv get secret/wireguard/john"
echo ""
