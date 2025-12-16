# 🔐 Zero-Trust VPN Infrastructure
**WireGuard + HashiCorp Vault + OIDC Authentication trên Ubuntu Linux**

[![Ubuntu](https://img.shields.io/badge/Ubuntu-20.04%20%7C%2022.04-orange)](https://ubuntu.com/)
[![Docker](https://img.shields.io/badge/Docker-20.10+-blue)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📋 Mục Lục

- [Giới Thiệu](#-giới-thiệu)
- [Tính Năng](#-tính-năng)
- [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
- [Công Nghệ Sử Dụng](#-công-nghệ-sử-dụng)
- [Cài Đặt Nhanh](#-cài-đặt-nhanh)
- [Demo & Screenshots](#-demo--screenshots)
- [Tài Liệu](#-tài-liệu)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🎯 Giới Thiệu

**Zero-Trust VPN Infrastructure** là đồ án lập trình Linux triển khai mô hình bảo mật Zero-Trust cho hệ thống VPN doanh nghiệp. Thay vì tin tưởng người dùng sau khi login một lần (như VPN truyền thống), hệ thống này yêu cầu xác thực liên tục qua nhiều lớp bảo mật.

### ❓ Zero-Trust là gì?

**VPN Truyền Thống:**
```
User → Password → Trusted (Full Access) ❌
```
*Vấn đề:* Một khi hacker có password, họ có toàn quyền truy cập.

**Zero-Trust (Đồ án này):**
```
User → Password → TOTP → Policy Check → Limited Access → Continuous Monitoring ✅
```
*Lợi ích:* Ngay cả khi password bị lộ, hacker vẫn bị chặn bởi MFA và policy.

### 🎓 Mục Tiêu Đồ Án

Đồ án này được xây dựng nhằm:
- ✅ Triển khai kiến trúc Zero-Trust thực tế
- ✅ Sử dụng Linux shell scripting (Bash) để tự động hóa
- ✅ Áp dụng Docker containerization
- ✅ Tích hợp các công nghệ bảo mật hiện đại
- ✅ Demo được trên Ubuntu Server
- ✅ Hỗ trợ remote access từ client machines

---

## ✨ Tính Năng

### 🔐 Bảo Mật Nhiều Lớp

| Layer | Công Nghệ | Mô Tả |
|-------|-----------|-------|
| **Layer 1** | Keycloak OIDC | Username + Password authentication |
| **Layer 2** | TOTP MFA | 6-digit code từ Google Authenticator |
| **Layer 3** | HashiCorp Vault | Policy-based authorization |
| **Layer 4** | WireGuard | Encrypted VPN tunnel (ChaCha20) |
| **Layer 5** | Audit Logs | Real-time monitoring & alerting |

### 🚀 Tính Năng Chính

- ✅ **Multi-Factor Authentication (MFA)**
  - TOTP 6-digit code với Google Authenticator
  - Code refresh mỗi 30 giây
  - Replay attack prevention

- ✅ **Policy-Based Access Control**
  - Least privilege principle
  - Role-based permissions (Employee, Admin, DBA)
  - Dynamic credential management

- ✅ **WireGuard VPN**
  - Modern, fast, secure VPN protocol
  - Dynamic config generation
  - IP assignment (10.0.0.0/8 subnet)

- ✅ **Remote Access Support**
  - Client có thể truy cập từ bất kỳ máy nào
  - Auto IP detection
  - Firewall auto-configuration

- ✅ **Audit & Monitoring**
  - Real-time access logs
  - Security event tracking
  - Admin dashboard

- ✅ **Automated Deployment**
  - One-command deploy: `sudo ./deploy.sh`
  - Shell scripts tự động hóa mọi bước
  - Docker containerization

---

## 🏗️ Kiến Trúc Hệ Thống

### Sơ Đồ Tổng Quan

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────┐         ┌────────────────┐                       │
│  │ Browser  │────────▶│  React Web UI  │                       │
│  │(Any PC)  │         │  Port 3000     │                       │
│  └──────────┘         └────────────────┘                       │
│       │                       │                                 │
│       │ HTTP                  │ HTTP/WebSocket                 │
│       ▼                       ▼                                 │
│  ┌────────────────────────────────────┐                        │
│  │    WireGuard VPN Client            │                        │
│  │    (Encrypted Tunnel)              │                        │
│  └────────────────────────────────────┘                        │
└───────────────────────┼──────────────────────────────────────────┘
                        │
                        │ Encrypted Traffic
                        │
┌───────────────────────┼──────────────────────────────────────────┐
│                       │         SERVER LAYER (Ubuntu)            │
│                       ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Nginx Reverse Proxy (Optional)             │   │
│  └──────┬──────────────────────┬──────────────────────────┘   │
│         │                      │                                │
│         ▼                      ▼                                │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐   │
│  │   Frontend  │      │   Backend   │      │  WireGuard  │   │
│  │   (React)   │◀────▶│   (Flask)   │◀────▶│   Server    │   │
│  │  Port 3000  │      │  Port 5000  │      │  Port 51820 │   │
│  └─────────────┘      └─────────────┘      └─────────────┘   │
│                              │                                  │
│                              ├──────────┬──────────┬──────────┐│
│                              ▼          ▼          ▼          ││
│                       ┌─────────┐ ┌─────────┐ ┌────────┐    ││
│                       │Keycloak │ │  Vault  │ │ Redis  │    ││
│                       │Port 8080│ │Port 8200│ │Port6379│    ││
│                       │ (OIDC)  │ │(Secrets)│ │(Cache) │    ││
│                       └─────────┘ └─────────┘ └────────┘    ││
│                              │                                  │
│                              ▼                                  │
│                       ┌────────────┐                           │
│                       │ PostgreSQL │                           │
│                       │ Port 5432  │                           │
│                       │ (Database) │                           │
│                       └────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### Flow Xác Thực Chi Tiết

```
1. CLIENT LOGIN
   ↓
2. KEYCLOAK AUTHENTICATION
   - Verify username/password
   - Return JWT token
   ↓
3. TOTP VERIFICATION
   - User nhập 6-digit code
   - Backend verify với Redis
   - Check replay attack
   ↓
4. VAULT AUTHORIZATION
   - Check JWT token validity
   - Apply user policy
   - Return WireGuard config
   ↓
5. VPN CONNECTION
   - Client import config
   - WireGuard establish tunnel
   - Assign private IP (10.0.0.x)
   ↓
6. ACCESS GRANTED
   - User can access internal resources
   - All actions logged
   - Continuous monitoring
```

---

## 🛠️ Công Nghệ Sử Dụng

### Backend Stack
- **Python 3.11** - Backend programming language
- **Flask** - Web framework
- **hvac** - HashiCorp Vault client
- **pyotp** - TOTP generator & verifier
- **Redis** - Cache & session storage
- **PostgreSQL** - Keycloak database

### Frontend Stack
- **React 18** - UI framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **CSS3** - Styling

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **WireGuard** - Modern VPN protocol
- **HashiCorp Vault** - Secret management
- **Keycloak** - Identity & access management (OIDC)
- **Nginx** - Reverse proxy (optional)
- **Ubuntu Linux** - Operating system

### Shell Scripting
- **Bash** - Automation scripts
- **jq** - JSON processing
- **curl** - API testing
- **systemd** - Service management

---

## ⚡ Cài Đặt Nhanh

### Yêu Cầu Hệ Thống

| Component | Requirement |
|-----------|-------------|
| OS | Ubuntu 20.04/22.04 LTS |
| CPU | 2+ cores (recommended) |
| RAM | 4GB minimum (8GB recommended) |
| Disk | 20GB free space |
| Network | Internet connection |
| Ports | 3000, 5000, 8080, 8200, 51820 |

### Option 1: Deploy Tự Động (Khuyến Nghị) ⭐

```bash
# Clone project
cd ~/projects
git clone https://github.com/your-repo/linux_zero_trust.git
cd linux_zero_trust

# Cấp quyền
sudo chmod +x scripts/*.sh
sudo chmod +x deploy.sh

# Deploy tất cả (một lệnh)
sudo ./deploy.sh
```

⏱️ **Thời gian:** 10-15 phút  
✅ **Tự động:** Setup, start, initialize tất cả services

### Option 2: Deploy Từng Bước

```bash
# Bước 1: Setup dependencies
sudo ./scripts/setup.sh

# Bước 2: Configure remote access (nếu cần)
sudo ./scripts/configure-remote.sh

# Bước 3: Start services
sudo ./scripts/start.sh

# Bước 4: Initialize Vault
sudo ./scripts/init-vault.sh

# Bước 5: Initialize Keycloak
sudo ./scripts/init-keycloak.sh

# Bước 6: Test
sudo ./scripts/test-login.sh
```

### Truy Cập Hệ Thống

**Local (trên server):**
```
Frontend:  http://localhost:3000
Backend:   http://localhost:5000
Keycloak:  http://localhost:8080 (admin/admin123)
Vault:     http://localhost:8200 (token: myroot)
```

**Remote (từ máy khác):**
```
# Get server IP
hostname -I
# Example: 192.168.1.100

# Access from any client
Frontend:  http://192.168.1.100:3000
```

### Test Accounts

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| john@company.com | password123 | Employee | Limited |
| alice@company.com | password123 | Financial Officer | Medium |
| bob@company.com | password123 | DBA/Admin | Full |

---

## 📸 Demo & Screenshots

### 1. Login Page
```
┌─────────────────────────────────────┐
│     🔐 Zero-Trust VPN Login        │
│                                     │
│  Email:    [john@company.com    ]  │
│  Password: [••••••••••••        ]  │
│                                     │
│         [ Sign In ]                 │
└─────────────────────────────────────┘
```

### 2. TOTP Setup (QR Code)
```
┌─────────────────────────────────────┐
│     📱 Setup Multi-Factor Auth     │
│                                     │
│   Scan with Google Authenticator:  │
│                                     │
│        ┌─────────────┐             │
│        │ QR CODE     │             │
│        │ [████████]  │             │
│        └─────────────┘             │
│                                     │
│   Secret: JBSWY3DPEHPK3PXP        │
└─────────────────────────────────────┘
```

### 3. TOTP Verification
```
┌─────────────────────────────────────┐
│     🔢 Enter 6-Digit Code          │
│                                     │
│         [ 1 2 3 4 5 6 ]            │
│                                     │
│    ⏱ Code refreshes every 30s      │
│                                     │
│       [ Verify & Continue ]         │
└─────────────────────────────────────┘
```

### 4. Dashboard
```
┌─────────────────────────────────────┐
│  Welcome, John Doe! 👋              │
│  ✉️ john@company.com                │
│                                     │
│  🔐 WireGuard Configuration         │
│  [ Generate Config ]                │
│                                     │
│  🔒 Your Permissions:               │
│  ✓ customer_db                      │
│  ✓ web-server-1                     │
│                                     │
│  📊 Security Status: Active ✓       │
└─────────────────────────────────────┘
```

---

## 📚 Tài Liệu

### Hướng Dẫn Chi Tiết

| File | Nội Dung |
|------|----------|
| [SETUP.md](SETUP.md) | 📖 Hướng dẫn cài đặt từng bước chi tiết |
| [REMOTE_ACCESS.md](REMOTE_ACCESS.md) | 🌐 Cấu hình remote access |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 🏗️ Kiến trúc hệ thống chi tiết |
| [QUICKSTART.md](QUICKSTART.md) | ⚡ Quick start guide |

### Scripts

| Script | Chức Năng |
|--------|-----------|
| `scripts/setup.sh` | Cài đặt dependencies (Docker, WireGuard, etc.) |
| `scripts/configure-remote.sh` | Configure remote access |
| `scripts/start.sh` | Start tất cả services |
| `scripts/stop.sh` | Stop tất cả services |
| `scripts/status.sh` | Check status services |
| `scripts/init-vault.sh` | Initialize Vault với policies |
| `scripts/init-keycloak.sh` | Initialize Keycloak với users |
| `scripts/test-login.sh` | Test authentication flow |

---

## 🐛 Troubleshooting

### Issue 1: Ports đã được sử dụng

```bash
# Check ports
sudo netstat -tulpn | grep -E '(3000|5000|8080|8200)'

# Kill process
sudo kill <PID>

# Restart services
sudo ./scripts/start.sh
```

### Issue 2: Docker permission denied

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply changes
newgrp docker

# Or logout and login again
```

### Issue 3: Cannot access from client machine

```bash
# Check firewall
sudo ufw status

# Open ports
sudo ufw allow 3000/tcp
sudo ufw allow 5000/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 8200/tcp
sudo ufw allow 51820/udp
sudo ufw reload
```

### Issue 4: Services không start

```bash
# Check logs
docker compose logs <service-name>

# Restart specific service
docker compose restart <service-name>

# Rebuild
docker compose up -d --build
```

### Issue 5: Reset toàn bộ

```bash
# Stop và xóa all data
sudo ./scripts/stop.sh
sudo docker compose down -v

# Redeploy
sudo ./deploy.sh
```

### Xem Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f keycloak
docker compose logs -f vault
```

---

## 🤝 Contributing

Contributions are welcome! Đây là đồ án học tập, mọi góp ý và cải thiện đều được hoan nghênh.

---

## 📄 License

MIT License - Xem file [LICENSE](LICENSE) để biết chi tiết.

---

## 👨‍💻 Author

**Your Name**  
- GitHub: [@your-github](https://github.com/your-github)
- Email: your-email@example.com

---

## 🙏 Acknowledgments

- [WireGuard](https://www.wireguard.com/) - Modern VPN protocol
- [HashiCorp Vault](https://www.vaultproject.io/) - Secret management
- [Keycloak](https://www.keycloak.org/) - Identity provider
- [Docker](https://www.docker.com/) - Containerization
- [Ubuntu](https://ubuntu.com/) - Operating system

---

## 📊 Project Stats

- **Lines of Code:** 3,000+
- **Files:** 30+
- **Technologies:** 7+
- **Shell Scripts:** 10+
- **Docker Services:** 7

---

<div align="center">

**⭐ If this project helps you, please give it a star! ⭐**

Made with ❤️ for educational purposes

</div>

## Cấu Trúc Thư Mục

```
linux_zero_trust/
├── README.md
├── docker-compose.yml
├── scripts/
│   ├── setup.sh              # Setup Ubuntu dependencies
│   ├── start.sh              # Khởi động services
│   ├── stop.sh               # Dừng services
│   ├── status.sh             # Kiểm tra status
│   ├── init-vault.sh         # Initialize Vault
│   ├── init-keycloak.sh      # Setup Keycloak realm
│   └── test-login.sh         # Test authentication flow
├── servers/
│   ├── backend/              # Python Flask API
│   ├── frontend/             # React Web UI
│   ├── vault/                # Vault configs
│   ├── keycloak/             # Keycloak configs
│   └── wireguard/            # WireGuard configs
└── mock-data/
    ├── users.json            # Test users
    └── permissions.json      # Role permissions
```

## Sử Dụng

### 1. Login qua Web UI

```bash
# Truy cập http://localhost:3000
# Username: john@company.com
# Password: password123
# TOTP: (scan QR code hoặc nhập manual)
```

### 2. Tải WireGuard Config

Sau khi login, download file `company.conf` và import vào WireGuard client:

```bash
# Linux
sudo wg-quick up ~/Downloads/company.conf

# Kiểm tra kết nối
ping 10.0.0.1
```

### 3. Truy cập Internal Resources

```bash
# SSH vào internal server
ssh developer@10.0.0.20

# Access database
mysql -h 10.0.0.10 -u john -p
```

## Testing

```bash
# Test authentication flow
./scripts/test-login.sh

# Test TOTP
./scripts/test-totp.sh

# Test WireGuard connection
./scripts/test-wireguard.sh

# View logs
docker-compose logs -f
```

## Security Features

- ✅ Multi-Factor Authentication (TOTP)
- ✅ Device Certificate Binding
- ✅ Device Posture Check (OS, Antivirus, Firewall)
- ✅ Geo-location & IP Reputation Check
- ✅ Impossible Travel Detection
- ✅ Token Expiration & Refresh
- ✅ Least Privilege Access (Vault Policies)
- ✅ Audit Logging & Real-time Monitoring

## Troubleshooting

```bash
# Xem logs của service cụ thể
docker-compose logs keycloak
docker-compose logs vault
docker-compose logs backend
docker-compose logs wireguard

# Restart service
docker-compose restart <service-name>

# Rebuild sau khi sửa code
docker-compose up -d --build

# Xóa toàn bộ và start lại
./scripts/stop.sh
docker-compose down -v
./scripts/start.sh
```

## License

MIT License - Educational Project
