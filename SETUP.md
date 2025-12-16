# 🚀 Hướng Dẫn Cài Đặt Chi Tiết - Zero-Trust VPN Infrastructure

Tài liệu này hướng dẫn từng bước cài đặt, cấu hình, và triển khai hệ thống Zero-Trust VPN Infrastructure trên Ubuntu Linux.

---

## 📋 Mục Lục

1. [Yêu Cầu Hệ Thống](#1-yêu-cầu-hệ-thống)
2. [Chuẩn Bị Môi Trường](#2-chuẩn-bị-môi-trường)
3. [Cài Đặt Dependencies](#3-cài-đặt-dependencies)
4. [Cấu Hình Network & Firewall](#4-cấu-hình-network--firewall)
5. [Deploy Services](#5-deploy-services)
6. [Initialize Vault](#6-initialize-vault)
7. [Initialize Keycloak](#7-initialize-keycloak)
8. [Test Hệ Thống](#8-test-hệ-thống)
9. [Cấu Hình Remote Access](#9-cấu-hình-remote-access)
10. [Troubleshooting](#10-troubleshooting)
11. [Maintenance](#11-maintenance)

---

## 1. Yêu Cầu Hệ Thống

### Phần Cứng

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4GB | 8GB+ |
| **Disk** | 20GB | 50GB+ SSD |
| **Network** | 100Mbps | 1Gbps |

### Phần Mềm

| Software | Version | Required |
|----------|---------|----------|
| **Ubuntu** | 20.04/22.04 LTS | ✅ Yes |
| **Docker** | 20.10+ | ✅ Yes |
| **Docker Compose** | 2.0+ | ✅ Yes |
| **Git** | Latest | ✅ Yes |
| **curl** | Latest | ✅ Yes |
| **jq** | Latest | ✅ Yes |

### Ports

Các port sau cần được mở:

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| **3000** | Frontend | TCP | React Web UI |
| **5000** | Backend | TCP | Flask API |
| **8080** | Keycloak | TCP | OIDC Authentication |
| **8200** | Vault | TCP | Secret Management |
| **5432** | PostgreSQL | TCP | Database (internal) |
| **6379** | Redis | TCP | Cache (internal) |
| **51820** | WireGuard | UDP | VPN Tunnel |

---

## 2. Chuẩn Bị Môi Trường

### 2.1. Update System

```bash
# Update package list
sudo apt update

# Upgrade existing packages
sudo apt upgrade -y

# Reboot if kernel updated
sudo reboot
```

### 2.2. Create User (Optional)

```bash
# Create a dedicated user for the project
sudo adduser zerotrust

# Add to sudo group
sudo usermod -aG sudo zerotrust

# Add to docker group (will do this later)
sudo usermod -aG docker zerotrust

# Switch to user
su - zerotrust
```

### 2.3. Create Project Directory

```bash
# Create project directory
mkdir -p ~/projects
cd ~/projects

# Clone project
git clone https://github.com/your-repo/linux_zero_trust.git
cd linux_zero_trust

# Check structure
ls -la
```

Expected output:
```
.
├── docker-compose.yml
├── README.md
├── SETUP.md
├── servers/
│   ├── backend/
│   └── frontend/
├── scripts/
│   ├── setup.sh
│   ├── start.sh
│   ├── stop.sh
│   ├── status.sh
│   ├── init-vault.sh
│   ├── init-keycloak.sh
│   └── configure-remote.sh
├── mock-data/
└── wireguard-config/
```

### 2.4. Cấp Quyền Scripts

```bash
# Make all scripts executable
chmod +x scripts/*.sh

# Verify
ls -lh scripts/
```

---

## 3. Cài Đặt Dependencies

### Option 1: Sử Dụng Script Tự Động (Khuyến Nghị) ⭐

```bash
# Run setup script
sudo ./scripts/setup.sh
```

Script này sẽ tự động cài đặt:
- Docker & Docker Compose
- WireGuard kernel module
- jq (JSON processor)
- curl
- net-tools

**⏱ Thời gian:** 5-10 phút

### Option 2: Cài Đặt Thủ Công

#### 3.1. Install Docker

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install prerequisites
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) \
    signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Verify installation
docker --version
```

Expected output:
```
Docker version 24.0.7, build afdd53b
```

#### 3.2. Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Create symlink (optional)
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Verify installation
docker-compose --version
```

Expected output:
```
Docker Compose version v2.23.3
```

#### 3.3. Configure Docker

```bash
# Add current user to docker group
sudo usermod -aG docker $USER

# Apply changes (requires re-login)
newgrp docker

# Test Docker without sudo
docker run hello-world
```

#### 3.4. Install WireGuard

```bash
# Update package list
sudo apt update

# Install WireGuard
sudo apt install -y wireguard

# Load kernel module
sudo modprobe wireguard

# Verify
lsmod | grep wireguard
```

Expected output:
```
wireguard             102400  0
```

#### 3.5. Install Additional Tools

```bash
# Install jq (JSON processor)
sudo apt install -y jq

# Install curl
sudo apt install -y curl

# Install net-tools
sudo apt install -y net-tools

# Verify
jq --version
curl --version
netstat --version
```

---

## 4. Cấu Hình Network & Firewall

### 4.1. Enable IP Forwarding (Cho WireGuard)

```bash
# Check current setting
sysctl net.ipv4.ip_forward

# Enable temporarily
sudo sysctl -w net.ipv4.ip_forward=1

# Enable permanently
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.conf

# Apply changes
sudo sysctl -p
```

### 4.2. Configure UFW Firewall

```bash
# Install UFW (if not installed)
sudo apt install -y ufw

# Check status
sudo ufw status

# Allow SSH (IMPORTANT: don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow application ports
sudo ufw allow 3000/tcp comment 'React Frontend'
sudo ufw allow 5000/tcp comment 'Flask Backend'
sudo ufw allow 8080/tcp comment 'Keycloak OIDC'
sudo ufw allow 8200/tcp comment 'Vault API'
sudo ufw allow 51820/udp comment 'WireGuard VPN'

# Enable firewall
sudo ufw enable

# Verify rules
sudo ufw status numbered
```

Expected output:
```
Status: active

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere
[ 2] 3000/tcp                   ALLOW IN    Anywhere
[ 3] 5000/tcp                   ALLOW IN    Anywhere
[ 4] 8080/tcp                   ALLOW IN    Anywhere
[ 5] 8200/tcp                   ALLOW IN    Anywhere
[ 6] 51820/udp                  ALLOW IN    Anywhere
```

### 4.3. Configure NAT (For WireGuard)

```bash
# Add NAT rules to UFW
sudo nano /etc/ufw/before.rules
```

Add these lines BEFORE `*filter`:
```bash
# NAT table rules for WireGuard
*nat
:POSTROUTING ACCEPT [0:0]

# Forward WireGuard traffic
-A POSTROUTING -s 10.0.0.0/8 -o eth0 -j MASQUERADE

COMMIT
```

**Note:** Replace `eth0` với tên interface thực tế (check bằng `ip a`).

```bash
# Reload UFW
sudo ufw disable
sudo ufw enable
```

---

## 5. Deploy Services

### 5.1. Review docker-compose.yml

```bash
# View configuration
cat docker-compose.yml
```

Kiểm tra 7 services:
- ✅ postgres (Database)
- ✅ keycloak (OIDC Provider)
- ✅ vault (Secret Management)
- ✅ redis (Cache)
- ✅ backend (Flask API)
- ✅ frontend (React UI)
- ✅ wireguard (VPN Server)

### 5.2. Pull Docker Images

```bash
# Pull all images (can take 5-10 minutes)
docker compose pull
```

Expected output:
```
[+] Pulling 7/7
 ✔ postgres Pulled
 ✔ keycloak Pulled
 ✔ vault Pulled
 ✔ redis Pulled
 ✔ backend Pulled
 ✔ frontend Pulled
 ✔ wireguard Pulled
```

### 5.3. Start Services

```bash
# Start all services in background
docker compose up -d

# Check status
docker compose ps
```

Expected output:
```
NAME                      STATUS              PORTS
linux_zero_trust-backend-1      Up 2 minutes        0.0.0.0:5000->5000/tcp
linux_zero_trust-frontend-1     Up 2 minutes        0.0.0.0:3000->3000/tcp
linux_zero_trust-keycloak-1     Up 2 minutes        0.0.0.0:8080->8080/tcp
linux_zero_trust-postgres-1     Up 2 minutes        5432/tcp
linux_zero_trust-redis-1        Up 2 minutes        6379/tcp
linux_zero_trust-vault-1        Up 2 minutes        0.0.0.0:8200->8200/tcp
linux_zero_trust-wireguard-1    Up 2 minutes        0.0.0.0:51820->51820/udp
```

### 5.4. Verify Services

```bash
# Check logs
docker compose logs -f

# Check specific service
docker compose logs backend

# Check if services are responding
curl http://localhost:5000/health
curl http://localhost:3000
curl http://localhost:8080
curl http://localhost:8200/v1/sys/health
```

---

## 6. Initialize Vault

Vault cần được initialize và unsealed trước khi sử dụng.

### 6.1. Manual Initialization

```bash
# Set Vault address
export VAULT_ADDR='http://localhost:8200'

# Initialize Vault
vault operator init
```

**⚠️ IMPORTANT:** Save the output! Contains:
- 5 unseal keys
- Initial root token

Example output:
```
Unseal Key 1: xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Unseal Key 2: xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Unseal Key 3: xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Unseal Key 4: xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Unseal Key 5: xxxxxxxxxxxxxxxxxxxxxxxxxxxx

Initial Root Token: s.xxxxxxxxxxxxxxxxxxxxxxxx
```

### 6.2. Unseal Vault

```bash
# Unseal with 3 keys (threshold)
vault operator unseal <KEY1>
vault operator unseal <KEY2>
vault operator unseal <KEY3>

# Check status
vault status
```

Expected output:
```
Sealed          false
```

### 6.3. Use Script (Easier) ⭐

```bash
# Run init script (auto unseal với dev token)
sudo ./scripts/init-vault.sh
```

Script này sẽ:
1. ✅ Unseal Vault với root token `myroot`
2. ✅ Enable Secrets Engine
3. ✅ Create Policies (employee, financial, dba)
4. ✅ Setup WireGuard secrets
5. ✅ Create test data

**⏱ Thời gian:** 1-2 phút

### 6.4. Verify Vault Setup

```bash
# Login
export VAULT_TOKEN="myroot"

# List policies
vault policy list

# Read policy
vault policy read employee-policy

# List secrets
vault kv list secret/wireguard
```

---

## 7. Initialize Keycloak

Keycloak cần realm, users, và OIDC client configuration.

### 7.1. Wait for Keycloak Ready

```bash
# Check logs
docker compose logs -f keycloak

# Wait for "Started" message
# Usually takes 2-3 minutes
```

### 7.2. Access Admin Console

```bash
# Open browser
http://localhost:8080

# Login credentials
Username: admin
Password: admin123
```

### 7.3. Use Script (Easier) ⭐

```bash
# Run init script
sudo ./scripts/init-keycloak.sh
```

Script này sẽ:
1. ✅ Create realm `zero-trust`
2. ✅ Create OIDC client `zero-trust-client`
3. ✅ Create 3 test users:
   - john@company.com (Employee)
   - alice@company.com (Financial Officer)
   - bob@company.com (DBA)
4. ✅ Configure redirect URIs
5. ✅ Enable direct access grants

**⏱ Thời gian:** 1 phút

### 7.4. Verify Keycloak Setup

```bash
# Get access token
curl -X POST 'http://localhost:8080/realms/zero-trust/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=zero-trust-client' \
  -d 'username=john@company.com' \
  -d 'password=password123' \
  -d 'grant_type=password'
```

Expected output:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 300,
  "token_type": "Bearer"
}
```

---

## 8. Test Hệ Thống

### 8.1. Test Backend API

```bash
# Health check
curl http://localhost:5000/health

# Test authentication endpoint
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "john@company.com",
    "password": "password123"
  }'
```

Expected output:
```json
{
  "token": "eyJhbGci...",
  "require_totp_setup": true
}
```

### 8.2. Test Frontend

```bash
# Open browser
http://localhost:3000

# Or use curl
curl http://localhost:3000
```

You should see React login page.

### 8.3. Full Authentication Flow Test

```bash
# Run test script
sudo ./scripts/test-login.sh
```

Script sẽ test:
1. ✅ Login với username/password
2. ✅ Get TOTP secret
3. ✅ Setup TOTP
4. ✅ Generate TOTP code
5. ✅ Verify TOTP
6. ✅ Get WireGuard config

**⏱ Thời gian:** 30 giây

### 8.4. Manual Browser Test

1. **Mở trình duyệt:** `http://localhost:3000`

2. **Login:**
   - Email: `john@company.com`
   - Password: `password123`
   - Click "Sign In"

3. **Setup TOTP:**
   - Scan QR code with Google Authenticator
   - Or enter secret manually
   - Click "Continue"

4. **Enter TOTP Code:**
   - Enter 6-digit code from app
   - Code changes every 30 seconds
   - Click "Verify"

5. **Dashboard:**
   - See user info
   - Click "Generate WireGuard Config"
   - Download config file

6. **Import to WireGuard:**
   ```bash
   # Install WireGuard on client
   sudo apt install wireguard
   
   # Copy config
   sudo cp john-wireguard.conf /etc/wireguard/wg0.conf
   
   # Start VPN
   sudo wg-quick up wg0
   
   # Check status
   sudo wg show
   ```

---

## 9. Cấu Hình Remote Access

Cho phép clients từ máy khác truy cập hệ thống (không chỉ localhost).

### 9.1. Run Configure Script ⭐

```bash
# Auto-detect IP và configure
sudo ./scripts/configure-remote.sh
```

Script sẽ:
1. ✅ Detect server IP address
2. ✅ Create `.env` file với SERVER_IP
3. ✅ Configure firewall (open ports)
4. ✅ Show access URLs
5. ✅ Update Keycloak redirect URIs

Example output:
```
[+] Server IP detected: 192.168.1.100
[+] Created .env configuration
[+] Firewall configured
[✓] Configuration complete!

Access URLs:
  Frontend: http://192.168.1.100:3000
  Backend:  http://192.168.1.100:5000
  Keycloak: http://192.168.1.100:8080
  Vault:    http://192.168.1.100:8200
```

### 9.2. Restart Services

```bash
# Stop services
sudo docker compose down

# Start with new config
sudo docker compose up -d

# Re-initialize Keycloak (important!)
sudo ./scripts/init-keycloak.sh
```

### 9.3. Test Remote Access

From another machine on the same network:

```bash
# Get server IP (example: 192.168.1.100)
# Test connectivity
ping 192.168.1.100

# Test ports
telnet 192.168.1.100 3000
telnet 192.168.1.100 5000
telnet 192.168.1.100 8080

# Open browser
http://192.168.1.100:3000
```

### 9.4. Troubleshoot Remote Access

**Problem 1: Cannot connect**
```bash
# Check firewall
sudo ufw status

# Check services listening
sudo netstat -tulpn | grep -E '(3000|5000|8080)'

# Should show 0.0.0.0:port instead of 127.0.0.1:port
```

**Problem 2: CORS errors**
```bash
# Reinitialize Keycloak (adds remote IP to allowed origins)
sudo ./scripts/init-keycloak.sh

# Restart backend
docker compose restart backend
```

**Problem 3: Keycloak redirect error**
```bash
# Check Keycloak client config
# Should have both localhost and remote IP in redirectUris

# Re-run init script
sudo ./scripts/init-keycloak.sh
```

---

## 10. Troubleshooting

### 10.1. Services Won't Start

```bash
# Check logs
docker compose logs <service-name>

# Common issues:
# 1. Port already in use
sudo netstat -tulpn | grep 8080
sudo kill <PID>

# 2. Out of memory
free -h
# Add swap if needed

# 3. Docker daemon not running
sudo systemctl status docker
sudo systemctl start docker
```

### 10.2. Vault Sealed

```bash
# Check status
vault status

# If sealed, unseal
vault operator unseal <KEY1>
vault operator unseal <KEY2>
vault operator unseal <KEY3>

# Or use dev token
export VAULT_TOKEN="myroot"
```

### 10.3. Database Errors

```bash
# Check Postgres
docker compose logs postgres

# Connect to database
docker compose exec postgres psql -U keycloak

# Check tables
\dt

# Recreate database (WARNING: deletes data)
docker compose down -v
docker compose up -d
```

### 10.4. Cannot Generate WireGuard Config

```bash
# Check backend logs
docker compose logs backend

# Check Vault connection
curl http://localhost:8200/v1/sys/health

# Check WireGuard container
docker compose logs wireguard
sudo wg show
```

### 10.5. Reset Everything

```bash
# Stop and remove all containers + volumes
sudo docker compose down -v

# Remove all Docker images
docker system prune -a --volumes

# Redeploy
sudo ./deploy.sh
```

---

## 11. Maintenance

### 11.1. View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend

# Since timestamp
docker compose logs --since 2024-01-01 backend
```

### 11.2. Update Services

```bash
# Pull latest images
docker compose pull

# Recreate containers
docker compose up -d --force-recreate

# Or rebuild custom images
docker compose build --no-cache
docker compose up -d
```

### 11.3. Backup Data

```bash
# Backup Postgres
docker compose exec postgres pg_dump -U keycloak keycloak > backup.sql

# Backup Vault (export secrets)
vault kv list secret/wireguard
vault kv get -format=json secret/wireguard/users > vault-backup.json

# Backup .env
cp .env .env.backup
```

### 11.4. Restore Data

```bash
# Restore Postgres
docker compose exec -T postgres psql -U keycloak keycloak < backup.sql

# Restore Vault
vault kv put secret/wireguard/users @vault-backup.json

# Restore .env
cp .env.backup .env
```

### 11.5. Monitor Resources

```bash
# Check container stats
docker stats

# Check disk usage
docker system df

# Check logs size
du -sh /var/lib/docker/containers/*
```

### 11.6. Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove all stopped containers
docker container prune

# Full cleanup
docker system prune -a --volumes
```

---

## 12. Security Best Practices

### 12.1. Change Default Passwords

```bash
# Keycloak admin password
# Edit docker-compose.yml:
KEYCLOAK_ADMIN_PASSWORD: "YOUR_STRONG_PASSWORD"

# Vault root token
# Don't use "myroot" in production
# Use vault operator init to generate secure token

# Database passwords
POSTGRES_PASSWORD: "YOUR_DB_PASSWORD"
```

### 12.2. Enable HTTPS

```bash
# Install Nginx
sudo apt install nginx

# Get SSL certificate (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/zero-trust
```

Example Nginx config:
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:5000;
    }
}
```

### 12.3. Restrict IP Access

```bash
# Allow only specific IPs
sudo ufw delete allow 3000/tcp
sudo ufw allow from 192.168.1.0/24 to any port 3000

# Or use Nginx
# Add to server block:
allow 192.168.1.0/24;
deny all;
```

### 12.4. Enable Audit Logs

```bash
# Vault audit logs
vault audit enable file file_path=/vault/logs/audit.log

# View logs
docker compose exec vault cat /vault/logs/audit.log
```

### 12.5. Regular Updates

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker compose pull
docker compose up -d

# Check for security updates
sudo unattended-upgrades --dry-run
```

---

## 13. Next Steps

Sau khi setup thành công:

1. ✅ **Test toàn bộ flow:** Login → TOTP → VPN config → Connect
2. ✅ **Add users:** Keycloak admin console → Users → Create
3. ✅ **Configure policies:** Vault → Policies → Create custom
4. ✅ **Setup monitoring:** Grafana, Prometheus, ELK stack
5. ✅ **Enable HTTPS:** Let's Encrypt + Nginx reverse proxy
6. ✅ **Backup data:** Schedule automatic backups
7. ✅ **Document:** Create runbook cho operations team

---

## 14. Additional Resources

- **WireGuard:** https://www.wireguard.com/
- **Vault Documentation:** https://www.vaultproject.io/docs
- **Keycloak Documentation:** https://www.keycloak.org/documentation
- **Docker Compose:** https://docs.docker.com/compose/
- **Ubuntu Server Guide:** https://ubuntu.com/server/docs

---

## 15. Support

Nếu gặp vấn đề:

1. **Check logs:** `docker compose logs -f`
2. **Check status:** `docker compose ps`
3. **Check this guide:** Search for error message
4. **GitHub Issues:** Open issue with logs + error details

---

<div align="center">

**🎉 Chúc mừng! Bạn đã setup thành công Zero-Trust VPN Infrastructure! 🎉**

Next: Test remote access và add users

</div>
