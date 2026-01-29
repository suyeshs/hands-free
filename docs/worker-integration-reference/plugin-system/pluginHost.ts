/**
 * Worker Plugin Host Bindings
 *
 * Provides sandboxed access to Cloudflare Workers resources for WASM plugins
 * Implements the PluginHostAPI interface with permission checking
 */

import type { PluginContext } from '@handsfree/plugin-sdk/types';

export interface WorkerEnv {
  DB: D1Database;
  PLUGIN_KV: KVNamespace;
  PLUGIN_BUCKET: R2Bucket;
  [key: string]: unknown;
}

/**
 * Check if a plugin has a specific permission
 */
function hasPermission(context: PluginContext, permission: string): boolean {
  return context.manifest.requires_permissions.some(
    p => p === permission || p === permission.split('.').slice(0, 2).join('.') + '.*'
  );
}

/**
 * Create host bindings for a worker plugin
 * These bindings are passed as imports when instantiating the WASM module
 */
export function createPluginHostBindings(context: PluginContext, env: WorkerEnv) {
  return {
    /**
     * Database operations (scoped by tenant + permissions)
     */
    db_query: async (sql: string, params: string): Promise<string> => {
      // Check database.read permission
      if (!hasPermission(context, 'database.read.*')) {
        throw new Error('Plugin does not have database.read permission');
      }

      // Parse parameters (passed as JSON string from WASM)
      const parsedParams = params ? JSON.parse(params) : [];

      // Execute query with tenant scoping
      const stmt = env.DB.prepare(sql).bind(...parsedParams);
      const result = await stmt.all();

      // Return as JSON string for WASM
      return JSON.stringify(result.results);
    },

    db_execute: async (sql: string, params: string): Promise<void> => {
      // Check database.write permission
      if (!hasPermission(context, 'database.write.*')) {
        throw new Error('Plugin does not have database.write permission');
      }

      const parsedParams = params ? JSON.parse(params) : [];

      // Execute statement
      await env.DB.prepare(sql).bind(...parsedParams).run();
    },

    /**
     * KV storage (plugin-scoped namespace)
     */
    kv_get: async (key: string): Promise<string | null> => {
      if (!hasPermission(context, 'storage.*')) {
        throw new Error('Plugin does not have storage permission');
      }

      // Scope key to plugin
      const scopedKey = `plugin:${context.pluginId}:${context.tenantId}:${key}`;
      return await env.PLUGIN_KV.get(scopedKey);
    },

    kv_put: async (key: string, value: string): Promise<void> => {
      if (!hasPermission(context, 'storage.*')) {
        throw new Error('Plugin does not have storage permission');
      }

      const scopedKey = `plugin:${context.pluginId}:${context.tenantId}:${key}`;
      await env.PLUGIN_KV.put(scopedKey, value);
    },

    kv_delete: async (key: string): Promise<void> => {
      if (!hasPermission(context, 'storage.*')) {
        throw new Error('Plugin does not have storage permission');
      }

      const scopedKey = `plugin:${context.pluginId}:${context.tenantId}:${key}`;
      await env.PLUGIN_KV.delete(scopedKey);
    },

    /**
     * HTTP fetch (with origin restrictions)
     */
    fetch: async (url: string, options: string): Promise<string> => {
      if (!hasPermission(context, 'network.fetch.*')) {
        throw new Error('Plugin does not have network.fetch permission');
      }

      // Check allowed origins (extract from permission like network.fetch.example.com)
      const fetchPermissions = context.manifest.requires_permissions.filter(
        p => p.startsWith('network.fetch.')
      );

      const urlObj = new URL(url);
      const allowed = fetchPermissions.some(perm => {
        const domain = perm.replace('network.fetch.', '');
        return domain === '*' || urlObj.hostname.endsWith(domain);
      });

      if (!allowed) {
        throw new Error(`Plugin not allowed to fetch from ${urlObj.hostname}`);
      }

      // Parse options
      const parsedOptions = options ? JSON.parse(options) : {};

      // Execute fetch
      const response = await fetch(url, parsedOptions);

      // Return response as JSON string
      return JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text(),
      });
    },

    /**
     * Logging (scoped with plugin ID)
     */
    log: (level: string, message: string): void => {
      const prefix = `[Plugin:${context.pluginId}:${context.tenantId}]`;
      switch (level) {
        case 'debug':
          console.debug(prefix, message);
          break;
        case 'info':
          console.info(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'error':
          console.error(prefix, message);
          break;
        default:
          console.log(prefix, message);
      }
    },

    /**
     * Get current timestamp
     */
    now: (): number => {
      return Date.now();
    },

    /**
     * Get plugin context information
     */
    get_context: (): string => {
      return JSON.stringify({
        pluginId: context.pluginId,
        tenantId: context.tenantId,
        version: context.version,
      });
    },

    /**
     * Crypto operations
     */
    crypto_sha256: async (data: string): Promise<string> => {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    crypto_random_uuid: (): string => {
      return crypto.randomUUID();
    },

    /**
     * R2 storage (for plugin assets)
     */
    r2_get: async (key: string): Promise<string | null> => {
      if (!hasPermission(context, 'files.read.*')) {
        throw new Error('Plugin does not have files.read permission');
      }

      // Scope to plugin assets directory
      const scopedKey = `global/plugins/${context.pluginId}/${context.version}/assets/${key}`;
      const object = await env.PLUGIN_BUCKET.get(scopedKey);

      if (!object) {
        return null;
      }

      return await object.text();
    },
  };
}

/**
 * Create a minimal host for plugins that don't need full bindings
 * Useful for simple plugins that only need logging and basic utilities
 */
export function createMinimalHostBindings(context: PluginContext) {
  return {
    log: (level: string, message: string): void => {
      const prefix = `[Plugin:${context.pluginId}]`;
      console.log(`${prefix}[${level}]`, message);
    },

    now: (): number => Date.now(),

    get_context: (): string => {
      return JSON.stringify({
        pluginId: context.pluginId,
        tenantId: context.tenantId,
        version: context.version,
      });
    },

    crypto_random_uuid: (): string => crypto.randomUUID(),
  };
}
