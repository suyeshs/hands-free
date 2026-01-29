# Plugin System - Critical Fixes & Enhancements

## High Priority (Fix Before Launch / Early Adopters)

### 1. Plugin Versioning & Dependency Conflicts

**Problem**: Current design assumes one version per plugin. If two plugins depend on different versions of a shared library (e.g., one needs utils v1.2, another v1.5), conflicts arise.

**Solution**: Bundle all dependencies inside each plugin WASM (fat WASM approach)

#### Updated Manifest Schema

```json
{
  "id": "bar-management",
  "version": "1.0.0",
  "dependencies": [
    {
      "type": "plugin",
      "id": "shared-utils",
      "version": "^1.2.0",
      "optional": false
    },
    {
      "type": "library",
      "name": "serde_json",
      "version": "1.0",
      "bundled": true
    }
  ],
  "compatibility": {
    "conflicts_with": [
      "legacy-bar-system"
    ],
    "requires_plugins": [],
    "incompatible_with": []
  }
}
```

#### Implementation

```typescript
// src/services/plugins/dependencyResolver.ts
export class DependencyResolver {
  async resolvePluginDependencies(
    pluginId: string,
    version: string
  ): Promise<ResolvedDependencies> {
    const manifest = await this.getManifest(pluginId, version);
    const resolved: ResolvedDependency[] = [];

    for (const dep of manifest.dependencies || []) {
      if (dep.type === 'plugin') {
        // Check if compatible version is installed
        const installed = await this.getInstalledVersion(dep.id);

        if (installed && !this.isCompatible(installed, dep.version)) {
          throw new DependencyConflictError(
            `${pluginId} requires ${dep.id}@${dep.version}, but ${installed} is installed`
          );
        }

        if (!installed && !dep.optional) {
          // Auto-install dependency
          resolved.push({
            id: dep.id,
            version: dep.version,
            autoInstall: true
          });
        }
      }
    }

    return { resolved, conflicts: [] };
  }

  isCompatible(installed: string, required: string): boolean {
    // Semantic versioning check
    // ^1.2.0 matches 1.2.0, 1.2.1, 1.3.0 but not 2.0.0
    return semver.satisfies(installed, required);
  }
}
```

#### Conflict Resolution UI

```
┌──────────────────────────────────────────────────────────┐
│  Dependency Conflict                                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Cannot install "Advanced Analytics v2.0.0"              │
│                                                           │
│  Conflict:                                               │
│  • Requires: shared-utils v2.0.0                         │
│  • Installed: shared-utils v1.5.0 (used by Bar Mgmt)    │
│                                                           │
│  Options:                                                │
│  ○ Update shared-utils to v2.0.0 (may break Bar Mgmt)   │
│  ○ Use bundled version (larger download)                │
│  ○ Cancel installation                                   │
│                                                           │
│  [Cancel] [Proceed with Bundled]                        │
└──────────────────────────────────────────────────────────┘
```

**Recommendation**: Use bundled dependencies (fat WASM) for Phase 1 to avoid complexity. Add dependency sharing in Phase 2 if size becomes an issue.

---

### 2. Uninstall / Rollback Safety

**Problem**: Current uninstall removes plugin but doesn't revert settings/data. User uninstalls Bar plugin → bar inventory data orphaned or lost.

**Solution**: Data migration wizard + rollback snapshots

#### Implementation

```typescript
// src/services/plugins/pluginManager.ts
export class PluginManager {
  async uninstall(pluginId: string): Promise<void> {
    const plugin = await this.getInstalledPlugin(pluginId);

    // Check for data dependencies
    const hasData = await this.checkPluginData(pluginId);

    if (hasData) {
      const decision = await this.showDataMigrationDialog(pluginId);

      switch (decision) {
        case 'migrate':
          await this.migratePluginData(pluginId);
          break;
        case 'export':
          await this.exportPluginData(pluginId);
          break;
        case 'delete':
          await this.deletePluginData(pluginId);
          break;
        case 'cancel':
          return;
      }
    }

    // Create rollback snapshot
    await this.createRollbackSnapshot(pluginId);

    // Uninstall plugin
    await this.removePlugin(pluginId);

    // Keep snapshot for 30 days
    this.scheduleSnapshotCleanup(pluginId, 30);
  }

  async checkPluginData(pluginId: string): Promise<boolean> {
    const tables = await this.getPluginTables(pluginId);

    for (const table of tables) {
      const count = await db.select(
        `SELECT COUNT(*) as count FROM ${table}`
      );

      if (count[0].count > 0) return true;
    }

    return false;
  }

  async migratePluginData(pluginId: string): Promise<void> {
    // Example: Migrate bar data to core app
    if (pluginId === 'bar-management') {
      // Create archive table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS bar_inventory_archive (
          id TEXT PRIMARY KEY,
          data JSON,
          archived_at TEXT,
          archived_by TEXT
        )
      `);

      // Archive data
      await db.execute(`
        INSERT INTO bar_inventory_archive (id, data, archived_at)
        SELECT id, json_object(*), datetime('now')
        FROM bar_inventory
      `);

      // Keep bar_inventory table but mark as archived
      await db.execute(`
        UPDATE bar_inventory
        SET status = 'archived', archived_at = datetime('now')
      `);
    }
  }

  async rollback(pluginId: string): Promise<void> {
    const snapshot = await this.getSnapshot(pluginId);

    if (!snapshot) {
      throw new Error('No snapshot available for rollback');
    }

    // Restore plugin
    await this.installFromSnapshot(snapshot);

    // Restore data
    await this.restorePluginData(snapshot);
  }
}
```

#### Uninstall Dialog

```
┌──────────────────────────────────────────────────────────┐
│  Uninstall Bar Management                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ⚠️  This plugin has data:                               │
│  • 143 inventory items                                   │
│  • 27 recipes                                            │
│  • 89 transactions                                       │
│  • 12 closing sessions                                   │
│                                                           │
│  What should we do with this data?                       │
│                                                           │
│  ○ Keep data (archived, read-only)                      │
│    You can reinstall the plugin later                   │
│                                                           │
│  ○ Export to CSV/JSON                                   │
│    Download data for backup                             │
│                                                           │
│  ○ Delete all data                                      │
│    ⚠️  This cannot be undone!                           │
│                                                           │
│  [Cancel] [Proceed]                                      │
└──────────────────────────────────────────────────────────┘
```

#### Rollback UI

```
┌──────────────────────────────────────────────────────────┐
│  Settings → Plugins → Recently Removed                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  🍺 Bar Management                                        │
│  Uninstalled: 3 days ago                                 │
│  Snapshot available until: 27 days                       │
│                                                           │
│  [Rollback] [Delete Snapshot] [Export Data]             │
│                                                           │
│  📦 Aggregator Integration                                │
│  Uninstalled: 15 days ago                                │
│  Snapshot available until: 15 days                       │
│                                                           │
│  [Rollback] [Delete Snapshot]                            │
└──────────────────────────────────────────────────────────┘
```

---

### 3. Offline-First Plugin Updates

**Problem**: Current flow assumes internet for update check/download. Remote restaurants may be offline for days.

**Solution**: Offline update detection + USB/SD card install

#### Implementation

```typescript
// src/services/plugins/updateManager.ts
export class UpdateManager {
  async checkForUpdates(): Promise<PluginUpdate[]> {
    if (!navigator.onLine) {
      // Load last cached update manifest
      return await this.getCachedUpdates();
    }

    const updates: PluginUpdate[] = [];
    const installed = await pluginStore.getState().installed;

    for (const plugin of installed) {
      try {
        const latest = await this.getLatestVersion(plugin.id);

        if (semver.gt(latest.version, plugin.version)) {
          updates.push({
            pluginId: plugin.id,
            currentVersion: plugin.version,
            latestVersion: latest.version,
            size: latest.size,
            releaseNotes: latest.releaseNotes,
            canDownload: navigator.onLine
          });
        }
      } catch (error) {
        // Network error - skip this plugin
        continue;
      }
    }

    // Cache updates for offline access
    await this.cacheUpdates(updates);

    return updates;
  }

  async installFromFile(filePath: string): Promise<void> {
    // Read plugin bundle from USB/SD card
    const bundle = await fs.readFile(filePath);

    // Verify signature
    const signature = await this.extractSignature(bundle);
    const isValid = await this.verifySignature(signature, bundle);

    if (!isValid) {
      throw new Error('Invalid plugin signature');
    }

    // Extract files
    const { manifest, clientWasm, workerWasm } = await this.extractBundle(bundle);

    // Verify checksums
    await this.verifyChecksums(manifest, clientWasm, workerWasm);

    // Install plugin
    await pluginManager.installOffline(manifest, clientWasm, workerWasm);
  }
}
```

#### Offline Update UI

```
┌──────────────────────────────────────────────────────────┐
│  Plugin Updates Available                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  🍺 Bar Management v1.1.0                                │
│  Size: 230 KB | Release: Bug fixes + performance        │
│                                                           │
│  ⚠️  Offline - Update when connected                    │
│  [Download Later] [Install from File]                   │
│                                                           │
│  📦 Aggregator Integration v1.0.6                         │
│  Size: 190 KB | Release: New Zomato selectors           │
│                                                           │
│  ⚠️  Offline - Update when connected                    │
│  [Download Later] [Install from File]                   │
│                                                           │
│  ────────────────────────────────────────────────────    │
│                                                           │
│  💡 Install from USB/SD Card                             │
│  For offline locations, download updates from            │
│  https://plugins.handsfree.com/offline                   │
│                                                           │
│  [Choose File...]                                        │
└──────────────────────────────────────────────────────────┘
```

#### Offline Bundle Format

```
plugin-bundle-bar-management-1.1.0.hfpb (HandsFree Plugin Bundle)
├─ manifest.json
├─ bar-client.wasm
├─ bar-worker.wasm
├─ checksums.json
└─ signature.sig (signed with HandsFree private key)
```

---

### 4. Permission Revocation UX

**Problem**: If user revokes a permission later, plugin should gracefully degrade (not crash).

**Solution**: Permission lifecycle hooks + fallback UI

#### Implementation

```typescript
// src/lib/pluginHost.ts
export function createPluginHostAPI(context: PluginContext): PluginHostAPI {
  const permissionHandlers = new Map<string, PermissionHandler>();

  return {
    db: {
      async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
        // Check permission before execution
        if (!hasPermission(context, 'database.read.*')) {
          // Call revocation handler
          const handler = permissionHandlers.get('database.read.*');
          if (handler) {
            return handler.onPermissionDenied<T[]>('database.read.*', []);
          }

          throw new PermissionDeniedError('database.read permission required');
        }

        const database = await initDb();
        return await database.select<T[]>(sql, params || []);
      },
    },

    // New: Register permission handlers
    onPermissionRevoked(permission: string, handler: PermissionRevokedHandler) {
      permissionHandlers.set(permission, {
        onPermissionDenied: handler
      });
    },

    // New: Request permission at runtime
    async requestPermission(permission: string): Promise<boolean> {
      return await showPermissionDialog(context.pluginId, permission);
    },
  };
}

// Plugin can register handlers
export function initPlugin(host: PluginHostAPI) {
  // Graceful degradation
  host.onPermissionRevoked('database.read.bar_inventory', (permission, fallback) => {
    console.warn(`[Bar Plugin] Permission ${permission} revoked`);

    // Return empty data instead of crashing
    return fallback || [];
  });

  // Show fallback UI
  host.events.on('permission.revoked', (data) => {
    if (data.permission === 'database.read.bar_inventory') {
      showFallbackUI('Bar inventory access is disabled');
    }
  });
}
```

#### Permission Revocation Dialog

```
┌──────────────────────────────────────────────────────────┐
│  Manage Plugin Permissions                               │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  🍺 Bar Management                                        │
│                                                           │
│  Permissions:                                            │
│  ✓ Read bar inventory                   [Revoke]        │
│  ✓ Write bar transactions               [Revoke]        │
│  ✓ Subscribe to order events            [Revoke]        │
│                                                           │
│  ⚠️  Revoking permissions may break plugin features     │
└──────────────────────────────────────────────────────────┘
```

#### Plugin Fallback UI

```typescript
// src/pages-v2/BarDashboard.tsx
function BarDashboard() {
  const { instance, error } = useWasm('bar-management');

  if (error instanceof PermissionDeniedError) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h3 className="font-bold text-yellow-900">
            Bar Inventory Access Disabled
          </h3>
          <p className="text-yellow-800 mt-2">
            The Bar Management plugin needs permission to read inventory data.
          </p>
          <button
            onClick={() => requestPermission('database.read.bar_inventory')}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded"
          >
            Re-enable Permission
          </button>
        </div>
      </div>
    );
  }

  // Normal UI
  return <div>...</div>;
}
```

---

## Medium Priority (Nice-to-Have Before Scale)

### 5. Plugin Ratings / Reviews / Trust Signals

#### Implementation

```typescript
// Worker API endpoint
export async function getPluginRating(pluginId: string): Promise<PluginRating> {
  const sql = `
    SELECT
      AVG(rating) as avg_rating,
      COUNT(*) as review_count,
      COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
      COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
      COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
      COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
      COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
    FROM plugin_reviews
    WHERE plugin_id = ?
  `;

  const result = await db.query(sql, [pluginId]);
  return result[0];
}

export async function submitReview(
  pluginId: string,
  tenantId: string,
  rating: number,
  comment: string
): Promise<void> {
  await db.execute(`
    INSERT INTO plugin_reviews (
      plugin_id, tenant_id, rating, comment, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `, [pluginId, tenantId, rating, comment, new Date().toISOString()]);
}
```

#### Updated Plugin Card UI

```
┌────────────────────────────────────────────────────────┐
│  🍺 Bar Management                             v1.1.2  │
│  ✅ Active                                             │
│  Verified by Guanix • 4.8 ★★★★★ (217 reviews)        │
│                                                         │
│  Inventory tracking, recipe costing, closing reports   │
│                                                         │
│  Client WASM: 142 KB (cached) | Worker WASM: 78 KB    │
│  Last updated: 2 days ago • 1,543 installs            │
│                                                         │
│  [⚙️ Configure] [🔄 Update] [⭐ Rate] [ℹ️ Info]       │
└────────────────────────────────────────────────────────┘
```

#### Review Dialog

```
┌──────────────────────────────────────────────────────────┐
│  Rate Bar Management                                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  How would you rate this plugin?                         │
│                                                           │
│  ☆ ☆ ☆ ☆ ☆  (Click to rate)                             │
│                                                           │
│  Share your experience (optional):                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Great plugin! Saves time on closing reports...  │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  [Skip] [Submit Review]                                  │
└──────────────────────────────────────────────────────────┘
```

---

### 6. Plugin Analytics (for HandsFree)

#### Implementation

```typescript
// Track plugin lifecycle events
export class PluginAnalytics {
  async trackInstall(pluginId: string, tenantId: string, version: string) {
    await this.sendEvent({
      event: 'plugin.installed',
      pluginId,
      tenantId,
      version,
      timestamp: Date.now(),
      appVersion: getAppVersion(),
      platform: getPlatform()
    });
  }

  async trackUninstall(pluginId: string, tenantId: string, reason?: string) {
    await this.sendEvent({
      event: 'plugin.uninstalled',
      pluginId,
      tenantId,
      reason,
      timestamp: Date.now()
    });
  }

  async trackError(pluginId: string, error: Error) {
    await this.sendEvent({
      event: 'plugin.error',
      pluginId,
      error: {
        message: error.message,
        stack: error.stack
      },
      timestamp: Date.now()
    });
  }

  async trackUsage(pluginId: string, functionName: string, duration: number) {
    // Batch usage events to reduce network calls
    this.usageBuffer.push({
      event: 'plugin.usage',
      pluginId,
      functionName,
      duration,
      timestamp: Date.now()
    });

    if (this.usageBuffer.length >= 50) {
      await this.flushUsageBuffer();
    }
  }
}
```

#### Analytics Dashboard (Internal)

```
Plugin Analytics Dashboard
──────────────────────────────────────────────────────────

Top Plugins by Installs (Last 30 Days)
1. Bar Management         1,543 installs  (+23%)
2. Aggregator Integration   892 installs  (+45%)
3. Multi-location           234 installs  (+12%)

Plugin Health
──────────────────────────────────────────────────────────
Bar Management         98.7% uptime   2 errors (last 7d)
Aggregator Integration 97.2% uptime  15 errors (last 7d)

Most Used Functions (Bar Management)
1. calculate_pour_cost      23,451 calls/day
2. calculate_variance        8,234 calls/day
3. check_availability        5,678 calls/day

Uninstall Reasons
──────────────────────────────────────────────────────────
"Too complex"           12%
"Performance issues"     8%
"Missing features"      15%
"Switched to competitor" 5%
"No reason provided"    60%
```

---

### 7. Dark Mode & Theme Consistency

#### Implementation

```typescript
// src/lib/pluginHost.ts
export function createPluginHostAPI(context: PluginContext): PluginHostAPI {
  return {
    // ... other APIs

    theme: {
      getTheme(): Theme {
        return {
          mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          colors: {
            background: 'var(--color-background)',
            foreground: 'var(--color-foreground)',
            primary: 'var(--color-primary)',
            secondary: 'var(--color-secondary)',
            accent: 'var(--color-accent)',
            border: 'var(--color-border)',
          },
          fonts: {
            sans: 'var(--font-sans)',
            mono: 'var(--font-mono)',
          },
        };
      },

      onThemeChange(callback: (theme: Theme) => void) {
        // Listen for theme changes
        const observer = new MutationObserver(() => {
          callback(this.getTheme());
        });

        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class']
        });

        return () => observer.disconnect();
      },
    },
  };
}
```

#### Plugin Usage

```typescript
// Plugin can adapt to theme
function BarDashboardPlugin() {
  const theme = pluginHost.theme.getTheme();

  return (
    <div style={{
      backgroundColor: theme.colors.background,
      color: theme.colors.foreground,
    }}>
      <h1 style={{ color: theme.colors.primary }}>
        Bar Dashboard
      </h1>
    </div>
  );
}
```

---

### 8. Search & Discoverability

#### Implementation

```typescript
// src/stores/pluginStore.ts
export const usePluginStore = create<PluginStore>((set, get) => ({
  searchPlugins: async (query: string, filters: PluginFilters) => {
    const all = await pluginRegistry.getAllPlugins();

    let results = all;

    // Text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.tags.some(t => t.toLowerCase().includes(lowerQuery))
      );
    }

    // Category filter
    if (filters.category) {
      results = results.filter(p => p.category === filters.category);
    }

    // Rating filter
    if (filters.minRating) {
      results = results.filter(p => p.rating >= filters.minRating);
    }

    // Sort
    if (filters.sortBy === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    } else if (filters.sortBy === 'installs') {
      results.sort((a, b) => b.installs - a.installs);
    } else if (filters.sortBy === 'updated') {
      results.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return results;
  },
}));
```

#### Search UI

```
┌────────────────────────────────────────────────────────────────┐
│  Plugin Store                                          [⚙️ 🔔]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔍 Search plugins...                           [🔽 Filters]   │
│                                                                 │
│  Categories:                                                    │
│  [ All ] [ Bar ] [ Analytics ] [ Payments ] [ Inventory ]      │
│  [ Reports ] [ Integrations ] [ Regional ]                     │
│                                                                 │
│  Sort by: [ Most Popular ▼ ]   Show: [ All Plugins ▼ ]       │
│                                                                 │
│  ──────────────────────────────────────────────────────────    │
│                                                                 │
│  🍺 Bar Management                     4.8 ★ • 1.5K installs   │
│  Inventory tracking, recipe costing, closing reports           │
│  #bar #inventory #reports                                      │
│  [Install]                                                     │
│                                                                 │
│  📦 Aggregator Integration            4.6 ★ • 892 installs    │
│  Swiggy & Zomato automation (India only)                      │
│  #aggregator #india #delivery                                  │
│  [Install]                                                     │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Timeline

### Phase 1 (Pre-Launch) - Week 1-2
- ✅ Plugin versioning & dependency resolution
- ✅ Uninstall safety (data migration wizard)
- ✅ Offline update detection
- ✅ Permission revocation UX

### Phase 2 (Early Adopters) - Week 3-4
- ✅ Plugin ratings & reviews
- ✅ Basic analytics (installs, errors)
- ✅ Dark mode support
- ✅ Search & categories

### Phase 3 (Scale) - Month 2-3
- Auto A/B testing
- Advanced analytics
- Plugin marketplace revenue share
- No-code plugin builder

---

## Updated Manifest Schema (v2)

```json
{
  "id": "bar-management",
  "name": "Bar Management",
  "version": "1.1.2",
  "description": "Inventory tracking, recipe costing, closing reports",
  "author": "HandsFree POS Team",
  "homepage": "https://plugins.handsfree.com/bar-management",
  "icon": "🍺",
  "category": "bar",
  "tags": ["bar", "inventory", "reports", "closing"],

  "type": "hybrid",
  "visibility": "public",
  "verified": true,

  "target": {
    "client": true,
    "worker": true
  },

  "requires_app_version": ">=3.0.0",
  "requires_worker_version": ">=1.0.0",

  "requires_permissions": [
    "database.read.bar_inventory",
    "database.write.bar_transactions",
    "events.subscribe.order.completed"
  ],

  "dependencies": [
    {
      "type": "plugin",
      "id": "shared-utils",
      "version": "^1.2.0",
      "optional": false
    }
  ],

  "compatibility": {
    "conflicts_with": ["legacy-bar-system"],
    "requires_plugins": [],
    "incompatible_with": []
  },

  "data": {
    "tables": ["bar_inventory", "bar_recipes", "bar_transactions"],
    "migration_required": true,
    "uninstall_strategy": "archive"
  },

  "analytics": {
    "enabled": true,
    "events": ["install", "uninstall", "error", "usage"]
  },

  "frontend": {
    "wasm": "bar-client.wasm",
    "entry_point": "init",
    "routes": [...],
    "menu_items": [...],
    "theme_aware": true
  },

  "backend": {
    "wasm": "bar-worker.wasm",
    "entry_point": "init",
    "endpoints": [...],
    "event_handlers": [...]
  },

  "checksum": "sha256:abc123...",
  "signature": "sha256:def456...",
  "created_at": "2026-01-20T00:00:00Z",
  "updated_at": "2026-01-29T00:00:00Z",

  "release_notes": "Bug fixes and performance improvements",
  "changelog_url": "https://plugins.handsfree.com/bar-management/changelog"
}
```

---

## Summary

### Critical Fixes (Launch Blockers)
1. ✅ **Dependency Resolution**: Fat WASM approach (bundle deps)
2. ✅ **Uninstall Safety**: Data migration wizard + 30-day snapshots
3. ✅ **Offline Updates**: USB/SD card install + cached update checks
4. ✅ **Permission Revocation**: Lifecycle hooks + fallback UI

### Enhanced UX (Before Scale)
5. ✅ **Ratings & Reviews**: 5-star system + verified badges
6. ✅ **Analytics**: Track installs, errors, usage (opt-in)
7. ✅ **Dark Mode**: Theme API for plugins
8. ✅ **Search**: Categories, tags, filters, sort

### Result
With these fixes, the plugin system becomes **production-ready** and **best-in-class** for restaurant POS in 2026! 🚀

The system now handles:
- ✅ Complex dependency scenarios
- ✅ Safe uninstall/rollback
- ✅ Offline-first updates
- ✅ Graceful permission handling
- ✅ Trust signals (ratings, reviews)
- ✅ Developer insights (analytics)
- ✅ Consistent theming
- ✅ Easy discovery
