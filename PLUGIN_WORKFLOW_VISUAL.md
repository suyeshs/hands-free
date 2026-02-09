# Plugin Workflow - Visual Guide

## Complete Plugin Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PLUGIN LIFECYCLE                              │
└─────────────────────────────────────────────────────────────────────┘

   ┌─────────────┐
   │   Install   │  User installs plugin from registry
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │    Load     │  Plugin manifest loaded into memory
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  Initialize │  Plugin runs initialization code
   │             │  - Creates database tables (migrations)
   │             │  - Registers sync handler
   │             │  - Registers UI components
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │   Active    │  Plugin is running
   │             │  - Sync runs on interval
   │             │  - UI components visible
   │             │  - API endpoints available
   └──────┬──────┘
          │
          ├──────→ ┌─────────────┐
          │        │   Disable   │  Temporarily stop plugin
          │        └──────┬──────┘
          │               │
          │               ▼
          │        ┌─────────────┐
          │        │  Suspended  │  Plugin paused
          │        │             │  - Sync stopped
          │        │             │  - UI hidden
          │        └──────┬──────┘
          │               │
          │               ▼
          ├───────← ┌─────────────┐
          │        │   Enable    │  Resume plugin
          │        └─────────────┘
          │
          ▼
   ┌─────────────┐
   │  Uninstall  │  Plugin removed
   │             │  - Unregister sync
   │             │  - Remove UI components
   │             │  - Optional: Keep/delete data
   └─────────────┘
```

## Plugin Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PLUGIN ARCHITECTURE                               │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          CORE POS SYSTEM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │
│  │ Plugin Manager │  │  Sync Manager  │  │  UI Framework  │       │
│  │                │  │                │  │                │       │
│  │ - Load plugins │  │ - Core sync    │  │ - Routes       │       │
│  │ - Register     │  │ - Plugin sync  │  │ - Components   │       │
│  │ - Lifecycle    │  │                │  │                │       │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘       │
│           │                   │                     │               │
└───────────┼───────────────────┼─────────────────────┼───────────────┘
            │                   │                     │
            │                   │                     │
┌───────────┼───────────────────┼─────────────────────┼───────────────┐
│           │                   │                     │               │
│  ┌────────▼────────┐  ┌───────▼────────┐  ┌────────▼────────┐     │
│  │ Plugin Manifest │  │  Sync Registry │  │  UI Registry    │     │
│  │                 │  │                │  │                 │     │
│  │ - metadata      │  │ - Handlers     │  │ - Routes        │     │
│  │ - permissions   │  │ - Intervals    │  │ - Components    │     │
│  │ - dependencies  │  │ - Status       │  │ - Menu items    │     │
│  └─────────────────┘  └────────────────┘  └─────────────────┘     │
│                                                                     │
│                       PLUGIN INFRASTRUCTURE                         │
└─────────────────────────────────────────────────────────────────────┘
            │                   │                     │
            │                   │                     │
            ▼                   ▼                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           PLUGIN LAYER                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Inventory   │    │     Menu     │    │    People    │          │
│  │   Plugin     │    │    Plugin    │    │    Plugin    │          │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤          │
│  │ manifest.json│    │ manifest.json│    │ manifest.json│          │
│  │ sync.ts      │    │ sync.ts      │    │ sync.ts      │          │
│  │ ui/          │    │ ui/          │    │ ui/          │          │
│  │ migrations/  │    │ migrations/  │    │ migrations/  │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                    │                  │
└─────────┼───────────────────┼────────────────────┼──────────────────┘
          │                   │                    │
          ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LOCAL SQLITE DATABASE                           │
├─────────────────────────────────────────────────────────────────────┤
│  Core Tables          Plugin Tables (Inventory)  Plugin Tables      │
│  ┌──────────┐        ┌──────────────────┐      ┌──────────┐       │
│  │ orders   │        │ inventory_items  │      │ staff    │       │
│  │ sales    │        │ inventory_suppliers│    │ rosters  │       │
│  │ tips     │        │ inventory_recipes│      │ attendance│      │
│  └──────────┘        └──────────────────┘      └──────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

## Plugin Installation Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PLUGIN INSTALLATION FLOW                           │
└──────────────────────────────────────────────────────────────────────┘

USER                PLUGIN MANAGER              PLUGIN                  DATABASE
 │                       │                        │                        │
 │  Install Plugin      │                        │                        │
 ├──────────────────────>│                        │                        │
 │                       │                        │                        │
 │                       │  1. Download Plugin    │                        │
 │                       │────────────────────────>│                        │
 │                       │                        │                        │
 │                       │  2. Validate Manifest  │                        │
 │                       │<────────────────────────│                        │
 │                       │                        │                        │
 │                       │  3. Check Permissions  │                        │
 │                       │────────────────────────>│                        │
 │                       │                        │                        │
 │                       │  4. Run Migrations     │                        │
 │                       │────────────────────────────────────────────────>│
 │                       │                        │                        │
 │                       │                        │  CREATE TABLE          │
 │                       │<────────────────────────────────────────────────│
 │                       │                        │                        │
 │                       │  5. Initialize Plugin  │                        │
 │                       │────────────────────────>│                        │
 │                       │                        │                        │
 │                       │                        │  onPluginLoad()        │
 │                       │                        │  - Register sync       │
 │                       │                        │  - Register UI         │
 │                       │                        │  - Setup hooks         │
 │                       │                        │                        │
 │                       │  6. Mark as Installed  │                        │
 │                       │────────────────────────────────────────────────>│
 │                       │                        │                        │
 │  ✅ Plugin Active     │                        │                        │
 │<──────────────────────│                        │                        │
 │                       │                        │                        │
```

## Plugin Sync Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PLUGIN SYNC FLOW                               │
└──────────────────────────────────────────────────────────────────────┘

PLUGIN                  SYNC REGISTRY           SYNC MANAGER          CLOUD API
 │                           │                       │                    │
 │  1. Register Sync         │                       │                    │
 ├───────────────────────────>│                       │                    │
 │  {                         │                       │                    │
 │    pluginId,               │                       │                    │
 │    syncFunction,           │                       │                    │
 │    interval: 10min         │                       │                    │
 │  }                         │                       │                    │
 │                           │                       │                    │
 │                           │  2. Discover Plugins  │                    │
 │                           │<──────────────────────│                    │
 │                           │                       │                    │
 │                           │  3. Get Enabled       │                    │
 │                           │──────────────────────>│                    │
 │                           │                       │                    │
 │                           │  4. Start Intervals   │                    │
 │                           │<──────────────────────│                    │
 │                           │                       │                    │
 │  ⏰ Sync Interval (10min) │                       │                    │
 │                           │                       │                    │
 │                           │  5. Run Sync Function │                    │
 │<──────────────────────────────────────────────────│                    │
 │                           │                       │                    │
 │  6. Check Data Exists     │                       │                    │
 │  ✅ Has data              │                       │                    │
 │                           │                       │                    │
 │  7. Fetch Local Data      │                       │                    │
 │  (from SQLite)            │                       │                    │
 │                           │                       │                    │
 │  8. Sync to Cloud         │                       │                    │
 │──────────────────────────────────────────────────────────────────────>│
 │                           │                       │                    │
 │                           │                       │  POST /sync        │
 │                           │                       │                    │
 │  9. Cloud Response        │                       │                    │
 │<──────────────────────────────────────────────────────────────────────│
 │  { synced: 25, failed: 0 }│                       │                    │
 │                           │                       │                    │
 │  10. Return Result        │                       │                    │
 │───────────────────────────────────────────────────>│                    │
 │  {                         │                       │                    │
 │    synced: 25,             │                       │                    │
 │    failed: 0,              │                       │                    │
 │    tables: [...]           │                       │                    │
 │  }                         │                       │                    │
 │                           │                       │                    │
 │                           │  11. Log Result       │                    │
 │                           │<──────────────────────│                    │
 │                           │  ✅ Synced 25 records │                    │
 │                           │                       │                    │
```

## Plugin Sync Registration Detail

```
┌──────────────────────────────────────────────────────────────────────┐
│                  PLUGIN SYNC REGISTRATION DETAIL                      │
└──────────────────────────────────────────────────────────────────────┘

1. PLUGIN INITIALIZATION
   ┌────────────────────────────────────────────────────────────────┐
   │  // plugins/inventory/sync.ts                                  │
   │                                                                 │
   │  import { pluginSyncRegistry } from '@/services/sync/...'      │
   │                                                                 │
   │  export class InventoryPluginSync {                            │
   │    async initialize(tenantId: string) {                        │
   │      await this.setupDatabase();                               │
   │      this.registerSync();                                      │
   │    }                                                            │
   │  }                                                              │
   └────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
2. REGISTER WITH SYNC REGISTRY
   ┌────────────────────────────────────────────────────────────────┐
   │  pluginSyncRegistry.register({                                 │
   │    pluginId: 'inventory-management',                           │
   │    pluginName: 'Inventory',                                    │
   │    syncTables: ['inventory_items', 'inventory_suppliers'],     │
   │    syncInterval: 600000, // 10 minutes                         │
   │    enabled: true,                                              │
   │                                                                 │
   │    syncFunction: async () => {                                 │
   │      return await this.syncInventoryData();                    │
   │    },                                                           │
   │                                                                 │
   │    checkDataExists: async () => {                              │
   │      return await this.hasInventoryData();                     │
   │    }                                                            │
   │  });                                                            │
   └────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
3. SYNC MANAGER DISCOVERS PLUGIN
   ┌────────────────────────────────────────────────────────────────┐
   │  TieredSyncManager.start()                                     │
   │    │                                                            │
   │    ├─ Start core sync intervals                                │
   │    │  └─ orders, sales, tips...                                │
   │    │                                                            │
   │    └─ startPluginSyncIntervals()                               │
   │       │                                                         │
   │       ├─ Query pluginSyncRegistry.getEnabled()                 │
   │       │  └─ Returns: [InventoryPlugin, MenuPlugin, ...]        │
   │       │                                                         │
   │       └─ For each plugin:                                      │
   │          └─ Start sync interval                                │
   └────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
4. SYNC RUNS ON INTERVAL
   ┌────────────────────────────────────────────────────────────────┐
   │  Every 10 minutes:                                             │
   │                                                                 │
   │  1. Check if data exists                                       │
   │     └─ checkDataExists() → true                                │
   │                                                                 │
   │  2. Run sync function                                          │
   │     └─ syncFunction()                                          │
   │        │                                                        │
   │        ├─ Fetch local data (SQLite)                            │
   │        ├─ Send to cloud API                                    │
   │        ├─ Mark as synced                                       │
   │        └─ Return result                                        │
   │                                                                 │
   │  3. Log result                                                 │
   │     └─ "Plugin Inventory synced: 25 records"                   │
   └────────────────────────────────────────────────────────────────┘
```

## Data Flow: Plugin to Cloud

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW: PLUGIN TO CLOUD                         │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  USER ACTION    │  User adds inventory item
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LOCAL SQLITE DATABASE                                               │
├─────────────────────────────────────────────────────────────────────┤
│  INSERT INTO inventory_items (                                       │
│    tenant_id, name, quantity, price, updated_at, synced_at          │
│  ) VALUES (                                                          │
│    'tenant-123', 'Tomatoes', 50, 2.99, NOW(), NULL                  │
│  )                                                                   │
│                                                                      │
│  synced_at = NULL  ← Indicates needs sync                           │
└────────┬────────────────────────────────────────────────────────────┘
         │
         │  ⏰ Wait for sync interval (10 min)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PLUGIN SYNC FUNCTION                                                │
├─────────────────────────────────────────────────────────────────────┤
│  1. Query unsynchronized records:                                    │
│     SELECT * FROM inventory_items                                    │
│     WHERE synced_at IS NULL OR updated_at > synced_at                │
│                                                                      │
│     Result: [{ id: 1, name: 'Tomatoes', ... }]                      │
│                                                                      │
│  2. Prepare payload:                                                 │
│     {                                                                │
│       tenantId: 'tenant-123',                                        │
│       items: [{ id: 1, name: 'Tomatoes', ... }]                     │
│     }                                                                │
└────────┬────────────────────────────────────────────────────────────┘
         │
         │  HTTP POST
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CLOUD API                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  POST /api/inventory/sync                                            │
│                                                                      │
│  Validates data                                                      │
│  Stores in cloud database                                            │
│  Returns success                                                     │
│                                                                      │
│  Response: { synced: 1, failed: 0 }                                 │
└────────┬────────────────────────────────────────────────────────────┘
         │
         │  Success Response
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PLUGIN SYNC FUNCTION (Continued)                                    │
├─────────────────────────────────────────────────────────────────────┤
│  3. Mark as synced:                                                  │
│     UPDATE inventory_items                                           │
│     SET synced_at = NOW()                                            │
│     WHERE id = 1                                                     │
│                                                                      │
│  4. Return result:                                                   │
│     {                                                                │
│       synced: 1,                                                     │
│       failed: 0,                                                     │
│       tables: ['inventory_items']                                    │
│     }                                                                │
└────────┬────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SYNC MANAGER                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Logs: "[TieredSync] Plugin Inventory synced: 1 records"            │
└─────────────────────────────────────────────────────────────────────┘
```

## Multi-Plugin Sync Timeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                   MULTI-PLUGIN SYNC TIMELINE                          │
└──────────────────────────────────────────────────────────────────────┘

TIME    CORE SYNC           INVENTORY PLUGIN      MENU PLUGIN        PEOPLE PLUGIN
│       (60s interval)      (10min interval)      (10min interval)   (5min interval)
│
0:00    ├─ orders ✅
        ├─ tips ✅
        └─ sales ✅          ├─ inventory sync ✅   ├─ menu sync ✅    ├─ staff sync ✅
│
1:00    ├─ orders ✅
        ├─ tips ✅
        └─ sales ✅
│
2:00    ├─ orders ✅
        ├─ tips ✅
        └─ sales ✅
│
3:00    ├─ orders ✅
        ├─ tips ✅
        └─ sales ✅
│
4:00    ├─ orders ✅
        ├─ tips ✅
        └─ sales ✅
│
5:00    ├─ orders ✅
        ├─ tips ✅
        └─ sales ✅                                                    ├─ staff sync ✅
│
...
│
10:00   ├─ orders ✅
        ├─ tips ✅           ├─ inventory sync ✅   ├─ menu sync ✅    ├─ staff sync ✅
        └─ sales ✅
│

Legend:
  ✅ = Sync completed successfully
  ❌ = Sync failed (doesn't affect other syncs)
```

## Error Handling Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING FLOW                              │
└──────────────────────────────────────────────────────────────────────┘

SCENARIO: Plugin sync fails, core sync continues

TIME    SYNC MANAGER                    RESULT
│
0:00    ├─ Core: orders                ✅ Synced
        ├─ Core: tips                  ✅ Synced
        ├─ Core: sales                 ✅ Synced
        │
        ├─ Plugin: Inventory           ❌ FAILED (Network error)
        │  └─ Error logged              └─> "[Error] Plugin Inventory sync failed: Network error"
        │  └─ Core sync continues       └─> Core unaffected
        │
        ├─ Plugin: Menu                ✅ Synced (continues normally)
        └─ Plugin: People              ✅ Synced (continues normally)
│
1:00    ├─ Core: orders                ✅ Synced (still working)
        ├─ Core: tips                  ✅ Synced
        └─ Core: sales                 ✅ Synced
│
10:00   ├─ Plugin: Inventory           ✅ Synced (retry successful)
        └─ Plugin: Menu                ✅ Synced


KEY POINTS:
  ✓ Plugin failures are isolated
  ✓ Core sync always continues
  ✓ Other plugins unaffected
  ✓ Failed plugin retries on next interval
```

## Plugin Uninstall Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     PLUGIN UNINSTALL FLOW                             │
└──────────────────────────────────────────────────────────────────────┘

USER                PLUGIN MANAGER              PLUGIN                  DATABASE
 │                       │                        │                        │
 │  Uninstall Plugin    │                        │                        │
 ├──────────────────────>│                        │                        │
 │                       │                        │                        │
 │                       │  1. Call onUnload()    │                        │
 │                       │────────────────────────>│                        │
 │                       │                        │                        │
 │                       │                        │  - Unregister sync     │
 │                       │                        │  - Cleanup resources   │
 │                       │                        │  - Remove hooks        │
 │                       │                        │                        │
 │                       │  2. Unregister Sync    │                        │
 │                       │────────────────────────>│                        │
 │                       │                        │                        │
 │                       │  pluginSyncRegistry    │                        │
 │                       │    .unregister(id)     │                        │
 │                       │                        │                        │
 │                       │  3. Stop Sync Interval │                        │
 │                       │<────────────────────────│                        │
 │                       │  ⏸️  Sync stopped       │                        │
 │                       │                        │                        │
 │  Keep data? ◯ Yes    │                        │                        │
 │             ● No     │                        │                        │
 ├──────────────────────>│                        │                        │
 │                       │                        │                        │
 │                       │  4. Drop Tables        │                        │
 │                       │────────────────────────────────────────────────>│
 │                       │                        │                        │
 │                       │                        │  DROP TABLE            │
 │                       │<────────────────────────────────────────────────│
 │                       │                        │                        │
 │                       │  5. Remove Plugin      │                        │
 │                       │────────────────────────>│                        │
 │                       │                        │                        │
 │  ✅ Plugin Removed    │                        │                        │
 │<──────────────────────│                        │                        │
 │                       │                        │                        │
```

## Summary

```
┌──────────────────────────────────────────────────────────────────────┐
│                          KEY TAKEAWAYS                                │
└──────────────────────────────────────────────────────────────────────┘

1. PLUGIN INDEPENDENCE
   ✓ Each plugin manages its own sync
   ✓ Plugins register with central sync manager
   ✓ Failures are isolated

2. CORE STABILITY
   ✓ Core POS sync always runs
   ✓ Core unaffected by plugin errors
   ✓ Plugins can't crash core system

3. FLEXIBILITY
   ✓ Plugins set their own intervals
   ✓ Plugins can check data before syncing
   ✓ Plugins can be enabled/disabled independently

4. SIMPLICITY
   ✓ Plugins register with 1 function call
   ✓ Sync manager handles scheduling
   ✓ No manual interval management needed

5. OBSERVABILITY
   ✓ Clear logs for each sync
   ✓ Per-plugin status tracking
   ✓ Sync metrics available
```

---

**Visual Guide Version**: 1.0
**Date**: 2026-02-06
**Related**: [PLUGIN_SYNC_ARCHITECTURE.md](PLUGIN_SYNC_ARCHITECTURE.md)
