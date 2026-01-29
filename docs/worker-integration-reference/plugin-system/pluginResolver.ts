/**
 * Worker Plugin Resolution Logic
 *
 * This is a copy of src/services/plugins/pluginResolver.ts adapted for Cloudflare Workers
 * Resolves plugins from the two-tier registry system
 */

import type { PluginManifest, PluginResolution } from '@handsfree/plugin-sdk/types';

export interface WorkerEnv {
  PLUGIN_BUCKET: R2Bucket;
  PLUGIN_REGISTRY_GLOBAL: KVNamespace;
  PLUGIN_REGISTRY_TENANTS: KVNamespace;
  [key: string]: unknown;
}

const PLUGIN_BUCKET_URL = 'https://handsfree-plugins.r2.cloudflarestorage.com';

/**
 * Resolve a plugin for worker-side execution
 * Resolution order: Tenant override → Tenant custom → Global
 */
export async function resolvePluginWorker(
  pluginId: string,
  tenantId: string,
  env: WorkerEnv
): Promise<PluginResolution | null> {
  // 1. Check tenant-specific override
  const overrideKey = `tenant:${tenantId}:overrides:${pluginId}`;
  const override = await env.PLUGIN_REGISTRY_TENANTS.get(overrideKey, 'json');

  if (override) {
    const manifest = override as PluginManifest;
    return {
      source: 'tenant-override',
      manifest,
      client_wasm_url: manifest.frontend?.wasm
        ? `${PLUGIN_BUCKET_URL}/tenants/${tenantId}/plugins/${pluginId}/${manifest.version}/${manifest.frontend.wasm}`
        : undefined,
      worker_wasm_url: manifest.backend?.wasm
        ? `${PLUGIN_BUCKET_URL}/tenants/${tenantId}/plugins/${pluginId}/${manifest.version}/${manifest.backend.wasm}`
        : undefined,
      assets_url: `${PLUGIN_BUCKET_URL}/tenants/${tenantId}/plugins/${pluginId}/${manifest.version}/assets/`,
    };
  }

  // 2. Check tenant-specific custom plugin
  const customPluginKey = `tenant:${tenantId}:plugin:${pluginId}`;
  const customPlugin = await env.PLUGIN_REGISTRY_TENANTS.get(customPluginKey, 'json');

  if (customPlugin) {
    const manifest = customPlugin as PluginManifest;
    return {
      source: 'tenant-custom',
      manifest,
      client_wasm_url: manifest.frontend?.wasm
        ? `${PLUGIN_BUCKET_URL}/tenants/${tenantId}/plugins/${pluginId}/${manifest.version}/${manifest.frontend.wasm}`
        : undefined,
      worker_wasm_url: manifest.backend?.wasm
        ? `${PLUGIN_BUCKET_URL}/tenants/${tenantId}/plugins/${pluginId}/${manifest.version}/${manifest.backend.wasm}`
        : undefined,
      assets_url: `${PLUGIN_BUCKET_URL}/tenants/${tenantId}/plugins/${pluginId}/${manifest.version}/assets/`,
    };
  }

  // 3. Fall back to global registry
  const globalPluginKey = `plugin:${pluginId}`;
  const globalPlugin = await env.PLUGIN_REGISTRY_GLOBAL.get(globalPluginKey, 'json');

  if (globalPlugin) {
    const manifest = globalPlugin as PluginManifest;

    // Check tenant whitelist
    if (manifest.tenant_whitelist && manifest.tenant_whitelist.length > 0) {
      if (!manifest.tenant_whitelist.includes(tenantId)) {
        // Plugin is restricted and this tenant is not whitelisted
        return null;
      }
    }

    return {
      source: 'global',
      manifest,
      client_wasm_url: manifest.frontend?.wasm
        ? `${PLUGIN_BUCKET_URL}/global/plugins/${pluginId}/${manifest.version}/${manifest.frontend.wasm}`
        : undefined,
      worker_wasm_url: manifest.backend?.wasm
        ? `${PLUGIN_BUCKET_URL}/global/plugins/${pluginId}/${manifest.version}/${manifest.backend.wasm}`
        : undefined,
      assets_url: `${PLUGIN_BUCKET_URL}/global/plugins/${pluginId}/${manifest.version}/assets/`,
    };
  }

  // Plugin not found
  return null;
}
