# Migration Guide: WASM Plugin System

## Overview

This branch (`feature/wasm-plugins`) introduces a fundamental architectural change to the HandsFree POS system. Business logic is being extracted into dynamically-loadable WASM plugins, enabling:

- ✅ Zero-rebuild deployments for business logic updates
- ✅ Per-tenant feature customization
- ✅ Offline-capable client-side logic
- ✅ Smaller base application (~30-50% size reduction)

## ⚠️ Breaking Changes

### 1. Business Logic Extraction

**What's changing**: Core features (Bar Management, Multi-location Sync, Aggregator Integration) are moving from the main bundle to WASM plugins.

**Impact**:
- These features will be loaded dynamically at runtime
- Features can be enabled/disabled per tenant
- Updates to these features no longer require app rebuild

**Migration path**:
- Existing users: Plugins will be auto-installed on first launch
- New users: Plugins installed based on subscription plan

### 2. Store Architecture Changes

**Before** (Current):
```typescript
// src/stores/barStore.ts
export const useBarStore = create((set, get) => ({
  inventory: [],
  recipes: [],

  // Business logic in store
  calculateClosingReport: () => {
    const sales = get().sales;
    const inventory = get().inventory;
    // Complex calculation logic here...
  }
}));
```

**After** (WASM Plugin):
```typescript
// src/stores/barStore.ts
import { useWasm } from '@/hooks/useWasm';

export const useBarStore = create((set, get) => ({
  inventory: [],
  recipes: [],

  // Business logic delegated to WASM
  calculateClosingReport: async () => {
    const barWasm = await useWasm('bar-client');
    const sales = JSON.stringify(get().sales);
    const inventory = JSON.stringify(get().inventory);

    return barWasm.calculate_closing_report(sales, inventory);
  }
}));
```

**Impact**:
- Stores become thinner (UI state only)
- Business logic calls become async
- Type definitions may need updates

### 3. Build Process Changes

**Before**:
- Single monolithic bundle
- All features compiled at build time
- Full app rebuild for any change

**After**:
- Core app bundle (30-50% smaller)
- Plugins loaded from Cloudflare R2
- Plugin updates independent of app

**Impact**:
- Initial build time: ~20% faster
- App download size: ~40MB → ~20-25MB
- Plugin downloads: On-demand, cached locally

### 4. Deployment Model

**Before**:
```
Code change → Build → Deploy app → Users download update
```

**After**:
```
Plugin code change → Build WASM → Upload to R2 → Users get update instantly (no download)
```

**Impact**:
- Faster iteration cycles
- No app store review delays for plugin updates
- Gradual rollout capability (deploy to 10%, 50%, 100%)

### 5. Dependencies

**New dependencies**:
```json
{
  "dependencies": {
    "@handsfree/plugin-sdk": "^1.0.0",
    "idb": "^7.1.1"
  },
  "devDependencies": {
    "vite-plugin-wasm": "^3.3.0"
  }
}
```

**Cargo.toml additions** (optional, for desktop-enhanced plugins):
```toml
[dependencies]
wasmtime = { version = "18.0", optional = true }

[features]
desktop-wasm = ["wasmtime"]
```

### 6. API Changes

#### Bar Dashboard

**Before**:
```typescript
// Direct function call
import { calculateBarClosingReport } from '@/lib/barLogic';

const report = calculateBarClosingReport(sales, inventory);
```

**After**:
```typescript
// WASM plugin call
import { useWasm } from '@/hooks/useWasm';

const barWasm = useWasm('bar-client');
const report = await barWasm.calculate_closing_report(
  JSON.stringify(sales),
  JSON.stringify(inventory)
);
```

#### Multi-location Sync

**Before**:
```typescript
// Sync logic in frontend
import { syncMenuToLocations } from '@/lib/chainSync';

syncMenuToLocations(chainId, menuData, locations);
```

**After**:
```typescript
// Worker plugin API call
const response = await fetch('/api/chain/menu/sync', {
  method: 'POST',
  body: JSON.stringify({ chainId, menuData, locations })
});
```

### 7. Configuration Changes

**New environment variables**:
```bash
# .env
VITE_PLUGIN_REGISTRY_URL=https://handsfree-restaurant.suyesh.workers.dev/plugins
VITE_ENABLE_PLUGIN_SYSTEM=true
```

**Tauri config additions** (`tauri.conf.json`):
```json
{
  "tauri": {
    "allowlist": {
      "http": {
        "request": true,
        "scope": [
          "https://handsfree-restaurant.suyesh.workers.dev/plugins/*",
          "https://pub-*.r2.dev/*"
        ]
      }
    }
  }
}
```

## Compatibility Approach

### Phase 1: Compatibility Mode (Weeks 1-8)

Both old and new code coexist:
- Old code remains in main bundle
- Plugin system runs in parallel
- Users can toggle between old/new via feature flag

```typescript
// Feature flag check
if (usePluginSystem) {
  // Use WASM plugin
  const barWasm = useWasm('bar-client');
  report = await barWasm.calculate_closing_report(...);
} else {
  // Use old code
  report = calculateBarClosingReport(...);
}
```

### Phase 2: Plugin-First Mode (Weeks 9-12)

Plugins become primary, old code as fallback:
- Plugins auto-installed on launch
- Graceful degradation if plugin fails to load
- Old code removed after successful migration

### Phase 3: Plugin-Only Mode (Week 13+)

Old code fully removed:
- All business logic in plugins
- No fallback code
- Smallest bundle size achieved

## Testing Strategy

### Automated Tests

**Unit tests**:
```bash
# Test WASM plugin loading
npm test src/services/pluginManager.test.ts

# Test plugin resolution
npm test src/lib/pluginHost.test.ts
```

**Integration tests**:
```bash
# Test full plugin lifecycle
npm run test:integration -- --grep "plugin"

# Test offline mode
npm run test:offline
```

### Manual Testing

1. **Clean install**: Delete all data, reinstall app
2. **Upgrade path**: Upgrade from current version
3. **Offline mode**: Disable network, verify client WASM works
4. **Plugin toggle**: Enable/disable bar plugin, verify UI updates

## Rollback Plan

If issues arise during rollout:

1. **Immediate**: Disable plugin system via feature flag
   ```typescript
   // src/lib/featureFlags.ts
   export const ENABLE_PLUGINS = false; // Rollback
   ```

2. **Short-term**: Merge fixes to `feature/wasm-plugins`, redeploy

3. **Long-term**: If fundamental issues, revert to `main` branch

## Timeline

```
Week 1-2:   Fork creation, foundation
Week 3-4:   Worker plugin system
Week 5-6:   Client plugin system
Week 7-8:   Cross-repo integration
Week 9-10:  Developer SDK
Week 11-12: Bar plugin migration (beta)
Week 13-14: Multi-location plugin (beta)
Week 15-16: Gradual rollout (10% → 100%)
Week 17+:   Remove old code, deprecate main
```

## Support

### For Developers

- **Slack**: #wasm-plugins channel
- **Docs**: https://docs.handsfree.com/plugins
- **Issues**: GitHub issues with `plugin-system` label

### For Users

- **Known issues**: See KNOWN_ISSUES.md
- **FAQ**: See FAQ.md
- **Support**: support@handsfree.com

## FAQ

### Q: Will my data be lost during migration?
**A**: No. Data remains in SQLite/D1. Only business logic moves to plugins.

### Q: What happens if a plugin fails to load?
**A**: Graceful degradation:
1. Try cached version from IndexedDB
2. Fall back to old code (Weeks 1-12)
3. Show error notification
4. User can retry or contact support

### Q: Can I still use the app offline?
**A**: Yes! Client WASM plugins are cached locally and work offline.

### Q: Will plugins slow down the app?
**A**: No. WASM performance is near-native, often faster than JavaScript.

### Q: How do I opt out of plugins?
**A**: During beta (Weeks 9-12), you can disable via Settings → Advanced → Use Legacy Code. After Week 13, plugin system becomes mandatory.

### Q: What about custom features we built?
**A**: Contact us to migrate custom code to tenant-specific plugins. We'll help with migration.

## Breaking Change Checklist

Before merging `feature/wasm-plugins` → `main`:

- [ ] All automated tests passing
- [ ] 5+ beta tenants tested successfully
- [ ] Performance benchmarks meet targets (±10% vs. old code)
- [ ] Documentation updated
- [ ] Migration guide reviewed
- [ ] Rollback plan tested
- [ ] Support team trained
- [ ] Gradual rollout plan approved

## Additional Resources

- **Architecture Plan**: `/Users/stonepot-tech/.claude/plans/zany-cooking-koala.md`
- **Plugin SDK Docs**: Coming in Phase 5
- **Example Plugins**: `/plugins/examples/` (Coming in Phase 5)

---

**Last Updated**: 2026-01-29
**Status**: 🚧 In Development (Phase 0: Fork Creation)
**Branch**: `feature/wasm-plugins`
