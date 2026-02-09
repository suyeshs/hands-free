/**
 * Example: Menu Plugin Sync Implementation (Manual Trigger)
 *
 * Menu data is static configuration and doesn't need periodic sync.
 * Sync is triggered manually via UI button or automatically after menu updates.
 *
 * Sync Type: MANUAL / ON-UPDATE
 * - Manual: User clicks "Sync Menu" button in admin panel
 * - On-Update: After menu item saved, category created, etc.
 */

import { pluginSyncRegistry } from '../PluginSyncRegistry';
import Database from '@tauri-apps/plugin-sql';

export class MenuPluginSync {
  private pluginId = 'menu-management';
  private tenantId: string;
  private db: Database | null = null;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Initialize and register sync handler
   * Registers as 'manual' type - no automatic sync intervals
   */
  async initialize(): Promise<void> {
    this.db = await Database.load('sqlite:guanix.db');

    // Register with syncType: 'manual'
    // This means sync will NOT run automatically
    pluginSyncRegistry.register({
      pluginId: this.pluginId,
      pluginName: 'Menu Management',
      syncTables: ['menu_items', 'menu_categories', 'menu_modifiers'],
      syncInterval: 0, // Not used for manual sync
      enabled: true,
      syncType: 'manual', // ← Manual trigger only

      syncFunction: async () => {
        return await this.syncMenuData();
      },

      checkDataExists: async () => {
        return await this.hasMenuData();
      },

      getStatus: async () => {
        return await this.getSyncStatus();
      },
    });

    console.log('[MenuPluginSync] Registered as manual-sync (no automatic intervals)');
  }

  /**
   * Alternative: Register as 'on-update' type
   * Automatically syncs after menu changes
   */
  async initializeOnUpdate(): Promise<void> {
    this.db = await Database.load('sqlite:guanix.db');

    pluginSyncRegistry.register({
      pluginId: this.pluginId,
      pluginName: 'Menu Management',
      syncTables: ['menu_items', 'menu_categories', 'menu_modifiers'],
      syncInterval: 0,
      enabled: true,
      syncType: 'on-update', // ← Sync after data changes

      syncFunction: async () => {
        return await this.syncMenuData();
      },

      checkDataExists: async () => {
        return await this.hasMenuData();
      },
    });

    console.log('[MenuPluginSync] Registered as on-update sync (triggers after changes)');
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    pluginSyncRegistry.unregister(this.pluginId);
    console.log('[MenuPluginSync] Sync handler unregistered');
  }

  /**
   * Main sync logic - syncs all menu data
   */
  private async syncMenuData(): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    if (!this.db) throw new Error('Database not initialized');

    let totalSynced = 0;
    let totalFailed = 0;
    const syncedTables: string[] = [];

    try {
      // Sync menu items
      const itemsResult = await this.syncMenuItems();
      totalSynced += itemsResult.synced;
      totalFailed += itemsResult.failed;
      if (itemsResult.synced > 0) syncedTables.push('menu_items');

      // Sync categories
      const categoriesResult = await this.syncMenuCategories();
      totalSynced += categoriesResult.synced;
      totalFailed += categoriesResult.failed;
      if (categoriesResult.synced > 0) syncedTables.push('menu_categories');

      // Sync modifiers
      const modifiersResult = await this.syncMenuModifiers();
      totalSynced += modifiersResult.synced;
      totalFailed += modifiersResult.failed;
      if (modifiersResult.synced > 0) syncedTables.push('menu_modifiers');

      return {
        synced: totalSynced,
        failed: totalFailed,
        tables: syncedTables,
      };
    } catch (error) {
      console.error('[MenuPluginSync] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync menu items to cloud
   */
  private async syncMenuItems(): Promise<{ synced: number; failed: number }> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tableExists = await this.checkTableExists('menu_items');
      if (!tableExists) {
        console.log('[MenuPluginSync] menu_items table does not exist, skipping');
        return { synced: 0, failed: 0 };
      }

      // Get items that need syncing
      const items = await this.db.select<any[]>(
        `SELECT * FROM menu_items
         WHERE tenant_id = $1
         AND (synced_at IS NULL OR updated_at > synced_at)`,
        [this.tenantId]
      );

      if (items.length === 0) {
        return { synced: 0, failed: 0 };
      }

      // Sync to cloud API
      const response = await fetch(`https://api.example.com/menu/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: this.tenantId,
          items,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync menu items: ${response.statusText}`);
      }

      // Mark as synced
      for (const item of items) {
        await this.db.execute(
          `UPDATE menu_items SET synced_at = $1 WHERE id = $2`,
          [new Date().toISOString(), item.id]
        );
      }

      return { synced: items.length, failed: 0 };
    } catch (error) {
      console.error('[MenuPluginSync] Failed to sync menu items:', error);
      return { synced: 0, failed: 1 };
    }
  }

  /**
   * Sync menu categories
   */
  private async syncMenuCategories(): Promise<{ synced: number; failed: number }> {
    // Similar to syncMenuItems
    return { synced: 0, failed: 0 };
  }

  /**
   * Sync menu modifiers
   */
  private async syncMenuModifiers(): Promise<{ synced: number; failed: number }> {
    // Similar to syncMenuItems
    return { synced: 0, failed: 0 };
  }

  /**
   * Check if menu data exists
   */
  private async hasMenuData(): Promise<boolean> {
    if (!this.db) return false;

    try {
      const tableExists = await this.checkTableExists('menu_items');
      if (!tableExists) return false;

      const result = await this.db.select<any[]>(
        `SELECT COUNT(*) as count FROM menu_items WHERE tenant_id = $1`,
        [this.tenantId]
      );

      return result[0]?.count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get sync status
   */
  private async getSyncStatus(): Promise<{
    lastSync?: Date;
    lastError?: string;
    recordCount?: number;
  }> {
    if (!this.db) return {};

    try {
      const tableExists = await this.checkTableExists('menu_items');
      if (!tableExists) return { recordCount: 0 };

      const countResult = await this.db.select<any[]>(
        `SELECT COUNT(*) as count FROM menu_items WHERE tenant_id = $1`,
        [this.tenantId]
      );

      const lastSyncResult = await this.db.select<any[]>(
        `SELECT MAX(synced_at) as last_sync FROM menu_items WHERE tenant_id = $1`,
        [this.tenantId]
      );

      return {
        recordCount: countResult[0]?.count || 0,
        lastSync: lastSyncResult[0]?.last_sync ? new Date(lastSyncResult[0].last_sync) : undefined,
      };
    } catch (error) {
      return { lastError: String(error) };
    }
  }

  /**
   * Helper: Check if table exists
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      const result = await this.db.select<any[]>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=$1`,
        [tableName]
      );
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Usage Examples:
 *
 * 1. Initialize with manual sync:
 *    const menuSync = new MenuPluginSync(tenantId);
 *    await menuSync.initialize(); // Registers as 'manual'
 *
 * 2. Manually trigger sync from UI button:
 *    import { getTieredSyncManager } from '@/services/sync/TieredSyncManager';
 *
 *    const handleSyncMenu = async () => {
 *      const syncManager = getTieredSyncManager();
 *      const result = await syncManager.triggerPluginSync('menu-management');
 *      console.log(`Synced ${result.synced} menu items`);
 *    };
 *
 * 3. Trigger sync after menu item update (on-update):
 *    const handleSaveMenuItem = async (item) => {
 *      // Save to database
 *      await db.execute('UPDATE menu_items SET ...', [item.id]);
 *
 *      // Trigger sync after update
 *      const syncManager = getTieredSyncManager();
 *      await syncManager.triggerPluginOnUpdateSync('menu-management', {
 *        tables: ['menu_items']
 *      });
 *    };
 */
