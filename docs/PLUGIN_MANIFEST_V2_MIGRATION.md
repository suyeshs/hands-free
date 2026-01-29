# Plugin Manifest v2 Migration Guide

**Target Audience**: Plugin developers upgrading from Manifest v1 to v2
**Estimated Time**: 30 minutes per plugin
**Difficulty**: Easy

---

## Overview

Manifest v2 adds powerful new features for production-ready plugins:
- Dependency management
- Rollback support
- Offline updates
- Permission lifecycle hooks
- Analytics opt-in
- Theme awareness

**Backward compatibility**: v1 plugins continue working. No breaking changes required.

---

## Quick Start

### Step 1: Update manifest.json

Add new optional fields to your existing `manifest.json`:

```json
{
  "id": "bar-management",
  "name": "Bar Management",
  "version": "1.0.0",

  // NEW in v2: Dependencies
  "dependencies": [
    {
      "plugin_id": "inventory-core",
      "version": "^2.0.0",
      "optional": false
    }
  ],

  // NEW in v2: Compatibility matrix
  "compatibility": {
    "min_app_version": "3.0.0",
    "platforms": ["desktop", "web", "mobile"]
  },

  // NEW in v2: Data handling on uninstall
  "data": {
    "tables": ["bar_inventory", "bar_closing_sessions"],
    "uninstall_behavior": "archive",
    "export_format": "json"
  },

  // NEW in v2: Analytics (opt-in)
  "analytics": {
    "enabled": true,
    "events": ["report_generated", "sync_completed"]
  },

  // NEW in v2: Lifecycle hooks
  "lifecycle": {
    "onPermissionRevoked": "handle_permission_revoked",
    "onUpdate": "handle_update",
    "onUninstall": "handle_uninstall"
  },

  // NEW in v2: Theme support
  "theme_aware": true
}
```

### Step 2: Implement Lifecycle Hooks (Optional)

If you added lifecycle hooks, implement them in your WASM:

```rust
// client/src/lib.rs

#[wasm_bindgen]
pub fn handle_permission_revoked(permission: &str) -> Result<(), JsValue> {
    match permission {
        "database.write.bar_inventory" => {
            // Switch to read-only mode
            log("Inventory editing disabled due to permission revocation");
            Ok(())
        },
        _ => Ok(())
    }
}

#[wasm_bindgen]
pub fn handle_update(old_version: &str, new_version: &str) -> Result<(), JsValue> {
    log(&format!("Updating from {} to {}", old_version, new_version));

    // Perform migration tasks
    migrate_data(old_version, new_version)?;

    Ok(())
}

#[wasm_bindgen]
pub fn handle_uninstall() -> Result<(), JsValue> {
    log("Plugin being uninstalled");

    // Cleanup tasks (optional, snapshot handles data)
    cleanup_temporary_files()?;

    Ok(())
}
```

### Step 3: Use New Plugin Host APIs

Take advantage of new APIs in your plugin:

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    // NEW: Theme support
    #[wasm_bindgen(js_namespace = ["host", "ui"])]
    fn getTheme() -> String;

    // NEW: Permission management
    #[wasm_bindgen(js_namespace = ["host", "permissions"])]
    fn has(permission: &str) -> bool;

    #[wasm_bindgen(js_namespace = ["host", "permissions"])]
    async fn request(permission: &str) -> JsValue;
}

#[wasm_bindgen]
pub fn init() {
    // Get current theme
    let theme = getTheme();  // Returns "light" or "dark"

    if theme == "dark" {
        apply_dark_theme();
    } else {
        apply_light_theme();
    }

    // Check permissions
    if !has("database.write.bar_inventory") {
        log("Write permission not granted, using read-only mode");
    }
}
```

### Step 4: Add Analytics (Optional)

If you enabled analytics, track key events:

```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "analytics"])]
    async fn track(event: &str, properties: JsValue) -> JsValue;
}

#[wasm_bindgen]
pub async fn generate_report() -> Result<JsValue, JsValue> {
    let report = create_closing_report()?;

    // Track analytics event
    let properties = js_sys::Object::new();
    js_sys::Reflect::set(&properties, &"itemCount".into(), &report.items.len().into())?;
    js_sys::Reflect::set(&properties, &"totalSales".into(), &report.total_sales.into())?;

    track("report_generated", properties.into()).await?;

    Ok(serde_wasm_bindgen::to_value(&report)?)
}
```

### Step 5: Test Migration

1. **Install updated plugin**:
   ```bash
   ./build.sh
   # Upload to registry
   ```

2. **Test new features**:
   - Verify dependencies resolved correctly
   - Test rollback: uninstall → rollback
   - Test permission revocation
   - Verify theme switching
   - Check analytics events in dashboard

3. **Update plugin version**:
   ```json
   {
     "version": "1.1.0",  // Bump minor version for v2 features
     "changelog": "Added Manifest v2 support: dependencies, rollback, lifecycle hooks"
   }
   ```

---

## Feature-by-Feature Migration

### 1. Dependencies

**When to use**: Your plugin requires other plugins to function.

**Before (v1)**: Manual dependency checking in code
```rust
// Had to manually check if dependency exists
if !check_inventory_core_installed() {
    return Err("Please install inventory-core plugin first".into());
}
```

**After (v2)**: Declare in manifest
```json
{
  "dependencies": [
    {
      "plugin_id": "inventory-core",
      "version": "^2.0.0",
      "optional": false
    }
  ]
}
```

**Benefits**:
- Automatic dependency resolution
- Version conflict detection
- User-friendly error messages
- Dependency graph visualization

---

### 2. Data Handling & Rollback

**When to use**: Your plugin stores data in database tables.

**Before (v1)**: Data lost on uninstall
```rust
// No way to backup data before uninstall
```

**After (v2)**: Automatic snapshots
```json
{
  "data": {
    "tables": ["bar_inventory", "bar_closing_sessions", "bar_recipes"],
    "uninstall_behavior": "archive",  // or "export", "delete"
    "export_format": "json"
  }
}
```

**Benefits**:
- 30-day rollback window
- User can choose archive/export/delete
- Data restored automatically on rollback
- No code changes needed

**User experience**:
```typescript
// User uninstalls plugin
await pluginManager.uninstall('bar-management');
// Snapshot created automatically

// User realizes mistake, rolls back within 30 days
await pluginManager.rollback('bar-management');
// Plugin + data fully restored!
```

---

### 3. Permission Revocation

**When to use**: Your plugin needs to handle permission changes gracefully.

**Before (v1)**: Permission errors crash plugin
```rust
pub fn save_inventory() -> Result<JsValue, JsValue> {
    db_execute("INSERT INTO bar_inventory ...")?;  // Fails if permission revoked
    Ok(JsValue::NULL)
}
```

**After (v2)**: Graceful degradation
```rust
#[wasm_bindgen]
pub fn handle_permission_revoked(permission: &str) -> Result<(), JsValue> {
    match permission {
        "database.write.bar_inventory" => {
            set_read_only_mode(true);
            notify_user("Inventory editing disabled. Read-only mode activated.");
        },
        _ => {}
    }
    Ok(())
}

pub fn save_inventory() -> Result<JsValue, JsValue> {
    if is_read_only_mode() {
        return Err("Cannot save in read-only mode".into());
    }

    if !has_permission("database.write.bar_inventory") {
        return Err("Write permission required".into());
    }

    db_execute("INSERT INTO bar_inventory ...")?;
    Ok(JsValue::NULL)
}
```

**Manifest**:
```json
{
  "lifecycle": {
    "onPermissionRevoked": "handle_permission_revoked"
  }
}
```

**Benefits**:
- No crashes when permission revoked
- Plugin continues with reduced functionality
- User can re-request permission if needed

---

### 4. Theme Support

**When to use**: Your plugin has UI components.

**Before (v1)**: Hard-coded light theme
```rust
pub fn render_dashboard() -> String {
    r#"
        <div style="background: white; color: black;">
            Dashboard content
        </div>
    "#.to_string()
}
```

**After (v2)**: Dynamic theme
```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "ui"])]
    fn getTheme() -> String;
}

pub fn render_dashboard() -> String {
    let theme = getTheme();
    let (bg, fg) = if theme == "dark" {
        ("#1a1a1a", "#ffffff")
    } else {
        ("#ffffff", "#000000")
    };

    format!(r#"
        <div style="background: {}; color: {};">
            Dashboard content
        </div>
    "#, bg, fg)
}
```

**Manifest**:
```json
{
  "theme_aware": true
}
```

**Benefits**:
- Automatic dark mode support
- Consistent with app theme
- Better user experience

---

### 5. Analytics (Opt-In)

**When to use**: You want usage insights for your plugin (HandsFree only).

**Before (v1)**: No insights
```rust
pub fn generate_report() -> Result<JsValue, JsValue> {
    let report = create_closing_report()?;
    Ok(serde_wasm_bindgen::to_value(&report)?)
}
```

**After (v2)**: Track key events
```rust
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "analytics"])]
    async fn track(event: &str, properties: JsValue) -> JsValue;
}

pub async fn generate_report() -> Result<JsValue, JsValue> {
    let report = create_closing_report()?;

    // Track event (opt-in via manifest)
    let props = js_sys::Object::new();
    js_sys::Reflect::set(&props, &"itemCount".into(), &report.items.len().into())?;
    track("report_generated", props.into()).await?;

    Ok(serde_wasm_bindgen::to_value(&report)?)
}
```

**Manifest**:
```json
{
  "analytics": {
    "enabled": true,
    "events": ["report_generated", "sync_completed", "error_occurred"]
  }
}
```

**Privacy**:
- Opt-in per plugin
- Events must be whitelisted
- No PII tracked
- User can disable analytics

**Benefits**:
- Understand feature usage
- Identify errors early
- Data-driven improvements

---

## Compatibility Matrix

**v2 features are optional**. Choose what you need:

| Feature | Required? | Breaking Change? | Recommended For |
|---------|-----------|------------------|-----------------|
| Dependencies | No | No | Complex plugins |
| Data handling | No | No | All plugins with DB |
| Lifecycle hooks | No | No | Production plugins |
| Analytics | No | No | HandsFree official plugins |
| Theme support | No | No | Plugins with UI |

**Migration paths**:

1. **Minimal migration** (5 min): Add `data.uninstall_behavior` for rollback support
2. **Standard migration** (20 min): Add lifecycle hooks + theme support
3. **Full migration** (30 min): Add all v2 features

---

## Testing Your v2 Plugin

### Automated Tests

```bash
# 1. Build plugin
./build.sh

# 2. Run plugin tests
cargo test --manifest-path client/Cargo.toml
cargo test --manifest-path worker/Cargo.toml

# 3. Test manifest validation
npx @handsfree/plugin-cli validate
```

### Manual Tests

1. **Dependency resolution**:
   - Install plugin with dependencies
   - Check dependency graph in UI
   - Test with conflicting versions

2. **Rollback**:
   - Install plugin
   - Add some data
   - Uninstall (creates snapshot)
   - Rollback within 30 days
   - Verify data restored

3. **Permission revocation**:
   - Revoke a permission in Settings
   - Verify lifecycle hook called
   - Check plugin still functions (read-only)

4. **Theme switching**:
   - Switch app between light/dark mode
   - Verify plugin UI adapts

5. **Analytics**:
   - Trigger tracked events
   - Check analytics dashboard

---

## Example: Migrating Bar Management Plugin

**Before (v1 manifest.json)**:
```json
{
  "id": "bar-management",
  "name": "Bar Management",
  "version": "1.0.0",
  "type": "hybrid",
  "requires_permissions": [
    "database.read.bar_inventory",
    "database.write.bar_inventory"
  ]
}
```

**After (v2 manifest.json)**:
```json
{
  "id": "bar-management",
  "name": "Bar Management",
  "version": "1.1.0",  // Bumped version
  "type": "hybrid",
  "requires_permissions": [
    "database.read.bar_inventory",
    "database.write.bar_inventory"
  ],

  // NEW v2 fields
  "dependencies": [],  // No dependencies for bar plugin

  "compatibility": {
    "min_app_version": "3.0.0",
    "platforms": ["desktop", "web", "mobile"]
  },

  "data": {
    "tables": [
      "bar_inventory",
      "bar_recipes",
      "bar_closing_sessions",
      "bar_closing_counts"
    ],
    "uninstall_behavior": "archive",
    "export_format": "json"
  },

  "analytics": {
    "enabled": true,
    "events": [
      "closing_report_generated",
      "recipe_created",
      "inventory_synced"
    ]
  },

  "lifecycle": {
    "onPermissionRevoked": "handle_permission_revoked",
    "onUninstall": "cleanup_temporary_data"
  },

  "theme_aware": true
}
```

**Code changes** (client/src/lib.rs):
```rust
// Add lifecycle hooks
#[wasm_bindgen]
pub fn handle_permission_revoked(permission: &str) -> Result<(), JsValue> {
    match permission {
        "database.write.bar_inventory" => {
            // Disable editing features
            log("Switched to read-only mode");
        },
        _ => {}
    }
    Ok(())
}

#[wasm_bindgen]
pub fn cleanup_temporary_data() -> Result<(), JsValue> {
    // Cleanup temp files (optional, snapshot handles main data)
    log("Cleaning up temporary data");
    Ok(())
}

// Add theme support
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "ui"])]
    fn getTheme() -> String;
}

pub fn get_dashboard_styles() -> String {
    let theme = getTheme();
    if theme == "dark" {
        include_str!("../styles/dark.css").to_string()
    } else {
        include_str!("../styles/light.css").to_string()
    }
}

// Add analytics
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["host", "analytics"])]
    async fn track(event: &str, properties: JsValue) -> JsValue;
}

pub async fn generate_closing_report() -> Result<JsValue, JsValue> {
    let report = create_report()?;

    // Track analytics
    let props = js_sys::Object::new();
    js_sys::Reflect::set(&props, &"itemCount".into(), &report.items.len().into())?;
    track("closing_report_generated", props.into()).await?;

    Ok(serde_wasm_bindgen::to_value(&report)?)
}
```

**Result**: Bar plugin now supports all v2 features!

---

## FAQ

### Q: Do I need to migrate to v2?

**A**: No, v1 plugins continue working. But v2 features improve UX significantly (rollback, graceful degradation).

### Q: Will v2 plugins work on older POS apps?

**A**: Yes, if `compatibility.min_app_version` is met. App checks version and shows error if incompatible.

### Q: Can I mix v1 and v2 plugins?

**A**: Yes, fully compatible. Users can have both v1 and v2 plugins installed.

### Q: What if I don't want analytics?

**A**: Don't add `analytics` to manifest. It's opt-in. Even if enabled, users can disable in settings.

### Q: How do I test lifecycle hooks?

**A**: Use plugin manager methods:
```typescript
// Test permission revocation
await pluginManager.revokePermission('bar-management', 'database.write.bar_inventory');

// Test uninstall
await pluginManager.uninstall('bar-management');
```

### Q: Can I change `uninstall_behavior` after release?

**A**: Yes, but recommend consulting users first. Can override per-uninstall:
```typescript
await pluginManager.uninstall('bar-management', {
  dataHandling: 'export'  // Override manifest default
});
```

---

## Support

- **Documentation**: https://docs.handsfree.com/plugins/manifest-v2
- **GitHub Issues**: https://github.com/handsfree/restaurant-pos-ai/issues
- **Discord**: https://discord.gg/handsfree
- **Email**: plugins@handsfree.com

---

**Last Updated**: 2026-01-29
**Plugin SDK Version**: 2.0.0
**Manifest Version**: v2
