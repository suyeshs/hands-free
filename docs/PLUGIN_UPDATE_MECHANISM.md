# Plugin Update Mechanism

## Overview

The plugin system uses R2 storage to distribute plugins and detect updates automatically.

## Architecture

```
Client App
    ↓
Check for Updates (on startup / manual)
    ↓
Fetch: https://r2.handsfree.com/plugins/{id}/latest/manifest.json
    ↓
Compare: installed.version vs latest.version
    ↓
Show Update Badge / Notification
    ↓
User clicks "Update"
    ↓
Download & Install
```

---

## R2 Storage Structure

```
handsfree-plugins/
├── global/
│   └── plugins/
│       ├── recamera/
│       │   ├── 1.0.0/
│       │   │   ├── manifest.json
│       │   │   └── README.md
│       │   └── latest/
│       │       └── manifest.json (→ points to 1.0.0)
│       │
│       ├── multi-location/
│       │   ├── 2.1.0/
│       │   │   └── manifest.json
│       │   └── latest/
│       │       └── manifest.json (→ points to 2.1.0)
│       │
│       └── vision-ai/
│           ├── 1.0.0/
│           │   ├── manifest.json
│           │   └── vision-client.wasm
│           └── latest/
│               └── manifest.json
```

---

## Implementation

### 1. Plugin Registry Service

```typescript
// src/services/pluginRegistry.ts

export interface PluginUpdate {
  id: string;
  name: string;
  currentVersion: string;
  latestVersion: string;
  changelog?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

const R2_BASE = 'https://r2.handsfree.com';

/**
 * Fetch latest plugin manifest from R2
 */
export async function fetchLatestManifest(pluginId: string) {
  const url = `${R2_BASE}/plugins/${pluginId}/latest/manifest.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Plugin ${pluginId} not found`);
  return response.json();
}

/**
 * Check for updates for all installed plugins
 */
export async function checkForUpdates(): Promise<PluginUpdate[]> {
  const db = await Database.load('sqlite:handsfree.db');

  // Get installed plugins
  const installed = await db.select<Array<{
    plugin_id: string;
    version: string;
    name: string;
  }>>(`
    SELECT plugin_id, version, name
    FROM plugin_installed
    WHERE enabled = 1
  `);

  const updates: PluginUpdate[] = [];

  for (const plugin of installed) {
    try {
      const latest = await fetchLatestManifest(plugin.plugin_id);

      if (compareVersions(latest.version, plugin.version) > 0) {
        updates.push({
          id: plugin.plugin_id,
          name: plugin.name,
          currentVersion: plugin.version,
          latestVersion: latest.version,
          changelog: latest.changelog,
          urgency: determineUrgency(latest)
        });
      }
    } catch (error) {
      console.error(`Failed to check updates for ${plugin.plugin_id}:`, error);
    }
  }

  return updates;
}

/**
 * Compare semantic versions
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}

/**
 * Determine update urgency based on version jump
 */
function determineUrgency(manifest: any): 'low' | 'medium' | 'high' | 'critical' {
  if (manifest.security_patch) return 'critical';
  if (manifest.breaking_changes) return 'high';
  if (manifest.new_features) return 'medium';
  return 'low';
}
```

### 2. Update Notification Component

```typescript
// src/components/plugins/UpdateNotification.tsx

export function UpdateNotification() {
  const [updates, setUpdates] = useState<PluginUpdate[]>([]);

  useEffect(() => {
    // Check for updates on mount and every hour
    const check = async () => {
      const available = await checkForUpdates();
      setUpdates(available);
    };

    check();
    const interval = setInterval(check, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, []);

  if (updates.length === 0) return null;

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <Download className="w-5 h-5 text-blue-400" />
        <div>
          <h3 className="font-bold text-white">
            {updates.length} Plugin Update{updates.length > 1 ? 's' : ''} Available
          </h3>
          <p className="text-sm text-gray-400">
            {updates.map(u => u.name).join(', ')}
          </p>
        </div>
        <button
          onClick={() => navigate('/settings/plugins')}
          className="ml-auto bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
        >
          Update Now
        </button>
      </div>
    </div>
  );
}
```

### 3. Plugin Update Process

```typescript
// src/services/pluginManager.ts

/**
 * Update a plugin to latest version
 */
export async function updatePlugin(pluginId: string): Promise<void> {
  const db = await Database.load('sqlite:handsfree.db');

  // 1. Fetch latest manifest
  const manifest = await fetchLatestManifest(pluginId);

  // 2. Check if migration needed
  const currentVersion = await db.select<Array<{ version: string }>>(
    `SELECT version FROM plugin_installed WHERE plugin_id = ?`,
    [pluginId]
  );

  // 3. Run migration if specified
  if (manifest.migration?.from.includes(currentVersion[0].version)) {
    await runMigration(pluginId, currentVersion[0].version, manifest.version);
  }

  // 4. Update plugin_installed table
  await db.execute(
    `UPDATE plugin_installed
     SET version = ?, updated_at = ?
     WHERE plugin_id = ?`,
    [manifest.version, Date.now(), pluginId]
  );

  // 5. Download WASM if needed
  if (manifest.frontend?.wasm) {
    await downloadWasm(pluginId, manifest.version, manifest.frontend.wasm);
  }

  // 6. Reload plugin
  await reloadPlugin(pluginId);

  console.log(`✅ Updated ${pluginId} to v${manifest.version}`);
}
```

---

## Update Triggers

### Automatic Checks
1. **On app startup** - Check within 5 seconds
2. **Every hour** - Background check while app running
3. **On Plugin Store open** - Fresh check when user browses

### Manual Checks
1. **Settings → Plugins → "Check for Updates" button**
2. **Individual plugin → "Update" button**

---

## Update Badge Display

```typescript
// Show badge count
if (updates.length > 0) {
  <Badge count={updates.length} color="blue" />
}

// Urgency colors
const urgencyColor = {
  low: 'blue',      // Nice to have
  medium: 'yellow', // New features
  high: 'orange',   // Breaking changes
  critical: 'red'   // Security patch
};
```

---

## Migration Support

Plugins can specify migration paths:

```json
{
  "version": "2.1.0",
  "migration": {
    "from": ["1.8.0", "2.0.0"],
    "automatic": true,
    "requires_restart": false,
    "migration_script": "/migrations/2.1.0.sql"
  }
}
```

When updating, the system:
1. Detects source version
2. Runs migration script if present
3. Updates database schema
4. Reloads plugin

---

## Security

### Checksum Verification
```typescript
// Verify plugin integrity
const downloaded = await fetch(manifestUrl).then(r => r.text());
const checksum = await sha256(downloaded);

if (checksum !== manifest.checksum) {
  throw new Error('Checksum mismatch - potential tampering');
}
```

### Version Pinning
Users can pin plugins to specific versions:
```sql
UPDATE plugin_installed
SET version_pinned = '2.0.0', auto_update = 0
WHERE plugin_id = 'multi-location';
```

---

## Testing Updates

### Local Testing
```bash
# 1. Upload new version
./plugins/upload-plugin-manifest.sh recamera

# 2. Manually bump version in local DB
sqlite3 handsfree.db "UPDATE plugin_installed SET version = '0.9.0' WHERE plugin_id = 'recamera'"

# 3. Check for updates in app
# Should detect 1.0.0 > 0.9.0

# 4. Click "Update"
# Should download and apply
```

---

## Current Status

### ✅ Implemented
- R2 storage structure
- Versioned manifests
- Latest alias

### 🔄 To Implement
- `checkForUpdates()` service
- Update notification component
- Plugin update UI
- Migration runner
- Checksum verification

### 📋 Next Steps
1. Create plugin registry service
2. Add update check on startup
3. Add "Check for Updates" button
4. Show update badges in Plugin Store
5. Implement one-click update flow

---

## Example: Complete Update Flow

```
[App Startup]
    ↓
checkForUpdates()
    ↓
Found: recamera 1.0.0 → 1.1.0
       multi-location 2.1.0 → 2.2.0
    ↓
[Show notification banner: "2 updates available"]
    ↓
User clicks "Update Now"
    ↓
Navigate to /settings/plugins
    ↓
[Plugin Store shows update badges]
    ↓
User clicks "Update" on recamera
    ↓
1. Download manifest from R2
2. Verify checksum
3. Run migration (if needed)
4. Update database
5. Download WASM (if changed)
6. Reload plugin
    ↓
[Show "✅ Updated successfully"]
    ↓
Badge removed, plugin now on 1.1.0
```
