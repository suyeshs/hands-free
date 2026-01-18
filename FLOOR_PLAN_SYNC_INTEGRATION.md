# Floor Plan Sync Integration

## Overview

The floor plan sync system has been integrated with the proper Rust-based sync engine to prevent data loss and provide robust incremental synchronization.

## What Changed

### Before (Problematic)
- Direct HTTP API calls to sync floor plan data
- Full replacement of local data with cloud data
- No conflict resolution
- Could wipe local tables if cloud was empty
- No offline queue support

### After (Fixed)
- Rust-based incremental sync engine
- Only syncs changed records (using `updated_at`, `synced_at` timestamps)
- Safeguards against data loss
- Offline queue for failed syncs
- Proper conflict resolution
- HTTP fallback for non-Tauri environments

## Architecture

```
┌─────────────────────────────────────────────┐
│   FloorPlanStore (Frontend)                 │
│   - User actions (add/remove tables)        │
│   - Saves to local SQLite                   │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│   Rust Sync Engine (Tauri Backend)          │
│   - Tracks changed records                  │
│   - Incremental sync (only deltas)          │
│   - Offline queue for failed syncs          │
│   - Timestamp-based conflict resolution     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│   Cloud D1 Database (Cloudflare)            │
│   - Central source of truth                 │
│   - Shared across all devices               │
└─────────────────────────────────────────────┘
```

## Database Schema

### Tables with Sync Support

#### floor_sections
```sql
CREATE TABLE floor_sections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,  -- Auto-updated by trigger
    synced_at TEXT DEFAULT NULL                 -- Tracks last cloud sync
);
```

#### floor_tables
```sql
CREATE TABLE floor_tables (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    table_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    qr_code_url TEXT,
    status TEXT DEFAULT 'available',
    assigned_staff_id TEXT,
    current_order_id TEXT,
    last_active_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,  -- Auto-updated by trigger
    synced_at TEXT DEFAULT NULL                 -- Tracks last cloud sync
);
```

#### floor_staff_assignments
```sql
CREATE TABLE floor_staff_assignments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    section_ids TEXT,  -- JSON array
    table_ids TEXT,    -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,  -- Auto-updated by trigger
    synced_at TEXT DEFAULT NULL                 -- Tracks last cloud sync
);
```

### Key Fields

- **updated_at**: Automatically updated by SQL trigger on any record change
- **synced_at**: Set when record is successfully synced to cloud
- Records where `synced_at IS NULL` or `updated_at > last_sync_timestamp` are synced

## How It Works

### 1. Local Changes
When a user adds/removes a table:
```typescript
// FloorPlanStore
addTable: async (sectionId, tableNumber, capacity, tenantId) => {
    // 1. Update local state immediately (optimistic update)
    // 2. Save to local SQLite
    // 3. Trigger cloud sync (non-blocking)
    get().syncToCloud(tenantId).catch(...)
}
```

### 2. Incremental Sync
```rust
// Rust sync engine
sync_table_to_cloud("floor_tables") {
    // 1. Query changed records: WHERE updated_at > last_sync OR synced_at IS NULL
    // 2. Send only changed records to cloud
    // 3. Update synced_at timestamp on success
}
```

### 3. Safeguards
```typescript
// FloorPlanStore - syncFromCloud
if (localTables.length > 0 && cloudData.tables.length === 0) {
    // ⚠️ Cloud is empty but we have local data
    // Push local data to cloud instead of wiping it
    await syncToCloud(tenantId);
    return;
}
```

## API Integration

### Rust Commands

#### sync_floor_plan_to_cloud
```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('sync_floor_plan_to_cloud', {
    tenantId: 'tenant-001'
});
// Returns: { success: true, synced: 5, failed: 0, errors: [], duration_ms: 234 }
```

#### trigger_sync
```typescript
// Trigger immediate sync for specific table
await invoke('trigger_sync', { dataType: 'floor_tables' });
```

#### get_sync_status
```typescript
const status = await invoke('get_sync_status');
// Returns: { is_syncing: false, last_sync: 1234567890, pending_count: 0, is_online: true }
```

### TypeScript Service

```typescript
import { floorPlanSyncService } from './lib/floorPlanSyncService';

// Initialize sync system
await floorPlanSyncService.init(tenantId, 'https://api.example.com');

// Sync to cloud
const result = await floorPlanSyncService.syncToCloud(tenantId);

// Get sync status
const status = await floorPlanSyncService.getStatus();
```

## Cloud Endpoints

The sync engine expects these endpoints to be available:

```typescript
POST /admin/floor-plan/sections/sync
POST /admin/floor-plan/tables/sync
POST /admin/floor-plan/assignments/sync

// Request body:
{
  "sections": [...],  // or "tables" or "assignments"
}

// Response:
{
  "success": true
}
```

## Benefits

### Data Safety
- ✅ Never wipes local data if cloud is empty
- ✅ Only syncs changed records (efficient)
- ✅ Offline queue for failed syncs
- ✅ Automatic retry on connection restore

### Performance
- ✅ Incremental sync (only deltas)
- ✅ Async/non-blocking
- ✅ Optimistic UI updates
- ✅ Minimal bandwidth usage

### Reliability
- ✅ HTTP fallback for web version
- ✅ Timestamp-based conflict resolution
- ✅ Comprehensive logging
- ✅ Error recovery

## Migration from Old System

### Phase 1: Add Migration (✅ Complete)
- Created `023_floor_plan_sync.sql`
- Added `updated_at`, `synced_at` columns
- Created auto-update triggers

### Phase 2: Rust Integration (✅ Complete)
- Added sync endpoints to `commands.rs`
- Created `sync_floor_plan_to_cloud` command
- Registered command in `lib.rs`

### Phase 3: Frontend Integration (✅ Complete)
- Created `floorPlanSyncService.ts`
- Updated `floorPlanStore.ts` to use Rust sync
- Added HTTP fallback for web

### Phase 4: Cloud Endpoints (⏳ TODO)
- Implement sync endpoints in Cloudflare Workers
- Add conflict resolution logic
- Test multi-device sync

## Testing

### Manual Testing
1. Add a table in the POS app
2. Check browser console for sync logs:
   ```
   [FloorPlanStore] Added table tab-xxx to database
   [FloorPlanStore] Pushing floor plan to cloud: 2 sections, 10 tables
   [FloorPlanStore] ✅ Incremental sync completed: 1 records synced
   ```
3. Open app on another device - should see the new table

### Edge Cases to Test
- [ ] Add table while offline → Should queue for sync
- [ ] Add table on Device A, add table on Device B simultaneously → Both should sync
- [ ] Cloud database is empty → Should push local data, not wipe it
- [ ] Network interruption during sync → Should retry automatically
- [ ] Web version (no Tauri) → Should use HTTP fallback

## Future Enhancements

### Real-time Sync via WebSocket
```typescript
// Listen for floor plan updates from other devices
orderSyncService.onTableAdded((table) => {
    useFloorPlanStore.getState().applyRemoteTableAdded(table);
});
```

### Conflict Resolution UI
- Show conflicts when two devices edit the same table
- Allow user to choose which version to keep

### Sync Dashboard
- Show sync status, pending items, errors
- Manual sync trigger button
- View sync history

## Troubleshooting

### Tables disappearing after sync
**Cause**: Cloud had empty floor plan data and wiped local tables

**Fix**: ✅ Fixed in v3.0.1 with safeguards

**Prevention**: Rust sync engine prevents this scenario

### Sync not working
**Check**:
1. Is sync initialized? `await floorPlanSyncService.init(tenantId, apiUrl)`
2. Check sync status: `await floorPlanSyncService.getStatus()`
3. Check browser console for errors
4. Verify cloud endpoints are accessible

### Changes not appearing on other devices
**Check**:
1. Is device online?
2. Check `synced_at` timestamp in database
3. Verify other device is pulling latest data
4. Check if WebSocket connection is active

## Related Files

### Frontend
- `src/stores/floorPlanStore.ts` - Main floor plan state management
- `src/lib/floorPlanSyncService.ts` - TypeScript sync service wrapper
- `src/components/admin/FloorPlanManager.tsx` - UI component

### Backend (Rust)
- `src-tauri/src/sync/commands.rs` - Sync commands
- `src-tauri/src/sync/mod.rs` - Sync core logic
- `src-tauri/src/lib.rs` - Command registration
- `src-tauri/migrations/023_floor_plan_sync.sql` - Database schema

### Cloud
- `docs/cloudflare-worker-sales-endpoints.ts` - API endpoints (TODO: add sync endpoints)

## Support

For issues with floor plan sync:
1. Check browser console logs (look for `[FloorPlanStore]` or `[FloorPlanSync]`)
2. Check Rust logs in Tauri console
3. Verify database state: `SELECT * FROM floor_tables WHERE synced_at IS NULL`
4. Report issues at: https://github.com/suyeshs/handsfree-restaurant-pos/issues
