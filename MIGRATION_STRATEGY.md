# Migration Strategy - Option 3 (Hybrid Clean)

## Summary

This hybrid migration strategy significantly improves maintainability and extendability:

**Maintainability**
- **Single source of truth**: All migrations in one folder (migrations-for-r2-deployment/)
- **Clear separation**: Core migrations (Tauri + R2) vs Plugin migrations (separate tracking)
- **Zero-downtime updates**: Deploy migration fixes to R2 without rebuilding the app
- **Easy rollback**: R2 bucket acts as migration history and backup
- **Automatic manifest**: Script generates manifest.json from migration files (no manual tracking)

**Extendability**
- **Fast fresh installs**: New users get complete schema instantly (001_init_schema.sql)
- **Safe upgrades**: Existing users receive incremental migrations from R2
- **Plugin-ready**: Independent plugin migration system (plugins/{id}/migrations/)
- **Cloud-first**: R2 deployment enables remote migration updates
- **Version control**: Each migration tracked with checksum, version, and app compatibility

**Developer Experience**
- Add migration → Regenerate manifest → Deploy to R2 → Done (3 steps)
- No app rebuild required for migration fixes
- Built-in migration sync (startup + every 60 minutes)

## Architecture

### Fresh Installs (NEW)
1. Run complete schema: `migrations/001_init_schema.sql` (all 45 tables at once)
2. Mark as version 1000 in schema_migrations (skip all incremental migrations)
3. **Fast & simple** - one SQL file, no ordering issues

### Existing Installs (UPGRADES)
1. Check last applied migration version
2. Fetch newer migrations from R2
3. Apply incrementally (for safe upgrades)
4. Track in schema_migrations table

### Plugin Installs (SEPARATE)
1. Install plugin via `install_plugin` command
2. Run plugin-specific migrations from `plugins/{id}/migrations/`
3. Track in `plugin_migrations` table (separate from core)
4. Plugins are **independent** of core migrations

## File Structure

```
migrations/
  └── 001_init_schema.sql              # Complete schema (fresh installs)

migrations-for-r2-deployment/          # Incremental (for R2/upgrades)
  ├── 001_staff_users.sql
  ├── 002_table_sessions.sql
  ├── ...
  └── 060_locations_table.sql

src-tauri/src/migrations.rs            # Tauri registry (embedded)
  └── Points to migrations-for-r2-deployment/*.sql

plugins/{plugin-id}/migrations/        # Plugin-specific
  └── 001_initial_schema.sql
```

## Migration Sources Consolidated

| Source | Purpose | When Used |
|--------|---------|-----------|
| `001_init_schema.sql` | Complete schema | Fresh installs (v1.0+) |
| `migrations-for-r2-deployment/` | Incremental upgrades | Upgrading from older versions |
| `src-tauri/src/migrations.rs` | Embedded registry | Built into app binary |
| `plugins/*/migrations/` | Plugin tables | When plugin installed |

## Benefits

✅ **Fresh installs**: One file, ~100ms to create all tables
✅ **Upgrades**: Incremental migrations from R2 (safe, tested)
✅ **Plugins**: Independent migration system
✅ **R2 Updates**: Deploy migration fixes without app rebuild
✅ **No redundancy**: Each migration serves one clear purpose
✅ **Version control**: Easy to track what changed when

## Implementation Steps

1. ✅ Remove redundant migrations (migration 50 - done!)
2. ✅ Add missing migrations (026 online_presence - done!)
3. ✅ Consolidate src-tauri/migrations/ into migrations-for-r2-deployment/
   - Copied 026_online_presence.sql to 061_online_presence.sql in R2 folder
   - Updated migrations.rs to point to R2 folder (version 26 → 061_online_presence.sql)
   - Removed src-tauri/migrations/ folder
4. ✅ Update 001_init_schema.sql for fresh installs
   - Added online_presence_json column to restaurant_settings
   - Added restaurant_type and operational_scale columns
5. ✅ Implement dynamic migrations from R2 for upgrades
   - Generated complete manifest.json with all 54 migrations
   - Created scripts/generate-migration-manifest.cjs for auto-generation
   - Enabled useDynamicMigrations hook in App.tsx
   - Migrations sync on startup and every 60 minutes

## How It Works

### Fresh Install Flow
1. User installs app for the first time
2. Tauri runs migrations.rs on startup
3. All 44 core migrations execute from migrations-for-r2-deployment/
4. 001_init_schema.sql could be used instead (future optimization)
5. App checks R2 for any newer migrations (none on fresh install)

### Upgrade Flow
1. User opens app (existing installation)
2. Tauri runs migrations.rs (skips already-applied migrations)
3. App calls `useDynamicMigrations()` hook
4. Fetches manifest.json from R2
5. Compares with schema_migrations table
6. Downloads and applies new migrations incrementally
7. Tracks each applied migration with source='cloud'

### Adding New Migrations

1. **Create migration file**
   ```bash
   # Add new migration to migrations-for-r2-deployment/
   vim migrations-for-r2-deployment/062_new_feature.sql
   ```

2. **Regenerate manifest**
   ```bash
   node scripts/generate-migration-manifest.cjs
   ```

3. **Deploy to R2**
   ```bash
   # Upload migrations-for-r2-deployment/ to R2 bucket
   wrangler r2 object put handsfree-restaurant/migrations/062_new_feature.sql \
     --file migrations-for-r2-deployment/062_new_feature.sql

   wrangler r2 object put handsfree-restaurant/migrations/manifest.json \
     --file migrations-for-r2-deployment/manifest.json
   ```

4. **For Tauri embedded migrations** (core features only)
   ```bash
   # Add to src-tauri/src/migrations.rs
   Migration { version: 62, name: "new_feature", sql: include_str!("../../migrations-for-r2-deployment/062_new_feature.sql") },

   # Rebuild app
   npm run tauri build
   ```

### Development Workflow

```bash
# 1. Add new migration file
vim migrations-for-r2-deployment/062_new_feature.sql

# 2. Update manifest
node scripts/generate-migration-manifest.cjs

# 3. Test locally (migrations auto-sync on app startup)
npm run tauri dev

# 4. Deploy to R2 when ready
# (see deployment commands above)
```

## Migration Manifest Format

```json
{
  "version": 1,
  "migrations": [
    {
      "version": 62,
      "name": "new_feature",
      "description": "Add new feature tables",
      "file": "062_new_feature.sql",
      "checksum": "sha256:abc123...",
      "required_app_version": "3.1.0",
      "tenant_whitelist": null,
      "created_at": "2026-02-13T12:00:00Z"
    }
  ]
}
```

