#!/bin/bash
# Register Multi-Location Plugin in KV Store
# Updates the plugin registry to make the plugin discoverable

set -e

PLUGIN_ID="multi-location"
KV_NAMESPACE_ID="your_kv_namespace_id"  # Update this with actual KV namespace ID

echo "📝 Registering Multi-Location Plugin in KV"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler not found. Please install wrangler:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Step 1: Get current plugin index
echo "📋 Step 1: Getting current plugin index..."
CURRENT_INDEX=$(wrangler kv:key get "plugin-index" --namespace-id "$KV_NAMESPACE_ID" 2>/dev/null || echo '[]')
echo "   Current plugins: $CURRENT_INDEX"
echo ""

# Step 2: Add multi-location to index if not already there
echo "➕ Step 2: Adding multi-location to plugin index..."

# Parse current index and add multi-location if not present
if echo "$CURRENT_INDEX" | grep -q "multi-location"; then
    echo "   ⚠️  Plugin already in index"
else
    # Add to index
    NEW_INDEX=$(echo "$CURRENT_INDEX" | jq '. + ["multi-location"]')
    echo "$NEW_INDEX" | wrangler kv:key put "plugin-index" --namespace-id "$KV_NAMESPACE_ID"
    echo "   ✅ Added to plugin index"
fi
echo ""

# Step 3: Register plugin metadata
echo "📦 Step 3: Registering plugin metadata..."

# Read manifest
MANIFEST=$(cat ../multi-location/manifest.json)

# Store in KV
echo "$MANIFEST" | wrangler kv:key put "plugin:multi-location" --namespace-id "$KV_NAMESPACE_ID"
echo "   ✅ Plugin metadata registered"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Plugin Registered Successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 Plugin is now available via:"
echo "   Registry API: https://handsfree-plugin-registry.suyesh.workers.dev/plugins/multi-location"
echo "   Plugin Store: POS → Settings → Plugins → Multi-Location Management"
echo ""
echo "📢 Update Notification:"
echo "   Priority: HIGH (non-dismissible)"
echo "   Message: Critical database schema update"
echo "   Action: Install Update"
echo ""
echo "💡 Clients will receive update notification on next app launch!"
echo ""
