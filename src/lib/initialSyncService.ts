/**
 * Initial Sync Service
 *
 * Orchestrates full data sync from cloud on first install or when explicitly requested.
 * Ensures all POS required data (settings, staff, floor plan, menu, etc.) is available.
 */

import { backendApi } from './backendApi';
import { useStaffStore } from '../stores/staffStore';
import { useFloorPlanStore } from '../stores/floorPlanStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { usePrinterStore } from '../stores/printerStore';
import { useAggregatorSettingsStore } from '../stores/aggregatorSettingsStore';
import { useMenuStore } from '../stores/menuStore';

export interface SyncStatus {
  step: string;
  progress: number; // 0-100
  message: string;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  syncedItems: {
    restaurantSettings: boolean;
    staff: boolean;
    floorPlan: boolean;
    menu: boolean;
    dineInPricing: boolean;
    printerConfig: boolean;
    aggregatorSettings: boolean;
  };
  errors: string[];
  duration: number;
}

// Sync steps with their weights for progress calculation
export const SYNC_STEPS = [
  { id: 'settings', label: 'Restaurant Settings', weight: 15 },
  { id: 'staff', label: 'Staff Members', weight: 15 },
  { id: 'floorPlan', label: 'Floor Plan', weight: 15 },
  { id: 'menu', label: 'Menu Items', weight: 25 },
  { id: 'dineInPricing', label: 'Dine-In Pricing', weight: 10 },
  { id: 'printerConfig', label: 'Printer Configuration', weight: 10 },
  { id: 'aggregatorSettings', label: 'Aggregator Settings', weight: 10 },
] as const;

class InitialSyncService {
  private isSyncing = false;
  private statusCallbacks: ((status: SyncStatus) => void)[] = [];

  /**
   * Subscribe to sync status updates
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyStatus(status: SyncStatus): void {
    this.statusCallbacks.forEach((cb) => cb(status));
  }

  /**
   * Check if initial sync is needed (first install or no data)
   */
  async needsInitialSync(tenantId: string): Promise<boolean> {
    // Check if we have essential data locally
    const staffStore = useStaffStore.getState();
    const settingsStore = useRestaurantSettingsStore.getState();
    const floorPlanStore = useFloorPlanStore.getState();

    // If we don't have staff or settings configured, we likely need initial sync
    const hasStaff = staffStore.staff.length > 0;
    const hasSettings = settingsStore.isConfigured;
    const hasFloorPlan = floorPlanStore.sections.length > 0;

    if (!hasStaff && !hasSettings && !hasFloorPlan) {
      console.log('[InitialSync] No local data found, initial sync needed');
      return true;
    }

    // Check if we've synced before
    const lastSyncKey = `pos_last_sync_${tenantId}`;
    const lastSync = localStorage.getItem(lastSyncKey);

    if (!lastSync) {
      console.log('[InitialSync] No previous sync record, initial sync needed');
      return true;
    }

    return false;
  }

  /**
   * Perform full initial sync from cloud
   * @param tenantId - Tenant identifier
   * @param _options - Options (force: skip needsSync check)
   */
  async performInitialSync(
    tenantId: string,
    _options: { force?: boolean } = {}
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      console.warn('[InitialSync] Sync already in progress');
      return {
        success: false,
        syncedItems: {
          restaurantSettings: false,
          staff: false,
          floorPlan: false,
          menu: false,
          dineInPricing: false,
          printerConfig: false,
          aggregatorSettings: false,
        },
        errors: ['Sync already in progress'],
        duration: 0,
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const errors: string[] = [];
    const syncedItems = {
      restaurantSettings: false,
      staff: false,
      floorPlan: false,
      menu: false,
      dineInPricing: false,
      printerConfig: false,
      aggregatorSettings: false,
    };

    let completedWeight = 0;

    try {
      console.log(`[InitialSync] Starting initial sync for tenant: ${tenantId}`);
      this.notifyStatus({ step: 'Starting', progress: 0, message: 'Initializing sync...' });

      // 1. Restaurant Settings
      try {
        this.notifyStatus({
          step: 'Restaurant Settings',
          progress: Math.round((completedWeight / 100) * 100),
          message: 'Syncing restaurant settings...',
        });
        await useRestaurantSettingsStore.getState().syncFromCloud(tenantId);
        syncedItems.restaurantSettings = true;
        completedWeight += 15;
        console.log('[InitialSync] Restaurant settings synced');
      } catch (error: any) {
        console.error('[InitialSync] Failed to sync restaurant settings:', error);
        errors.push(`Restaurant settings: ${error.message}`);
      }

      // 2. Staff Members
      try {
        this.notifyStatus({
          step: 'Staff Members',
          progress: Math.round((completedWeight / 100) * 100),
          message: 'Syncing staff members...',
        });
        await useStaffStore.getState().syncFromCloud(tenantId);
        syncedItems.staff = true;
        completedWeight += 15;
        console.log('[InitialSync] Staff members synced');
      } catch (error: any) {
        console.error('[InitialSync] Failed to sync staff:', error);
        errors.push(`Staff: ${error.message}`);
      }

      // 3. Floor Plan
      try {
        this.notifyStatus({
          step: 'Floor Plan',
          progress: Math.round((completedWeight / 100) * 100),
          message: 'Syncing floor plan...',
        });
        await useFloorPlanStore.getState().syncFromCloud(tenantId);
        syncedItems.floorPlan = true;
        completedWeight += 15;
        console.log('[InitialSync] Floor plan synced');
      } catch (error: any) {
        console.error('[InitialSync] Failed to sync floor plan:', error);
        errors.push(`Floor plan: ${error.message}`);
      }

      // 4. Menu Items
      try {
        this.notifyStatus({
          step: 'Menu Items',
          progress: Math.round((completedWeight / 100) * 100),
          message: 'Syncing menu items...',
        });
        // Menu store loads from cloud API
        await useMenuStore.getState().loadMenuFromAPI(tenantId);
        syncedItems.menu = true;
        completedWeight += 25;
        console.log('[InitialSync] Menu synced');
      } catch (error: any) {
        console.error('[InitialSync] Failed to sync menu:', error);
        errors.push(`Menu: ${error.message}`);
      }

      // 5. Dine-In Pricing Overrides
      try {
        this.notifyStatus({
          step: 'Dine-In Pricing',
          progress: Math.round((completedWeight / 100) * 100),
          message: 'Syncing dine-in pricing...',
        });
        await useMenuStore.getState().loadDineInOverrides(tenantId);
        syncedItems.dineInPricing = true;
        completedWeight += 10;
        console.log('[InitialSync] Dine-in pricing synced');
      } catch (error: any) {
        console.error('[InitialSync] Failed to sync dine-in pricing:', error);
        errors.push(`Dine-in pricing: ${error.message}`);
      }

      // 6. Printer Configuration
      try {
        this.notifyStatus({
          step: 'Printer Configuration',
          progress: Math.round((completedWeight / 100) * 100),
          message: 'Syncing printer configuration...',
        });
        await this.syncPrinterConfigFromCloud(tenantId);
        syncedItems.printerConfig = true;
        completedWeight += 10;
        console.log('[InitialSync] Printer config synced');
      } catch (error: any) {
        console.error('[InitialSync] Failed to sync printer config:', error);
        errors.push(`Printer config: ${error.message}`);
      }

      // 7. Aggregator Settings
      try {
        this.notifyStatus({
          step: 'Aggregator Settings',
          progress: Math.round((completedWeight / 100) * 100),
          message: 'Syncing aggregator settings...',
        });
        await this.syncAggregatorSettingsFromCloud(tenantId);
        syncedItems.aggregatorSettings = true;
        completedWeight += 10;
        console.log('[InitialSync] Aggregator settings synced');
      } catch (error: any) {
        console.error('[InitialSync] Failed to sync aggregator settings:', error);
        errors.push(`Aggregator settings: ${error.message}`);
      }

      // Mark sync complete
      const lastSyncKey = `pos_last_sync_${tenantId}`;
      localStorage.setItem(lastSyncKey, new Date().toISOString());

      const duration = Date.now() - startTime;
      const success = errors.length === 0;

      this.notifyStatus({
        step: 'Complete',
        progress: 100,
        message: success ? 'Sync complete!' : `Sync completed with ${errors.length} errors`,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      });

      console.log(`[InitialSync] Completed in ${duration}ms, success: ${success}, errors: ${errors.length}`);

      return {
        success,
        syncedItems,
        errors,
        duration,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync printer configuration from cloud
   */
  private async syncPrinterConfigFromCloud(tenantId: string): Promise<void> {
    try {
      const cloudConfig = await backendApi.getPrinterConfig(tenantId);
      if (cloudConfig) {
        const printerStore = usePrinterStore.getState();
        printerStore.updateConfig({
          restaurantName: cloudConfig.restaurantName,
          autoPrintOnAccept: cloudConfig.autoPrintOnAccept ?? true,
          printByStation: cloudConfig.printByStation ?? false,
          printerType: cloudConfig.printerType ?? 'browser',
          networkPrinterUrl: cloudConfig.networkPrinterUrl,
          systemPrinterName: cloudConfig.systemPrinterName,
          kotPrinterEnabled: cloudConfig.kotPrinterEnabled ?? false,
        });
        console.log('[InitialSync] Printer config loaded from cloud');
      }
    } catch (error: any) {
      // Don't throw - printer config is optional
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log('[InitialSync] No printer config in cloud, using defaults');
        return;
      }
      throw error;
    }
  }

  /**
   * Sync aggregator settings from cloud
   */
  private async syncAggregatorSettingsFromCloud(tenantId: string): Promise<void> {
    try {
      const cloudSettings = await backendApi.getAggregatorSettings(tenantId);
      if (cloudSettings) {
        const aggregatorStore = useAggregatorSettingsStore.getState();
        aggregatorStore.updateSettings({
          autoAcceptEnabled: cloudSettings.autoAcceptEnabled ?? false,
          showAcceptNotification: cloudSettings.showAcceptNotification ?? true,
          soundEnabled: cloudSettings.soundEnabled ?? true,
          defaultPrepTime: cloudSettings.defaultPrepTime ?? 15,
          categoryMapping: cloudSettings.categoryMapping ?? {},
        });

        // Sync rules if present
        if (cloudSettings.rules && Array.isArray(cloudSettings.rules)) {
          // Clear existing rules and add cloud ones
          const currentRules = aggregatorStore.getActiveRules();
          currentRules.forEach((rule) => aggregatorStore.deleteRule(rule.id));
          cloudSettings.rules.forEach((rule: any) => aggregatorStore.addRule(rule));
        }

        console.log('[InitialSync] Aggregator settings loaded from cloud');
      }
    } catch (error: any) {
      // Don't throw - aggregator settings are optional
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log('[InitialSync] No aggregator settings in cloud, using defaults');
        return;
      }
      throw error;
    }
  }

  /**
   * Push all local settings to cloud (for backup/migration)
   */
  async pushAllToCloud(tenantId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const syncedItems = {
      restaurantSettings: false,
      staff: false,
      floorPlan: false,
      menu: false,
      dineInPricing: false,
      printerConfig: false,
      aggregatorSettings: false,
    };

    try {
      console.log(`[InitialSync] Pushing all local data to cloud for tenant: ${tenantId}`);

      // 1. Restaurant Settings
      try {
        await useRestaurantSettingsStore.getState().syncToCloud(tenantId);
        syncedItems.restaurantSettings = true;
      } catch (error: any) {
        errors.push(`Restaurant settings: ${error.message}`);
      }

      // 2. Staff
      try {
        await useStaffStore.getState().syncToCloud(tenantId);
        syncedItems.staff = true;
      } catch (error: any) {
        errors.push(`Staff: ${error.message}`);
      }

      // 3. Floor Plan
      try {
        await useFloorPlanStore.getState().syncToCloud(tenantId);
        syncedItems.floorPlan = true;
      } catch (error: any) {
        errors.push(`Floor plan: ${error.message}`);
      }

      // 4. Printer Config
      try {
        const printerStore = usePrinterStore.getState();
        await backendApi.savePrinterConfig(tenantId, printerStore.config);
        syncedItems.printerConfig = true;
      } catch (error: any) {
        errors.push(`Printer config: ${error.message}`);
      }

      // 5. Aggregator Settings
      try {
        const aggregatorStore = useAggregatorSettingsStore.getState();
        await backendApi.saveAggregatorSettings(tenantId, {
          autoAcceptEnabled: aggregatorStore.autoAcceptEnabled,
          showAcceptNotification: aggregatorStore.showAcceptNotification,
          soundEnabled: aggregatorStore.soundEnabled,
          defaultPrepTime: aggregatorStore.defaultPrepTime,
          categoryMapping: aggregatorStore.categoryMapping,
          rules: aggregatorStore.rules,
        });
        syncedItems.aggregatorSettings = true;
      } catch (error: any) {
        errors.push(`Aggregator settings: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      console.log(`[InitialSync] Push to cloud completed in ${duration}ms, errors: ${errors.length}`);

      return {
        success: errors.length === 0,
        syncedItems,
        errors,
        duration,
      };
    } catch (error: any) {
      console.error('[InitialSync] Push to cloud failed:', error);
      return {
        success: false,
        syncedItems,
        errors: [error.message],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get sync status for display
   */
  getSyncStatus(tenantId: string): { lastSync: string | null; needsSync: boolean } {
    const lastSyncKey = `pos_last_sync_${tenantId}`;
    const lastSync = localStorage.getItem(lastSyncKey);
    return {
      lastSync,
      needsSync: !lastSync,
    };
  }
}

// Singleton instance
export const initialSyncService = new InitialSyncService();
