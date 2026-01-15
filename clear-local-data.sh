#!/bin/bash

# Clear Local Data Script
# Removes all tenant data including keychain, database, and app data for fresh activation

echo "🧹 Clearing local POS data..."
echo ""

# Check if app is running and warn user
if pgrep -f "handsfree-pos" > /dev/null; then
    echo "⚠️  WARNING: The POS app is currently running!"
    echo "   Please close the app completely before running this script."
    echo "   Press Ctrl+C to cancel, or Enter to force quit and continue..."
    read -r
    pkill -9 -f "handsfree-pos"
    echo "  ✓ App force quit"
    sleep 2
fi
echo ""

# 0. Clear macOS Keychain entries
echo "🔑 Clearing Keychain entries..."
security delete-generic-password -s "restaurant-pos-ai" -a "device_registration" 2>/dev/null && echo "  ✓ Device registration cleared" || echo "  ⚠️  No device registration found"
security delete-generic-password -s "restaurant-pos-ai" -a "manager_session" 2>/dev/null && echo "  ✓ Manager session cleared" || echo "  ⚠️  No manager session found"
echo ""

# 1. Clear SQLite database
echo "📦 Clearing SQLite database..."
DB_PATH="$HOME/Library/Application Support/com.stonepot-tech.handsfree-pos/pos.db"
if [ -f "$DB_PATH" ]; then
    rm "$DB_PATH"
    echo "  ✓ Database cleared"
else
    echo "  ⚠️  No database found"
fi

# Clear WAL and SHM files
if [ -f "$DB_PATH-wal" ]; then
    rm "$DB_PATH-wal"
    echo "  ✓ Cleared WAL file"
fi
if [ -f "$DB_PATH-shm" ]; then
    rm "$DB_PATH-shm"
    echo "  ✓ Cleared SHM file"
fi

# 2. Clear WebView storage (IndexedDB, localStorage, etc.)
echo ""
echo "🌐 Clearing WebView storage..."
WEBVIEW_DIR="$HOME/Library/WebKit/com.stonepot-tech.handsfree-pos"
if [ -d "$WEBVIEW_DIR" ]; then
    rm -rf "$WEBVIEW_DIR"
    echo "  ✓ WebView storage cleared"
else
    echo "  ⚠️  WebView directory not found"
fi

# 3. Clear Tauri state
echo ""
echo "💾 Clearing Tauri state..."
STATE_FILE="$HOME/Library/Saved Application State/com.stonepot-tech.handsfree-pos.savedState"
if [ -d "$STATE_FILE" ]; then
    rm -rf "$STATE_FILE"
    echo "  ✓ Tauri state cleared"
else
    echo "  ⚠️  State file not found"
fi

# 4. Clear localStorage files
echo ""
echo "🗄️  Clearing localStorage..."
APP_DATA_DIR="$HOME/Library/Application Support/com.stonepot-tech.handsfree-pos"
if [ -d "$APP_DATA_DIR" ]; then
    find "$APP_DATA_DIR" -type f \( -name "*.localstorage*" -o -name "*.localStorage*" \) -delete 2>/dev/null || true
    echo "  ✓ localStorage cleared"
fi

echo ""
echo "✅ All local data cleared!"
echo ""
echo "📝 Next Steps:"
echo "   1. Launch the POS app (migrations will run automatically)"
echo "   2. You should see the activation screen"
echo "   3. Enter activation code: 6FZE-CSVB-SNYL-FG53"
echo "   4. Click 'Activate System'"
echo "   5. App will reload and redirect to the hub page"
echo ""
echo "🏢 Tenant Info:"
echo "   Company: Coorg Food Company"
echo "   Tenant ID: coorg-food-company-6163"
echo ""
echo "⚠️  If you get database errors, make sure the app was completely"
echo "   closed before running this script, then restart the app."
echo ""
