#!/bin/bash
set -e

echo "🔨 Building analytics-reports client WASM..."

# Build the WASM module
cargo build --target wasm32-unknown-unknown --release

# Copy to dist folder
mkdir -p ../../../dist/plugins/analytics-reports
cp target/wasm32-unknown-unknown/release/analytics_client.wasm ../../../dist/plugins/analytics-reports/analytics-reports-client.wasm

echo "✅ analytics-reports client WASM built successfully"
echo "📦 Output: dist/plugins/analytics-reports/analytics-reports-client.wasm"
ls -lh ../../../dist/plugins/analytics-reports/analytics-reports-client.wasm
