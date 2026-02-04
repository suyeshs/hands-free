# Migration Architecture Refactoring

**Date**: 2026-01-30
**Status**: ✅ Phase 1 Complete
**Issue**: Global dynamic migrations were loading on every app startup, applying migrations for features that should be plugin-based

---

## Problem Statement

The app had **two migration systems running in conflict**:

1. **Global Dynamic Migrations** (R2-based)
   - Ran on app startup via `useDynamicMigrations()` hook
   - Applied **all 44 migrations** from central R2 manifest
   - Included features that should be plugins (bar management, inventory, KDS, etc.)
   - Created tables regardless of whether plugins were installed

2. **Plugin-Based Migrations** (Plugin Manager)
   - Ran when plugins were installed via `pluginManager.install()`
   - Downloaded from plugin-specific R2 paths
   - Tracked per-plugin in `plugin_migrations` table
   - **Correct approach but wasn't being used**

## Solution Implemented

### ✅ Changes Made

#### 1. Disabled Global Dynamic Migrations
**File**: [src/App.tsx:381-398](src/App.tsx#L381-L398)

```typescript
// DISABLED: Global dynamic migrations replaced by plugin-based migrations
// With the new WASM plugin architecture, migrations are applied when plugins are installed
// Each plugin defines its own migrations via manifest.data.migration_path
// Core POS migrations should be handled via Tauri's built-in migration system
//
// See: src/services/plugins/pluginManager.ts - applyPluginMigrations()
// See: packages/plugin-sdk/src/types.ts - PluginManifest.data.migration_path
```

**Also removed import**: [src/App.tsx:66](src/App.tsx#L66)

#### 2. Updated Plugin Manifests

Added `migration_path` to plugin manifests:

**Bar Management** - [plugins/bar-management/manifest.json:117](plugins/bar-management/manifest.json#L117)
```json
"data": {
  "tables": ["bar_inventory", "bar_recipes", "bar_recipe_ingredients", ...],
  "storage_keys": ["bar_management:settings", "bar_management:last_closing", ...],
  "uninstall_behavior": "archive",
  "export_format": "json",
  "migration_path": "plugins/bar-management/migrations"  // ← NEW
}
```

**Bar Management V2** - [plugins/sample-plugins/bar-management-v2.json:76-80](plugins/sample-plugins/bar-management-v2.json#L76-L80)
```json
"data": {
  "tables": ["bar_inventory", "bar_recipes", "bar_closing_reports", "bar_wastage"],
  "storage_keys": ["bar_management:settings", "bar_management:last_closing"],
  "migration_path": "plugins/bar-management-v2/migrations"  // ← NEW
}
```

---

## New Migration Architecture

### 🎯 Core POS Migrations (Built-in Tauri)

**Location**: `src-tauri/migrations/*.sql`
**Applied**: Automatically on app startup
**Tracking**: Tauri's internal migration system

**Core Features Only:**
- `restaurant_settings` (includes `online_presence_json`)
- `staff_users`
- `table_sessions`
- `sales_transactions`
- `daily_cash_registers`
- `cash_payouts`
- `tenant_activation`
- `migration_tracking`
- `location_tenants`
- `setup_wizard_state`
- `tips`
- `i18n_support`
- `seed_translations`

### 🔌 Plugin-Based Migrations

**Location**: R2 bucket at `{registryUrl}/{migration_path}/`
**Applied**: When plugin is installed
**Tracking**: `plugin_migrations` table

**Implementation**: [src/services/plugins/pluginManager.ts:1106-1180](src/services/plugins/pluginManager.ts#L1106-L1180)

```typescript
private async applyPluginMigrations(pluginId: string, manifest: PluginManifest) {
  if (!manifest.data?.migration_path) return;

  // Download migration manifest from R2
  const migrationManifestUrl = `${this.registryUrl}/${manifest.data.migration_path}/manifest.json`;
  const migrationManifest = await fetch(migrationManifestUrl).then(r => r.json());

  // Apply unapplied migrations
  for (const migration of migrationManifest.migrations) {
    if (!appliedVersions.has(migration.version)) {
      const sqlUrl = `${this.registryUrl}/${manifest.data.migration_path}/${migration.name}`;
      const sql = await fetch(sqlUrl).then(r => r.text());

      // Execute via Tauri command
      await invoke('execute_sql', { sql });

      // Track in plugin_migrations table
      await this.db.execute(
        'INSERT INTO plugin_migrations (plugin_id, version, name, applied_at) VALUES (?, ?, ?, ?)',
        [pluginId, migration.version, migration.name, new Date().toISOString()]
      );
    }
  }
}
```

**Plugin Features:**
- **Bar Management** → `bar_inventory`, `bar_recipes`, `bar_transactions`, `bar_closing_sessions`
- **Aggregator Integration** → `aggregator_orders`
- **KDS** → `kds_orders`
- **Inventory** → `inventory`, `inventory_sync`
- **Floor Plan** → `floor_plan_sync`
- **Attendance** → `attendance_records`, `weekly_roster`, `leave_management`
- **Guest Orders** → `guest_orders`

---

## Migration Manifest Format

### Core POS Migrations
Located in `src-tauri/migrations/`, applied automatically by Tauri.

### Plugin Migrations

**Manifest Location**: `{registryUrl}/{migration_path}/manifest.json`

**Format**:
```json
{
  "version": 1,
  "migrations": [
    {
      "version": 1,
      "name": "001_initial_schema.sql",
      "description": "Create bar inventory tables",
      "checksum": "sha256:abc123...",
      "created_at": "2026-01-30T00:00:00Z"
    },
    {
      "version": 2,
      "name": "002_add_wastage.sql",
      "description": "Add wastage tracking",
      "checksum": "sha256:def456...",
      "created_at": "2026-01-30T00:00:00Z"
    }
  ]
}
```

**Migration Files**: `{registryUrl}/{migration_path}/{migration.name}`

---

## Action Items

### ✅ Completed
- [x] Disabled global dynamic migrations in App.tsx
- [x] Removed unused import
- [x] Added `migration_path` to bar-management plugin manifests
- [x] Documented new architecture

### 📋 TODO

#### 1. **Create Plugin Migration Files in R2**

For each plugin that currently has tables in the global manifest, create:

```
plugins/
  bar-management/
    migrations/
      manifest.json          ← Migration manifest
      001_initial_schema.sql ← Create bar tables
      002_add_indexes.sql    ← Add indexes
  aggregator-integration/
    migrations/
      manifest.json
      001_aggregator_orders.sql
  inventory/
    migrations/
      manifest.json
      001_inventory_tables.sql
  kds/
    migrations/
      manifest.json
      001_kds_orders.sql
```

**Migration Scripts to Create**:
- `bar-management` → Extract migrations 33-34 from global manifest
- `aggregator-integration` → Extract migrations 4, 12, 13 from global manifest
- `inventory` → Extract migrations 11, 30 from global manifest
- `kds` → Extract migration 6 from global manifest
- `floor-plan` → Extract migration 24 from global manifest
- `attendance` → Extract migrations 17-20 from global manifest
- `guest-orders` → Extract migration 37 from global manifest

#### 2. **Update All Plugin Manifests**

Add `migration_path` to:
- [ ] aggregator-integration plugin
- [ ] inventory plugin
- [ ] kds plugin
- [ ] floor-plan plugin
- [ ] attendance plugin
- [ ] guest-orders plugin

#### 3. **Create Core POS Migration Cleanup**

Remove plugin migrations from `migrations-for-r2-deployment/` directory:
- Keep only core POS migrations (settings, staff, tables, sales, cash, tenant, tips, i18n)
- Move plugin migrations to respective plugin directories

#### 4. **Testing**

- [ ] Fresh install test (new database)
  - Verify core migrations apply automatically
  - Install a plugin (e.g., bar-management)
  - Verify plugin migrations apply during install
  - Check `plugin_migrations` table

- [ ] Upgrade test (existing database)
  - Users who already have global migrations applied
  - Plugin install should skip already-applied migrations
  - No duplicate tables should be created

- [ ] Uninstall test
  - Verify plugin migrations are tracked separately
  - Check rollback/snapshot functionality

#### 5. **Documentation Updates**

- [ ] Update `DYNAMIC_MIGRATIONS_IMPLEMENTATION_COMPLETE.md` to reflect deprecation
- [ ] Update `docs/DYNAMIC_MIGRATION_SYSTEM.md` with new architecture
- [ ] Create plugin migration authoring guide
- [ ] Update plugin development docs

---

## Benefits of New Architecture

### ✅ Modular
- Plugins only apply migrations for features they provide
- No unnecessary tables in fresh installs

### ✅ Clean Separation
- Core POS features → Built-in Tauri migrations
- Plugin features → Plugin-specific migrations

### ✅ Proper Tracking
- Core migrations tracked by Tauri
- Plugin migrations tracked per-plugin in `plugin_migrations` table
- Easy to rollback individual plugins

### ✅ Offline-First
- Plugins can bundle migrations in offline `.hfpb` files
- No dependency on R2 availability for offline installs

### ✅ Scalable
- Each plugin manages its own schema
- No central manifest to maintain for plugin features

---

## Online Presence Status

**Good News**: Online presence is a **core POS feature**, not a plugin!

- Migration exists: [src-tauri/migrations/026_online_presence.sql](src-tauri/migrations/026_online_presence.sql)
- Adds `online_presence_json` column to `restaurant_settings` table
- Already applied via Tauri's built-in migration system
- UI exists: [src/pages-v2/OnlinePresenceSettings.tsx](src/pages-v2/OnlinePresenceSettings.tsx)

**To Verify**: Run the app and check Settings → Business Setup → Online Presence

---

## Related Files

### Core Files Modified
- [src/App.tsx](src/App.tsx) - Disabled `useDynamicMigrations()` hook
- [plugins/bar-management/manifest.json](plugins/bar-management/manifest.json) - Added `migration_path`
- [plugins/sample-plugins/bar-management-v2.json](plugins/sample-plugins/bar-management-v2.json) - Added `migration_path`

### Plugin System Files
- [src/services/plugins/pluginManager.ts](src/services/plugins/pluginManager.ts) - Plugin migration handler
- [packages/plugin-sdk/src/types.ts](packages/plugin-sdk/src/types.ts) - `PluginManifest.data.migration_path`

### Legacy Files (Now Deprecated)
- [src/hooks/useDynamicMigrations.ts](src/hooks/useDynamicMigrations.ts) - No longer used
- [src/services/dynamicMigrations.ts](src/services/dynamicMigrations.ts) - No longer used
- [migrations-for-r2-deployment/](migrations-for-r2-deployment/) - Should be split into core + plugins

---

**Next Step**: Create plugin migration files in R2 and test fresh install + plugin install flow.
