# Setup Wizard Completion Issues - Root Cause Analysis

## Problem Summary
After completing the setup wizard with demo data, the completion screen freezes and the hub page shows empty.

## Root Cause
**CRITICAL DATABASE PATH MISMATCH**

There are TWO different SQLite database files being used:

### 1. Plugin-Managed Database
- **Location**: `app_data_dir()/pos.db` (managed by tauri-plugin-sql)
- **Migrations**: Run here (see src-tauri/src/lib.rs lines 186-187)
- **Used by**: The SQL plugin's query interface
- **Status**: Has all tables from migrations

### 2. Direct Connection Database
- **Location**: `pos.db` in current working directory (src-tauri/)
- **Migrations**: NEVER RUN HERE
- **Used by**: All Rust commands that call `Connection::open("pos.db")`
  - `get_restaurant_settings()` - line 75 in commands/settings.rs
  - `update_restaurant_settings()` - line 152 in commands/settings.rs
  - All i18n commands - lines 43, 70, 88, 110, 124, 138, 148, 158 in i18n/commands.rs
- **Status**: EMPTY (0 bytes)

## Why The Setup Freezes

1. User completes setup wizard
2. `completeSetup()` calls `restaurantSettingsStore.updateSettings()`
3. Frontend calls Tauri command `update_restaurant_settings`
4. Rust command opens `pos.db` (wrong database with no tables)
5. SQL query fails: "no such table: restaurant_settings"
6. Error thrown, completion screen freezes

## Solution

**Option 1: Use Plugin Database Everywhere (RECOMMENDED)**

Make all Rust commands use the same database path as the plugin:

```rust
// In commands/settings.rs and i18n/commands.rs
// Replace:
let db = Connection::open("pos.db")?;

// With:
let app_data_dir = app.path().app_data_dir()?;
let db_path = app_data_dir.join("pos.db");
let db = Connection::open(&db_path)?;
```

**Option 2: Use Plugin's Database Access**

Instead of opening connections directly, use the Tauri SQL plugin's query interface (requires more refactoring).

## Files That Need Fixing

1. `src-tauri/src/commands/settings.rs` (lines 75, 152)
2. `src-tauri/src/i18n/commands.rs` (lines 43, 70, 88, 110, 124, 138, 148, 158)

## Additional Fixes Applied

1. **App.tsx** - Set initial `checkingMigration` state to `!skipAuth` to skip migration check when SKIP_AUTH=true
2. **CompletionScreen.tsx** - Create default manager session when SKIP_AUTH=true, navigate to /hub after 1 second
3. **setupWizardStore.ts** - Fixed screen counting to match actual screens shown in wizard

## Next Steps

1. Fix all `Connection::open("pos.db")` calls to use `app_data_dir()/pos.db`
2. Test the setup wizard end-to-end
3. Verify demo data appears in hub page
4. Remove debug overlays and console logs
