# 🛠️ SETUP - Hướng Dẫn Cài Đặt & Chạy Hệ Thống

## 📋 Mục Lục
1. [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
2. [Cài Đặt Lần Đầu](#cài-đặt-lần-đầu)
3. [Các Lệnh Chạy Hệ Thống](#các-lệnh-chạy-hệ-thống)
4. [Docker Commands](#docker-commands)
5. [Troubleshooting](#troubleshooting)

---

## 🖥️ Yêu Cầu Hệ Thống

### Phần Mềm Cần Thiết
- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **WireGuard** (cho VPN testing)
- **Git**

### Kiểm Tra Đã Cài Đặt
```bash
docker --version
docker compose version
wg --version
```

---

## 🚀 Cài Đặt Lần Đầu

### 1. Clone Repository
```bash
cd ~/Documents
git clone <your-repo-url> Zero-Trust-VPN-System
cd Zero-Trust-VPN-System
```

### 2. Cài Docker (nếu chưa có)
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Cài WireGuard (nếu cần test VPN)
```bash
sudo apt update
sudo apt install wireguard wireguard-tools -y
```

### 4. Build & Start Services Lần Đầu
```bash
# Build images
docker compose build

# Start all services
docker compose up -d

# Check status
docker compose ps
```

---

## ⚡ Các Lệnh Chạy Hệ Thống

### 🏠 Chạy Mode LOCAL (Mạng LAN)
```bash
bash START-LOCAL.sh
```
**Kết quả:**
- Frontend: http://192.168.1.x:3000
- Backend API: http://192.168.1.x:5000
- Keycloak Admin: http://192.168.1.x:8080/admin
- Thời gian: ~20-30 giây

### 🌐 Chạy Mode REMOTE (Public Internet)
```bash
bash START-REMOTE.sh
```
**Yêu cầu:** Đã cài [Ngrok](https://ngrok.com/download)

**Kết quả:**
- Public URL: https://xxxx.ngrok-free.app
- URL tự động mở trong browser
- Thời gian: ~30-40 giây

### 🔄 Deploy Production Build
```bash
bash DEPLOY.sh
```
**Làm gì:**
- Build production images mới
- Restart với zero downtime
- Clear caches

---

## 🐳 Docker Commands

### Quản Lý Services

#### Xem Status
```bash
docker compose ps
```

#### Xem Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f keycloak
```

#### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific
docker compose restart backend
docker compose restart frontend
```

#### Stop/Start
```bash
# Stop all
docker compose stop

# Start all
docker compose start

# Stop and remove containers
docker compose down

# Down và xóa volumes (careful!)
docker compose down -v
```

### Rebuild Khi Sửa Code

#### Rebuild Backend
```bash
docker compose build backend
docker compose restart backend

# Or in one command
docker compose up -d --build backend
```

#### Rebuild Frontend
```bash
docker compose build frontend
docker compose restart frontend

# Or in one command
docker compose up -d --build frontend
```

#### Rebuild All
```bash
docker compose build
docker compose up -d
```

### Shell Access

#### Backend Shell
```bash
docker compose exec backend bash

# Run Python script
docker compose exec backend python3 -c "print('Hello')"
```

#### Database Access
```bash
docker compose exec postgres psql -U keycloak
```

#### Redis CLI
```bash
docker compose exec redis redis-cli
```

---

## 🔧 Khi Thay Đổi Files

### 1. Sửa Code Python (Backend)
```bash
# Restart để load code mới (nếu có volume mount)
docker compose restart backend

# Hoặc rebuild nếu thay đổi dependencies
docker compose build backend
docker compose restart backend
```

### 2. Sửa Code React (Frontend)
```bash
# Development: tự động reload (nếu có hot-reload)
# Production: cần rebuild
docker compose build frontend
docker compose restart frontend
```

### 3. Sửa File JSON (mock-data/)
```bash
# Chỉ cần restart, không cần rebuild
docker compose restart backend
```

### 4. Sửa Docker Compose Config
```bash
# Áp dụng thay đổi
docker compose up -d
```

### 5. Sửa Requirements/Dependencies
```bash
# Backend
docker compose build backend --no-cache
docker compose restart backend

# Frontend
docker compose build frontend --no-cache
docker compose restart frontend
```

---

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Kiểm tra port nào đang dùng
sudo lsof -i :3000
sudo lsof -i :5000
sudo lsof -i :8080

# Kill process
sudo kill -9 <PID>
```

### Cannot Connect to Docker
```bash
# Restart Docker daemon
sudo systemctl restart docker

# Check Docker status
sudo systemctl status docker
```

### Services Not Starting
```bash
# Check logs
docker compose logs

# Remove and recreate
docker compose down
docker compose up -d
```

### Clear Everything and Start Fresh
```bash
# WARNING: Xóa tất cả containers, networks, volumes
docker compose down -v
docker system prune -a
docker volume prune

# Start lại
docker compose up -d
```

### Keycloak Not Initializing
```bash
# Check if postgres is ready
docker compose logs postgres

# Restart keycloak
docker compose restart keycloak

# Check init script
docker compose logs keycloak | grep -i "init"
```

### Backend Can't Connect to Vault
```bash
# Check Vault status
docker compose exec vault vault status

# Restart vault
docker compose restart vault

# Check vault logs
docker compose logs vault
```

---

## 📊 Health Checks

### Check All Services
```bash
# Docker health
docker compose ps

# Manual checks
curl http://localhost:5000/health
curl http://localhost:3000
curl http://localhost:8080
```

### Check Keycloak
```bash
# Admin console
open http://localhost:8080/admin

# Credentials: admin / admin123
```

### Check Backend API
```bash
# Health endpoint
curl http://localhost:5000/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"zerotrust@gmail.com","password":"password123"}'
```

---

## 🔐 Admin Access

### Keycloak Admin Console
```bash
URL: http://localhost:8080/admin
Username: admin
Password: admin123
```

### Vault UI (if enabled)
```bash
URL: http://localhost:8200
Token: Check vault logs or init script
```

### PostgreSQL Database
```bash
docker compose exec postgres psql -U keycloak

# List databases
\l

# Connect to keycloak DB
\c keycloak

# List tables
\dt
```

---

## 📝 Quick Reference

### Start System
```bash
bash START-LOCAL.sh          # LAN only
bash START-REMOTE.sh         # Public access
```

### View Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Restart After Code Change
```bash
docker compose restart backend    # Python changes
docker compose restart frontend   # React changes (prod)
```

### Full Rebuild
```bash
bash DEPLOY.sh                    # Production deploy
docker compose build --no-cache   # Force rebuild all
```

### Stop System
```bash
docker compose stop              # Stop (can restart)
docker compose down             # Stop + remove containers
```

---

## 🆘 Need Help?

1. **Check logs first:** `docker compose logs -f`
2. **Restart service:** `docker compose restart <service>`
3. **Full restart:** `docker compose down && docker compose up -d`
4. **Nuclear option:** Clear everything and rebuild

---

**💡 Tip:** Bookmark file này để tra cứu nhanh các lệnh!
