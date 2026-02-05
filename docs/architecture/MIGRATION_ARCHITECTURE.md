# Migration Architecture

## Overview

The POS system uses a clean separation between **core POS migrations** and **plugin migrations**.

## Architecture

### 1. Core Migrations (Static - Run on App Startup)

**Location:** `src-tauri/src/migrations.rs`

**Source:** All SQL files in `migrations-for-r2-deployment/` are embedded at compile time using `include_str!`

**Execution:** Automatically run on every app startup in `lib.rs` setup function

**Tracking:** Migration versions tracked in `schema_migrations` table

**Updates:** Come with app version updates (users download new app → new schema)

#### Core Tables Created:
- `setup_wizard_state` - Wizard progress and provisioning data
- `tenant_config` - Tenant activation and configuration
- `restaurant_settings` - Restaurant info and settings
- `menu_items`, `menu_categories` - Menu management
- `orders`, `order_items` - Order processing
- `floor_tables`, `table_sessions` - Table management
- `staff_users` - Staff authentication
- `kds_orders` - Kitchen display orders
- `sales_transactions` - Sales records
- `cash_registers`, `cash_payouts` - Cash management
- `inventory`, `inventory_suppliers` - Inventory tracking
- `aggregator_orders` - Third-party platform integration
- And 40+ more core tables...

### 2. Plugin Migrations (Dynamic - Run on Plugin Install)

**Location:** Plugin-specific migration files stored in R2
  - Example: `plugins/bar-management/migrations/*.sql`

**Execution:** Run when plugin is installed via plugin manager

**Tracking:** Tracked separately per plugin in plugin system

**Updates:** Come with plugin updates (install new plugin version → run new migrations)

#### Plugin Tables:
- `bar_inventory`, `bar_recipes` (bar-management plugin)
- `loyalty_points`, `loyalty_tiers` (loyalty plugin)
- Future plugin tables...

## How It Works

### App Startup Flow

```rust
// src-tauri/src/lib.rs
fn setup() {
    // 1. Get database path
    let db_path = app.path().app_data_dir().join("pos.db");

    // 2. Run ALL core migrations
    migrations::run_migrations(&db_path)?;

    // 3. Continue with app initialization
}
```

### Migration Runner Logic

```rust
// src-tauri/src/migrations.rs
pub fn run_migrations(db_path: &PathBuf) -> Result<()> {
    // 1. Create schema_migrations table
    create_migrations_table(&db);

    // 2. For each migration in MIGRATIONS array:
    for migration in MIGRATIONS {
        // Check if already applied
        if is_migration_applied(&db, migration.version) {
            continue; // Skip
        }

        // Execute SQL
        db.execute_batch(migration.sql)?;

        // Mark as applied
        mark_migration_applied(&db, migration.version, migration.name)?;
    }
}
```

### Plugin Install Flow

```typescript
// src/services/plugins/pluginManager.ts
async installPlugin(manifestUrl: string) {
    // 1. Download plugin manifest
    const manifest = await fetch(manifestUrl).json();

    // 2. If plugin has migrations, run them
    if (manifest.data.migration_path) {
        await runPluginMigrations(manifest);
    }

    // 3. Register plugin
}
```

## Benefits

### ✅ Clean Separation
- **Core tables**: Always available, versioned with app
- **Plugin tables**: Optional, versioned with plugin

### ✅ No Runtime Schema Changes
- All core schema changes in version control
- No fragmented `ALTER TABLE` calls in command code
- Easier to review and test

### ✅ Proper Migration Tracking
- Every migration has a version number
- Tracked in `schema_migrations` table
- Idempotent (safe to run multiple times)

### ✅ Faster Debugging
- One place to check core schema (`migrations.rs`)
- Clear separation from plugin schemas
- Migration history visible in database

### ✅ Plugin Isolation
- Plugins can't break core schema
- Plugin uninstall can safely remove plugin tables
- Core app works without any plugins

## Migration File Format

### Core Migration Example

```sql
-- migrations-for-r2-deployment/025_setup_wizard_state.sql

-- Migration: Setup Wizard State
-- Stores the setup wizard progress and completion state

CREATE TABLE IF NOT EXISTS setup_wizard_state (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton table
    current_screen TEXT NOT NULL DEFAULT 'welcome',
    is_complete BOOLEAN NOT NULL DEFAULT 0,
    -- ... more columns
);

-- Initialize with default state
INSERT OR IGNORE INTO setup_wizard_state (id) VALUES (1);
```

### Plugin Migration Example

```sql
-- plugins/bar-management/migrations/001_bar_inventory.sql

-- Bar Management Plugin - Inventory Tables

CREATE TABLE IF NOT EXISTS bar_inventory (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    -- ... more columns
);
```

## Adding New Core Tables

### DO ✅
1. Create new migration file in `migrations-for-r2-deployment/`
   ```bash
   # Next version number: 051
   touch migrations-for-r2-deployment/051_my_new_table.sql
   ```

2. Add migration to `src-tauri/src/migrations.rs`
   ```rust
   const MIGRATIONS: &[Migration] = &[
       // ... existing migrations
       Migration {
           version: 51,
           name: "my_new_table",
           sql: include_str!("../../migrations-for-r2-deployment/051_my_new_table.sql")
       },
   ];
   ```

3. Rebuild and test
   ```bash
   cargo build
   ```

### DON'T ❌
- ❌ Add table creation in command functions (wizard.rs, tenant.rs, etc.)
- ❌ Use runtime `ALTER TABLE` for core schema changes
- ❌ Mix core and plugin tables in the same migration

## Adding New Plugin Tables

### DO ✅
1. Create migration file in plugin folder
   ```bash
   mkdir -p plugins/my-plugin/migrations
   touch plugins/my-plugin/migrations/001_my_table.sql
   ```

2. Reference in plugin manifest
   ```json
   {
     "data": {
       "tables": ["my_table"],
       "migration_path": "plugins/my-plugin/migrations"
     }
   }
   ```

3. Plugin manager will run migrations on install

### DON'T ❌
- ❌ Add plugin tables to core migrations
- ❌ Create plugin tables in lib.rs
- ❌ Use core `schema_migrations` for plugin tracking

## Troubleshooting

### Migration Failed During Startup

**Error:** `Core migrations failed: Migration 25 failed: ...`

**Solution:**
1. Check migration SQL syntax
2. Ensure table doesn't already exist (use `CREATE TABLE IF NOT EXISTS`)
3. Check database file permissions

### Table Already Exists

**Error:** `table setup_wizard_state already exists`

**Solution:**
- This is normal if migration uses `CREATE TABLE` without `IF NOT EXISTS`
- Update migration to use `IF NOT EXISTS`
- Or check if migration was already applied in `schema_migrations`

### Plugin Migration Failed

**Error:** Plugin install failed due to migration error

**Solution:**
1. Check plugin migration SQL
2. Verify `migration_path` in manifest
3. Ensure migration files are accessible from R2

## Migration Versions

Current latest core migration: **050** (add_d1_database_id_to_tenant_config)

Next migration should be: **051**

## References

- Core migrations: `src-tauri/src/migrations.rs`
- Migration files: `migrations-for-r2-deployment/*.sql`
- Plugin system: `src/services/plugins/pluginManager.ts`
- App startup: `src-tauri/src/lib.rs` setup function
