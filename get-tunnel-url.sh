#!/bin/bash

echo "🔍 Getting Cloudflared Tunnel URL..."
echo ""

# Find cloudflared process
PID=$(ps aux | grep "cloudflared.*tunnel" | grep -v grep | awk '{print $2}' | head -1)

if [ -z "$PID" ]; then
    echo "❌ Cloudflared is not running"
    echo ""
    echo "Start it from: Settings → QR Code Ordering → Start Tunnel"
    exit 1
fi

echo "✅ Cloudflared is running (PID: $PID)"
echo ""

# Check if we can get the URL from lsof (it might show the connection)
echo "Checking for active tunnel connections..."
CONN=$(lsof -p $PID 2>/dev/null | grep trycloudflare)

if [ ! -z "$CONN" ]; then
    echo "Found connection:"
    echo "$CONN"
    echo ""
fi

# Try to read from process logs
echo "📋 Instructions to get the tunnel URL:"
echo ""
echo "1. The tunnel is running, but we need to capture its output"
echo "2. Option A - Check your terminal where you ran 'bun tauri dev'"
echo "   Look for: '[Tunnel] Your quick Tunnel: https://...'"
echo ""
echo "3. Option B - Run cloudflared directly to get the URL:"
echo "   cd src-tauri/target/debug/cloudflared"
echo "   ./cloudflared-darwin-arm64 tunnel --url http://localhost:3000"
echo "   (This will show: 'Your quick Tunnel: https://...')"
echo ""
echo "4. Option C - Try this quick test:"
echo "   We'll try to extract it from the running process..."
echo ""

# Check if we have a log file
LOG_FILE="/tmp/cloudflared-$PID.log"
if [ -f "$LOG_FILE" ]; then
    echo "Found log file: $LOG_FILE"
    TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG_FILE" | head -1)
    if [ ! -z "$TUNNEL_URL" ]; then
        echo ""
        echo "🎉 FOUND TUNNEL URL:"
        echo "   $TUNNEL_URL"
        echo ""
        echo "Now:"
        echo "1. Open: fix-tunnel-state.html"
        echo "2. Paste: $TUNNEL_URL"
        echo "3. Click 'Save Tunnel URL'"
        echo "4. Refresh your app"
        exit 0
    fi
fi

# If we can't find it, provide alternative methods
echo ""
echo "⚠️  Could not auto-extract URL. Please manually check:"
echo ""
echo "METHOD 1: Check your Tauri dev terminal output"
echo "  - Look for '[Tunnel] Your quick Tunnel: https://...'"
echo ""
echo "METHOD 2: Restart tunnel with visible output"
echo "  - Stop current tunnel (killall cloudflared)"
echo "  - Start new tunnel: cd src-tauri/target/debug/cloudflared && ./cloudflared-darwin-arm64 tunnel --url http://localhost:3000"
echo "  - Copy the URL it shows"
echo ""
echo "METHOD 3: Use Tauri invoke command"
echo "  - Open browser DevTools (F12)"
echo "  - Run: await window.__TAURI__.core.invoke('get_tunnel_url')"
echo ""

