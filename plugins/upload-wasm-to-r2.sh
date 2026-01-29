#!/bin/bash
# Upload WASM files to Cloudflare R2

set -e

BUCKET_NAME="handsfree-plugins"
DIST_DIR="../dist/plugins"

echo "🚀 Uploading WASM files to R2 bucket: $BUCKET_NAME"
echo ""

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler not found. Please install wrangler:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Upload bar-management-v2 WASM
echo "1️⃣  Uploading bar-management-v2/bar-client.wasm..."
wrangler r2 object put "$BUCKET_NAME/global/plugins/bar-management-v2/2.1.0/bar-client.wasm" \
  --file="$DIST_DIR/bar-management-v2/bar-client.wasm" \
  --content-type="application/wasm"

echo "   ✅ Uploaded to: global/plugins/bar-management-v2/2.1.0/bar-client.wasm"
echo ""

# Upload aggregator-integration-india WASM
echo "2️⃣  Uploading aggregator-integration-india/aggregator-client.wasm..."
wrangler r2 object put "$BUCKET_NAME/global/plugins/aggregator-integration-india/2.3.0/aggregator-client.wasm" \
  --file="$DIST_DIR/aggregator-integration-india/aggregator-client.wasm" \
  --content-type="application/wasm"

echo "   ✅ Uploaded to: global/plugins/aggregator-integration-india/2.3.0/aggregator-client.wasm"
echo ""

echo "✅ All WASM files uploaded successfully!"
echo ""

# List uploaded files
echo "📦 Files in R2 bucket:"
wrangler r2 object list "$BUCKET_NAME" --prefix="global/plugins/"
