# Vision AI Plugin - Upload Instructions

## Prerequisites
- Wrangler CLI installed ✅
- Cloudflare credentials configured

## Upload Steps

### 1. Upload WASM files to R2
```bash
cd /Users/stonepot-tech/projects/restaurant-pos-ai/plugins
./upload-wasm-to-r2.sh
```

This will upload:
- `vision-client.wasm` to R2 bucket at `global/plugins/vision-ai/1.0.0/vision-client.wasm`
- `vision-worker.wasm` to R2 bucket at `global/plugins/vision-ai/1.0.0/vision-worker.wasm`

### 2. Upload manifest to Plugin Registry KV
```bash
cd /Users/stonepot-tech/projects/restaurant-pos-ai/workers/plugin-registry
bun run scripts/upload-plugins.ts
```

This will:
- Read `plugins/sample-plugins/vision-ai.json`
- Upload to KV as `plugin:vision-ai`
- Update the plugin index

### 3. Verify in App
After uploading, test the plugin installation in your app:
1. Open the Plugin Store
2. Search for "Vision AI"
3. Click Install
4. The plugin should download and install without the "does not have client WASM" error

## Local Testing (Alternative)

If you want to test locally without uploading:
1. Run the local plugin registry worker:
   ```bash
   cd workers/plugin-registry
   bun run dev
   ```

2. Update your app's plugin registry URL to point to local:
   ```typescript
   // In src/services/plugins/pluginManager.ts
   registryUrl: 'http://localhost:8787/plugins'
   ```

## Files Modified
- ✅ `plugins/sample-plugins/vision-ai.json` - Added frontend/backend sections
- ✅ `plugins/upload-wasm-to-r2.sh` - Added vision-ai to upload list
- ✅ `dist/plugins/vision-ai/` - Created with WASM files ready

## Troubleshooting

**Error: "Plugin vision-ai does not have client WASM"**
- Cause: Manifest missing `frontend.wasm` field
- Fix: Already fixed in this update

**Error: "Failed to download WASM"**
- Cause: WASM files not uploaded to R2
- Fix: Run the upload script (Step 1)

**Error: "Plugin vision-ai not found in registry"**
- Cause: Manifest not uploaded to KV
- Fix: Run the metadata upload script (Step 2)
