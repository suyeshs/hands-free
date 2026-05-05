/**
 * Build Tenant Worker and Upload to R2
 *
 * This script bundles the tenant worker and uploads it to R2
 * so the provisioning worker can deploy it automatically.
 *
 * Usage:
 *   npm run build:tenant-worker
 */

import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '0f3287b287060e3215662501ee96292e';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const R2_BUCKET_NAME = 'handsfree-schemas';
const R2_OBJECT_KEY = 'workers/tenant-worker-bundle.js';

async function bundleTenantWorker(): Promise<string> {
  console.log('[Build] Bundling tenant worker...');

  const result = await build({
    entryPoints: [join(__dirname, '../tenant-worker/src/index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'esnext',
    minify: true,
    sourcemap: false,
    platform: 'browser',
    conditions: ['worker', 'browser'],
    external: ['crypto'],
  });

  if (result.outputFiles && result.outputFiles.length > 0) {
    const bundledCode = result.outputFiles[0].text;
    console.log(`[Build] Bundled ${bundledCode.length} bytes`);
    return bundledCode;
  }

  throw new Error('Failed to bundle tenant worker');
}

async function uploadToR2(workerScript: string): Promise<void> {
  let apiToken = CLOUDFLARE_API_TOKEN;

  if (!apiToken) {
    console.log('[Upload] No API token in env, reading from wrangler OAuth config...');

    // Try multiple possible locations for wrangler config
    const configPaths = [
      join(process.env.HOME || '', 'Library/Preferences/.wrangler/config/default.toml'),
      join(process.env.HOME || '', '.wrangler/config/default.toml'),
    ];

    for (const configPath of configPaths) {
      try {
        const configContent = readFileSync(configPath, 'utf-8');
        const tokenMatch = configContent.match(/oauth_token\s*=\s*"([^"]+)"/);
        if (tokenMatch) {
          apiToken = tokenMatch[1];
          console.log('[Upload] Found wrangler OAuth token');
          break;
        }
      } catch {
        // Try next path
      }
    }
  }

  if (!apiToken) {
    console.error('[Upload] No API token available');
    console.error('[Upload] Either:');
    console.error('  1. Set CLOUDFLARE_API_TOKEN environment variable');
    console.error('  2. Run: wrangler login');
    process.exit(1);
  }

  console.log(`[Upload] Uploading to R2: ${R2_BUCKET_NAME}/${R2_OBJECT_KEY}...`);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects/${R2_OBJECT_KEY}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/javascript',
      },
      body: workerScript,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Upload] Upload failed:', error);
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  console.log(`[Upload] ✅ Successfully uploaded to R2`);
  console.log(`[Upload] Location: ${R2_BUCKET_NAME}/${R2_OBJECT_KEY}`);
  console.log(`[Upload] Size: ${workerScript.length} bytes`);
}

// Main
(async () => {
  try {
    console.log('[Build] Starting tenant worker build and upload...');
    console.log('');

    const workerScript = await bundleTenantWorker();
    await uploadToR2(workerScript);

    console.log('');
    console.log('[Build] ✅ Done!');
    console.log('[Build] Tenant worker is now ready for automated provisioning.');
    process.exit(0);
  } catch (error: any) {
    console.error('[Build] ❌ Error:', error.message);
    process.exit(1);
  }
})();
