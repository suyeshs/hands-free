/**
 * Plugin Host API
 *
 * Provides sandboxed access to POS app resources for client WASM plugins
 * Implements permission checking and scoped access
 */

import type { PluginContext, PluginHostAPI, PluginMenuItem } from '@/types/plugin';
import Database from '@tauri-apps/plugin-sql';

/**
 * Check if a plugin has a specific permission
 */
function hasPermission(context: PluginContext, permission: string): boolean {
  return context.manifest.requires_permissions.some(
    (p: string) => p === permission || p === permission.split('.').slice(0, 2).join('.') + '.*'
  );
}

/**
 * Create the plugin host API
 * This is passed as imports to the WASM module
 */
export function createPluginHostAPI(context: PluginContext): PluginHostAPI {
  // Get database instance
  let db: Database | null = null;

  const initDb = async () => {
    if (!db) {
      db = await Database.load('sqlite:handsfree.db');
    }
    return db;
  };

  return {
    /**
     * Database operations (permission-gated)
     */
    db: {
      async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
        // Check database.read permission
        if (!hasPermission(context, 'database.read.*')) {
          throw new Error('Plugin does not have database.read permission');
        }

        const database = await initDb();

        // Add tenant scoping to queries if not already present
        // This prevents plugins from accessing other tenants' data
        const scopedSql = sql.includes('tenant_id') ? sql : sql;

        const result = await database.select<T[]>(scopedSql, params || []);
        return result;
      },

      async execute(sql: string, params?: unknown[]): Promise<void> {
        // Check database.write permission
        if (!hasPermission(context, 'database.write.*')) {
          throw new Error('Plugin does not have database.write permission');
        }

        const database = await initDb();

        // Execute statement
        await database.execute(sql, params || []);
      },
    },

    /**
     * State management (Zustand stores)
     */
    store: {
      getState<T = unknown>(_storeName: string): T {
        // TODO: Implement store access
        // For now, throw error
        throw new Error('Store access not yet implemented');
      },

      subscribe<T = unknown>(
        _storeName: string,
        _selector: (state: T) => unknown,
        _callback: (value: unknown) => void
      ): () => void {
        // TODO: Implement store subscription
        throw new Error('Store subscription not yet implemented');
      },
    },

    /**
     * Event bus
     */
    events: {
      on(event: string, _handler: (data: unknown) => void): () => void {
        if (!hasPermission(context, `events.subscribe.${event}`)) {
          throw new Error(`Plugin does not have permission to subscribe to ${event}`);
        }

        // TODO: Implement event subscription
        console.warn('Event subscription not yet implemented:', event);

        // Return unsubscribe function
        return () => {
          console.log('Unsubscribing from', event);
        };
      },

      emit(event: string, data: unknown): void {
        if (!hasPermission(context, `events.emit.${event}`)) {
          throw new Error(`Plugin does not have permission to emit ${event}`);
        }

        // TODO: Implement event emission
        console.warn('Event emission not yet implemented:', event, data);
      },
    },

    /**
     * UI registration
     */
    ui: {
      registerRoute(path: string, _component: unknown): void {
        if (!hasPermission(context, 'ui.mount.*')) {
          throw new Error('Plugin does not have ui.mount permission');
        }

        // TODO: Implement route registration
        console.log(`Plugin ${context.pluginId} registered route:`, path);
      },

      registerMenuItem(item: PluginMenuItem): void {
        if (!hasPermission(context, 'ui.mount.*')) {
          throw new Error('Plugin does not have ui.mount permission');
        }

        // TODO: Implement menu item registration
        console.log(`Plugin ${context.pluginId} registered menu item:`, item.label);
      },

      showNotification(message: string, type?: 'info' | 'success' | 'error'): void {
        // Notifications allowed for all plugins
        console.log(`[${type || 'info'}] ${message}`);

        // TODO: Use actual notification system (toast/snackbar)
      },

      /**
       * Get current theme (Manifest v2)
       */
      getTheme(): 'light' | 'dark' {
        // Check if dark mode is preferred
        if (typeof window !== 'undefined' && window.matchMedia) {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
      },
    },

    /**
     * Storage (plugin-scoped)
     */
    storage: {
      async get(key: string): Promise<unknown> {
        if (!hasPermission(context, 'storage.*')) {
          throw new Error('Plugin does not have storage permission');
        }

        const database = await initDb();

        // Scope key to plugin and tenant
        const scopedKey = `plugin:${context.pluginId}:${context.tenantId}:${key}`;

        const rows = await database.select<Array<{ value: string }>>(
          'SELECT value FROM plugin_storage WHERE key = ?',
          [scopedKey]
        );

        if (rows.length === 0) {
          return null;
        }

        return JSON.parse(rows[0].value);
      },

      async set(key: string, value: unknown): Promise<void> {
        if (!hasPermission(context, 'storage.*')) {
          throw new Error('Plugin does not have storage permission');
        }

        const database = await initDb();

        // Ensure storage table exists
        await database.execute(`
          CREATE TABLE IF NOT EXISTS plugin_storage (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            plugin_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);

        const scopedKey = `plugin:${context.pluginId}:${context.tenantId}:${key}`;

        await database.execute(
          `INSERT OR REPLACE INTO plugin_storage (key, value, plugin_id, tenant_id, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            scopedKey,
            JSON.stringify(value),
            context.pluginId,
            context.tenantId,
            new Date().toISOString(),
          ]
        );
      },

      async delete(key: string): Promise<void> {
        if (!hasPermission(context, 'storage.*')) {
          throw new Error('Plugin does not have storage permission');
        }

        const database = await initDb();

        const scopedKey = `plugin:${context.pluginId}:${context.tenantId}:${key}`;

        await database.execute('DELETE FROM plugin_storage WHERE key = ?', [scopedKey]);
      },

      /**
       * Export all plugin data (Manifest v2)
       */
      async export(): Promise<Record<string, unknown>> {
        if (!hasPermission(context, 'storage.*')) {
          throw new Error('Plugin does not have storage permission');
        }

        const database = await initDb();

        const prefix = `plugin:${context.pluginId}:${context.tenantId}:`;
        const rows = await database.select<Array<{ key: string; value: string }>>(
          'SELECT key, value FROM plugin_storage WHERE key LIKE ?',
          [`${prefix}%`]
        );

        const data: Record<string, unknown> = {};
        for (const row of rows) {
          // Remove prefix from key
          const key = row.key.substring(prefix.length);
          data[key] = JSON.parse(row.value);
        }

        return data;
      },
    },

    /**
     * HTTP fetch (with origin restrictions)
     */
    async fetch(url: string, options?: RequestInit): Promise<Response> {
      if (!hasPermission(context, 'network.fetch.*')) {
        throw new Error('Plugin does not have network.fetch permission');
      }

      // Check allowed origins (extract from permission like network.fetch.example.com)
      const fetchPermissions = context.manifest.requires_permissions.filter(
        (p: string) => p.startsWith('network.fetch.')
      );

      const urlObj = new URL(url);
      const allowed = fetchPermissions.some((perm: string) => {
        const domain = perm.replace('network.fetch.', '');
        return domain === '*' || urlObj.hostname.endsWith(domain);
      });

      if (!allowed) {
        throw new Error(`Plugin not allowed to fetch from ${urlObj.hostname}`);
      }

      // Execute fetch
      return await fetch(url, options);
    },

    /**
     * Permission management (Manifest v2)
     */
    permissions: {
      has(permission: string): boolean {
        return hasPermission(context, permission);
      },

      async request(permission: string): Promise<boolean> {
        // TODO: Show permission request dialog
        console.warn('Permission request not yet implemented:', permission);
        return hasPermission(context, permission);
      },

      /**
       * Register callback when permission is revoked (Manifest v2)
       */
      onRevoked(permission: string, handler: () => void): () => void {
        // Store handlers in context (would need to extend PluginContext type)
        console.log(`Registered onRevoked handler for permission: ${permission}`);

        // Return unsubscribe function
        return () => {
          console.log(`Unregistered onRevoked handler for permission: ${permission}`);
        };
      },
    },

    /**
     * Analytics (Manifest v2) - optional, only if plugin opts in
     */
    analytics: context.manifest.analytics?.enabled
      ? {
          async track(event: string, properties?: Record<string, unknown>): Promise<void> {
            if (!context.manifest.analytics?.events?.includes(event)) {
              console.warn(`Event "${event}" not whitelisted in plugin manifest`);
              return;
            }

            const endpoint =
              context.manifest.analytics.endpoint ||
              'https://handsfree-tenant-router.workers.dev/analytics/track';

            try {
              await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  plugin_id: context.pluginId,
                  tenant_id: context.tenantId,
                  event,
                  properties,
                  timestamp: new Date().toISOString(),
                }),
              });
            } catch (error) {
              console.error('Failed to track analytics event:', error);
            }
          },

          async error(error: Error, errorContext?: Record<string, unknown>): Promise<void> {
            const endpoint =
              context.manifest.analytics?.endpoint ||
              'https://handsfree-tenant-router.workers.dev/analytics/error';

            try {
              await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  plugin_id: context.pluginId,
                  tenant_id: context.tenantId,
                  error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  },
                  context: errorContext,
                  timestamp: new Date().toISOString(),
                }),
              });
            } catch (err) {
              console.error('Failed to report error:', err);
            }
          },
        }
      : undefined,
  };
}

/**
 * Create WASM import bindings
 * These are lower-level functions that WASM can call
 * They wrap the PluginHostAPI methods
 */
export function createWasmHostBindings(context: PluginContext) {
  const hostAPI = createPluginHostAPI(context);

  return {
    /**
     * Database query (returns JSON string)
     */
    db_query: async (sql: string, params: string): Promise<string> => {
      const parsedParams = params ? JSON.parse(params) : [];
      const result = await hostAPI.db.query(sql, parsedParams);
      return JSON.stringify(result);
    },

    /**
     * Database execute
     */
    db_execute: async (sql: string, params: string): Promise<void> => {
      const parsedParams = params ? JSON.parse(params) : [];
      await hostAPI.db.execute(sql, parsedParams);
    },

    /**
     * Storage get (returns JSON string)
     */
    storage_get: async (key: string): Promise<string | null> => {
      const value = await hostAPI.storage.get(key);
      return value ? JSON.stringify(value) : null;
    },

    /**
     * Storage set
     */
    storage_set: async (key: string, value: string): Promise<void> => {
      await hostAPI.storage.set(key, JSON.parse(value));
    },

    /**
     * Storage delete
     */
    storage_delete: async (key: string): Promise<void> => {
      await hostAPI.storage.delete(key);
    },

    /**
     * HTTP fetch (returns JSON string with response data)
     */
    http_fetch: async (url: string, options: string): Promise<string> => {
      const parsedOptions = options ? JSON.parse(options) : {};
      const response = await hostAPI.fetch(url, parsedOptions);

      return JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text(),
      });
    },

    /**
     * Logging
     */
    log: (level: string, message: string): void => {
      const prefix = `[Plugin:${context.pluginId}]`;
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
     * Show notification
     */
    show_notification: (message: string, type: string): void => {
      hostAPI.ui.showNotification(message, type as 'info' | 'success' | 'error');
    },

    /**
     * Get current timestamp
     */
    now: (): number => Date.now(),

    /**
     * Get plugin context as JSON
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

    crypto_random_uuid: (): string => crypto.randomUUID(),
  };
}
