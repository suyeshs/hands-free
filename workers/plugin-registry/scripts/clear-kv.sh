#!/bin/bash
# Clear all plugin data from KV

NAMESPACE_ID="09d5d3299ad5435f9226fc23ef9ad164"

echo "🗑️  Clearing old plugin data from KV..."

# Delete old plugin entries
for key in "plugin:advanced-analytics-pro" "plugin:loyalty-rewards-v1" "plugin:multi-location-sync" "plugin:payment-gateway-stripe" "plugin:table-reservations-pro"; do
    echo "Deleting: $key"
    wrangler kv key delete "$key" --namespace-id="$NAMESPACE_ID" --remote 2>/dev/null || true
done

# Delete old review entries
for key in "reviews:advanced-analytics-pro" "reviews:loyalty-rewards-v1" "reviews:multi-location-sync" "reviews:payment-gateway-stripe" "reviews:table-reservations-pro"; do
    echo "Deleting: $key"
    wrangler kv key delete "$key" --namespace-id="$NAMESPACE_ID" --remote 2>/dev/null || true
done

echo "✅ Cleanup complete"
