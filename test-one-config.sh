#!/bin/bash
###############################################################################
# DEMO SSH - TEST VPN CONFIG
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║      🔐 DEMO SSH - TEST VPN CONFIG                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Cần chạy với sudo${NC}"
    echo "Chạy: sudo bash $0 <đường-dẫn-file-config>"
    echo "Ví dụ: sudo bash $0 /home/md002/Downloads/vpn-zerotrust.conf"
    exit 1
fi

# Get config file path
if [ -z "$1" ]; then
    echo -e "${YELLOW}📁 Nhập đường dẫn file VPN config:${NC}"
    read -e -p "   → " CONFIG
    
    # Expand tilde if present
    CONFIG="${CONFIG/#\~/$HOME}"
    
    if [ -z "$CONFIG" ]; then
        echo -e "${RED}❌ Bạn chưa nhập đường dẫn${NC}"
        exit 1
    fi
else
    CONFIG="$1"
fi

# Validate file exists
if [ ! -f "$CONFIG" ]; then
    echo -e "${RED}❌ File không tồn tại: $CONFIG${NC}"
    echo ""
    echo "Gợi ý: Kiểm tra đường dẫn hoặc dùng tab để autocomplete"
    exit 1
fi

echo -e "${GREEN}✅ File hợp lệ: $(basename "$CONFIG")${NC}"
echo ""
echo -e "${BLUE}📄 VPN Config File:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$CONFIG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extract info
ALLOWED=$(grep "^AllowedIPs" "$CONFIG" | cut -d'=' -f2 | xargs)
ROLE=$(grep "# Role:" "$CONFIG" | cut -d':' -f2 | xargs)
ACCESS=$(grep "# Access Level:" "$CONFIG" | cut -d':' -f2 | xargs)
USERNAME=$(grep "# User:" "$CONFIG" | cut -d':' -f2 | xargs)

# Auto-detect role from AllowedIPs if not in comments
if [ -z "$ROLE" ]; then
    if [[ "$ALLOWED" == *"10.0.0.0/8"* ]]; then
        ROLE="GIAM_DOC (Giám Đốc)"
        ACCESS="Full Network Access"
    elif [[ "$ALLOWED" == *"10.0.0.0/16"* ]]; then
        ROLE="QUAN_LY (Quản Lý)"
        ACCESS="Manager Level Access"
    elif [[ "$ALLOWED" == *"10.0.0.0/24"* ]]; then
        ROLE="NHAN_VIEN (Nhân Viên)"
        ACCESS="Basic Access"
    else
        ROLE="UNKNOWN"
        ACCESS="Custom"
    fi
fi

echo -e "${GREEN}📊 THÔNG TIN VPN:${NC}"
echo "  File:         $(basename "$CONFIG")"
[ -n "$USERNAME" ] && echo "  User:         $USERNAME"
echo "  Role:         $ROLE"
echo "  Access Level: $ACCESS"
echo "  AllowedIPs:   $ALLOWED"
echo ""

read -p "Press Enter để tạo test servers và kết nối VPN..."

# Stop old VPN
wg-quick down wg0 2>/dev/null || true

echo ""
echo -e "${BLUE}🌐 Tạo Docker networks...${NC}"
docker network rm zt-test-basic zt-test-manager zt-test-admin 2>/dev/null || true
docker network create --subnet=10.0.0.0/24 zt-test-basic
docker network create --subnet=10.1.0.0/24 zt-test-manager  
docker network create --subnet=172.16.0.0/24 zt-test-admin

echo -e "${BLUE}🖥️  Tạo 3 SSH servers...${NC}"
docker rm -f ssh-basic ssh-manager ssh-admin 2>/dev/null || true

# Basic Server (10.0.0.50)
docker run -d --name ssh-basic \
    --network zt-test-basic \
    --ip 10.0.0.50 \
    -e PUID=1000 -e PGID=1000 \
    -e TZ=Asia/Ho_Chi_Minh \
    -e PASSWORD_ACCESS=true \
    -e USER_PASSWORD=password123 \
    -e USER_NAME=testuser \
    lscr.io/linuxserver/openssh-server:latest >/dev/null 2>&1

# Manager Server (10.1.0.50)
docker run -d --name ssh-manager \
    --network zt-test-manager \
    --ip 10.1.0.50 \
    -e PUID=1000 -e PGID=1000 \
    -e TZ=Asia/Ho_Chi_Minh \
    -e PASSWORD_ACCESS=true \
    -e USER_PASSWORD=password123 \
    -e USER_NAME=testuser \
    lscr.io/linuxserver/openssh-server:latest >/dev/null 2>&1

# Admin Server (172.16.0.50)
docker run -d --name ssh-admin \
    --network zt-test-admin \
    --ip 172.16.0.50 \
    -e PUID=1000 -e PGID=1000 \
    -e TZ=Asia/Ho_Chi_Minh \
    -e PASSWORD_ACCESS=true \
    -e USER_PASSWORD=password123 \
    -e USER_NAME=testuser \
    lscr.io/linuxserver/openssh-server:latest >/dev/null 2>&1

echo -e "${GREEN}✅ Servers đã tạo${NC}"
echo ""
echo "📊 SSH SERVERS:"
echo "  • 10.0.0.50   - Basic Server (port 2222)"
echo "  • 10.1.0.50   - Manager Server (port 2222)"
echo "  • 172.16.0.50 - Admin Server (port 2222)"
echo ""
echo "Đang đợi servers khởi động (10s)..."
sleep 10

# Connect VPN
echo ""
echo -e "${BLUE}🔄 Kết nối VPN...${NC}"
cp "$CONFIG" /etc/wireguard/wg0.conf
chmod 600 /etc/wireguard/wg0.conf

echo "Debug: Checking config file..."
wg show
echo ""

if wg-quick up wg0 2>&1 | tee /tmp/wg-output.log; then
    echo -e "${GREEN}✅ VPN Connected!${NC}"
    echo ""
    
    # Show VPN interface
    echo -e "${BLUE}📊 VPN Interface:${NC}"
    wg show | grep -E "interface|endpoint|allowed ips" | head -6
    echo ""
    
    # Show routes
    echo -e "${BLUE}📊 Routes qua VPN:${NC}"
    ip route | grep -E "10\.|172\.16\.|192\.168\." | head -10
    echo ""
    
    read -p "Press Enter để test SSH access..."
    echo ""
    
    # Test SSH
    echo -e "${BLUE}🧪 TEST SSH ACCESS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "Role: ${GREEN}$ROLE${NC}"
    echo -e "AllowedIPs: ${YELLOW}$ALLOWED${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Test 1: Basic Server
    echo -n "1️⃣  Ping 10.0.0.50 (Basic Server): "
    if ping -c 2 -W 2 10.0.0.50 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        echo -n "    SSH Port 2222: "
        if timeout 3 nc -zv 10.0.0.50 2222 2>&1 | grep -q "succeeded\|open\|Connected"; then
            echo -e "${GREEN}✅ CÓ THỂ KẾT NỐI${NC}"
        else
            echo -e "${YELLOW}⚠️  Port chưa mở (server đang khởi động?)${NC}"
        fi
    else
        echo -e "${RED}❌ KHÔNG PING ĐƯỢC${NC}"
    fi
    echo ""
    
    # Test 2: Manager Server
    echo -n "2️⃣  Ping 10.1.0.50 (Manager Server): "
    if ping -c 2 -W 2 10.1.0.50 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        echo -n "    SSH Port 2222: "
        if timeout 3 nc -zv 10.1.0.50 2222 2>&1 | grep -q "succeeded\|open\|Connected"; then
            echo -e "${GREEN}✅ CÓ THỂ KẾT NỐI${NC}"
        else
            echo -e "${YELLOW}⚠️  Port chưa mở (server đang khởi động?)${NC}"
        fi
    else
        echo -e "${RED}❌ KHÔNG PING ĐƯỢC${NC}"
    fi
    echo ""
    
    # Test 3: Admin Server
    echo -n "3️⃣  Ping 172.16.0.50 (Admin Server): "
    if ping -c 2 -W 2 172.16.0.50 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        echo -n "    SSH Port 2222: "
        if timeout 3 nc -zv 172.16.0.50 2222 2>&1 | grep -q "succeeded\|open\|Connected"; then
            echo -e "${GREEN}✅ CÓ THỂ KẾT NỐI${NC}"
        else
            echo -e "${YELLOW}⚠️  Port chưa mở (server đang khởi động?)${NC}"
        fi
    else
        echo -e "${RED}❌ KHÔNG PING ĐƯỢC${NC}"
    fi
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}📊 KẾT LUẬN CHO ROLE: $ROLE${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Analyze based on AllowedIPs
    if [[ "$ALLOWED" == *"10.0.0.0/8"* ]]; then
        echo "🎯 GIÁM ĐỐC - Full Access:"
        echo "  • AllowedIPs = 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16"
        echo "  ✅ Truy cập TẤT CẢ 3 servers"
        echo "  ✅ Có quyền cao nhất trong hệ thống"
        echo ""
    elif [[ "$ALLOWED" == *"10.0.0.0/16"* ]]; then
        echo "🎯 QUẢN LÝ - Manager Level:"
        echo "  • AllowedIPs = 10.0.0.0/16, 10.1.0.0/16"
        echo "  ✅ Truy cập được 2/3 servers (Basic + Manager)"
        echo "  ❌ KHÔNG truy cập được Admin Server (172.16.0.50)"
        echo ""
    elif [[ "$ALLOWED" == *"10.0.0.0/24"* ]]; then
        echo "🎯 NHÂN VIÊN - Basic Access:"
        echo "  • AllowedIPs = 10.0.0.0/24"
        echo "  ✅ Chỉ truy cập được 1/3 servers (Basic)"
        echo "  ❌ KHÔNG truy cập Manager Server (10.1.0.50)"
        echo "  ❌ KHÔNG truy cập Admin Server (172.16.0.50)"
        echo ""
    fi
    
    echo -e "${BLUE}💡 SO SÁNH TẤT CẢ CÁC ROLE:${NC}"
    echo ""
    echo "┌─────────────┬──────────────┬──────────────┬──────────────┐"
    echo "│    ROLE     │  10.0.0.50   │  10.1.0.50   │ 172.16.0.50  │"
    echo "├─────────────┼──────────────┼──────────────┼──────────────┤"
    echo "│ Nhân Viên   │      ✅      │      ❌      │      ❌      │"
    echo "│ Quản Lý     │      ✅      │      ✅      │      ❌      │"
    echo "│ Giám Đốc    │      ✅      │      ✅      │      ✅      │"
    echo "└─────────────┴──────────────┴──────────────┴──────────────┘"
    echo ""
    
    read -p "Press Enter để ngắt VPN và dọn dẹp..."
    wg-quick down wg0 2>/dev/null || true
else
    echo -e "${RED}❌ Lỗi kết nối VPN${NC}"
    echo ""
    echo "Chi tiết lỗi:"
    cat /tmp/wg-output.log
    echo ""
    echo "Gợi ý:"
    echo "  - Kiểm tra backend đang chạy: docker compose ps backend"
    echo "  - Kiểm tra port 51820: sudo netstat -nlup | grep 51820"
    echo "  - Kiểm tra config file có đúng không"
fi

# Cleanup
echo ""
echo -e "${BLUE}🧹 Dọn dẹp...${NC}"
docker rm -f ssh-basic ssh-manager ssh-admin 2>/dev/null || true
docker network rm zt-test-basic zt-test-manager zt-test-admin 2>/dev/null || true

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    ✅ DEMO HOÀN TẤT                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🎯 NGUYÊN TẮC ZERO TRUST:${NC}"
echo "  ✓ Phân quyền theo role cụ thể"
echo "  ✓ Principle of Least Privilege"
echo "  ✓ Giảm thiểu damage khi bị compromise"
echo ""
