# Multi-Location Plugin Deployment Status

## ✅ Completed Steps

### 1. Plugin Creation
- ✅ Created plugin structure in `plugins/multi-location/`
- ✅ Created manifest.json with update banner configuration
- ✅ Created migration SQL (001_location_tenants.sql)
- ✅ Created deployment scripts
- ✅ Created README documentation

### 2. R2 Upload
- ✅ Uploaded to `handsfree-plugins/plugins/multi-location/manifest.json`
- ✅ Uploaded to `handsfree-plugins/plugins/multi-location/migrations/001_location_tenants.sql`
- ✅ Uploaded to `handsfree-plugins/global/plugins/multi-location/` (versioned copies)

### 3. Update Banner Configuration
- ✅ Configured non-dismissible, high-priority update notification
- ✅ Set up changelog with migration notes

## ⚠️ Pending: R2 Bucket Public Access

The plugin files are uploaded to R2, but the bucket is currently **private**. The manifest URL returns "Unauthorized":

```
https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/multi-location/manifest.json
```

### To Complete Deployment

#### Option 1: Enable Public Access on R2 Bucket (Recommended)

Make the `handsfree-plugins` bucket public:

```bash
# Via Cloudflare Dashboard
1. Go to Cloudflare Dashboard → R2
2. Select "handsfree-plugins" bucket
3. Settings → Public Access → Enable
4. Configure custom domain or use r2.dev subdomain
```

Or via Wrangler:
```bash
wrangler r2 bucket domain add handsfree-plugins --domain handsfree-plugins.your-domain.com
```

#### Option 2: Use Plugin Registry Worker (Current Architecture)

The plugin registry worker at `workers/plugin-registry/` should proxy requests to R2:

```typescript
// Update worker to serve from R2
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/plugins/')) {
      // Proxy to R2
      const r2Key = url.pathname.slice(1); // Remove leading /
      const object = await env.PLUGIN_STORAGE.get(r2Key);

      if (object) {
        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType || 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
```

Then deploy the worker:
```bash
cd workers/plugin-registry
wrangler deploy
```

## 🔧 Quick Fix: Use Alternative Approach

### Temporary Solution (For Immediate Testing)

Since the R2 bucket isn't public yet, you can test the plugin locally:

1. **Use the Tauri backend to install from local files**:
   ```typescript
   // Modify plugin.rs to support local:// URLs
   let manifest_url = if plugin_id.starts_with("local:") {
       format!("file://{}", plugin_id.strip_prefix("local:").unwrap())
   } else {
       format!("https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/{}/manifest.json", plugin_id)
   };
   ```

2. **Or manually execute the migration**:
   ```typescript
   // In app console
   import { invoke } from '@tauri-apps/api/core';

   // Read migration SQL
   const sql = await fetch('/plugins/multi-location/migrations/001_location_tenants.sql').then(r => r.text());

   // Execute via database
   await invoke('execute_sql', { sql });
   ```

## 📊 Current Architecture

```
POS App
   ↓ (requests plugin)
install_plugin('multi-location')
   ↓
Tauri Backend (plugin.rs)
   ↓ (downloads manifest)
https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/multi-location/manifest.json
   ↓ ❌ Returns "Unauthorized"
[BLOCKED - Bucket not public]
```

### What Should Happen

```
POS App
   ↓
install_plugin('multi-location')
   ↓
Tauri Backend
   ↓
R2 Bucket (public) OR Plugin Registry Worker
   ↓ ✅ Returns manifest.json
   ↓
Download migration SQL
   ↓
Execute migration
   ↓
Tables created!
```

## 🎯 Recommended Next Steps

### For Production Deployment

1. **Enable R2 Public Access**:
   - Go to Cloudflare Dashboard
   - R2 → handsfree-plugins → Settings
   - Enable public access
   - Note the public URL

2. **Update plugin.rs** if the public URL is different:
   ```rust
   let manifest_url = format!(
       "https://your-public-r2-url/plugins/{}/manifest.json",
       plugin_id
   );
   ```

3. **Test installation**:
   ```bash
   # From POS app
   await invoke('install_plugin', { pluginId: 'multi-location' })
   ```

4. **Verify**:
   ```sql
   SELECT name FROM sqlite_master
   WHERE type='table'
   AND name IN ('restaurant_chains', 'location_tenants');
   ```

### For Immediate Local Testing

1. **Create a simple HTTP server** to serve the plugin files:
   ```bash
   cd plugins
   python3 -m http.server 8080
   ```

2. **Update plugin.rs temporarily** to point to localhost:
   ```rust
   let manifest_url = format!(
       "http://localhost:8080/multi-location/manifest.json"
   );
   ```

3. **Install and test**

## 📝 Files Ready for Deployment

All files are created and ready:

- ✅ `plugins/multi-location/manifest.json`
- ✅ `plugins/multi-location/migrations/001_location_tenants.sql`
- ✅ `plugins/multi-location/README.md`
- ✅ `plugins/multi-location/deploy-plugin.sh`
- ✅ R2 uploads complete (just need public access)

## 🚀 Once R2 is Public

The plugin will:
1. Appear in the plugin store automatically
2. Show a high-priority update notification
3. Install with one click
4. Create the missing tables
5. Fix the "no such table" errors
6. Enable full multi-location functionality

---

**Status**: ⚠️ Waiting for R2 Public Access Configuration
**Next Action**: Enable public access on handsfree-plugins R2 bucket
**Time Estimate**: 5 minutes once R2 is configured
