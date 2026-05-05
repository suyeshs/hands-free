#!/bin/bash

# Token Manager Setup Script
# Provisions all required infrastructure and secrets

set -e

echo "=== Handsfree Token Manager Setup ==="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
ACCOUNT_ID="0f3287b287060e3215662501ee96292e"

# Step 1: Create KV Namespaces
echo -e "${YELLOW}Step 1: Creating KV Namespaces${NC}"

echo "Creating TOKEN_VAULT namespace..."
TOKEN_VAULT_ID=$(npx wrangler kv namespace create TOKEN_VAULT | grep -oP 'id = "\K[^"]+')
echo -e "${GREEN}✓ Created TOKEN_VAULT: ${TOKEN_VAULT_ID}${NC}"

echo "Creating TOKEN_METADATA namespace..."
TOKEN_METADATA_ID=$(npx wrangler kv namespace create TOKEN_METADATA | grep -oP 'id = "\K[^"]+')
echo -e "${GREEN}✓ Created TOKEN_METADATA: ${TOKEN_METADATA_ID}${NC}"

echo "Creating ACCESS_POLICIES namespace..."
ACCESS_POLICIES_ID=$(npx wrangler kv namespace create ACCESS_POLICIES | grep -oP 'id = "\K[^"]+')
echo -e "${GREEN}✓ Created ACCESS_POLICIES: ${ACCESS_POLICIES_ID}${NC}"

# Step 2: Create D1 Database
echo ""
echo -e "${YELLOW}Step 2: Creating D1 Database${NC}"

AUDIT_DB_ID=$(npx wrangler d1 create handsfree-token-audit | grep -oP 'database_id = "\K[^"]+')
echo -e "${GREEN}✓ Created handsfree-token-audit: ${AUDIT_DB_ID}${NC}"

# Step 3: Apply D1 Migrations
echo ""
echo -e "${YELLOW}Step 3: Applying Database Schema${NC}"

npx wrangler d1 execute handsfree-token-audit --remote --file=./migrations/0001_initial_schema.sql
echo -e "${GREEN}✓ Applied database schema${NC}"

# Step 4: Update wrangler.jsonc
echo ""
echo -e "${YELLOW}Step 4: Updating wrangler.jsonc${NC}"

# Create backup
cp wrangler.jsonc wrangler.jsonc.backup

# Update IDs (this is a simple replacement, you may need to manually verify)
sed -i.tmp "s/CREATE_NEW_KV_FOR_TOKEN_VAULT/${TOKEN_VAULT_ID}/g" wrangler.jsonc
sed -i.tmp "s/CREATE_NEW_KV_FOR_TOKEN_METADATA/${TOKEN_METADATA_ID}/g" wrangler.jsonc
sed -i.tmp "s/CREATE_NEW_KV_FOR_ACCESS_POLICIES/${ACCESS_POLICIES_ID}/g" wrangler.jsonc
sed -i.tmp "s/CREATE_NEW_D1_FOR_AUDIT/${AUDIT_DB_ID}/g" wrangler.jsonc

rm -f wrangler.jsonc.tmp

echo -e "${GREEN}✓ Updated wrangler.jsonc${NC}"

# Step 5: Generate and Set Secrets
echo ""
echo -e "${YELLOW}Step 5: Generating and Setting Secrets${NC}"

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "${ENCRYPTION_KEY}" | npx wrangler secret put MASTER_ENCRYPTION_KEY
echo -e "${GREEN}✓ Set MASTER_ENCRYPTION_KEY${NC}"

# Generate admin API key
ADMIN_API_KEY=$(openssl rand -base64 32)
echo "${ADMIN_API_KEY}" | npx wrangler secret put ADMIN_API_KEY
echo -e "${GREEN}✓ Set ADMIN_API_KEY${NC}"

# Prompt for bootstrap token
echo ""
echo "To create Cloudflare API tokens, we need a bootstrap token."
echo "You can create one at: https://dash.cloudflare.com/profile/api-tokens"
echo "Required permission: 'User API Tokens - Edit'"
echo ""
read -sp "Enter your Cloudflare bootstrap API token: " BOOTSTRAP_TOKEN
echo ""

echo "${BOOTSTRAP_TOKEN}" | npx wrangler secret put BOOTSTRAP_API_TOKEN
echo -e "${GREEN}✓ Set BOOTSTRAP_API_TOKEN${NC}"

# Step 6: Deploy Worker
echo ""
echo -e "${YELLOW}Step 6: Deploying Token Manager Worker${NC}"

npx wrangler deploy
echo -e "${GREEN}✓ Deployed token-manager worker${NC}"

# Step 7: Save Configuration
echo ""
echo -e "${YELLOW}Step 7: Saving Configuration${NC}"

cat > .env.local << EOF
# Token Manager Configuration
# Generated: $(date)

TOKEN_VAULT_ID=${TOKEN_VAULT_ID}
TOKEN_METADATA_ID=${TOKEN_METADATA_ID}
ACCESS_POLICIES_ID=${ACCESS_POLICIES_ID}
AUDIT_DB_ID=${AUDIT_DB_ID}

ADMIN_API_KEY=${ADMIN_API_KEY}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Save bootstrap token separately - do not commit!
# BOOTSTRAP_TOKEN=${BOOTSTRAP_TOKEN}
EOF

chmod 600 .env.local
echo -e "${GREEN}✓ Saved configuration to .env.local${NC}"

# Step 8: Create Initial Policies
echo ""
echo -e "${YELLOW}Step 8: Creating Initial Access Policies${NC}"

WORKER_URL="https://handsfree-token-manager.suyesh.workers.dev"

# Policy for domain-service
curl -s -X POST "${WORKER_URL}/api/admin/policies" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "workerName": "handsfree-domain-service",
    "allowedTokens": [
      "cloudflare:api_token",
      "cloudflare:zone_token",
      "cloudflare:storage_token"
    ]
  }' > /dev/null

echo -e "${GREEN}✓ Created policy for domain-service${NC}"

# Policy for store-front
curl -s -X POST "${WORKER_URL}/api/admin/policies" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "workerName": "handsfree-store-front",
    "allowedTokens": [
      "cloudflare:api_token"
    ]
  }' > /dev/null

echo -e "${GREEN}✓ Created policy for store-front${NC}"

# Policy for theme-edge-worker
curl -s -X POST "${WORKER_URL}/api/admin/policies" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "workerName": "theme-edge-worker",
    "allowedTokens": [
      "grok:api_key",
      "cloudflare:cache_purge_token"
    ]
  }' > /dev/null

echo -e "${GREEN}✓ Created policy for theme-edge-worker${NC}"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Token Manager Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Service URL: ${WORKER_URL}"
echo "Admin API Key: ${ADMIN_API_KEY}"
echo ""
echo "Configuration saved to: .env.local"
echo ""
echo "Next steps:"
echo "1. Create Cloudflare API tokens using the token manager"
echo "2. Migrate existing workers to use token-client library"
echo "3. Set up monitoring and alerts"
echo ""
echo "To create a Cloudflare token:"
echo "  ./create-token.sh"
echo ""
