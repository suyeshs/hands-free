#!/bin/bash

# Memory-Efficient Development Mode
# Reduces RAM usage by disabling unnecessary features during development

set -e

echo "🚀 Starting Guanix Restaurant in Memory-Efficient Dev Mode"
echo ""

# Check if QR ordering should be disabled
if [ "$1" == "--no-qr" ]; then
    echo "📋 QR Ordering: DISABLED (saves ~200-300MB RAM)"
    export DISABLE_QR_ORDERING=1
else
    echo "📋 QR Ordering: ENABLED"
    echo "   (Use --no-qr flag to disable and save RAM)"
fi

echo ""
echo "⚙️  Optimizations applied:"
echo "   • Vite: Minimal source maps, optimized watching"
echo "   • Rust: Incremental builds, limited debug info"
echo "   • Dependencies: Pre-bundled for faster startup"
echo ""

# Set memory limits for Node/Bun
export NODE_OPTIONS="--max-old-space-size=2048"

# Clean up old build artifacts to free space
echo "🧹 Cleaning old build artifacts..."
rm -rf dist/ dist-web/ 2>/dev/null || true

echo ""
echo "Starting development server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start Tauri dev with optimizations
RUST_LOG=warn bun tauri dev

