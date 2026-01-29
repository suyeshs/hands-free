#!/bin/bash
set -e

echo "🔨 Building multi-location-sync client WASM..."

# Build the WASM module
cargo build --target wasm32-unknown-unknown --release

# Copy to dist folder
mkdir -p ../../../dist/plugins/multi-location-sync
cp target/wasm32-unknown-unknown/release/multilocation_client.wasm ../../../dist/plugins/multi-location-sync/multi-location-sync-client.wasm

echo "✅ multi-location-sync client WASM built successfully"
echo "📦 Output: dist/plugins/multi-location-sync/multi-location-sync-client.wasm"
ls -lh ../../../dist/plugins/multi-location-sync/multi-location-sync-client.wasm
