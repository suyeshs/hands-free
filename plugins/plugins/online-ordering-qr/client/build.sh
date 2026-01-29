#!/bin/bash
set -e

echo "🔨 Building online-ordering-qr client WASM..."

# Build the WASM module
cargo build --target wasm32-unknown-unknown --release

# Copy to dist folder
mkdir -p ../../../dist/plugins/online-ordering-qr
cp target/wasm32-unknown-unknown/release/qr_client.wasm ../../../dist/plugins/online-ordering-qr/online-ordering-qr-client.wasm

echo "✅ online-ordering-qr client WASM built successfully"
echo "📦 Output: dist/plugins/online-ordering-qr/online-ordering-qr-client.wasm"
ls -lh ../../../dist/plugins/online-ordering-qr/online-ordering-qr-client.wasm
