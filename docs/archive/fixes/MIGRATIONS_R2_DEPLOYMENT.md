# Migration System - R2 Deployment

## What Was Changed

### 1. **Removed Embedded Migrations**
- **File:** `src-tauri/src/lib.rs`
- **Change:** Removed all embedded migrations (versions 2-50)
- **Kept:** Only version 1 (base schema) is embedded
- **Reason:** Allows deploying migration fixes without rebuilding the app

### 2. **Uploaded All Migrations to R2**
- **Script:** `deploy-all-migrations.sh`
- **Bucket:** `handsfree-pos`
- **Location:** `handsfree-pos/migrations/`
- **Total Migrations:** 46 migrations (versions 2-50)
- **Manifest:** `handsfree-pos/migrations/manifest.json`

### 3. **Fixed Migration Issues**
Fixed these issues before upload:
- **Migration 044:** Removed duplicate `owner_name` column (already in 042)
- **Migration 044:** Removed duplicate online sync columns (already in 031)
- **Migration 048:** Fixed reference to non-existent `tenants` table
- **Renumbered duplicates:**
  - `014_sync_tables.sql` → `045_sync_tables.sql`
  - `030_staff_payroll.sql` → `046_staff_payroll.sql`
  - `043_combo_filter_keywords.sql` → `047_combo_filter_keywords.sql`
- **Removed orphaned migrations:**
  - Deleted `037_user_device_alignment.sql` (superseded by 040)
  - Renamed `039_device_settings.sql` → `048_device_settings.sql`
  - Renamed `040_user_device_alignment.sql` → `049_user_device_alignment.sql`

## How It Works

1. **App Startup:**
   - App applies version 1 (base schema) from embedded SQL
   - Dynamic migration service checks for newer migrations

2. **Migration Sync:**
   - Fetches `{cloud_base_url}/migrations/manifest.json`
   - Downloads and applies any pending migrations
   - Verifies checksums before applying
   - Records applied migrations in `schema_migrations` table

3. **Version Control:**
   - Each migration has a `required_app_version` field
   - Only applies migrations compatible with current app version
   - Tenant whitelist support (optional)

## R2 Structure

```
handsfree-pos/
└── migrations/
    ├── manifest.json
    ├── 001_staff_users.sql
    ├── 002_table_sessions.sql
    ├── ...
    └── 049_user_device_alignment.sql
```

## Testing Steps

1. **Delete existing database:**
   ```bash
   rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos/pos.db*
   ```

2. **Rebuild and run app:**
   ```bash
   bun run tauri dev
   ```

3. **Verify migrations:**
   - Check app logs for migration downloads
   - Verify all tables exist in database
   - Check `schema_migrations` table for applied versions

4. **SQL to verify:**
   ```sql
   SELECT COUNT(*) FROM _sqlx_migrations;
   SELECT version, description FROM _sqlx_migrations ORDER BY version DESC LIMIT 10;
   ```

## Deploying New Migrations

### Single Migration:
```bash
./deploy-migration.sh src-tauri/migrations/050_new_feature.sql 51 new_feature 3.1.0
```

### Re-deploy All:
```bash
./deploy-all-migrations.sh
```

## Configuration Required

Set the R2 public URL in your app configuration:
- Frontend: Check `src/lib/dynamicMigrations.ts` or similar
- Backend: Check `src-tauri/src/services/dynamic_migrations.rs`

The URL should point to your R2 bucket's public domain, e.g.:
- `https://handsfree-pos.r2.cloudflarestorage.com` (R2 direct)
- `https://cdn.yoursite.com` (Custom domain with R2)

## Benefits

✅ **No app rebuild for migration fixes**
✅ **Centralized migration management**
✅ **Easy rollout of database changes**
✅ **Version-controlled via git + R2**
✅ **Tenant-specific migrations (if needed)**

## Rollback

If you need to revert to embedded migrations:
1. Restore `src-tauri/src/lib.rs` from git history
2. Rebuild the app
3. Migrations will be embedded again

## Next Steps

1. Configure R2 public URL in app
2. Test migration fetch on fresh install
3. Monitor logs for any download failures
4. Set up CDN (optional) for faster downloads
