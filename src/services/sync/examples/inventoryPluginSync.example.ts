/**
 * Example: Inventory Plugin Sync Implementation
 *
 * This shows how an inventory plugin would register its sync handler
 * with the TieredSyncManager through the PluginSyncRegistry
 */

import { pluginSyncRegistry } from '../PluginSyncRegistry';
import Database from '@tauri-apps/plugin-sql';

export class InventoryPluginSync {
  private pluginId = 'inventory-management';
  private tenantId: string;
  private db: Database | null = null;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Initialize and register sync handler
   * Inventory transactions use periodic sync for tracking and analytics
   */
  async initialize(): Promise<void> {
    // Open database connection
    this.db = await Database.load('sqlite:guanix.db');

    // Register sync handler with the central sync manager
    // Using 'periodic' type for automatic sync intervals
    pluginSyncRegistry.register({
      pluginId: this.pluginId,
      pluginName: 'Inventory Management',
      syncTables: ['inventory_items', 'inventory_suppliers', 'inventory_transactions', 'inventory_recipes'],
      syncInterval: 600000, // 10 minutes
      enabled: true,
      syncType: 'periodic', // ← Automatic periodic sync for analytics

      // Main sync function
      syncFunction: async () => {
        return await this.syncInventoryData();
      },

      // Optional: Check if plugin data exists
      checkDataExists: async () => {
        return await this.hasInventoryData();
      },

      // Optional: Get sync status
      getStatus: async () => {
        return await this.getSyncStatus();
      },
    });

    console.log('[InventoryPluginSync] Sync handler registered (periodic, 10 min)');
  }

  /**
   * Unregister when plugin is disabled/uninstalled
   */
  cleanup(): void {
    pluginSyncRegistry.unregister(this.pluginId);
    console.log('[InventoryPluginSync] Sync handler unregistered');
  }

  /**
   * Main sync logic - syncs all inventory data
   */
  private async syncInventoryData(): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    if (!this.db) throw new Error('Database not initialized');

    let totalSynced = 0;
    let totalFailed = 0;
    const syncedTables: string[] = [];

    try {
      // Sync inventory items
      const itemsResult = await this.syncInventoryItems();
      totalSynced += itemsResult.synced;
      totalFailed += itemsResult.failed;
      if (itemsResult.synced > 0) syncedTables.push('inventory_items');

      // Sync suppliers
      const suppliersResult = await this.syncInventorySuppliers();
      totalSynced += suppliersResult.synced;
      totalFailed += suppliersResult.failed;
      if (suppliersResult.synced > 0) syncedTables.push('inventory_suppliers');

      // Sync transactions
      const transactionsResult = await this.syncInventoryTransactions();
      totalSynced += transactionsResult.synced;
      totalFailed += transactionsResult.failed;
      if (transactionsResult.synced > 0) syncedTables.push('inventory_transactions');

      return {
        synced: totalSynced,
        failed: totalFailed,
        tables: syncedTables,
      };
    } catch (error) {
      console.error('[InventoryPluginSync] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync inventory items to cloud
   */
  private async syncInventoryItems(): Promise<{ synced: number; failed: number }> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check if table exists
      const tableExists = await this.checkTableExists('inventory_items');
      if (!tableExists) {
        console.log('[InventoryPluginSync] inventory_items table does not exist, skipping');
        return { synced: 0, failed: 0 };
      }

      // Get items that need syncing (e.g., modified since last sync)
      const items = await this.db.select<any[]>(
        `SELECT * FROM inventory_items
         WHERE tenant_id = $1
         AND (synced_at IS NULL OR updated_at > synced_at)`,
        [this.tenantId]
      );

      if (items.length === 0) {
        return { synced: 0, failed: 0 };
      }

      // Sync to cloud API
      // Replace with actual cloud API endpoint
      const response = await fetch(`https://api.example.com/inventory/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: this.tenantId,
          items,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync items: ${response.statusText}`);
      }

      // Mark as synced
      for (const item of items) {
        await this.db.execute(
          `UPDATE inventory_items SET synced_at = $1 WHERE id = $2`,
          [new Date().toISOString(), item.id]
        );
      }

      return { synced: items.length, failed: 0 };
    } catch (error) {
      console.error('[InventoryPluginSync] Failed to sync inventory items:', error);
      return { synced: 0, failed: 1 };
    }
  }

  /**
   * Sync inventory suppliers to cloud
   */
  private async syncInventorySuppliers(): Promise<{ synced: number; failed: number }> {
    // Similar implementation to syncInventoryItems
    // Left as example structure
    return { synced: 0, failed: 0 };
  }

  /**
   * Sync inventory transactions to cloud
   */
  private async syncInventoryTransactions(): Promise<{ synced: number; failed: number }> {
    // Similar implementation to syncInventoryItems
    // Left as example structure
    return { synced: 0, failed: 0 };
  }

  /**
   * Check if plugin has any data
   */
  private async hasInventoryData(): Promise<boolean> {
    if (!this.db) return false;

    try {
      const tableExists = await this.checkTableExists('inventory_items');
      if (!tableExists) return false;

      const result = await this.db.select<any[]>(
        `SELECT COUNT(*) as count FROM inventory_items WHERE tenant_id = $1`,
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
      const tableExists = await this.checkTableExists('inventory_items');
      if (!tableExists) return { recordCount: 0 };

      const countResult = await this.db.select<any[]>(
        `SELECT COUNT(*) as count FROM inventory_items WHERE tenant_id = $1`,
        [this.tenantId]
      );

      const lastSyncResult = await this.db.select<any[]>(
        `SELECT MAX(synced_at) as last_sync FROM inventory_items WHERE tenant_id = $1`,
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
   * Helper: Check if a table exists
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
 * Usage in plugin initialization:
 *
 * // When plugin is loaded/installed
 * const inventorySync = new InventoryPluginSync(tenantId);
 * await inventorySync.initialize();
 *
 * // Sync will now run automatically every 10 minutes via TieredSyncManager
 * // Good for tracking inventory transactions and analytics
 *
 * // When plugin is disabled/uninstalled
 * inventorySync.cleanup();
 *
 * Note: This example uses 'periodic' sync type.
 * For static inventory data (items, suppliers), consider using 'manual' or 'on-update' instead.
 * See menuPluginSync.example.ts for manual/on-update implementation.
 */
