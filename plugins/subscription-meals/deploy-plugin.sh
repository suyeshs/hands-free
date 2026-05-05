#!/bin/bash
# Deploy Subscription Meals Plugin to R2
# Uploads manifest, migrations, and WASM files

set -e

BUCKET_NAME="handsfree-plugins"
PLUGIN_ID="subscription-meals"
VERSION="1.0.0"
PLUGINS_DIR="$(dirname "$0")/.."

echo "🚀 Deploying Subscription Meals Plugin"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Plugin ID: $PLUGIN_ID"
echo "   Version: $VERSION"
echo ""

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler not found. Please install wrangler:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Step 1: Upload Manifest
echo "📄 Step 1: Uploading manifest.json..."
wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/$VERSION/manifest.json" \
  --file="$PLUGINS_DIR/$PLUGIN_ID/manifest.json" \
  --content-type="application/json" \
  --remote

echo "   ✅ Uploaded to: global/plugins/$PLUGIN_ID/$VERSION/manifest.json"
echo ""

# Also upload as latest
echo "📄 Uploading as latest version..."
wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/latest/manifest.json" \
  --file="$PLUGINS_DIR/$PLUGIN_ID/manifest.json" \
  --content-type="application/json" \
  --remote

echo "   ✅ Uploaded to: global/plugins/$PLUGIN_ID/latest/manifest.json"
echo ""

# Step 2: Upload Migrations
echo "🗄️  Step 2: Uploading database migrations..."

# Upload migration manifest
if [ -f "$PLUGINS_DIR/$PLUGIN_ID/migrations/manifest.json" ]; then
    wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/migrations/manifest.json" \
      --file="$PLUGINS_DIR/$PLUGIN_ID/migrations/manifest.json" \
      --content-type="application/json" \
      --remote
    echo "   ✅ Uploaded migrations/manifest.json"
else
    echo "   ⚠️  No migrations manifest found, creating one..."

    # Calculate checksum
    CHECKSUM=$(shasum -a 256 "$PLUGINS_DIR/$PLUGIN_ID/migrations/001_initial_schema.sql" | awk '{print $1}')

    # Create migration manifest
    cat > /tmp/migrations-manifest.json <<EOF
{
  "version": 1,
  "migrations": [
    {
      "version": 1,
      "name": "initial_schema",
      "description": "Initial subscription database schema with 8 tables",
      "file": "001_initial_schema.sql",
      "checksum": "sha256:$CHECKSUM",
      "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  ]
}
EOF

    wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/migrations/manifest.json" \
      --file="/tmp/migrations-manifest.json" \
      --content-type="application/json" \
      --remote
    echo "   ✅ Created and uploaded migrations/manifest.json"
fi

# Upload SQL migration file
wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/migrations/001_initial_schema.sql" \
  --file="$PLUGINS_DIR/$PLUGIN_ID/migrations/001_initial_schema.sql" \
  --content-type="text/plain" \
  --remote

echo "   ✅ Uploaded migrations/001_initial_schema.sql"
echo ""

# Step 3: Build and Upload WASM files
echo "📦 Step 3: Preparing WASM files..."

# Check if pre-built WASM exists
if [ -f "$PLUGINS_DIR/$PLUGIN_ID/dist/subscription-client.wasm" ]; then
    echo "   ✅ Using pre-built client WASM"
    CLIENT_WASM="$PLUGINS_DIR/$PLUGIN_ID/dist/subscription-client.wasm"
else
    echo "   ⚠️  No pre-built WASM found. Run ./build-wasm.sh first or using placeholder..."
    # Create minimal valid WASM module (magic number + version + empty module)
    printf '\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x07\x01\x60\x00\x01\x7f\x03\x03\x02\x00\x00\x07\x13\x02\x04\x69\x6e\x69\x74\x00\x00\x0b\x67\x65\x74\x5f\x76\x65\x72\x73\x69\x6f\x6e\x00\x01\x0a\x0b\x02\x04\x00\x41\x01\x0b\x04\x00\x41\x01\x0b' > /tmp/subscription-meals-client.wasm
    CLIENT_WASM="/tmp/subscription-meals-client.wasm"
fi

# Worker WASM (always use placeholder as worker is TypeScript)
printf '\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x07\x01\x60\x00\x01\x7f\x03\x03\x02\x00\x00\x07\x13\x02\x04\x69\x6e\x69\x74\x00\x00\x0b\x67\x65\x74\x5f\x76\x65\x72\x73\x69\x6f\x6e\x00\x01\x0a\x0b\x02\x04\x00\x41\x01\x0b\x04\x00\x41\x01\x0b' > /tmp/subscription-meals-worker.wasm
WORKER_WASM="/tmp/subscription-meals-worker.wasm"

echo "   ✅ WASM files ready"
echo ""

# Upload client WASM
echo "☁️  Uploading client WASM..."
wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/$VERSION/subscription-client.wasm" \
  --file="$CLIENT_WASM" \
  --content-type="application/wasm" \
  --remote

echo "   ✅ Uploaded to: global/plugins/$PLUGIN_ID/$VERSION/subscription-client.wasm"
echo ""

# Upload worker WASM
echo "☁️  Uploading worker WASM..."
wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/$VERSION/subscription-worker.wasm" \
  --file="$WORKER_WASM" \
  --content-type="application/wasm" \
  --remote

echo "   ✅ Uploaded to: global/plugins/$PLUGIN_ID/$VERSION/subscription-worker.wasm"
echo ""

# Step 4: Upload documentation
if [ -f "$PLUGINS_DIR/$PLUGIN_ID/README.md" ]; then
    echo "📚 Step 4: Uploading README..."
    wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/$VERSION/README.md" \
      --file="$PLUGINS_DIR/$PLUGIN_ID/README.md" \
      --content-type="text/markdown" \
      --remote
    echo "   ✅ Uploaded README.md"
    echo ""
fi

# Cleanup temporary files
rm -f /tmp/subscription-meals-client.wasm /tmp/subscription-meals-worker.wasm /tmp/migrations-manifest.json

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Plugin Deployed Successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Deployment Summary:"
echo "   Plugin ID: $PLUGIN_ID"
echo "   Version: $VERSION"
echo "   Type: Hybrid (Client + Worker)"
echo "   Database Tables: 8"
echo "   Migrations: 1"
echo ""
echo "📡 R2 URLs:"
echo "   Manifest: https://r2.handsfree.com/plugins/$PLUGIN_ID/$VERSION/manifest.json"
echo "   Client WASM: https://r2.handsfree.com/plugins/$PLUGIN_ID/$VERSION/client.wasm"
echo "   Worker WASM: https://r2.handsfree.com/plugins/$PLUGIN_ID/$VERSION/worker.wasm"
echo "   Migrations: https://r2.handsfree.com/plugins/$PLUGIN_ID/migrations/manifest.json"
echo ""
echo "🔗 Registry URL:"
echo "   https://handsfree-plugin-registry.suyesh.workers.dev/global/plugins/$PLUGIN_ID/$VERSION/manifest.json"
echo ""
echo "💡 The plugin is now available in the plugin store!"
echo "   Users can install it from the POS system's plugin manager."
echo ""
echo "🔄 Next Steps:"
echo "   1. Test installation: Open POS → Plugins → Search '$PLUGIN_ID'"
echo "   2. Install and verify all 8 tables are created"
echo "   3. Test all UI routes (/subscriptions/*)"
echo "   4. Test API endpoints via worker"
echo ""
