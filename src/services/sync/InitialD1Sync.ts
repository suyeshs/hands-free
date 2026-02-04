/**
 * Initial D1 Sync Service
 * Handles one-time bulk sync when user enables cloud sync for the first time
 * Provides progress tracking for UI feedback
 */

import { D1SyncService } from './D1SyncService';

export interface InitialSyncProgress {
  step: string;
  message: string;
  progress: number; // 0-100
  completed: number;
  total: number;
  currentDataType?: string;
}

export interface InitialSyncResult {
  success: boolean;
  totalSynced: number;
  totalFailed: number;
  errors: string[];
  startTime: string;
  endTime: string;
  duration: number; // milliseconds
}

// Weighted progress for different data types (total = 100)
const SYNC_WEIGHTS = {
  sales: 25,          // Most important
  tips: 10,
  menu: 15,
  staff: 10,
  settings: 5,
  floorPlan: 10,
  inventory: 25,      // Bar inventory (if enabled)
};

export class InitialD1Sync {
  private d1SyncService: D1SyncService;
  private tenantId: string;
  private onProgress?: (progress: InitialSyncProgress) => void;

  constructor(
    tenantId: string,
    dbPath: string,
    onProgress?: (progress: InitialSyncProgress) => void
  ) {
    this.tenantId = tenantId;
    this.d1SyncService = new D1SyncService(tenantId, undefined, dbPath);
    this.onProgress = onProgress;
  }

  /**
   * Perform complete initial sync of all data
   */
  async performInitialSync(): Promise<InitialSyncResult> {
    const startTime = new Date().toISOString();
    const startMs = Date.now();

    let totalSynced = 0;
    let totalFailed = 0;
    const errors: string[] = [];
    let currentProgress = 0;

    console.log('[InitialD1Sync] Starting bulk sync for tenant:', this.tenantId);

    try {
      // Step 1: Sync sales transactions (25% weight)
      currentProgress = await this.syncStep(
        'sales',
        'Syncing sales transactions',
        SYNC_WEIGHTS.sales,
        currentProgress,
        async () => await this.d1SyncService.syncSalesToD1()
      );

      // Step 2: Sync tips (10% weight)
      currentProgress = await this.syncStep(
        'tips',
        'Syncing tip records',
        SYNC_WEIGHTS.tips,
        currentProgress,
        async () => await this.d1SyncService.syncTipsToD1()
      );

      // Step 3: Sync menu (15% weight)
      currentProgress = await this.syncStep(
        'menu',
        'Syncing menu items and categories',
        SYNC_WEIGHTS.menu,
        currentProgress,
        async () => await this.d1SyncService.syncMenuToD1()
      );

      // Step 4: Sync staff (10% weight)
      currentProgress = await this.syncStep(
        'staff',
        'Syncing staff members',
        SYNC_WEIGHTS.staff,
        currentProgress,
        async () => await this.d1SyncService.syncStaffToD1()
      );

      // Step 5: Sync settings (5% weight)
      currentProgress = await this.syncStep(
        'settings',
        'Syncing restaurant settings',
        SYNC_WEIGHTS.settings,
        currentProgress,
        async () => await this.d1SyncService.syncSettingsToD1()
      );

      // Step 6: Sync floor plan (10% weight)
      currentProgress = await this.syncStep(
        'floorPlan',
        'Syncing floor plan',
        SYNC_WEIGHTS.floorPlan,
        currentProgress,
        async () => await this.d1SyncService.syncFloorPlanToD1()
      );

      // Step 7: Sync bar inventory (25% weight) - optional, only if bar enabled
      currentProgress = await this.syncStep(
        'inventory',
        'Syncing bar inventory',
        SYNC_WEIGHTS.inventory,
        currentProgress,
        async () => await this.d1SyncService.syncBarInventoryToD1()
      );

      // Complete
      this.reportProgress({
        step: 'complete',
        message: 'Initial sync complete',
        progress: 100,
        completed: 7,
        total: 7,
      });

      const endTime = new Date().toISOString();
      const duration = Date.now() - startMs;

      // Mark initial sync as complete in localStorage
      this.markInitialSyncComplete();

      console.log('[InitialD1Sync] Bulk sync complete:', {
        totalSynced,
        totalFailed,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        totalSynced,
        totalFailed,
        errors,
        startTime,
        endTime,
        duration,
      };
    } catch (error) {
      const endTime = new Date().toISOString();
      const duration = Date.now() - startMs;

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[InitialD1Sync] Bulk sync failed:', errorMessage);

      this.reportProgress({
        step: 'error',
        message: `Sync failed: ${errorMessage}`,
        progress: currentProgress,
        completed: 0,
        total: 7,
      });

      return {
        success: false,
        totalSynced,
        totalFailed,
        errors: [...errors, errorMessage],
        startTime,
        endTime,
        duration,
      };
    }
  }

  /**
   * Sync a specific step with progress tracking
   */
  private async syncStep(
    dataType: string,
    message: string,
    weight: number,
    currentProgress: number,
    syncFunction: () => Promise<{ synced: number; failed: number; errors: string[] }>
  ): Promise<number> {
    this.reportProgress({
      step: 'syncing',
      message,
      progress: currentProgress,
      completed: 0,
      total: 7,
      currentDataType: dataType,
    });

    try {
      const result = await syncFunction();

      const newProgress = Math.min(currentProgress + weight, 100);

      console.log(`[InitialD1Sync] ${dataType} sync result:`, {
        synced: result.synced,
        failed: result.failed,
        errors: result.errors.length,
      });

      this.reportProgress({
        step: 'syncing',
        message: `${message} - ${result.synced} records synced`,
        progress: newProgress,
        completed: 0,
        total: 7,
        currentDataType: dataType,
      });

      return newProgress;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[InitialD1Sync] ${dataType} sync failed:`, errorMessage);

      // Continue with next step even if this one fails
      const newProgress = Math.min(currentProgress + weight, 100);

      this.reportProgress({
        step: 'syncing',
        message: `${message} - ${errorMessage}`,
        progress: newProgress,
        completed: 0,
        total: 7,
        currentDataType: dataType,
      });

      return newProgress;
    }
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: InitialSyncProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  /**
   * Mark initial sync as complete in localStorage
   */
  private markInitialSyncComplete(): void {
    localStorage.setItem(`d1:${this.tenantId}:initial_sync_complete`, 'true');
    localStorage.setItem(`d1:${this.tenantId}:initial_sync_at`, new Date().toISOString());
  }

  /**
   * Check if initial sync has been completed
   */
  static isInitialSyncComplete(tenantId: string): boolean {
    return localStorage.getItem(`d1:${tenantId}:initial_sync_complete`) === 'true';
  }

  /**
   * Get initial sync timestamp
   */
  static getInitialSyncTimestamp(tenantId: string): Date | null {
    const timestamp = localStorage.getItem(`d1:${tenantId}:initial_sync_at`);
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Reset initial sync status (for re-sync)
   */
  static resetInitialSync(tenantId: string): void {
    localStorage.removeItem(`d1:${tenantId}:initial_sync_complete`);
    localStorage.removeItem(`d1:${tenantId}:initial_sync_at`);
    console.log('[InitialD1Sync] Initial sync status reset');
  }
}

/**
 * Factory function for creating InitialD1Sync instance
 */
export function createInitialD1Sync(
  tenantId: string,
  dbPath: string,
  onProgress?: (progress: InitialSyncProgress) => void
): InitialD1Sync {
  return new InitialD1Sync(tenantId, dbPath, onProgress);
}
