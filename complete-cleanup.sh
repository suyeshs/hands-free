#!/bin/bash
# Complete Cleanup Script
# Removes all build artifacts, databases, and application data

set -e

echo ""
echo "🧹 Complete Cleanup - HandsFree POS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Delete build artifacts
echo "📦 Cleaning build artifacts..."
rm -rf src-tauri/target
rm -rf dist
rm -rf .next
rm -rf node_modules/.vite
echo "✅ Build artifacts cleaned"

# 2. Delete all database files
echo ""
echo "🗄️  Deleting database files..."
rm -f *.db *.db-shm *.db-wal
rm -f pos.db pos-dev.db guanix.db
echo "✅ Database files deleted"

# 3. Delete Application Support folder
echo ""
echo "📁 Cleaning Application Support..."
APP_SUPPORT_DIR="$HOME/Library/Application Support/com.stonepot-tech.handsfree-pos"
if [ -d "$APP_SUPPORT_DIR" ]; then
  rm -rf "$APP_SUPPORT_DIR"
  echo "✅ Deleted: $APP_SUPPORT_DIR"
else
  echo "ℹ️  Application Support folder not found (already clean)"
fi

# Also check for com.guanix folder
GUANIX_DIR="$HOME/Library/Application Support/com.guanix"
if [ -d "$GUANIX_DIR" ]; then
  rm -rf "$GUANIX_DIR"
  echo "✅ Deleted: $GUANIX_DIR"
fi

# 4. Clear WebKit caches (where localStorage is stored)
echo ""
echo "🌐 Clearing WebKit caches..."
WEBKIT_DIR="$HOME/Library/WebKit/com.stonepot-tech.handsfree-pos"
if [ -d "$WEBKIT_DIR" ]; then
  rm -rf "$WEBKIT_DIR"
  echo "✅ Deleted: $WEBKIT_DIR"
fi

# Clear Tauri data directory
TAURI_DATA="$HOME/.tauri"
if [ -d "$TAURI_DATA" ]; then
  echo "⚠️  Found Tauri data directory: $TAURI_DATA"
  echo "   (Skipping - may contain other app data)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Cleanup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 What was cleaned:"
echo "   ✅ Build artifacts (target/, dist/)"
echo "   ✅ Database files (*.db)"
echo "   ✅ Application Support folders"
echo "   ✅ WebKit caches (localStorage)"
echo ""
echo "💡 Next steps:"
echo "   1. Rebuild: bun run tauri dev"
echo "   2. Fresh onboarding will appear"
echo "   3. All data will be recreated from scratch"
echo ""
