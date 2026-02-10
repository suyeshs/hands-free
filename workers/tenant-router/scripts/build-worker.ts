/**
 * Build Tenant Worker Bundle
 *
 * This script bundles the tenant worker and saves it locally.
 * Upload to R2 separately using: wrangler r2 object put
 *
 * Usage:
 *   npm run build:worker
 */

import { build } from 'esbuild';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

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
  });

  if (result.outputFiles && result.outputFiles.length > 0) {
    const bundledCode = result.outputFiles[0].text;
    console.log(`[Build] Bundled ${bundledCode.length} bytes`);
    return bundledCode;
  }

  throw new Error('Failed to bundle tenant worker');
}

// Main
(async () => {
  try {
    console.log('[Build] Starting tenant worker build...');
    console.log('');

    const workerScript = await bundleTenantWorker();

    // Save to dist directory
    const outputPath = join(__dirname, '../dist/tenant-worker-bundle.js');
    const outputDir = dirname(outputPath);

    // Create dist directory if it doesn't exist
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(outputPath, workerScript, 'utf-8');

    console.log(`[Build] ✅ Saved to: ${outputPath}`);
    console.log(`[Build] Size: ${workerScript.length} bytes`);
    console.log('');
    console.log('[Build] To upload to R2, run:');
    console.log('  wrangler r2 object put handsfree-schemas/workers/tenant-worker-bundle.js --file=dist/tenant-worker-bundle.js');
    console.log('');
    process.exit(0);
  } catch (error: any) {
    console.error('[Build] ❌ Error:', error.message);
    process.exit(1);
  }
})();
