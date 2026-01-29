#!/bin/bash
# Deploy All Migrations to Cloudflare R2
# This uploads all migrations from src-tauri/migrations/ to R2

set -e

echo ""
echo "🚀 Deploying All Migrations to R2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is not installed. Please install it first:"
    echo "   macOS: brew install jq"
    echo "   Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler is not installed. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

MIGRATIONS_DIR="migrations-for-r2-deployment"
MIN_APP_VERSION="3.1.0"

# Create fresh manifest
echo '{"version": 1, "migrations": []}' > migrations/manifest.json
echo "✅ Created fresh manifest.json"
echo ""

# Upload all migration files
echo "📤 Uploading migration files to R2..."
for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "  Uploading: $filename"
        wrangler r2 object put "handsfree-pos/migrations/$filename" --file="$file" --remote > /dev/null 2>&1 || echo "  ⚠️  Failed: $filename"
    fi
done
echo "✅ All migration files uploaded"
echo ""

# Build manifest entries for each migration
echo "📋 Building migration manifest..."
for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ ! -f "$file" ]; then
        continue
    fi

    filename=$(basename "$file")
    # Extract version number from filename (e.g., 001_staff_users.sql -> 2)
    # Note: Version numbers start at 2 because version 1 is the base schema
    file_num=$(echo "$filename" | sed 's/^0*//' | cut -d'_' -f1)
    version=$((file_num + 1))

    # Extract migration name (e.g., 001_staff_users.sql -> staff_users)
    name=$(echo "$filename" | sed 's/^[0-9]*_//' | sed 's/\.sql$//')

    # Calculate checksum
    checksum=$(shasum -a 256 "$file" | awk '{print $1}')

    # Extract description from first SQL comment
    description=$(head -1 "$file" | sed 's/^--[[:space:]]*//')
    if [ -z "$description" ]; then
        description="$name migration"
    fi

    # Create manifest entry
    manifest_entry=$(cat <<EOF
{
  "version": $version,
  "name": "$name",
  "description": "$description",
  "file": "$filename",
  "checksum": "sha256:$checksum",
  "required_app_version": "$MIN_APP_VERSION",
  "tenant_whitelist": null,
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

    # Add to manifest
    jq ".migrations += [$manifest_entry]" migrations/manifest.json > migrations/manifest.tmp
    mv migrations/manifest.tmp migrations/manifest.json

    echo "  ✅ Added: v$version - $name"
done

echo ""
echo "☁️  Uploading manifest to R2..."
wrangler r2 object put handsfree-pos/migrations/manifest.json --file=migrations/manifest.json
echo "✅ Manifest uploaded"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ All Migrations Deployed Successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
migration_count=$(jq '.migrations | length' migrations/manifest.json)
echo "   Total Migrations: $migration_count"
echo "   Required App Version: $MIN_APP_VERSION"
echo ""
echo "💡 Next Steps:"
echo "   1. Rebuild and reinstall the app"
echo "   2. App will fetch and apply migrations from R2 on first run"
echo "   3. Check application logs to verify migrations applied successfully"
echo ""
