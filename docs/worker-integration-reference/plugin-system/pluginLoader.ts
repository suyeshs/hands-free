/**
 * Worker Plugin Loader
 *
 * Loads and manages WASM plugins on Cloudflare Workers
 *
 * Usage:
 * ```typescript
 * import { PluginLoader } from './pluginLoader';
 *
 * const loader = new PluginLoader(env);
 * const plugin = await loader.load('bar-management', 'tenant-123');
 * const result = await plugin.invoke('generate_closing_report', { date: '2026-01-29' });
 * ```
 */

import type { PluginManifest, PluginContext } from '@handsfree/plugin-sdk/types';
import { resolvePluginWorker } from './pluginResolver';
import { createPluginHostBindings } from './pluginHost';

export interface WorkerEnv {
  // R2 bucket for plugin storage
  PLUGIN_BUCKET: R2Bucket;

  // KV namespaces for plugin registry
  PLUGIN_REGISTRY_GLOBAL: KVNamespace;
  PLUGIN_REGISTRY_TENANTS: KVNamespace;

  // D1 database
  DB: D1Database;

  // Other environment bindings
  [key: string]: unknown;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  instance: WebAssembly.Instance;
  context: PluginContext;

  /**
   * Invoke a WASM function exported by the plugin
   */
  invoke(functionName: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Handle an HTTP request (for plugins with fetch handler)
   */
  fetch?(request: Request): Promise<Response>;

  /**
   * Clean up plugin resources
   */
  destroy(): Promise<void>;
}

/**
 * Plugin loader and manager for Cloudflare Workers
 */
export class PluginLoader {
  private cache = new Map<string, LoadedPlugin>();

  constructor(private env: WorkerEnv) {}

  /**
   * Load a plugin for a specific tenant
   * Uses caching to avoid reloading the same plugin
   */
  async load(pluginId: string, tenantId: string): Promise<LoadedPlugin> {
    const cacheKey = `${tenantId}:${pluginId}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Resolve plugin from registry
    const resolution = await resolvePluginWorker(pluginId, tenantId, this.env);

    if (!resolution || !resolution.worker_wasm_url) {
      throw new Error(`Plugin ${pluginId} not found or does not have worker WASM`);
    }

    // Download WASM from R2
    const wasmBytes = await this.downloadWasm(resolution.worker_wasm_url);

    // Verify checksum
    await this.verifyChecksum(wasmBytes, resolution.manifest.checksum);

    // Create plugin context
    const context: PluginContext = {
      pluginId: resolution.manifest.id,
      tenantId,
      version: resolution.manifest.version,
      manifest: resolution.manifest,
    };

    // Create host bindings
    const hostBindings = createPluginHostBindings(context, this.env);

    // Instantiate WASM module
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module, {
      env: hostBindings,
    });

    // Call init function if it exists
    const entryPoint = resolution.manifest.backend?.entry_point || 'init';
    if (typeof instance.exports[entryPoint] === 'function') {
      await (instance.exports[entryPoint] as CallableFunction)();
    }

    // Create loaded plugin wrapper
    const loadedPlugin: LoadedPlugin = {
      manifest: resolution.manifest,
      instance,
      context,

      async invoke(functionName: string, ...args: unknown[]) {
        const fn = instance.exports[functionName];
        if (typeof fn !== 'function') {
          throw new Error(`Function ${functionName} not found in plugin ${pluginId}`);
        }
        return await (fn as CallableFunction)(...args);
      },

      async fetch(request: Request) {
        const fetchHandler = instance.exports.fetch;
        if (typeof fetchHandler !== 'function') {
          return new Response('Plugin does not have fetch handler', { status: 404 });
        }
        return await (fetchHandler as CallableFunction)(request);
      },

      async destroy() {
        const destroyFn = instance.exports.destroy;
        if (typeof destroyFn === 'function') {
          await (destroyFn as CallableFunction)();
        }
      },
    };

    // Cache the loaded plugin
    this.cache.set(cacheKey, loadedPlugin);

    return loadedPlugin;
  }

  /**
   * Unload a plugin and free resources
   */
  async unload(pluginId: string, tenantId: string): Promise<void> {
    const cacheKey = `${tenantId}:${pluginId}`;
    const plugin = this.cache.get(cacheKey);

    if (plugin) {
      await plugin.destroy();
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Check if a plugin is loaded
   */
  isLoaded(pluginId: string, tenantId: string): boolean {
    const cacheKey = `${tenantId}:${pluginId}`;
    return this.cache.has(cacheKey);
  }

  /**
   * Get a loaded plugin (without loading if not cached)
   */
  get(pluginId: string, tenantId: string): LoadedPlugin | undefined {
    const cacheKey = `${tenantId}:${pluginId}`;
    return this.cache.get(cacheKey);
  }

  /**
   * Download WASM file from R2
   */
  private async downloadWasm(url: string): Promise<ArrayBuffer> {
    // Extract path from URL
    // URL format: https://handsfree-plugins.r2.cloudflarestorage.com/global/plugins/...
    const urlObj = new URL(url);
    const path = urlObj.pathname.slice(1); // Remove leading /

    // Fetch from R2
    const object = await this.env.PLUGIN_BUCKET.get(path);

    if (!object) {
      throw new Error(`WASM file not found: ${path}`);
    }

    return await object.arrayBuffer();
  }

  /**
   * Verify WASM checksum
   */
  private async verifyChecksum(wasmBytes: ArrayBuffer, expectedChecksum: string): Promise<void> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', wasmBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const actualChecksum = `sha256:${hashHex}`;

    if (actualChecksum !== expectedChecksum) {
      throw new Error(
        `Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`
      );
    }
  }

  /**
   * Clear all cached plugins
   */
  async clearCache(): Promise<void> {
    for (const [_key, plugin] of this.cache.entries()) {
      await plugin.destroy();
    }
    this.cache.clear();
  }
}
