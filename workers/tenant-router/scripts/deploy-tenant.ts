/**
 * Deploy Tenant Worker to handsfree-tenants dispatch namespace
 *
 * Usage:
 *   npx tsx scripts/deploy-tenant.ts <tenantId> <databaseId>
 *
 * Example:
 *   npx tsx scripts/deploy-tenant.ts khao-piyo-7766 42180598-d587-44a3-b867-c2624a891716
 */

import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '0f3287b287060e3215662501ee96292e';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DISPATCH_NAMESPACE = 'handsfree-tenants';

async function bundleTenantWorker(): Promise<string> {
  const result = await build({
    entryPoints: [join(__dirname, '../tenant-worker/src/index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'esnext',
    minify: true,
    sourcemap: false,
    // Node.js built-ins are provided at runtime by the nodejs_compat flag
    external: ['node:crypto', 'crypto', 'node:buffer', 'buffer'],
    platform: 'browser',
    conditions: ['workerd', 'worker', 'browser'],
  });

  if (result.outputFiles && result.outputFiles.length > 0) {
    return result.outputFiles[0].text;
  }

  throw new Error('Failed to bundle tenant worker');
}

async function deployTenantWorker(tenantId: string, databaseId: string): Promise<void> {
  let apiToken = CLOUDFLARE_API_TOKEN;

  if (!apiToken) {
    console.log('[Deploy] No API token in env, reading from wrangler OAuth config...');

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
          console.log('[Deploy] Found wrangler OAuth token');
          break;
        }
      } catch {
        // Try next path
      }
    }
  }

  if (!apiToken) {
    console.error('[Deploy] No API token available');
    console.error('[Deploy] Either:');
    console.error('  1. Set CLOUDFLARE_API_TOKEN environment variable');
    console.error('  2. Run: wrangler login');
    process.exit(1);
  }
  const workerName = `tenant-${tenantId}`;

  console.log(`[Deploy] Bundling tenant worker...`);
  const workerScript = await bundleTenantWorker();
  console.log(`[Deploy] Bundled ${workerScript.length} bytes`);

  // Create metadata for the worker
  const metadata = {
    main_module: 'worker.js',
    bindings: [
      {
        type: 'd1',
        name: 'DB',
        id: databaseId,
      },
      {
        type: 'd1',
        name: 'TENANTS_DB',
        id: 'b2b7e8a8-c297-4176-be12-106f9471090c', // handsfree-tenants
      },
      {
        type: 'kv_namespace',
        name: 'TENANT_METADATA',
        namespace_id: 'a9644721cac748608d3b15bf2095436b',
      },
      {
        type: 'service',
        name: 'TOKEN_MANAGER',
        service: 'handsfree-token-manager',
      },
    ],
    compatibility_date: '2024-12-18',
    compatibility_flags: ['nodejs_compat'],
  };

  // Create multipart form data
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  let body = '';

  // Add metadata part
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="metadata"\r\n`;
  body += `Content-Type: application/json\r\n\r\n`;
  body += JSON.stringify(metadata) + '\r\n';

  // Add worker script part
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n`;
  body += `Content-Type: application/javascript+module\r\n\r\n`;
  body += workerScript + '\r\n';

  // End boundary
  body += `--${boundary}--\r\n`;

  console.log(`[Deploy] Deploying ${workerName} to ${DISPATCH_NAMESPACE}...`);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${DISPATCH_NAMESPACE}/scripts/${workerName}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const error = await response.json() as any;
    console.error('[Deploy] Deployment failed:', error);
    throw new Error(`Deployment failed: ${error.errors?.[0]?.message || response.statusText}`);
  }

  const result = await response.json() as any;
  console.log(`[Deploy] ✅ Successfully deployed ${workerName}`);
  console.log(`[Deploy] Script ID: ${result.result?.id || workerName}`);
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: npx tsx scripts/deploy-tenant.ts <tenantId> <databaseId>');
  console.log('');
  console.log('Example:');
  console.log('  npx tsx scripts/deploy-tenant.ts khao-piyo-7766 42180598-d587-44a3-b867-c2624a891716');
  console.log('');
  console.log('Known tenants:');
  console.log('  khao-piyo-7766          42180598-d587-44a3-b867-c2624a891716');
  console.log('  coorg-food-company-6163 ad7d6f69-594d-4651-8250-4ec3fdb28435');
  process.exit(1);
}

const [tenantId, databaseId] = args;

deployTenantWorker(tenantId, databaseId)
  .then(() => {
    console.log('[Deploy] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Deploy] Error:', error.message);
    process.exit(1);
  });
