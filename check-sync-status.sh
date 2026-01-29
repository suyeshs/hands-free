#!/bin/bash

# Check Menu Sync Status
# Compares local SQLite database with cloud D1 database

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Menu Sync Status Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get tenant ID from environment or ask
TENANT_ID="${1:-}"
if [ -z "$TENANT_ID" ]; then
  echo -e "${YELLOW}Enter tenant ID (e.g., khao-piyo-7766):${NC}"
  read TENANT_ID
fi

echo -e "${GREEN}Tenant ID:${NC} $TENANT_ID"
echo ""

# Check cloud menu count
echo -e "${BLUE}Checking cloud database (D1)...${NC}"
CLOUD_RESPONSE=$(curl -s "https://handsfree-restaurant-client.suyesh.workers.dev/api/menu/${TENANT_ID}")

if echo "$CLOUD_RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ Cloud API Error:${NC}"
  echo "$CLOUD_RESPONSE" | jq .
  exit 1
fi

CLOUD_COUNT=$(echo "$CLOUD_RESPONSE" | jq -r '.count // (.items | length)')
echo -e "${GREEN}✅ Cloud menu items:${NC} $CLOUD_COUNT"
echo ""

# Show sample cloud items
echo -e "${BLUE}Sample cloud items (first 5):${NC}"
echo "$CLOUD_RESPONSE" | jq -r '.items[:5] | .[] | "  - \(.name) (\(.category)) - ₹\(.price)"'
echo ""

# Check D1 database provisioning status
echo -e "${BLUE}Checking D1 database provisioning...${NC}"
D1_DB_ID=$(echo "$CLOUD_RESPONSE" | jq -r '.metadata.d1DatabaseId // empty')

if [ -n "$D1_DB_ID" ]; then
  echo -e "${GREEN}✅ D1 Database ID:${NC} $D1_DB_ID"

  # Try to check table count using wrangler
  if command -v wrangler &> /dev/null; then
    echo -e "${BLUE}Checking D1 table count...${NC}"
    cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/domain-service

    TABLE_COUNT=$(wrangler d1 execute "$D1_DB_ID" --remote --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")

    if [ "$TABLE_COUNT" -gt "0" ]; then
      echo -e "${GREEN}✅ D1 tables provisioned:${NC} $TABLE_COUNT tables"

      # Check menu_items count in D1
      MENU_COUNT=$(wrangler d1 execute "$D1_DB_ID" --remote --command="SELECT COUNT(*) as count FROM menu_items" 2>/dev/null | grep -o '[0-9]\+' | tail -1 || echo "0")
      echo -e "${GREEN}✅ D1 menu_items count:${NC} $MENU_COUNT"
    else
      echo -e "${YELLOW}⚠️  D1 database not provisioned (0 tables)${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  Wrangler not installed - cannot check D1 directly${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  No D1 database ID in metadata${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Sync Status Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Cloud (Backend API):${NC} $CLOUD_COUNT items"

if [ -n "$D1_DB_ID" ] && [ -n "$MENU_COUNT" ]; then
  echo -e "${GREEN}D1 Database:${NC} $MENU_COUNT items"

  if [ "$CLOUD_COUNT" -eq "$MENU_COUNT" ]; then
    echo -e "${GREEN}✅ SYNCED${NC} - Cloud and D1 match"
  else
    DIFF=$((CLOUD_COUNT - MENU_COUNT))
    echo -e "${YELLOW}⚠️  OUT OF SYNC${NC} - Difference: $DIFF items"
  fi
fi

echo ""
echo -e "${BLUE}To sync:${NC}"
echo "  1. Open POS app → Admin → Menu → Sync"
echo "  2. Or use the check-menu-sync.html diagnostic page"
echo ""
