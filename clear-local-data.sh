#!/bin/bash

# Clear Local Tenant Data for HandsFree POS
# This script removes all local app data, caches, and preferences

APP_ID="com.stonepot-tech.handsfree-pos"

echo "🧹 Clearing all local data for HandsFree POS..."
echo ""

# Application Support
if [ -d ~/Library/Application\ Support/$APP_ID ]; then
  echo "  • Removing Application Support..."
  rm -rf ~/Library/Application\ Support/$APP_ID/
fi

# Caches
if [ -d ~/Library/Caches/$APP_ID ]; then
  echo "  • Removing Caches..."
  rm -rf ~/Library/Caches/$APP_ID/
fi

# WebKit
if [ -d ~/Library/WebKit/$APP_ID ]; then
  echo "  • Removing WebKit data..."
  rm -rf ~/Library/WebKit/$APP_ID/
fi

# Saved Application State
if [ -d ~/Library/Saved\ Application\ State/$APP_ID.savedState ]; then
  echo "  • Removing Saved Application State..."
  rm -rf ~/Library/Saved\ Application\ State/$APP_ID.savedState 2>/dev/null || true
fi

# Preferences
if [ -f ~/Library/Preferences/$APP_ID.plist ]; then
  echo "  • Removing Preferences..."
  rm -rf ~/Library/Preferences/$APP_ID.plist 2>/dev/null || true
fi

# HTTP Storages
if [ -d ~/Library/HTTPStorages/$APP_ID ]; then
  echo "  • Removing HTTP Storages..."
  rm -rf ~/Library/HTTPStorages/$APP_ID/ 2>/dev/null || true
fi

# Containers
if [ -d ~/Library/Containers/$APP_ID ]; then
  echo "  • Removing Containers..."
  rm -rf ~/Library/Containers/$APP_ID/ 2>/dev/null || true
fi

# Logs
if [ -d ~/Library/Logs/$APP_ID ]; then
  echo "  • Removing Logs..."
  rm -rf ~/Library/Logs/$APP_ID/ 2>/dev/null || true
fi

echo ""
echo "✅ All local data cleared successfully!"
echo ""
echo "You can now:"
echo "  1. Rebuild and run the app: npm run tauri dev"
echo "  2. Or run the installed app for a fresh start"
