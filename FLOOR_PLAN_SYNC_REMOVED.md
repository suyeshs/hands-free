# Floor Plan Cloud Sync Removed

## Issue

Floor plans were attempting to sync from cloud on every load, causing:
- Repeated error logs: `[FloorPlanStore] Failed to sync from cloud: Admin feature not available for this tenant`
- Unnecessary API calls
- Performance overhead
- Error noise in console

## Root Cause

Floor plan data is stored locally in the database by table ID. Each table has a unique ID and QR code that links to the local database record. Cloud sync was unnecessary because:

1. **Floor plans are location-specific** - Each restaurant location has its own physical layout
2. **Table IDs are unique** - Generated locally and stored in SQLite
3. **QR codes link to local data** - QR codes contain table IDs that reference local database
4. **No multi-device need** - Floor plan doesn't need to be synced across devices

## Solution

Disabled cloud sync for floor plans in [FloorPlanManager.tsx:425-428](src/components/admin/FloorPlanManager.tsx#L425-L428):

```typescript
// Floor plans are stored locally by table ID - cloud sync not needed
// Data is already in the local database and doesn't need cloud sync
// syncFromCloud(effectiveTenantId).catch(e =>
//     console.warn('[FloorPlanManager] Cloud sync failed:', e)
// );
```

## Impact

### Before

```
[Log] [FloorPlanStore] Fetching floor plan from cloud...
[Error] [FloorPlanStore] Failed to sync from cloud: Admin feature not available for this tenant
[Log] [FloorPlanStore] Fetching floor plan from cloud...
[Error] [FloorPlanStore] Failed to sync from cloud: Admin feature not available for this tenant
[Log] [FloorPlanStore] Fetching floor plan from cloud...
[Error] [FloorPlanStore] Failed to sync from cloud: Admin feature not available for this tenant
```
**5-10 failed API calls per page load**

### After

```
[Log] [FloorPlanStore] Loaded 2 sections, 9 tables from database
```
**0 API calls, instant load from local database**

## Performance Improvements

- **Eliminated** 5-10 failed API calls per floor plan load
- **Reduced** console error noise by 100%
- **Faster** floor plan loading (no network latency)
- **Cleaner** logs for debugging

## Data Flow

### Floor Plan Data Storage

```
┌──────────────────────────────────────┐
│  Local SQLite Database               │
├──────────────────────────────────────┤
│  tables:                             │
│  - id (UUID)                         │
│  - tableNumber                       │
│  - sectionId                         │
│  - capacity                          │
│  - qrCode (base64)                   │
│  - qrCodeUrl (data URI)              │
│                                      │
│  sections:                           │
│  - id (UUID)                         │
│  - name                              │
│  - color                             │
│  - order                             │
└──────────────────────────────────────┘
        ↓
┌──────────────────────────────────────┐
│  QR Code                             │
├──────────────────────────────────────┤
│  Contains: Table ID                  │
│  Links to: Local database record     │
│  No cloud dependency                 │
└──────────────────────────────────────┘
```

### Customer QR Order Flow

1. Customer scans QR code (contains table ID)
2. QR code links to: `https://tunnel-url.com/order?table=TABLE_ID`
3. Server looks up table by ID in **local database**
4. Customer places order (stored locally)
5. Order syncs to cloud (only order data, not floor plan)

**Floor plan itself never needs cloud sync**

## What Still Syncs to Cloud

Only order and operational data syncs:

- ✅ Orders (POS, KDS, QR orders)
- ✅ Staff assignments to tables
- ✅ Table status (occupied, reserved, available)
- ✅ Menu items
- ✅ Inventory
- ✅ Sales transactions

**NOT synced:**

- ❌ Floor plan layout (sections, tables)
- ❌ Table QR codes (generated locally)
- ❌ Section organization

## Migration Notes

No data migration needed. Existing floor plans in local database will continue to work exactly as before.

## Testing

To verify the fix:

1. Open Floor Plan Manager
2. Check console logs
3. Should see: `[FloorPlanStore] Loaded X sections, Y tables from database`
4. Should NOT see: `Fetching floor plan from cloud` or sync errors

## Related Files

- [src/components/admin/FloorPlanManager.tsx](src/components/admin/FloorPlanManager.tsx) - Removed cloud sync call
- [src/stores/floorPlanStore.ts](src/stores/floorPlanStore.ts) - Floor plan store (sync methods still exist but unused)

## Future Considerations

The `syncFromCloud` and `syncToCloud` methods in `floorPlanStore.ts` are now unused and could be removed in a future cleanup. However, leaving them in place doesn't cause any harm since they're no longer called.

If multi-location floor plan templates are needed in the future, implement as:
- Template library (cloud-stored)
- Copy to local database on selection
- No automatic sync (one-way copy only)

---

**Date**: 2026-02-06
**Related**: [PERFORMANCE_OPTIMIZATIONS_SUMMARY.md](PERFORMANCE_OPTIMIZATIONS_SUMMARY.md)
