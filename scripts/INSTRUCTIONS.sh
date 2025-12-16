#!/bin/bash

###############################################################################
# HƯỚNG DẪN CHẠY ĐỒ ÁN ZERO-TRUST VPN TRÊN UBUNTU
# Đọc file này để hiểu cách chạy project
###############################################################################

cat << 'EOF'

╔═══════════════════════════════════════════════════════════════╗
║          ZERO-TRUST VPN - ĐỒ ÁN LẬP TRÌNH LINUX             ║
║          WireGuard + Vault + OIDC + TOTP MFA                ║
╚═══════════════════════════════════════════════════════════════╝

📋 YÊU CẦU HỆ THỐNG:
════════════════════
✓ Ubuntu 20.04/22.04 LTS
✓ 4GB RAM (recommended)
✓ 20GB disk space
✓ Internet connection
✓ Sudo privileges

📦 BƯỚC 1: CÀI ĐẶT DEPENDENCIES
════════════════════════════════

cd ~/projects/linux_zero_trust
sudo chmod +x scripts/*.sh
sudo ./scripts/setup.sh

Script này sẽ cài đặt:
  • Docker & Docker Compose
  • WireGuard tools
  • jq, curl, wget
  • Enable IP forwarding

⏱️  Thời gian: 5-10 phút

🚀 BƯỚC 2: KHỞI ĐỘNG SERVICES
═══════════════════════════════

sudo ./scripts/start.sh

Services sẽ được khởi động:
  • PostgreSQL (database)
  • Keycloak (OIDC server) - Port 8080
  • Vault (secret manager) - Port 8200
  • Redis (cache)
  • Backend API (Flask) - Port 5000
  • Frontend (React) - Port 3000
  • WireGuard (VPN) - Port 51820

⏱️  Thời gian: 2-3 phút

🔐 BƯỚC 3: INITIALIZE VAULT
═══════════════════════════

sudo ./scripts/init-vault.sh

Script này sẽ:
  ✓ Enable KV secrets engine
  ✓ Enable JWT auth method
  ✓ Create policies (employee, admin)
  ✓ Generate WireGuard keys
  ✓ Create test user configs
  ✓ Set permissions

⏱️  Thời gian: 30 giây

👥 BƯỚC 4: INITIALIZE KEYCLOAK
══════════════════════════════

sudo ./scripts/init-keycloak.sh

Script này sẽ:
  ✓ Create realm "company"
  ✓ Create OIDC client "vpn-client"
  ✓ Create test users (john, alice, bob)
  ✓ Configure authentication

⏱️  Thời gian: 30 giây

✅ BƯỚC 5: KIỂM TRA SERVICES
════════════════════════════

sudo ./scripts/status.sh

Xem status của tất cả services

🧪 BƯỚC 6: TEST AUTHENTICATION
══════════════════════════════

sudo ./scripts/test-login.sh

Script này sẽ test:
  ✓ API health check
  ✓ Login với john@company.com
  ✓ Get user profile
  ✓ Setup TOTP
  ✓ Get permissions

🌐 BƯỚC 7: TRUY CẬP WEB UI
═══════════════════════════

Mở browser: http://localhost:3000

LOGIN CREDENTIALS:
  Email:    john@company.com
  Password: password123

FLOW:
  1. Nhập email + password → Click "Sign In"
  2. Setup TOTP → Scan QR code với Google Authenticator
  3. Nhập 6-digit code → Verify
  4. Dashboard → Click "Generate WireGuard Config"
  5. Download config file
  6. Import vào WireGuard client
  7. Activate → Connected! ✓

📱 CÀI GOOGLE AUTHENTICATOR
════════════════════════════

Android: https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2
iOS: https://apps.apple.com/app/google-authenticator/id388497605

🔌 CONNECT WIREGUARD
════════════════════

# Linux
sudo apt install wireguard
sudo wg-quick up ~/Downloads/company-vpn.conf

# Check connection
ping 10.0.0.1

# Disconnect
sudo wg-quick down ~/Downloads/company-vpn.conf

📊 XEM LOGS
═══════════

# Tất cả services
docker compose logs -f

# Service cụ thể
docker compose logs -f backend
docker compose logs -f keycloak
docker compose logs -f vault

🛑 DỪNG SERVICES
════════════════

sudo ./scripts/stop.sh

🔄 RESTART SERVICES
═══════════════════

sudo ./scripts/stop.sh
sudo ./scripts/start.sh

🧹 XÓA TOÀN BỘ (including data)
══════════════════════════════

sudo ./scripts/stop.sh
docker compose down -v

⚠️  WARNING: Lệnh này sẽ xóa toàn bộ database và volumes!

🐛 TROUBLESHOOTING
══════════════════

1. Port bị chiếm:
   sudo netstat -tulpn | grep -E '(8080|8200|5000|3000)'
   sudo kill <PID>

2. Docker không có quyền:
   sudo usermod -aG docker $USER
   newgrp docker

3. Services không start:
   docker compose logs <service-name>
   docker compose restart <service-name>

4. Rebuild sau khi sửa code:
   docker compose up -d --build

📚 KIẾN TRÚC HỆ THỐNG
═════════════════════

┌─────────┐    ┌──────────┐    ┌───────┐    ┌──────────┐
│ Client  │───▶│ Keycloak │───▶│ Vault │───▶│WireGuard │
│(Browser)│    │  (OIDC)  │    │(Mgmt) │    │  (VPN)   │
└─────────┘    └──────────┘    └───────┘    └──────────┘
     │              │               │              │
     └──────────────┴───────────────┴──────────────┘
              Encrypted Tunnel (10.0.0.0/8)

🔐 SECURITY LAYERS
══════════════════

Layer 1: OIDC Authentication
  ✓ Username + Password
  ✓ Email verification

Layer 2: Multi-Factor Authentication
  ✓ TOTP 6-digit code
  ✓ 30-second rotation
  ✓ Replay attack prevention

Layer 3: Device & Network Check
  ✓ Device certificate
  ✓ IP reputation
  ✓ Geo-location
  ✓ Impossible travel detection

Layer 4: Vault Authorization
  ✓ Least privilege
  ✓ Policy-based access
  ✓ Dynamic credentials
  ✓ Token expiration (8h)

Layer 5: WireGuard Encryption
  ✓ End-to-end encryption
  ✓ Device binding
  ✓ Continuous monitoring

📖 TEST ACCOUNTS
════════════════

1. john@company.com / password123
   Role: Employee
   IP: 10.0.0.100
   Access: customer_db, web-server-1

2. alice@company.com / password123
   Role: Financial Officer
   IP: 10.0.0.101
   Access: customer_db, finance_db, finance-server

3. bob@company.com / password123
   Role: DBA/Admin
   IP: 10.0.0.102
   Access: All databases, all servers

📞 SUPPORT
══════════

Issues: Check logs first
  docker compose logs -f

Questions: Read QUICKSTART.md

╔═══════════════════════════════════════════════════════════╗
║                  CHÚC BẠN THÀNH CÔNG! 🚀                 ║
╚═══════════════════════════════════════════════════════════╝

EOF
