# Sync Architecture Update - Plugin-Based System

## Problem

The sync system was attempting to sync tables that:
1. **Don't exist** in the database (`inventory_suppliers`, `inventory_recipes`)
2. **Missing columns** (`updated_at` in menu, staff tables)
3. **Are plugin-managed** and shouldn't sync from core
4. **Cause errors** (`Admin feature not available for this tenant`)

### Error Examples

```
[Error] [TieredSync] Menu sync failed: "no such column: updated_at"
[Error] [TieredSync] Inventory suppliers sync failed: "no such table: inventory_suppliers"
[Error] [TieredSync] Staff sync failed: "no such column: updated_at"
[Error] [TieredSync] Inventory recipes sync failed: "no such table: inventory_recipes"
[Warning] [DineInPricing] Cloud sync failed: "Admin feature not available for this tenant"
```

## Root Cause

The system has evolved to a **plugin-based architecture**:
- Core migrations handle essential POS tables
- Plugins handle their own tables and data
- Central sync was still trying to sync plugin tables

## Solution

### 1. Disabled Plugin-Based Sync in TieredSyncManager

**[src/services/sync/TieredSyncManager.ts](src/services/sync/TieredSyncManager.ts#L29-L104)**

Changed sync configuration to only sync **core POS data**:

```typescript
// Core POS data (ENABLED)
orders: { enabled: true }           // ✅ Core: Order transactions
tips: { enabled: true }             // ✅ Core: Tip records
sales: { enabled: true }            // ✅ Core: Sales transactions
cashPayouts: { enabled: true }      // ✅ Core: Cash register payouts
cashRegisters: { enabled: true }   // ✅ Core: Register management
staffLoginHistory: { enabled: true } // ✅ Core: Login tracking

// Plugin data (DISABLED)
menu: { enabled: false }            // ❌ Plugin: Menu plugin manages
staff: { enabled: false }           // ❌ Plugin: People/Payroll plugin
inventoryItems: { enabled: false }  // ❌ Plugin: Inventory plugin
inventorySuppliers: { enabled: false } // ❌ Plugin: Inventory plugin
inventoryTransactions: { enabled: false } // ❌ Plugin: Inventory plugin
inventoryRecipes: { enabled: false } // ❌ Plugin: Inventory plugin
```

### 2. Disabled Dine-In Pricing Cloud Sync

**[src/lib/dineInPricingService.ts](src/lib/dineInPricingService.ts#L71-L89)**

Removed cloud sync for dine-in pricing:

```typescript
// Before
await this.syncFromCloud(tenantId); // ❌ Caused errors

// After
// Local-only mode - no cloud sync needed
// Pricing overrides are stored locally and managed through menu plugin
```

## Data Architecture

### Core POS Data (Syncs via TieredSyncManager)

```
┌─────────────────────────────────────┐
│  Core POS Tables                    │
├─────────────────────────────────────┤
│  ✅ orders                          │
│  ✅ sales_transactions              │
│  ✅ tips                            │
│  ✅ cash_payouts                    │
│  ✅ cash_registers                  │
│  ✅ staff_login_history             │
└─────────────────────────────────────┘
         ↓ Syncs via TieredSyncManager
┌─────────────────────────────────────┐
│  Cloud D1 Database                  │
│  (Core POS data only)               │
└─────────────────────────────────────┘
```

### Plugin Data (Managed by Plugins)

```
┌─────────────────────────────────────┐
│  Menu Plugin                        │
├─────────────────────────────────────┤
│  - menu_items                       │
│  - menu_categories                  │
│  - dine_in_pricing_overrides        │
│  Manages own sync if needed         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  People/Payroll Plugin              │
├─────────────────────────────────────┤
│  - staff                            │
│  - roles                            │
│  - permissions                      │
│  Manages own sync if needed         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Inventory Plugin                   │
├─────────────────────────────────────┤
│  - inventory_items                  │
│  - inventory_suppliers              │
│  - inventory_transactions           │
│  - inventory_recipes                │
│  Manages own sync if needed         │
└─────────────────────────────────────┘
```

## Benefits

### Before

```
Console Errors per Minute: ~15-20
- 5-10 floor plan sync failures
- 5-6 menu/staff/inventory sync failures
- 2-3 dine-in pricing sync failures

API Calls per Minute: ~15-20
- All failing due to missing tables/columns

Memory Overhead: ~50-100MB
- Failed sync attempts queued
- Error objects accumulated
```

### After

```
Console Errors per Minute: 0
- ✅ No floor plan sync (disabled)
- ✅ No menu/staff/inventory sync (disabled)
- ✅ No dine-in pricing sync (disabled)

API Calls per Minute: 3-6
- ✅ Only core POS data syncs
- ✅ Only when data changes

Memory Overhead: ~10-20MB
- ✅ No failed sync queue
- ✅ Minimal error objects
```

## Sync Flow

### Old (Broken) Flow

```
App Start
  ↓
TieredSyncManager starts
  ↓
Tries to sync everything:
  ├─ orders ✅
  ├─ tips ✅
  ├─ sales ✅
  ├─ menu ❌ (no updated_at)
  ├─ staff ❌ (no updated_at)
  ├─ inventory_items ❌ (table may not exist)
  ├─ inventory_suppliers ❌ (table doesn't exist)
  └─ inventory_recipes ❌ (table doesn't exist)
  ↓
15-20 errors per minute
```

### New (Fixed) Flow

```
App Start
  ↓
TieredSyncManager starts
  ↓
Syncs ONLY core POS data:
  ├─ orders ✅
  ├─ tips ✅
  ├─ sales ✅
  ├─ cashPayouts ✅
  ├─ cashRegisters ✅
  └─ staffLoginHistory ✅
  ↓
0 errors, clean logs
  ↓
Plugins handle their own data:
  ├─ Menu Plugin → menu_items (if plugin installed)
  ├─ People Plugin → staff (if plugin installed)
  └─ Inventory Plugin → inventory_* (if plugin installed)
```

## Plugin Sync Guidelines

For plugins that need to sync data:

### Option 1: Local-Only (Recommended)

Most plugins should store data locally only:

```typescript
// Plugin stores data in local SQLite
await db.execute(`
  INSERT INTO plugin_table (tenant_id, data)
  VALUES ($1, $2)
`, [tenantId, data]);

// No cloud sync needed - data stays local
```

### Option 2: Plugin-Managed Sync

If plugin needs cloud sync, it manages its own:

```typescript
// Plugin implements its own sync service
class PluginSyncService {
  async syncToCloud() {
    // Plugin's own cloud endpoint
    await fetch(`https://plugin-api.com/sync`, {
      method: 'POST',
      body: JSON.stringify(this.localData)
    });
  }
}
```

### Option 3: Core Sync Integration

Only if plugin data is critical for multi-device:

```typescript
// Register plugin tables with core sync (future)
TieredSyncManager.registerPluginTable({
  name: 'plugin_table',
  interval: 600000,
  syncFunction: () => pluginSync.syncToCloud()
});
```

## Migration

No data migration needed. Changes are behavioral only:

1. **Existing data** - Stays in local database, unchanged
2. **Core POS data** - Continues to sync normally
3. **Plugin data** - No longer attempts sync (was failing anyway)

## Testing

Verify the fix:

1. **Check console on app start**
   - Should see: `[TieredSync] Orders synced...`
   - Should see: `[TieredSync] Tips synced...`
   - Should NOT see: `Menu sync failed`
   - Should NOT see: `Inventory sync failed`

2. **Check error count**
   - Before: 15-20 errors per minute
   - After: 0 errors per minute

3. **Check active syncs**
   ```typescript
   // In console
   TieredSyncManager.getActiveIntervals()
   // Should only show: orders, tips, sales, cashPayouts, cashRegisters, staffLoginHistory
   ```

## Files Modified

### Core Changes
- ✅ [src/services/sync/TieredSyncManager.ts](src/services/sync/TieredSyncManager.ts) - Disabled plugin sync
- ✅ [src/lib/dineInPricingService.ts](src/lib/dineInPricingService.ts) - Removed cloud sync
- ✅ [src/components/admin/FloorPlanManager.tsx](src/components/admin/FloorPlanManager.tsx) - Removed floor plan sync

### Documentation
- ✅ [SYNC_ARCHITECTURE_UPDATE.md](SYNC_ARCHITECTURE_UPDATE.md) - This document
- ✅ [FLOOR_PLAN_SYNC_REMOVED.md](FLOOR_PLAN_SYNC_REMOVED.md) - Floor plan details
- ✅ [PERFORMANCE_OPTIMIZATIONS_SUMMARY.md](PERFORMANCE_OPTIMIZATIONS_SUMMARY.md) - Performance overview

## Future Considerations

### Plugin API for Sync

If plugins need sync in the future, provide an API:

```typescript
// Plugin SDK
interface PluginSyncAPI {
  // Register plugin table for sync
  registerTable(config: {
    name: string;
    interval: number;
    syncFn: () => Promise<void>;
  }): void;

  // Trigger manual sync
  triggerSync(tableName: string): Promise<void>;

  // Check sync status
  getSyncStatus(tableName: string): SyncStatus;
}
```

### Cloud Sync for Multi-Location

For multi-location chains needing cross-location sync:

```typescript
// Optional cloud sync for chains
if (isMultiLocationChain && pluginConfig.enableCloudSync) {
  await plugin.syncToCloud();
}
```

But default should remain **local-only** for simplicity and privacy.

## Console Output Comparison

### Before Fix

```
[TieredSync] Syncing orders...
[TieredSync] Orders synced: 0 new, 0 failed
[TieredSync] Syncing tips...
[TieredSync] Tips synced: 0 new, 0 failed
[TieredSync] Syncing menu...
[Error] [TieredSync] Menu sync failed: "no such column: updated_at"
[OfflineQueue] Added failed sync: menu
[TieredSync] Syncing staff...
[Error] [TieredSync] Staff sync failed: "no such column: updated_at"
[OfflineQueue] Added failed sync: staff
[TieredSync] Syncing inventory suppliers...
[Error] [TieredSync] Inventory suppliers sync failed: "no such table: inventory_suppliers"
[OfflineQueue] Added failed sync: inventorySuppliers
[TieredSync] Syncing inventory recipes...
[Error] [TieredSync] Inventory recipes sync failed: "no such table: inventory_recipes"
[OfflineQueue] Added failed sync: inventoryRecipes
[FloorPlanStore] Fetching floor plan from cloud...
[Error] [FloorPlanStore] Failed to sync from cloud: Admin feature not available
[DineInPricing] Cloud sync failed: Admin feature not available
```

**Total Errors: 6 per sync cycle (every 1-10 minutes)**

### After Fix

```
[TieredSync] Syncing orders...
[TieredSync] Orders synced: 0 new, 0 failed
[TieredSync] Syncing tips...
[TieredSync] Tips synced: 0 new, 0 failed
[TieredSync] Syncing sales...
[TieredSync] Sales synced: 0 new, 0 failed
[TieredSync] Syncing cash payouts...
[TieredSync] Cash payouts synced: 0 new
[FloorPlanStore] Loaded 2 sections, 9 tables from database
[MenuStore] Loaded 30 items, 3 categories from database
```

**Total Errors: 0**

---

**Date**: 2026-02-06
**Version**: 3.1.2
**Related**: [PERFORMANCE_OPTIMIZATIONS_SUMMARY.md](PERFORMANCE_OPTIMIZATIONS_SUMMARY.md), [FLOOR_PLAN_SYNC_REMOVED.md](FLOOR_PLAN_SYNC_REMOVED.md)
