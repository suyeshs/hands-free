#!/bin/bash
# Force Complete Reset - Nuclear Option
# Clears absolutely everything including running processes

set -e

echo ""
echo "☢️  FORCE COMPLETE RESET - Nuclear Option"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Kill any running Tauri processes
echo "🔴 Stopping running processes..."
pkill -f "handsfree-pos" || echo "  No processes found"
pkill -f "guanix" || echo "  No guanix processes found"
sleep 1
echo "✅ Processes stopped"

# 2. Delete ALL database files everywhere
echo ""
echo "🗄️  Nuclear database cleanup..."
rm -f *.db *.db-shm *.db-wal
rm -f pos.db pos-dev.db guanix.db handsfree.db
find ~/Library/Application\ Support -type f -name "*.db*" 2>/dev/null | grep -iE "(handsfree|guanix|gaunix|pos)" | xargs rm -f || true
echo "✅ All databases nuked"

# 3. Delete ALL Application Support folders
echo ""
echo "📁 Nuclear Application Support cleanup..."
find ~/Library/Application\ Support -type d 2>/dev/null | grep -iE "(handsfree|guanix|gaunix)" | xargs rm -rf || true
echo "✅ Application Support nuked"

# 4. Clear WebKit/Safari storage
echo ""
echo "🌐 Nuclear WebKit cleanup..."
rm -rf ~/Library/WebKit/*handsfree* 2>/dev/null || true
rm -rf ~/Library/WebKit/*guanix* 2>/dev/null || true
rm -rf ~/Library/Safari/LocalStorage/*handsfree* 2>/dev/null || true
echo "✅ WebKit storage nuked"

# 5. Clear Tauri cache
echo ""
echo "📦 Nuclear Tauri cache cleanup..."
rm -rf ~/Library/Caches/*handsfree* 2>/dev/null || true
rm -rf ~/Library/Caches/*guanix* 2>/dev/null || true
echo "✅ Tauri cache nuked"

# 6. Clear build artifacts
echo ""
echo "🏗️  Nuclear build cleanup..."
rm -rf src-tauri/target/debug
rm -rf src-tauri/target/release
rm -rf dist
echo "✅ Build artifacts nuked"

# 7. Clear ANY remaining state
echo ""
echo "🧹 Final sweep..."
rm -rf ~/Library/Preferences/*handsfree* 2>/dev/null || true
rm -rf ~/Library/Preferences/*guanix* 2>/dev/null || true
rm -rf ~/Library/Saved\ Application\ State/*handsfree* 2>/dev/null || true
echo "✅ Preferences nuked"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☢️  NUCLEAR RESET COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💣 Everything destroyed:"
echo "   ☢️  Processes killed"
echo "   ☢️  Databases deleted"
echo "   ☢️  Application Support wiped"
echo "   ☢️  WebKit storage cleared"
echo "   ☢️  Tauri cache cleared"
echo "   ☢️  Build artifacts removed"
echo "   ☢️  Preferences cleared"
echo ""
echo "🔨 REBUILD NOW:"
echo "   bun run tauri dev"
echo ""
echo "✨ You will see the onboarding form (guaranteed!)"
echo ""
