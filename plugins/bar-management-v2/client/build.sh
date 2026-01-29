#!/bin/bash
# Build script for bar-client.wasm

set -e

echo "🔨 Building bar-client.wasm..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

# Build with wasm-pack
wasm-pack build --target web --release --out-dir ../../../dist/plugins/bar-management-v2

# Rename the output WASM file
cd ../../../dist/plugins/bar-management-v2
mv bar_client_bg.wasm bar-client.wasm
rm -f package.json .gitignore bar_client.js bar_client.d.ts bar_client_bg.wasm.d.ts

echo "✅ bar-client.wasm built successfully!"
echo "📦 Output: dist/plugins/bar-management-v2/bar-client.wasm"

# Show file size
ls -lh bar-client.wasm
