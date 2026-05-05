#!/bin/bash
# Quick test script for HandsFree Staff Mobile App

set -e

echo "🧪 Testing HandsFree Staff Mobile App..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if database exists
if [ ! -f "guanix.db" ]; then
    echo -e "${RED}✗${NC} Database not found"
    echo "   Run: ./scripts/setup-dev.sh"
    exit 1
fi

echo -e "${GREEN}✓${NC} Database found"

# Check database schema
echo ""
echo "📊 Checking database schema..."
TABLES=$(sqlite3 guanix.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" 2>&1)

if [[ $TABLES == *"staff_users"* ]]; then
    echo -e "${GREEN}✓${NC} staff_users table exists"
else
    echo -e "${RED}✗${NC} staff_users table missing"
fi

if [[ $TABLES == *"device_registrations"* ]]; then
    echo -e "${GREEN}✓${NC} device_registrations table exists"
else
    echo -e "${RED}✗${NC} device_registrations table missing"
fi

if [[ $TABLES == *"attendance_records"* ]]; then
    echo -e "${GREEN}✓${NC} attendance_records table exists"
else
    echo -e "${RED}✗${NC} attendance_records table missing"
fi

# Check for test data
echo ""
echo "👥 Checking staff users..."
STAFF_COUNT=$(sqlite3 guanix.db "SELECT COUNT(*) FROM staff_users WHERE is_active = 1;" 2>/dev/null || echo "0")
echo "   Active staff: $STAFF_COUNT"

if [ "$STAFF_COUNT" -gt 0 ]; then
    echo ""
    echo "Staff list:"
    sqlite3 guanix.db "SELECT '  - ' || name || ' (' || role || ')' FROM staff_users WHERE is_active = 1 ORDER BY name;" 2>/dev/null || true
fi

# Check device registrations
echo ""
echo "📱 Checking device registrations..."
DEVICE_COUNT=$(sqlite3 guanix.db "SELECT COUNT(*) FROM device_registrations;" 2>/dev/null || echo "0")
echo "   Registered devices: $DEVICE_COUNT"

# Check attendance records
echo ""
echo "⏰ Checking attendance records..."
ATTENDANCE_COUNT=$(sqlite3 guanix.db "SELECT COUNT(*) FROM attendance_records;" 2>/dev/null || echo "0")
echo "   Total records: $ATTENDANCE_COUNT"

if [ "$ATTENDANCE_COUNT" -gt 0 ]; then
    TODAY_COUNT=$(sqlite3 guanix.db "SELECT COUNT(*) FROM attendance_records WHERE shift_date = date('now');" 2>/dev/null || echo "0")
    echo "   Today's records: $TODAY_COUNT"
fi

# Check TypeScript compilation
echo ""
echo "📝 Checking TypeScript..."
if [ -d "node_modules" ] || [ -d ".bun" ]; then
    if bun run tsc --noEmit 2>&1 | grep -q "error TS"; then
        echo -e "${RED}✗${NC} TypeScript errors found"
        echo "   Run: bun run tsc --noEmit"
    else
        echo -e "${GREEN}✓${NC} No TypeScript errors"
    fi
else
    echo -e "${YELLOW}⚠${NC}  Dependencies not installed"
    echo "   Run: bun install"
fi

# Check Rust compilation
echo ""
echo "🦀 Checking Rust build..."
cd src-tauri
if cargo check --quiet 2>&1; then
    echo -e "${GREEN}✓${NC} Rust code compiles"
else
    echo -e "${RED}✗${NC} Rust compilation errors"
    echo "   Run: cd src-tauri && cargo check"
fi
cd ..

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Test Summary${NC}"
echo ""

if [ "$STAFF_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠${NC}  No staff users found"
    echo "   Seed test data with:"
    echo "   sqlite3 guanix.db < seed-test-data.sql"
    echo ""
fi

echo "Ready to run:"
echo "  • Desktop: bun run tauri:dev"
echo "  • Android: bun run tauri android dev"
echo "  • iOS: bun run tauri ios dev"
echo ""
echo "📚 See SETUP_AND_TESTING.md for more details"
echo ""
echo "🎉 Testing complete!"
