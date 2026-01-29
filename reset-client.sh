#!/bin/bash

# Complete Client Reset Script
# Deletes all local databases and storage

echo "🧹 Resetting client data..."

# 1. Stop any running dev server (optional)
# pkill -f "vite" 2>/dev/null

# 2. Delete SQLite database
DB_PATH="src-tauri/pos.db"
if [ -f "$DB_PATH" ]; then
    rm -f "$DB_PATH"
    echo "✅ Deleted SQLite database: $DB_PATH"
else
    echo "ℹ️  No SQLite database found at $DB_PATH"
fi

# 3. Delete WAL and SHM files (SQLite temporary files)
rm -f src-tauri/pos.db-wal src-tauri/pos.db-shm 2>/dev/null
echo "✅ Deleted SQLite WAL/SHM files"

# 4. Clear localStorage (via HTML file that auto-runs)
cat > clear-storage.html << 'HTML'
<!DOCTYPE html>
<html>
<head>
    <title>Clear Storage</title>
</head>
<body>
    <h1>Clearing All Storage...</h1>
    <pre id="output"></pre>
    <script>
        const output = document.getElementById('output');
        
        // Log all storage keys before clearing
        output.textContent = 'LocalStorage keys before:\n';
        for (let i = 0; i < localStorage.length; i++) {
            output.textContent += `  - ${localStorage.key(i)}\n`;
        }
        
        // Clear all localStorage
        localStorage.clear();
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear IndexedDB
        if (window.indexedDB) {
            indexedDB.databases().then(dbs => {
                dbs.forEach(db => {
                    indexedDB.deleteDatabase(db.name);
                    output.textContent += `\nDeleted IndexedDB: ${db.name}`;
                });
            });
        }
        
        output.textContent += '\n\n✅ ALL STORAGE CLEARED!\n';
        output.textContent += '\nYou can close this window and restart the app.\n';
        
        console.log('Storage cleared successfully');
    </script>
</body>
</html>
HTML

echo "✅ Created clear-storage.html"
echo ""
echo "📋 Next steps:"
echo "  1. Open clear-storage.html in your browser"
echo "  2. Or manually run in browser console: localStorage.clear(); sessionStorage.clear();"
echo "  3. Restart the app"
echo ""
echo "🎯 Fresh start ready!"

# Additional cleanup for Tauri app data directory (macOS)
APP_DATA_DIR="$HOME/Library/Application Support/com.handsfree.pos"
if [ -d "$APP_DATA_DIR" ]; then
    echo ""
    echo "🗑️  Found Tauri app data directory: $APP_DATA_DIR"
    rm -rf "$APP_DATA_DIR"
    echo "✅ Deleted Tauri app data directory"
else
    echo "ℹ️  No Tauri app data directory found"
fi

# Delete test databases
find . -name "test-*.db*" -type f -delete 2>/dev/null
echo "✅ Deleted test databases"

echo ""
echo "✨ Complete reset finished!"
