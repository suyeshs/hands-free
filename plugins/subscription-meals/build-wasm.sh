#!/bin/bash
# Build WASM components for Subscription Meals Plugin

set -e

echo "🦀 Building Subscription Meals Plugin - WASM Components"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

# Build client WASM
echo ""
echo "📦 Building client WASM..."
cd "$PLUGIN_DIR"
wasm-pack build --target web --out-dir dist/wasm --out-name subscription-client

if [ $? -eq 0 ]; then
    echo "✅ Client WASM built successfully"
    # Rename the .wasm file to match manifest
    mv dist/wasm/subscription-client_bg.wasm dist/wasm/subscription-client.wasm 2>/dev/null || true
else
    echo "❌ Client WASM build failed"
    exit 1
fi

# Create worker WASM placeholder (since worker is TypeScript)
echo ""
echo "📦 Creating worker WASM placeholder..."
mkdir -p dist/wasm
cat > dist/wasm/subscription-worker.wasm.info << 'EOF'
Worker WASM Placeholder

The subscription worker is implemented in TypeScript and runs on Cloudflare Workers.
It does not require a separate WASM build.

Location: plugins/subscription-meals/worker/src/index.ts
Build: cd worker && npm run build
Deploy: cd worker && npm run deploy
EOF

# Copy WASM files to dist root
echo ""
echo "📋 Organizing WASM artifacts..."
cp dist/wasm/subscription-client.wasm dist/ 2>/dev/null || echo "⚠️  Client WASM not found (check build output)"
cp dist/wasm/subscription-client.js dist/ 2>/dev/null || true

# Calculate checksums
if [ -f dist/subscription-client.wasm ]; then
    echo ""
    echo "🔐 Calculating checksums..."
    if command -v sha256sum &> /dev/null; then
        CLIENT_HASH=$(sha256sum dist/subscription-client.wasm | awk '{print $1}')
    elif command -v shasum &> /dev/null; then
        CLIENT_HASH=$(shasum -a 256 dist/subscription-client.wasm | awk '{print $1}')
    else
        CLIENT_HASH="checksum-tool-not-available"
    fi

    echo "Client WASM SHA256: $CLIENT_HASH"
    echo "$CLIENT_HASH" > dist/subscription-client.wasm.sha256
fi

# Generate build info
cat > dist/build-info.json << EOF
{
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": "1.0.0",
  "components": {
    "client": {
      "format": "wasm",
      "file": "subscription-client.wasm",
      "size": "$(wc -c < dist/subscription-client.wasm 2>/dev/null || echo 0)",
      "checksum": "${CLIENT_HASH:-pending}"
    },
    "worker": {
      "format": "typescript",
      "file": "worker/src/index.ts",
      "deployment": "cloudflare-workers"
    }
  }
}
EOF

echo ""
echo "✅ WASM build complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh dist/*.wasm 2>/dev/null || echo "⚠️  No WASM files found in dist/"
echo ""
echo "📁 Build artifacts:"
echo "   • Client WASM: dist/subscription-client.wasm"
echo "   • Build Info: dist/build-info.json"
echo ""
echo "Next steps:"
echo "   1. Deploy worker: cd worker && npm run deploy"
echo "   2. Upload plugin: ./deploy-plugin.sh"
echo ""
