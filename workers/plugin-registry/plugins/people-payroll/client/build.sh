#!/bin/bash
set -e

echo "🔨 Building people-payroll client WASM..."

# Build the WASM module
cargo build --target wasm32-unknown-unknown --release

# Copy to dist folder
mkdir -p ../../../dist/plugins/people-payroll
cp target/wasm32-unknown-unknown/release/people_client.wasm ../../../dist/plugins/people-payroll/people-payroll-client.wasm

echo "✅ people-payroll client WASM built successfully"
echo "📦 Output: dist/plugins/people-payroll/people-payroll-client.wasm"
ls -lh ../../../dist/plugins/people-payroll/people-payroll-client.wasm
