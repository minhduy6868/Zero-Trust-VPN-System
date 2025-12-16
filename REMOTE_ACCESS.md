# 🌐 Hướng Dẫn Truy Cập Từ Xa (Remote Access)

## Tổng Quan

Sau khi deploy trên Ubuntu server, bạn có thể truy cập hệ thống từ bất kỳ máy tính nào trong mạng (hoặc qua internet nếu có public IP).

---

## 🚀 Setup Remote Access

### Bước 1: Configure Server IP

Trên Ubuntu server, chạy script để detect và configure IP:

```bash
cd ~/projects/linux_zero_trust
sudo chmod +x scripts/configure-remote.sh
sudo ./scripts/configure-remote.sh
```

Script này sẽ:
- ✅ Tự động detect IP của server
- ✅ Tạo file `.env` với cấu hình
- ✅ Mở firewall ports (nếu có UFW)
- ✅ Hiển thị URLs để truy cập

**Output mẫu:**
```
✓ Detected IP: 192.168.1.100

📋 Remote Access URLs:
Frontend:       http://192.168.1.100:3000
Backend API:    http://192.168.1.100:5000
Keycloak Admin: http://192.168.1.100:8080
Vault UI:       http://192.168.1.100:8200
```

### Bước 2: Start Services với Remote Access

```bash
# Stop current services
sudo docker compose down

# Start with remote access config
sudo docker compose up -d

# Wait for services to start
sleep 60

# Initialize services
sudo ./scripts/init-vault.sh
sudo ./scripts/init-keycloak.sh
```

**Hoặc chạy tự động:**
```bash
sudo ./deploy.sh
```

---

## 💻 Truy Cập Từ Client (Máy Khác)

### Từ Máy Windows/Mac/Linux Khác:

1. **Kiểm tra kết nối mạng:**
   ```bash
   # Ping server để check connection
   ping 192.168.1.100
   ```

2. **Mở browser và truy cập:**
   ```
   http://192.168.1.100:3000
   ```

3. **Login:**
   - Email: `john@company.com`
   - Password: `password123`

4. **Setup TOTP:**
   - Scan QR code với Google Authenticator
   - Nhập 6-digit code

5. **Download WireGuard Config:**
   - Click "Generate WireGuard Config"
   - Download file `company-vpn.conf`

6. **Connect VPN:**
   - Import config vào WireGuard client
   - Activate connection
   - Connected! ✓

---

## 🔥 Firewall Configuration

### Ubuntu UFW (Uncomplicated Firewall)

Nếu server có firewall, cần mở các ports:

```bash
# Check firewall status
sudo ufw status

# Enable firewall (nếu chưa enable)
sudo ufw enable

# Open required ports
sudo ufw allow 3000/tcp comment "Zero-Trust Frontend"
sudo ufw allow 5000/tcp comment "Zero-Trust Backend"
sudo ufw allow 8080/tcp comment "Zero-Trust Keycloak"
sudo ufw allow 8200/tcp comment "Zero-Trust Vault"
sudo ufw allow 51820/udp comment "Zero-Trust WireGuard"

# Reload firewall
sudo ufw reload

# Check rules
sudo ufw status numbered
```

### Cloud Provider (AWS/Azure/GCP)

Nếu chạy trên cloud, cần configure Security Group/Network Security Group:

**Inbound Rules:**
| Protocol | Port | Source | Description |
|----------|------|--------|-------------|
| TCP | 3000 | 0.0.0.0/0 | Frontend |
| TCP | 5000 | 0.0.0.0/0 | Backend API |
| TCP | 8080 | 0.0.0.0/0 | Keycloak |
| TCP | 8200 | 0.0.0.0/0 | Vault |
| UDP | 51820 | 0.0.0.0/0 | WireGuard |
| TCP | 22 | Your-IP | SSH (for admin) |

⚠️ **Security Note:** Trong production, nên giới hạn source IP thay vì `0.0.0.0/0`

---

## 🌍 Scenarios

### Scenario 1: Same LAN (Cùng mạng nội bộ)

**Server:** Ubuntu tại nhà/công ty (IP: 192.168.1.100)  
**Client:** Laptop cùng WiFi (IP: 192.168.1.50)

```bash
# Client truy cập:
http://192.168.1.100:3000
```

✅ **Works!** - Không cần configure gì thêm

---

### Scenario 2: Different Network (Khác mạng)

**Server:** Ubuntu tại công ty (Private IP: 192.168.1.100)  
**Client:** Laptop tại nhà (Different network)

**Option A: VPN vào mạng công ty**
```bash
# Connect VPN vào mạng công ty trước
# Sau đó truy cập internal IP
http://192.168.1.100:3000
```

**Option B: Port Forwarding (Router)**
```
Router config:
External Port 3000 → Forward to → 192.168.1.100:3000
External Port 5000 → Forward to → 192.168.1.100:5000
External Port 8080 → Forward to → 192.168.1.100:8080

Client truy cập:
http://<router-public-ip>:3000
```

**Option C: Public IP (Cloud Server)**
```bash
# Nếu server có public IP (AWS/Azure/GCP)
http://<public-ip>:3000
```

---

### Scenario 3: Internet Access (Public)

**Requirements:**
1. Server có public IP hoặc domain
2. Firewall mở ports
3. SSL certificate (recommended)

**Setup:**
```bash
# 1. Get public IP
curl ifconfig.me

# 2. Update .env
SERVER_IP=<public-ip>

# 3. Restart services
sudo docker compose down
sudo docker compose up -d

# 4. Access from anywhere
http://<public-ip>:3000
```

---

## 🔒 Security Best Practices

### 1. Use HTTPS (Recommended)

```bash
# Install Nginx reverse proxy với SSL
sudo apt install nginx certbot python3-certbot-nginx

# Get SSL certificate (requires domain)
sudo certbot --nginx -d your-domain.com

# Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/zero-trust-vpn
```

**Nginx config:**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. Restrict IP Access

```bash
# Only allow specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw allow from 192.168.1.0/24 to any port 5000
```

### 3. Use Strong Passwords

```bash
# Change default passwords in .env
KEYCLOAK_ADMIN_PASSWORD=<strong-password>
POSTGRES_PASSWORD=<strong-password>
```

### 4. Enable Rate Limiting

Thêm vào backend `app.py`:
```python
from flask_limiter import Limiter

limiter = Limiter(
    app,
    key_func=lambda: request.remote_addr,
    default_limits=["100 per minute"]
)
```

---

## 🧪 Testing Remote Access

### Test 1: Network Connectivity
```bash
# From client machine
ping <server-ip>
telnet <server-ip> 3000
curl http://<server-ip>:5000/api/health
```

### Test 2: Service Availability
```bash
# Frontend
curl -I http://<server-ip>:3000

# Backend API
curl http://<server-ip>:5000/api/health

# Keycloak
curl http://<server-ip>:8080/health/ready

# Vault
curl http://<server-ip>:8200/v1/sys/health
```

### Test 3: Full Flow
1. Open browser: `http://<server-ip>:3000`
2. Login with test account
3. Setup TOTP
4. Download VPN config
5. Connect WireGuard
6. Ping VPN gateway: `ping 10.0.0.1`

---

## ⚠️ Troubleshooting

### Issue 1: Cannot Access from Client

**Check 1: Network connectivity**
```bash
ping <server-ip>
```

**Check 2: Firewall**
```bash
# On server
sudo ufw status
sudo ufw allow 3000/tcp
```

**Check 3: Docker ports binding**
```bash
# Check if listening on 0.0.0.0
sudo netstat -tulpn | grep -E '(3000|5000|8080)'
```

Should see:
```
tcp  0.0.0.0:3000  0.0.0.0:*  LISTEN
tcp  0.0.0.0:5000  0.0.0.0:*  LISTEN
tcp  0.0.0.0:8080  0.0.0.0:*  LISTEN
```

### Issue 2: CORS Errors

**Solution:** Update backend CORS config
```python
# servers/backend/app.py
CORS(app, origins=[
    f"http://{os.getenv('SERVER_IP')}:3000",
    "http://localhost:3000"
])
```

### Issue 3: Keycloak Redirect Issues

**Solution:** Reinitialize Keycloak with correct redirects
```bash
sudo ./scripts/init-keycloak.sh
```

---

## 📱 Mobile Access

### Android/iOS Browser

```
1. Connect to same WiFi as server
2. Open browser: http://<server-ip>:3000
3. Login and setup TOTP
4. Download WireGuard config
5. Install WireGuard app
6. Import config from Downloads
7. Activate connection
```

### WireGuard Mobile Apps

**Android:** https://play.google.com/store/apps/details?id=com.wireguard.android  
**iOS:** https://apps.apple.com/app/wireguard/id1441195209

---

## 📊 Network Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT MACHINES                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Windows    │  │   MacBook   │  │  Android    │       │
│  │  Desktop    │  │   Laptop    │  │   Phone     │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                 │                 │              │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
          │    Browser: http://<server-ip>:3000
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              UBUNTU SERVER (192.168.1.100)                  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Frontend  │  │ Backend  │  │Keycloak  │  │WireGuard │  │
│  │Port 3000 │  │Port 5000 │  │Port 8080 │  │Port51820 │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Quick Reference

### Server Side (Ubuntu)
```bash
# Configure remote access
sudo ./scripts/configure-remote.sh

# Start services
sudo docker compose up -d

# Initialize
sudo ./scripts/init-vault.sh
sudo ./scripts/init-keycloak.sh

# Check status
sudo ./scripts/status.sh

# View logs
docker compose logs -f
```

### Client Side (Any Machine)
```bash
# Test connectivity
ping <server-ip>

# Access web UI
Open: http://<server-ip>:3000

# Login credentials
john@company.com / password123
```

---

## 🎯 Summary

✅ **Server IP Configuration:** `./scripts/configure-remote.sh`  
✅ **Firewall Ports:** 3000, 5000, 8080, 8200, 51820  
✅ **Client Access:** `http://<server-ip>:3000`  
✅ **Security:** HTTPS, IP restrictions, strong passwords  
✅ **Testing:** Ping, curl, browser access  

**Bây giờ client từ bất kỳ đâu cũng có thể truy cập hệ thống! 🚀**
