# Plugin Manifest v2 - Quick Reference Card

**Target**: Plugin developers
**Version**: Manifest v2 (2026-01-29)

---

## Manifest Template (v2)

```json
{
  "id": "your-plugin-id",
  "name": "Your Plugin Name",
  "version": "1.0.0",
  "description": "What your plugin does",
  "author": "Your Name",
  "homepage": "https://your-plugin.com",
  "icon": "🔌",
  "type": "hybrid",
  "visibility": "public",
  "category": "Operations",
  "tags": ["tag1", "tag2"],

  "target": {
    "client": true,
    "worker": true
  },

  "requires_app_version": ">=3.0.0",
  "requires_worker_version": ">=1.0.0",

  "requires_permissions": [
    "database.read.your_table",
    "database.write.your_table",
    "storage.your_plugin",
    "ui.mount.your_path"
  ],

  "frontend": {
    "wasm": "your-client.wasm",
    "entry_point": "init",
    "routes": [
      { "path": "/your-path", "component": "YourComponent" }
    ],
    "menu_items": [
      { "label": "Your Plugin", "icon": "icon-name", "path": "/your-path" }
    ]
  },

  "backend": {
    "wasm": "your-worker.wasm",
    "entry_point": "init",
    "endpoints": [
      { "method": "POST", "path": "/api/your-plugin/action" }
    ]
  },

  "dependencies": [
    { "plugin_id": "dependency-id", "version": "^1.0.0", "optional": false }
  ],

  "compatibility": {
    "min_app_version": "3.0.0",
    "platforms": ["desktop", "web", "mobile"]
  },

  "data": {
    "tables": ["your_table1", "your_table2"],
    "uninstall_behavior": "archive",
    "export_format": "json"
  },

  "analytics": {
    "enabled": true,
    "events": ["event1", "event2"]
  },

  "lifecycle": {
    "onPermissionRevoked": "handle_permission_revoked",
    "onUpdate": "handle_update",
    "onUninstall": "handle_uninstall"
  },

  "theme_aware": true,

  "checksum": "sha256:...",
  "created_at": "2026-01-29T00:00:00Z",
  "updated_at": "2026-01-29T00:00:00Z"
}
```

---

## Field Reference

### Basic Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | ✅ | string | Unique plugin identifier (kebab-case) |
| `name` | ✅ | string | Display name |
| `version` | ✅ | string | SemVer (e.g., "1.2.3") |
| `description` | ✅ | string | What the plugin does |
| `author` | ✅ | string | Author name or organization |
| `homepage` | ❌ | string | Plugin website URL |
| `icon` | ❌ | string | Emoji or icon name |
| `type` | ✅ | enum | `'client'`, `'worker'`, or `'hybrid'` |
| `visibility` | ✅ | enum | `'public'`, `'private'`, `'tenant-specific'` |
| `category` | ❌ | enum | 'Analytics', 'Integrations', 'Operations', etc. |
| `tags` | ❌ | string[] | Search tags (e.g., `['bar', 'inventory']`) |

### Compatibility (v2)

| Field | Required | Description |
|-------|----------|-------------|
| `compatibility.min_app_version` | ❌ | Minimum POS app version (SemVer) |
| `compatibility.max_app_version` | ❌ | Maximum POS app version (optional) |
| `compatibility.platforms` | ❌ | `['desktop', 'web', 'mobile', 'android', 'ios']` |

### Dependencies (v2)

```json
"dependencies": [
  {
    "plugin_id": "inventory-core",
    "version": "^2.0.0",
    "optional": false,
    "fallback_behavior": "disable-feature"
  }
]
```

- **`version`**: SemVer range (`^1.0.0`, `>=2.0.0 <3.0.0`)
- **`optional`**: If `true`, plugin works without dependency
- **`fallback_behavior`**: What happens if missing (e.g., `"disable-feature"`)

### Data Handling (v2)

```json
"data": {
  "tables": ["your_table1", "your_table2"],
  "storage_keys": ["key1", "key2"],
  "uninstall_behavior": "archive",
  "export_format": "json"
}
```

- **`tables`**: DB tables created by plugin
- **`uninstall_behavior`**: `'archive'` (rollback), `'export'` (file), `'delete'` (permanent)
- **`export_format`**: `'json'`, `'csv'`, or `'sql'`

### Analytics (v2)

```json
"analytics": {
  "enabled": true,
  "endpoint": "https://your-endpoint.com/track",
  "events": ["feature_used", "error_occurred"]
}
```

- **Opt-in** per plugin
- Events must be **whitelisted**
- No PII tracked

### Lifecycle Hooks (v2)

```json
"lifecycle": {
  "onPermissionRevoked": "handle_permission_revoked",
  "onUpdate": "handle_update",
  "onUninstall": "handle_uninstall"
}
```

- All optional
- Must be exported WASM functions
- Called automatically by plugin manager

### Theme Support (v2)

```json
"theme_aware": true
```

- Set to `true` if plugin supports dark/light modes
- Use `host.ui.getTheme()` to get current theme

---

## Lifecycle Hook Examples

### Rust Implementation

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn handle_permission_revoked(permission: &str) -> Result<(), JsValue> {
    match permission {
        "database.write.inventory" => {
            // Switch to read-only mode
            log("Write permission revoked, switching to read-only");
            set_read_only_mode(true);
        },
        _ => {}
    }
    Ok(())
}

#[wasm_bindgen]
pub fn handle_update(old_version: &str, new_version: &str) -> Result<(), JsValue> {
    log(&format!("Updating from {} to {}", old_version, new_version));

    // Migrate data if needed
    if old_version == "1.0.0" && new_version == "2.0.0" {
        migrate_to_v2()?;
    }

    Ok(())
}

#[wasm_bindgen]
pub fn handle_uninstall() -> Result<(), JsValue> {
    log("Plugin being uninstalled");

    // Cleanup temp files (optional, snapshot handles main data)
    cleanup_temporary_files()?;

    Ok(())
}
```

---

## Plugin Host API (v2)

### Permissions

```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "permissions"])]
    fn has(permission: &str) -> bool;

    #[wasm_bindgen(js_namespace = ["host", "permissions"])]
    async fn request(permission: &str) -> JsValue;

    #[wasm_bindgen(js_namespace = ["host", "permissions"])]
    fn onRevoked(permission: &str, handler: &js_sys::Function) -> js_sys::Function;
}

// Usage
if !has("database.write.inventory") {
    // Request permission or use read-only mode
}
```

### Theme

```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "ui"])]
    fn getTheme() -> String;  // Returns "light" or "dark"
}

// Usage
let theme = getTheme();
if theme == "dark" {
    apply_dark_styles();
}
```

### Analytics

```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "analytics"])]
    async fn track(event: &str, properties: JsValue) -> JsValue;

    #[wasm_bindgen(js_namespace = ["host", "analytics"])]
    async fn error(error: JsValue, context: JsValue) -> JsValue;
}

// Usage
let props = js_sys::Object::new();
js_sys::Reflect::set(&props, &"itemCount".into(), &45.into())?;
track("report_generated", props.into()).await?;
```

### Storage Export (v2)

```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "storage"])]
    async fn export() -> JsValue;  // Returns all plugin data
}

// Usage
let data = export().await?;
// Returns: { "key1": value1, "key2": value2, ... }
```

---

## Version Constraints (SemVer)

| Constraint | Matches | Example |
|------------|---------|---------|
| `1.2.3` | Exact | Only 1.2.3 |
| `^1.2.3` | Compatible | 1.2.3, 1.2.4, 1.3.0, but NOT 2.0.0 |
| `~1.2.3` | Patch | 1.2.3, 1.2.4, but NOT 1.3.0 |
| `>=1.2.0 <2.0.0` | Range | 1.2.0 to 1.9.9 |
| `*` | Any | All versions |

**Recommendation**: Use `^` for dependencies (e.g., `^1.2.0`)

---

## Categories

- **Analytics** - Reports, dashboards, insights
- **Integrations** - Third-party services, APIs
- **Operations** - Inventory, bar, kitchen
- **Payments** - Payment gateways, processors
- **Marketing** - Loyalty, promotions, campaigns
- **Inventory** - Stock management, suppliers
- **Staff** - Scheduling, time tracking, payroll
- **Reporting** - Custom reports, exports
- **Other** - Everything else

---

## Permissions Naming Convention

### Database
- `database.read.<table>` - Read from table
- `database.write.<table>` - Write to table
- `database.read.*` - Read all tables
- `database.write.*` - Write all tables

### UI
- `ui.mount.<path>` - Mount UI at path
- `ui.mount.*` - Mount anywhere

### Events
- `events.subscribe.<event>` - Subscribe to event
- `events.emit.<event>` - Emit event
- `events.*` - All events

### Storage
- `storage.<plugin-id>` - Plugin-specific storage
- `storage.*` - All storage

### Network
- `network.fetch.<domain>` - Fetch from domain
- `network.fetch.*` - Fetch from any HTTPS

---

## Build Checklist

### Before Building

- [ ] Updated `version` in manifest
- [ ] Added new permissions if needed
- [ ] Updated `updated_at` timestamp
- [ ] Added v2 fields (`compatibility`, `data`, `lifecycle`)
- [ ] Set `theme_aware` if UI plugin
- [ ] Added `analytics.events` if tracking

### Build Commands

```bash
# Build plugin
./build.sh

# Verify manifest
npx @handsfree/plugin-cli validate

# Test locally
npx @handsfree/plugin-cli test
```

### After Building

- [ ] Verify checksum in `manifest.json`
- [ ] Test installation
- [ ] Test lifecycle hooks
- [ ] Test theme switching
- [ ] Test permission revocation
- [ ] Test rollback

---

## Migration from v1 to v2

**Minimal (5 min)**:
```json
{
  "version": "1.1.0",  // Bump version
  "data": {
    "tables": ["your_tables"],
    "uninstall_behavior": "archive"  // Enable rollback
  }
}
```

**Standard (20 min)**:
```json
{
  "version": "1.1.0",
  "data": { /* ... */ },
  "lifecycle": {
    "onPermissionRevoked": "handle_permission_revoked",
    "onUninstall": "cleanup_temporary_data"
  },
  "theme_aware": true
}
```

**Full (30 min)**:
```json
{
  "version": "1.1.0",
  "category": "Operations",
  "tags": ["bar", "inventory"],
  "dependencies": [/* ... */],
  "compatibility": { /* ... */ },
  "data": { /* ... */ },
  "analytics": { /* ... */ },
  "lifecycle": { /* ... */ },
  "theme_aware": true
}
```

---

## Common Mistakes

❌ **Wrong**:
```json
{
  "version": "v1.0.0",  // No "v" prefix
  "requires_permissions": [
    "database.*"  // Too broad
  ],
  "uninstall_behavior": "delete"  // Should be in "data" object
}
```

✅ **Correct**:
```json
{
  "version": "1.0.0",
  "requires_permissions": [
    "database.read.inventory",
    "database.write.inventory"
  ],
  "data": {
    "uninstall_behavior": "archive"
  }
}
```

---

## Testing

```typescript
// TypeScript tests
import { pluginManager } from '@/services/plugins';

// Test dependency resolution
const deps = await pluginManager.resolveDependencies('your-plugin');
console.log('Dependencies:', deps);

// Test rollback
await pluginManager.uninstall('your-plugin');  // Creates snapshot
await pluginManager.rollback('your-plugin');  // Restores

// Test permission revocation
await pluginManager.revokePermission('your-plugin', 'database.write.inventory');

// Test theme
const theme = pluginHost.ui.getTheme();  // "light" or "dark"
```

---

## Support

- **Docs**: https://docs.handsfree.com/plugins/manifest-v2
- **Examples**: `plugins/bar-management/`, `plugins/aggregator-integration/`
- **Issues**: https://github.com/handsfree/restaurant-pos-ai/issues
- **Discord**: https://discord.gg/handsfree

---

**Quick Reference Version**: 1.0
**Last Updated**: 2026-01-29
**Manifest Version**: v2
