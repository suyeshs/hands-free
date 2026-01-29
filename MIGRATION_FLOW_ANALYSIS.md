# Migration Flow Analysis - Setup Wizard Issues

## Problem Overview

The setup wizard completion screen freezes because of a **critical database path mismatch** in the Rust backend. All Tauri commands are trying to read/write to the wrong database file.

## Root Cause: Database Path Mismatch

There are **TWO SQLite databases** in use:

### 1. Plugin-Managed Database (CORRECT)
- **Location**: `app_data_dir()/pos.db`
- **Managed by**: `tauri-plugin-sql`
- **Migrations run here**: Yes (see `src-tauri/src/lib.rs` lines 186-187)
- **Has tables**: Yes - all migrations applied
- **Used by**: SQL plugin query interface

### 2. Direct Connection Database (WRONG - EMPTY)
- **Location**: `pos.db` in current working directory (`src-tauri/`)
- **Managed by**: Direct `Connection::open("pos.db")` calls
- **Migrations run here**: No
- **Has tables**: No - empty 0-byte file
- **Used by**: All Rust commands opening connections directly

## Migration Flow in App.tsx

The app follows this boot sequence:

```
1. Tenant Activation Check (if not activated)
   ↓
2. Database Migration Check
   → Shows DatabaseMigrationUI if migrations needed
   → Sets sessionStorage flag 'db-migration-v3.1-complete'
   ↓
3. Settings Migration Check (localStorage → SQLite)
   → Skipped if SKIP_AUTH=true
   → Has 2-second timeout
   → Shows SettingsMigrationUI if old settings detected
   ↓
4. Setup Wizard Check (if needsSetup)
   → Shows SetupWizard
   ↓
5. Main App (if all checks pass)
```

## Why Setup Completion Freezes

**Flow when user completes setup:**

1. User clicks through setup wizard
2. CompletionScreen calls `completeSetup()` (setupWizardStore.ts:285)
3. `completeSetup()` calls `restaurantSettingsStore.updateSettings(settings)` (line 328)
4. Frontend invokes Tauri command `update_restaurant_settings`
5. Rust opens **WRONG DATABASE** → `Connection::open("pos.db")` in `src-tauri/pos.db`
6. This database has **NO TABLES** (0 bytes, never had migrations run)
7. SQL query fails: `"no such table: restaurant_settings"`
8. Error thrown → Promise never resolves
9. CompletionScreen freezes waiting for settings update

## Files with Database Path Issues

### CRITICAL - Already Fixed (Need Rust Recompilation)

✅ **src-tauri/src/commands/settings.rs**
- Line 75: `get_restaurant_settings()` - FIXED to use app_data_dir
- Line 152: `update_restaurant_settings()` - FIXED to use app_data_dir

### CRITICAL - Need to Fix

❌ **src-tauri/src/i18n/commands.rs** (8 instances)
- Line 43: `get_translations()`
- Line 70: `get_translation()`
- Line 88: `update_tenant_translation()`
- Line 110: `delete_tenant_translation()`
- Line 124: `get_tenant_overrides()`
- Line 138: `get_translation_keys()`
- Line 148: `get_user_language()`
- Line 158: `set_user_language()`

All need to:
1. Add `app: tauri::AppHandle` parameter
2. Change `Connection::open("pos.db")` to:
```rust
let app_data_dir = app.path().app_data_dir()
    .map_err(|e| e.to_string())?;
let db_path = app_data_dir.join("pos.db");
let db = Connection::open(&db_path).map_err(|e| e.to_string())?;
```

## Frontend Fixes Applied

### ✅ CompletionScreen.tsx
- Added `useRef` guard to prevent double execution in StrictMode
- Auto-navigation to `/hub` after 1 second
- Creates default manager session when SKIP_AUTH=true

### ✅ App.tsx
- Set initial `checkingMigration` to `!skipAuth`
- Added force reset mode: navigate to `/#/reset`
- Skips migration check when SKIP_AUTH=true

### ✅ setupWizardStore.ts
- Fixed screen counting to match actual screens shown
- `getCurrentScreenIndex()` calculates based on selected optional items
- `getTotalScreens()` returns 8 + selectedOptionalItems.length

## Testing Checklist

After Rust recompilation:

- [ ] Navigate to `/#/reset` to clear all storage
- [ ] Restart Tauri dev server (`bun tauri dev`)
- [ ] Go through setup wizard with demo data
- [ ] Verify completion screen doesn't freeze
- [ ] Check hub page shows populated data
- [ ] Verify restaurant settings are saved
- [ ] Test i18n commands (if used)

## How to Force Reset

Three ways to reset the app:

1. **Navigate to reset**: Go to `/#/reset` in browser
2. **Keyboard shortcut**: Press `Cmd+Shift+Backspace` (Mac) or `Ctrl+Shift+Delete` (Windows)
3. **Dev console**:
```javascript
localStorage.clear();
sessionStorage.clear();
window.location.reload();
```

## Next Steps

1. ✅ Fix database paths in `settings.rs` (DONE)
2. ❌ Fix database paths in `i18n/commands.rs` (TODO)
3. ❌ Restart Tauri dev server to compile Rust changes
4. ❌ Test complete setup flow end-to-end
5. ❌ Remove debug overlays once confirmed working

## Environment Variables

Ensure `.env.local` has:
```env
VITE_SKIP_AUTH=true
# VITE_DEFAULT_TENANT_ID is commented out for local dev
```

## Summary

The migration flow is correct, but the database path mismatch causes all Rust commands to fail silently. Once the paths are fixed and recompiled, the setup wizard should complete successfully and navigate to the hub page with populated data.

**Key insight**: Migrations run on the plugin-managed database, but all direct SQLite connections were opening a different file. This creates two separate databases where one has schema but no data, and the other has no schema at all.
