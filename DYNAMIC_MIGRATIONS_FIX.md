# Dynamic Migration System - Issues Fixed ✅

## Summary

The dynamic migration system was **fully implemented but not activated**. I've identified and fixed the primary issues.

---

## Issues Found

### 1. ✅ FIXED: Hook Not Called in App.tsx

**Problem**: The `useDynamicMigrations` hook existed but was never called in `App.tsx`, so migrations were never checked.

**Fix Applied**: Added the hook to [App.tsx:360-370](src/App.tsx#L360-L370):

```tsx
// Auto-sync dynamic migrations from cloud (on startup and every hour)
useDynamicMigrations({
  checkOnStartup: true,
  checkIntervalMinutes: 60,
  onMigrationsApplied: (migrations) => {
    console.log('[App] Applied dynamic migrations:', migrations);
  },
  onError: (error) => {
    console.error('[App] Dynamic migration sync failed:', error);
  },
});
```

### 2. ⚠️ ACTION REQUIRED: No Migrations Manifest or Files in R2

**Problem**: The system tries to fetch migrations from R2, but no manifest or migration files have been uploaded yet.

**Expected URL**: The system looks for migrations at:
- Manifest: `{CLOUD_BASE_URL}/migrations/manifest.json`
- Migrations: `{CLOUD_BASE_URL}/migrations/039_example.sql`

**Current Status**:
- ❌ No local `migrations/` directory
- ❌ No `manifest.json` created
- ❌ No migrations uploaded to R2
- ⚠️ Environment variable `VITE_API_BASE_URL` not set (falls back to `https://api.handsfreepos.com`)

**What happens now**: The sync will run and gracefully fail with a network error because no manifest exists. This is expected behavior when there are no cloud migrations.

---

## How the System Works Now

### On App Startup:
1. ✅ Hook calls `syncDynamicMigrations()` on startup
2. ✅ Backend fetches manifest from `{CLOUD_BASE_URL}/migrations/manifest.json`
3. If manifest doesn't exist → Logs error and continues (app works normally)
4. If manifest exists → Downloads and applies new migrations

### Every Hour:
1. ✅ Hook automatically checks for new migrations
2. Same process as startup

### Error Handling:
- ✅ Network errors are logged but don't show toast (to avoid spam when offline)
- ✅ Other errors show toast notifications
- ✅ App continues working even if sync fails

---

## To Deploy Your First Cloud Migration

### Option 1: Use the Deployment Script

1. **Create migration file**:
```bash
cat > src-tauri/migrations/039_example_feature.sql << 'EOF'
-- Example feature: Customer feedback
CREATE TABLE IF NOT EXISTS customer_feedback (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);
EOF
```

2. **Create the deployment script**:
```bash
cat > deploy-migration.sh << 'SCRIPT'
#!/bin/bash
set -e

if [ "$#" -ne 4 ]; then
    echo "Usage: ./deploy-migration.sh <file> <version> <name> <min_app_version>"
    echo "Example: ./deploy-migration.sh src-tauri/migrations/039_example.sql 39 example_feature 3.1.0"
    exit 1
fi

MIGRATION_FILE=$1
MIGRATION_VERSION=$2
MIGRATION_NAME=$3
REQUIRED_APP_VERSION=$4

echo "🚀 Deploying migration: $MIGRATION_NAME (v$MIGRATION_VERSION)"

# Calculate checksum
echo "📝 Calculating checksum..."
CHECKSUM=$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')
echo "   Checksum: sha256:$CHECKSUM"

# Create migrations directory if needed
mkdir -p migrations

# Create or update manifest
echo "📋 Creating/updating manifest..."
if [ ! -f "migrations/manifest.json" ]; then
    echo '{"version": 1, "migrations": []}' > migrations/manifest.json
fi

# Add migration to manifest
MANIFEST_ENTRY=$(cat <<EOF
{
  "version": $MIGRATION_VERSION,
  "name": "$MIGRATION_NAME",
  "description": "$(head -1 $MIGRATION_FILE | sed 's/^-- //' || echo 'Migration')",
  "file": "$(basename $MIGRATION_FILE)",
  "checksum": "sha256:$CHECKSUM",
  "required_app_version": "$REQUIRED_APP_VERSION",
  "tenant_whitelist": null,
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

# Use jq to add migration (install with: brew install jq)
if command -v jq &> /dev/null; then
    jq ".migrations += [$MANIFEST_ENTRY]" migrations/manifest.json > migrations/manifest.tmp
    mv migrations/manifest.tmp migrations/manifest.json
else
    echo "⚠️  jq not installed. Please install with: brew install jq"
    exit 1
fi

# Copy migration file to migrations directory
cp "$MIGRATION_FILE" "migrations/$(basename $MIGRATION_FILE)"

echo "✅ Migration packaged locally!"
echo ""
echo "📊 Summary:"
echo "   Name: $MIGRATION_NAME"
echo "   Version: $MIGRATION_VERSION"
echo "   Required App: $REQUIRED_APP_VERSION"
echo "   Checksum: sha256:$CHECKSUM"
echo ""
echo "🎯 Next steps:"
echo "   1. Review migrations/manifest.json"
echo "   2. Upload to R2 or serve from your API endpoint"
echo "   3. Set VITE_API_BASE_URL to your migrations server URL"
echo ""
echo "Upload commands (if using Cloudflare R2):"
echo "   wrangler r2 object put handsfree-pos/migrations/$(basename $MIGRATION_FILE) --file=migrations/$(basename $MIGRATION_FILE)"
echo "   wrangler r2 object put handsfree-pos/migrations/manifest.json --file=migrations/manifest.json"
SCRIPT

chmod +x deploy-migration.sh
```

3. **Deploy the migration**:
```bash
./deploy-migration.sh \
  src-tauri/migrations/039_example_feature.sql \
  39 \
  "customer_feedback" \
  "3.1.0"
```

4. **Upload to R2** (if using Cloudflare R2):
```bash
# Upload migration file
wrangler r2 object put handsfree-pos/migrations/039_example_feature.sql \
  --file=migrations/039_example_feature.sql

# Upload manifest
wrangler r2 object put handsfree-pos/migrations/manifest.json \
  --file=migrations/manifest.json
```

5. **Configure environment variable**:

Add to [.env](.env):
```bash
# Dynamic migrations cloud URL
VITE_API_BASE_URL=https://your-r2-bucket-url.r2.dev
```

### Option 2: Serve from Your Backend API

If you have an existing API endpoint, you can serve the migrations from there instead of R2:

1. Deploy migration files to your API server at:
   - `https://your-api.com/migrations/manifest.json`
   - `https://your-api.com/migrations/039_example.sql`

2. Set the environment variable:
```bash
VITE_API_BASE_URL=https://your-api.com
```

3. Ensure CORS is enabled for your frontend domain

---

## Environment Variables

The system uses these environment variables:

### Backend (Rust)
- `VITE_API_BASE_URL` - Base URL for migrations (defaults to `https://api.handsfreepos.com`)

### Frontend
- No additional variables needed (uses Tauri invoke)

**Note**: Tauri apps can access environment variables set at build time. To set runtime variables, add them to `.env` and rebuild the app.

---

## Testing the Fix

### 1. Check Console Logs

After the fix, you should see in the browser console (on app startup):

```
[DynamicMigrations] Checking for new migrations...
[DynamicMigrations] Fetching manifest from: https://api.handsfreepos.com/migrations/manifest.json
```

If no manifest exists (expected for now):
```
[DynamicMigrations] Sync failed: Failed to fetch manifest: ...
```

This is **normal and expected** until you upload your first migration!

### 2. Test Manual Sync

Open browser console and run:

```javascript
// Test sync
await window.__TAURI__.invoke('sync_dynamic_migrations')
  .then(applied => console.log('Applied:', applied))
  .catch(err => console.error('Error:', err));

// View migration history
await window.__TAURI__.invoke('get_migration_history')
  .then(history => console.table(history));
```

### 3. Check Migration Tracking Table

```bash
# Open database
sqlite3 ~/Library/Application\ Support/com.stonepot.handsfree/pos.db

# View table schema
.schema schema_migrations

# View applied migrations
SELECT version, name, source, datetime(applied_at, 'unixepoch') as applied_at
FROM schema_migrations
ORDER BY version DESC
LIMIT 10;
```

---

## Current System Status

### ✅ Working
- Migration tracking table created (migration 038)
- Tauri commands registered (`sync_dynamic_migrations`, `get_migration_history`)
- Frontend service and hook implemented
- Hook now activated in App.tsx
- Auto-sync on startup
- Periodic checks every 60 minutes
- Error handling and logging
- Checksum verification
- Version compatibility checks
- Tenant whitelisting support

### ⚠️ Pending
- Upload first migration manifest to R2 or API endpoint
- Configure `VITE_API_BASE_URL` if using custom endpoint
- Test with an actual migration

---

## Next Steps

1. **Test the current implementation**:
   - Start the app
   - Check console for migration sync attempts
   - Verify graceful failure when no manifest exists

2. **When ready to deploy cloud migrations**:
   - Create your first migration file
   - Run the deployment script
   - Upload to R2 or your API endpoint
   - Configure `VITE_API_BASE_URL`
   - Test sync and verify migration is applied

3. **Monitor in production**:
   - Watch console logs for sync activity
   - Check `schema_migrations` table periodically
   - Add custom logging/monitoring if needed

---

## Questions?

The system is now **production-ready** for testing. It will:
- ✅ Try to sync migrations on startup
- ✅ Gracefully handle missing manifest
- ✅ Continue checking periodically
- ✅ Apply migrations automatically when available

Once you upload your first manifest, migrations will start syncing automatically to all running apps! 🚀
