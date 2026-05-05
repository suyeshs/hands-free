#!/bin/bash

# WhatsApp Business Plugin - Build Script
# Builds both worker and client WASM plugins

set -e

echo "🔨 Building WhatsApp Business Plugin..."

# Check if wasm-opt is installed
if ! command -v wasm-opt &> /dev/null; then
    echo "⚠️  wasm-opt not found. Install it for optimized builds:"
    echo "   brew install binaryen"
    echo "   or download from: https://github.com/WebAssembly/binaryen/releases"
fi

# Build worker plugin
echo ""
echo "📦 Building worker plugin..."
cd worker
cargo build --target wasm32-unknown-unknown --release

if [ $? -eq 0 ]; then
    echo "✅ Worker plugin built successfully"

    if command -v wasm-opt &> /dev/null; then
        echo "🔧 Optimizing worker WASM..."
        wasm-opt -Oz -o ../whatsapp-worker.wasm \
            target/wasm32-unknown-unknown/release/whatsapp_business_worker.wasm

        WORKER_SIZE=$(du -h ../whatsapp-worker.wasm | cut -f1)
        echo "✅ Optimized worker plugin: $WORKER_SIZE"
    else
        cp target/wasm32-unknown-unknown/release/whatsapp_business_worker.wasm \
            ../whatsapp-worker.wasm
        echo "⚠️  Worker plugin built without optimization"
    fi
else
    echo "❌ Worker plugin build failed"
    exit 1
fi

cd ..

# Build client plugin (placeholder - to be implemented)
echo ""
echo "📦 Building client plugin..."
echo "⚠️  Client plugin not yet implemented - creating placeholder"

# Create placeholder client WASM
echo -e '\x00\x61\x73\x6d\x01\x00\x00\x00' > whatsapp-client.wasm

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Output files:"
echo "   - whatsapp-worker.wasm (Worker plugin)"
echo "   - whatsapp-client.wasm (Client plugin - placeholder)"
echo ""
echo "📋 Next steps:"
echo "   1. Generate checksums: ./generate-checksums.sh"
echo "   2. Test locally: wrangler dev"
echo "   3. Deploy: wrangler deploy"
echo ""
