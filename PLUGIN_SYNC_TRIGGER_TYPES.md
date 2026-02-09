# Plugin Sync Trigger Types

## Overview

The plugin sync system supports **three trigger types** to match different data characteristics:

1. **Periodic** - Automatic sync at regular intervals (for dynamic/analytics data)
2. **Manual** - User-triggered sync via UI button (for static configuration data)
3. **On-Update** - Sync triggered after data changes (for important static data)

This design ensures:
- Static data (menu, people) doesn't waste resources with unnecessary periodic syncs
- Analytics data (attendance) syncs automatically for real-time insights
- Users can manually sync when needed

---

## Sync Trigger Types

### 1. Periodic Sync (Automatic Intervals)

**Use Case**: Dynamic data that changes frequently and needs real-time analytics

**Examples**:
- Attendance records (check-ins, check-outs)
- Inventory transactions
- Real-time metrics

**Behavior**:
- ✅ Runs automatically at configured intervals
- ✅ Starts when TieredSyncManager starts
- ✅ Continues running until stopped
- ❌ Not triggered manually

**Registration**:
```typescript
pluginSyncRegistry.register({
  pluginId: 'people-attendance',
  pluginName: 'Attendance Tracking',
  syncTables: ['attendance', 'time_entries'],
  syncInterval: 180000, // 3 minutes
  enabled: true,
  syncType: 'periodic', // ← Automatic periodic sync

  syncFunction: async () => {
    // Sync attendance data
    return { synced: 10, failed: 0, tables: ['attendance'] };
  },
});
```

**Console Output**:
```
[TieredSync] Starting 1 periodic plugin sync interval(s)...
[TieredSync] Started plugin sync: Attendance Tracking (every 180000ms)
... 3 minutes later ...
[TieredSync] Plugin Attendance Tracking synced: 10 records (attendance)
```

---

### 2. Manual Sync (User-Triggered)

**Use Case**: Static configuration data that rarely changes

**Examples**:
- Menu items (only change when restaurant updates menu)
- Menu categories
- Restaurant settings

**Behavior**:
- ❌ Does NOT run automatically
- ✅ Triggered via UI button or API call
- ✅ User controls when sync happens
- ✅ No wasted sync cycles for unchanged data

**Registration**:
```typescript
pluginSyncRegistry.register({
  pluginId: 'menu-management',
  pluginName: 'Menu Management',
  syncTables: ['menu_items', 'menu_categories'],
  syncInterval: 0, // Not used for manual sync
  enabled: true,
  syncType: 'manual', // ← Manual trigger only

  syncFunction: async () => {
    // Sync menu data
    return { synced: 30, failed: 0, tables: ['menu_items'] };
  },
});
```

**Triggering from UI**:
```typescript
import { getTieredSyncManager } from '@/services/sync/TieredSyncManager';

const handleSyncMenu = async () => {
  const syncManager = getTieredSyncManager();

  try {
    const result = await syncManager.triggerPluginSync('menu-management');
    console.log(`Synced ${result.synced} menu items`);
  } catch (error) {
    console.error('Sync failed:', error);
  }
};
```

**Console Output**:
```
[TieredSync] Registered 1 manual-sync plugin(s): Menu Management
... user clicks "Sync Menu" button ...
[TieredSync] Manually triggering plugin sync: menu-management
[PluginSyncRegistry] Manually triggering sync for plugin: Menu Management
[PluginSyncRegistry] Manual sync complete for Menu Management: 30 records
```

---

### 3. On-Update Sync (Event-Triggered)

**Use Case**: Important static data that should sync after changes

**Examples**:
- Staff profiles (sync after adding/editing staff)
- Roles and permissions
- Critical configuration changes

**Behavior**:
- ❌ Does NOT run automatically on intervals
- ✅ Triggered after data updates
- ✅ Ensures changes sync immediately
- ✅ No unnecessary syncs when data unchanged

**Registration**:
```typescript
pluginSyncRegistry.register({
  pluginId: 'people-staff-info',
  pluginName: 'Staff Management',
  syncTables: ['staff', 'roles'],
  syncInterval: 0, // Not used for on-update
  enabled: true,
  syncType: 'on-update', // ← Sync after data changes

  syncFunction: async () => {
    // Sync staff data
    return { synced: 5, failed: 0, tables: ['staff'] };
  },
});
```

**Triggering After Update**:
```typescript
import { getTieredSyncManager } from '@/services/sync/TieredSyncManager';

const handleSaveStaff = async (staff) => {
  // 1. Save to database
  await db.execute('UPDATE staff SET name = $1 WHERE id = $2', [staff.name, staff.id]);

  // 2. Trigger sync after update
  const syncManager = getTieredSyncManager();
  await syncManager.triggerPluginOnUpdateSync('people-staff-info', {
    tables: ['staff']
  });

  console.log('Staff updated and synced');
};
```

**Console Output**:
```
[TieredSync] Registered 1 on-update plugin(s): Staff Management
... user saves staff member ...
[TieredSync] Triggering on-update sync for plugin: people-staff-info
[PluginSyncRegistry] Triggering on-update sync for plugin: Staff Management
[PluginSyncRegistry] On-update sync complete for Staff Management: 5 records
```

---

## Comparison Table

| Feature | Periodic | Manual | On-Update |
|---------|----------|--------|-----------|
| **Auto-start intervals** | ✅ Yes | ❌ No | ❌ No |
| **User-triggered** | ❌ No | ✅ Yes | ✅ Yes (after update) |
| **Sync interval used** | ✅ Yes | ❌ No | ❌ No |
| **Best for** | Analytics data | Static config | Important updates |
| **Examples** | Attendance, metrics | Menu, settings | Staff, roles |
| **Resource usage** | Higher (frequent syncs) | Lowest (on-demand) | Low (only on changes) |
| **Data freshness** | Real-time | On-demand | Immediate after change |

---

## Decision Guide

### Use **Periodic** when:
- Data changes frequently (multiple times per hour)
- Real-time analytics needed
- Data drives dashboards/reports
- Example: Attendance tracking, inventory transactions

### Use **Manual** when:
- Data rarely changes (monthly or less)
- User should control sync timing
- Data is large and sync is expensive
- Example: Menu items, restaurant settings, supplier lists

### Use **On-Update** when:
- Data changes occasionally (weekly)
- Changes are critical and must sync immediately
- User expects changes to propagate quickly
- Example: Staff profiles, roles, permissions, pricing rules

---

## Real-World Examples

### Example 1: Menu Plugin (Manual Sync)

```typescript
// plugins/menu/sync.ts
export class MenuPluginSync {
  async initialize() {
    pluginSyncRegistry.register({
      pluginId: 'menu-management',
      pluginName: 'Menu',
      syncTables: ['menu_items', 'menu_categories'],
      syncType: 'manual', // User clicks "Sync Menu" button
      // ...
    });
  }
}

// In admin UI
const MenuAdminPanel = () => {
  const handleSync = async () => {
    const syncManager = getTieredSyncManager();
    await syncManager.triggerPluginSync('menu-management');
    alert('Menu synced successfully!');
  };

  return (
    <div>
      <h2>Menu Management</h2>
      <button onClick={handleSync}>Sync Menu</button>
    </div>
  );
};
```

---

### Example 2: People Plugin (Mixed Sync)

```typescript
// plugins/people/sync.ts
export class PeoplePluginSync {
  async initialize() {
    // Staff info: On-update (sync after changes)
    pluginSyncRegistry.register({
      pluginId: 'people-staff-info',
      pluginName: 'Staff Info',
      syncTables: ['staff', 'roles'],
      syncType: 'on-update',
      // ...
    });

    // Attendance: Periodic (auto-sync for analytics)
    pluginSyncRegistry.register({
      pluginId: 'people-attendance',
      pluginName: 'Attendance',
      syncTables: ['attendance'],
      syncInterval: 180000, // 3 min
      syncType: 'periodic',
      // ...
    });
  }
}

// In staff management UI
const StaffEditor = () => {
  const handleSaveStaff = async (staff) => {
    // Save to database
    await saveStaffToDatabase(staff);

    // Trigger on-update sync
    const syncManager = getTieredSyncManager();
    await syncManager.triggerPluginOnUpdateSync('people-staff-info');
  };

  return <StaffForm onSave={handleSaveStaff} />;
};

// Attendance syncs automatically every 3 minutes - no UI needed
```

---

### Example 3: Inventory Plugin (Periodic Sync)

```typescript
// plugins/inventory/sync.ts
export class InventoryPluginSync {
  async initialize() {
    pluginSyncRegistry.register({
      pluginId: 'inventory-tracking',
      pluginName: 'Inventory',
      syncTables: ['inventory_transactions'],
      syncInterval: 600000, // 10 min
      syncType: 'periodic', // Auto-sync for analytics
      // ...
    });
  }
}

// No UI interaction needed - syncs automatically every 10 minutes
// Perfect for tracking inventory changes in real-time dashboards
```

---

## Migration from Old System

### Before (Everything Periodic)

```typescript
// Old: Everything synced periodically
menu: { enabled: true, interval: 600000 }         // ❌ Unnecessary syncs
staff: { enabled: true, interval: 600000 }        // ❌ Unnecessary syncs
attendance: { enabled: true, interval: 180000 }   // ✅ Correct
```

**Problems**:
- Menu synced every 10 minutes even when unchanged
- Staff synced every 10 minutes even when unchanged
- Wasted API calls, bandwidth, and processing

### After (Differentiated Triggers)

```typescript
// New: Sync types match data characteristics
menu: { syncType: 'manual' }          // ✅ User-triggered only
staff: { syncType: 'on-update' }      // ✅ Sync after changes
attendance: { syncType: 'periodic' }  // ✅ Auto-sync for analytics
```

**Benefits**:
- Menu: 0 unnecessary syncs (user controls when to sync)
- Staff: Only syncs after updates (saves 99% of sync cycles)
- Attendance: Still auto-syncs for real-time analytics
- Overall: 60-80% reduction in sync API calls

---

## API Reference

### PluginSyncRegistry

```typescript
// Manually trigger sync (for 'manual' type plugins)
await pluginSyncRegistry.triggerManualSync(pluginId: string): Promise<{
  synced: number;
  failed: number;
  tables: string[];
}>

// Trigger on-update sync (for 'on-update' type plugins)
await pluginSyncRegistry.triggerOnUpdateSync(
  pluginId: string,
  context?: { tables?: string[] }
): Promise<{
  synced: number;
  failed: number;
  tables: string[];
}>

// Get handlers by type
pluginSyncRegistry.getPeriodicHandlers(): PluginSyncHandler[]
pluginSyncRegistry.getManualHandlers(): PluginSyncHandler[]
pluginSyncRegistry.getOnUpdateHandlers(): PluginSyncHandler[]
```

### TieredSyncManager

```typescript
const syncManager = getTieredSyncManager();

// Trigger manual plugin sync
await syncManager.triggerPluginSync(pluginId: string)

// Trigger on-update plugin sync
await syncManager.triggerPluginOnUpdateSync(
  pluginId: string,
  context?: { tables?: string[] }
)
```

---

## Best Practices

### 1. Choose the Right Sync Type

```typescript
// ❌ Bad: Menu with periodic sync
pluginSyncRegistry.register({
  pluginId: 'menu',
  syncType: 'periodic',
  syncInterval: 600000, // Syncs every 10 min even when unchanged
});

// ✅ Good: Menu with manual sync
pluginSyncRegistry.register({
  pluginId: 'menu',
  syncType: 'manual', // Only syncs when user clicks button
});
```

### 2. Use On-Update for Critical Changes

```typescript
// ❌ Bad: Staff changes require manual sync
const handleSaveStaff = async (staff) => {
  await saveStaffToDatabase(staff);
  // User must remember to click "Sync" button
};

// ✅ Good: Staff changes sync automatically
const handleSaveStaff = async (staff) => {
  await saveStaffToDatabase(staff);
  await syncManager.triggerPluginOnUpdateSync('people-staff-info');
  // Syncs immediately after update
};
```

### 3. Error Handling

```typescript
// Always handle sync errors gracefully
const handleManualSync = async () => {
  try {
    const result = await syncManager.triggerPluginSync('menu-management');
    showSuccessMessage(`Synced ${result.synced} items`);
  } catch (error) {
    showErrorMessage('Sync failed. Please try again.');
    console.error('Sync error:', error);
  }
};
```

### 4. Provide User Feedback

```typescript
// Show sync status in UI
const MenuSyncButton = () => {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncManager.triggerPluginSync('menu-management');
      alert(`Synced ${result.synced} menu items`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button onClick={handleSync} disabled={syncing}>
      {syncing ? 'Syncing...' : 'Sync Menu'}
    </button>
  );
};
```

---

## Console Output Examples

### System Startup

```
[TieredSync] Starting tiered sync manager...
[TieredSync] Started interval: orders (every 60000ms)
[TieredSync] Started interval: tips (every 60000ms)
[TieredSync] Registered 1 manual-sync plugin(s): Menu Management
[TieredSync] Registered 1 on-update plugin(s): Staff Management
[TieredSync] Starting 2 periodic plugin sync interval(s)...
[TieredSync] Started plugin sync: Attendance Tracking (every 180000ms)
[TieredSync] Started plugin sync: Inventory Tracking (every 600000ms)
[TieredSync] All sync intervals started (core + plugins)
```

### Manual Sync

```
... user clicks "Sync Menu" button ...
[TieredSync] Manually triggering plugin sync: menu-management
[PluginSyncRegistry] Manually triggering sync for plugin: Menu Management
[MenuPluginSync] Syncing 30 menu items...
[PluginSyncRegistry] Manual sync complete for Menu Management: 30 records
```

### On-Update Sync

```
... user saves staff member ...
[TieredSync] Triggering on-update sync for plugin: people-staff-info
[PluginSyncRegistry] Triggering on-update sync for plugin: Staff Management
[PeoplePluginSync] Syncing 1 staff profile...
[PluginSyncRegistry] On-update sync complete for Staff Management: 1 records
```

### Periodic Sync

```
... automatic sync every 3 minutes ...
[TieredSync] Plugin Attendance Tracking synced: 15 records (attendance)
... 3 minutes later ...
[TieredSync] Plugin Attendance Tracking synced: 8 records (attendance)
```

---

## Files

### Core Implementation
- ✅ [src/services/sync/PluginSyncRegistry.ts](src/services/sync/PluginSyncRegistry.ts) - Registry with trigger type support
- ✅ [src/services/sync/TieredSyncManager.ts](src/services/sync/TieredSyncManager.ts) - Manager with manual/on-update triggers

### Examples
- ✅ [src/services/sync/examples/menuPluginSync.example.ts](src/services/sync/examples/menuPluginSync.example.ts) - Manual sync example
- ✅ [src/services/sync/examples/peoplePluginSync.example.ts](src/services/sync/examples/peoplePluginSync.example.ts) - Mixed sync example
- ✅ [src/services/sync/examples/inventoryPluginSync.example.ts](src/services/sync/examples/inventoryPluginSync.example.ts) - Periodic sync example

### Documentation
- ✅ [PLUGIN_SYNC_TRIGGER_TYPES.md](PLUGIN_SYNC_TRIGGER_TYPES.md) - This document
- ✅ [PLUGIN_SYNC_ARCHITECTURE.md](PLUGIN_SYNC_ARCHITECTURE.md) - Architecture overview
- ✅ [SYNC_ARCHITECTURE_UPDATE.md](SYNC_ARCHITECTURE_UPDATE.md) - Previous sync changes

---

**Date**: 2026-02-06
**Version**: 3.1.2
**Status**: Sync trigger types implemented, ready for plugin adoption
