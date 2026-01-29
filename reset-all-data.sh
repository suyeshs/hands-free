#!/bin/bash

# Reset All Tenant Data Script
# Clears SQLite database and provides instructions for localStorage

set -e

echo "🔥 HandsFree POS - Complete Data Reset"
echo "======================================"
echo ""

# Database path for macOS
DB_PATH="$HOME/Library/Application Support/com.stonepot-tech.handsfree-pos/pos.db"

echo "📍 Database location: $DB_PATH"
echo ""

# Check if database exists
if [ -f "$DB_PATH" ]; then
    echo "✅ Database found"
    read -p "Delete database? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$DB_PATH"
        echo "✅ Database deleted successfully"
    else
        echo "⏭️  Skipped database deletion"
    fi
else
    echo "ℹ️  Database not found (may not exist yet)"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Open reset-tenant.html in your browser"
echo "2. Click 'Clear All localStorage'"
echo "3. Close the browser"
echo "4. Restart the Tauri app with: bun run dev"
echo ""
echo "You will then go through fresh provisioning setup."
