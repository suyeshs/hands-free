#!/bin/bash
# Upload plugin manifest JSON files to Cloudflare R2

set -e

BUCKET_NAME="handsfree-plugins"
PLUGIN_ID="${1:-recamera}"

echo "🚀 Uploading plugin manifest for: $PLUGIN_ID"
echo ""

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler not found. Please install wrangler:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if plugin exists
if [ ! -d "plugins/$PLUGIN_ID" ]; then
    echo "❌ Plugin directory not found: plugins/$PLUGIN_ID"
    exit 1
fi

# Check if manifest exists
if [ ! -f "plugins/$PLUGIN_ID/manifest.json" ]; then
    # Try sample plugin
    if [ -f "plugins/sample-plugins/$PLUGIN_ID.json" ]; then
        MANIFEST_PATH="plugins/sample-plugins/$PLUGIN_ID.json"
        echo "📄 Using sample plugin manifest: $MANIFEST_PATH"
    else
        echo "❌ Manifest not found: plugins/$PLUGIN_ID/manifest.json"
        exit 1
    fi
else
    MANIFEST_PATH="plugins/$PLUGIN_ID/manifest.json"
fi

# Get version from manifest
VERSION=$(grep -o '"version": *"[^"]*"' "$MANIFEST_PATH" | sed 's/"version": *"\([^"]*\)"/\1/')

if [ -z "$VERSION" ]; then
    echo "❌ Could not extract version from manifest"
    exit 1
fi

echo "📦 Plugin: $PLUGIN_ID v$VERSION"
echo "📄 Manifest: $MANIFEST_PATH"
echo ""

# Upload manifest
echo "Uploading manifest..."
wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/$VERSION/manifest.json" \
  --file="$MANIFEST_PATH" \
  --content-type="application/json" \
  --remote

echo "✅ Uploaded to: global/plugins/$PLUGIN_ID/$VERSION/manifest.json"
echo ""

# Also upload as latest
echo "Uploading as latest..."
wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/latest/manifest.json" \
  --file="$MANIFEST_PATH" \
  --content-type="application/json" \
  --remote

echo "✅ Uploaded to: global/plugins/$PLUGIN_ID/latest/manifest.json"
echo ""

# Upload README if it exists
if [ -f "plugins/$PLUGIN_ID/README.md" ]; then
    echo "Uploading README..."
    wrangler r2 object put "$BUCKET_NAME/global/plugins/$PLUGIN_ID/$VERSION/README.md" \
      --file="plugins/$PLUGIN_ID/README.md" \
      --content-type="text/markdown" \
      --remote
    echo "✅ Uploaded README"
    echo ""
fi

echo "✅ Plugin manifest uploaded successfully!"
echo ""
echo "📍 Access URL:"
echo "   https://r2.handsfree.com/plugins/$PLUGIN_ID/$VERSION/manifest.json"
echo "   https://r2.handsfree.com/plugins/$PLUGIN_ID/latest/manifest.json"
