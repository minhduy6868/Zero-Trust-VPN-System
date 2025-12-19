# 🧪 VPN CONFIG TEST - Hướng Dẫn Demo & Test

> Hướng dẫn chi tiết cách test và demo VPN config với role-based access control

---

## 📋 Mục Lục

1. [Giới Thiệu](#giới-thiệu)
2. [Chuẩn Bị](#chuẩn-bị)
3. [Cách Lấy VPN Config](#cách-lấy-vpn-config)
4. [Chạy Demo Test](#chạy-demo-test)
5. [Hiểu Kết Quả](#hiểu-kết-quả)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Giới Thiệu

### Demo Này Chứng Minh Gì?

Zero Trust VPN phân quyền truy cập mạng theo **role cụ thể**:

| Role | AllowedIPs | Truy Cập Được |
|------|------------|---------------|
| **Nhân Viên** | `10.0.0.0/24` | ✅ 10.0.0.50 (Basic Server) |
| **Quản Lý** | `10.0.0.0/16, 10.1.0.0/16` | ✅ 10.0.0.50 + 10.1.0.50 (Basic + Manager) |
| **Giám Đốc** | `10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16` | ✅ Tất cả servers (Full Access) |

**So với VPN truyền thống:** Tất cả đều có full access → **RỦI RO BẢO MẬT**

---

## 🛠️ Chuẩn Bị

### 1. Kiểm Tra WireGuard Đã Cài
```bash
wg --version
```

**Nếu chưa có:**
```bash
sudo apt update
sudo apt install wireguard wireguard-tools -y
```

### 2. Kiểm Tra Docker
```bash
docker --version
docker compose ps
```

**Hệ thống phải đang chạy:**
```bash
bash START-LOCAL.sh
```

### 3. Kiểm Tra Script
```bash
ls -lh test-one-config.sh
# Should show: -rwxr-xr-x ... test-one-config.sh
```

---

## 📥 Cách Lấy VPN Config

### Bước 1: Đăng Nhập Vào Web
```bash
# Mở browser
http://192.168.1.9:3000   # (thay IP của bạn)
```

### Bước 2: Login với User
Chọn 1 trong 3 accounts:

| Email | Password | Role |
|-------|----------|------|
| zerotrust@gmail.com | password123 | 🔴 Giám Đốc |
| tham1@gmail.com | password123 | 🟡 Quản Lý |
| duy1@gmail.com | password123 | 🟢 Nhân Viên |

### Bước 3: Setup TOTP (nếu lần đầu)
1. Quét QR code với Google Authenticator/Authy
2. Nhập 6-digit code
3. Click "Verify & Continue"

### Bước 4: Download VPN Config
1. Vào **VPN Dashboard**
2. Click nút **"Download VPN Config"**
3. File tải về: `vpn-zerotrust.conf` (hoặc tên tương tự)
4. Lưu vào `~/Downloads/`

### Bước 5: Lặp Lại Cho Các User Khác (Optional)
Nếu muốn test đầy đủ cả 3 roles, logout và login lại với các users khác.

---

## 🚀 Chạy Demo Test

### Cách 1: Truyền Đường Dẫn File Trực Tiếp
```bash
sudo bash test-one-config.sh ~/Downloads/vpn-zerotrust.conf
```

### Cách 2: Paste Đường Dẫn Khi Script Hỏi
```bash
sudo bash test-one-config.sh
# Script sẽ hỏi: 📁 Nhập đường dẫn file VPN config:
# → Paste: /home/md002/Downloads/vpn-zerotrust.conf
```

### Cách 3: Dùng Tab Autocomplete
```bash
sudo bash test-one-config.sh ~/Downloads/vpn-<Tab>
# Tab sẽ tự complete file name
```

---

## 📊 Hiểu Kết Quả Demo

### Script Sẽ Làm Gì?

1. **📄 Hiển thị VPN Config**
   - Đọc file .conf
   - Extract thông tin: User, Role, AllowedIPs

2. **🖥️ Tạo 3 SSH Test Servers**
   ```
   10.0.0.50   - Basic Server (Employee level)
   10.1.0.50   - Manager Server (Manager level)
   172.16.0.50 - Admin Server (Director level)
   ```

3. **🔐 Kết Nối VPN**
   - Apply config của role đang test
   - Show VPN interface status
   - Show routes

4. **🧪 Test SSH Access**
   - Ping từng server
   - Check SSH port 2222
   - Hiển thị ✅ (OK) hoặc ❌ (Blocked)

5. **📊 So Sánh Kết Quả**
   - Bảng so sánh 3 roles
   - Giải thích AllowedIPs
   - Kết luận Zero Trust benefits

---

## 📸 Kết Quả Mẫu

### Role: NHÂN VIÊN (Employee)
```
🧪 TEST SSH ACCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Role: NHAN_VIEN (Nhân Viên)
AllowedIPs: 10.0.0.0/24

1️⃣  Ping 10.0.0.50 (Basic Server): ✅ OK
    SSH Port 2222: ✅ CÓ THỂ KẾT NỐI

2️⃣  Ping 10.1.0.50 (Manager Server): ❌ KHÔNG PING ĐƯỢC

3️⃣  Ping 172.16.0.50 (Admin Server): ❌ KHÔNG PING ĐƯỢC

📊 KẾT LUẬN: Nhân viên chỉ truy cập 1/3 servers
```

### Role: QUẢN LÝ (Manager)
```
1️⃣  Ping 10.0.0.50 (Basic Server): ✅ OK
2️⃣  Ping 10.1.0.50 (Manager Server): ✅ OK
3️⃣  Ping 172.16.0.50 (Admin Server): ❌ KHÔNG PING ĐƯỢC

📊 KẾT LUẬN: Quản lý truy cập 2/3 servers
```

### Role: GIÁM ĐỐC (Director)
```
1️⃣  Ping 10.0.0.50 (Basic Server): ✅ OK
2️⃣  Ping 10.1.0.50 (Manager Server): ✅ OK
3️⃣  Ping 172.16.0.50 (Admin Server): ✅ OK

📊 KẾT LUẬN: Giám đốc có Full Access!
```

---

## 📋 Bảng So Sánh Chi Tiết

### Access Matrix
```
┌─────────────┬──────────────┬──────────────┬──────────────┐
│    ROLE     │  10.0.0.50   │  10.1.0.50   │ 172.16.0.50  │
├─────────────┼──────────────┼──────────────┼──────────────┤
│ Nhân Viên   │      ✅      │      ❌      │      ❌      │
│ Quản Lý     │      ✅      │      ✅      │      ❌      │
│ Giám Đốc    │      ✅      │      ✅      │      ✅      │
└─────────────┴──────────────┴──────────────┴──────────────┘
```

### Giải Thích AllowedIPs

**Nhân Viên: `10.0.0.0/24`**
- Chỉ truy cập 10.0.0.1 → 10.0.0.254 (256 IPs)
- Đủ cho công việc cơ bản
- Bị chặn khỏi mạng quản lý & admin

**Quản Lý: `10.0.0.0/16, 10.1.0.0/16`**
- Truy cập 10.0.x.x + 10.1.x.x (128K IPs)
- Quản lý được nhân viên + resources
- Vẫn bị chặn khỏi admin network

**Giám Đốc: `10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16`**
- Truy cập 16M+ IPs (toàn bộ private networks)
- Full access tất cả resources
- Phù hợp vai trò cao nhất

---

## 🔍 Troubleshooting

### ❌ Script Báo "File không tồn tại"

**Kiểm tra:**
```bash
ls -lh ~/Downloads/vpn-*.conf
```

**Fix:** Đảm bảo đã download file từ web interface.

---

### ❌ "Permission denied" khi chạy script

**Cần chạy với sudo:**
```bash
sudo bash test-one-config.sh <file>
```

**Lý do:** WireGuard cần root permission để tạo interface.

---

### ❌ "Cannot connect to VPN"

**Check 1: Backend đang chạy?**
```bash
docker compose ps backend
# Should show "Up (healthy)"
```

**Check 2: Port 51820 mở?**
```bash
sudo netstat -nlup | grep 51820
```

**Check 3: WireGuard kernel module?**
```bash
sudo modprobe wireguard
lsmod | grep wireguard
```

---

### ❌ VPN Connected nhưng không ping được

**Check routes:**
```bash
ip route | grep wg0
```

**Should see:**
```
10.0.0.0/8 dev wg0 scope link
172.16.0.0/12 dev wg0 scope link
192.168.0.0/16 dev wg0 scope link
```

**Check firewall:**
```bash
sudo iptables -L -v -n
```

---

### ❌ SSH Port 2222 không mở

**Đợi servers khởi động thêm:**
```bash
# Script đã đợi 10s, nhưng có thể cần thêm
docker ps | grep ssh
# Check các container ssh-basic, ssh-manager, ssh-admin
```

**Check logs:**
```bash
docker logs ssh-basic
docker logs ssh-manager
docker logs ssh-admin
```

---

### ⚠️ VPN Interface wg0 already exists

**Ngắt VPN cũ:**
```bash
sudo wg-quick down wg0
```

**Script tự động làm điều này, nhưng nếu crash có thể bị stuck.**

---

## 🎯 Tips & Best Practices

### 1. Test Theo Thứ Tự
```bash
# Test từ role thấp đến cao
1. Nhân Viên (10.0.0.0/24)     → Thấy 1/3 servers
2. Quản Lý (10.0.0.0/16, ...)  → Thấy 2/3 servers
3. Giám Đốc (full access)      → Thấy 3/3 servers
```

### 2. Screenshot Cho Báo Cáo
```bash
# Chụp màn hình các phần:
- VPN config file (AllowedIPs)
- Test results (✅/❌ matrix)
- Comparison table
- Routes (ip route | grep wg0)
```

### 3. Cleanup Sau Test
```bash
# Script tự cleanup, nhưng nếu cancel giữa chừng:
sudo wg-quick down wg0
docker rm -f ssh-basic ssh-manager ssh-admin
docker network rm zt-test-basic zt-test-manager zt-test-admin
```

### 4. Chạy Multiple Tests
```bash
# Test role 1
sudo bash test-one-config.sh ~/Downloads/vpn-nhanvien.conf

# Đợi cleanup xong, test role 2
sudo bash test-one-config.sh ~/Downloads/vpn-quanly.conf
```

---

## 📹 Demo Flow Cho Thesis Defense

### Preparation (5 phút trước)
1. Start system: `bash START-LOCAL.sh`
2. Có sẵn 3 VPN configs (3 roles)
3. Terminal sẵn sàng với command prepared

### Demo Script (10 phút)
```bash
# 1. Giới thiệu vấn đề (1 phút)
"VPN truyền thống: Ai vào cũng có full access → Risk!"

# 2. Show VPN configs (2 phút)
"Zero Trust VPN: Mỗi role có AllowedIPs khác nhau"
cat ~/Downloads/vpn-nhanvien.conf | grep AllowedIPs
cat ~/Downloads/vpn-quanly.conf | grep AllowedIPs
cat ~/Downloads/vpn-giamdoc.conf | grep AllowedIPs

# 3. Live test Nhân Viên (3 phút)
sudo bash test-one-config.sh ~/Downloads/vpn-nhanvien.conf
# Point out: Chỉ vào được 1 server

# 4. Live test Giám Đốc (3 phút)
sudo bash test-one-config.sh ~/Downloads/vpn-giamdoc.conf
# Point out: Vào được cả 3 servers

# 5. Kết luận (1 phút)
"Principle of Least Privilege → Giảm thiểu damage khi compromise"
```

---

## 🎓 Giải Thích Cho Hội Đồng

### Zero Trust Principles Demonstrated

1. **Verify Explicitly**
   - TOTP/MFA required trước khi download config
   - Mỗi request được authenticate

2. **Least Privilege Access**
   - Nhân viên chỉ truy cập resources cần thiết
   - Không ai có quyền hơn mức cần

3. **Assume Breach**
   - Nếu 1 account bị hack, damage bị giới hạn
   - VPN key của nhân viên không thể access admin network

### So Sánh VPN Truyền Thống

| Aspect | Traditional VPN | Zero Trust VPN |
|--------|----------------|----------------|
| Access Model | All-or-Nothing | Role-Based Granular |
| Compromise Impact | 🔴 Full Network | 🟢 Limited to Role |
| Principle | Perimeter Security | Identity-Based |
| Example | 1 key → All servers | 1 key → Specific subnets |

---

## 🔗 References

- **WireGuard Docs:** https://www.wireguard.com/
- **Zero Trust Model:** NIST SP 800-207
- **Test Script:** [test-one-config.sh](test-one-config.sh)

---

**💡 Có thắc mắc?** Check [SETUP.md](SETUP.md) hoặc [README.md](README.md)

---

**🎯 Mục tiêu:** Chứng minh Zero Trust VPN phân quyền chính xác, giảm thiểu rủi ro bảo mật!
