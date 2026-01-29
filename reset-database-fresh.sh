#!/bin/bash

# Script to completely reset the database and start fresh
# This will delete all local data including SQLite databases and localStorage

echo "🧹 Restaurant POS - Complete Database Reset"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will delete ALL local data:"
echo "   - SQLite database (pos.db)"
echo "   - LocalStorage data"
echo "   - All staff, menu, orders, etc."
echo ""

read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Reset cancelled"
    exit 0
fi

echo ""
echo "🔍 Finding database files..."
echo ""

# Common locations for Tauri app data on macOS
LOCATIONS=(
    "$HOME/Library/Application Support/com.pos.restaurant"
    "$HOME/Library/Application Support/com.tauri.dev"
    "$HOME/Library/Application Support/restaurant-pos-ai"
    "$HOME/Library/Caches/com.pos.restaurant"
    "."
)

found_db=false

for location in "${LOCATIONS[@]}"; do
    if [ -d "$location" ]; then
        echo "📁 Checking: $location"

        # Find all .db files
        db_files=$(find "$location" -name "*.db" -o -name "pos.db*" 2>/dev/null)

        if [ ! -z "$db_files" ]; then
            echo "   Found database files:"
            echo "$db_files" | while read file; do
                echo "   - $file"
                rm -f "$file"
                echo "     ✅ Deleted"
                found_db=true
            done
        fi

        # Also delete any SQLite journal/wal files
        find "$location" -name "*.db-shm" -delete 2>/dev/null
        find "$location" -name "*.db-wal" -delete 2>/dev/null
        find "$location" -name "*.db-journal" -delete 2>/dev/null
    fi
done

if [ "$found_db" = false ]; then
    echo "ℹ️  No database files found (this is OK if it's a fresh install)"
fi

echo ""
echo "✅ Database files deleted"
echo ""
echo "📋 Next steps:"
echo "   1. Clear browser localStorage (use the clear-all-data.html tool)"
echo "   2. Restart the app: npm run dev"
echo "   3. You should see the activation/setup wizard"
echo ""
echo "🔧 To clear localStorage, open:"
echo "   http://localhost:1420/clear-all-data.html"
echo ""
