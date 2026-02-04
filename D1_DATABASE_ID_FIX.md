# D1 Database ID Storage Fix

## Problem

The D1 database ID was not being stored in SQL, causing the "Database Not Ready" error even after tenant activation.

### Root Cause

1. **Missing Database Column**: The `tenant_config` table had no column to store the D1 database ID
2. **Backend Returns ID**: The activation endpoint returns `database_id` from Cloudflare resources
3. **No Storage**: The frontend had no way to persist this ID
4. **Wrong Check**: D1ProvisioningService only checked `sync_metadata` table, not `tenant_config`

## Solution

### 1. Added Database Column

**Migration**: `050_add_d1_database_id_to_tenant_config.sql`

```sql
ALTER TABLE tenant_config ADD COLUMN d1_database_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tenant_config_d1_database_id ON tenant_config(d1_database_id);
```

### 2. Updated Rust Backend

**File**: `src-tauri/src/commands/tenant.rs`

- Added `d1_database_id: Option<String>` to `TenantConfig` struct
- Updated `save_tenant_config` to store the database ID
- Updated `get_tenant_config` to retrieve the database ID

### 3. Updated TypeScript Frontend

**File**: `src/stores/tenantStore.ts`

- Added `d1DatabaseId?: string` to `TenantConfig` interface
- Backend activation response now includes and stores the database ID

**File**: `src/services/d1ProvisioningService.ts`

- Updated `checkStatus()` to check both:
  1. `sync_metadata` table (set during provisioning)
  2. `tenant_config` table (set during activation)
- If database ID exists in either location, D1 is ready

### 4. Fixed Async Issues

**File**: `src/services/sync/TieredSyncManager.ts`

- Constructor no longer calls async `isCloudSyncEnabled()` (causes Promise assignment bug)
- Moved sync enabled check to `start()` method with proper await
- Made `enableD1Sync()` and `disableD1Sync()` async

### 5. Fixed Rust Return Value

**File**: `src-tauri/src/commands/d1_provision.rs`

- Added `database_id: Option<String>` field to `D1ProvisionResult` struct
- All return statements now include the database ID from worker response
- Uses `#[serde(rename = "databaseId")]` for proper JSON serialization

## Flow After Fix

### Tenant Activation

1. User enters activation code
2. Backend provisions Cloudflare resources (including D1 database)
3. Activation response includes `d1DatabaseId`
4. Frontend saves to `tenant_config` table → **Database ID now persisted**
5. D1ProvisionButton checks status → **Finds database ID** → Shows provisioning UI

### D1 Provisioning

1. User clicks "Provision D1 Database"
2. System extracts local schema
3. Calls worker API to create tables
4. Worker returns database ID
5. Frontend stores in BOTH:
   - `sync_metadata` table: `d1:${tenantId}:database_id`
   - Already in `tenant_config` table
6. Cloud sync enabled

### Status Check Priority

```typescript
checkStatus(tenantId):
  1. Check sync_metadata table first (provisioning flow)
  2. Fall back to tenant_config table (activation flow)
  3. Query worker API for live status
  4. Return combined result
```

## Testing

To test the fix:

1. Run the app with a fresh database
2. Complete tenant activation
3. Navigate to Settings → D1 Database
4. Should see database ID (not "Database Not Ready")
5. Click "Provision D1 Database" to create tables
6. Verify sync works

## Migration Notes

- Migration `050` will run automatically on app startup
- Existing installations: Migration adds column without data loss
- New installations: Column included from the start
- Database ID from backend will be stored on next activation

## Files Changed

- `migrations-for-r2-deployment/050_add_d1_database_id_to_tenant_config.sql` (new)
- `src-tauri/src/commands/tenant.rs`
- `src-tauri/src/commands/d1_provision.rs`
- `src/stores/tenantStore.ts`
- `src/services/d1ProvisioningService.ts`
- `src/services/sync/TieredSyncManager.ts`
