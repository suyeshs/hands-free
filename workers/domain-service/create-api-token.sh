#!/bin/bash

# Script to create a Cloudflare API token with required permissions for domain-service
# Reference: https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/

set -e

echo "=== Cloudflare API Token Creator for Domain Service ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ACCOUNT_ID="0f3287b287060e3215662501ee96292e"
ZONE_ID="a87f103cc0e697543f91213a71bafe01"

# Required permissions for domain-service
REQUIRED_PERMISSIONS=(
  "DNS Write"
  "Workers KV Storage Write"
  "D1 Write"
  "Workers R2 Storage Write"
  "Account Settings Read"
)

echo -e "${BLUE}This script will create an API token with the following permissions:${NC}"
for perm in "${REQUIRED_PERMISSIONS[@]}"; do
  echo "  • $perm"
done
echo ""

# Prompt for existing API token (needed to create new tokens)
echo "To create a new API token, you need an existing token with 'User API Tokens - Edit' permission."
echo "You can use your Global API Key or an existing token from:"
echo "https://dash.cloudflare.com/profile/api-tokens"
echo ""
read -sp "Enter your Cloudflare API Token (with User API Tokens - Edit permission): " BOOTSTRAP_TOKEN
echo ""
echo ""

# Validate bootstrap token
echo "Validating bootstrap token..."
VERIFY_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer ${BOOTSTRAP_TOKEN}" \
  -H "Content-Type: application/json")

if echo "$VERIFY_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Bootstrap token is valid${NC}"
else
  echo -e "${RED}✗ Invalid bootstrap token${NC}"
  echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
  exit 1
fi

# Fetch available permission groups
echo ""
echo "Fetching available permission groups..."
PERMISSIONS_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/user/tokens/permission_groups" \
  -H "Authorization: Bearer ${BOOTSTRAP_TOKEN}" \
  -H "Content-Type: application/json")

if ! echo "$PERMISSIONS_RESPONSE" | grep -q '"success":true'; then
  echo -e "${RED}✗ Failed to fetch permission groups${NC}"
  echo "$PERMISSIONS_RESPONSE" | jq '.' 2>/dev/null || echo "$PERMISSIONS_RESPONSE"
  exit 1
fi

# Save permissions to temp file for analysis
echo "$PERMISSIONS_RESPONSE" | jq '.result' > /tmp/cloudflare-permissions.json

# Find permission group IDs
echo "Finding required permission group IDs..."

find_permission_id() {
  local perm_name="$1"
  jq -r ".[] | select(.name == \"$perm_name\") | .id" /tmp/cloudflare-permissions.json
}

DNS_WRITE_ID=$(find_permission_id "DNS Write")
KV_WRITE_ID=$(find_permission_id "Workers KV Storage Write")
D1_WRITE_ID=$(find_permission_id "D1 Write")
R2_WRITE_ID=$(find_permission_id "Workers R2 Storage Write")
ACCOUNT_READ_ID=$(find_permission_id "Account Settings Read")

# Verify we found all required permissions
if [[ -z "$DNS_WRITE_ID" || -z "$KV_WRITE_ID" || -z "$D1_WRITE_ID" || -z "$R2_WRITE_ID" ]]; then
  echo -e "${YELLOW}⚠️  Could not find all required permission group IDs${NC}"
  echo ""
  echo "Found permissions:"
  echo "  DNS Write: ${DNS_WRITE_ID:-NOT FOUND}"
  echo "  Workers KV Storage Write: ${KV_WRITE_ID:-NOT FOUND}"
  echo "  D1 Write: ${D1_WRITE_ID:-NOT FOUND}"
  echo "  Workers R2 Storage Write: ${R2_WRITE_ID:-NOT FOUND}"
  echo ""
  echo "Available permissions matching our keywords:"
  jq -r '.[] | select(.name | test("DNS|KV|D1|R2|Workers"; "i")) | "  - \(.name) (\(.id))"' /tmp/cloudflare-permissions.json
  echo ""
  echo "Would you like to continue anyway and manually select permissions? (y/n)"
  read -r RESPONSE
  if [[ "$RESPONSE" != "y" && "$RESPONSE" != "Y" ]]; then
    exit 1
  fi
fi

echo -e "${GREEN}✓ Found permission group IDs:${NC}"
echo "  DNS Write: $DNS_WRITE_ID"
echo "  Workers KV Storage Write: $KV_WRITE_ID"
echo "  D1 Write: $D1_WRITE_ID"
echo "  Workers R2 Storage Write: $R2_WRITE_ID"
echo "  Account Settings Read: ${ACCOUNT_READ_ID:-OPTIONAL}"

# Create the token
echo ""
echo "Creating new API token..."

# Token configuration
TOKEN_NAME="handsfree-domain-service-$(date +%Y%m%d-%H%M%S)"
NOT_BEFORE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EXPIRES_ON=$(date -u -d '+1 year' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+1y +%Y-%m-%dT%H:%M:%SZ)

# Build permission groups array
ZONE_PERMISSIONS='[]'
ACCOUNT_PERMISSIONS='[]'

if [[ -n "$DNS_WRITE_ID" ]]; then
  ZONE_PERMISSIONS=$(echo "$ZONE_PERMISSIONS" | jq ". + [{\"id\": \"$DNS_WRITE_ID\"}]")
fi

if [[ -n "$KV_WRITE_ID" ]]; then
  ACCOUNT_PERMISSIONS=$(echo "$ACCOUNT_PERMISSIONS" | jq ". + [{\"id\": \"$KV_WRITE_ID\"}]")
fi

if [[ -n "$D1_WRITE_ID" ]]; then
  ACCOUNT_PERMISSIONS=$(echo "$ACCOUNT_PERMISSIONS" | jq ". + [{\"id\": \"$D1_WRITE_ID\"}]")
fi

if [[ -n "$R2_WRITE_ID" ]]; then
  ACCOUNT_PERMISSIONS=$(echo "$ACCOUNT_PERMISSIONS" | jq ". + [{\"id\": \"$R2_WRITE_ID\"}]")
fi

if [[ -n "$ACCOUNT_READ_ID" ]]; then
  ACCOUNT_PERMISSIONS=$(echo "$ACCOUNT_PERMISSIONS" | jq ". + [{\"id\": \"$ACCOUNT_READ_ID\"}]")
fi

# Build the token request payload using the official structure
cat > /tmp/token-request.json << EOF
{
  "name": "${TOKEN_NAME}",
  "policies": [
    {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.zone.${ZONE_ID}": "*"
      },
      "permission_groups": ${ZONE_PERMISSIONS}
    },
    {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.${ACCOUNT_ID}": "*"
      },
      "permission_groups": ${ACCOUNT_PERMISSIONS}
    }
  ],
  "not_before": "${NOT_BEFORE}",
  "expires_on": "${EXPIRES_ON}"
}
EOF

echo ""
echo "Token request payload:"
cat /tmp/token-request.json | jq '.'
echo ""

# Create the token using the user tokens endpoint
CREATE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/user/tokens" \
  -H "Authorization: Bearer ${BOOTSTRAP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @/tmp/token-request.json)

# Check if successful
if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
  NEW_TOKEN=$(echo "$CREATE_RESPONSE" | jq -r '.result.value')
  TOKEN_ID=$(echo "$CREATE_RESPONSE" | jq -r '.result.id')

  echo -e "${GREEN}✓ Successfully created API token${NC}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${YELLOW}Token Name:${NC} ${TOKEN_NAME}"
  echo -e "${YELLOW}Token ID:${NC}   ${TOKEN_ID}"
  echo -e "${YELLOW}Token Value:${NC}"
  echo ""
  echo "${NEW_TOKEN}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo -e "${YELLOW}⚠️  IMPORTANT: Save this token now! You won't be able to see it again.${NC}"
  echo ""

  # Save to file
  echo "${NEW_TOKEN}" > /tmp/cloudflare-token.txt
  chmod 600 /tmp/cloudflare-token.txt
  echo -e "Token saved to: ${GREEN}/tmp/cloudflare-token.txt${NC} (chmod 600)"
  echo ""

  # Display token details
  echo "Token Details:"
  echo "$CREATE_RESPONSE" | jq '.result | {id, name, status, issued_on, expires_on, policies}' 2>/dev/null || true
  echo ""

  # Ask if user wants to set it as secret immediately
  echo "Would you like to set this token as the CLOUDFLARE_API_TOKEN secret now? (y/n)"
  read -r RESPONSE

  if [[ "$RESPONSE" == "y" || "$RESPONSE" == "Y" ]]; then
    echo ""
    echo "Setting CLOUDFLARE_API_TOKEN secret..."
    echo "${NEW_TOKEN}" | npx wrangler secret put CLOUDFLARE_API_TOKEN
    echo -e "${GREEN}✓ Secret updated successfully${NC}"
    echo ""
    echo "Verifying secrets are set..."
    npx wrangler secret list
    echo ""
    echo -e "${GREEN}✓ All secrets configured!${NC}"
    echo ""
    echo "You can now test the provisioning workflow:"
    echo ""
    echo "curl -X POST https://handsfree-domain-service.suyesh.workers.dev/api/subdomains/assign \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{"
    echo '    "tenantId": "test-provisioning-complete",'
    echo '    "tenantSlug": "test-provisioning-complete",'
    echo '    "provisionStorage": true,'
    echo '    "provisionDatabase": true'
    echo "  }'"
    echo ""
  else
    echo ""
    echo "To set the token manually later, run:"
    echo ""
    echo "  cd $(pwd)"
    echo "  cat /tmp/cloudflare-token.txt | npx wrangler secret put CLOUDFLARE_API_TOKEN"
  fi

  # Clean up
  rm -f /tmp/token-request.json

else
  echo -e "${RED}✗ Failed to create token${NC}"
  echo ""
  echo "Response:"
  echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"

  # Clean up
  rm -f /tmp/token-request.json
  rm -f /tmp/cloudflare-permissions.json
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Token Scope:"
echo "  • Zone: ${ZONE_ID} (handsfree.tech)"
echo "  • Account: ${ACCOUNT_ID}"
echo ""
echo "Token Permissions:"
[[ -n "$DNS_WRITE_ID" ]] && echo "  ✓ DNS Write"
[[ -n "$KV_WRITE_ID" ]] && echo "  ✓ Workers KV Storage Write"
[[ -n "$D1_WRITE_ID" ]] && echo "  ✓ D1 Write"
[[ -n "$R2_WRITE_ID" ]] && echo "  ✓ Workers R2 Storage Write"
[[ -n "$ACCOUNT_READ_ID" ]] && echo "  ✓ Account Settings Read"
echo ""
echo "Validity:"
echo "  • Not before: ${NOT_BEFORE}"
echo "  • Expires:    ${EXPIRES_ON}"
echo ""
echo "Security Notes:"
echo "  • Token secret is only shown once - saved to /tmp/cloudflare-token.txt"
echo "  • Consider adding IP restrictions for production use"
echo "  • Review and rotate tokens regularly"
echo ""
