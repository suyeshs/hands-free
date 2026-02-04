#!/bin/bash
# Kill all running instances of the restaurant POS app

echo "Killing restaurant POS app processes..."

# Kill by process name
pkill -f "restaurant-pos-ai" || true
pkill -f "HandsFree" || true
pkill -f "handsfree-pos" || true

# Kill Tauri dev processes
pkill -f "tauri dev" || true

# Kill any running Vite dev servers
pkill -f "vite" || true

echo "✅ All processes killed"
