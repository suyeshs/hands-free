#!/bin/bash

# Restart Tunnel Helper Script

echo "🔄 Restarting cloudflared tunnel..."
echo ""
echo "1. Open your POS app"
echo "2. Navigate to: Settings → QR Code Ordering"
echo "3. Click 'Stop Tunnel' (if running)"
echo "4. Wait 2 seconds"
echo "5. Click 'Start Tunnel'"
echo "6. Watch the console for the tunnel URL"
echo ""
echo "Look for this line in the output:"
echo "  'Your quick Tunnel: https://something-random.trycloudflare.com'"
echo ""
echo "If you see the URL but the button still doesn't show:"
echo "  - Open fix-tunnel-state.html"
echo "  - Paste the tunnel URL"
echo "  - Click 'Save Tunnel URL'"
echo ""
