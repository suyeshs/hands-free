#!/bin/bash
set -e

echo "🔨 Building Aggregator Integration Plugin..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Rust is not installed${NC}"
    echo "Install Rust from https://rustup.rs/"
    exit 1
fi

# Check if wasm32-unknown-unknown target is installed
if ! rustup target list | grep -q "wasm32-unknown-unknown (installed)"; then
    echo -e "${YELLOW}⚙️  Installing wasm32-unknown-unknown target...${NC}"
    rustup target add wasm32-unknown-unknown
fi

# Check if wasm-bindgen-cli is installed
if ! command -v wasm-bindgen &> /dev/null; then
    echo -e "${YELLOW}⚙️  Installing wasm-bindgen-cli...${NC}"
    cargo install wasm-bindgen-cli
fi

# Create dist directory
mkdir -p dist

echo -e "${YELLOW}📦 Building client plugin...${NC}"
cd client
cargo build --target wasm32-unknown-unknown --release

# Run wasm-bindgen to generate JS bindings
wasm-bindgen \
    --target web \
    --out-dir ../dist \
    --out-name aggregator-client \
    target/wasm32-unknown-unknown/release/aggregator_integration_client.wasm

# Copy just the WASM file to dist
cp target/wasm32-unknown-unknown/release/aggregator_integration_client.wasm ../dist/aggregator-client.wasm

cd ..

echo -e "${YELLOW}📦 Building worker plugin...${NC}"
cd worker
cargo build --target wasm32-unknown-unknown --release

# Copy worker WASM to dist
cp target/wasm32-unknown-unknown/release/aggregator_integration_worker.wasm ../dist/aggregator-worker.wasm

cd ..

# Copy manifest
echo -e "${YELLOW}📋 Copying manifest...${NC}"
cp manifest.json dist/

# Generate checksums
echo -e "${YELLOW}🔐 Generating checksums...${NC}"
cd dist

# Calculate SHA-256 checksums
CLIENT_CHECKSUM=$(shasum -a 256 aggregator-client.wasm | awk '{print $1}')
WORKER_CHECKSUM=$(shasum -a 256 aggregator-worker.wasm | awk '{print $1}')
COMBINED_CHECKSUM=$(echo -n "${CLIENT_CHECKSUM}${WORKER_CHECKSUM}" | shasum -a 256 | awk '{print $1}')

echo -e "${GREEN}✅ Client checksum: sha256:${CLIENT_CHECKSUM}${NC}"
echo -e "${GREEN}✅ Worker checksum: sha256:${WORKER_CHECKSUM}${NC}"
echo -e "${GREEN}✅ Combined checksum: sha256:${COMBINED_CHECKSUM}${NC}"

# Update manifest with checksum
sed -i.bak "s/sha256:placeholder-will-be-generated-on-build/sha256:${COMBINED_CHECKSUM}/" manifest.json
rm manifest.json.bak

cd ..

# Get file sizes
CLIENT_SIZE=$(ls -lh dist/aggregator-client.wasm | awk '{print $5}')
WORKER_SIZE=$(ls -lh dist/aggregator-worker.wasm | awk '{print $5}')

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "📦 Output files:"
echo "   - dist/aggregator-client.wasm (${CLIENT_SIZE})"
echo "   - dist/aggregator-worker.wasm (${WORKER_SIZE})"
echo "   - dist/manifest.json"
echo ""
echo "📤 To publish to registry:"
echo "   Upload files from dist/ to R2 bucket"
echo "   Path: /global/plugins/aggregator-integration/1.0.0/"
echo ""
echo "🎯 Next steps:"
echo "   1. Test plugin locally with POS app"
echo "   2. Deploy worker plugin to handsfree-tenant-router"
echo "   3. Upload to plugin registry (R2 + KV)"
echo "   4. Configure DOM selectors for Swiggy/Zomato"
echo ""
