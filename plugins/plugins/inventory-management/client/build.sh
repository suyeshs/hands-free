#!/bin/bash
set -e

echo "🔨 Building inventory-management client WASM..."

# Build the WASM module
cargo build --target wasm32-unknown-unknown --release

# Copy to dist folder
mkdir -p ../../../dist/plugins/inventory-management
cp target/wasm32-unknown-unknown/release/inventory_client.wasm ../../../dist/plugins/inventory-management/inventory-management-client.wasm

echo "✅ inventory-management client WASM built successfully"
echo "📦 Output: dist/plugins/inventory-management/inventory-management-client.wasm"
ls -lh ../../../dist/plugins/inventory-management/inventory-management-client.wasm
