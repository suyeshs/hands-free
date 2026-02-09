/**
 * Plugin Sync Registry
 *
 * Central registry for plugin-based sync handlers
 * Allows plugins to register their own sync logic with the TieredSyncManager
 *
 * Supports three sync trigger types:
 * - 'periodic': Automatic sync at regular intervals (e.g., attendance for analytics)
 * - 'manual': User-triggered sync via UI button or API call (e.g., menu, staff info)
 * - 'on-update': Sync triggered after data changes (e.g., after menu item saved)
 */

export type SyncTriggerType = 'periodic' | 'manual' | 'on-update';

export interface PluginSyncHandler {
  pluginId: string;
  pluginName: string;
  syncTables: string[];
  syncInterval: number; // milliseconds - only used for 'periodic' type
  enabled: boolean;
  syncType: SyncTriggerType; // New: determines when sync is triggered

  // Sync function provided by the plugin
  syncFunction: () => Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }>;

  // Optional: Check if plugin data exists before syncing
  checkDataExists?: () => Promise<boolean>;

  // Optional: Get sync status
  getStatus?: () => Promise<{
    lastSync?: Date;
    lastError?: string;
    recordCount?: number;
  }>;
}

export class PluginSyncRegistry {
  private static instance: PluginSyncRegistry;
  private handlers: Map<string, PluginSyncHandler> = new Map();

  private constructor() {}

  static getInstance(): PluginSyncRegistry {
    if (!PluginSyncRegistry.instance) {
      PluginSyncRegistry.instance = new PluginSyncRegistry();
    }
    return PluginSyncRegistry.instance;
  }

  /**
   * Register a plugin's sync handler
   */
  register(handler: PluginSyncHandler): void {
    console.log(`[PluginSyncRegistry] Registering sync handler for plugin: ${handler.pluginName}`);
    this.handlers.set(handler.pluginId, handler);
  }

  /**
   * Unregister a plugin's sync handler
   */
  unregister(pluginId: string): void {
    console.log(`[PluginSyncRegistry] Unregistering sync handler for plugin: ${pluginId}`);
    this.handlers.delete(pluginId);
  }

  /**
   * Get all registered handlers
   */
  getAll(): PluginSyncHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get handler by plugin ID
   */
  get(pluginId: string): PluginSyncHandler | undefined {
    return this.handlers.get(pluginId);
  }

  /**
   * Get enabled handlers only
   */
  getEnabled(): PluginSyncHandler[] {
    return Array.from(this.handlers.values()).filter(h => h.enabled);
  }

  /**
   * Get enabled periodic handlers (for automatic sync intervals)
   */
  getPeriodicHandlers(): PluginSyncHandler[] {
    return Array.from(this.handlers.values()).filter(
      h => h.enabled && h.syncType === 'periodic'
    );
  }

  /**
   * Get manual handlers (for user-triggered sync)
   */
  getManualHandlers(): PluginSyncHandler[] {
    return Array.from(this.handlers.values()).filter(
      h => h.enabled && h.syncType === 'manual'
    );
  }

  /**
   * Get on-update handlers (for event-triggered sync)
   */
  getOnUpdateHandlers(): PluginSyncHandler[] {
    return Array.from(this.handlers.values()).filter(
      h => h.enabled && h.syncType === 'on-update'
    );
  }

  /**
   * Check if a plugin has registered sync
   */
  has(pluginId: string): boolean {
    return this.handlers.has(pluginId);
  }

  /**
   * Enable/disable a plugin's sync
   */
  setEnabled(pluginId: string, enabled: boolean): void {
    const handler = this.handlers.get(pluginId);
    if (handler) {
      handler.enabled = enabled;
      console.log(`[PluginSyncRegistry] Plugin ${pluginId} sync ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Manually trigger sync for a specific plugin
   * Used for 'manual' type plugins that sync on-demand
   */
  async triggerManualSync(pluginId: string): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    const handler = this.handlers.get(pluginId);

    if (!handler) {
      throw new Error(`Plugin ${pluginId} not found in registry`);
    }

    if (!handler.enabled) {
      throw new Error(`Plugin ${pluginId} is disabled`);
    }

    if (handler.syncType !== 'manual') {
      console.warn(`[PluginSyncRegistry] Plugin ${pluginId} is not configured for manual sync (type: ${handler.syncType})`);
    }

    console.log(`[PluginSyncRegistry] Manually triggering sync for plugin: ${handler.pluginName}`);

    try {
      // Check if data exists (optional)
      if (handler.checkDataExists) {
        const dataExists = await handler.checkDataExists();
        if (!dataExists) {
          console.log(`[PluginSyncRegistry] Plugin ${handler.pluginName} has no data to sync`);
          return { synced: 0, failed: 0, tables: [] };
        }
      }

      // Run sync
      const result = await handler.syncFunction();
      console.log(`[PluginSyncRegistry] Manual sync complete for ${handler.pluginName}: ${result.synced} records`);
      return result;
    } catch (error) {
      console.error(`[PluginSyncRegistry] Manual sync failed for ${handler.pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Trigger on-update sync for a specific plugin
   * Used when data changes and needs to be synced immediately
   */
  async triggerOnUpdateSync(pluginId: string, context?: { tables?: string[] }): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    const handler = this.handlers.get(pluginId);

    if (!handler) {
      throw new Error(`Plugin ${pluginId} not found in registry`);
    }

    if (!handler.enabled) {
      console.log(`[PluginSyncRegistry] Plugin ${pluginId} is disabled, skipping on-update sync`);
      return { synced: 0, failed: 0, tables: [] };
    }

    if (handler.syncType !== 'on-update') {
      console.warn(`[PluginSyncRegistry] Plugin ${pluginId} is not configured for on-update sync (type: ${handler.syncType})`);
    }

    console.log(`[PluginSyncRegistry] Triggering on-update sync for plugin: ${handler.pluginName}`, context);

    try {
      const result = await handler.syncFunction();
      console.log(`[PluginSyncRegistry] On-update sync complete for ${handler.pluginName}: ${result.synced} records`);
      return result;
    } catch (error) {
      console.error(`[PluginSyncRegistry] On-update sync failed for ${handler.pluginName}:`, error);
      // Don't throw - on-update sync failures shouldn't block the UI
      return { synced: 0, failed: 1, tables: context?.tables || [] };
    }
  }
}

// Export singleton instance
export const pluginSyncRegistry = PluginSyncRegistry.getInstance();
