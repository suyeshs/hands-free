#!/bin/bash
# Deploy Dynamic Migration to Cloudflare R2
# Usage: ./deploy-migration.sh <file> <version> <name> <min_app_version>

set -e

if [ "$#" -ne 4 ]; then
    echo "❌ Error: Invalid number of arguments"
    echo ""
    echo "Usage: ./deploy-migration.sh <file> <version> <name> <min_app_version>"
    echo ""
    echo "Example:"
    echo "  ./deploy-migration.sh src-tauri/migrations/039_loyalty.sql 39 loyalty_points 3.1.0"
    echo ""
    exit 1
fi

MIGRATION_FILE=$1
MIGRATION_VERSION=$2
MIGRATION_NAME=$3
REQUIRED_APP_VERSION=$4

# Validate migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo ""
echo "🚀 Deploying Dynamic Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Name: $MIGRATION_NAME"
echo "   Version: $MIGRATION_VERSION"
echo "   Required App: $REQUIRED_APP_VERSION"
echo "   File: $MIGRATION_FILE"
echo ""

# Calculate checksum
echo "📝 Calculating checksum..."
CHECKSUM=$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')
echo "   ✅ Checksum: sha256:$CHECKSUM"
echo ""

# Extract description from first SQL comment
DESCRIPTION=$(head -1 "$MIGRATION_FILE" | sed 's/^--[[:space:]]*//')
if [ -z "$DESCRIPTION" ]; then
    DESCRIPTION="$MIGRATION_NAME migration"
fi

# Upload to R2
echo "☁️  Uploading migration to Cloudflare R2..."
FILENAME=$(basename "$MIGRATION_FILE")

if ! wrangler r2 object put "handsfree-pos/migrations/$FILENAME" --file="$MIGRATION_FILE"; then
    echo "❌ Failed to upload migration file"
    exit 1
fi
echo "   ✅ Uploaded: migrations/$FILENAME"
echo ""

# Create/update manifest
echo "📋 Updating migration manifest..."

# Create manifest entry JSON
MANIFEST_ENTRY=$(cat <<EOF
{
  "version": $MIGRATION_VERSION,
  "name": "$MIGRATION_NAME",
  "description": "$DESCRIPTION",
  "file": "$FILENAME",
  "checksum": "sha256:$CHECKSUM",
  "required_app_version": "$REQUIRED_APP_VERSION",
  "tenant_whitelist": null,
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

# Create manifest directory if it doesn't exist
mkdir -p migrations

# If manifest doesn't exist, create it
if [ ! -f "migrations/manifest.json" ]; then
    echo '{"version": 1, "migrations": []}' > migrations/manifest.json
    echo "   ℹ️  Created new manifest.json"
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is not installed. Please install it first:"
    echo "   macOS: brew install jq"
    echo "   Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Add migration to manifest (using jq)
jq ".migrations += [$MANIFEST_ENTRY]" migrations/manifest.json > migrations/manifest.tmp
mv migrations/manifest.tmp migrations/manifest.json
echo "   ✅ Added migration to manifest"

# Upload updated manifest
echo ""
echo "☁️  Uploading manifest to Cloudflare R2..."
if ! wrangler r2 object put handsfree-pos/migrations/manifest.json --file=migrations/manifest.json; then
    echo "❌ Failed to upload manifest"
    exit 1
fi
echo "   ✅ Uploaded: migrations/manifest.json"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Migration Deployed Successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "   Name: $MIGRATION_NAME"
echo "   Version: $MIGRATION_VERSION"
echo "   Required App: $REQUIRED_APP_VERSION"
echo "   Description: $DESCRIPTION"
echo "   Checksum: sha256:$CHECKSUM"
echo ""
echo "🕐 Rollout Timeline:"
echo "   • Apps will auto-sync within 60 minutes"
echo "   • Or on next app startup"
echo "   • Or when user manually triggers sync"
echo ""
echo "📡 Cloud URLs:"
echo "   • Migration: https://your-r2-domain/migrations/$FILENAME"
echo "   • Manifest: https://your-r2-domain/migrations/manifest.json"
echo ""
echo "💡 Next Steps:"
echo "   1. Monitor application logs for sync activity"
echo "   2. Verify migration appears in schema_migrations table"
echo "   3. Test feature functionality on target devices"
echo ""
