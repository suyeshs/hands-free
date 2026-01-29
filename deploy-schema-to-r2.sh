#!/bin/bash

# Deploy POS Schema to R2
# Auto-uploads d1-complete-migration.sql to Cloudflare R2 for tenant provisioning

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SCHEMA_FILE="docs/d1-complete-migration.sql"
R2_BUCKET="handsfree-schemas"
SCHEMA_NAME="pos-schema-latest.sql"

# Optional: Set version from argument or use current date
VERSION="${1:-$(date +%Y%m%d-%H%M%S)}"
VERSIONED_NAME="pos-schema-v${VERSION}.sql"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  POS Schema Deployment to R2${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
  echo -e "${RED}❌ Error: Schema file not found: $SCHEMA_FILE${NC}"
  exit 1
fi

# Get schema file size
SCHEMA_SIZE=$(wc -c < "$SCHEMA_FILE" | tr -d ' ')
SCHEMA_SIZE_KB=$((SCHEMA_SIZE / 1024))

echo -e "${GREEN}📄 Schema file:${NC} $SCHEMA_FILE"
echo -e "${GREEN}📊 File size:${NC} $SCHEMA_SIZE_KB KB"
echo -e "${GREEN}🪣 R2 bucket:${NC} $R2_BUCKET"
echo -e "${GREEN}🏷️  Version:${NC} $VERSION"
echo ""

# Count tables in schema
TABLE_COUNT=$(grep -c "CREATE TABLE IF NOT EXISTS" "$SCHEMA_FILE" || true)
echo -e "${GREEN}🗂️  Tables:${NC} $TABLE_COUNT tables"
echo ""

# Confirm upload
read -p "$(echo -e ${YELLOW}Continue with upload? [y/N]:${NC} )" -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}❌ Upload cancelled${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}📤 Uploading to R2...${NC}"
echo ""

# Navigate to domain-service directory
cd "$(dirname "$0")"

# Upload as latest
echo -e "${BLUE}1/2 Uploading as latest...${NC}"
wrangler r2 object put "$R2_BUCKET/$SCHEMA_NAME" \
  --file="$SCHEMA_FILE" \
  --content-type="application/sql"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Uploaded: $SCHEMA_NAME${NC}"
else
  echo -e "${RED}❌ Failed to upload: $SCHEMA_NAME${NC}"
  exit 1
fi

# Upload versioned copy
echo -e "${BLUE}2/2 Uploading versioned copy...${NC}"
wrangler r2 object put "$R2_BUCKET/$VERSIONED_NAME" \
  --file="$SCHEMA_FILE" \
  --content-type="application/sql"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Uploaded: $VERSIONED_NAME${NC}"
else
  echo -e "${RED}❌ Failed to upload: $VERSIONED_NAME${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ Deployment Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   • Latest: $R2_BUCKET/$SCHEMA_NAME"
echo -e "   • Version: $R2_BUCKET/$VERSIONED_NAME"
echo -e "   • Tables: $TABLE_COUNT"
echo -e "   • Size: $SCHEMA_SIZE_KB KB"
echo ""
echo -e "${YELLOW}⚠️  Note:${NC} New tenants will now provision with this schema."
echo -e "${YELLOW}⚠️  Existing tenants are not affected.${NC}"
echo ""

# Optional: List R2 contents
read -p "$(echo -e ${BLUE}View R2 bucket contents? [y/N]:${NC} )" -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo -e "${BLUE}📦 R2 Bucket Contents:${NC}"
  wrangler r2 object list "$R2_BUCKET"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
