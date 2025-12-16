#!/bin/bash

###############################################################################
# Test authentication flow
###############################################################################

echo "=========================================="
echo "Testing Zero-Trust VPN Authentication"
echo "=========================================="

API_URL="http://localhost:5000"

# Test 1: Health check
echo ""
echo "1️⃣ Testing API health..."
HEALTH=$(curl -s "$API_URL/api/health")
echo "$HEALTH" | jq '.'

if echo "$HEALTH" | jq -e '.status == "healthy"' > /dev/null; then
    echo "✓ API is healthy"
else
    echo "❌ API is not healthy"
    exit 1
fi

# Test 2: Login
echo ""
echo "2️⃣ Testing login (john@company.com)..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"john@company.com","password":"password123"}')

echo "$LOGIN_RESPONSE" | jq '.'

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
    echo "✓ Login successful"
    echo "Token: ${ACCESS_TOKEN:0:20}..."
else
    echo "❌ Login failed"
    exit 1
fi

# Test 3: Get profile
echo ""
echo "3️⃣ Testing user profile..."
PROFILE=$(curl -s -X GET "$API_URL/api/user/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$PROFILE" | jq '.'

USERNAME=$(echo "$PROFILE" | jq -r '.username')
if [ "$USERNAME" != "null" ]; then
    echo "✓ Profile retrieved: $USERNAME"
else
    echo "❌ Failed to get profile"
fi

# Test 4: Setup TOTP
echo ""
echo "4️⃣ Testing TOTP setup..."
TOTP_SETUP=$(curl -s -X POST "$API_URL/api/auth/totp/setup" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

SECRET=$(echo "$TOTP_SETUP" | jq -r '.secret')
if [ "$SECRET" != "null" ] && [ -n "$SECRET" ]; then
    echo "✓ TOTP setup successful"
    echo "Secret: $SECRET"
    echo ""
    echo "📱 Scan this QR code with Google Authenticator:"
    echo "   Or manually enter the secret above"
else
    echo "❌ TOTP setup failed"
fi

# Test 5: Get permissions
echo ""
echo "5️⃣ Testing user permissions..."
PERMISSIONS=$(curl -s -X GET "$API_URL/api/user/permissions" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$PERMISSIONS" | jq '.'
echo "✓ Permissions retrieved"

echo ""
echo "=========================================="
echo "✅ Authentication flow test completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Open your authenticator app and scan the QR code"
echo "2. Get the 6-digit code"
echo "3. Verify TOTP to complete MFA setup"
echo "4. Access dashboard to get WireGuard config"
echo ""
