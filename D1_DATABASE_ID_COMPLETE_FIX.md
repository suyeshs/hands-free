# D1 Database ID Storage - Complete Fix

## Problem Summary

The D1 database ID was not being stored in SQL, causing "Database Not Ready" errors even after tenant activation.

### Root Causes

1. **Missing Database Column** - `tenant_config` table had no `d1_database_id` column
2. **Field Name Mismatch** - Backend returns `database_id` (snake_case), frontend expects `d1DatabaseId` (camelCase)
3. **Migration Timing** - Migration ran too late, after stores tried to load data
4. **R2 Migration Not Updated** - Base migration file didn't include new column for fresh installs

## Complete Solution

### 1. Added Database Column

**Migration File**: `050_add_d1_database_id_to_tenant_config.sql`
```sql
ALTER TABLE tenant_config ADD COLUMN d1_database_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tenant_config_d1_database_id ON tenant_config(d1_database_id);
```

**Base Migration Update**: `030_tenant_activation.sql`
- Added `d1_database_id TEXT` column to CREATE TABLE statement
- Ensures fresh installs have column from the start

### 2. Rust Backend Updates

**tenant.rs** - Added field and migration command:
```rust
pub struct TenantConfig {
    // ... existing fields ...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub d1_database_id: Option<String>,
}

#[tauri::command]
pub fn migrate_tenant_config_d1_database_id(app: tauri::AppHandle) -> Result<(), String> {
    // Check if migration already recorded
    // Add column if missing
    // Record in schema_migrations table
}
```

**d1_provision.rs** - Return database ID:
```rust
pub struct D1ProvisionResult {
    // ... existing fields ...
    #[serde(rename = "databaseId")]
    pub database_id: Option<String>,
}
```

### 3. Frontend Updates

**tenantStore.ts** - Map backend field names:
```typescript
const config: TenantConfig = {
    // ... existing fields ...
    // Map database_id from backend to d1DatabaseId for frontend
    d1DatabaseId: backendData.d1DatabaseId || backendData.database_id,
};
```

**d1ProvisioningService.ts** - Check both locations:
```typescript
async checkStatus(tenantId: string): Promise<D1Status> {
    // Check sync_metadata table first
    let databaseId = await this.getValue(`d1:${tenantId}:database_id`);

    // Also check tenant_config table
    if (!databaseId) {
        const tenantConfig = await invoke('get_tenant_config');
        if (tenantConfig?.d1DatabaseId) {
            databaseId = tenantConfig.d1DatabaseId;
        }
    }
}
```

### 4. Migration Timing - Critical Fix

**lib.rs:292-300** - Run migration during Tauri setup:
```rust
.setup(|app| {
    // ... database initialization ...

    // Apply critical migrations immediately on startup
    // This must run BEFORE any tenant config queries
    println!("[Setup] Applying critical database migrations...");
    if let Err(e) = commands::tenant::migrate_tenant_config_d1_database_id(app.handle().clone()) {
        eprintln!("[Setup] ⚠️  Migration failed (may already be applied): {}", e);
    }
})
```

**CRITICAL FIX - d1ProvisioningService.ts** - Convert to lazy initialization:
```typescript
// OLD (caused premature instantiation):
export const d1ProvisioningService = new D1ProvisioningService();

// NEW (lazy initialization):
let d1ProvisioningServiceInstance: D1ProvisioningService | null = null;

export function getD1ProvisioningService(): D1ProvisioningService {
  if (!d1ProvisioningServiceInstance) {
    d1ProvisioningServiceInstance = new D1ProvisioningService();
  }
  return d1ProvisioningServiceInstance;
}
```

This ensures the service is NOT instantiated when the module loads, preventing database queries before the migration runs. All imports changed from `d1ProvisioningService.method()` to `getD1ProvisioningService().method()`.

### 5. Migration Tracking

Migration records itself in `schema_migrations` table:
```rust
db.execute(
    "INSERT INTO schema_migrations (version, name, description, source, checksum, applied_at, app_version)
     VALUES (50, '050_add_d1_database_id_to_tenant_config', 'Add d1_database_id column', 'manual', '', ...)",
    ...
)?;
```

This prevents:
- Duplicate runs
- Conflicts with R2 dynamic migrations

## Execution Flow

### Fresh Install (New Tenant)
1. ✅ Tauri setup runs migration (adds column if needed)
2. ✅ R2 migration 030 creates `tenant_config` with `d1_database_id` column
3. ✅ User activates tenant
4. ✅ Backend returns `database_id` in activation response
5. ✅ Frontend maps to `d1DatabaseId` and saves to SQL
6. ✅ Database ID stored in `tenant_config.d1_database_id`

### Existing Install (Upgrade)
1. ✅ Tauri setup runs migration → adds column to existing table
2. ✅ Migration recorded in `schema_migrations` (version 50)
3. ✅ R2 migration 050 skipped (already applied)
4. ✅ Next tenant activation stores database ID
5. ✅ D1 provisioning UI shows database ready

### D1 Provisioning Flow
1. ✅ User clicks "Provision D1 Database"
2. ✅ Worker API returns `databaseId`
3. ✅ Stored in **both** locations:
   - `sync_metadata` table: `d1:${tenantId}:database_id`
   - `tenant_config` table: `d1_database_id`
4. ✅ Cloud sync enabled

## Files Changed

### Migrations
- `migrations-for-r2-deployment/030_tenant_activation.sql` - Added column to base schema
- `migrations-for-r2-deployment/050_add_d1_database_id_to_tenant_config.sql` - ALTER TABLE migration

### Rust Backend
- `src-tauri/src/commands/tenant.rs` - Added field, save/get/migrate commands
- `src-tauri/src/commands/d1_provision.rs` - Added database_id to result
- `src-tauri/src/lib.rs` - Run migration during setup

### TypeScript Frontend
- `src/stores/tenantStore.ts` - Field mapping for activation
- `src/services/d1ProvisioningService.ts` - **LAZY INITIALIZATION** to prevent premature database access
- `src/services/sync/TieredSyncManager.ts` - Updated to use lazy service getter
- `src/components/admin/D1ProvisionButton.tsx` - Updated to use lazy service getter
- `src/components/admin/CloudSyncSettings.tsx` - Updated to use lazy service getter
- `src/components/home/CloudSyncBanner.tsx` - Updated to use lazy service getter
- `src/App.tsx` - Removed redundant migration call (now in Rust)

## Testing

### Verify Migration Applied
```bash
sqlite3 ~/Library/Application\ Support/com.handsfree.pos/pos.db "PRAGMA table_info(tenant_config);"
# Should see: d1_database_id|TEXT|0||0
```

### Check Migration Recorded
```bash
sqlite3 ~/Library/Application\ Support/com.handsfree.pos/pos.db \
  "SELECT * FROM schema_migrations WHERE version = 50;"
# Should return: 50|050_add_d1_database_id_to_tenant_config|...
```

### Verify Database ID Stored
```bash
sqlite3 ~/Library/Application\ Support/com.handsfree.pos/pos.db \
  "SELECT tenant_id, d1_database_id FROM tenant_config;"
# Should show database ID after activation
```

## Result

✅ Database ID now stored correctly for both new and existing installations
✅ No more "Database Not Ready" errors
✅ D1 provisioning UI works properly
✅ Migration tracked to prevent conflicts
✅ Compatible with R2 dynamic migration system
