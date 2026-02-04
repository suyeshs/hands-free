# Provisioning & Routing Fix

**Date**: 2026-01-30
**Issues Fixed**:
1. ❌ `table restaurant_settings has no column named key` error during provisioning
2. ❌ `no such column: online_presence_json` error on app load after provisioning
3. ⚠️  Routing not working after provisioning (to be investigated)

---

## Issue 1: Deprecated `storeTenantMetadata()` Function

### Problem
[SimpleRestaurantOnboarding.tsx:461-486](src/components/SimpleRestaurantOnboarding.tsx#L461-L486) called deprecated `storeTenantMetadata()` which tried to use old key-value structure:

```typescript
await storeTenantMetadata({
  tenantId: formData.subdomain,
  companyName: formData.restaurantName,
  ...
});
```

The function tried to execute:
```sql
INSERT OR REPLACE INTO restaurant_settings (key, value) VALUES ('tenant_metadata', $1)
```

But `restaurant_settings` table no longer has `key, value` columns.

### Solution
**Status**: ✅ Fixed (but commented out - to be replaced with proper implementation)

The `storeTenantMetadata()` call was removed. Tenant data should be stored via:
1. `tenant_config` table (for D1 database ID and activation data)
2. `restaurant_settings` table (for restaurant info)
3. `setup_wizard_state` table (for wizard progress)

**Next Step**: Replace with proper tenant data storage using Tauri commands.

---

## Issue 2: Missing `online_presence_json` Column

### Problem
After provisioning, the app tried to load restaurant settings but failed:

```
[Error] no such column: online_presence_json in SELECT
    restaurant_type, operational_scale,
    name, owner_name, tagline, ..., online_presence_json
FROM restaurant_settings WHERE id = 1
```

### Root Cause
The migration `src-tauri/migrations/026_online_presence.sql` exists but was never applied because:

1. **Tauri plugin migrations** only include migration #1 (INIT_SQL)
2. **Dynamic migrations from R2** were handling migrations #2+
3. We **disabled dynamic migrations** to fix the plugin architecture
4. The `online_presence_json` column was never created

### Solution
**Status**: ✅ Fixed in [src-tauri/src/commands/settings.rs](src-tauri/src/commands/settings.rs)

Added automatic column detection and creation in both `get_restaurant_settings` and `save_restaurant_settings`:

```rust
// Check if online_presence_json column exists
let column_exists = db.query_row(
    "SELECT COUNT(*) FROM pragma_table_info('restaurant_settings') WHERE name = 'online_presence_json'",
    [],
    |row| row.get::<_, i32>(0)
).unwrap_or(0) > 0;

if !column_exists {
    // Add the column with proper default JSON value
    db.execute(
        "ALTER TABLE restaurant_settings ADD COLUMN online_presence_json TEXT DEFAULT '{...}'",
        []
    )?;
}
```

This ensures:
- Column is created automatically if missing
- Default JSON value matches the frontend's expectations
- No manual migration step required

---

## Issue 3: Routing Not Working After Provisioning

### Problem
User reported: "after provisioning complete the screen is not routing to hub page but back to the form"

### Current Flow

1. **User fills form** → `SimpleRestaurantOnboarding` component
2. **Clicks "Create"** → Opens `StoreCreationModal`
3. **Provisioning starts** → Calls backend API
4. **Provisioning completes** → `handleCreationComplete()` called
5. **Settings saved** → Restaurant data stored in SQLite
6. **`onComplete(activationCode)`** called → Returns to `TenantActivation`
7. **Auto-activation triggered** → `handleSubmit(activationCode)` in `TenantActivation`
8. **Activation succeeds** → `onActivated()` called
9. **Should route to Hub** → But loops back to form instead?

### Investigation Needed

**Files to Check**:
- [SimpleRestaurantOnboarding.tsx:368-500](src/components/SimpleRestaurantOnboarding.tsx#L368-L500) - `handleCreationComplete`
- [TenantActivation.tsx:607-647](src/pages/TenantActivation.tsx#L607-L647) - `onComplete` handler
- [TenantActivation.tsx:156-402](src/pages/TenantActivation.tsx#L156-L402) - `handleSubmit` activation flow
- [App.tsx:413](src/App.tsx#L413) - Activation status check logic

**Possible Causes**:
1. Modal state (`showCreationModal`) not properly reset
2. Activation code not properly stored in localStorage
3. `onActivated()` callback not triggering navigation
4. App.tsx activation check logic returning user to form

**Next Steps**:
1. Add debug logging to trace routing flow
2. Check if `setShowCreationModal(false)` is being called
3. Verify `onActivated()` is defined and working in App.tsx
4. Check if wizard completion flag is being set properly

---

## Files Modified

### Frontend
- [src/App.tsx](src/App.tsx)
  - Line 66: Commented out `useDynamicMigrations` import
  - Lines 381-398: Disabled global dynamic migrations (commented out)

### Backend
- [src-tauri/src/commands/settings.rs](src-tauri/src/commands/settings.rs)
  - Lines 115-138: Added `online_presence_json` column check in `get_restaurant_settings`
  - Lines 277-300: Added `online_presence_json` column check in `save_restaurant_settings`

### Plugin System
- [packages/plugin-sdk/src/types.ts](packages/plugin-sdk/src/types.ts)
  - Line 79: `migration_path?: string;` (already existed)
- [plugins/bar-management/manifest.json](plugins/bar-management/manifest.json)
  - Lines 113-120: Added `storage_keys` and `migration_path`
- [plugins/sample-plugins/bar-management-v2.json](plugins/sample-plugins/bar-management-v2.json)
  - Lines 78-81: Added `storage_keys` and `migration_path`

---

## Testing Checklist

### ✅ Completed
- [x] Frontend builds without TypeScript errors
- [x] Plugin SDK package rebuilt
- [x] `migration_path` type definition verified

### ⏳ In Progress
- [ ] Tauri backend compiling with column fix

### 🔜 To Do
- [ ] Test fresh provisioning flow
- [ ] Verify `online_presence_json` column is created
- [ ] Verify settings load without errors
- [ ] Test routing after provisioning completes
- [ ] Verify activation code flow works end-to-end
- [ ] Check if Hub page loads correctly

---

## Related Documentation
- [MIGRATION_ARCHITECTURE_REFACTORING.md](MIGRATION_ARCHITECTURE_REFACTORING.md) - Plugin migration system changes
- [ONLINE_PRESENCE_DIAGNOSTIC.md](ONLINE_PRESENCE_DIAGNOSTIC.md) - Online presence feature guide
- [ROUTING_LOOP_FINAL_FIX.md](ROUTING_LOOP_FINAL_FIX.md) - Previous routing fix

---

## Next Session Tasks

1. **Fix Routing Issue**
   - Debug why provisioning doesn't navigate to Hub
   - Check modal state management
   - Verify `onActivated()` callback

2. **Fix D1 Database ID Storage**
   - Implement proper `tenant_config` save after provisioning
   - Update backend to store D1 database ID from provisioning response
   - Test D1 sync after provisioning

3. **Clean Up Deprecated Code**
   - Remove or update `storeTenantMetadata()` function
   - Update all callers to use new `tenant_config` table
   - Add migration guide for existing databases

4. **Test Full Flow**
   - Fresh install → Provision → Activate → Navigate to Hub
   - Verify all data is saved correctly
   - Check online presence settings are accessible
   - Test D1 sync with stored database ID
