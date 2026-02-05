# Plugin Integration Guide

Complete guide for integrating plugins with the HandsFree POS system.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Plugin Types](#plugin-types)
3. [Creating a New Plugin](#creating-a-new-plugin)
4. [Settings Integration](#settings-integration)
5. [Testing](#testing)
6. [Best Practices](#best-practices)

---

## Architecture Overview

### Plugin System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    PLUGIN ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ Plugin Registry (Cloudflare) ────────────────────────┐  │
│  │  • KV: Plugin metadata & manifests                    │  │
│  │  • R2: WASM binary files                              │  │
│  │  • Worker: API endpoints                              │  │
│  └────────────────────────────────────────────────────────┘  │
│                            ↓                                  │
│  ┌─ Plugin Manager (React Hook) ──────────────────────────┐  │
│  │  • Installation & lifecycle                            │  │
│  │  • SQLite caching                                      │  │
│  │  • Permission management                               │  │
│  └────────────────────────────────────────────────────────┘  │
│                            ↓                                  │
│  ┌─ Settings Integration ─────────────────────────────────┐  │
│  │  • Dynamic menu items                                  │  │
│  │  • Conditional rendering                               │  │
│  │  • Plugin-specific settings                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                            ↓                                  │
│  ┌─ Feature Modules ──────────────────────────────────────┐  │
│  │  • Existing code (for now)                             │  │
│  │  • Future: WASM modules                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Plugin Types

### 1. **UI Plugins** (Client-only)
Plugins that add new UI components or pages.

**Example**: Theme plugins, dashboard widgets

**Manifest**:
```json
{
  "type": "client",
  "target": {"client": true, "worker": false},
  "frontend": {
    "routes": [{"path": "/my-feature", "component": "MyComponent"}]
  }
}
```

### 2. **Worker Plugins** (Backend-only)
Plugins that add backend processing or API endpoints.

**Example**: Tax calculators, payment processors

**Manifest**:
```json
{
  "type": "worker",
  "target": {"client": false, "worker": true},
  "backend": {
    "endpoints": ["POST /api/my-feature/process"]
  }
}
```

### 3. **Hybrid Plugins** (Client + Worker)
Plugins with both UI and backend components.

**Example**: Aggregator integration, bar management

**Manifest**:
```json
{
  "type": "hybrid",
  "target": {"client": true, "worker": true},
  "frontend": {
    "routes": [{"path": "/aggregator", "component": "AggregatorDashboard"}]
  },
  "backend": {
    "endpoints": ["POST /api/aggregator/sync"]
  }
}
```

---

## Creating a New Plugin

### Step 1: Create Plugin Manifest

Create a JSON manifest in `plugins/sample-plugins/`:

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "type": "hybrid",
  "category": "Operations",
  "verified": false,
  "rating": 0,
  "download_count": 0,
  "reviews_count": 0,

  "author": {
    "name": "Your Name",
    "email": "your@email.com",
    "url": "https://yourwebsite.com"
  },

  "description": "Short description of what your plugin does",
  "long_description": "Detailed description with features and benefits",

  "target": {
    "client": true,
    "worker": true
  },

  "requires_app_version": ">=3.0.0",
  "requires_permissions": [
    "database.read.my_table",
    "database.write.my_table",
    "network.fetch.*.myapi.com"
  ],

  "frontend": {
    "wasm": "my-plugin-ui.wasm",
    "entry_point": "initialize",
    "routes": [
      {"path": "/my-plugin", "component": "MyPluginDashboard"}
    ]
  },

  "backend": {
    "wasm": "my-plugin-worker.wasm",
    "entry_point": "process_data",
    "endpoints": [
      {"method": "POST", "path": "/api/my-plugin/process"}
    ]
  },

  "checksum": "sha256:YOUR_WASM_CHECKSUM",
  "created_at": "2026-01-29T00:00:00Z",
  "updated_at": "2026-01-29T00:00:00Z"
}
```

### Step 2: Create WASM Modules

For now, use placeholder WASM:
```bash
cd /tmp
printf '\x00\x61\x73\x6d\x01\x00\x00\x00' > placeholder.wasm
shasum -a 256 placeholder.wasm
# Use the checksum in your manifest
```

Upload to R2:
```bash
wrangler r2 object put handsfree-plugins/my-awesome-plugin/1.0.0/client.wasm --file=placeholder.wasm --remote
wrangler r2 object put handsfree-plugins/my-awesome-plugin/1.0.0/worker.wasm --file=placeholder.wasm --remote
```

### Step 3: Upload Plugin Manifest

```bash
cd workers/plugin-registry
bash scripts/upload-plugins-cli.sh
```

This uploads all manifests in `plugins/sample-plugins/` to KV.

---

## Settings Integration

### Automatic Integration

When a plugin is installed, its settings automatically appear in the Settings menu.

### Adding Settings for Your Plugin

**1. Create a Settings Component**

```typescript
// src/pages-v2/MyPluginSettings.tsx
export default function MyPluginSettings() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">
        My Plugin Settings
      </h2>
      {/* Your settings UI */}
    </div>
  );
}
```

**2. Import in SettingsApp.tsx**

```typescript
import MyPluginSettings from './MyPluginSettings';
```

**3. Add Conditional Rendering**

In `getSettingsCategories()` function:

```typescript
const hasMyPlugin = installedPlugins.some(
  p => p.manifest.id === 'my-awesome-plugin' && p.enabled
);

// Then in the appropriate category:
{
  id: 'operations',
  items: [
    // ... existing items
    ...(hasMyPlugin ? [{
      id: 'my-plugin-settings',
      label: 'My Plugin Settings',
      description: 'Configure my awesome plugin',
      icon: Puzzle,
      component: MyPluginSettings,
      searchTerms: ['my', 'plugin', 'awesome'],
    }] : []),
  ]
}
```

### Example: Aggregator Integration

```typescript
// Check if plugin is installed
const hasAggregatorPlugin = installedPlugins.some(
  p => p.manifest.id === 'aggregator-integration-india' && p.enabled
);

// Add to Operations category
{
  id: 'operations',
  items: [
    // ... other items
    ...(hasAggregatorPlugin ? [{
      id: 'aggregator-settings',
      label: 'Aggregator Integration',
      description: 'Swiggy/Zomato dashboard extraction and auto-accept',
      icon: Smartphone,
      component: AggregatorSettings,
      searchTerms: ['aggregator', 'swiggy', 'zomato'],
    }] : []),
  ]
}
```

---

## Testing

### Local Testing

1. **Install Plugin**
   ```bash
   bun tauri dev
   # Navigate to Settings → Plugins & Extensions → Plugin Store
   # Click Install on your plugin
   ```

2. **Verify Settings Appear**
   ```bash
   # Return to Settings main page
   # Your plugin settings should appear in the appropriate category
   ```

3. **Check Console Logs**
   ```javascript
   [usePluginManager] Initializing plugin manager...
   [usePluginManager] Plugin manager initialized successfully
   [PluginManager] Downloading WASM from: https://...
   // Installation successful
   ```

### Testing Checklist

- [ ] Plugin appears in Plugin Store
- [ ] Installation completes without errors
- [ ] Settings appear in Settings menu
- [ ] Settings page loads correctly
- [ ] Plugin can be disabled
- [ ] Settings disappear when plugin disabled
- [ ] Plugin can be uninstalled
- [ ] Data handling options work

---

## Best Practices

### 1. **Manifest Design**

✅ **Do**:
- Use semantic versioning (1.0.0, 1.0.1, 1.1.0)
- Provide accurate checksums
- List all required permissions
- Write clear descriptions
- Include search terms

❌ **Don't**:
- Use placeholder checksums in production
- Request unnecessary permissions
- Skip version increments

### 2. **Settings Integration**

✅ **Do**:
- Use descriptive labels and descriptions
- Add relevant search terms
- Follow existing UI patterns
- Handle loading states
- Show error messages clearly

❌ **Don't**:
- Create duplicate settings pages
- Ignore existing design system
- Hard-code tenant IDs
- Skip error handling

### 3. **WASM Development**

✅ **Do** (Future):
- Keep WASM modules small (<1MB)
- Use efficient algorithms
- Cache data when possible
- Handle errors gracefully
- Log important events

❌ **Don't**:
- Bundle unnecessary dependencies
- Block the UI thread
- Ignore memory limits
- Skip checksum verification

### 4. **Database Integration**

✅ **Do**:
- Use migrations for schema changes
- Prefix tables with plugin name
- Handle offline scenarios
- Sync data to cloud
- Clean up on uninstall

❌ **Don't**:
- Modify core tables directly
- Skip migrations
- Ignore sync conflicts
- Leave orphaned data

### 5. **Permission Model**

✅ **Do**:
- Request minimum necessary permissions
- Explain why permissions are needed
- Handle permission denials
- Allow permission revocation

❌ **Don't**:
- Request broad permissions
- Assume permissions granted
- Bypass permission checks

---

## Real-World Example: Aggregator Plugin

### Current Implementation

**Files**:
- Manifest: `plugins/sample-plugins/aggregator-integration-india.json`
- Settings: `src/pages-v2/AggregatorSettings.tsx`
- Dashboard: `src/pages-v2/AggregatorDashboard.tsx`
- Store: `src/stores/aggregatorStore.ts`
- Service: `src/lib/aggregatorOrderDb.ts`

**Features**:
- DOM extraction from Swiggy/Zomato dashboards
- Auto-accept rules with fuzzy category matching
- Order lifecycle management
- Cloud sync
- KDS integration
- Sales recording

**Integration**:
```typescript
// In SettingsApp.tsx
const hasAggregatorPlugin = installedPlugins.some(
  p => p.manifest.id === 'aggregator-integration-india' && p.enabled
);

// Settings appear in Operations category when installed
...(hasAggregatorPlugin ? [{
  id: 'aggregator-settings',
  label: 'Aggregator Integration',
  description: 'Swiggy/Zomato dashboard extraction and auto-accept',
  icon: Smartphone,
  component: AggregatorSettings,
  searchTerms: ['aggregator', 'swiggy', 'zomato', 'delivery', 'online'],
}] : [])
```

---

## Troubleshooting

### Plugin Not Appearing in Store

**Check**:
1. Manifest uploaded to KV: `wrangler kv key list --namespace-id=...`
2. Plugin index updated: `wrangler kv key get "plugin-index" --namespace-id=...`
3. Worker deployed: `wrangler deploy`

### Settings Not Appearing

**Check**:
1. Plugin installed: Settings → Plugins & Extensions → Installed Plugins
2. Plugin enabled: Toggle should be ON
3. `installedPlugins` passed to `getSettingsCategories()`
4. Plugin ID matches manifest exactly

### Installation Failing

**Check**:
1. WASM files exist in R2
2. Checksum matches WASM file
3. Plugin Manager initialized
4. Console for error messages

---

## Future Enhancements

### Planned Features

1. **Hot Reload**: Update plugins without app restart
2. **Plugin Dependencies**: Declare required plugins
3. **Plugin Marketplace**: Public third-party plugins
4. **Code Signing**: Verify plugin authenticity
5. **Sandboxing**: Strict resource limits
6. **A/B Testing**: Deploy different versions to users

### Migration Path

**Current** (Phase 1):
- Existing code as-is
- Plugin system for metadata
- Settings integration

**Next** (Phase 2):
- Convert logic to WASM
- Client-side execution
- Worker-side processing

**Future** (Phase 3):
- Full WASM plugins
- Third-party marketplace
- Revenue sharing

---

## Support

**Documentation**:
- [Plugin System Quickstart](PLUGIN_SYSTEM_QUICKSTART.md)
- [Plugin Registry Deployment](docs/PLUGIN_REGISTRY_DEPLOYMENT.md)
- [Plugin Manifest v2 Reference](docs/PLUGIN_MANIFEST_V2_QUICK_REFERENCE.md)

**Questions?**
- Check browser console (F12) for errors
- Review Worker logs: `wrangler tail`
- Verify KV/R2 data: `wrangler kv key get ...`

---

**Last Updated**: 2026-01-29
**Version**: 1.0.0
**Status**: ✅ Production-ready
