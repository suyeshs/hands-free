#!/bin/bash
set -e

echo "🔨 Building customer-crm client WASM..."

# Build the WASM module
cargo build --target wasm32-unknown-unknown --release

# Copy to dist folder
mkdir -p ../../../dist/plugins/customer-crm
cp target/wasm32-unknown-unknown/release/crm_client.wasm ../../../dist/plugins/customer-crm/customer-crm-client.wasm

echo "✅ customer-crm client WASM built successfully"
echo "📦 Output: dist/plugins/customer-crm/customer-crm-client.wasm"
ls -lh ../../../dist/plugins/customer-crm/customer-crm-client.wasm
