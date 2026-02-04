#!/bin/bash
# Upload WASM files to Cloudflare R2

set -e

BUCKET_NAME="handsfree-plugins"
PLUGINS_DIR="."

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
  "inventory-management:2.5.0:inventory-management-client.wasm"
  "people-payroll:2.2.0:people-payroll-client.wasm"
  "analytics-reports:2.0.0:analytics-reports-client.wasm"
  "customer-crm:1.8.0:customer-crm-client.wasm"
  "multi-location-sync:1.8.0:multi-location-sync-client.wasm"
  "online-ordering-qr:2.1.0:online-ordering-qr-client.wasm"
  "vision-ai:1.0.0:vision-client.wasm"
)

COUNT=0
for plugin_info in "${PLUGINS[@]}"; do
  ((COUNT++))
  IFS=':' read -r plugin_id version filename <<< "$plugin_info"

  # Determine file path based on plugin structure
  if [ -f "$PLUGINS_DIR/$plugin_id/$filename" ]; then
    FILE_PATH="$PLUGINS_DIR/$plugin_id/$filename"
  elif [ -f "$PLUGINS_DIR/$plugin_id/client/pkg/$filename" ]; then
    FILE_PATH="$PLUGINS_DIR/$plugin_id/client/pkg/$filename"
  else
    echo "❌ $COUNT. Cannot find $filename for $plugin_id"
    continue
  fi

  echo "$COUNT. Uploading $plugin_id/$filename..."

  wrangler r2 object put "$BUCKET_NAME/global/plugins/$plugin_id/$version/$filename" \
    --file="$FILE_PATH" \
    --content-type="application/wasm" \
    --remote

  echo "   ✅ Uploaded to: global/plugins/$plugin_id/$version/$filename"

  # For hybrid plugins, also upload worker WASM if it exists
  if [ "$plugin_id" == "vision-ai" ]; then
    WORKER_FILE="${filename/client/worker}"
    if [ -f "$PLUGINS_DIR/$plugin_id/$WORKER_FILE" ]; then
      echo "   Uploading worker WASM: $WORKER_FILE..."
      wrangler r2 object put "$BUCKET_NAME/global/plugins/$plugin_id/$version/$WORKER_FILE" \
        --file="$PLUGINS_DIR/$plugin_id/$WORKER_FILE" \
        --content-type="application/wasm" \
        --remote
      echo "   ✅ Uploaded to: global/plugins/$plugin_id/$version/$WORKER_FILE"
    fi
  fi

  echo ""
done

echo "✅ All $COUNT WASM files uploaded successfully!"
echo ""

# List uploaded files
echo "📦 Files in R2 bucket:"
wrangler r2 object list "$BUCKET_NAME" --prefix="global/plugins/" --remote
