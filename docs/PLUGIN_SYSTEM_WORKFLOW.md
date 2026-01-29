# Plugin System - Settings UI & Workflows

## Settings UI Changes

### Before (Current)
```
┌─────────────────────────────────────┐
│         Settings                     │
├─────────────────────────────────────┤
│  General                             │
│  Restaurant Info                     │
│  Tax Settings                        │
│  Receipt Settings                    │
│  User Management                     │
│  Sync Settings                       │
└─────────────────────────────────────┘
```

### After (With Plugins)
```
┌─────────────────────────────────────────────────────┐
│              Settings                                │
├─────────────────────────────────────────────────────┤
│  General                                             │
│  Restaurant Info                                     │
│  Tax Settings                                        │
│  Receipt Settings                                    │
│  User Management                                     │
│  Sync Settings                                       │
│  ┌─────────────────────────────────────────┐       │
│  │  🔌 Plugins & Extensions          [NEW] │       │
│  │                                          │       │
│  │  Installed Plugins (2)                  │       │
│  │  ├─ Bar Management          [Active] ⚙️ │       │
│  │  └─ Aggregator Integration  [Active] ⚙️ │       │
│  │                                          │       │
│  │  [Browse Plugin Store] [Upload Custom]  │       │
│  └─────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

### New Plugin Management Page
```
┌────────────────────────────────────────────────────────────────┐
│  Plugins & Extensions                                   [⚙️ ⬇️] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Installed   │  │ Available    │  │ Custom       │         │
│  └─────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  🍺 Bar Management                                     v1.0.0  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ ✅ Active                                              │   │
│  │                                                         │   │
│  │ Inventory tracking, recipe costing, closing reports    │   │
│  │                                                         │   │
│  │ Client WASM: 150KB (cached) | Worker WASM: 80KB       │   │
│  │ Last updated: 2026-01-29                               │   │
│  │                                                         │   │
│  │ [⚙️ Configure] [🔄 Update] [❌ Uninstall] [ℹ️ Info]   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📦 Aggregator Integration                             v1.0.0  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ ✅ Active (Regional: India only)                       │   │
│  │                                                         │   │
│  │ Swiggy & Zomato order processing and automation       │   │
│  │                                                         │   │
│  │ Client WASM: 120KB (cached) | Worker WASM: 70KB       │   │
│  │ Last updated: 2026-01-29                               │   │
│  │                                                         │   │
│  │ [⚙️ Configure] [🔄 Update] [❌ Uninstall] [ℹ️ Info]   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  💡 Available Plugins (Browse Store)                           │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ 🏢 Multi-location Management              [Install] ➕  │   │
│  │ 💳 Payment Gateway - Razorpay             [Install] ➕  │   │
│  │ 📊 Advanced Analytics                     [Install] ➕  │   │
│  │ 🎁 Loyalty Program                        [Install] ➕  │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## Complete Plugin System Workflows

### 1. Plugin Discovery & Installation Flow

```
┌─────────────┐
│   USER      │
│ Opens POS   │
│   Settings  │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────┐
│  Settings Page                   │
│  Click "Plugins & Extensions"    │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Plugin Store UI                                     │
│  - Shows installed plugins                           │
│  - Shows available plugins from registry             │
│  - Search and filter options                         │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  User clicks "Install" on        │
│  "Bar Management" plugin         │
└──────┬───────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Plugin Manager (pluginManager.ts)                  │
│  1. Check compatibility (app version, permissions)  │
│  2. Show permission consent dialog                  │
└──────┬──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│  Permission Consent Dialog                       │
│                                                   │
│  Bar Management requires:                        │
│  ✓ Read bar inventory                           │
│  ✓ Write bar transactions                       │
│  ✓ Subscribe to order.completed events          │
│                                                   │
│  [Cancel] [Allow]                                │
└──────┬───────────────────────────────────────────┘
       │ User clicks "Allow"
       ▼
┌──────────────────────────────────────────────────┐
│  Download & Cache (pluginManager.ts)             │
│  1. Resolve plugin (tenant → global registry)    │
│  2. Fetch manifest.json from R2                  │
│  3. Fetch bar-client.wasm from R2                │
│  4. Verify checksum (security)                   │
│  5. Store in SQLite (base64 encoded)             │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│  Worker Plugin Deployment (Background)           │
│  1. Worker detects new plugin in registry        │
│  2. Downloads bar-worker.wasm                    │
│  3. Compiles WASM module                         │
│  4. Registers API routes                         │
│     /api/plugin/bar-management/{tenantId}/*      │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│  Installation Complete                           │
│  - Plugin marked as "Installed" in pluginStore   │
│  - UI shows "Active" badge                       │
│  - Bar menu items appear in sidebar              │
│  - Bar routes registered                         │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  User navigates to /bar          │
│  Plugin automatically loads      │
└──────────────────────────────────┘
```

---

### 2. Plugin Usage Flow (Bar Management Example)

```
┌─────────────────────────────────────────────────────┐
│  User opens Bar Dashboard (/bar)                    │
└──────┬──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  BarDashboard.tsx Component Renders                  │
│  - Calls useWasm('bar-management')                   │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  useWasm Hook (hooks/useWasm.ts)                     │
│  1. Check if plugin is loaded in pluginStore         │
│  2. If not, call pluginManager.loadWasm()            │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Plugin Manager loads WASM                           │
│  1. Read from SQLite cache (base64 → ArrayBuffer)   │
│  2. Compile WebAssembly module                       │
│  3. Instantiate with pluginHostAPI bindings          │
│  4. Call init() function                             │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  WASM Plugin Loaded ✅                                │
│  - instance.exports available                        │
│  - Functions ready to call                           │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  USER ACTION: Calculate pour cost for "Mojito"              │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Component calls:                                             │
│  const result = await invoke('calculate_pour_cost',          │
│    JSON.stringify(recipe), JSON.stringify(items))            │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  CLIENT WASM Executes (Instant, Offline)                     │
│  1. Parse recipe and items                                   │
│  2. Calculate cost per ml for each ingredient                │
│  3. Sum total cost                                           │
│  4. Return JSON result                                       │
│  Time: <1ms                                                  │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Result displayed in UI                                       │
│  - Pour cost: ₹45.50                                         │
│  - Ingredient breakdown shown                                │
│  - No network request needed!                                │
└──────────────────────────────────────────────────────────────┘

       ┌──────────────────────────────────────────────────┐
       │  ALTERNATIVE: Heavy Operation (Closing Report)    │
       └──────┬───────────────────────────────────────────┘
              │
              ▼
       ┌──────────────────────────────────────────────────┐
       │  Call Worker API                                  │
       │  POST /api/plugin/bar-management/tenant-123/      │
       │       finalize-session                            │
       └──────┬───────────────────────────────────────────┘
              │
              ▼
       ┌──────────────────────────────────────────────────┐
       │  WORKER WASM Executes (Cloudflare)               │
       │  1. Query D1 for all closing counts              │
       │  2. Query D1 for waste transactions              │
       │  3. Calculate totals and variance                │
       │  4. Update closing session                       │
       │  Time: ~50-200ms                                 │
       └──────┬───────────────────────────────────────────┘
              │
              ▼
       ┌──────────────────────────────────────────────────┐
       │  Result returned to UI                            │
       │  - Total variance: ₹450                          │
       │  - Items counted: 15                             │
       │  - Session closed                                │
       └──────────────────────────────────────────────────┘
```

---

### 3. Plugin Update Flow

```
┌─────────────────────────────────────────────────────┐
│  Background: Worker checks for updates daily        │
│  - Compare installed version with registry          │
└──────┬──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  New version detected: bar-management v1.1.0         │
│  - Installed: v1.0.0                                 │
│  - Available: v1.1.0                                 │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Show notification in Settings                       │
│  "Bar Management v1.1.0 available - Bug fixes"      │
│  [Update Now]                                        │
└──────┬───────────────────────────────────────────────┘
       │ User clicks "Update Now"
       ▼
┌──────────────────────────────────────────────────────┐
│  Download new version                                │
│  1. Fetch new manifest.json                          │
│  2. Fetch new bar-client.wasm                        │
│  3. Fetch new bar-worker.wasm                        │
│  4. Verify checksums                                 │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Update SQLite cache                                 │
│  - Replace old WASM with new                         │
│  - Update manifest                                   │
│  - Mark as synced                                    │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Worker updates (automatic)                          │
│  - Loads new bar-worker.wasm                         │
│  - Replaces routes seamlessly                        │
│  - No downtime (hot reload)                          │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Next time Bar Dashboard loads:                      │
│  - Uses new v1.1.0 client WASM                       │
│  - No app rebuild needed!                            │
│  - User sees improvements immediately                │
└──────────────────────────────────────────────────────┘
```

---

### 4. Migration Flow (Built-in → Plugin)

```
┌─────────────────────────────────────────────────────┐
│  CURRENT STATE: Built-in Bar Code                   │
│  - barClosingService.ts (180 LOC)                   │
│  - barRecipeService.ts (317 LOC)                    │
│  - Part of main app bundle                          │
└──────┬──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  App Update Released (v3.2.0)                        │
│  - Contains plugin system                            │
│  - Old code still present (backward compatible)      │
│  - Feature flag: USE_BAR_PLUGIN = false              │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  User updates POS app to v3.2.0                      │
│  - Plugin system available                           │
│  - Bar still uses built-in code                      │
│  - No breaking changes                               │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Migration Prompt (First Launch)                     │
│                                                       │
│  "Bar Management Plugin Available!"                  │
│                                                       │
│  Benefits:                                           │
│  ✓ Get updates without app rebuilds                 │
│  ✓ Better performance (WASM)                        │
│  ✓ Offline-capable calculations                     │
│                                                       │
│  [Keep Built-in] [Install Plugin]                   │
└──────┬───────────────────────────────────────────────┘
       │ User clicks "Install Plugin"
       ▼
┌──────────────────────────────────────────────────────┐
│  Auto-install bar-management plugin                  │
│  - Downloads WASM files                              │
│  - Migrates settings (if any)                        │
│  - Runs parallel for 1 day (testing)                │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  PARALLEL MODE (24 hours)                            │
│  - Both systems run simultaneously                   │
│  - Results compared automatically                    │
│  - Any mismatch logged                               │
│  - Built-in used, plugin tested                      │
└──────┬───────────────────────────────────────────────┘
       │ After 24 hours
       ▼
┌──────────────────────────────────────────────────────┐
│  Switch to Plugin                                    │
│  - Feature flag: USE_BAR_PLUGIN = true               │
│  - Plugin becomes primary                            │
│  - Built-in code = fallback (if plugin fails)        │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  FUTURE UPDATE: v3.3.0 (2 months later)              │
│  - Built-in bar code REMOVED                         │
│  - App size reduced by ~5MB                          │
│  - Plugin is mandatory                               │
│  - 100% plugin-based                                 │
└──────────────────────────────────────────────────────┘
```

---

### 5. Cross-Repository Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE R2 + KV                          │
│                    Plugin Registry                             │
│                                                                │
│  Global Registry:                                              │
│  /global/plugins/bar-management/1.0.0/                        │
│    ├─ manifest.json                                           │
│    ├─ bar-client.wasm                                         │
│    └─ bar-worker.wasm                                         │
│                                                                │
│  Per-Tenant Registry:                                         │
│  /tenants/restaurant-xyz/plugins/custom-bar/1.0.0/           │
│    ├─ manifest.json                                           │
│    ├─ custom-bar-client.wasm                                  │
│    └─ custom-bar-worker.wasm                                  │
└────────────────┬──────────────────────┬──────────────────────┘
                 │                      │
                 │                      │
    ┌────────────▼────────┐  ┌─────────▼──────────────────────┐
    │  POS APP REPO       │  │  PLATFORM BACKEND REPO         │
    │  restaurant-pos-ai  │  │  handsfree-restaurant-new      │
    │                     │  │                                │
    │  Client Plugin Mgr  │  │  Worker Plugin Loader          │
    │  ├─ pluginManager   │  │  ├─ pluginLoader.ts            │
    │  ├─ pluginHost      │  │  ├─ pluginHost.ts              │
    │  ├─ useWasm hook    │  │  └─ routes setup               │
    │  └─ pluginStore     │  │                                │
    │                     │  │  Worker Routes:                │
    │  Downloads:         │  │  /api/plugin/{id}/{tenant}/*   │
    │  - bar-client.wasm  │  │                                │
    │  Cache: SQLite      │  │  Downloads:                    │
    │                     │  │  - bar-worker.wasm             │
    │  Execution:         │  │  Cache: Memory                 │
    │  - Browser WASM     │  │                                │
    │                     │  │  Execution:                    │
    │                     │  │  - Cloudflare Workers WASM     │
    └─────────────────────┘  └────────────────────────────────┘
```

---

## Key User Experiences

### Scenario 1: Restaurant Owner Discovers Plugin
```
1. Opens Settings → "What's New?" badge on "Plugins"
2. Sees "Bar Management" plugin recommended
3. Reads description: "Track bar inventory, recipe costs, closing reports"
4. Clicks "Install" → Permission dialog → Accepts
5. 5 seconds later: "Bar Dashboard" appears in sidebar
6. Opens bar dashboard → Everything works seamlessly
7. No app restart needed!
```

### Scenario 2: Swiggy Changes Dashboard UI
```
1. Swiggy updates their dashboard (new button selectors)
2. Aggregator plugin stops working (can't find buttons)
3. HandsFree team updates selectors in KV (via Worker API)
4. 5 minutes later: All restaurants get new selectors
5. Aggregator plugin works again
6. No app update needed!
```

### Scenario 3: Custom Plugin for Enterprise
```
1. Enterprise client needs custom bar logic (special pricing rules)
2. HandsFree team creates custom-bar plugin
3. Uploads to tenant-specific registry
4. Only that tenant sees "Custom Bar Management" in plugins
5. They install it → Overrides global bar plugin
6. Custom logic runs, other restaurants unaffected
```

---

## Security & Permissions

```
┌──────────────────────────────────────────────────────┐
│  Permission System                                    │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Plugin declares in manifest.json:                   │
│  {                                                    │
│    "requires_permissions": [                         │
│      "database.read.bar_inventory",                  │
│      "database.write.bar_transactions",              │
│      "events.subscribe.order.completed"              │
│    ]                                                  │
│  }                                                    │
│                                                       │
│  User sees at install time:                          │
│  "Bar Management needs permission to:"               │
│  ✓ Read your bar inventory                          │
│  ✓ Record bar transactions                          │
│  ✓ Monitor when orders are completed                │
│                                                       │
│  Plugin Host enforces at runtime:                    │
│  if (!hasPermission(context, "database.read.bar_*")) │
│    throw new Error("Permission denied")              │
│                                                       │
│  WASM Sandbox:                                       │
│  - No direct file system access                     │
│  - No direct network access                         │
│  - All interactions via pluginHost API              │
└──────────────────────────────────────────────────────┘
```

---

## Performance Comparison

```
┌────────────────────────────────────────────────────────────┐
│  Operation: Calculate Pour Cost for 10 Drinks              │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Built-in JavaScript:                                      │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐     │
│  │ 2ms│ 2ms│ 2ms│ 2ms│ 2ms│ 2ms│ 2ms│ 2ms│ 2ms│ 2ms│     │
│  └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘     │
│  Total: 20ms                                               │
│                                                             │
│  Plugin WASM:                                              │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐                         │
│  │1 │1 │1 │1 │1 │1 │1 │1 │1 │1 │                         │
│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘                         │
│  Total: 10ms (2x faster)                                   │
│                                                             │
│  First Load:                                               │
│  - Built-in: 0ms (already in bundle)                      │
│  - Plugin: 50ms (load from SQLite) → cached thereafter   │
└────────────────────────────────────────────────────────────┘
```

---

## Summary

### For Users:
✅ **Simpler**: New "Plugins" section in Settings
✅ **Faster**: Get new features without updating app
✅ **Customizable**: Install only what you need
✅ **Regional**: India restaurants get Swiggy/Zomato plugin automatically

### For Developers:
✅ **No Rebuilds**: Update bar logic → deploy WASM → live in 5 minutes
✅ **A/B Testing**: Different tenants can test different plugin versions
✅ **Isolated**: Bug in plugin doesn't crash app
✅ **Scalable**: Worker WASM handles heavy operations on Cloudflare's edge

### For Business:
✅ **Smaller App**: ~50% size reduction after migration (faster downloads)
✅ **Faster Updates**: Critical fixes deployed in minutes, not days
✅ **Monetization**: Premium plugins, marketplace commissions
✅ **Enterprise**: Custom plugins for large clients
