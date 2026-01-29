#!/bin/bash
# Master build script for all plugins

set -e

echo "🚀 Building all plugin WASM modules..."
echo ""

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Please install Rust:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Add wasm32 target if not present
rustup target add wasm32-unknown-unknown 2>/dev/null || true

# Build bar management client
echo "1️⃣  Building bar-management-v2 client..."
cd bar-management-v2/client
./build.sh
cd ../..
echo ""

# Build aggregator integration client
echo "2️⃣  Building aggregator-integration-india client..."
cd aggregator-integration-india/client
./build.sh
cd ../..
echo ""

echo "✅ All plugins built successfully!"
echo ""
echo "📦 Output directory: dist/plugins/"
echo ""

# Show all built WASM files
echo "Built WASM files:"
find ../dist/plugins -name "*.wasm" -type f -exec ls -lh {} \;
