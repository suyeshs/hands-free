/**
 * D1 Sync Service
 * Handles synchronization of local SQLite data to Cloudflare D1 database
 * Supports dynamic table detection based on restaurant features
 */

import { invoke } from '@tauri-apps/api/core';
import { backgroundCoordinator } from '../backgroundOperationsCoordinator';

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

export interface TableSyncStatus {
  tableName: string;
  exists: boolean;
  lastSync: string | null;
  recordCount: number;
}

export class D1SyncService {
  private workerUrl: string;
  private tenantId: string;
  private dbPath: string;
  private instanceId: string;

  constructor(
    tenantId: string,
    workerUrl: string = import.meta.env.VITE_ORDERS_ENDPOINT || 'https://handsfree-orders.suyesh.workers.dev',
    dbPath?: string
  ) {
    this.tenantId = tenantId;
    this.workerUrl = workerUrl;
    this.dbPath = dbPath || `${tenantId}.db`;
    this.instanceId = `d1-sync-${tenantId}-${Date.now()}`;
  }

  /**
   * Check if background operations are paused
   * If paused, sync operations should be deferred
   */
  private isOperationsPaused(): boolean {
    const status = backgroundCoordinator.getStatus();
    return status.isPaused;
  }

  /**
   * Check if a table exists in local SQLite
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await invoke<boolean>('table_exists', {
        dbPath: this.dbPath,
        tableName,
      });
      return result;
    } catch (error) {
      console.warn(`[D1Sync] Failed to check if table ${tableName} exists:`, error);
      return false;
    }
  }

  /**
   * Get last sync timestamp for a specific data type
   */
  private getLastSyncTimestamp(dataType: string): string {
    return localStorage.getItem(`sync:d1:${dataType}:last`) || '1970-01-01T00:00:00.000Z';
  }

  /**
   * Update last sync timestamp for a specific data type
   */
  private updateLastSyncTimestamp(dataType: string): void {
    const now = new Date().toISOString();
    localStorage.setItem(`sync:d1:${dataType}:last`, now);
    localStorage.setItem('sync:d1:last_full_sync', now);
  }

  /**
   * Generic sync method using unified endpoint
   */
  private async syncToD1(
    dataType: string,
    records: any[],
    tableName?: string
  ): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, failed: 0, errors: [] };

    try {
      // Check if operations are paused (e.g., during menu upload)
      if (this.isOperationsPaused()) {
        console.log(`[D1Sync-${this.instanceId}] Operations paused, deferring ${dataType} sync`);
        return result;
      }

      // Check if table exists (if tableName provided)
      if (tableName) {
        const exists = await this.tableExists(tableName);
        if (!exists) {
          console.log(`[D1Sync] Table ${tableName} does not exist, skipping sync`);
          return result;
        }
      }

      if (records.length === 0) {
        console.log(`[D1Sync] No ${dataType} records to sync`);
        return result;
      }

      // Batch sync (500 records max per request)
      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        try {
          const response = await fetch(
            `${this.workerUrl}/api/sync/${this.tenantId}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dataType,
                records: batch,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }

          const syncResult = await response.json();
          result.synced += syncResult.synced || batch.length;

          if (syncResult.errors && syncResult.errors.length > 0) {
            result.errors.push(...syncResult.errors);
            result.failed += syncResult.errors.length;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[D1Sync] Batch sync failed for ${dataType}:`, errorMsg);
          result.errors.push(`Batch ${i / batchSize + 1}: ${errorMsg}`);
          result.failed += batch.length;
        }
      }

      // Update last sync timestamp on success
      if (result.synced > 0) {
        this.updateLastSyncTimestamp(dataType);
      }

      console.log(`[D1Sync] ${dataType} sync complete:`, result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[D1Sync] ${dataType} sync failed:`, errorMsg);
      result.errors.push(errorMsg);
      throw error;
    }
  }

  /**
   * Sync sales transactions to D1
   */
  async syncSalesToD1(since?: string): Promise<SyncResult> {
    try {
      const lastSync = since || this.getLastSyncTimestamp('sales');

      const records = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: 'SELECT * FROM sales_transactions WHERE completed_at > ? ORDER BY completed_at ASC LIMIT 500',
        params: [lastSync],
      });

      return await this.syncToD1('sales', records, 'sales_transactions');
    } catch (error) {
      console.error('[D1Sync] Sales sync failed:', error);
      return { synced: 0, failed: 0, errors: [String(error)] };
    }
  }

  /**
   * Sync tips to D1
   */
  async syncTipsToD1(since?: string): Promise<SyncResult> {
    try {
      const lastSync = since || this.getLastSyncTimestamp('tips');

      const records = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: 'SELECT * FROM tips WHERE created_at > ? ORDER BY created_at ASC LIMIT 500',
        params: [lastSync],
      });

      return await this.syncToD1('tips', records, 'tips');
    } catch (error) {
      console.error('[D1Sync] Tips sync failed:', error);
      return { synced: 0, failed: 0, errors: [String(error)] };
    }
  }

  /**
   * Sync menu items to D1 (full sync, no incremental)
   */
  async syncMenuToD1(): Promise<SyncResult> {
    try {
      const itemsExist = await this.tableExists('menu_items');
      const categoriesExist = await this.tableExists('menu_categories');

      if (!itemsExist && !categoriesExist) {
        console.log('[D1Sync] Menu tables do not exist, skipping sync');
        return { synced: 0, failed: 0, errors: [] };
      }

      const items = itemsExist
        ? await invoke<any[]>('query_sqlite', {
            dbPath: this.dbPath,
            query: 'SELECT * FROM menu_items',
            params: [],
          })
        : [];

      const categories = categoriesExist
        ? await invoke<any[]>('query_sqlite', {
            dbPath: this.dbPath,
            query: 'SELECT * FROM menu_categories',
            params: [],
          })
        : [];

      // Use unified sync endpoint for both categories and items
      let totalSynced = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      // Sync categories first using unified endpoint
      if (categories.length > 0) {
        const catResult = await this.syncToD1('menu_categories', categories);
        totalSynced += catResult.synced;
        totalFailed += catResult.failed;
        errors.push(...catResult.errors);
      }

      // Sync menu items using unified endpoint
      if (items.length > 0) {
        const itemsResult = await this.syncToD1('menu_items', items);
        totalSynced += itemsResult.synced;
        totalFailed += itemsResult.failed;
        errors.push(...itemsResult.errors);
      }

      console.log(`[D1Sync] menu sync complete: {synced: ${totalSynced}, failed: ${totalFailed}, errors: ${errors.length}}`);
      if (errors.length > 0) {
        console.error(`[D1Sync] Menu sync errors:`, errors);
      }
      return { synced: totalSynced, failed: totalFailed, errors };
    } catch (error) {
      console.error('[D1Sync] Menu sync failed:', error);
      return { synced: 0, failed: 0, errors: [String(error)] };
    }
  }

  /**
   * Sync staff members to D1 (full sync)
   */
  async syncStaffToD1(): Promise<SyncResult> {
    try {
      const records = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: 'SELECT * FROM staff_users',
        params: [],
      });

      return await this.syncToD1('staff', records, 'staff_users');
    } catch (error) {
      console.error('[D1Sync] Staff sync failed:', error);
      return { synced: 0, failed: 0, errors: [String(error)] };
    }
  }

  /**
   * Sync restaurant settings to D1 (full sync)
   */
  async syncSettingsToD1(): Promise<SyncResult> {
    try {
      const exists = await this.tableExists('restaurant_settings');
      if (!exists) {
        console.log('[D1Sync] restaurant_settings table does not exist, skipping sync');
        return { synced: 0, failed: 0, errors: [] };
      }

      const settings = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: 'SELECT * FROM restaurant_settings LIMIT 1',
        params: [],
      });

      if (settings.length === 0) {
        console.log('[D1Sync] No restaurant settings to sync');
        return { synced: 0, failed: 0, errors: [] };
      }

      return await this.syncToD1('settings', settings);
    } catch (error) {
      console.error('[D1Sync] Settings sync failed:', error);
      return { synced: 0, failed: 0, errors: [String(error)] };
    }
  }

  /**
   * Sync floor plan to D1 (full sync)
   */
  async syncFloorPlanToD1(): Promise<SyncResult> {
    try {
      const sectionsExist = await this.tableExists('floor_plan_sections');
      const tablesExist = await this.tableExists('floor_plan_tables');

      if (!sectionsExist && !tablesExist) {
        console.log('[D1Sync] Floor plan tables do not exist, skipping sync');
        return { synced: 0, failed: 0, errors: [] };
      }

      const sections = sectionsExist
        ? await invoke<any[]>('query_sqlite', {
            dbPath: this.dbPath,
            query: 'SELECT * FROM floor_plan_sections',
            params: [],
          })
        : [];

      const tables = tablesExist
        ? await invoke<any[]>('query_sqlite', {
            dbPath: this.dbPath,
            query: 'SELECT * FROM floor_plan_tables',
            params: [],
          })
        : [];

      // Send as single object with sections and tables
      return await this.syncToD1('floor-plan', [{ sections, tables }]);
    } catch (error) {
      console.error('[D1Sync] Floor plan sync failed:', error);
      return { synced: 0, failed: 0, errors: [String(error)] };
    }
  }

  /**
   * Sync bar inventory to D1 (if bar module enabled)
   */
  async syncBarInventoryToD1(): Promise<SyncResult> {
    try {
      const barItemsExist = await this.tableExists('bar_inventory_items');
      const barRecipesExist = await this.tableExists('bar_recipes');

      if (!barItemsExist && !barRecipesExist) {
        console.log('[D1Sync] Bar tables do not exist (feature not enabled), skipping sync');
        return { synced: 0, failed: 0, errors: [] };
      }

      const items = barItemsExist
        ? await invoke<any[]>('query_sqlite', {
            dbPath: this.dbPath,
            query: 'SELECT * FROM bar_inventory_items',
            params: [],
          })
        : [];

      const recipes = barRecipesExist
        ? await invoke<any[]>('query_sqlite', {
            dbPath: this.dbPath,
            query: 'SELECT * FROM bar_recipes',
            params: [],
          })
        : [];

      // Send as single object with items and recipes
      return await this.syncToD1('inventory', [{ items, recipes }]);
    } catch (error) {
      console.error('[D1Sync] Bar inventory sync failed:', error);
      return { synced: 0, failed: 0, errors: [String(error)] };
    }
  }

  /**
   * Get sync status for all tables
   */
  async getSyncStatus(): Promise<TableSyncStatus[]> {
    const tables = [
      'sales_transactions',
      'tips',
      'menu_items',
      'staff_users',
      'restaurant_settings',
      'floor_plan_sections',
      'bar_inventory_items',
    ];

    const statuses: TableSyncStatus[] = [];

    for (const table of tables) {
      try {
        const exists = await this.tableExists(table);
        const lastSync = this.getLastSyncTimestamp(table);

        let recordCount = 0;
        if (exists) {
          const result = await invoke<any[]>('query_sqlite', {
            dbPath: this.dbPath,
            query: `SELECT COUNT(*) as count FROM ${table}`,
            params: [],
          });
          recordCount = result[0]?.count || 0;
        }

        statuses.push({
          tableName: table,
          exists,
          lastSync,
          recordCount,
        });
      } catch (error) {
        console.error(`[D1Sync] Failed to get status for ${table}:`, error);
      }
    }

    return statuses;
  }

  /**
   * Sync plugin migration SQL to D1 database
   * Used when plugins are installed/uninstalled to keep D1 schema in sync
   */
  async syncPluginMigration(
    pluginId: string,
    migrationSql: string,
    operationType: 'install' | 'uninstall'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[D1Sync] Syncing plugin migration for ${pluginId} (${operationType})`);

      const response = await fetch(`${this.workerUrl}/d1/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: this.tenantId,
          sql: migrationSql,
          pluginId,
          operationType,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[D1Sync] Plugin migration sync failed:`, error);
        return { success: false, error };
      }

      await response.json();
      console.log(`[D1Sync] Plugin migration synced successfully for ${pluginId}`);
      return { success: true };
    } catch (error) {
      console.error(`[D1Sync] Plugin migration sync error:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Drop plugin tables in D1 database
   * Used during uninstall with 'delete_all' option
   */
  async dropPluginTables(
    pluginId: string,
    tables: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[D1Sync] Dropping plugin tables for ${pluginId}:`, tables);

      // Build DROP TABLE statements
      const dropStatements = tables.map(table => `DROP TABLE IF EXISTS ${table};`).join('\n');

      return await this.syncPluginMigration(pluginId, dropStatements, 'uninstall');
    } catch (error) {
      console.error(`[D1Sync] Failed to drop plugin tables:`, error);
      return { success: false, error: String(error) };
    }
  }
}

// Export singleton instance factory
export function createD1SyncService(tenantId: string, workerUrl?: string, dbPath?: string): D1SyncService {
  return new D1SyncService(tenantId, workerUrl, dbPath);
}
