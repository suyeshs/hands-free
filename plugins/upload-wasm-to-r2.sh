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

# Define plugins array (id:version:filename)
declare -a PLUGINS=(
  "bar-management-v2:2.1.0:bar-client.wasm"
  "aggregator-integration-india:2.3.0:aggregator-client.wasm"
  "pos-core:3.0.0:pos-client.wasm"
  "inventory-management:2.5.0:inventory-management-client.wasm"
  "people-payroll:2.2.0:people-payroll-client.wasm"
  "analytics-reports:2.0.0:analytics-reports-client.wasm"
  "customer-crm:1.8.0:customer-crm-client.wasm"
  "multi-location-sync:1.8.0:multi-location-sync-client.wasm"
  "online-ordering-qr:2.1.0:online-ordering-qr-client.wasm"
)

COUNT=0
for plugin_info in "${PLUGINS[@]}"; do
  ((COUNT++))
  IFS=':' read -r plugin_id version filename <<< "$plugin_info"

  echo "$COUNT. Uploading $plugin_id/$filename..."

  wrangler r2 object put "$BUCKET_NAME/global/plugins/$plugin_id/$version/$filename" \
    --file="$DIST_DIR/$plugin_id/$filename" \
    --content-type="application/wasm" \
    --remote

  echo "   ✅ Uploaded to: global/plugins/$plugin_id/$version/$filename"
  echo ""
done

echo "✅ All $COUNT WASM files uploaded successfully!"
echo ""

# List uploaded files
echo "📦 Files in R2 bucket:"
wrangler r2 object list "$BUCKET_NAME" --prefix="global/plugins/" --remote
