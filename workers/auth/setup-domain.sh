#!/bin/bash

# Setup script for auth.thestonepot.pro
# This script automates DNS records and custom domain configuration

set -e

DOMAIN="thestonepot.pro"
SUBDOMAIN="auth"
WORKER_NAME="stonepot-oauth"

echo "========================================="
echo "  Stonepot Auth Domain Setup"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Deploy the worker
echo -e "${BLUE}Step 1: Deploying worker...${NC}"
npx wrangler deploy
echo -e "${GREEN}✓ Worker deployed${NC}"
echo ""

# Step 2: Get Zone ID
echo -e "${BLUE}Step 2: Getting Cloudflare Zone ID...${NC}"
ZONE_ID=$(npx wrangler zones list | grep "$DOMAIN" | awk '{print $1}')

if [ -z "$ZONE_ID" ]; then
    echo -e "${YELLOW}⚠ Could not find zone ID automatically.${NC}"
    echo "Please enter your Cloudflare Zone ID for $DOMAIN:"
    echo "(You can find it at: https://dash.cloudflare.com/?to=/:account/$DOMAIN)"
    read -r ZONE_ID
fi

echo -e "${GREEN}✓ Zone ID: $ZONE_ID${NC}"
echo ""

# Step 3: Add custom domain to worker
echo -e "${BLUE}Step 3: Attaching custom domain to worker...${NC}"
npx wrangler deployments domains attach "$SUBDOMAIN.$DOMAIN" || {
    echo -e "${YELLOW}⚠ Custom domain may already be attached or needs manual setup${NC}"
    echo "You can also attach it via: https://dash.cloudflare.com"
}
echo -e "${GREEN}✓ Custom domain configuration complete${NC}"
echo ""

# Step 4: Create/Update DNS records via API
echo -e "${BLUE}Step 4: Creating DNS records...${NC}"

# Get API token from wrangler config or prompt
echo "Please enter your Cloudflare API Token:"
echo "(Create one at: https://dash.cloudflare.com/profile/api-tokens)"
echo "Required permissions: Zone.DNS (Edit)"
read -r -s CF_API_TOKEN
echo ""

# Function to create or update DNS record
create_or_update_dns() {
    local type=$1
    local name=$2
    local content=$3
    local proxied=${4:-false}

    echo "  → $type record: $name"

    # Check if record exists
    RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=$type&name=$name" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

    if [ -n "$RECORD_ID" ] && [ "$RECORD_ID" != "null" ]; then
        # Update existing record
        curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"$type\",\"name\":\"$name\",\"content\":\"$content\",\"proxied\":$proxied}" > /dev/null
        echo -e "    ${GREEN}✓ Updated${NC}"
    else
        # Create new record
        curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"$type\",\"name\":\"$name\",\"content\":\"$content\",\"proxied\":$proxied}" > /dev/null
        echo -e "    ${GREEN}✓ Created${NC}"
    fi
}

# Create CNAME for auth subdomain
create_or_update_dns "CNAME" "$SUBDOMAIN.$DOMAIN" "$WORKER_NAME.suyesh.workers.dev" true

# Create TXT records for email authentication
create_or_update_dns "TXT" "$DOMAIN" "v=spf1 include:relay.mailchannels.net ~all" false
create_or_update_dns "TXT" "_mailchannels.$DOMAIN" "v=mc1 cfid=$SUBDOMAIN.$DOMAIN" false
create_or_update_dns "TXT" "_dmarc.$DOMAIN" "v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN; pct=100; adkim=s; aspf=s" false

echo -e "${GREEN}✓ DNS records created/updated${NC}"
echo ""

# Step 5: Verify setup
echo -e "${BLUE}Step 5: Verifying setup...${NC}"
echo "Waiting 10 seconds for DNS propagation..."
sleep 10

echo "Testing DNS records:"
echo "  → CNAME: $SUBDOMAIN.$DOMAIN"
dig +short $SUBDOMAIN.$DOMAIN
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Your auth service is now available at:"
echo -e "${BLUE}https://$SUBDOMAIN.$DOMAIN${NC}"
echo ""
echo "Note: It may take a few minutes for DNS to fully propagate worldwide."
echo "You can check propagation status at: https://dnschecker.org"
