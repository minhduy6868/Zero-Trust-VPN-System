#!/bin/bash

###############################################################################
# Initialize Keycloak with realm, users, and client
###############################################################################

set -e

echo "=========================================="
echo "Initializing Keycloak"
echo "=========================================="

KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
REALM="company"

# Get server IP from .env if exists
if [[ -f .env ]]; then
    SERVER_IP=$(grep "^SERVER_IP=" .env | cut -d '=' -f2)
fi

# Fallback to localhost if not set
SERVER_IP=${SERVER_IP:-localhost}

echo "🌐 Server IP: $SERVER_IP"
echo ""

# Wait for Keycloak to be ready
echo ""
echo "⏳ Waiting for Keycloak to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf "$KEYCLOAK_URL/realms/master" > /dev/null 2>&1; then
        echo "✓ Keycloak is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Keycloak did not become ready in time"
    exit 1
fi

# Get admin token
echo ""
echo "🔑 Getting admin access token..."
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Failed to get admin token"
    exit 1
fi

echo "✓ Got admin token"

# Create realm
echo ""
echo "🌍 Creating realm: $REALM..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"realm\": \"$REALM\",
    \"enabled\": true,
    \"displayName\": \"Company VPN\",
    \"registrationAllowed\": false,
    \"loginWithEmailAllowed\": true,
    \"duplicateEmailsAllowed\": false,
    \"resetPasswordAllowed\": true,
    \"editUsernameAllowed\": false,
    \"bruteForceProtected\": true,
    \"accessTokenLifespan\": 28800
  }" > /dev/null 2>&1

echo "✓ Realm created"

# Create client
echo ""
echo "📱 Creating OIDC client..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"vpn-client\",
    \"enabled\": true,
    \"publicClient\": true,
    \"protocol\": \"openid-connect\",
    \"directAccessGrantsEnabled\": true,
    \"serviceAccountsEnabled\": false,
    \"authorizationServicesEnabled\": false,
    \"standardFlowEnabled\": true,
    \"implicitFlowEnabled\": false,
    \"redirectUris\": [
      \"http://localhost:3000/*\", 
      \"http://localhost:5000/*\",
      \"http://$SERVER_IP:3000/*\", 
      \"http://$SERVER_IP:5000/*\",
      \"https://*.ngrok-free.app/*\"
    ],
    \"webOrigins\": [
      \"http://localhost:3000\", 
      \"http://localhost:5000\",
      \"http://$SERVER_IP:3000\", 
      \"http://$SERVER_IP:5000\",
      \"https://*.ngrok-free.app\"
    ],
    \"attributes\": {
      \"access.token.lifespan\": \"28800\"
    }
  }" > /dev/null 2>&1

echo "✓ Client created"

# Create users
echo ""
echo "👥 Creating test users..."

# User 1: duy1 (Employee)
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "duy1",
    "email": "duy1@gmail.com",
    "firstName": "Nguyen Van",
    "lastName": "Duy",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "password123",
      "temporary": false
    }],
    "attributes": {
      "role": ["employee"],
      "position": ["Software Developer"],
      "department": ["Engineering"]
    }
  }' > /dev/null 2>&1

echo "✓ User created: duy1@gmail.com (Employee)"

# User 2: tham1 (Manager)
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tham1",
    "email": "tham1@gmail.com",
    "firstName": "Le Thi",
    "lastName": "Tham",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "password123",
      "temporary": false
    }],
    "attributes": {
      "role": ["manager"],
      "position": ["Finance Manager"],
      "department": ["Finance"]
    }
  }' > /dev/null 2>&1

echo "✓ User created: tham1@gmail.com (Manager)"

# User 3: zerotrust (Admin)
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "zerotrust",
    "email": "zerotrust@gmail.com",
    "firstName": "Admin",
    "lastName": "User",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "password123",
      "temporary": false
    }],
    "attributes": {
      "role": ["admin"],
      "position": ["CTO"],
      "department": ["IT"]
    }
  }' > /dev/null 2>&1

echo "✓ User created: zerotrust@gmail.com (Admin)"

echo ""
echo "=========================================="
echo "✅ Keycloak initialization completed!"
echo "=========================================="
echo ""
echo "Keycloak Admin Console: $KEYCLOAK_URL"
echo "Username: $ADMIN_USER"
echo "Password: $ADMIN_PASS"
echo ""
echo "Realm: $REALM"
echo "Client ID: vpn-client"
echo ""
echo "Test Users (all password: password123):"
echo "1. duy1@gmail.com      - Employee (Software Developer)"
echo "2. tham1@gmail.com     - Manager (Finance Manager)"
echo "3. zerotrust@gmail.com - Admin (CTO)"
echo ""
