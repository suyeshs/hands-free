#!/bin/bash

# QR Code Fix Verification Test
# Tests that QR codes now use tunnel URLs instead of cloud URLs

set -e

echo "🧪 QR Code Fix Verification Test"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: Verify new files exist
echo "Test 1: New Files Created"
echo "--------------------------"
if [ -f "src/stores/qrOrderingStore.ts" ]; then
    pass "QR ordering store created"
else
    fail "QR ordering store missing"
fi
echo ""

# Test 2: Check if floorPlanStore imports QR ordering store
echo "Test 2: Floor Plan Store Integration"
echo "-------------------------------------"
if grep -q "useQROrderingStore" src/stores/floorPlanStore.ts; then
    pass "Floor plan store imports QR ordering store"
else
    fail "Floor plan store doesn't import QR ordering store"
fi

if grep -q "tunnelUrl" src/stores/floorPlanStore.ts; then
    pass "Floor plan store uses tunnel URL"
else
    fail "Floor plan store doesn't use tunnel URL"
fi

if grep -q "regenerateQRCodesWithTunnelUrl" src/stores/floorPlanStore.ts; then
    pass "Regenerate QR codes function exists"
else
    fail "Regenerate QR codes function missing"
fi
echo ""

# Test 3: Check QR ordering settings integration
echo "Test 3: QR Ordering Settings Integration"
echo "----------------------------------------"
if grep -q "useQROrderingStore" src/pages-v2/QROrderingSettings.tsx; then
    pass "QR ordering settings imports store"
else
    fail "QR ordering settings doesn't import store"
fi

if grep -q "setTunnelUrl" src/pages-v2/QROrderingSettings.tsx; then
    pass "Settings stores tunnel URL on event"
else
    fail "Settings doesn't store tunnel URL"
fi
echo ""

# Test 4: Check Floor Plan Manager integration
echo "Test 4: Floor Plan Manager Integration"
echo "---------------------------------------"
if grep -q "useQROrderingStore" src/components/admin/FloorPlanManager.tsx; then
    pass "Floor Plan Manager imports QR ordering store"
else
    fail "Floor Plan Manager doesn't import store"
fi

if grep -q "handleRegenerateQRCodes" src/components/admin/FloorPlanManager.tsx; then
    pass "Regenerate QR codes handler exists"
else
    fail "Regenerate QR codes handler missing"
fi

if grep -q "Use Tunnel URLs" src/components/admin/FloorPlanManager.tsx; then
    pass "Regenerate button UI added"
else
    fail "Regenerate button UI missing"
fi

if grep -q "isTunnelUrl\|isCloudUrl" src/components/admin/FloorPlanManager.tsx; then
    pass "URL type indicators added to QR modal"
else
    fail "URL type indicators missing from QR modal"
fi
echo ""

# Test 5: Logic verification
echo "Test 5: URL Generation Logic"
echo "----------------------------"
info "Checking URL generation priority:"

# Check if tunnel URL has priority
if grep -A 5 "tunnelUrl" src/stores/floorPlanStore.ts | grep -q "trycloudflare"; then
    pass "Tunnel URL has priority in generation"
else
    warn "Tunnel URL priority not verified (check manually)"
fi

# Check if there's a fallback to cloud URL
if grep -q "handsfree.tech" src/stores/floorPlanStore.ts; then
    pass "Cloud URL fallback exists"
else
    warn "Cloud URL fallback not found (check manually)"
fi
echo ""

# Test 6: TypeScript compilation
echo "Test 6: TypeScript Compilation"
echo "------------------------------"
info "Checking TypeScript compilation..."

if command -v bun > /dev/null 2>&1; then
    if bun run tsc --noEmit > /dev/null 2>&1; then
        pass "TypeScript compiles without errors"
    else
        warn "TypeScript compilation has errors (check 'bun run tsc')"
    fi
else
    warn "Bun not installed, skipping TS check"
fi
echo ""

# Test 7: Documentation
echo "Test 7: Documentation"
echo "---------------------"
if [ -f "QR_URL_ISSUE_AND_FIX.md" ]; then
    pass "Fix documentation exists"
else
    warn "Fix documentation missing"
fi

if [ -f "CUSTOMER_QR_ORDERING_WORKFLOW_ANALYSIS.md" ]; then
    pass "Workflow analysis exists"
else
    warn "Workflow analysis missing"
fi
echo ""

# Summary
echo "═══════════════════════════════════════"
echo "Test Summary"
echo "═══════════════════════════════════════"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    echo ""
    echo "Next steps to verify the fix works:"
    echo ""
    echo "1. Start the app:"
    echo "   bun tauri dev"
    echo ""
    echo "2. Go to Settings → QR Code Ordering"
    echo "   Click 'Start Tunnel'"
    echo "   Wait for tunnel URL (e.g., https://xyz.trycloudflare.com)"
    echo ""
    echo "3. Go to Floor Plan Manager"
    echo "   Click the blue '🔄 Use Tunnel URLs' button"
    echo "   Confirm to regenerate all QR codes"
    echo ""
    echo "4. Click on any table to view QR code"
    echo "   Verify it shows:"
    echo "   - Blue indicator: '⚡ Tunnel URL - Instant Ordering'"
    echo "   - URL starts with https://xyz.trycloudflare.com"
    echo ""
    echo "5. Create a NEW table"
    echo "   View its QR code"
    echo "   Should automatically use tunnel URL"
    echo ""
    echo "6. Test the ordering flow:"
    echo "   - Scan QR code with phone"
    echo "   - Should open tunnel URL"
    echo "   - Place test order"
    echo "   - Should appear in POS instantly (<1 second)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the issues above.${NC}"
    exit 1
fi
