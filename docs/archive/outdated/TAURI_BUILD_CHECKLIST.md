`# Tauri Build Checklist

## ✅ Completed Configuration

### 1. Bundle Resources
**Location**: `src-tauri/tauri.conf.json`

```json
"bundle": {
  "resources": [
    "configs/*",
    "scripts/*"
  ]
}
```

- Config files will be bundled with the app
- Accessible via `app_handle.path().resource_dir()`

### 2. Rust Modules
**Files Created**:
- `src-tauri/src/config.rs` - Configuration loader
- `src-tauri/src/dashboard_manager.rs` - Dashboard window manager
- `src-tauri/configs/aggregator_selectors.json` - Selector configuration
- `src-tauri/scripts/universal_extractor.js` - Order extraction script

**Registered Commands**:
```rust
// Configuration
get_aggregator_config
update_aggregator_config
get_platform_selectors

// Dashboard management
open_swiggy_dashboard
open_zomato_dashboard
close_dashboard
reload_dashboard

// Order processing
process_extracted_orders
notify_new_orders
```

### 3. Frontend Integration
**Platform Detection**: `src/lib/platform.ts`
- Detects web vs Tauri environment
- `isTauri()` returns true in desktop app

**Components**:
- `src/components/aggregator/DashboardManager.tsx`
  - Web mode: Shows partner login links
  - Desktop mode: Embedded dashboard controls

### 4. Window Configuration
**Main Window**:
- Title: "Restaurant POS"
- Size: 1400x900
- Global Tauri API enabled

**Dashboard Windows** (created dynamically):
- `swiggy-dashboard` - Swiggy partner portal
- `zomato-dashboard` - Zomato partner portal

### 5. Security & Permissions
- CSP disabled for external content loading
- Global Tauri API enabled for script injection

## 🚀 Build Commands

### Development
```bash
# Web version
bun run dev

# Desktop version
bun tauri dev
```

### Production Build
```bash
# Frontend build
bun run build

# Desktop app build
bun tauri build
```

## 📋 Testing Checklist

### Web Version
- [ ] Partner dashboard links open in new tab
- [ ] Shows informational message about desktop features
- [ ] Mock orders work via Dev Tools

### Desktop Version
- [ ] Config loads from bundled resources
- [ ] Open Swiggy Dashboard button creates webview
- [ ] Open Zomato Dashboard button creates webview
- [ ] JavaScript injection works
- [ ] Orders extracted and sent via IPC
- [ ] Close/Reload dashboard buttons work
- [ ] Config editor shows current settings
- [ ] Extracted order count updates

## 🔧 Troubleshooting

### Config Not Loading
Check console for path:
```
[Config] Loading from: /path/to/resources/configs/aggregator_selectors.json
```

If missing, verify:
1. File exists at `src-tauri/configs/aggregator_selectors.json`
2. Bundle resources configured in `tauri.conf.json`

### Script Injection Fails
The extractor script is embedded at compile time using:
```rust
include_str!("../scripts/universal_extractor.js")
```

No runtime file access needed.

### IPC Communication Issues
Verify:
1. `withGlobalTauri: true` in tauri.conf.json
2. Commands registered in `src-tauri/src/lib.rs`
3. `Emitter` trait imported in dashboard_manager.rs

## 📁 File Structure
```
src-tauri/
├── configs/
│   └── aggregator_selectors.json  (bundled)
├── scripts/
│   └── universal_extractor.js     (embedded at compile time)
├── src/
│   ├── config.rs                  (loads config)
│   ├── dashboard_manager.rs       (manages webviews)
│   ├── database.rs
│   └── lib.rs                     (registers commands)
├── Cargo.toml
└── tauri.conf.json
```

## 🎯 Next Steps

1. **Test Build**: `bun tauri build`
2. **Update Selectors**: Edit `aggregator_selectors.json` with real CSS selectors
3. **Test Extraction**: Open dashboards and verify order detection
4. **Refine Polling**: Adjust `intervalMs` based on performance
5. **Add Error Handling**: Monitor extraction logs

## 📚 Documentation
- [AGGREGATOR_DASHBOARD_EMBEDDING.md](../AGGREGATOR_DASHBOARD_EMBEDDING.md) - Technical details
- [AGGREGATOR_QUICK_START.md](../AGGREGATOR_QUICK_START.md) - User guide
