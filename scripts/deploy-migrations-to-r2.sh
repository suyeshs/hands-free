#!/bin/bash
# Deploy migrations to Cloudflare R2
# Uploads all migration files and manifest.json to R2 bucket

set -e  # Exit on error

BUCKET_NAME="handsfree-pos"  # Must match wrangler.jsonc ASSETS binding
MIGRATIONS_DIR="migrations-for-r2-deployment"

# Get absolute path to project root (script is in scripts/ subdirectory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_PATH="$PROJECT_ROOT/$MIGRATIONS_DIR"

echo "📦 Deploying migrations to R2..."
echo "Bucket: $BUCKET_NAME (matches worker ASSETS binding)"
echo "Source: $MIGRATIONS_PATH/"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

# Upload manifest first
echo "1️⃣ Uploading manifest.json..."
wrangler r2 object put "$BUCKET_NAME/migrations/manifest.json" \
  --file "$MIGRATIONS_PATH/manifest.json" \
  --content-type="application/json"

echo "✅ Manifest uploaded"
echo ""

# Upload all migration files
echo "2️⃣ Uploading migration files..."
UPLOAD_COUNT=0

for file in "$MIGRATIONS_PATH"/*.sql; do
  filename=$(basename "$file")
  echo "   - $filename"

  wrangler r2 object put "$BUCKET_NAME/migrations/$filename" \
    --file "$file" \
    --content-type="text/plain" > /dev/null 2>&1 || echo "   ⚠️  Warning: Failed to upload $filename"

  ((UPLOAD_COUNT++))
done

echo ""
echo "✅ Deployment complete!"
echo "   - Manifest: 1 file"
echo "   - Migrations: $UPLOAD_COUNT files"
echo ""
echo "🌐 Migrations available at:"
echo "   https://handsfree-restaurant.suyesh.workers.dev/migrations/"
