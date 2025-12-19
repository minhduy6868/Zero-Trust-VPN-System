#!/bin/bash
###############################################################################
# DEMO SSH - TEST VPN CONFIG WITH ROUTING CHECK
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
    CONFIG="${CONFIG/#\~/$HOME}"
    if [ -z "$CONFIG" ]; then
        echo -e "${RED}❌ Bạn chưa nhập đường dẫn${NC}"
        exit 1
    fi
else
    CONFIG="$1"
fi

if [ ! -f "$CONFIG" ]; then
    echo -e "${RED}❌ File không tồn tại: $CONFIG${NC}"
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
USERNAME=$(grep "# User:" "$CONFIG" | cut -d':' -f2 | xargs)

if [ -z "$ROLE" ]; then
    if [[ "$ALLOWED" == *"10.0.0.0/8"* ]]; then
        ROLE="GIAM_DOC (Giám Đốc)"
    elif [[ "$ALLOWED" == *"10.0.0.0/16"* ]]; then
        ROLE="QUAN_LY (Quản Lý)"
    elif [[ "$ALLOWED" == *"10.0.0.0/24"* ]]; then
        ROLE="NHAN_VIEN (Nhân Viên)"
    fi
fi

echo -e "${GREEN}📊 THÔNG TIN VPN:${NC}"
echo "  File:       $(basename "$CONFIG")"
[ -n "$USERNAME" ] && echo "  User:       $USERNAME"
echo "  Role:       $ROLE"
echo "  AllowedIPs: $ALLOWED"
echo ""

read -p "Press Enter để kết nối VPN và test routing..."

# Clean up
wg-quick down wg0 2>/dev/null || true
docker rm -f ssh-basic ssh-manager ssh-admin 2>/dev/null || true
docker network rm zt-test-basic zt-test-manager zt-test-admin 2>/dev/null || true

# Connect VPN FIRST
echo ""
echo -e "${BLUE}🔄 Bước 1: Kết nối VPN...${NC}"
cp "$CONFIG" /etc/wireguard/wg0.conf
chmod 600 /etc/wireguard/wg0.conf

if wg-quick up wg0 2>&1 | tail -5; then
    sleep 2
    echo -e "${GREEN}✅ VPN Connected!${NC}"
    echo ""
    
    # Show VPN interface
    echo -e "${BLUE}📊 VPN Interface:${NC}"
    wg show wg0 2>/dev/null | head -10
    echo ""
    
    # Show VPN routes
    echo -e "${BLUE}📊 VPN Routes (chỉ routes qua wg0):${NC}"
    ip route show dev wg0 2>/dev/null
    echo ""
    
    # Test routing logic
    echo -e "${BLUE}🔄 Bước 2: Test Routing Logic...${NC}"
    echo ""
    
    echo -e "${BLUE}🧪 KIỂM TRA ROUTING TABLE${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "Role: ${GREEN}$ROLE${NC}"
    echo -e "AllowedIPs: ${YELLOW}$ALLOWED${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Test 1: Check if 10.0.0.50 route exists
    echo -n "1️⃣  Route đến 10.0.0.50 (Basic Server): "
    if ip route get 10.0.0.50 2>/dev/null | grep -q "dev wg0"; then
        echo -e "${GREEN}✅ QUA VPN (wg0) - ALLOWED${NC}"
        TEST1="ALLOWED"
    else
        echo -e "${RED}❌ KHÔNG QUA VPN - BLOCKED${NC}"
        TEST1="BLOCKED"
    fi
    
    # Test 2: Check if 10.1.0.50 route exists
    echo -n "2️⃣  Route đến 10.1.0.50 (Manager Server): "
    if ip route get 10.1.0.50 2>/dev/null | grep -q "dev wg0"; then
        echo -e "${GREEN}✅ QUA VPN (wg0) - ALLOWED${NC}"
        TEST2="ALLOWED"
    else
        echo -e "${RED}❌ KHÔNG QUA VPN - BLOCKED${NC}"
        TEST2="BLOCKED"
    fi
    
    # Test 3: Check if 172.16.0.50 route exists
    echo -n "3️⃣  Route đến 172.16.0.50 (Admin Server): "
    if ip route get 172.16.0.50 2>/dev/null | grep -q "dev wg0"; then
        echo -e "${GREEN}✅ QUA VPN (wg0) - ALLOWED${NC}"
        TEST3="ALLOWED"
    else
        echo -e "${RED}❌ KHÔNG QUA VPN - BLOCKED${NC}"
        TEST3="BLOCKED"
    fi
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}📊 KẾT QUẢ VÀ PHÂN TÍCH${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Analyze based on actual test results
    if [[ "$ALLOWED" == *"10.0.0.0/8"* ]]; then
        echo "🎯 ${GREEN}GIÁM ĐỐC${NC} - Full Network Access"
        echo ""
        echo "AllowedIPs Configuration:"
        echo "  • 10.0.0.0/8       → Tất cả 10.x.x.x (16M IPs)"
        echo "  • 172.16.0.0/12    → 172.16-31.x.x (1M IPs)"
        echo "  • 192.168.0.0/16   → Tất cả 192.168.x.x (64K IPs)"
        echo ""
        echo "Kết quả test routing:"
        echo "  $([[ "$TEST1" == "ALLOWED" ]] && echo "✅" || echo "❌") 10.0.0.50   (Basic Server)"
        echo "  $([[ "$TEST2" == "ALLOWED" ]] && echo "✅" || echo "❌") 10.1.0.50   (Manager Server)"
        echo "  $([[ "$TEST3" == "ALLOWED" ]] && echo "✅" || echo "❌") 172.16.0.50 (Admin Server)"
        echo ""
        if [[ "$TEST1" == "ALLOWED" && "$TEST2" == "ALLOWED" && "$TEST3" == "ALLOWED" ]]; then
            echo -e "${GREEN}✅ ĐÚNG: Giám đốc có full access!${NC}"
        else
            echo -e "${YELLOW}⚠️  Một số routes bị blocked (có thể do subnet overlap)${NC}"
        fi
        
    elif [[ "$ALLOWED" == *"10.0.0.0/16"* ]]; then
        echo "🎯 ${YELLOW}QUẢN LÝ${NC} - Manager Level Access"
        echo ""
        echo "AllowedIPs Configuration:"
        echo "  • 10.0.0.0/16      → 10.0.x.x (64K IPs)"
        echo "  • 10.1.0.0/16      → 10.1.x.x (64K IPs)"
        echo ""
        echo "Kết quả test routing:"
        echo "  $([[ "$TEST1" == "ALLOWED" ]] && echo "✅" || echo "❌") 10.0.0.50   (Basic) - Expected: ✅ ALLOWED"
        echo "  $([[ "$TEST2" == "ALLOWED" ]] && echo "✅" || echo "❌") 10.1.0.50   (Manager) - Expected: ✅ ALLOWED"
        echo "  $([[ "$TEST3" == "BLOCKED" ]] && echo "✅" || echo "❌") 172.16.0.50 (Admin) - Expected: ❌ BLOCKED"
        echo ""
        if [[ "$TEST1" == "ALLOWED" && "$TEST2" == "ALLOWED" && "$TEST3" == "BLOCKED" ]]; then
            echo -e "${GREEN}✅ ĐÚNG: Quản lý chỉ truy cập employee + manager networks!${NC}"
        else
            echo -e "${YELLOW}⚠️  Routes không đúng với expected behavior${NC}"
        fi
        
    elif [[ "$ALLOWED" == *"10.0.0.0/24"* ]]; then
        echo "🎯 ${RED}NHÂN VIÊN${NC} - Basic Employee Access"
        echo ""
        echo "AllowedIPs Configuration:"
        echo "  • 10.0.0.0/24      → Chỉ 10.0.0.x (256 IPs)"
        echo ""
        echo "Kết quả test routing:"
        echo "  $([[ "$TEST1" == "ALLOWED" ]] && echo "✅" || echo "❌") 10.0.0.50   (Basic) - Expected: ✅ ALLOWED"
        echo "  $([[ "$TEST2" == "BLOCKED" ]] && echo "✅" || echo "❌") 10.1.0.50   (Manager) - Expected: ❌ BLOCKED"
        echo "  $([[ "$TEST3" == "BLOCKED" ]] && echo "✅" || echo "❌") 172.16.0.50 (Admin) - Expected: ❌ BLOCKED"
        echo ""
        if [[ "$TEST1" == "ALLOWED" && "$TEST2" == "BLOCKED" && "$TEST3" == "BLOCKED" ]]; then
            echo -e "${GREEN}✅ ĐÚNG: Nhân viên chỉ truy cập basic server (Least Privilege)!${NC}"
        else
            echo -e "${YELLOW}⚠️  Routes không đúng với expected behavior${NC}"
        fi
    fi
    
    echo ""
    echo -e "${BLUE}💡 BẢNG SO SÁNH ACCESS MATRIX:${NC}"
    echo ""
    echo "┌─────────────┬──────────────┬──────────────┬──────────────┐"
    echo "│    ROLE     │  10.0.0.50   │  10.1.0.50   │ 172.16.0.50  │"
    echo "├─────────────┼──────────────┼──────────────┼──────────────┤"
    echo "│ Nhân Viên   │      ✅      │      ❌      │      ❌      │"
    echo "│ Quản Lý     │      ✅      │      ✅      │      ❌      │"
    echo "│ Giám Đốc    │      ✅      │      ✅      │      ✅      │"
    echo "└─────────────┴──────────────┴──────────────┴──────────────┘"
    echo ""
    
    echo -e "${GREEN}🎯 ZERO TRUST PRINCIPLES:${NC}"
    echo ""
    echo "1️⃣  ${YELLOW}Least Privilege Access${NC}"
    echo "    → WireGuard AllowedIPs chỉ cho phép route đến subnets cần thiết"
    echo ""
    echo "2️⃣  ${YELLOW}Network Segmentation${NC}"
    echo "    → Mỗi role có phạm vi IPs khác nhau trong routing table"
    echo ""
    echo "3️⃣  ${YELLOW}Policy-Based Routing${NC}"
    echo "    → Kernel routing table enforce policy qua VPN interface wg0"
    echo ""
    echo "4️⃣  ${YELLOW}Minimize Blast Radius${NC}"
    echo "    → Nếu account bị compromise, chỉ ảnh hưởng trong AllowedIPs"
    echo ""
    
    read -p "Press Enter để ngắt VPN..."
    wg-quick down wg0 2>/dev/null || true
else
    echo -e "${RED}❌ Lỗi kết nối VPN${NC}"
    echo "Kiểm tra: docker compose ps backend && sudo netstat -nlup | grep 51820"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    ✅ DEMO HOÀN TẤT                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
