#!/bin/bash

echo "🔍 Checking for POS Database..."
echo ""

# Common Tauri app data locations by OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    APP_DATA="$HOME/Library/Application Support/com.handsfree.pos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    APP_DATA="$HOME/.local/share/handsfree-pos"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    APP_DATA="$APPDATA/com.handsfree.pos"
else
    echo "❌ Unknown OS type: $OSTYPE"
    exit 1
fi

DB_PATH="$APP_DATA/pos.db"

echo "Expected database location:"
echo "  $DB_PATH"
echo ""

if [ -f "$DB_PATH" ]; then
    echo "✅ Database EXISTS"
    echo ""
    
    # Get file size
    SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
    echo "File size: $SIZE"
    
    # Get last modified time
    MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$DB_PATH" 2>/dev/null || stat -c "%y" "$DB_PATH" 2>/dev/null)
    echo "Last modified: $MODIFIED"
    echo ""
    
    # Try to query the database
    echo "Database tables:"
    sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" 2>/dev/null || echo "  (sqlite3 not available)"
    
    echo ""
    echo "Tenant configuration:"
    sqlite3 "$DB_PATH" "SELECT key, value FROM app_config WHERE key LIKE 'tenant%' OR key LIKE 'activation%';" 2>/dev/null || echo "  (unable to query)"
    
else
    echo "❌ Database DOES NOT EXIST"
    echo ""
    echo "This means:"
    echo "  - The app hasn't been run yet, OR"
    echo "  - The database is stored in a different location"
    echo ""
    echo "To create the database, run the Tauri app once."
fi

echo ""
echo "App data directory contents:"
ls -la "$APP_DATA" 2>/dev/null || echo "  (directory does not exist)"
