#!/bin/bash

# Complete POS System Reset Script
# Deletes ALL local data: database, storage, cache

echo "🧹 COMPLETE POS RESET"
echo "===================="
echo ""

# 1. Delete Tauri application database
APP_DIR="$HOME/Library/Application Support/com.stonepot-tech.handsfree-pos"
if [ -d "$APP_DIR" ]; then
    echo "🗑️  Deleting Tauri app directory..."
    rm -rf "$APP_DIR"
    echo "✅ Deleted: $APP_DIR"
else
    echo "ℹ️  Tauri app directory not found (already clean)"
fi

# 2. Delete any test databases in project
echo ""
echo "🗑️  Cleaning project test databases..."
find . -name "*.db" -type f -delete 2>/dev/null
find . -name "*.db-wal" -type f -delete 2>/dev/null
find . -name "*.db-shm" -type f -delete 2>/dev/null
echo "✅ Deleted project database files"

# 3. Check for browser storage
echo ""
echo "📋 Browser Storage Reset Required:"
echo "   Open this file to clear all browser data:"
echo "   👉 file://$(pwd)/COMPLETE-RESET.html"
echo ""
echo "   Or manually run in browser console (F12):"
echo "   localStorage.clear(); sessionStorage.clear(); location.reload();"

# 4. Verify cleanup
echo ""
echo "🔍 Verification:"
if [ -d "$APP_DIR" ]; then
    echo "❌ App directory still exists!"
else
    echo "✅ App directory deleted"
fi

DB_COUNT=$(find . -name "*.db*" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$DB_COUNT" -gt 0 ]; then
    echo "⚠️  Found $DB_COUNT database files:"
    find . -name "*.db*" -type f 2>/dev/null
else
    echo "✅ No database files in project"
fi

echo ""
echo "✨ Reset complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Open COMPLETE-RESET.html in your browser"
echo "  2. Wait for auto-reload (or manually reload)"
echo "  3. Restart the Tauri app"
echo "  4. You should see the setup/onboarding screen"
echo ""
