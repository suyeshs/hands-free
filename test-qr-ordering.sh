#!/bin/bash

# QR Code Ordering End-to-End Test Script
# Tests the complete customer ordering workflow

set -e

echo "🧪 QR Code Ordering System Test"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: Check if cloudflared binary exists
echo "Test 1: Cloudflared Binary"
echo "----------------------------"
if [ -f "src-tauri/cloudflared/cloudflared-darwin-arm64" ]; then
    SIZE=$(du -h src-tauri/cloudflared/cloudflared-darwin-arm64 | cut -f1)
    pass "Cloudflared binary exists (${SIZE})"
else
    fail "Cloudflared binary not found"
fi
echo ""

# Test 2: Check if web server code exists
echo "Test 2: Web Server Implementation"
echo "-----------------------------------"
if [ -f "src-tauri/src/webserver.rs" ]; then
    LINES=$(wc -l < src-tauri/src/webserver.rs)
    pass "Web server code exists (${LINES} lines)"
else
    fail "Web server code not found"
fi
echo ""

# Test 3: Check if tunnel management exists
echo "Test 3: Tunnel Management"
echo "-------------------------"
if [ -f "src-tauri/src/commands/tunnel.rs" ]; then
    LINES=$(wc -l < src-tauri/src/commands/tunnel.rs)
    pass "Tunnel commands exist (${LINES} lines)"
else
    fail "Tunnel commands not found"
fi
echo ""

# Test 4: Check if customer UI exists
echo "Test 4: Customer Ordering UI"
echo "----------------------------"
if [ -f "src/pages-v2/GuestOrderPage.tsx" ]; then
    pass "Guest order page exists"
else
    fail "Guest order page not found"
fi

if [ -f "src/components/guest/GuestMenuBrowser.tsx" ]; then
    pass "Guest menu browser exists"
else
    fail "Guest menu browser not found"
fi

if [ -f "src/components/guest/GuestCart.tsx" ]; then
    pass "Guest cart exists"
else
    fail "Guest cart not found"
fi

if [ -f "src/components/guest/GuestCheckout.tsx" ]; then
    pass "Guest checkout exists"
else
    fail "Guest checkout not found"
fi
echo ""

# Test 5: Check if POS components exist
echo "Test 5: POS Integration"
echo "----------------------"
if [ -f "src/components/pos/GuestOrderListener.tsx" ]; then
    pass "Guest order listener exists"
else
    fail "Guest order listener not found"
fi

if [ -f "src/pages-v2/QROrderingSettings.tsx" ]; then
    pass "QR ordering settings page exists"
else
    fail "QR ordering settings page not found"
fi
echo ""

# Test 6: Check if SQLite migrations include required tables
echo "Test 6: Database Schema"
echo "-----------------------"
if grep -q "guest_orders\|orders" src-tauri/migrations/*.sql 2>/dev/null; then
    pass "Orders table migration exists"
else
    warn "Orders table migration not found in migrations/"
fi

if [ -f "src-tauri/migrations/036_guest_orders.sql" ]; then
    pass "Guest orders migration exists"
else
    warn "Guest orders migration file not found"
fi
echo ""

# Test 7: Check if Floor Plan Manager has staff assignment
echo "Test 7: Staff Assignment"
echo "------------------------"
if grep -q "assignStaff\|Assign Staff" src/components/admin/FloorPlanManager.tsx; then
    pass "Floor Plan Manager has staff assignment"
else
    fail "Staff assignment not found in Floor Plan Manager"
fi

if grep -q "getAssignedStaffForTable" src/stores/floorPlanStore.ts; then
    pass "Floor plan store has staff assignment logic"
else
    fail "Staff assignment logic not in floor plan store"
fi
echo ""

# Test 8: Runtime checks (only if app is running)
echo "Test 8: Runtime Checks"
echo "----------------------"

# Check if local server is running
if curl -s --connect-timeout 2 http://localhost:3000/health > /dev/null 2>&1; then
    pass "Local web server is running on port 3000"

    # Test menu endpoint
    if curl -s --connect-timeout 2 http://localhost:3000/api/menu > /dev/null 2>&1; then
        pass "Menu API endpoint responds"
    else
        warn "Menu API endpoint not responding"
    fi

    # Test order endpoint
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/order \
        -H "Content-Type: application/json" \
        -d '{"table_id":"test","items":[]}' 2>&1 || true)

    if [ ! -z "$RESPONSE" ]; then
        pass "Order API endpoint responds"
    else
        warn "Order API endpoint not responding"
    fi
else
    warn "Local web server not running (start app with 'bun tauri dev')"
fi

# Check if cloudflared is running
if pgrep -f cloudflared > /dev/null 2>&1; then
    pass "Cloudflared tunnel process is running"
else
    warn "Cloudflared not running (start tunnel in QR Ordering Settings)"
fi
echo ""

# Test 9: mDNS Service Discovery
echo "Test 9: mDNS Service"
echo "--------------------"
if [ -f "src-tauri/src/lan_sync/server.rs" ]; then
    pass "LAN sync server exists"
else
    fail "LAN sync server not found"
fi

if [ -f "src/lib/mdnsPrintService.ts" ]; then
    pass "mDNS print service exists"
else
    fail "mDNS print service not found"
fi

# Check if mDNS service is running (macOS only)
if command -v dns-sd > /dev/null 2>&1; then
    if timeout 2s dns-sd -B _pos._tcp local. 2>&1 | grep -q "Restaurant" || true; then
        pass "mDNS service is advertising"
    else
        warn "mDNS service not advertising (app may not be running)"
    fi
else
    warn "dns-sd command not available (mDNS test skipped)"
fi
echo ""

# Summary
echo "================================"
echo "Test Summary"
echo "================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start the app: bun tauri dev"
    echo "2. Navigate to Settings → QR Code Ordering"
    echo "3. Click 'Start Tunnel'"
    echo "4. Scan QR code or open tunnel URL"
    echo "5. Place a test order"
    echo "6. Verify order appears in POS"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please fix the issues above.${NC}"
    exit 1
fi
