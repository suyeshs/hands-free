/**
 * Subscription Meals Plugin Sync Implementation
 *
 * Syncs subscription data to Cloudflare D1 via tenant worker
 * - Subscription plans
 * - Cuisine types
 * - Weekly menus
 * - Menu item assignments
 * - Deliveries
 *
 * Sync Type: MANUAL / ON-UPDATE
 * - Manual: User clicks "Sync Subscription Data" button
 * - On-Update: After creating weekly menus, updating plans, etc.
 */

import { pluginSyncRegistry } from '../../../src/services/sync/PluginSyncRegistry';
import { invoke } from '@tauri-apps/api/core';

interface SyncResult {
  synced: number;
  failed: number;
  errors?: string[];
}

export class SubscriptionPluginSync {
  private pluginId = 'subscription-meals';
  private tenantId: string;
  private dbPath: string;
  private workerUrl: string;

  constructor(tenantId: string, dbPath: string, workerUrl?: string) {
    this.tenantId = tenantId;
    this.dbPath = dbPath;
    // Default to restaurant worker URL with dispatch to tenant worker
    this.workerUrl = workerUrl || `https://restaurant.guanix.com/api`;
  }

  /**
   * Initialize and register sync handler
   * Registers as 'manual' type - no automatic sync intervals
   */
  async initialize(): Promise<void> {
    pluginSyncRegistry.register({
      pluginId: this.pluginId,
      pluginName: 'Subscription Meals',
      syncTables: [
        'subscription_plans',
        'subscription_cuisine_types',
        'subscription_menu_weeks',
        'subscription_menu_items',
        'subscription_deliveries',
      ],
      syncInterval: 0, // Manual sync only
      enabled: true,
      syncType: 'manual', // ← Manual trigger only

      syncFunction: async () => {
        return await this.syncAllSubscriptionData();
      },

      checkDataExists: async () => {
        return await this.hasSubscriptionData();
      },

      getStatus: async () => {
        return await this.getSyncStatus();
      },
    });

    console.log('[SubscriptionPluginSync] Registered as manual-sync');
  }

  /**
   * Cleanup - unregister sync handler
   */
  cleanup(): void {
    pluginSyncRegistry.unregister(this.pluginId);
    console.log('[SubscriptionPluginSync] Sync handler unregistered');
  }

  /**
   * Main sync logic - syncs all subscription data
   */
  private async syncAllSubscriptionData(): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    let totalSynced = 0;
    let totalFailed = 0;
    const syncedTables: string[] = [];
    const errors: string[] = [];

    try {
      // 1. Sync subscription plans
      console.log('[SubscriptionPluginSync] Syncing plans...');
      const plansResult = await this.syncSubscriptionPlans();
      totalSynced += plansResult.synced;
      totalFailed += plansResult.failed;
      if (plansResult.synced > 0) syncedTables.push('subscription_plans');
      if (plansResult.errors) errors.push(...plansResult.errors);

      // 2. Sync cuisine types
      console.log('[SubscriptionPluginSync] Syncing cuisine types...');
      const cuisineTypesResult = await this.syncCuisineTypes();
      totalSynced += cuisineTypesResult.synced;
      totalFailed += cuisineTypesResult.failed;
      if (cuisineTypesResult.synced > 0) syncedTables.push('subscription_cuisine_types');
      if (cuisineTypesResult.errors) errors.push(...cuisineTypesResult.errors);

      // 3. Sync weekly menus
      console.log('[SubscriptionPluginSync] Syncing weekly menus...');
      const weeksResult = await this.syncWeeklyMenus();
      totalSynced += weeksResult.synced;
      totalFailed += weeksResult.failed;
      if (weeksResult.synced > 0) syncedTables.push('subscription_menu_weeks');
      if (weeksResult.errors) errors.push(...weeksResult.errors);

      // 4. Sync menu items
      console.log('[SubscriptionPluginSync] Syncing menu items...');
      const itemsResult = await this.syncMenuItems();
      totalSynced += itemsResult.synced;
      totalFailed += itemsResult.failed;
      if (itemsResult.synced > 0) syncedTables.push('subscription_menu_items');
      if (itemsResult.errors) errors.push(...itemsResult.errors);

      // 5. Sync deliveries
      console.log('[SubscriptionPluginSync] Syncing deliveries...');
      const deliveriesResult = await this.syncDeliveries();
      totalSynced += deliveriesResult.synced;
      totalFailed += deliveriesResult.failed;
      if (deliveriesResult.synced > 0) syncedTables.push('subscription_deliveries');
      if (deliveriesResult.errors) errors.push(...deliveriesResult.errors);

      console.log(
        `[SubscriptionPluginSync] Sync complete: ${totalSynced} synced, ${totalFailed} failed`
      );

      if (errors.length > 0) {
        console.error('[SubscriptionPluginSync] Errors:', errors);
      }

      return {
        synced: totalSynced,
        failed: totalFailed,
        tables: syncedTables,
      };
    } catch (error) {
      console.error('[SubscriptionPluginSync] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync subscription plans to cloud
   */
  private async syncSubscriptionPlans(): Promise<SyncResult> {
    try {
      // Query local database for all plans
      const plans = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: `SELECT * FROM subscription_plans WHERE tenant_id = ?`,
        params: [this.tenantId],
      });

      if (!plans || plans.length === 0) {
        return { synced: 0, failed: 0 };
      }

      // Convert to camelCase for API
      const plansData = plans.map((plan) => ({
        id: plan.id,
        tenantId: plan.tenant_id,
        name: plan.name,
        description: plan.description,
        pricePerWeek: plan.price_per_week,
        mealsPerWeek: plan.meals_per_week,
        deliveryDays: plan.delivery_days,
        active: plan.active,
        cuisineTypes: plan.cuisine_types,
        mealSelectionLimit: plan.meal_selection_limit,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      }));

      // Send to worker
      const response = await fetch(`${this.workerUrl}/subscriptions/plans/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': this.tenantId,
        },
        body: JSON.stringify({ plans: plansData }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to sync plans: ${error}`);
      }

      const result = await response.json();

      return {
        synced: result.synced || 0,
        failed: result.failed || 0,
        errors: result.errors,
      };
    } catch (error) {
      console.error('[SubscriptionPluginSync] Failed to sync plans:', error);
      return { synced: 0, failed: 1, errors: [String(error)] };
    }
  }

  /**
   * Sync cuisine types to cloud
   */
  private async syncCuisineTypes(): Promise<SyncResult> {
    try {
      const cuisineTypes = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: `SELECT * FROM subscription_cuisine_types WHERE tenant_id = ?`,
        params: [this.tenantId],
      });

      if (!cuisineTypes || cuisineTypes.length === 0) {
        return { synced: 0, failed: 0 };
      }

      const cuisineTypesData = cuisineTypes.map((ct) => ({
        id: ct.id,
        tenantId: ct.tenant_id,
        name: ct.name,
        description: ct.description,
        icon: ct.icon,
        active: ct.active,
        createdAt: ct.created_at,
      }));

      const response = await fetch(`${this.workerUrl}/subscriptions/cuisine-types/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': this.tenantId,
        },
        body: JSON.stringify({ cuisineTypes: cuisineTypesData }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to sync cuisine types: ${error}`);
      }

      const result = await response.json();

      return {
        synced: result.synced || 0,
        failed: result.failed || 0,
        errors: result.errors,
      };
    } catch (error) {
      console.error('[SubscriptionPluginSync] Failed to sync cuisine types:', error);
      return { synced: 0, failed: 1, errors: [String(error)] };
    }
  }

  /**
   * Sync weekly menus to cloud
   */
  private async syncWeeklyMenus(): Promise<SyncResult> {
    try {
      const weeks = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: `SELECT * FROM subscription_menu_weeks WHERE tenant_id = ?`,
        params: [this.tenantId],
      });

      if (!weeks || weeks.length === 0) {
        return { synced: 0, failed: 0 };
      }

      const weeksData = weeks.map((week) => ({
        id: week.id,
        tenantId: week.tenant_id,
        weekNumber: week.week_number,
        year: week.year,
        cuisineType: week.cuisine_type,
        startDate: week.start_date,
        endDate: week.end_date,
        active: week.active,
        published: week.published,
        createdAt: week.created_at,
        updatedAt: week.updated_at,
      }));

      const response = await fetch(`${this.workerUrl}/subscriptions/weeks/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': this.tenantId,
        },
        body: JSON.stringify({ weeks: weeksData }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to sync weeks: ${error}`);
      }

      const result = await response.json();

      return {
        synced: result.synced || 0,
        failed: result.failed || 0,
        errors: result.errors,
      };
    } catch (error) {
      console.error('[SubscriptionPluginSync] Failed to sync weeks:', error);
      return { synced: 0, failed: 1, errors: [String(error)] };
    }
  }

  /**
   * Sync subscription menu items to cloud
   */
  private async syncMenuItems(): Promise<SyncResult> {
    try {
      const items = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: `SELECT * FROM subscription_menu_items`,
        params: [],
      });

      if (!items || items.length === 0) {
        return { synced: 0, failed: 0 };
      }

      const itemsData = items.map((item) => ({
        id: item.id,
        menuWeekId: item.menu_week_id,
        menuItemId: item.menu_item_id,
        available: item.available,
        maxOrdersPerWeek: item.max_orders_per_week,
        sortOrder: item.sort_order,
        createdAt: item.created_at,
      }));

      const response = await fetch(`${this.workerUrl}/subscriptions/menu-items/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': this.tenantId,
        },
        body: JSON.stringify({ items: itemsData }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to sync menu items: ${error}`);
      }

      const result = await response.json();

      return {
        synced: result.synced || 0,
        failed: result.failed || 0,
        errors: result.errors,
      };
    } catch (error) {
      console.error('[SubscriptionPluginSync] Failed to sync menu items:', error);
      return { synced: 0, failed: 1, errors: [String(error)] };
    }
  }

  /**
   * Sync deliveries to cloud
   */
  private async syncDeliveries(): Promise<SyncResult> {
    try {
      const deliveries = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: `SELECT * FROM subscription_deliveries WHERE tenant_id = ?`,
        params: [this.tenantId],
      });

      if (!deliveries || deliveries.length === 0) {
        return { synced: 0, failed: 0 };
      }

      const deliveriesData = deliveries.map((delivery) => ({
        id: delivery.id,
        tenantId: delivery.tenant_id,
        subscriptionId: delivery.subscription_id,
        preferenceId: delivery.preference_id,
        scheduledDate: delivery.scheduled_date,
        scheduledTimeSlot: delivery.scheduled_time_slot,
        status: delivery.status,
        towerNumber: delivery.tower_number,
        apartmentNumber: delivery.apartment_number,
        distanceFromKitchen: delivery.distance_from_kitchen,
        deliveryNotes: delivery.delivery_notes,
        assignedDriver: delivery.assigned_driver,
        deliveredAt: delivery.delivered_at,
        deliveryProof: delivery.delivery_proof,
        createdAt: delivery.created_at,
        updatedAt: delivery.updated_at,
      }));

      const response = await fetch(`${this.workerUrl}/subscriptions/deliveries/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': this.tenantId,
        },
        body: JSON.stringify({ deliveries: deliveriesData }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to sync deliveries: ${error}`);
      }

      const result = await response.json();

      return {
        synced: result.synced || 0,
        failed: result.failed || 0,
        errors: result.errors,
      };
    } catch (error) {
      console.error('[SubscriptionPluginSync] Failed to sync deliveries:', error);
      return { synced: 0, failed: 1, errors: [String(error)] };
    }
  }

  /**
   * Check if subscription data exists
   */
  private async hasSubscriptionData(): Promise<boolean> {
    try {
      const result = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: `SELECT COUNT(*) as count FROM subscription_plans WHERE tenant_id = ?`,
        params: [this.tenantId],
      });

      return (result[0]?.count || 0) > 0;
    } catch (error) {
      console.error('[SubscriptionPluginSync] Error checking data exists:', error);
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
    try {
      // Get total count of subscription plans
      const countResult = await invoke<any[]>('query_sqlite', {
        dbPath: this.dbPath,
        query: `SELECT COUNT(*) as count FROM subscription_plans WHERE tenant_id = ?`,
        params: [this.tenantId],
      });

      return {
        recordCount: countResult[0]?.count || 0,
      };
    } catch (error) {
      return { lastError: String(error) };
    }
  }
}

/**
 * Usage Example:
 *
 * 1. Initialize subscription sync:
 *    const subscriptionSync = new SubscriptionPluginSync(tenantId, dbPath);
 *    await subscriptionSync.initialize();
 *
 * 2. Manually trigger sync from UI button:
 *    import { getTieredSyncManager } from '@/services/sync/TieredSyncManager';
 *
 *    const handleSyncSubscriptions = async () => {
 *      const syncManager = getTieredSyncManager();
 *      const result = await syncManager.triggerPluginSync('subscription-meals');
 *      console.log(`Synced ${result.synced} subscription records`);
 *    };
 *
 * 3. Trigger sync after creating weekly menu:
 *    const handleCreateWeeklyMenu = async (week) => {
 *      // Save to database
 *      await invoke('create_weekly_menu', { ...week });
 *
 *      // Trigger sync after creation
 *      const syncManager = getTieredSyncManager();
 *      await syncManager.triggerPluginOnUpdateSync('subscription-meals', {
 *        tables: ['subscription_menu_weeks', 'subscription_menu_items']
 *      });
 *    };
 */
