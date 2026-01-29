#!/bin/bash

# Reset Setup Data Script
# This script clears all setup wizard and demo data to start fresh

echo "🔄 Resetting setup data..."

# 1. Delete the SQLite database
echo "📦 Deleting database..."
rm -f src-tauri/pos.db
echo "✅ Database deleted"

echo ""
echo "✨ Database reset complete!"
echo ""
echo "🚀 Next step: Reload the app"
echo "   The app will automatically detect the fresh database"
echo "   and show the setup wizard."
echo ""
echo "   If you get stuck at 'Initializing', just reload the app again."
