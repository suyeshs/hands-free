# Plugin Registry Worker

Cloudflare Worker that serves as the HandsFree Plugin Registry backend.

## Features

- 📦 Plugin metadata storage (KV)
- 🗄️ WASM file storage (R2)
- 🔍 Search and filter plugins
- ⭐ Plugin reviews and ratings
- 🌐 CORS support for cross-origin requests

## Setup

### 1. Install Dependencies

```bash
cd workers/plugin-registry
bun install
```

### 2. Create Cloudflare Resources

#### Create R2 Bucket

```bash
# Create production bucket
wrangler r2 bucket create handsfree-plugins

# Create preview bucket
wrangler r2 bucket create handsfree-plugins-preview
```

#### Create KV Namespace

```bash
# Create production KV namespace
wrangler kv:namespace create "PLUGIN_METADATA"

# Create preview KV namespace
wrangler kv:namespace create "PLUGIN_METADATA" --preview
```

This will output namespace IDs. Copy them to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "PLUGIN_METADATA"
id = "YOUR_PRODUCTION_ID_HERE"
preview_id = "YOUR_PREVIEW_ID_HERE"
```

### 3. Upload Sample Plugins

Set environment variables:

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
export PLUGIN_METADATA_KV_ID="your-kv-namespace-id"
```

Run the upload script:

```bash
bun run upload-plugins
```

This will upload all sample plugin manifests from `plugins/sample-plugins/` to KV.

### 4. Deploy Worker

```bash
# Deploy to production
wrangler deploy

# Deploy to preview
wrangler deploy --env preview
```

### 5. Get Worker URL

After deployment, Wrangler will output the worker URL:

```
Published handsfree-plugin-registry
  https://handsfree-plugin-registry.YOUR-SUBDOMAIN.workers.dev
```

Copy this URL - you'll need it to configure the POS app.

## API Endpoints

### List All Plugins

```
GET /list
```

Returns all available plugins.

### Search Plugins

```
GET /search?query=bar&category=Operations&verified=true&minRating=4.5&sortBy=rating&sortOrder=desc
```

Query parameters:
- `query` - Search term (searches name, description, tags)
- `category` - Filter by category
- `verified` - Filter by verified status (true/false)
- `minRating` - Minimum rating (0-5)
- `tags` - Comma-separated list of tags
- `sortBy` - Sort field (rating, downloads, updated, name)
- `sortOrder` - Sort order (asc, desc)

### Get Plugin Info

```
GET /info/{pluginId}
```

Returns metadata for a specific plugin.

### Get Plugin Reviews

```
GET /{pluginId}/reviews?limit=10
```

Returns reviews for a plugin.

### Submit Review

```
POST /{pluginId}/reviews
Content-Type: application/json

{
  "tenant_id": "tenant-123",
  "rating": 5,
  "comment": "Great plugin!",
  "plugin_version": "1.0.0"
}
```

### Download WASM

```
GET /download/{pluginId}/{version}/{type}
```

Example:
```
GET /download/bar-management-v2/2.1.0/client
```

Downloads the client or worker WASM file.

## Development

Run locally with Wrangler:

```bash
wrangler dev
```

This starts a local development server with hot reloading.

## Monitoring

View logs in real-time:

```bash
wrangler tail
```

## Environment Variables

Configure in `wrangler.toml`:

- `ENVIRONMENT` - Environment name (production, preview, development)
- `REGISTRY_URL` - Public URL of the registry
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

## Updating Plugin Manifest in POS App

After deploying, update the POS app to use the production registry:

1. Open `src/services/plugins/pluginManager.ts`
2. Update the default registry URL:

```typescript
constructor(tenantId: string, registryUrl?: string) {
  this.tenantId = tenantId;
  this.registryUrl = registryUrl || 'https://handsfree-plugin-registry.YOUR-SUBDOMAIN.workers.dev';
}
```

3. Set `USE_MOCK_REGISTRY` to `false` in production:

```typescript
// In mockPluginRegistry.ts
export const USE_MOCK_REGISTRY = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_REGISTRY !== 'false';
```

Or use an environment variable:

```bash
# In .env.production
VITE_USE_MOCK_REGISTRY=false
VITE_PLUGIN_REGISTRY_URL=https://handsfree-plugin-registry.YOUR-SUBDOMAIN.workers.dev
```

## Troubleshooting

### KV Namespace Not Found

Make sure you've created the KV namespace and updated the IDs in `wrangler.toml`.

### R2 Bucket Access Denied

Ensure your API token has R2 read/write permissions.

### CORS Errors

Check that your origin is included in `ALLOWED_ORIGINS` in `wrangler.toml`.

### Plugin Not Found

Run the upload script again to ensure all plugins are in KV:

```bash
bun run upload-plugins
```
