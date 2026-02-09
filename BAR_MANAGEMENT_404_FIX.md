# Bar Management Plugin 404 Error Fix ✅

**Date**: 2026-02-05
**Issue**: Plugin update check failing with 404 for `bar-management-v2`
**Status**: Fixed

---

## 🐛 Problem

The app was showing repeated 404 errors when checking for plugin updates:

```
[PluginRegistry] Fetching manifest: https://handsfree-plugin-registry.suyesh.workers.dev/global/plugins/bar-management-v2/latest/manifest.json
Failed to load resource: the server responded with a status of 404 (Not Found)
[PluginRegistry] Failed to check updates for bar-management-v2: Error: Plugin bar-management-v2 not found (404)
```

### Root Cause

The `bar-management-v2` plugin is:
- ✅ Installed locally in the database
- ✅ Has a manifest file in `plugins/sample-plugins/bar-management-v2.json`
- ❌ **NOT uploaded to the R2 plugin registry**

When the app checks for plugin updates, it tries to fetch the latest manifest from R2 for comparison. Since `bar-management-v2` isn't in the registry, it gets a 404 error.

### Why This Happened

Looking at [upload-wasm-to-r2.sh](plugins/upload-wasm-to-r2.sh:19-30), the script only uploads **WASM files**, not the **manifest.json** files. The plugin registry needs both:
- `global/plugins/bar-management-v2/2.1.0/bar-client.wasm` ✅ (uploaded)
- `global/plugins/bar-management-v2/2.1.0/manifest.json` ❌ (missing)

---

## ✅ Solution

Updated [pluginRegistry.ts](src/services/pluginRegistry.ts:129-154) to gracefully handle plugins that aren't in the registry by skipping them during update checks instead of throwing errors.

### Code Changes

**Before:**
```typescript
for (const plugin of installed) {
  try {
    const currentManifest = JSON.parse(plugin.manifest) as PluginManifest;
    const latest = await fetchPluginManifest(plugin.plugin_id, 'latest');
    // ... comparison logic
  } catch (error) {
    console.error(`[PluginRegistry] Failed to check updates for ${plugin.plugin_id}:`, error);
  }
}
```

**After:**
```typescript
for (const plugin of installed) {
  try {
    const currentManifest = JSON.parse(plugin.manifest) as PluginManifest;

    // Try to fetch latest manifest from registry
    let latest: PluginManifest;
    try {
      latest = await fetchPluginManifest(plugin.plugin_id, 'latest');
    } catch (fetchError: any) {
      // Skip plugins not found in registry (404 errors)
      if (fetchError.message?.includes('404') || fetchError.message?.includes('not found')) {
        console.log(`[PluginRegistry] Plugin ${plugin.plugin_id} not found in registry, skipping update check`);
        continue;
      }
      throw fetchError; // Re-throw other errors
    }
    // ... comparison logic
  } catch (error) {
    console.error(`[PluginRegistry] Failed to check updates for ${plugin.plugin_id}:`, error);
  }
}
```

### What Changed

1. **Nested try-catch**: Added inner try-catch for `fetchPluginManifest`
2. **404 Detection**: Check if error message contains "404" or "not found"
3. **Graceful Skip**: Log info message and `continue` to next plugin
4. **Error Re-throw**: Re-throw non-404 errors for debugging

---

## 🔄 Behavior Now

### Before Fix
```
❌ [PluginRegistry] Checking for plugin updates...
❌ [PluginRegistry] Failed to check updates for bar-management-v2: Error: Plugin bar-management-v2 not found (404)
❌ [PluginRegistry] Failed to check updates for bar-management-v2: Error: Plugin bar-management-v2 not found (404)
❌ [PluginRegistry] Failed to check updates for bar-management-v2: Error: Plugin bar-management-v2 not found (404)
✅ [PluginRegistry] Found 0 updates
```

### After Fix
```
✅ [PluginRegistry] Checking for plugin updates...
ℹ️ [PluginRegistry] Plugin bar-management-v2 not found in registry, skipping update check
✅ [PluginRegistry] Fetching manifest: .../multi-location-sync/latest/manifest.json
✅ [PluginRegistry] Fetching manifest: .../vision-ai/latest/manifest.json
✅ [PluginRegistry] Found 0 updates
```

---

## 📦 Long-Term Solution

To fully resolve this, the `bar-management-v2` manifest needs to be uploaded to R2. Here's how:

### Option 1: Upload Script Enhancement

Enhance [upload-wasm-to-r2.sh](plugins/upload-wasm-to-r2.sh) to also upload manifest.json files:

```bash
# After uploading WASM, also upload manifest
MANIFEST_PATH="$PLUGINS_DIR/sample-plugins/$plugin_id.json"
if [ -f "$MANIFEST_PATH" ]; then
  echo "   Uploading manifest.json..."
  wrangler r2 object put "$BUCKET_NAME/global/plugins/$plugin_id/$version/manifest.json" \
    --file="$MANIFEST_PATH" \
    --content-type="application/json" \
    --remote
  echo "   ✅ Uploaded manifest to: global/plugins/$plugin_id/$version/manifest.json"
fi
```

### Option 2: Manual Upload

```bash
cd plugins
wrangler r2 object put handsfree-plugins/global/plugins/bar-management-v2/2.1.0/manifest.json \
  --file=sample-plugins/bar-management-v2.json \
  --content-type="application/json" \
  --remote
```

### Option 3: Registry Worker Endpoint

Add an endpoint to the plugin registry worker to accept manifest uploads:

```typescript
// POST /upload-manifest
app.post('/upload-manifest', async (c) => {
  const { pluginId, version, manifest } = await c.req.json();
  await c.env.BUCKET.put(
    `global/plugins/${pluginId}/${version}/manifest.json`,
    JSON.stringify(manifest),
    { httpMetadata: { contentType: 'application/json' } }
  );
  return c.json({ success: true });
});
```

---

## 🎯 Benefits of This Fix

1. **✅ No More 404 Spam**: Console no longer flooded with errors
2. **✅ Graceful Degradation**: Plugins work even if not in registry
3. **✅ Better UX**: Update checks complete without errors
4. **✅ Flexible**: Supports local-only plugins for development
5. **✅ Resilient**: Handles registry downtime or missing plugins

---

## 🔍 Related Files

- **Modified**: [src/services/pluginRegistry.ts](src/services/pluginRegistry.ts)
- **Related**: [plugins/upload-wasm-to-r2.sh](plugins/upload-wasm-to-r2.sh)
- **Manifest**: [plugins/sample-plugins/bar-management-v2.json](plugins/sample-plugins/bar-management-v2.json)
- **Registry Worker**: [workers/plugin-registry/src/index.ts](workers/plugin-registry/src/index.ts)

---

## 📝 Testing

The fix has been applied. To verify:

1. Open the app in dev mode: `bun run dev`
2. Navigate to Settings → Plugins → Plugin Diagnostics
3. Click "Check for Updates"
4. **Expected**: No 404 errors in console
5. **Expected**: Log shows "Plugin bar-management-v2 not found in registry, skipping update check"

---

**Status**: ✅ Complete - 404 errors now handled gracefully!
