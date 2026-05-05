#!/bin/bash

# Upload Khao Piyo logo assets to Cloudflare Images
# Requires CLOUDFLARE_API_TOKEN environment variable with Images Write permission

# Configuration
ACCOUNT_ID="0f3287b287060e3215662501ee96292e"
API_ENDPOINT="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1"

# Check for API token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_API_TOKEN environment variable not set"
    echo "Please create an API token with 'Account.Cloudflare Images' Write permission"
    echo "https://dash.cloudflare.com/profile/api-tokens"
    exit 1
fi

echo "📤 Uploading Khao Piyo logo assets to Cloudflare Images..."
echo ""

# Upload circular logo
echo "1️⃣  Uploading circular logo..."
RESPONSE=$(curl -s -X POST "${API_ENDPOINT}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -F "file=@assets/logos/khao-piyo-logo-final.png" \
  -F "id=khao-piyo-logo" \
  -F "metadata={\"alt\":\"Khao Piyo Logo - Multi Cuisine Family Restaurant\"}")

SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
    IMAGE_ID=$(echo $RESPONSE | jq -r '.result.id')
    IMAGE_URL=$(echo $RESPONSE | jq -r '.result.variants[0]')
    echo "   ✅ Logo uploaded successfully!"
    echo "   📷 Image ID: ${IMAGE_ID}"
    echo "   🔗 URL: ${IMAGE_URL}"
else
    echo "   ❌ Upload failed:"
    echo $RESPONSE | jq -r '.errors[] | "   \(.message)"'
fi

echo ""

# Upload text image
echo "2️⃣  Uploading restaurant name text image..."
RESPONSE=$(curl -s -X POST "${API_ENDPOINT}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -F "file=@assets/logos/khao-piyo-text-transparent.png" \
  -F "id=khao-piyo-text" \
  -F "metadata={\"alt\":\"Khao Piyo Restaurant Name\"}")

SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
    IMAGE_ID=$(echo $RESPONSE | jq -r '.result.id')
    IMAGE_URL=$(echo $RESPONSE | jq -r '.result.variants[0]')
    echo "   ✅ Text image uploaded successfully!"
    echo "   📷 Image ID: ${IMAGE_ID}"
    echo "   🔗 URL: ${IMAGE_URL}"
else
    echo "   ❌ Upload failed:"
    echo $RESPONSE | jq -r '.errors[] | "   \(.message)"'
fi

echo ""
echo "✨ Done! Update the theme configuration with the Image URLs above."
