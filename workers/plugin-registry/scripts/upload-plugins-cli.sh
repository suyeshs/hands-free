#!/bin/bash
# Upload Sample Plugins to KV using Wrangler CLI
# This uses your existing Wrangler OAuth session

set -e

NAMESPACE_ID="09d5d3299ad5435f9226fc23ef9ad164"
PLUGINS_DIR="../../plugins/sample-plugins"

echo "🚀 Starting plugin upload to KV..."
echo ""

# Count plugins
PLUGIN_COUNT=$(ls $PLUGINS_DIR/*.json | wc -l | tr -d ' ')
echo "Found $PLUGIN_COUNT plugin manifest(s)"
echo ""

PLUGIN_IDS=()

# Upload each plugin manifest
for file in $PLUGINS_DIR/*.json; do
    filename=$(basename "$file")
    echo "📦 Uploading: $filename"

    # Read the plugin ID from the manifest
    plugin_id=$(cat "$file" | grep '"id"' | head -1 | sed 's/.*"id": "\(.*\)".*/\1/')
    echo "   Plugin ID: $plugin_id"

    # Upload manifest to KV with key: plugin:{id}
    wrangler kv key put "plugin:$plugin_id" --path="$file" --namespace-id="$NAMESPACE_ID" --remote

    # Create empty reviews array for this plugin
    wrangler kv key put "reviews:$plugin_id" "[]" --namespace-id="$NAMESPACE_ID" --remote

    PLUGIN_IDS+=("\"$plugin_id\"")
    echo ""
done

# Create plugin index
echo "📋 Creating plugin index..."
PLUGIN_INDEX="[$(IFS=,; echo "${PLUGIN_IDS[*]}")]"
wrangler kv key put "plugin-index" "$PLUGIN_INDEX" --namespace-id="$NAMESPACE_ID" --remote

echo ""
echo "✅ All plugins uploaded successfully!"
echo ""
echo "Total plugins: ${#PLUGIN_IDS[@]}"
echo "Plugin IDs: $(echo "$PLUGIN_INDEX" | tr -d '[]"' | tr ',' ' ')"
