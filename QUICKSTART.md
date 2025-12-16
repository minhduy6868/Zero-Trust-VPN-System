# Zero-Trust VPN Infrastructure
# Đồ án lập trình Linux - Ubuntu

## HƯỚNG DẪN CHẠY ĐỒ ÁN

### Bước 1: Setup môi trường Ubuntu
```bash
cd /path/to/linux_zero_trust
sudo chmod +x scripts/*.sh
sudo ./scripts/setup.sh
```

### Bước 2: Khởi động services
```bash
sudo ./scripts/start.sh
# Chờ 2-3 phút để services khởi động
```

### Bước 3: Initialize Vault
```bash
sudo ./scripts/init-vault.sh
```

### Bước 4: Initialize Keycloak
```bash
sudo ./scripts/init-keycloak.sh
```

### Bước 5: Test authentication
```bash
sudo ./scripts/test-login.sh
```

### Bước 6: Truy cập Web UI
```
Frontend: http://localhost:3000
Login: john@company.com / password123
```

## CẤU TRÚC DỰ ÁN

```
linux_zero_trust/
├── README.md                    # File này
├── QUICKSTART.md               # Hướng dẫn nhanh
├── docker-compose.yml          # Docker services
│
├── scripts/                    # Shell scripts Ubuntu
│   ├── setup.sh               # Cài đặt dependencies
│   ├── start.sh               # Khởi động services
│   ├── stop.sh                # Dừng services
│   ├── status.sh              # Kiểm tra status
│   ├── init-vault.sh          # Setup Vault
│   ├── init-keycloak.sh       # Setup Keycloak
│   └── test-login.sh          # Test authentication
│
├── servers/
│   ├── backend/               # Python Flask API
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── app.py            # Main API
│   │
│   ├── frontend/              # React Web UI
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── App.js
│   │       ├── pages/
│   │       │   ├── Login.js
│   │       │   ├── TOTPSetup.js
│   │       │   ├── TOTPVerify.js
│   │       │   └── Dashboard.js
│   │       └── services/
│   │           └── api.js
│   │
│   ├── vault/                 # Vault configs
│   │   ├── config/
│   │   └── policies/
│   │
│   ├── keycloak/              # Keycloak configs
│   └── wireguard/             # WireGuard configs
│
└── mock-data/
    ├── users.json             # Test users
    └── permissions.json       # Permissions

```

## TÍNH NĂNG CHÍNH

### 1. Multi-Factor Authentication (TOTP)
- Username + Password (Layer 1)
- TOTP 6-digit code (Layer 2)
- Google Authenticator compatible

### 2. Zero-Trust Architecture
- Least Privilege Access
- Continuous Verification
- Device Posture Check
- Geo-location Validation

### 3. WireGuard VPN
- Encrypted tunnel (10.0.0.0/8)
- Dynamic config generation
- Token-based access control

### 4. HashiCorp Vault
- Secret management
- Dynamic credentials
- Policy-based access control
- Audit logging

### 5. OIDC Authentication
- Keycloak identity provider
- JWT tokens
- SSO capability

## TEST USERS

| Email | Password | Role | IP Address |
|-------|----------|------|------------|
| john@company.com | password123 | Employee | 10.0.0.100 |
| alice@company.com | password123 | Financial Officer | 10.0.0.101 |
| bob@company.com | password123 | DBA/Admin | 10.0.0.102 |

## KIỂM TRA SERVICES

```bash
# Xem status tất cả services
sudo ./scripts/status.sh

# Xem logs
docker compose logs -f

# Xem logs của service cụ thể
docker compose logs -f backend
docker compose logs -f keycloak
docker compose logs -f vault
```

## TROUBLESHOOTING

### Services không start
```bash
# Kiểm tra ports
sudo netstat -tulpn | grep -E '(8080|8200|5000|3000|51820)'

# Restart services
sudo ./scripts/stop.sh
sudo ./scripts/start.sh
```

### Vault không kết nối được
```bash
# Check Vault status
docker compose logs vault

# Reinitialize
sudo ./scripts/init-vault.sh
```

### Keycloak không login được
```bash
# Check Keycloak logs
docker compose logs keycloak

# Reinitialize
sudo ./scripts/init-keycloak.sh
```

## API ENDPOINTS

### Authentication
- `POST /api/auth/login` - Login với username/password
- `POST /api/auth/totp/setup` - Setup TOTP
- `POST /api/auth/totp/verify` - Verify TOTP code

### User
- `GET /api/user/profile` - Get user profile
- `GET /api/user/permissions` - Get user permissions

### WireGuard
- `POST /api/wireguard/config` - Get WireGuard config (requires MFA)

### Health
- `GET /api/health` - API health check

## BẢO MẬT

✅ Password hashing (bcrypt)
✅ JWT token authentication
✅ TOTP Multi-Factor Authentication
✅ Rate limiting
✅ Audit logging
✅ Token expiration (8 hours)
✅ Device binding
✅ Geo-location check
✅ IP reputation check

## DEMO VIDEO

Ghi lại video demo theo flow:
1. Login với username/password
2. Setup TOTP (scan QR code)
3. Verify TOTP 6-digit code
4. Dashboard - generate WireGuard config
5. Download config
6. Connect WireGuard client
7. Test connectivity (ping 10.0.0.1)
8. Show audit logs

## TÀI LIỆU THAM KHẢO

- WireGuard: https://www.wireguard.com/
- HashiCorp Vault: https://www.vaultproject.io/
- Keycloak: https://www.keycloak.org/
- Zero-Trust: https://www.nist.gov/publications/zero-trust-architecture

## LICENSE

Educational Project - MIT License
