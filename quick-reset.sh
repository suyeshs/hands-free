#!/bin/bash

##############################################################################
# Quick Reset Script (No Confirmations)
# For rapid testing during development
#
# Usage:
#   chmod +x quick-reset.sh
#   ./quick-reset.sh
#
# WARNING: This bypasses all confirmations!
##############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Platform-specific paths
if [[ "$OSTYPE" == "darwin"* ]]; then
    APP_DATA_DIR="$HOME/Library/Application Support/com.guanix.restaurant"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    APP_DATA_DIR="$HOME/.local/share/com.guanix.restaurant"
else
    APP_DATA_DIR="$APPDATA/com.guanix.restaurant"
fi

echo -e "${YELLOW}🔄 Quick Reset (no confirmations)${NC}"
echo ""

# Stop processes
echo "Stopping dev server..."
pkill -f "tauri dev" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "bun.*dev" 2>/dev/null
sleep 1

# Delete databases
echo "Deleting databases..."
rm -f "$APP_DATA_DIR/pos-dev.db"* 2>/dev/null
rm -f "$APP_DATA_DIR/guanix.db"* 2>/dev/null

# Clear caches
echo "Clearing caches..."
rm -rf "node_modules/.cache" 2>/dev/null
rm -rf ".vite" 2>/dev/null

echo ""
echo -e "${GREEN}✅ Done!${NC}"
echo ""
echo "Now run: bun run tauri dev"
echo "Then in browser console run:"
echo "  localStorage.clear(); sessionStorage.clear();"
echo "  await window.__TAURI__.core.invoke('clear_tenant_config');"
echo "  location.reload();"
