#!/bin/bash

# Grant Google Places Worker access to Google Maps API key
#
# This script creates an access policy in the token manager to allow
# the handsfree-google-places worker to fetch the Google Maps API key.

set -e

echo "🔐 Granting token access to Google Places Worker..."

# Token Manager URL
TOKEN_MANAGER_URL="https://handsfree-token-manager.suyesh.workers.dev"

# Get admin API key from environment or prompt
if [ -z "$ADMIN_API_KEY" ]; then
  echo "Please enter the Token Manager admin API key:"
  read -s ADMIN_API_KEY
  echo
fi

# Create access policy
echo "Creating access policy for handsfree-google-places..."

RESPONSE=$(curl -s -X POST "${TOKEN_MANAGER_URL}/api/admin/policies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -d '{
    "workerName": "handsfree-google-places",
    "allowedTokens": ["google:maps_api_key"]
  }')

echo "Response: $RESPONSE"

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Access policy created successfully!"
  echo ""
  echo "The handsfree-google-places worker can now access:"
  echo "  - google:maps_api_key"
  echo ""
  echo "Next steps:"
  echo "  1. Test the worker:"
  echo "     curl -X POST 'https://handsfree-google-places-prod.suyesh.workers.dev/api/address/verify' \\"
  echo "       -H 'Content-Type: application/json' \\"
  echo "       -d '{\"address\": \"MG Road, Bangalore, Karnataka 560001\"}'"
else
  echo "❌ Failed to create access policy"
  echo "Response: $RESPONSE"
  exit 1
fi
