# Plugin Registry Infrastructure Setup

## Overview

This guide covers setting up the two-tier plugin registry infrastructure on Cloudflare.

## Architecture

### Single R2 Bucket with Path-Based Isolation

**Bucket Name**: `handsfree-plugins`

**Path Structure**:
```
handsfree-plugins/
├── global/
│   └── plugins/
│       ├── bar-management/
│       │   └── 1.0.0/
│       │       ├── manifest.json
│       │       ├── client.wasm
│       │       ├── worker.wasm
│       │       └── assets/
│       └── multi-location-sync/
│           └── 1.0.0/
│               ├── manifest.json
│               └── worker.wasm
├── tenants/
│   ├── cafe-mumbai-123/
│   │   └── plugins/
│   │       └── swiggy-zomato-integration/
│   │           └── 1.5.0/
│   │               ├── manifest.json
│   │               ├── client.wasm
│   │               └── worker.wasm
│   └── chain-enterprise-456/
│       └── plugins/
│           └── custom-erp-integration/
│               └── 3.2.0/
│                   ├── manifest.json
│                   └── worker.wasm
└── migrations/
    ├── manifest.json
    └── v3.0/
        ├── 001_bar_tables.sql
        └── 002_chain_tables.sql
```

### KV Namespaces

#### 1. PLUGIN_REGISTRY_GLOBAL
Stores global plugin metadata.

**Keys**:
- `plugin:{plugin-id}` → PluginRegistryEntry
- `plugin-index` → Array of plugin IDs
- `plugin-versions:{plugin-id}` → Array of versions

**Example**:
```
plugin:bar-management → {
  "manifest": { ... },
  "client_wasm_url": "https://pub-xxx.r2.dev/global/plugins/bar-management/1.0.0/client.wasm",
  "worker_wasm_url": "https://pub-xxx.r2.dev/global/plugins/bar-management/1.0.0/worker.wasm",
  "published_at": "2026-01-20T00:00:00Z",
  "verified": true,
  "download_count": 1250
}
```

#### 2. PLUGIN_REGISTRY_TENANTS
Stores all tenant-specific plugin metadata (key-prefixed isolation).

**Keys**:
- `tenant:{tenant-id}:plugin:{plugin-id}` → TenantPluginOverride or custom plugin
- `tenant:{tenant-id}:plugin-index` → Array of plugin IDs for this tenant
- `tenant:{tenant-id}:overrides:{plugin-id}` → Override configuration
- `tenant:{tenant-id}:installed` → Array of installed plugin IDs

**Example**:
```
tenant:cafe-mumbai-123:plugin:swiggy-zomato-integration → {
  "tenant_id": "cafe-mumbai-123",
  "plugin_id": "swiggy-zomato-integration",
  "custom_client_wasm_url": "https://pub-xxx.r2.dev/tenants/cafe-mumbai-123/plugins/swiggy-zomato-integration/1.5.0/client.wasm",
  "created_at": "2026-01-25T10:30:00Z"
}
```

## Setup Instructions

### Step 1: Create R2 Bucket

```bash
# Using Wrangler CLI
wrangler r2 bucket create handsfree-plugins

# Verify
wrangler r2 bucket list
```

**Expected Output**:
```
📦 Buckets
┌─────────────────────┬──────────────────────┐
│ Name                │ Created              │
├─────────────────────┼──────────────────────┤
│ handsfree-plugins   │ 2026-01-29 10:00:00  │
└─────────────────────┴──────────────────────┘
```

### Step 2: Create KV Namespaces

```bash
# Create global registry namespace
wrangler kv:namespace create "PLUGIN_REGISTRY_GLOBAL" --preview false

# Create tenant registry namespace
wrangler kv:namespace create "PLUGIN_REGISTRY_TENANTS" --preview false

# Create preview namespaces for dev/staging
wrangler kv:namespace create "PLUGIN_REGISTRY_GLOBAL" --preview
wrangler kv:namespace create "PLUGIN_REGISTRY_TENANTS" --preview
```

**Note the namespace IDs** returned. You'll need them for `wrangler.toml`.

**Expected Output**:
```
🌀 Creating namespace with title "handsfree-orders-PLUGIN_REGISTRY_GLOBAL"
✨ Success!
Add the following to your wrangler.toml:
{ binding = "PLUGIN_REGISTRY_GLOBAL", id = "abc123..." }

🌀 Creating namespace with title "handsfree-orders-PLUGIN_REGISTRY_TENANTS"
✨ Success!
Add the following to your wrangler.toml:
{ binding = "PLUGIN_REGISTRY_TENANTS", id = "def456..." }
```

### Step 3: Configure Worker Bindings

Update `workers/handsfree-orders/wrangler.jsonc` (or in platform repo):

```json
{
  "name": "handsfree-orders",
  "compatibility_date": "2024-01-01",
  "main": "src/index.ts",

  "kv_namespaces": [
    {
      "binding": "TENANT_METADATA",
      "id": "15fc93ae3a074ad7868caef4234edd71"
    },
    {
      "binding": "PLUGIN_REGISTRY_GLOBAL",
      "id": "abc123...",
      "preview_id": "abc123-preview..."
    },
    {
      "binding": "PLUGIN_REGISTRY_TENANTS",
      "id": "def456...",
      "preview_id": "def456-preview..."
    }
  ],

  "r2_buckets": [
    {
      "binding": "PLUGIN_STORAGE",
      "bucket_name": "handsfree-plugins",
      "preview_bucket_name": "handsfree-plugins-preview"
    }
  ]
}
```

### Step 4: Set Up CORS for R2

Configure CORS rules to allow client-side WASM loading:

```bash
# Create CORS configuration file
cat > r2-cors-config.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "http://localhost:1420",
        "https://pos.handsfree.com",
        "tauri://localhost"
      ],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

# Apply CORS config to R2 bucket
# Note: This requires Cloudflare API direct access
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/handsfree-plugins/cors" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data @r2-cors-config.json
```

### Step 5: Create Public R2 Domain

Enable public access for plugin downloads:

```bash
# Using Cloudflare Dashboard:
# 1. Go to R2 > handsfree-plugins
# 2. Settings > Public Access
# 3. Enable "Allow Access" via r2.dev subdomain
# 4. Note the public URL: https://pub-{hash}.r2.dev
```

**Result**: `https://pub-abc123.r2.dev/global/plugins/...`

### Step 6: Seed Initial Plugin Index

Create initial global plugin index:

```bash
# Using Wrangler KV CLI
wrangler kv:key put --namespace-id={PLUGIN_REGISTRY_GLOBAL_ID} \
  "plugin-index" \
  '["bar-management","multi-location-sync","aggregator-integration"]'

# Verify
wrangler kv:key get --namespace-id={PLUGIN_REGISTRY_GLOBAL_ID} "plugin-index"
```

### Step 7: Upload Test Plugin Manifest

Upload a test plugin manifest to R2:

```bash
# Create test manifest
cat > test-manifest.json <<EOF
{
  "id": "hello-world",
  "name": "Hello World Plugin",
  "version": "1.0.0",
  "description": "A simple test plugin",
  "author": "HandsFree Team",
  "type": "client",
  "visibility": "public",
  "target": {
    "client": true,
    "worker": false
  },
  "requires_app_version": ">=3.0.0",
  "requires_permissions": [],
  "frontend": {
    "wasm": "hello-world.wasm",
    "entry_point": "init"
  },
  "checksum": "sha256:placeholder",
  "created_at": "2026-01-29T00:00:00Z",
  "updated_at": "2026-01-29T00:00:00Z"
}
EOF

# Upload to R2
wrangler r2 object put handsfree-plugins/global/plugins/hello-world/1.0.0/manifest.json \
  --file=test-manifest.json

# Verify
wrangler r2 object get handsfree-plugins/global/plugins/hello-world/1.0.0/manifest.json
```

## Security Configuration

### Access Control

Implement tenant isolation in worker code:

```typescript
// src/pluginRegistry.ts
export async function getPluginForTenant(
  tenantId: string,
  pluginId: string,
  env: Env
): Promise<PluginResolution | null> {
  // 1. Check tenant-specific override
  const override = await env.PLUGIN_REGISTRY_TENANTS.get(
    `tenant:${tenantId}:overrides:${pluginId}`,
    'json'
  );

  if (override) {
    return {
      source: 'tenant-override',
      manifest: override.manifest,
      client_wasm_url: override.custom_client_wasm_url,
      worker_wasm_url: override.custom_worker_wasm_url,
    };
  }

  // 2. Check tenant-specific custom plugin
  const customPlugin = await env.PLUGIN_REGISTRY_TENANTS.get(
    `tenant:${tenantId}:plugin:${pluginId}`,
    'json'
  );

  if (customPlugin) {
    return {
      source: 'tenant-custom',
      manifest: customPlugin.manifest,
      client_wasm_url: customPlugin.custom_client_wasm_url,
      worker_wasm_url: customPlugin.custom_worker_wasm_url,
    };
  }

  // 3. Fall back to global registry
  const globalPlugin = await env.PLUGIN_REGISTRY_GLOBAL.get(
    `plugin:${pluginId}`,
    'json'
  );

  if (globalPlugin) {
    // Check tenant whitelist
    if (globalPlugin.manifest.tenant_whitelist?.length > 0 &&
        !globalPlugin.manifest.tenant_whitelist.includes(tenantId)) {
      return null; // Not allowed for this tenant
    }

    return {
      source: 'global',
      manifest: globalPlugin.manifest,
      client_wasm_url: globalPlugin.client_wasm_url,
      worker_wasm_url: globalPlugin.worker_wasm_url,
    };
  }

  return null; // Plugin not found
}
```

### Rate Limiting

Configure rate limits for plugin downloads:

```typescript
// In worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/plugins/')) {
      // Apply rate limit per tenant
      const tenantId = request.headers.get('X-Tenant-Id');
      const rateLimitKey = `ratelimit:plugins:${tenantId}`;

      const current = await env.PLUGIN_REGISTRY_TENANTS.get(rateLimitKey);
      const count = parseInt(current || '0', 10);

      // 100 plugin downloads per hour per tenant
      if (count >= 100) {
        return new Response('Rate limit exceeded', { status: 429 });
      }

      await env.PLUGIN_REGISTRY_TENANTS.put(
        rateLimitKey,
        String(count + 1),
        { expirationTtl: 3600 } // 1 hour
      );

      // Process request...
    }
  }
};
```

## Monitoring & Analytics

### Track Plugin Metrics

```typescript
// Update download count on plugin access
async function trackPluginDownload(
  pluginId: string,
  tenantId: string,
  env: Env
) {
  // Increment global download counter
  const plugin = await env.PLUGIN_REGISTRY_GLOBAL.get(`plugin:${pluginId}`, 'json');
  if (plugin) {
    plugin.download_count = (plugin.download_count || 0) + 1;
    await env.PLUGIN_REGISTRY_GLOBAL.put(`plugin:${pluginId}`, JSON.stringify(plugin));
  }

  // Track per-tenant installation
  const installedKey = `tenant:${tenantId}:installed`;
  const installed = await env.PLUGIN_REGISTRY_TENANTS.get(installedKey, 'json') || [];

  if (!installed.includes(pluginId)) {
    installed.push(pluginId);
    await env.PLUGIN_REGISTRY_TENANTS.put(installedKey, JSON.stringify(installed));
  }

  // Log to analytics (Cloudflare Analytics Engine)
  env.ANALYTICS?.writeDataPoint({
    blobs: [pluginId, tenantId],
    doubles: [1], // download count
    indexes: [`plugin-download`],
  });
}
```

## Cost Estimation

### R2 Storage Costs

**Assumptions**:
- 10 global plugins @ 5MB each = 50MB
- 100 tenants with 2 custom plugins each @ 3MB = 600MB
- Total: ~650MB

**Cost**: ~$0.015/month (first 10GB free)

### R2 Request Costs

**Assumptions**:
- 1,000 tenants × 5 plugins × 1 download/month = 5,000 reads
- Read operations: $0.36 per million = negligible

**Cost**: <$0.01/month

### KV Costs

**Assumptions**:
- 100 keys for global plugins
- 1,000 keys for tenant plugins (10 per tenant × 100 tenants)
- 10,000 reads/month

**Cost**: Included in Workers plan

### Total Monthly Cost

**~$0.02/month** (negligible, scales with usage)

## Backup & Disaster Recovery

### Automated Backups

```bash
# Backup script (run daily via GitHub Actions)
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/plugin-registry/$TIMESTAMP"

mkdir -p $BACKUP_DIR

# Backup R2 bucket structure
wrangler r2 object list handsfree-plugins --json > $BACKUP_DIR/r2-index.json

# Backup KV namespaces
wrangler kv:bulk get PLUGIN_REGISTRY_GLOBAL --namespace-id={id} > $BACKUP_DIR/kv-global.json
wrangler kv:bulk get PLUGIN_REGISTRY_TENANTS --namespace-id={id} > $BACKUP_DIR/kv-tenants.json

# Compress and upload to backup storage
tar -czf plugin-registry-$TIMESTAMP.tar.gz $BACKUP_DIR
# Upload to backup location (S3, GitHub, etc.)
```

## Troubleshooting

### Issue: Plugin not loading

**Check**:
1. Verify R2 public URL is accessible
2. Check CORS configuration
3. Verify KV key exists
4. Check tenant permissions

**Debug**:
```bash
# Check if plugin exists in R2
wrangler r2 object get handsfree-plugins/global/plugins/{plugin-id}/1.0.0/manifest.json

# Check if plugin metadata exists in KV
wrangler kv:key get --namespace-id={id} "plugin:{plugin-id}"
```

### Issue: Tenant can't access custom plugin

**Check**:
1. Verify tenant-specific R2 path exists
2. Check KV key prefix: `tenant:{tenant-id}:plugin:{plugin-id}`
3. Verify worker tenant isolation logic

### Issue: CORS errors when loading WASM

**Fix**:
1. Verify CORS rules on R2 bucket
2. Add Tauri origin: `tauri://localhost`
3. Check browser DevTools Network tab for CORS headers

## Next Steps

1. ✅ Create R2 bucket
2. ✅ Create KV namespaces
3. ✅ Configure worker bindings
4. ✅ Set up CORS
5. ✅ Create public domain
6. ⏭️ Implement plugin registry API in worker
7. ⏭️ Build client-side plugin manager
8. ⏭️ Test with hello-world plugin

---

**Last Updated**: 2026-01-29
**Owner**: Platform Team
**Status**: Setup Guide Ready
