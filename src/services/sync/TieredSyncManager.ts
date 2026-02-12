/**
 * Tiered Sync Manager
 * Manages periodic sync intervals with different priorities for different data types
 * Extended to support D1 cloud sync in addition to WebSocket sync
 */

import { requestBackgroundSync, isOnline } from './registerServiceWorker';
import { IncrementalSyncService } from './IncrementalSyncService';
import { OfflineQueue } from './OfflineQueue';
import { D1SyncService } from './D1SyncService';
import { getD1ProvisioningService } from '../d1ProvisioningService';
import { backgroundCoordinator } from '../backgroundOperationsCoordinator';
import { pluginSyncRegistry, PluginSyncHandler } from './PluginSyncRegistry';

export interface SyncInterval {
  name: string;
  interval: number; // milliseconds
  enabled: boolean;
  lastRun?: number;
}

export class TieredSyncManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private incrementalSync: IncrementalSyncService;
  private offlineQueue: OfflineQueue;
  private d1SyncService: D1SyncService | null = null;
  private isRunning = false;
  private d1SyncEnabled = false;

  // Sync intervals configuration
  // NOTE: Plugin-based architecture - only core POS data syncs here
  // Plugin data (menu, staff, inventory) is managed by plugins themselves
  private readonly SYNC_INTERVALS: Record<string, SyncInterval> = {
    // Tier 1: Critical core POS data (1 minute)
    orders: {
      name: 'orders',
      interval: 60000, // 1 minute
      enabled: true,
    },
    tips: {
      name: 'tips',
      interval: 60000, // 1 minute
      enabled: true,
    },
    sales: {
      name: 'sales',
      interval: 60000, // 1 minute
      enabled: true,
    },

    // Tier 2: Important core data (3 minutes)
    staffLoginHistory: {
      name: 'staffLoginHistory',
      interval: 180000, // 3 minutes
      enabled: true,
    },
    cashPayouts: {
      name: 'cashPayouts',
      interval: 180000, // 3 minutes
      enabled: true,
    },

    // Tier 3: Plugin data (DISABLED - handled by plugins)
    // Menu plugin manages menu sync
    menu: {
      name: 'menu',
      interval: 600000, // 10 minutes
      enabled: false, // Plugin-based
    },
    // People/Payroll plugin manages staff sync
    staff: {
      name: 'staff',
      interval: 600000, // 10 minutes
      enabled: false, // Plugin-based
    },
    // Inventory plugin manages these:
    inventoryItems: {
      name: 'inventoryItems',
      interval: 600000, // 10 minutes
      enabled: false, // Plugin-based
    },
    inventorySuppliers: {
      name: 'inventorySuppliers',
      interval: 600000, // 10 minutes
      enabled: false, // Plugin-based
    },
    inventoryTransactions: {
      name: 'inventoryTransactions',
      interval: 180000, // 3 minutes
      enabled: false, // Plugin-based
    },
    inventoryRecipes: {
      name: 'inventoryRecipes',
      interval: 1800000, // 30 minutes
      enabled: false, // Plugin-based
    },

    // Tier 4: Core bulk data (30 minutes)
    cashRegisters: {
      name: 'cashRegisters',
      interval: 1800000, // 30 minutes
      enabled: true,
    },
  };

  constructor(tenantId?: string, dbPath?: string) {
    this.incrementalSync = new IncrementalSyncService();
    this.offlineQueue = new OfflineQueue();

    // Initialize D1 sync service if tenant ID provided
    // Cloud sync enabled check happens in start() method
    if (tenantId && dbPath) {
      this.d1SyncService = new D1SyncService(tenantId, undefined, dbPath);
    }

    // Register with background operations coordinator
    // This allows critical operations to pause all sync activities
    backgroundCoordinator.register('tiered-sync-manager', {
      name: 'Tiered Sync Manager',
      pause: () => this.pause(),
      resume: () => this.resume(),
    });
  }

  /**
   * Check if required tables exist before starting sync
   */
  private async checkTablesExist(): Promise<boolean> {
    try {
      // Import Database dynamically to avoid circular dependency
      const { getDatabase } = await import('../../lib/database');
      const db = await getDatabase();

      // Check for core billing/orders table
      const result = await db.select(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='orders'"
      );

      return result.length > 0;
    } catch (error) {
      console.warn('[TieredSync] Could not check table existence:', error);
      return false;
    }
  }

  /**
   * Start all sync intervals
   * IMPORTANT: Only starts if required plugins are installed and tables exist
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[TieredSync] Already running');
      return;
    }

    // Check if required tables exist before starting
    const tablesExist = await this.checkTablesExist();
    if (!tablesExist) {
      console.log('[TieredSync] ⏭️  Skipping sync - required tables do not exist. Complete setup first or install required plugins.');
      return;
    }

    console.log('[TieredSync] Starting tiered sync manager...');
    this.isRunning = true;

    // Check if D1 cloud sync is enabled
    if (this.d1SyncService) {
      this.d1SyncEnabled = await getD1ProvisioningService().isCloudSyncEnabled();
      if (this.d1SyncEnabled) {
        console.log('[TieredSync] D1 cloud sync enabled');
      }
    }

    // IMPORTANT: Do NOT start automatic periodic sync
    // Sync is now event-driven (triggered by order creation, etc.)
    console.log('[TieredSync] ℹ️  Periodic sync disabled - sync is event-driven');

    // Process offline queue immediately on start (if any pending items)
    await this.processOfflineQueue();

    console.log('[TieredSync] Sync manager ready (event-driven mode)');
  }

  /**
   * Stop all sync intervals
   */
  stop(): void {
    console.log('[TieredSync] Stopping all sync intervals...');
    this.isRunning = false;

    for (const [key, timer] of this.intervals.entries()) {
      clearInterval(timer);
      console.log(`[TieredSync] Stopped interval: ${key}`);
    }

    this.intervals.clear();

    // Unregister from coordinator
    backgroundCoordinator.unregister('tiered-sync-manager');
  }

  /**
   * Pause all sync intervals (called by background coordinator during critical operations)
   * Preserves state so intervals can be resumed
   */
  private pause(): void {
    console.log('[TieredSync] Pausing all sync intervals...');

    for (const [key, timer] of this.intervals.entries()) {
      clearInterval(timer);
      console.log(`[TieredSync] Paused interval: ${key}`);
    }

    this.intervals.clear();
  }

  /**
   * Resume all sync intervals (called by background coordinator after critical operations)
   */
  private resume(): void {
    if (!this.isRunning) {
      console.log('[TieredSync] Not resuming - service was explicitly stopped');
      return;
    }

    console.log('[TieredSync] Resuming all sync intervals...');

    // Restart each enabled sync interval
    for (const [key, config] of Object.entries(this.SYNC_INTERVALS)) {
      if (config.enabled) {
        this.startInterval(key, config);
      }
    }

    // Restart plugin sync intervals
    this.startPluginSyncIntervals();

    console.log('[TieredSync] All sync intervals resumed (core + plugins)');
  }

  /**
   * Start a specific sync interval
   */
  private startInterval(key: string, config: SyncInterval): void {
    const syncFunction = this.getSyncFunction(config.name);

    if (!syncFunction) {
      console.warn(`[TieredSync] No sync function found for: ${config.name}`);
      return;
    }

    // Run immediately
    syncFunction().catch((error) => {
      console.error(`[TieredSync] Initial sync failed for ${config.name}:`, error);
    });

    // Then run on interval
    const timer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await syncFunction();
        this.SYNC_INTERVALS[key].lastRun = Date.now();
      } catch (error) {
        console.error(`[TieredSync] Sync failed for ${config.name}:`, error);
      }
    }, config.interval);

    this.intervals.set(key, timer);
    console.log(`[TieredSync] Started interval: ${config.name} (every ${config.interval}ms)`);
  }

  /**
   * Start sync intervals for registered periodic plugins only
   * Manual and on-update plugins are triggered by events, not intervals
   */
  private startPluginSyncIntervals(): void {
    const periodicHandlers = pluginSyncRegistry.getPeriodicHandlers();
    const manualHandlers = pluginSyncRegistry.getManualHandlers();
    const onUpdateHandlers = pluginSyncRegistry.getOnUpdateHandlers();

    if (periodicHandlers.length === 0 && manualHandlers.length === 0 && onUpdateHandlers.length === 0) {
      console.log('[TieredSync] No plugin sync handlers registered');
      return;
    }

    // Log summary of registered plugins
    if (manualHandlers.length > 0) {
      console.log(`[TieredSync] Registered ${manualHandlers.length} manual-sync plugin(s): ${manualHandlers.map(h => h.pluginName).join(', ')}`);
    }
    if (onUpdateHandlers.length > 0) {
      console.log(`[TieredSync] Registered ${onUpdateHandlers.length} on-update plugin(s): ${onUpdateHandlers.map(h => h.pluginName).join(', ')}`);
    }

    // Only start intervals for periodic plugins
    if (periodicHandlers.length > 0) {
      console.log(`[TieredSync] Starting ${periodicHandlers.length} periodic plugin sync interval(s)...`);
      for (const handler of periodicHandlers) {
        this.startPluginSyncInterval(handler);
      }
    }
  }

  /**
   * Start sync interval for a specific plugin
   */
  private startPluginSyncInterval(handler: PluginSyncHandler): void {
    const key = `plugin:${handler.pluginId}`;

    // Check if plugin data exists before starting sync
    const initSync = async () => {
      try {
        // Optional check if plugin data exists
        if (handler.checkDataExists) {
          const dataExists = await handler.checkDataExists();
          if (!dataExists) {
            console.log(`[TieredSync] Plugin ${handler.pluginName} has no data, skipping sync`);
            return;
          }
        }

        // Run plugin sync
        const result = await handler.syncFunction();
        console.log(`[TieredSync] Plugin ${handler.pluginName} synced: ${result.synced} records (${result.tables.join(', ')})`);
      } catch (error) {
        console.error(`[TieredSync] Plugin ${handler.pluginName} sync failed:`, error);
        // Don't crash - plugin sync errors shouldn't affect core sync
      }
    };

    // Run immediately
    initSync();

    // Then run on interval
    const timer = setInterval(async () => {
      if (!this.isRunning) return;
      await initSync();
    }, handler.syncInterval);

    this.intervals.set(key, timer);
    console.log(`[TieredSync] Started plugin sync: ${handler.pluginName} (every ${handler.syncInterval}ms)`);
  }

  /**
   * Get sync function for a specific data type
   */
  private getSyncFunction(name: string): (() => Promise<void>) | null {
    const syncFunctions: Record<string, () => Promise<void>> = {
      orders: () => this.syncOrders(),
      tips: () => this.syncTips(),
      sales: () => this.syncSales(),
      staffLoginHistory: () => this.syncStaffLoginHistory(),
      cashPayouts: () => this.syncCashPayouts(),
      inventoryTransactions: () => this.syncInventoryTransactions(),
      menu: () => this.syncMenu(),
      staff: () => this.syncStaff(),
      inventoryItems: () => this.syncInventoryItems(),
      inventorySuppliers: () => this.syncInventorySuppliers(),
      cashRegisters: () => this.syncCashRegisters(),
      inventoryRecipes: () => this.syncInventoryRecipes(),
    };

    return syncFunctions[name] || null;
  }

  /**
   * Process offline queue
   */
  private async processOfflineQueue(): Promise<void> {
    if (!isOnline()) {
      console.log('[TieredSync] Offline, skipping queue processing');
      return;
    }

    console.log('[TieredSync] Processing offline queue...');

    try {
      await requestBackgroundSync('sync-all');
    } catch (error) {
      console.error('[TieredSync] Failed to process offline queue:', error);
    }
  }

  /**
   * Sync orders (Tier 1 - Critical)
   */
  private async syncOrders(): Promise<void> {
    console.log('[TieredSync] Syncing orders...');

    try {
      const result = await this.incrementalSync.syncOrders();
      console.log(`[TieredSync] Orders synced: ${result.synced} new, ${result.failed} failed`);
    } catch (error) {
      console.error('[TieredSync] Orders sync failed:', error);
      // Add to offline queue
      await this.offlineQueue.addFailedSync('orders', error);
      throw error;
    }
  }

  /**
   * Sync tips (Tier 1 - Critical)
   */
  private async syncTips(): Promise<void> {
    console.log('[TieredSync] Syncing tips...');

    try {
      // WebSocket sync (existing)
      const result = await this.incrementalSync.syncTips();
      console.log(`[TieredSync] Tips synced: ${result.synced} new, ${result.failed} failed`);

      // D1 cloud sync (new)
      if (this.d1SyncService && this.d1SyncEnabled) {
        try {
          const d1Result = await this.d1SyncService.syncTipsToD1();
          console.log(`[TieredSync] D1 tips synced: ${d1Result.synced} records`);
        } catch (d1Error) {
          console.error('[TieredSync] D1 tips sync failed (continuing):', d1Error);
        }
      }
    } catch (error) {
      console.error('[TieredSync] Tips sync failed:', error);
      await this.offlineQueue.addFailedSync('tips', error);
      throw error;
    }
  }

  /**
   * Sync sales (Tier 1 - Critical)
   */
  private async syncSales(): Promise<void> {
    console.log('[TieredSync] Syncing sales...');

    try {
      // WebSocket sync (existing)
      const result = await this.incrementalSync.syncSales();
      console.log(`[TieredSync] Sales synced: ${result.synced} new, ${result.failed} failed`);

      // D1 cloud sync (new)
      if (this.d1SyncService && this.d1SyncEnabled) {
        try {
          const d1Result = await this.d1SyncService.syncSalesToD1();
          console.log(`[TieredSync] D1 sales synced: ${d1Result.synced} records`);
        } catch (d1Error) {
          console.error('[TieredSync] D1 sales sync failed (continuing):', d1Error);
          // Don't throw - D1 sync is optional
        }
      }
    } catch (error) {
      console.error('[TieredSync] Sales sync failed:', error);
      await this.offlineQueue.addFailedSync('sales', error);
      throw error;
    }
  }

  /**
   * Sync staff login history (Tier 2 - Important)
   */
  private async syncStaffLoginHistory(): Promise<void> {
    console.log('[TieredSync] Syncing staff login history...');

    try {
      const result = await this.incrementalSync.syncStaffLoginHistory();
      console.log(`[TieredSync] Staff login history synced: ${result.synced} new`);
    } catch (error) {
      console.error('[TieredSync] Staff login history sync failed:', error);
      await this.offlineQueue.addFailedSync('staffLoginHistory', error);
      throw error;
    }
  }

  /**
   * Sync cash payouts (Tier 2 - Important)
   */
  private async syncCashPayouts(): Promise<void> {
    console.log('[TieredSync] Syncing cash payouts...');

    try {
      const result = await this.incrementalSync.syncCashPayouts();
      console.log(`[TieredSync] Cash payouts synced: ${result.synced} new`);
    } catch (error) {
      console.error('[TieredSync] Cash payouts sync failed:', error);
      await this.offlineQueue.addFailedSync('cashPayouts', error);
      throw error;
    }
  }

  /**
   * Sync inventory transactions (Tier 2 - Important)
   */
  private async syncInventoryTransactions(): Promise<void> {
    console.log('[TieredSync] Syncing inventory transactions...');

    try {
      const result = await this.incrementalSync.syncInventoryTransactions();
      console.log(`[TieredSync] Inventory transactions synced: ${result.synced} new`);
    } catch (error) {
      console.error('[TieredSync] Inventory transactions sync failed:', error);
      await this.offlineQueue.addFailedSync('inventoryTransactions', error);
      throw error;
    }
  }

  /**
   * Sync menu (Tier 3 - Configuration)
   */
  private async syncMenu(): Promise<void> {
    console.log('[TieredSync] Syncing menu...');

    try {
      // WebSocket sync (existing)
      const result = await this.incrementalSync.syncMenu();
      console.log(`[TieredSync] Menu synced: ${result.menuItems} items, ${result.categories} categories`);

      // D1 cloud sync (new)
      if (this.d1SyncService && this.d1SyncEnabled) {
        try {
          const d1Result = await this.d1SyncService.syncMenuToD1();
          console.log(`[TieredSync] D1 menu synced: ${d1Result.synced} records`);
        } catch (d1Error) {
          console.error('[TieredSync] D1 menu sync failed (continuing):', d1Error);
        }
      }
    } catch (error) {
      console.error('[TieredSync] Menu sync failed:', error);
      await this.offlineQueue.addFailedSync('menu', error);
      throw error;
    }
  }

  /**
   * Sync staff (Tier 3 - Configuration)
   */
  private async syncStaff(): Promise<void> {
    console.log('[TieredSync] Syncing staff...');

    try {
      // WebSocket sync (existing)
      const result = await this.incrementalSync.syncStaff();
      console.log(`[TieredSync] Staff synced: ${result.synced} users`);

      // D1 cloud sync (new)
      if (this.d1SyncService && this.d1SyncEnabled) {
        try {
          const d1Result = await this.d1SyncService.syncStaffToD1();
          console.log(`[TieredSync] D1 staff synced: ${d1Result.synced} records`);
        } catch (d1Error) {
          console.error('[TieredSync] D1 staff sync failed (continuing):', d1Error);
        }
      }
    } catch (error) {
      console.error('[TieredSync] Staff sync failed:', error);
      await this.offlineQueue.addFailedSync('staff', error);
      throw error;
    }
  }

  /**
   * Sync inventory items (Tier 3 - Configuration)
   */
  private async syncInventoryItems(): Promise<void> {
    console.log('[TieredSync] Syncing inventory items...');

    try {
      const result = await this.incrementalSync.syncInventoryItems();
      console.log(`[TieredSync] Inventory items synced: ${result.synced} items`);
    } catch (error) {
      console.error('[TieredSync] Inventory items sync failed:', error);
      await this.offlineQueue.addFailedSync('inventoryItems', error);
      throw error;
    }
  }

  /**
   * Sync inventory suppliers (Tier 3 - Configuration)
   */
  private async syncInventorySuppliers(): Promise<void> {
    console.log('[TieredSync] Syncing inventory suppliers...');

    try {
      const result = await this.incrementalSync.syncInventorySuppliers();
      console.log(`[TieredSync] Inventory suppliers synced: ${result.synced} suppliers`);
    } catch (error) {
      console.error('[TieredSync] Inventory suppliers sync failed:', error);
      await this.offlineQueue.addFailedSync('inventorySuppliers', error);
      throw error;
    }
  }

  /**
   * Sync cash registers (Tier 4 - Bulk)
   */
  private async syncCashRegisters(): Promise<void> {
    console.log('[TieredSync] Syncing cash registers...');

    try {
      const result = await this.incrementalSync.syncCashRegisters();
      console.log(`[TieredSync] Cash registers synced: ${result.synced} registers`);
    } catch (error) {
      console.error('[TieredSync] Cash registers sync failed:', error);
      await this.offlineQueue.addFailedSync('cashRegisters', error);
      throw error;
    }
  }

  /**
   * Sync inventory recipes (Tier 4 - Bulk)
   */
  private async syncInventoryRecipes(): Promise<void> {
    console.log('[TieredSync] Syncing inventory recipes...');

    try {
      const result = await this.incrementalSync.syncInventoryRecipes();
      console.log(`[TieredSync] Inventory recipes synced: ${result.recipes} recipes, ${result.ingredients} ingredients`);
    } catch (error) {
      console.error('[TieredSync] Inventory recipes sync failed:', error);
      await this.offlineQueue.addFailedSync('inventoryRecipes', error);
      throw error;
    }
  }

  /**
   * Trigger immediate sync for a specific data type
   */
  async triggerImmediateSync(dataType: string): Promise<void> {
    console.log(`[TieredSync] Triggering immediate sync for: ${dataType}`);

    const syncFunction = this.getSyncFunction(dataType);

    if (!syncFunction) {
      console.warn(`[TieredSync] No sync function found for: ${dataType}`);
      return;
    }

    try {
      await syncFunction();
    } catch (error) {
      console.error(`[TieredSync] Immediate sync failed for ${dataType}:`, error);
      throw error;
    }
  }

  /**
   * Manually trigger sync for a plugin
   * Used for manual-type plugins (e.g., menu, people)
   */
  async triggerPluginSync(pluginId: string): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    console.log(`[TieredSync] Manually triggering plugin sync: ${pluginId}`);

    try {
      return await pluginSyncRegistry.triggerManualSync(pluginId);
    } catch (error) {
      console.error(`[TieredSync] Manual plugin sync failed for ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Trigger on-update sync for a plugin
   * Used when data changes (e.g., after menu item saved)
   */
  async triggerPluginOnUpdateSync(pluginId: string, context?: { tables?: string[] }): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    console.log(`[TieredSync] Triggering on-update sync for plugin: ${pluginId}`, context);

    try {
      return await pluginSyncRegistry.triggerOnUpdateSync(pluginId, context);
    } catch (error) {
      console.error(`[TieredSync] On-update plugin sync failed for ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [key, config] of Object.entries(this.SYNC_INTERVALS)) {
      status[key] = {
        enabled: config.enabled,
        interval: config.interval,
        lastRun: config.lastRun,
        timeSinceLastRun: config.lastRun ? Date.now() - config.lastRun : null,
      };
    }

    return {
      isRunning: this.isRunning,
      intervals: status,
    };
  }

  /**
   * Update interval configuration
   */
  updateInterval(key: string, interval: number): void {
    if (this.SYNC_INTERVALS[key]) {
      this.SYNC_INTERVALS[key].interval = interval;

      // Restart the interval if running
      if (this.intervals.has(key)) {
        const timer = this.intervals.get(key);
        if (timer) {
          clearInterval(timer);
        }
        this.startInterval(key, this.SYNC_INTERVALS[key]);
      }

      console.log(`[TieredSync] Updated interval for ${key}: ${interval}ms`);
    }
  }

  /**
   * Enable/disable a specific sync interval
   */
  toggleInterval(key: string, enabled: boolean): void {
    if (this.SYNC_INTERVALS[key]) {
      this.SYNC_INTERVALS[key].enabled = enabled;

      if (enabled && this.isRunning && !this.intervals.has(key)) {
        this.startInterval(key, this.SYNC_INTERVALS[key]);
      } else if (!enabled && this.intervals.has(key)) {
        const timer = this.intervals.get(key);
        if (timer) {
          clearInterval(timer);
        }
        this.intervals.delete(key);
      }

      console.log(`[TieredSync] ${enabled ? 'Enabled' : 'Disabled'} interval: ${key}`);
    }
  }

  /**
   * Enable D1 cloud sync
   */
  async enableD1Sync(tenantId: string, dbPath: string): Promise<void> {
    if (!this.d1SyncService) {
      this.d1SyncService = new D1SyncService(tenantId, undefined, dbPath);
    }
    this.d1SyncEnabled = true;
    await getD1ProvisioningService().enableCloudSync();
    console.log('[TieredSync] D1 cloud sync enabled');
  }

  /**
   * Disable D1 cloud sync
   */
  async disableD1Sync(): Promise<void> {
    this.d1SyncEnabled = false;
    await getD1ProvisioningService().disableCloudSync();
    console.log('[TieredSync] D1 cloud sync disabled');
  }

  /**
   * Check if D1 sync is enabled
   */
  isD1SyncEnabled(): boolean {
    return this.d1SyncEnabled;
  }

  /**
   * Get D1 sync status
   */
  async getD1SyncStatus() {
    if (!this.d1SyncService) {
      return null;
    }
    return await this.d1SyncService.getSyncStatus();
  }
}

// Singleton instance
let syncManagerInstance: TieredSyncManager | null = null;

export function getTieredSyncManager(tenantId?: string, dbPath?: string): TieredSyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new TieredSyncManager(tenantId, dbPath);
  }
  return syncManagerInstance;
}

export function resetTieredSyncManager(): void {
  if (syncManagerInstance) {
    syncManagerInstance.stop();
    syncManagerInstance = null;
  }
}
