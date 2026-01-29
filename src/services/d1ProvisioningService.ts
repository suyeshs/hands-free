import { invoke } from '@tauri-apps/api/core';

export interface D1ProvisionResult {
  success: boolean;
  output: string;
  tables_created?: number;
  error?: string;
  databaseId?: string;
}

export interface D1Status {
  provisioned: boolean;
  databaseId?: string;
  databaseName?: string;
  tableCount?: number;
  lastChecked?: string;
}

export interface ProvisionProgress {
  step: 'extracting' | 'provisioning' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
}

export class D1ProvisioningService {
  private workerUrl: string;

  constructor(workerUrl: string = import.meta.env.VITE_ORDERS_ENDPOINT || 'https://handsfree-orders.suyesh.workers.dev') {
    this.workerUrl = workerUrl;
  }

  /**
   * Extract SQLite schema from local database
   */
  async extractSchema(dbPath: string): Promise<string[]> {
    try {
      console.log('[D1ProvisioningService] Extracting schema from:', dbPath);
      const schema = await invoke<string[]>('extract_sqlite_schema', { dbPath });
      console.log(`[D1ProvisioningService] Extracted ${schema.length} statements`);
      return schema;
    } catch (error) {
      console.error('[D1ProvisioningService] Schema extraction failed:', error);
      throw new Error(`Failed to extract schema: ${error}`);
    }
  }

  /**
   * Provision D1 database with custom schema from local SQLite
   */
  async provisionD1(
    tenantId: string,
    dbPath: string,
    onProgress?: (progress: ProvisionProgress) => void
  ): Promise<D1ProvisionResult> {
    try {
      // Step 1: Extract schema
      onProgress?.({
        step: 'extracting',
        message: 'Extracting database schema...',
        progress: 10,
      });

      const schema = await this.extractSchema(dbPath);

      onProgress?.({
        step: 'extracting',
        message: `Extracted ${schema.length} tables and indexes`,
        progress: 30,
      });

      // Step 2: Provision D1
      onProgress?.({
        step: 'provisioning',
        message: 'Creating cloud database...',
        progress: 40,
      });

      const databaseName = `${tenantId.replace(/[^a-z0-9_-]/gi, '_')}_db`;

      const result = await invoke<D1ProvisionResult>('provision_d1_via_worker', {
        tenantId,
        workerUrl: `${this.workerUrl}/api/provision`,
        databaseName,
        schema,
      });

      if (result.success) {
        onProgress?.({
          step: 'complete',
          message: `Successfully created ${result.tables_created || schema.length} tables`,
          progress: 100,
        });

        // Store D1 status in localStorage
        localStorage.setItem(`d1:${tenantId}:provisioned`, 'true');
        localStorage.setItem(`d1:${tenantId}:database_id`, result.databaseId || '');
        localStorage.setItem(`d1:${tenantId}:provisioned_at`, new Date().toISOString());
      } else {
        onProgress?.({
          step: 'error',
          message: result.error || 'Provisioning failed',
          progress: 0,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress?.({
        step: 'error',
        message: errorMessage,
        progress: 0,
      });

      throw error;
    }
  }

  /**
   * Check if D1 is provisioned for this tenant
   */
  async checkStatus(tenantId: string): Promise<D1Status> {
    try {
      // Check local storage first
      const isProvisioned = localStorage.getItem(`d1:${tenantId}:provisioned`) === 'true';
      const databaseId = localStorage.getItem(`d1:${tenantId}:database_id`) || undefined;

      if (!isProvisioned) {
        return {
          provisioned: false,
        };
      }

      // Query worker API for detailed status
      const response = await fetch(`${this.workerUrl}/api/provision/${tenantId}/status`);

      if (!response.ok) {
        console.warn('[D1ProvisioningService] Failed to fetch D1 status from worker');
        return {
          provisioned: isProvisioned,
          databaseId,
        };
      }

      const status = await response.json();
      return {
        provisioned: status.provisioned || isProvisioned,
        databaseId: status.databaseId || databaseId,
        databaseName: status.databaseName,
        tableCount: status.tableCount,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[D1ProvisioningService] Status check failed:', error);

      // Fallback to local storage
      const isProvisioned = localStorage.getItem(`d1:${tenantId}:provisioned`) === 'true';
      return {
        provisioned: isProvisioned,
        databaseId: localStorage.getItem(`d1:${tenantId}:database_id`) || undefined,
      };
    }
  }

  /**
   * Enable cloud sync (mark as enabled in localStorage)
   */
  enableCloudSync(): void {
    localStorage.setItem('sync:d1:enabled', 'true');
    console.log('[D1ProvisioningService] Cloud sync enabled');
  }

  /**
   * Disable cloud sync
   */
  disableCloudSync(): void {
    localStorage.setItem('sync:d1:enabled', 'false');
    console.log('[D1ProvisioningService] Cloud sync disabled');
  }

  /**
   * Check if cloud sync is enabled
   */
  isCloudSyncEnabled(): boolean {
    return localStorage.getItem('sync:d1:enabled') === 'true';
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTime(): Date | null {
    const timestamp = localStorage.getItem('sync:d1:last_full_sync');
    return timestamp ? new Date(timestamp) : null;
  }
}

// Export singleton instance
export const d1ProvisioningService = new D1ProvisioningService();
