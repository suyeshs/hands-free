/**
 * Incremental Sync Service
 * Handles incremental syncing - only syncs changed records since last sync
 */

import { database } from '../../lib/database';

export interface SyncResult {
  synced: number;
  failed: number;
  errors?: string[];
}

export interface MenuSyncResult {
  menuItems: number;
  categories: number;
}

export interface RecipesSyncResult {
  recipes: number;
  ingredients: number;
}

// @ts-ignore - import.meta.env is available in Vite
const TENANT_ID = import.meta.env?.VITE_DEFAULT_TENANT_ID || 'default-tenant'; // Get from config
const API_BASE_URL = `https://${TENANT_ID}.handsfree-tenants.workers.dev`;

// Storage keys for last sync timestamps
const SYNC_TIMESTAMP_KEYS = {
  orders: 'sync:orders:last_timestamp',
  tips: 'sync:tips:last_timestamp',
  sales: 'sync:sales:last_timestamp',
  menuItems: 'sync:menu_items:last_timestamp',
  categories: 'sync:categories:last_timestamp',
  staff: 'sync:staff:last_timestamp',
  staffLoginHistory: 'sync:staff_login_history:last_timestamp',
  cashRegisters: 'sync:cash_registers:last_timestamp',
  cashPayouts: 'sync:cash_payouts:last_timestamp',
  inventorySuppliers: 'sync:inventory_suppliers:last_timestamp',
  inventoryItems: 'sync:inventory_items:last_timestamp',
  inventoryTransactions: 'sync:inventory_transactions:last_timestamp',
  inventoryRecipes: 'sync:inventory_recipes:last_timestamp',
  inventoryRecipeIngredients: 'sync:inventory_recipe_ingredients:last_timestamp',
};

export class IncrementalSyncService {
  /**
   * Get last sync timestamp for a table
   */
  private async getLastSyncTimestamp(key: string): Promise<string> {
    const timestamp = localStorage.getItem(key);
    return timestamp || '1970-01-01T00:00:00Z'; // Default to epoch if never synced
  }

  /**
   * Update last sync timestamp for a table
   */
  private async updateLastSyncTimestamp(key: string, timestamp?: string): Promise<void> {
    localStorage.setItem(key, timestamp || new Date().toISOString());
  }

  /**
   * Sync data to cloud
   */
  private async syncToCloud(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': TENANT_ID,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sync orders incrementally
   */
  async syncOrders(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.orders);

    // Query only changed orders
    const changedOrders = await database.query(`
      SELECT * FROM orders
      WHERE updated_at > ? OR created_at > ?
      ORDER BY updated_at DESC
      LIMIT 500
    `, [lastSync, lastSync]);

    if (changedOrders.length === 0) {
      return { synced: 0, failed: 0 };
    }

    console.log(`[IncrementalSync] Found ${changedOrders.length} changed orders`);

    // Include order items
    const ordersWithItems = await Promise.all(
      changedOrders.map(async (order) => {
        const items = await database.query(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );
        return { ...order, items };
      })
    );

    // Sync to cloud
    const result = await this.syncToCloud('/orders/sync', { orders: ordersWithItems });

    // Update timestamp if successful
    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.orders);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync tips incrementally
   */
  async syncTips(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.tips);

    const changedTips = await database.query(`
      SELECT * FROM tips
      WHERE created_at > ?
      ORDER BY created_at DESC
      LIMIT 500
    `, [lastSync]);

    if (changedTips.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/tips/sync', { tips: changedTips });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.tips);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync sales incrementally
   */
  async syncSales(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.sales);

    const changedSales = await database.query(`
      SELECT * FROM sales_transactions
      WHERE completed_at > ?
      ORDER BY completed_at DESC
      LIMIT 500
    `, [lastSync]);

    if (changedSales.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/sales/sync', { transactions: changedSales });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.sales);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync menu incrementally
   */
  async syncMenu(): Promise<MenuSyncResult> {
    const lastMenuSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.menuItems);
    const lastCategorySync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.categories);

    // Sync menu items
    const changedMenuItems = await database.query(`
      SELECT * FROM menu_items
      WHERE updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 500
    `, [lastMenuSync]);

    let menuItemsSynced = 0;
    if (changedMenuItems.length > 0) {
      const result = await this.syncToCloud('/menu/sync', { menuItems: changedMenuItems });
      menuItemsSynced = result.synced || 0;

      if (result.success) {
        await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.menuItems);
      }
    }

    // Sync categories
    const changedCategories = await database.query(`
      SELECT * FROM menu_categories
      WHERE updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 100
    `, [lastCategorySync]);

    let categoriesSynced = 0;
    if (changedCategories.length > 0) {
      const result = await this.syncToCloud('/categories/sync', { categories: changedCategories });
      categoriesSynced = result.synced || 0;

      if (result.success) {
        await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.categories);
      }
    }

    return {
      menuItems: menuItemsSynced,
      categories: categoriesSynced,
    };
  }

  /**
   * Sync staff users incrementally
   */
  async syncStaff(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.staff);

    const changedStaff = await database.query(`
      SELECT * FROM staff_users
      WHERE created_at > ? OR updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 100
    `, [lastSync, lastSync]);

    if (changedStaff.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/staff/sync', { staff: changedStaff });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.staff);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync staff login history incrementally
   */
  async syncStaffLoginHistory(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.staffLoginHistory);

    const changedLogins = await database.query(`
      SELECT * FROM staff_login_history
      WHERE login_at > ?
      ORDER BY login_at DESC
      LIMIT 500
    `, [lastSync]);

    if (changedLogins.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/staff/login-history/sync', { loginHistory: changedLogins });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.staffLoginHistory);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync cash registers incrementally
   */
  async syncCashRegisters(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.cashRegisters);

    const changedRegisters = await database.query(`
      SELECT * FROM daily_cash_registers
      WHERE updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 100
    `, [lastSync]);

    if (changedRegisters.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/cash-registers/sync', { cashRegisters: changedRegisters });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.cashRegisters);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync cash payouts incrementally
   */
  async syncCashPayouts(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.cashPayouts);

    const changedPayouts = await database.query(`
      SELECT * FROM cash_payouts
      WHERE updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 200
    `, [lastSync]);

    if (changedPayouts.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/cash-payouts/sync', { payouts: changedPayouts });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.cashPayouts);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync inventory suppliers incrementally
   */
  async syncInventorySuppliers(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventorySuppliers);

    const changedSuppliers = await database.query(`
      SELECT * FROM inventory_suppliers
      WHERE updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 100
    `, [lastSync]);

    if (changedSuppliers.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/inventory/suppliers/sync', { suppliers: changedSuppliers });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventorySuppliers);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync inventory items incrementally
   */
  async syncInventoryItems(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventoryItems);

    const changedItems = await database.query(`
      SELECT * FROM inventory_items
      WHERE updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 500
    `, [lastSync]);

    if (changedItems.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/inventory/items/sync', { items: changedItems });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventoryItems);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync inventory transactions incrementally
   */
  async syncInventoryTransactions(): Promise<SyncResult> {
    const lastSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventoryTransactions);

    const changedTransactions = await database.query(`
      SELECT * FROM inventory_transactions
      WHERE created_at > ?
      ORDER BY created_at DESC
      LIMIT 500
    `, [lastSync]);

    if (changedTransactions.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const result = await this.syncToCloud('/inventory/transactions/sync', { transactions: changedTransactions });

    if (result.success) {
      await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventoryTransactions);
    }

    return {
      synced: result.synced || 0,
      failed: result.failed || 0,
      errors: result.errors,
    };
  }

  /**
   * Sync inventory recipes incrementally
   */
  async syncInventoryRecipes(): Promise<RecipesSyncResult> {
    const lastRecipeSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventoryRecipes);
    const lastIngredientSync = await this.getLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventoryRecipeIngredients);

    // Sync recipes
    const changedRecipes = await database.query(`
      SELECT * FROM inventory_recipes
      WHERE updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 200
    `, [lastRecipeSync]);

    let recipesSynced = 0;
    if (changedRecipes.length > 0) {
      const result = await this.syncToCloud('/inventory/recipes/sync', { recipes: changedRecipes });
      recipesSynced = result.synced || 0;

      if (result.success) {
        await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventoryRecipes);
      }
    }

    // Sync recipe ingredients
    const changedIngredients = await database.query(`
      SELECT * FROM inventory_recipe_ingredients
      WHERE created_at > ?
      ORDER BY created_at DESC
      LIMIT 500
    `, [lastIngredientSync]);

    let ingredientsSynced = 0;
    if (changedIngredients.length > 0) {
      const result = await this.syncToCloud('/inventory/recipe-ingredients/sync', { recipeIngredients: changedIngredients });
      ingredientsSynced = result.synced || 0;

      if (result.success) {
        await this.updateLastSyncTimestamp(SYNC_TIMESTAMP_KEYS.inventoryRecipeIngredients);
      }
    }

    return {
      recipes: recipesSynced,
      ingredients: ingredientsSynced,
    };
  }

  /**
   * Reset sync timestamps (force full sync on next run)
   */
  async resetSyncTimestamps(tables?: string[]): Promise<void> {
    if (tables) {
      for (const table of tables) {
        const key = SYNC_TIMESTAMP_KEYS[table as keyof typeof SYNC_TIMESTAMP_KEYS];
        if (key) {
          localStorage.removeItem(key);
        }
      }
    } else {
      // Reset all
      Object.values(SYNC_TIMESTAMP_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
    }

    console.log('[IncrementalSync] Reset sync timestamps');
  }

  /**
   * Get sync status for all tables
   */
  async getSyncStatus(): Promise<Record<string, { lastSync: string; timeSince: number }>> {
    const status: Record<string, { lastSync: string; timeSince: number }> = {};

    for (const [table, key] of Object.entries(SYNC_TIMESTAMP_KEYS)) {
      const lastSync = await this.getLastSyncTimestamp(key);
      const timeSince = Date.now() - new Date(lastSync).getTime();

      status[table] = {
        lastSync,
        timeSince,
      };
    }

    return status;
  }
}
