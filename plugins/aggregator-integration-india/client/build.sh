#!/bin/bash
# Build script for aggregator-client.wasm

set -e

echo "🔨 Building aggregator-client.wasm..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

# Build with wasm-pack
wasm-pack build --target web --release --out-dir ../../../dist/plugins/aggregator-integration-india

# Rename the output WASM file
cd ../../../dist/plugins/aggregator-integration-india
mv aggregator_client_bg.wasm aggregator-client.wasm
rm -f package.json .gitignore aggregator_client.js aggregator_client.d.ts aggregator_client_bg.wasm.d.ts

echo "✅ aggregator-client.wasm built successfully!"
echo "📦 Output: dist/plugins/aggregator-integration-india/aggregator-client.wasm"

# Show file size
ls -lh aggregator-client.wasm
