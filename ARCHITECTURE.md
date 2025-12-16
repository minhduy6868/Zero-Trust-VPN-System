# KIẾN TRÚC HỆ THỐNG ZERO-TRUST VPN

## Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                              │
│  ┌──────────┐         ┌────────────────┐                       │
│  │ Browser  │────────▶│  React Web UI  │                       │
│  │          │         │  (Port 3000)   │                       │
│  └──────────┘         └────────────────┘                       │
│       │                       │                                 │
│       │                       ▼                                 │
│       │              ┌────────────────┐                        │
│       │              │ WireGuard CLI  │                        │
│       │              │   (Local)      │                        │
│       │              └────────────────┘                        │
└───────┼─────────────────────┼──────────────────────────────────┘
        │                     │
        │ HTTPS               │ UDP (Encrypted)
        │                     │
┌───────┼─────────────────────┼──────────────────────────────────┐
│       │      SERVER SIDE    │                                  │
│       ▼                     ▼                                  │
│  ┌─────────────┐      ┌─────────────┐                        │
│  │   Backend   │      │  WireGuard  │                        │
│  │   (Flask)   │      │   Server    │                        │
│  │  Port 5000  │      │  Port 51820 │                        │
│  └─────────────┘      └─────────────┘                        │
│       │                                                        │
│       ├────────────┬────────────┬────────────┐               │
│       ▼            ▼            ▼            ▼               │
│  ┌─────────┐  ┌─────────┐  ┌────────┐  ┌────────┐          │
│  │Keycloak │  │  Vault  │  │ Redis  │  │Postgres│          │
│  │Port 8080│  │Port 8200│  │Port6379│  │Port5432│          │
│  └─────────┘  └─────────┘  └────────┘  └────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Chi Tiết Các Thành Phần

### 1. Frontend (React)
**Port:** 3000  
**Mục đích:** Web UI cho users  
**Chức năng:**
- Login form (username/password)
- TOTP setup (QR code)
- TOTP verification
- Dashboard
- WireGuard config download

**Files:**
- `src/App.js` - Router chính
- `src/pages/Login.js` - Trang đăng nhập
- `src/pages/TOTPSetup.js` - Setup MFA
- `src/pages/TOTPVerify.js` - Verify MFA
- `src/pages/Dashboard.js` - Dashboard sau login
- `src/services/api.js` - API client

---

### 2. Backend (Python Flask)
**Port:** 5000  
**Mục đích:** API server xử lý logic  
**Chức năng:**
- Authentication với Keycloak
- TOTP setup & verification
- Vault integration
- WireGuard config generation
- Permission management
- Audit logging

**API Endpoints:**
```
POST /api/auth/login          - Login với username/password
POST /api/auth/totp/setup     - Setup TOTP (generate QR)
POST /api/auth/totp/verify    - Verify TOTP code
POST /api/wireguard/config    - Get WireGuard config
GET  /api/user/profile        - Get user info
GET  /api/user/permissions    - Get user permissions
GET  /api/health              - Health check
GET  /api/admin/logs          - Get audit logs
```

**Dependencies:**
- Flask - Web framework
- hvac - Vault client
- pyotp - TOTP generator
- requests - HTTP client
- redis - Cache client
- psycopg2 - PostgreSQL client

---

### 3. Keycloak (OIDC Server)
**Port:** 8080  
**Mục đích:** Identity Provider (IdP)  
**Chức năng:**
- User authentication
- JWT token issuance
- User management
- SSO (Single Sign-On)
- Password policies
- Brute force protection

**Realm:** company  
**Client ID:** vpn-client  
**Token Lifespan:** 8 hours

**Test Users:**
```
john@company.com   - Employee
alice@company.com  - Financial Officer
bob@company.com    - DBA/Admin
```

---

### 4. HashiCorp Vault
**Port:** 8200  
**Mục đích:** Secret Management  
**Chức năng:**
- WireGuard keys storage
- Dynamic credentials
- Policy-based access control
- JWT authentication
- Audit logging
- Secret versioning

**Secrets Stored:**
```
secret/wireguard/john    - WireGuard config
secret/wireguard/alice   - WireGuard config
secret/wireguard/bob     - WireGuard config
secret/permissions/john  - User permissions
secret/permissions/alice - User permissions
secret/permissions/bob   - User permissions
```

**Policies:**
- `employee` - Read-only access to own configs
- `admin` - Full access to all secrets

---

### 5. WireGuard VPN Server
**Port:** 51820 (UDP)  
**Mục đích:** VPN Gateway  
**Chức năng:**
- Encrypted tunnel
- Peer management
- IP assignment
- Traffic routing

**Network:**
```
Server:  10.0.0.1
john:    10.0.0.100
alice:   10.0.0.101
bob:     10.0.0.102
```

---

### 6. Redis
**Port:** 6379  
**Mục đích:** Cache & Session Storage  
**Chức năng:**
- TOTP secrets storage
- MFA tokens
- Rate limiting
- Access logs
- Replay attack prevention

**Keys:**
```
totp_secret:{username}         - TOTP secret
totp_used:{username}:{code}    - Used codes
mfa_verified:{username}        - MFA session token
access_logs                    - Audit logs list
```

---

### 7. PostgreSQL
**Port:** 5432  
**Mục đích:** Database cho Keycloak  
**Chức năng:**
- User data
- Realm configuration
- Client configuration
- Sessions
- Events

---

## Flow Hoạt Động Chi Tiết

### Authentication Flow

```
1. CLIENT → FRONTEND
   User mở http://localhost:3000

2. FRONTEND → BACKEND → KEYCLOAK
   POST /api/auth/login
   {username, password}
   ↓
   Keycloak verify credentials
   ↓
   Return JWT token

3. FRONTEND → BACKEND
   POST /api/auth/totp/setup (with token)
   ↓
   Backend generate TOTP secret
   ↓
   Store in Redis
   ↓
   Return QR code

4. CLIENT → AUTHENTICATOR APP
   Scan QR code
   ↓
   App generates 6-digit code every 30s

5. FRONTEND → BACKEND
   POST /api/auth/totp/verify
   {totp_code}
   ↓
   Backend verify with Redis secret
   ↓
   Check not used before (anti-replay)
   ↓
   Mark as used
   ↓
   Return MFA token

6. FRONTEND → BACKEND → VAULT
   POST /api/wireguard/config
   {mfa_token}
   ↓
   Verify MFA token
   ↓
   Login to Vault with JWT
   ↓
   Get WireGuard config
   ↓
   Return config file

7. CLIENT → WIREGUARD
   Import config file
   ↓
   Activate connection
   ↓
   Encrypted tunnel established
```

---

## Zero-Trust Layers

### Layer 1: Authentication
```
✓ Username + Password (Keycloak)
✓ Password complexity rules
✓ Brute force protection
```

### Layer 2: Multi-Factor Authentication
```
✓ TOTP 6-digit code
✓ 30-second rotation
✓ Replay attack prevention
✓ Device binding
```

### Layer 3: Authorization
```
✓ JWT token validation
✓ Vault policy check
✓ Least privilege access
✓ Role-based permissions
```

### Layer 4: Network Security
```
✓ WireGuard encryption (ChaCha20)
✓ Perfect forward secrecy
✓ IP allowlisting
✓ Rate limiting
```

### Layer 5: Audit & Monitoring
```
✓ Access logs (Redis)
✓ Vault audit logs
✓ Real-time monitoring
✓ Anomaly detection
```

---

## Security Features

### 1. Token Expiration
- Access Token: 8 hours
- Refresh Token: 30 days
- MFA Token: 1 hour
- TOTP Code: 30 seconds

### 2. Rate Limiting
- Login attempts: 5/minute
- TOTP attempts: 3/minute
- API requests: 100/minute

### 3. IP Validation
- Track last login IP
- Impossible travel detection
- IP reputation check
- Geo-location validation

### 4. Device Validation
- Device fingerprinting
- Certificate binding
- OS version check
- Antivirus status

### 5. Audit Logging
```json
{
  "timestamp": "2024-01-01T10:00:00Z",
  "username": "john@company.com",
  "action": "wireguard_config",
  "status": "success",
  "ip": "192.168.1.100",
  "details": "MFA verified"
}
```

---

## Deployment

### Requirements
- Ubuntu 20.04/22.04 LTS
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 20GB disk space

### Quick Start
```bash
# 1. Setup
sudo ./scripts/setup.sh

# 2. Start services
sudo ./scripts/start.sh

# 3. Initialize Vault
sudo ./scripts/init-vault.sh

# 4. Initialize Keycloak
sudo ./scripts/init-keycloak.sh

# 5. Access UI
http://localhost:3000
```

---

## Troubleshooting

### Services không start
```bash
docker compose logs <service-name>
docker compose restart <service-name>
```

### Port conflicts
```bash
sudo netstat -tulpn | grep <port>
sudo kill <PID>
```

### Reset toàn bộ
```bash
sudo ./scripts/stop.sh
docker compose down -v
sudo ./scripts/start.sh
```

---

## Performance

### Expected Load
- Concurrent users: 100+
- Response time: <500ms
- Token generation: <100ms
- Config download: <1s

### Resource Usage
- CPU: 2-4 cores
- RAM: 4-8GB
- Disk I/O: Low
- Network: 10Mbps+

---

## Future Enhancements

1. **WebAuthn/FIDO2**
   - Hardware security keys
   - Biometric authentication

2. **Device Posture**
   - OS version check
   - Antivirus status
   - Disk encryption

3. **Advanced Analytics**
   - User behavior analysis
   - Anomaly detection
   - Risk scoring

4. **High Availability**
   - Multi-region deployment
   - Load balancing
   - Database replication

5. **Compliance**
   - GDPR compliance
   - SOC 2 audit
   - PCI-DSS compliance
