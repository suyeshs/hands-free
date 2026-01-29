#!/bin/bash
set -e

echo "🔨 Building POS Core client WASM..."

# Build the WASM module
cargo build --target wasm32-unknown-unknown --release

# Copy to dist folder
mkdir -p ../../../dist/plugins/pos-core
cp target/wasm32-unknown-unknown/release/pos_client.wasm ../../../dist/plugins/pos-core/pos-client.wasm

echo "✅ POS Core client WASM built successfully"
echo "📦 Output: dist/plugins/pos-core/pos-client.wasm"
ls -lh ../../../dist/plugins/pos-core/pos-client.wasm
