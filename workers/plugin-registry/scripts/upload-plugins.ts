/**
 * Upload Sample Plugins to Cloudflare R2 and KV
 *
 * Usage: bun run scripts/upload-plugins.ts
 *
 * This script:
 * 1. Reads sample plugin manifests from plugins/sample-plugins/
 * 2. Uploads metadata to KV namespace
 * 3. Creates a plugin index in KV
 * 4. (Optional) Uploads placeholder WASM files to R2
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

// Cloudflare API configuration
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const KV_NAMESPACE_ID = process.env.PLUGIN_METADATA_KV_ID;

if (!ACCOUNT_ID || !API_TOKEN || !KV_NAMESPACE_ID) {
  console.error('Missing required environment variables:');
  console.error('- CLOUDFLARE_ACCOUNT_ID');
  console.error('- CLOUDFLARE_API_TOKEN');
  console.error('- PLUGIN_METADATA_KV_ID');
  process.exit(1);
}

const KV_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}`;

/**
 * Upload a key-value pair to KV
 */
async function uploadToKV(key: string, value: string): Promise<void> {
  const response = await fetch(`${KV_API_BASE}/values/${key}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'text/plain',
    },
    body: value,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to KV: ${error}`);
  }

  console.log(`✓ Uploaded to KV: ${key}`);
}

/**
 * Main upload function
 */
async function uploadPlugins() {
  console.log('🚀 Starting plugin upload...\n');

  // Read sample plugin manifests
  const pluginsDir = join(process.cwd(), '../../plugins/sample-plugins');
  const files = await readdir(pluginsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} plugin manifest(s)\n`);

  const pluginIds: string[] = [];

  // Upload each plugin manifest to KV
  for (const file of jsonFiles) {
    const filePath = join(pluginsDir, file);
    const content = await readFile(filePath, 'utf-8');
    const manifest = JSON.parse(content);

    console.log(`📦 Uploading plugin: ${manifest.name} (${manifest.id})`);

    // Upload manifest to KV with key: plugin:{id}
    await uploadToKV(`plugin:${manifest.id}`, content);

    pluginIds.push(manifest.id);

    // Add empty reviews array for this plugin
    await uploadToKV(`reviews:${manifest.id}`, JSON.stringify([]));

    console.log('');
  }

  // Create plugin index
  console.log('📋 Creating plugin index...');
  await uploadToKV('plugin-index', JSON.stringify(pluginIds));

  console.log('\n✅ All plugins uploaded successfully!');
  console.log(`\nTotal plugins: ${pluginIds.length}`);
  console.log('Plugin IDs:', pluginIds.join(', '));
}

// Run the upload
uploadPlugins().catch(error => {
  console.error('❌ Error uploading plugins:', error);
  process.exit(1);
});
