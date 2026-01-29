/**
 * Plugin Resolution Service
 *
 * Handles plugin resolution with two-tier registry:
 * 1. Tenant-specific plugins (overrides and custom)
 * 2. Global plugins (marketplace)
 *
 * This runs on the client side and queries the worker for plugin metadata.
 */

// Cloudflare types (only available in worker context, declared for type checking)
declare global {
  interface KVNamespace {
    get(key: string, type?: 'text'): Promise<string | null>;
    get(key: string, type: 'json'): Promise<any | null>;
    put(key: string, value: string): Promise<void>;
  }
  interface R2Bucket {
    get(key: string): Promise<any>;
    put(key: string, value: any): Promise<void>;
  }
}

import type {
  PluginResolution,
  PluginManifest,
  PluginMetadata,
} from '@/types/plugin';

export interface PluginResolverConfig {
  registryUrl: string;
  tenantId: string;
  apiToken?: string;
}

export class PluginResolver {
  private config: PluginResolverConfig;
  private cache: Map<string, PluginResolution>;

  constructor(config: PluginResolverConfig) {
    this.config = config;
    this.cache = new Map();
  }

  /**
   * Resolve a plugin for the current tenant
   *
   * Resolution order:
   * 1. Tenant-specific override
   * 2. Tenant-specific custom plugin
   * 3. Global registry
   */
  async resolvePlugin(pluginId: string): Promise<PluginResolution | null> {
    // Check cache first
    const cached = this.cache.get(pluginId);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(
        `${this.config.registryUrl}/api/tenants/${this.config.tenantId}/plugins/${pluginId}/resolve`,
        {
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Plugin not found
        }
        throw new Error(`Failed to resolve plugin: ${response.statusText}`);
      }

      const resolution: PluginResolution = await response.json();

      // Cache the result
      this.cache.set(pluginId, resolution);

      return resolution;
    } catch (error) {
      console.error(`[PluginResolver] Error resolving plugin ${pluginId}:`, error);
      return null;
    }
  }

  /**
   * List all available plugins for this tenant
   * (combines global + tenant-specific)
   */
  async listAvailable(): Promise<PluginMetadata[]> {
    try {
      const response = await fetch(
        `${this.config.registryUrl}/api/tenants/${this.config.tenantId}/plugins`,
        {
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to list plugins: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[PluginResolver] Error listing plugins:', error);
      return [];
    }
  }

  /**
   * Get plugin manifest without downloading WASM
   */
  async getManifest(pluginId: string): Promise<PluginManifest | null> {
    const resolution = await this.resolvePlugin(pluginId);
    return resolution?.manifest || null;
  }

  /**
   * Check if a plugin is available for this tenant
   */
  async isAvailable(pluginId: string): Promise<boolean> {
    const resolution = await this.resolvePlugin(pluginId);
    return resolution !== null;
  }

  /**
   * Clear resolution cache
   * (useful after plugin updates)
   */
  clearCache(pluginId?: string): void {
    if (pluginId) {
      this.cache.delete(pluginId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get HTTP headers for requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': this.config.tenantId,
    };

    if (this.config.apiToken) {
      headers['Authorization'] = `Bearer ${this.config.apiToken}`;
    }

    return headers;
  }
}

/**
 * Worker-side plugin resolution
 * (This would go in the platform/workers repo)
 */
export interface WorkerEnv {
  PLUGIN_REGISTRY_GLOBAL: KVNamespace;
  PLUGIN_REGISTRY_TENANTS: KVNamespace;
  PLUGIN_STORAGE: R2Bucket;
  R2_PUBLIC_URL: string;
}

/**
 * Resolve plugin on the worker side
 * This is the server-side implementation that the client queries
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
    return {
      source: 'tenant-override',
      manifest: override.manifest,
      client_wasm_url: override.custom_client_wasm_url,
      worker_wasm_url: override.custom_worker_wasm_url,
      assets_url: override.assets_url,
    };
  }

  // 2. Check tenant-specific custom plugin
  const customKey = `tenant:${tenantId}:plugin:${pluginId}`;
  const customPlugin = await env.PLUGIN_REGISTRY_TENANTS.get(customKey, 'json');

  if (customPlugin) {
    const basePath = `/tenants/${tenantId}/plugins/${pluginId}/${customPlugin.manifest.version}`;
    return {
      source: 'tenant-custom',
      manifest: customPlugin.manifest,
      client_wasm_url: customPlugin.manifest.frontend
        ? `${env.R2_PUBLIC_URL}${basePath}/client.wasm`
        : undefined,
      worker_wasm_url: customPlugin.manifest.backend
        ? `${env.R2_PUBLIC_URL}${basePath}/worker.wasm`
        : undefined,
      assets_url: `${env.R2_PUBLIC_URL}${basePath}/assets`,
    };
  }

  // 3. Fall back to global registry
  const globalKey = `plugin:${pluginId}`;
  const globalPlugin = await env.PLUGIN_REGISTRY_GLOBAL.get(globalKey, 'json');

  if (globalPlugin) {
    const manifest: PluginManifest = globalPlugin.manifest;

    // Check tenant whitelist
    if (manifest.tenant_whitelist && manifest.tenant_whitelist.length > 0) {
      if (!manifest.tenant_whitelist.includes(tenantId)) {
        // Plugin not available for this tenant
        return null;
      }
    }

    const basePath = `/global/plugins/${pluginId}/${manifest.version}`;
    return {
      source: 'global',
      manifest,
      client_wasm_url: manifest.frontend
        ? `${env.R2_PUBLIC_URL}${basePath}/client.wasm`
        : undefined,
      worker_wasm_url: manifest.backend
        ? `${env.R2_PUBLIC_URL}${basePath}/worker.wasm`
        : undefined,
      assets_url: `${env.R2_PUBLIC_URL}${basePath}/assets`,
    };
  }

  // Plugin not found
  return null;
}

/**
 * List all plugins available to a tenant
 */
export async function listPluginsForTenant(
  tenantId: string,
  env: WorkerEnv
): Promise<PluginMetadata[]> {
  const plugins: PluginMetadata[] = [];

  // 1. Get global plugins
  const globalIndexKey = 'plugin-index';
  const globalIndex = await env.PLUGIN_REGISTRY_GLOBAL.get(globalIndexKey, 'json');

  if (globalIndex && Array.isArray(globalIndex)) {
    for (const pluginId of globalIndex) {
      const plugin = await env.PLUGIN_REGISTRY_GLOBAL.get(`plugin:${pluginId}`, 'json');
      if (plugin) {
        // Check if plugin is available for this tenant
        const manifest: PluginManifest = plugin.manifest;
        if (!manifest.tenant_whitelist ||
            manifest.tenant_whitelist.length === 0 ||
            manifest.tenant_whitelist.includes(tenantId)) {
          plugins.push({
            ...manifest,
            download_count: plugin.download_count || 0,
            rating: plugin.rating || 0,
            reviews_count: plugin.reviews_count || 0,
            tags: plugin.tags || [],
          });
        }
      }
    }
  }

  // 2. Get tenant-specific plugins
  const tenantIndexKey = `tenant:${tenantId}:plugin-index`;
  const tenantIndex = await env.PLUGIN_REGISTRY_TENANTS.get(tenantIndexKey, 'json');

  if (tenantIndex && Array.isArray(tenantIndex)) {
    for (const pluginId of tenantIndex) {
      const plugin = await env.PLUGIN_REGISTRY_TENANTS.get(
        `tenant:${tenantId}:plugin:${pluginId}`,
        'json'
      );
      if (plugin) {
        plugins.push({
          ...plugin.manifest,
          download_count: 0,
          rating: 0,
          reviews_count: 0,
          tags: ['custom', 'private'],
        });
      }
    }
  }

  return plugins;
}

/**
 * Client-side plugin resolution (convenience function)
 * Creates a PluginResolver instance and resolves a plugin
 */
export async function resolvePluginClient(
  pluginId: string,
  config: PluginResolverConfig
): Promise<PluginResolution | null> {
  const resolver = new PluginResolver(config);
  return resolver.resolvePlugin(pluginId);
}
