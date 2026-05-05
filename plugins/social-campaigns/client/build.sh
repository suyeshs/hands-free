#!/bin/bash

# Build script for Social Campaigns WASM plugin

set -e

echo "Building Social Campaigns WASM plugin..."

# Build WASM
wasm-pack build --target web --out-dir pkg --release

# Rename output
mv pkg/social_campaigns_client_bg.wasm ../social-campaigns-client.wasm
mv pkg/social_campaigns_client.js ../social-campaigns-client.js

echo "✓ Build complete: social-campaigns-client.wasm"
