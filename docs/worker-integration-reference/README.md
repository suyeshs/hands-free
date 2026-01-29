# Worker Plugin System - Reference Implementation

**⚠️ IMPORTANT**: This directory contains **reference code** for the worker plugin system.

The actual implementation should be deployed to the **separate workers repository**:
- Repository: `handsfree-restaurant-new/platform/workers`
- Worker: `handsfree-tenant-router`

## Purpose

This directory provides:
1. **Reference implementations** of worker plugin infrastructure
2. **Integration examples** showing how to use plugins in workers
3. **TypeScript definitions** that can be copied to the workers repo

## Architecture

**⚠️ Use EXISTING Worker**: We add plugin functionality to the existing `handsfree-tenant-router` worker. **No new worker needed.**

```
┌─────────────────────────────────────────────────────────────┐
│  POS App (THIS REPO)                                        │
│  - Client-side plugin manager                               │
│  - Calls Worker APIs                                        │
│  - Local WASM execution (offline)                           │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP/WebSocket
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  EXISTING: handsfree-tenant-router Worker                   │
│  (handsfree-restaurant-new/platform/workers)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ EXISTING ROUTES:                                      │  │
│  │ - /api/sync/*                                         │  │
│  │ - /api/orders/*                                       │  │
│  │ - /api/chain/*                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ NEW PLUGIN ROUTES: (add these)                       │  │
│  │ - /api/plugin/{pluginId}/{tenantId}/*                │  │
│  │ - Worker plugin loader                               │  │
│  │ - Worker plugin host bindings                        │  │
│  │ - Executes worker WASM plugins                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**: Add plugin handling as new routes in the existing worker, alongside current sync/orders/chain routes.

## Files in This Directory

### Core Infrastructure

1. **[plugin-system/pluginLoader.ts](./plugin-system/pluginLoader.ts)**
   - Loads WASM plugins from R2
   - Manages plugin lifecycle
   - Caches loaded plugins
   - **Deploy to**: `handsfree-tenant-router/src/plugins/pluginLoader.ts`

2. **[plugin-system/pluginHost.ts](./plugin-system/pluginHost.ts)**
   - Provides sandboxed access to D1, KV, R2
   - Implements permission checking
   - Host bindings for WASM imports
   - **Deploy to**: `handsfree-tenant-router/src/plugins/pluginHost.ts`

3. **[plugin-system/pluginResolver.ts](./plugin-system/pluginResolver.ts)**
   - Resolves plugins from two-tier registry
   - **Deploy to**: `handsfree-tenant-router/src/plugins/pluginResolver.ts`

### Examples

4. **[examples/hello-world-worker/](./examples/hello-world-worker/)**
   - Simple example worker plugin
   - Shows basic WASM structure
   - Demonstrates host bindings usage

## Integration Guide

### Step 1: Copy Files to Workers Repo

```bash
# From handsfree-restaurant-new/platform/workers directory:

# Create plugin system directory
mkdir -p src/plugins

# Copy reference implementations
cp /path/to/restaurant-pos-ai/docs/worker-integration-reference/plugin-system/* \
   src/plugins/
```

### Step 2: Update Worker Index

In `handsfree-tenant-router/src/index.ts`:

```typescript
import { PluginLoader } from './plugins/pluginLoader';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle plugin API requests
    if (url.pathname.startsWith('/api/plugin/')) {
      return handlePluginRequest(request, env, ctx);
    }

    // ... existing routing
  }
};

async function handlePluginRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  // /api/plugin/{pluginId}/{tenantId}/{endpoint}
  const pluginId = pathParts[3];
  const tenantId = pathParts[4];

  try {
    // Load plugin
    const loader = new PluginLoader(env);
    const plugin = await loader.load(pluginId, tenantId);

    // Invoke plugin's fetch handler
    if (plugin.fetch) {
      return await plugin.fetch(request);
    }

    return new Response('Plugin does not have fetch handler', { status: 404 });
  } catch (error) {
    console.error('Plugin error:', error);
    return new Response(`Plugin error: ${error.message}`, { status: 500 });
  }
}
```

### Step 3: Update Wrangler Config

In `handsfree-tenant-router/wrangler.toml`:

```toml
name = "handsfree-tenant-router"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Existing bindings
[[d1_databases]]
binding = "DB"
database_name = "handsfree-production"
database_id = "..."

# Plugin registry KV namespaces
[[kv_namespaces]]
binding = "PLUGIN_REGISTRY_GLOBAL"
id = "..."

[[kv_namespaces]]
binding = "PLUGIN_REGISTRY_TENANTS"
id = "..."

# Plugin storage KV
[[kv_namespaces]]
binding = "PLUGIN_KV"
id = "..."

# Plugin R2 bucket
[[r2_buckets]]
binding = "PLUGIN_BUCKET"
bucket_name = "handsfree-plugins"
```

### Step 4: Deploy

```bash
# Deploy to production
wrangler deploy

# Test plugin endpoint
curl https://handsfree-tenant-router.workers.dev/api/plugin/hello-world/tenant-123/greet
```

## Plugin Routing Patterns

### Pattern 1: Direct Plugin API

```
POST /api/plugin/{pluginId}/{tenantId}/{endpoint}
```

Example:
```bash
curl -X POST \
  https://handsfree-tenant-router.workers.dev/api/plugin/bar-management/cafe-123/closing-report \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-29"}'
```

### Pattern 2: Event-Driven Plugins

Worker can trigger plugins on events:

```typescript
// In worker event handler
async function onOrderCompleted(order: Order, env: Env) {
  const loader = new PluginLoader(env);

  // Load loyalty plugin
  const loyaltyPlugin = await loader.load('loyalty-rewards', order.tenant_id);

  // Invoke event handler
  await loyaltyPlugin.invoke('on_order_completed', JSON.stringify(order));
}
```

### Pattern 3: Scheduled Plugin Execution

```typescript
// In scheduled event handler
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const loader = new PluginLoader(env);

    // Load all plugins with scheduled tasks
    const plugins = await getScheduledPlugins(env);

    for (const { pluginId, tenantId } of plugins) {
      const plugin = await loader.load(pluginId, tenantId);
      await plugin.invoke('scheduled', JSON.stringify({ time: event.scheduledTime }));
    }
  }
};
```

## Security Considerations

### Permission Enforcement

The `pluginHost.ts` enforces permissions before allowing access:

```typescript
// Plugin manifest declares:
{
  "requires_permissions": [
    "database.read.orders",
    "network.fetch.api.example.com"
  ]
}

// Host bindings check:
if (!hasPermission(context, 'database.read.*')) {
  throw new Error('Permission denied');
}
```

### Resource Limits

Set limits in worker code:

```typescript
// Timeout plugin execution
const timeout = 30000; // 30 seconds
const result = await Promise.race([
  plugin.invoke('process_data', data),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Plugin timeout')), timeout)
  )
]);
```

### Tenant Isolation

All plugin operations are scoped by tenant:

```typescript
// KV keys are automatically scoped
const scopedKey = `plugin:${pluginId}:${tenantId}:${key}`;

// Database queries should filter by tenant
const sql = 'SELECT * FROM orders WHERE tenant_id = ? AND ...';
```

## Testing

### Local Development

```bash
# Install dependencies
npm install @handsfree/plugin-sdk

# Run with wrangler dev
wrangler dev --local

# Test plugin endpoint
curl http://localhost:8787/api/plugin/hello-world/test-tenant/greet
```

### Unit Tests

```typescript
import { PluginLoader } from './plugins/pluginLoader';
import { describe, it, expect } from 'vitest';

describe('PluginLoader', () => {
  it('should load a plugin', async () => {
    const env = getMockEnv();
    const loader = new PluginLoader(env);

    const plugin = await loader.load('test-plugin', 'test-tenant');
    expect(plugin).toBeDefined();
    expect(plugin.manifest.id).toBe('test-plugin');
  });

  it('should cache loaded plugins', async () => {
    const loader = new PluginLoader(env);

    await loader.load('test-plugin', 'test-tenant');
    expect(loader.isLoaded('test-plugin', 'test-tenant')).toBe(true);
  });
});
```

## Deployment Checklist

- [ ] Copy plugin system files to workers repo
- [ ] Update worker index.ts with plugin routing
- [ ] Configure wrangler.toml bindings (KV, R2)
- [ ] Create R2 bucket `handsfree-plugins`
- [ ] Create KV namespaces for global + tenant registries
- [ ] Deploy worker with `wrangler deploy`
- [ ] Upload test plugin to R2
- [ ] Test plugin endpoint
- [ ] Set up monitoring/alerts

## Troubleshooting

### Plugin not found
- Check KV registry has plugin entry
- Verify R2 bucket has WASM file
- Check plugin resolution order (tenant override → custom → global)

### WASM instantiation error
- Verify WASM file checksum matches manifest
- Check host bindings match WASM imports
- Review WASM compilation target (wasm32-unknown-unknown)

### Permission denied errors
- Check plugin manifest declares required permissions
- Verify permission strings match expected format
- Review host bindings permission checks

## Next Steps

1. **Deploy to Workers Repo**: Copy these files to `handsfree-tenant-router`
2. **Create Example Plugin**: Build hello-world worker plugin
3. **Test Integration**: Verify POS app can call worker plugins
4. **Add Monitoring**: Track plugin performance and errors

## Resources

- [Cloudflare Workers WASM](https://developers.cloudflare.com/workers/runtime-apis/webassembly/)
- [Plugin SDK](../../packages/plugin-sdk/)
- [Infrastructure Setup](../infrastructure/plugin-registry-setup.md)

---

**Remember**: This is reference code. The actual deployment happens in the separate workers repository!
