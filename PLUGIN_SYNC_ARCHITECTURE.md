# Plugin-Based Sync Architecture

## Overview

The sync system now supports a **plugin-based architecture** where each plugin can register its own sync handler. The TieredSyncManager orchestrates both core POS sync and plugin sync through a central registry.

**New Feature**: The system supports **three sync trigger types**:
- **Periodic**: Automatic sync at intervals (e.g., attendance for analytics)
- **Manual**: User-triggered sync (e.g., menu, static config)
- **On-Update**: Event-triggered after data changes (e.g., staff profiles)

See [PLUGIN_SYNC_TRIGGER_TYPES.md](PLUGIN_SYNC_TRIGGER_TYPES.md) for detailed guide on choosing the right trigger type.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│           TieredSyncManager (Orchestrator)               │
│  - Manages core POS sync                                 │
│  - Discovers and runs plugin sync handlers               │
│  - Handles sync intervals and failures                   │
└────────────┬────────────────────────┬────────────────────┘
             │                        │
    ┌────────┴────────┐      ┌───────┴──────────┐
    │                 │      │                   │
┌───▼────────────┐ ┌──▼─────────────┐ ┌────────▼──────────┐
│  Core POS Sync │ │ Plugin Sync    │ │ Plugin Sync       │
│                │ │ Registry       │ │ Handler N         │
│ - orders       │ │                │ │                   │
│ - sales        │ │ Manages plugin │ │ Plugin implements │
│ - tips         │ │ sync handlers  │ │ own sync logic    │
│ - cash         │ │                │ │                   │
└────────────────┘ └────┬───────────┘ └───────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼─────┐   ┌────▼─────┐  ┌────▼─────┐
    │ Inventory│   │   Menu   │  │  People  │
    │  Plugin  │   │  Plugin  │  │  Plugin  │
    │   Sync   │   │   Sync   │  │   Sync   │
    └──────────┘   └──────────┘  └──────────┘
```

## Core Components

### 1. PluginSyncRegistry

Central registry where plugins register their sync handlers.

**Location**: `src/services/sync/PluginSyncRegistry.ts`

```typescript
type SyncTriggerType = 'periodic' | 'manual' | 'on-update';

interface PluginSyncHandler {
  pluginId: string;           // Unique plugin identifier
  pluginName: string;         // Display name
  syncTables: string[];       // Tables this plugin syncs
  syncInterval: number;       // Sync frequency (ms) - only for 'periodic'
  enabled: boolean;           // Enable/disable sync
  syncType: SyncTriggerType;  // New: When to trigger sync

  // Main sync function
  syncFunction: () => Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }>;

  // Optional: Check if plugin has data
  checkDataExists?: () => Promise<boolean>;

  // Optional: Get sync status
  getStatus?: () => Promise<{
    lastSync?: Date;
    lastError?: string;
    recordCount?: number;
  }>;
}
```

### 2. TieredSyncManager (Updated)

Orchestrates both core and plugin sync.

**Location**: `src/services/sync/TieredSyncManager.ts`

**Key Changes**:
- Discovers registered plugin sync handlers
- Starts sync intervals for **periodic** plugins only
- Manual and on-update plugins triggered via API calls
- Handles plugin sync failures gracefully (doesn't affect core sync)
- Resumes plugin sync after pause

## How Plugins Register Sync

### Step 1: Implement Plugin Sync Class

```typescript
// Example: Periodic sync for analytics data
// plugins/inventory/sync.ts
import { pluginSyncRegistry } from '@/services/sync/PluginSyncRegistry';

export class InventoryPluginSync {
  async initialize(tenantId: string) {
    // Register with central sync manager
    pluginSyncRegistry.register({
      pluginId: 'inventory-management',
      pluginName: 'Inventory Management',
      syncTables: ['inventory_items', 'inventory_suppliers'],
      syncInterval: 600000, // 10 minutes
      enabled: true,
      syncType: 'periodic', // Auto-sync for analytics

      syncFunction: async () => {
        // Plugin's sync logic here
        const result = await this.syncInventoryData();
        return result;
      },

      checkDataExists: async () => {
        // Check if plugin has any data to sync
        return await this.hasInventoryData();
      },
    });
  }

  async syncInventoryData() {
    // Sync implementation
    return {
      synced: 10,
      failed: 0,
      tables: ['inventory_items'],
    };
  }
}
```

```typescript
// Example: Manual sync for static data
// plugins/menu/sync.ts
export class MenuPluginSync {
  async initialize(tenantId: string) {
    pluginSyncRegistry.register({
      pluginId: 'menu-management',
      pluginName: 'Menu Management',
      syncTables: ['menu_items', 'menu_categories'],
      syncInterval: 0, // Not used for manual
      enabled: true,
      syncType: 'manual', // User-triggered only

      syncFunction: async () => {
        return await this.syncMenuData();
      },
    });
  }
}

// Trigger manually from UI
const syncManager = getTieredSyncManager();
await syncManager.triggerPluginSync('menu-management');
```

### Step 2: Register on Plugin Load

```typescript
// plugins/inventory/index.ts
import { InventoryPluginSync } from './sync';

export async function onPluginLoad(tenantId: string) {
  // Initialize plugin sync
  const sync = new InventoryPluginSync();
  await sync.initialize(tenantId);

  // Sync will now run automatically via TieredSyncManager
}
```

### Step 3: Unregister on Plugin Unload

```typescript
export function onPluginUnload() {
  // Cleanup sync handler
  pluginSyncRegistry.unregister('inventory-management');
}
```

## Sync Flow

### Core POS Sync (Always Active)

```
TieredSyncManager starts
  ↓
Core POS Sync Intervals:
  ├─ orders (60s)         ✅ Always syncs
  ├─ tips (60s)           ✅ Always syncs
  ├─ sales (60s)          ✅ Always syncs
  ├─ cashPayouts (3min)   ✅ Always syncs
  ├─ cashRegisters (30min)✅ Always syncs
  └─ staffLoginHistory (3min) ✅ Always syncs
```

### Plugin Sync (Conditional)

```
TieredSyncManager starts
  ↓
Query PluginSyncRegistry
  ↓
For each registered plugin:
  ├─ Check if enabled
  ├─ Check if data exists (optional)
  ├─ Start sync interval
  └─ Run sync function
      ├─ Success ✅ → Log result
      └─ Failure ❌ → Log error (doesn't crash core sync)
```

## Benefits

### 1. **Separation of Concerns**

- Core POS sync is isolated from plugin sync
- Plugin failures don't affect core sync
- Each plugin manages its own sync logic

### 2. **Flexibility**

- Plugins can have different sync intervals
- Plugins can enable/disable sync independently
- Plugins can check if data exists before syncing

### 3. **No More Errors**

Before:
```
[Error] Menu sync failed: "no such column: updated_at"
[Error] Inventory sync failed: "no such table"
```

After:
```
[TieredSync] No errors - only installed plugins sync
[TieredSync] Plugin Inventory synced: 10 records
```

### 4. **Easy Plugin Development**

Plugins just implement:
1. Sync function (returns synced/failed counts)
2. Optional data check (to skip if no data)
3. Optional status getter (for monitoring)

## Example Plugins

### Inventory Plugin Sync

```typescript
pluginSyncRegistry.register({
  pluginId: 'inventory-management',
  pluginName: 'Inventory',
  syncTables: ['inventory_items', 'inventory_suppliers', 'inventory_transactions'],
  syncInterval: 600000, // 10 min
  enabled: true,
  syncFunction: async () => {
    // Sync inventory data
    return { synced: 25, failed: 0, tables: ['inventory_items', 'inventory_suppliers'] };
  },
});
```

### Menu Plugin Sync

```typescript
pluginSyncRegistry.register({
  pluginId: 'menu-management',
  pluginName: 'Menu',
  syncTables: ['menu_items', 'menu_categories'],
  syncInterval: 600000, // 10 min
  enabled: true,
  syncFunction: async () => {
    // Sync menu data
    return { synced: 30, failed: 0, tables: ['menu_items', 'menu_categories'] };
  },
});
```

### People/Payroll Plugin Sync

```typescript
pluginSyncRegistry.register({
  pluginId: 'people-payroll',
  pluginName: 'People & Payroll',
  syncTables: ['staff', 'attendance', 'rosters'],
  syncInterval: 300000, // 5 min
  enabled: true,
  syncFunction: async () => {
    // Sync staff data
    return { synced: 15, failed: 0, tables: ['staff', 'attendance'] };
  },
});
```

## Console Output

### With Plugins Registered

```
[TieredSync] Starting tiered sync manager...
[TieredSync] Started interval: orders (every 60000ms)
[TieredSync] Started interval: tips (every 60000ms)
[TieredSync] Started interval: sales (every 60000ms)
[TieredSync] Starting 3 plugin sync intervals...
[TieredSync] Started plugin sync: Inventory (every 600000ms)
[TieredSync] Started plugin sync: Menu (every 600000ms)
[TieredSync] Started plugin sync: People & Payroll (every 300000ms)
[TieredSync] All sync intervals started (core + plugins)

... later ...

[TieredSync] Orders synced: 0 new, 0 failed
[TieredSync] Plugin Inventory synced: 25 records (inventory_items, inventory_suppliers)
[TieredSync] Plugin Menu synced: 30 records (menu_items, menu_categories)
```

### Without Plugins (Default)

```
[TieredSync] Starting tiered sync manager...
[TieredSync] Started interval: orders (every 60000ms)
[TieredSync] Started interval: tips (every 60000ms)
[TieredSync] Started interval: sales (every 60000ms)
[TieredSync] No plugin sync handlers registered
[TieredSync] All sync intervals started (core + plugins)
```

## API Reference

### PluginSyncRegistry

```typescript
// Get singleton instance
import { pluginSyncRegistry } from '@/services/sync/PluginSyncRegistry';

// Register a plugin sync handler
pluginSyncRegistry.register(handler: PluginSyncHandler): void

// Unregister a plugin
pluginSyncRegistry.unregister(pluginId: string): void

// Get all registered handlers
pluginSyncRegistry.getAll(): PluginSyncHandler[]

// Get enabled handlers only
pluginSyncRegistry.getEnabled(): PluginSyncHandler[]

// Check if plugin is registered
pluginSyncRegistry.has(pluginId: string): boolean

// Enable/disable a plugin's sync
pluginSyncRegistry.setEnabled(pluginId: string, enabled: boolean): void
```

### PluginSyncHandler Interface

```typescript
interface PluginSyncHandler {
  pluginId: string;              // Required: Unique ID
  pluginName: string;            // Required: Display name
  syncTables: string[];          // Required: Tables synced
  syncInterval: number;          // Required: Interval in ms
  enabled: boolean;              // Required: Enable/disable

  syncFunction: () => Promise<{  // Required: Sync logic
    synced: number;
    failed: number;
    tables: string[];
  }>;

  checkDataExists?: () => Promise<boolean>; // Optional
  getStatus?: () => Promise<{               // Optional
    lastSync?: Date;
    lastError?: string;
    recordCount?: number;
  }>;
}
```

## Migration Guide

### Before (Old System)

```typescript
// TieredSyncManager tried to sync everything
// Caused errors for missing tables/columns
[Error] Menu sync failed: "no such column"
[Error] Inventory sync failed: "no such table"
```

### After (Plugin System)

```typescript
// Core syncs only core data
// Plugins register their own sync

// 1. Core sync (automatic)
const syncManager = new TieredSyncManager(tenantId, dbPath);
await syncManager.start();

// 2. Plugin sync (plugin registers itself)
const inventorySync = new InventoryPluginSync();
await inventorySync.initialize(tenantId);
// Sync now runs automatically
```

## Error Handling

Plugin sync errors are **isolated** and don't affect core sync:

```typescript
// Plugin sync fails
[Error] [TieredSync] Plugin Inventory sync failed: Network error
[TieredSync] Plugin Menu synced: 30 records ✅

// Core sync continues normally
[TieredSync] Orders synced: 5 new, 0 failed ✅
[TieredSync] Sales synced: 3 new, 0 failed ✅
```

## Testing

### Test Plugin Sync

```typescript
import { pluginSyncRegistry } from '@/services/sync/PluginSyncRegistry';

// Register test plugin
pluginSyncRegistry.register({
  pluginId: 'test-plugin',
  pluginName: 'Test Plugin',
  syncTables: ['test_table'],
  syncInterval: 5000,
  enabled: true,
  syncFunction: async () => {
    console.log('Test plugin sync running!');
    return { synced: 1, failed: 0, tables: ['test_table'] };
  },
});

// Check registration
console.log(pluginSyncRegistry.has('test-plugin')); // true

// Get all registered
console.log(pluginSyncRegistry.getAll());

// Unregister
pluginSyncRegistry.unregister('test-plugin');
```

## Future Enhancements

### 1. Plugin Sync UI

Show plugin sync status in admin panel:

```typescript
// src/pages-v2/SyncStatusPage.tsx
const pluginHandlers = pluginSyncRegistry.getAll();

return (
  <div>
    <h2>Plugin Sync Status</h2>
    {pluginHandlers.map(handler => (
      <div key={handler.pluginId}>
        <h3>{handler.pluginName}</h3>
        <p>Tables: {handler.syncTables.join(', ')}</p>
        <p>Interval: {handler.syncInterval}ms</p>
        <p>Enabled: {handler.enabled ? 'Yes' : 'No'}</p>
        {handler.getStatus && <Status plugin={handler} />}
      </div>
    ))}
  </div>
);
```

### 2. Plugin Sync Metrics

Track sync performance:

```typescript
interface SyncMetrics {
  pluginId: string;
  totalSyncs: number;
  successRate: number;
  avgDuration: number;
  lastSync: Date;
}
```

### 3. Conditional Plugin Sync

Sync only when plugin is active:

```typescript
checkDataExists: async () => {
  const pluginEnabled = await isPluginEnabled('inventory');
  const hasData = await hasInventoryData();
  return pluginEnabled && hasData;
}
```

## Files

### Core Implementation
- ✅ [src/services/sync/PluginSyncRegistry.ts](src/services/sync/PluginSyncRegistry.ts) - Plugin sync registry
- ✅ [src/services/sync/TieredSyncManager.ts](src/services/sync/TieredSyncManager.ts) - Updated orchestrator

### Examples
- ✅ [src/services/sync/examples/inventoryPluginSync.example.ts](src/services/sync/examples/inventoryPluginSync.example.ts) - Inventory plugin example

### Documentation
- ✅ [PLUGIN_SYNC_ARCHITECTURE.md](PLUGIN_SYNC_ARCHITECTURE.md) - This document
- ✅ [PLUGIN_SYNC_TRIGGER_TYPES.md](PLUGIN_SYNC_TRIGGER_TYPES.md) - **NEW**: Sync trigger types guide
- ✅ [SYNC_ARCHITECTURE_UPDATE.md](SYNC_ARCHITECTURE_UPDATE.md) - Previous sync changes

---

**Date**: 2026-02-06
**Version**: 3.1.2
**Status**: Plugin sync registry implemented with three trigger types (periodic, manual, on-update)
