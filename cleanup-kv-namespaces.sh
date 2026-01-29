#!/bin/bash

# Cloudflare KV Namespace Cleanup Script
# This script helps you clean up old test KV namespaces

echo "🧹 Cloudflare KV Namespace Cleanup Script"
echo "=========================================="
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: 'jq' is not installed. Please install it first:"
    echo "   brew install jq"
    exit 1
fi

# Prompt for credentials
read -p "Enter your Cloudflare Account ID: " ACCOUNT_ID
echo ""
read -p "Enter your Cloudflare API Token: " API_TOKEN
echo ""

if [ -z "$ACCOUNT_ID" ] || [ -z "$API_TOKEN" ]; then
    echo "❌ Error: Account ID and API Token are required"
    exit 1
fi

echo "📋 Fetching KV namespaces..."
echo ""

# Fetch namespaces
RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json")

# Check if request was successful
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
    echo "❌ Error: Failed to fetch namespaces"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

# List namespaces
echo "Found KV Namespaces:"
echo "==================="
echo "$RESPONSE" | jq -r '.result[] | "\(.id) - \(.title)"' | nl

NAMESPACE_COUNT=$(echo "$RESPONSE" | jq '.result | length')
echo ""
echo "Total: $NAMESPACE_COUNT namespaces"
echo ""

if [ "$NAMESPACE_COUNT" -eq 0 ]; then
    echo "✅ No namespaces to clean up!"
    exit 0
fi

# Ask what to do
echo "Options:"
echo "  1. Delete ALL namespaces (DANGEROUS - use only for test accounts)"
echo "  2. Delete specific namespace by ID"
echo "  3. Delete namespaces matching a pattern (e.g., 'test-restaurant-*')"
echo "  4. Exit without deleting"
echo ""
read -p "Choose an option (1-4): " OPTION

case $OPTION in
    1)
        read -p "⚠️  Are you ABSOLUTELY SURE you want to delete ALL namespaces? (type 'YES' to confirm): " CONFIRM
        if [ "$CONFIRM" = "YES" ]; then
            echo "$RESPONSE" | jq -r '.result[] | .id' | while read NAMESPACE_ID; do
                TITLE=$(echo "$RESPONSE" | jq -r ".result[] | select(.id==\"$NAMESPACE_ID\") | .title")
                echo "🗑️  Deleting: $TITLE ($NAMESPACE_ID)"
                DELETE_RESPONSE=$(curl -s -X DELETE "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces/$NAMESPACE_ID" \
                  -H "Authorization: Bearer $API_TOKEN")
                if [ "$(echo "$DELETE_RESPONSE" | jq -r '.success')" = "true" ]; then
                    echo "   ✅ Deleted successfully"
                else
                    echo "   ❌ Failed to delete"
                    echo "$DELETE_RESPONSE" | jq '.'
                fi
            done
            echo ""
            echo "✅ Cleanup complete!"
        else
            echo "❌ Cancelled"
        fi
        ;;
    2)
        read -p "Enter namespace ID to delete: " NAMESPACE_ID
        TITLE=$(echo "$RESPONSE" | jq -r ".result[] | select(.id==\"$NAMESPACE_ID\") | .title")
        if [ -z "$TITLE" ]; then
            echo "❌ Namespace ID not found"
            exit 1
        fi
        echo "🗑️  Deleting: $TITLE ($NAMESPACE_ID)"
        DELETE_RESPONSE=$(curl -s -X DELETE "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces/$NAMESPACE_ID" \
          -H "Authorization: Bearer $API_TOKEN")
        if [ "$(echo "$DELETE_RESPONSE" | jq -r '.success')" = "true" ]; then
            echo "✅ Deleted successfully"
        else
            echo "❌ Failed to delete"
            echo "$DELETE_RESPONSE" | jq '.'
        fi
        ;;
    3)
        read -p "Enter pattern to match (e.g., 'test-restaurant'): " PATTERN
        echo ""
        echo "Matching namespaces:"
        MATCHING=$(echo "$RESPONSE" | jq -r ".result[] | select(.title | contains(\"$PATTERN\")) | \"\(.id) - \(.title)\"")
        if [ -z "$MATCHING" ]; then
            echo "❌ No namespaces match pattern: $PATTERN"
            exit 0
        fi
        echo "$MATCHING"
        echo ""
        read -p "Delete these namespaces? (yes/no): " CONFIRM
        if [ "$CONFIRM" = "yes" ]; then
            echo "$RESPONSE" | jq -r ".result[] | select(.title | contains(\"$PATTERN\")) | .id" | while read NAMESPACE_ID; do
                TITLE=$(echo "$RESPONSE" | jq -r ".result[] | select(.id==\"$NAMESPACE_ID\") | .title")
                echo "🗑️  Deleting: $TITLE ($NAMESPACE_ID)"
                DELETE_RESPONSE=$(curl -s -X DELETE "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces/$NAMESPACE_ID" \
                  -H "Authorization: Bearer $API_TOKEN")
                if [ "$(echo "$DELETE_RESPONSE" | jq -r '.success')" = "true" ]; then
                    echo "   ✅ Deleted successfully"
                else
                    echo "   ❌ Failed to delete"
                fi
            done
            echo ""
            echo "✅ Cleanup complete!"
        else
            echo "❌ Cancelled"
        fi
        ;;
    4)
        echo "👋 Exiting without deleting"
        exit 0
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac
