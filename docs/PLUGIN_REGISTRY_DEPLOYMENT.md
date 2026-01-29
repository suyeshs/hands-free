# Plugin Registry Deployment Guide

This guide walks you through deploying the HandsFree Plugin Registry to Cloudflare Workers.

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Logged into Wrangler (`wrangler login`)
- Cloudflare account ID and API token

## Architecture Overview

The plugin registry consists of:

1. **Cloudflare Worker** - Serves plugin API endpoints
2. **R2 Bucket** - Stores WASM files and assets
3. **KV Namespace** - Stores plugin metadata, reviews, and index

```
┌─────────────────────────────────────────────────────────────┐
│  POS App (Tauri Desktop/Web)                                 │
│  - Fetches plugin list from Worker                           │
│  - Downloads WASM from R2 (via Worker)                       │
│  - Submits reviews to Worker                                 │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS
                 │
┌────────────────▼────────────────────────────────────────────┐
│  Cloudflare Worker (Plugin Registry)                         │
│  - /list - List all plugins                                  │
│  - /search - Search & filter plugins                         │
│  - /info/{id} - Get plugin details                           │
│  - /{id}/reviews - Get/post reviews                          │
│  - /download/{id}/{version}/{type} - Download WASM           │
└─────┬─────────────────────┬──────────────────────────────────┘
      │                     │
      │                     │
┌─────▼────────┐   ┌────────▼────────┐
│  KV Namespace │   │   R2 Bucket     │
│  - Metadata   │   │   - WASM files  │
│  - Reviews    │   │   - Assets      │
│  - Index      │   │                 │
└───────────────┘   └─────────────────┘
```

## Step 1: Install Dependencies

```bash
cd workers/plugin-registry
bun install
```

## Step 2: Create Cloudflare Resources

### 2.1 Create R2 Buckets

```bash
# Production bucket
wrangler r2 bucket create handsfree-plugins

# Preview bucket (for testing)
wrangler r2 bucket create handsfree-plugins-preview
```

Expected output:
```
Created bucket 'handsfree-plugins' with default storage class set to Standard.
Created bucket 'handsfree-plugins-preview' with default storage class set to Standard.
```

### 2.2 Create KV Namespaces

```bash
# Production KV namespace
wrangler kv:namespace create "PLUGIN_METADATA"

# Preview KV namespace
wrangler kv:namespace create "PLUGIN_METADATA" --preview
```

Expected output:
```
🌀 Creating namespace with title "handsfree-plugin-registry-PLUGIN_METADATA"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "PLUGIN_METADATA", id = "abc123..." }

🌀 Creating namespace with title "handsfree-plugin-registry-PLUGIN_METADATA_preview"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "PLUGIN_METADATA", preview_id = "xyz789..." }
```

### 2.3 Update wrangler.toml

Copy the namespace IDs from the output above and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "PLUGIN_METADATA"
id = "abc123..."  # Replace with your production ID
preview_id = "xyz789..."  # Replace with your preview ID
```

## Step 3: Upload Sample Plugins to KV

### 3.1 Set Environment Variables

Get your Cloudflare Account ID:
```bash
wrangler whoami
```

Create an API token at: https://dash.cloudflare.com/profile/api-tokens
- Use the "Edit Cloudflare Workers" template
- Add "Workers KV Storage:Edit" permission

Set environment variables:

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id-from-whoami"
export CLOUDFLARE_API_TOKEN="your-api-token-from-dashboard"
export PLUGIN_METADATA_KV_ID="your-production-kv-id-from-step-2.2"
```

### 3.2 Run Upload Script

```bash
bun run upload-plugins
```

Expected output:
```
🚀 Starting plugin upload...

Found 7 plugin manifest(s)

📦 Uploading plugin: Bar Management Pro (bar-management-v2)
✓ Uploaded to KV: plugin:bar-management-v2
✓ Uploaded to KV: reviews:bar-management-v2

📦 Uploading plugin: Multi-Location Sync (multi-location-sync)
✓ Uploaded to KV: plugin:multi-location-sync
...

📋 Creating plugin index...
✓ Uploaded to KV: plugin-index

✅ All plugins uploaded successfully!

Total plugins: 7
Plugin IDs: bar-management-v2, multi-location-sync, ...
```

## Step 4: Deploy Worker

### 4.1 Deploy to Preview (for testing)

```bash
wrangler deploy --env preview
```

### 4.2 Deploy to Production

```bash
wrangler deploy
```

Expected output:
```
Total Upload: 15.23 KiB / gzip: 4.56 KiB
Uploaded handsfree-plugin-registry (1.23 sec)
Published handsfree-plugin-registry (0.45 sec)
  https://handsfree-plugin-registry.YOUR-SUBDOMAIN.workers.dev
Current Deployment ID: abc-123-def-456
```

**Save this URL!** You'll need it to configure the POS app.

## Step 5: Test the Worker

### 5.1 Test List Endpoint

```bash
curl https://handsfree-plugin-registry.YOUR-SUBDOMAIN.workers.dev/list
```

Expected: JSON array of 7 plugins

### 5.2 Test Search Endpoint

```bash
curl "https://handsfree-plugin-registry.YOUR-SUBDOMAIN.workers.dev/search?query=bar&sortBy=rating"
```

Expected: JSON array filtered by "bar"

### 5.3 Test Plugin Info

```bash
curl https://handsfree-plugin-registry.YOUR-SUBDOMAIN.workers.dev/info/bar-management-v2
```

Expected: JSON object with plugin metadata

## Step 6: Configure POS App

### 6.1 Update Environment Variables

Create or update `.env.local` in the POS app root:

```bash
# Disable mock registry
VITE_USE_MOCK_REGISTRY=false

# Set production registry URL (replace with your Worker URL from Step 4.2)
VITE_PLUGIN_REGISTRY_URL=https://handsfree-plugin-registry.YOUR-SUBDOMAIN.workers.dev
```

### 6.2 Restart Dev Server

```bash
# Stop current dev server (Ctrl+C)
# Start with new environment variables
bun tauri dev
```

### 6.3 Verify Production Registry

1. Open the app
2. Navigate to **Settings** → **Plugins & Extensions** → **Plugin Store**
3. Check browser console for log: `[PluginManager] Using production registry`
4. You should see 7 plugins loaded from Cloudflare

## Step 7: Monitor and Debug

### View Real-Time Logs

```bash
wrangler tail
```

This shows all requests to your worker in real-time.

### View KV Data

```bash
# List all keys
wrangler kv:key list --namespace-id=YOUR_KV_ID

# Get a specific key
wrangler kv:key get "plugin:bar-management-v2" --namespace-id=YOUR_KV_ID
```

### Check R2 Bucket

```bash
wrangler r2 object list handsfree-plugins
```

## Production Deployment Checklist

- [ ] R2 bucket created (`handsfree-plugins`)
- [ ] KV namespace created and IDs updated in `wrangler.toml`
- [ ] Sample plugins uploaded to KV
- [ ] Worker deployed successfully
- [ ] Worker URL saved and added to POS app `.env.local`
- [ ] POS app tested with production registry
- [ ] CORS configured for production domains
- [ ] API token permissions verified
- [ ] Monitoring set up (optional: Cloudflare dashboard)

## Updating Plugins

To add or update plugins:

1. Edit or add JSON files in `plugins/sample-plugins/`
2. Run upload script: `bun run upload-plugins`
3. No worker redeployment needed - changes are instant!

## Rollback

If something goes wrong:

```bash
# Re-enable mock registry in POS app
echo "VITE_USE_MOCK_REGISTRY=true" >> .env.local

# Restart dev server
bun tauri dev
```

## Custom Domain (Optional)

To use a custom domain (e.g., `plugins.handsfree.tech`):

1. Add domain in Cloudflare dashboard: **Workers** → **handsfree-plugin-registry** → **Triggers** → **Add Custom Domain**
2. Update `VITE_PLUGIN_REGISTRY_URL` in `.env.local`
3. Update `ALLOWED_ORIGINS` in `wrangler.toml` to include your production domain

## Cost Estimate

Cloudflare Workers pricing (as of 2024):

- **Workers**: Free tier includes 100,000 requests/day
- **KV**: Free tier includes 100,000 reads/day, 1,000 writes/day, 1GB storage
- **R2**: Free tier includes 10GB storage, 1M Class A operations/month

For a small restaurant with 10 installations:
- ~1,000 plugin list requests/day = **FREE**
- ~50 plugin downloads/day = **FREE**
- 7 plugins × 2KB metadata = **14KB storage = FREE**

**Estimated cost: $0/month** (well within free tier)

## Troubleshooting

### "Plugin not found" errors

Run the upload script again:
```bash
bun run upload-plugins
```

### CORS errors in browser console

Update `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy:
```bash
wrangler deploy
```

### KV writes failing

Check your API token has "Workers KV Storage:Edit" permission.

### R2 access denied

Ensure R2 bucket binding is correct in `wrangler.toml`.

## Support

- **Documentation**: [workers/plugin-registry/README.md](../workers/plugin-registry/README.md)
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/
