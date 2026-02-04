#!/bin/bash

# Vision AI Plugin Build Script
# Compiles Rust WASM modules for client and worker

set -e

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Building Vision AI plugin from: $PLUGIN_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Build client WASM
echo -e "${BLUE}Building client WASM...${NC}"
cd "$PLUGIN_DIR/client"
cargo build --release --target wasm32-unknown-unknown

if [ -f "target/wasm32-unknown-unknown/release/vision_client.wasm" ]; then
    cp target/wasm32-unknown-unknown/release/vision_client.wasm "$PLUGIN_DIR/vision-client.wasm"
    echo -e "${GREEN}✓ Client WASM built successfully${NC}"
else
    echo -e "${RED}✗ Client WASM build failed${NC}"
    exit 1
fi

# Build worker WASM
echo -e "${BLUE}Building worker WASM...${NC}"
cd "$PLUGIN_DIR/worker"
cargo build --release --target wasm32-unknown-unknown

if [ -f "target/wasm32-unknown-unknown/release/vision_worker.wasm" ]; then
    cp target/wasm32-unknown-unknown/release/vision_worker.wasm "$PLUGIN_DIR/vision-worker.wasm"
    echo -e "${GREEN}✓ Worker WASM built successfully${NC}"
else
    echo -e "${RED}✗ Worker WASM build failed${NC}"
    exit 1
fi

# Calculate checksums
echo -e "${BLUE}Calculating checksums...${NC}"
cd "$PLUGIN_DIR"

CLIENT_CHECKSUM=$(shasum -a 256 vision-client.wasm | awk '{print $1}')
WORKER_CHECKSUM=$(shasum -a 256 vision-worker.wasm | awk '{print $1}')

echo "Client checksum: $CLIENT_CHECKSUM"
echo "Worker checksum: $WORKER_CHECKSUM"

# Update manifest with checksum
COMBINED_CHECKSUM="${CLIENT_CHECKSUM:0:16}${WORKER_CHECKSUM:0:16}"
sed -i '' "s/\"checksum\": \"sha256:.*\"/\"checksum\": \"sha256:$COMBINED_CHECKSUM\"/" manifest.json

echo -e "${GREEN}✓ Vision AI plugin built successfully!${NC}"
echo ""
echo "Files created:"
echo "  - vision-client.wasm ($(du -h vision-client.wasm | cut -f1))"
echo "  - vision-worker.wasm ($(du -h vision-worker.wasm | cut -f1))"
echo ""
echo "Next steps:"
echo "1. Test locally: bun run dev"
echo "2. Upload to R2: ../upload-wasm-to-r2.sh vision-ai"
echo "3. Publish to registry: Update metadata in plugin-registry"
