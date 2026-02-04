import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

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
  private db: Database | null = null;

  constructor(workerUrl: string = import.meta.env.VITE_ORDERS_ENDPOINT || 'https://handsfree-tenant-router.suyesh.workers.dev') {
    this.workerUrl = workerUrl;
    this.initDatabase();
    console.log('[D1ProvisioningService] Using worker URL:', this.workerUrl);
  }

  /**
   * Initialize SQLite database and create sync metadata table
   */
  private async initDatabase(): Promise<void> {
    try {
      this.db = await Database.load(DB_NAME);

      // Create sync_metadata table if it doesn't exist
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('[D1ProvisioningService] Database initialized');
    } catch (error) {
      console.error('[D1ProvisioningService] Failed to initialize database:', error);
    }
  }

  /**
   * Get database instance
   */
  private async getDb(): Promise<Database> {
    if (!this.db) {
      await this.initDatabase();
    }
    return this.db!;
  }

  /**
   * Store value in SQLite
   */
  private async setValue(key: string, value: string): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ($1, $2, $3)',
      [key, value, new Date().toISOString()]
    );
  }

  /**
   * Get value from SQLite
   */
  private async getValue(key: string): Promise<string | null> {
    const db = await this.getDb();
    const result = await db.select<Array<{ value: string }>>(
      'SELECT value FROM sync_metadata WHERE key = $1',
      [key]
    );
    return result.length > 0 ? result[0].value : null;
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
      // Step 1: Check if already provisioned
      onProgress?.({
        step: 'extracting',
        message: 'Checking D1 database status...',
        progress: 5,
      });

      const status = await this.checkStatus(tenantId);
      const databaseName = `${tenantId.replace(/[^a-z0-9_-]/gi, '_')}_db`;

      // If already provisioned with tables, skip schema provisioning
      if (status.provisioned && status.tableCount && status.tableCount > 0) {
        console.log(`[D1ProvisioningService] Database already provisioned with ${status.tableCount} tables`);

        onProgress?.({
          step: 'provisioning',
          message: 'Database already provisioned. Syncing data...',
          progress: 50,
        });

        // Just sync the data
        await this.syncInitialData(tenantId, onProgress);

        return {
          success: true,
          output: `Database already provisioned with ${status.tableCount} tables`,
          tables_created: status.tableCount,
          databaseId: status.databaseId,
        };
      }

      // Step 2: Extract schema
      onProgress?.({
        step: 'extracting',
        message: 'Extracting database schema...',
        progress: 10,
      });

      const schema = await this.extractSchema(dbPath);

      console.log('[D1ProvisioningService] Schema extraction result:');
      console.log(`[D1ProvisioningService]   - Total statements: ${schema.length}`);
      if (schema.length > 0) {
        console.log(`[D1ProvisioningService]   - First statement: ${schema[0].substring(0, 100)}...`);
        console.log(`[D1ProvisioningService]   - Last statement: ${schema[schema.length - 1].substring(0, 100)}...`);
      } else {
        console.error('[D1ProvisioningService] ❌ Schema is EMPTY! No statements extracted.');
      }

      onProgress?.({
        step: 'extracting',
        message: `Extracted ${schema.length} tables and indexes`,
        progress: 30,
      });

      if (schema.length === 0) {
        throw new Error('No schema statements extracted from local database. Check database path.');
      }

      // Step 3: Provision D1 (only if not already provisioned)
      onProgress?.({
        step: 'provisioning',
        message: 'Creating cloud database tables...',
        progress: 40,
      });

      console.log('[D1ProvisioningService] Calling worker API:');
      console.log(`[D1ProvisioningService]   - Worker URL: ${this.workerUrl}/api/provision`);
      console.log(`[D1ProvisioningService]   - Database name: ${databaseName}`);
      console.log(`[D1ProvisioningService]   - Schema statements to send: ${schema.length}`);

      const result = await invoke<D1ProvisionResult>('provision_d1_via_worker', {
        tenantId,
        workerUrl: `${this.workerUrl}/api/provision`,
        databaseName,
        schema,
      });

      if (result.success) {
        onProgress?.({
          step: 'provisioning',
          message: `Successfully created ${result.tables_created || schema.length} tables`,
          progress: 60,
        });

        // Store D1 status in SQLite
        await this.setValue(`d1:${tenantId}:provisioned`, 'true');
        await this.setValue(`d1:${tenantId}:database_id`, result.databaseId || '');
        await this.setValue(`d1:${tenantId}:provisioned_at`, new Date().toISOString());

        console.log('[D1ProvisioningService] Stored provisioning status in SQLite');

        // Step 4: Sync initial data
        await this.syncInitialData(tenantId, onProgress, result.tables_created || schema.length);
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
   * Sync initial data to D1 (extracted into separate method for reuse)
   */
  private async syncInitialData(
    tenantId: string,
    onProgress?: (progress: ProvisionProgress) => void,
    tablesCreated?: number
  ): Promise<void> {
    onProgress?.({
      step: 'provisioning',
      message: 'Syncing initial data to cloud...',
      progress: 70,
    });

    try {
      // Import D1SyncService dynamically to avoid circular dependency
      const { createD1SyncService } = await import('./sync/D1SyncService');
      const { getDatabaseFilePath } = await import('../lib/database');
      const dbPath = await getDatabaseFilePath();
      const syncService = createD1SyncService(tenantId, undefined, dbPath);

      console.log('[D1ProvisioningService] Starting initial data sync...');

      // Sync all data types in parallel
      const [menuResult, inventoryResult, staffResult, settingsResult, floorPlanResult] = await Promise.all([
        syncService.syncMenuToD1(),
        syncService.syncBarInventoryToD1(),
        syncService.syncStaffToD1(),
        syncService.syncSettingsToD1(),
        syncService.syncFloorPlanToD1(),
      ]);

      const totalSynced = menuResult.synced + inventoryResult.synced + staffResult.synced +
                         settingsResult.synced + floorPlanResult.synced;

      console.log('[D1ProvisioningService] Initial sync complete:', {
        menu: menuResult.synced,
        inventory: inventoryResult.synced,
        staff: staffResult.synced,
        settings: settingsResult.synced,
        floorPlan: floorPlanResult.synced,
        total: totalSynced,
      });

      const message = tablesCreated
        ? `Provisioned ${tablesCreated} tables and synced ${totalSynced} records`
        : `Synced ${totalSynced} records to cloud`;

      onProgress?.({
        step: 'complete',
        message,
        progress: 100,
      });

      // Enable cloud sync
      await this.enableCloudSync();
    } catch (syncError) {
      console.error('[D1ProvisioningService] Initial data sync failed:', syncError);
      // Don't fail if sync fails - tables are created
      const message = tablesCreated
        ? `Tables created successfully. Initial sync failed: ${syncError}`
        : `Data sync failed: ${syncError}`;

      onProgress?.({
        step: 'complete',
        message,
        progress: 100,
      });
    }
  }

  /**
   * Check if D1 is provisioned for this tenant
   */
  async checkStatus(tenantId: string): Promise<D1Status> {
    try {
      // Check sync_metadata table first
      const isProvisioned = (await this.getValue(`d1:${tenantId}:provisioned`)) === 'true';
      let databaseId = (await this.getValue(`d1:${tenantId}:database_id`)) || undefined;

      // Also check tenant_config table for database ID (set during activation)
      if (!databaseId) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const tenantConfig = await invoke<any>('get_tenant_config');
          if (tenantConfig?.d1DatabaseId) {
            databaseId = tenantConfig.d1DatabaseId;
            console.log('[D1ProvisioningService] Found database ID in tenant_config:', databaseId);
          }
        } catch (err) {
          console.warn('[D1ProvisioningService] Failed to check tenant_config:', err);
        }
      }

      if (!isProvisioned && !databaseId) {
        return {
          provisioned: false,
        };
      }

      // Query worker API for detailed status
      const response = await fetch(`${this.workerUrl}/api/provision/${tenantId}/status`);

      if (!response.ok) {
        console.warn('[D1ProvisioningService] Failed to fetch D1 status from worker');
        return {
          provisioned: isProvisioned || !!databaseId,
          databaseId,
        };
      }

      const status = await response.json();
      return {
        provisioned: status.provisioned || isProvisioned || !!databaseId,
        databaseId: status.databaseId || databaseId,
        databaseName: status.databaseName,
        tableCount: status.tableCount,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[D1ProvisioningService] Status check failed:', error);

      // Fallback to SQLite - check both sync_metadata and tenant_config
      const isProvisioned = (await this.getValue(`d1:${tenantId}:provisioned`)) === 'true';
      let databaseId = await this.getValue(`d1:${tenantId}:database_id`);

      if (!databaseId) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const tenantConfig = await invoke<any>('get_tenant_config');
          if (tenantConfig?.d1DatabaseId) {
            databaseId = tenantConfig.d1DatabaseId;
          }
        } catch (err) {
          // Ignore error in fallback
        }
      }

      return {
        provisioned: isProvisioned || !!databaseId,
        databaseId: databaseId || undefined,
      };
    }
  }

  /**
   * Enable cloud sync (mark as enabled in SQLite)
   */
  async enableCloudSync(): Promise<void> {
    await this.setValue('sync:d1:enabled', 'true');
    console.log('[D1ProvisioningService] Cloud sync enabled');
  }

  /**
   * Disable cloud sync
   */
  async disableCloudSync(): Promise<void> {
    await this.setValue('sync:d1:enabled', 'false');
    console.log('[D1ProvisioningService] Cloud sync disabled');
  }

  /**
   * Check if cloud sync is enabled
   */
  async isCloudSyncEnabled(): Promise<boolean> {
    const value = await this.getValue('sync:d1:enabled');
    return value === 'true';
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<Date | null> {
    const timestamp = await this.getValue('sync:d1:last_full_sync');
    return timestamp ? new Date(timestamp) : null;
  }
}

// Lazy singleton initialization to prevent instantiation before Tauri setup migration runs
let d1ProvisioningServiceInstance: D1ProvisioningService | null = null;

/**
 * Get the singleton instance of D1ProvisioningService
 * Uses lazy initialization to ensure Tauri migrations run first
 */
export function getD1ProvisioningService(): D1ProvisioningService {
  if (!d1ProvisioningServiceInstance) {
    d1ProvisioningServiceInstance = new D1ProvisioningService();
  }
  return d1ProvisioningServiceInstance;
}
