#!/bin/bash

# WiFi Device Auth Plugin Build Script
# Compiles Rust worker to WASM for Cloudflare Workers

set -e

echo "🔨 Building WiFi Device Auth Plugin..."

cd worker

# Build WASM
echo "📦 Compiling Rust to WASM..."
cargo build --target wasm32-unknown-unknown --release

# Get the output file
WASM_FILE="target/wasm32-unknown-unknown/release/wifi_device_auth_worker.wasm"

if [ -f "$WASM_FILE" ]; then
    SIZE=$(du -h "$WASM_FILE" | cut -f1)
    echo "✅ Build complete! WASM size: $SIZE"

    # Optimize with wasm-opt if available
    if command -v wasm-opt &> /dev/null; then
        echo "⚡ Optimizing WASM with wasm-opt..."
        wasm-opt -Oz "$WASM_FILE" -o "${WASM_FILE}.opt"
        mv "${WASM_FILE}.opt" "$WASM_FILE"

        NEW_SIZE=$(du -h "$WASM_FILE" | cut -f1)
        echo "✅ Optimized! New size: $NEW_SIZE"
    else
        echo "⚠️  wasm-opt not found. Install with: cargo install wasm-opt"
    fi

    echo ""
    echo "📍 Plugin artifacts:"
    echo "   WASM: $WASM_FILE"
    echo "   Manifest: ../manifest.json"
    echo "   Migration: ../migrations/001_wifi_device_auth.sql"
    echo ""
    echo "🚀 Ready to publish!"
else
    echo "❌ Build failed - WASM file not found"
    exit 1
fi

cd ..
