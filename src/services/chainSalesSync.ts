/**
 * Chain Sales Sync Service
 *
 * Syncs sales from location tenant to master tenant's chain aggregation table.
 * Runs automatically in the background for location devices that belong to a chain.
 */

import { invoke } from '@tauri-apps/api/core';

interface SyncSummary {
  synced: number;
  totalRecords: number;
  errors?: string[];
}

interface ChainSyncStatus {
  isEnabled: boolean;
  locationGroupId: string | null;
  masterTenantId: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'never';
  pendingTransactions: number;
}

class ChainSalesSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private syncIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Start the chain sales sync service
   * Only runs if this device is part of a location group
   */
  async start(): Promise<void> {
    try {
      // Check if this device belongs to a location group
      const status = await this.getStatus();

      if (!status.isEnabled) {
        console.log('[ChainSalesSync] Not a location group member, skipping');
        return;
      }

      console.log(`[ChainSalesSync] Starting sync service for location group: ${status.locationGroupId}`);
      console.log(`[ChainSalesSync] Master tenant: ${status.masterTenantId}`);

      // Initial sync
      await this.syncNow();

      // Start periodic sync
      this.syncInterval = setInterval(async () => {
        await this.syncNow();
      }, this.syncIntervalMs);

      console.log(`[ChainSalesSync] Sync service started (interval: ${this.syncIntervalMs / 1000}s)`);
    } catch (error) {
      console.error('[ChainSalesSync] Failed to start sync service:', error);
    }
  }

  /**
   * Stop the sync service
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[ChainSalesSync] Sync service stopped');
    }
  }

  /**
   * Manually trigger a sync now
   */
  async syncNow(): Promise<SyncSummary | null> {
    if (this.isRunning) {
      console.log('[ChainSalesSync] Sync already in progress, skipping');
      return null;
    }

    this.isRunning = true;

    try {
      console.log('[ChainSalesSync] Starting chain sales sync...');

      const summary = await invoke<SyncSummary>('sync_chain_sales');

      if (summary.synced > 0) {
        console.log(`[ChainSalesSync] ✅ Synced ${summary.synced}/${summary.totalRecords} sales to master`);
      } else {
        console.log('[ChainSalesSync] No new sales to sync');
      }

      if (summary.errors && summary.errors.length > 0) {
        console.error('[ChainSalesSync] Errors during sync:', summary.errors);
      }

      return summary;
    } catch (error) {
      console.error('[ChainSalesSync] ❌ Sync failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<ChainSyncStatus> {
    try {
      return await invoke<ChainSyncStatus>('get_chain_sync_status');
    } catch (error) {
      console.error('[ChainSalesSync] Failed to get status:', error);
      return {
        isEnabled: false,
        locationGroupId: null,
        masterTenantId: null,
        lastSyncAt: null,
        lastSyncStatus: 'never',
        pendingTransactions: 0,
      };
    }
  }

  /**
   * Enable/disable chain sync
   */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await invoke('set_chain_sync_enabled', { enabled });

      if (enabled) {
        await this.start();
      } else {
        this.stop();
      }
    } catch (error) {
      console.error('[ChainSalesSync] Failed to set enabled state:', error);
      throw error;
    }
  }

  /**
   * Set sync interval in minutes
   */
  setSyncInterval(minutes: number): void {
    this.syncIntervalMs = minutes * 60 * 1000;

    if (this.syncInterval) {
      // Restart with new interval
      this.stop();
      this.start();
    }
  }

  /**
   * Get human-readable status message
   */
  async getStatusMessage(): Promise<string> {
    const status = await this.getStatus();

    if (!status.isEnabled) {
      return 'Chain sync is not enabled for this device';
    }

    if (status.lastSyncStatus === 'never') {
      return `Waiting for first sync (${status.pendingTransactions} pending)`;
    }

    if (status.lastSyncStatus === 'failed') {
      return `Last sync failed at ${new Date(status.lastSyncAt || '').toLocaleString()}`;
    }

    return `Last synced at ${new Date(status.lastSyncAt || '').toLocaleString()} (${status.pendingTransactions} pending)`;
  }
}

// Singleton instance
export const chainSalesSyncService = new ChainSalesSyncService();

// Auto-start when imported (will only run if device is in a location group)
if (typeof window !== 'undefined') {
  chainSalesSyncService.start().catch(error => {
    console.error('[ChainSalesSync] Auto-start failed:', error);
  });
}
