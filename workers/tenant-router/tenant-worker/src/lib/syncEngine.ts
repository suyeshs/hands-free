/**
 * Unified Sync Engine for Hybrid SaaS
 *
 * Centralizes all POS ↔ Cloud synchronization logic with:
 * - Schema-driven sync configuration
 * - Automatic conflict resolution
 * - Batch optimization
 * - Error handling & retries
 * - Observability & metrics
 */

import type { D1Database } from '@cloudflare/workers-types';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type SyncDirection = 'pos-to-cloud' | 'cloud-to-pos' | 'bidirectional';
export type ConflictStrategy = 'last-write-wins' | 'cloud-wins' | 'pos-wins' | 'manual';

export interface ColumnMapping {
  source: string;       // Source field name (camelCase from POS)
  target: string;       // Target column name (snake_case in D1)
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
  required?: boolean;
  transform?: (value: any) => any;
  validate?: (value: any) => boolean;
}

export interface SyncTableConfig {
  tableName: string;
  direction: SyncDirection;
  conflictStrategy: ConflictStrategy;
  conflictKeys: string[];           // Unique constraint columns (e.g., ['tenant_id', 'invoice_number'])
  timestampColumn?: string;         // Column for last-write-wins (e.g., 'updated_at')
  columns: ColumnMapping[];
  batchSize?: number;               // Records per batch (default: 100)
  priority?: number;                // Sync priority (1 = highest)
  hooks?: {
    beforeSync?: (records: any[]) => Promise<any[]>;
    afterSync?: (results: SyncResult) => Promise<void>;
    onError?: (error: Error, record: any) => Promise<void>;
  };
}

export interface SyncResult {
  success: boolean;
  tableName: string;
  totalRecords: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: SyncError[];
  duration: number;
  batchResults: BatchResult[];
}

export interface SyncError {
  recordId?: string;
  error: string;
  record?: any;
  retryable: boolean;
}

export interface BatchResult {
  batchNumber: number;
  synced: number;
  failed: number;
  duration: number;
}

export interface SyncMetrics {
  timestamp: string;
  tableName: string;
  direction: SyncDirection;
  recordsProcessed: number;
  recordsSynced: number;
  recordsFailed: number;
  averageBatchTime: number;
  totalDuration: number;
  errorRate: number;
}

// =====================================================
// SYNC ENGINE
// =====================================================

export class SyncEngine {
  private db: D1Database;
  private tenantId: string;
  private metrics: SyncMetrics[] = [];

  constructor(db: D1Database, tenantId: string) {
    this.db = db;
    this.tenantId = tenantId;
  }

  /**
   * Sync records to cloud using table configuration
   */
  async sync<T = any>(
    config: SyncTableConfig,
    records: T[]
  ): Promise<SyncResult> {
    const startTime = Date.now();

    const result: SyncResult = {
      success: true,
      tableName: config.tableName,
      totalRecords: records.length,
      synced: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      duration: 0,
      batchResults: [],
    };

    if (records.length === 0) {
      result.duration = Date.now() - startTime;
      return result;
    }

    try {
      // Ensure table exists
      await this.ensureTable(config);

      // Apply pre-sync hook
      let processedRecords = records;
      if (config.hooks?.beforeSync) {
        processedRecords = await config.hooks.beforeSync(records);
      }

      // Batch sync
      const batchSize = config.batchSize || 100;
      const batches = this.createBatches(processedRecords, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batchStartTime = Date.now();
        const batch = batches[i];

        const batchResult = await this.syncBatch(config, batch, i + 1);

        result.synced += batchResult.synced;
        result.failed += batchResult.failed;
        result.batchResults.push({
          batchNumber: i + 1,
          synced: batchResult.synced,
          failed: batchResult.failed,
          duration: Date.now() - batchStartTime,
        });

        if (batchResult.errors) {
          result.errors.push(...batchResult.errors);
        }
      }

      // Apply post-sync hook
      if (config.hooks?.afterSync) {
        await config.hooks.afterSync(result);
      }

      result.success = result.failed < result.totalRecords;
      result.duration = Date.now() - startTime;

      // Record metrics
      this.recordMetrics(config, result);

      return result;

    } catch (error: any) {
      console.error(`[SyncEngine] Critical error syncing ${config.tableName}:`, error);
      result.success = false;
      result.failed = result.totalRecords;
      result.errors.push({
        error: error.message,
        retryable: false,
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Sync a batch of records using D1 batch() API for parallel execution
   */
  private async syncBatch(
    config: SyncTableConfig,
    records: any[],
    batchNumber: number
  ): Promise<{ synced: number; failed: number; errors: SyncError[] }> {
    const statements: any[] = [];
    const recordMap: Map<number, any> = new Map(); // Track which record each statement belongs to
    const validationErrors: SyncError[] = [];

    // Build all statements first (validation happens here)
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        // Transform record according to column mappings
        const transformedRecord = this.transformRecord(record, config.columns);

        // Validate
        if (!this.validateRecord(transformedRecord, config.columns)) {
          validationErrors.push({
            recordId: record.id,
            error: 'Validation failed',
            record: transformedRecord,
            retryable: false,
          });
          continue; // Skip invalid records
        }

        // Build INSERT ... ON CONFLICT query
        const query = this.buildUpsertQuery(config, transformedRecord);

        // Prepare statement (don't execute yet)
        const stmt = this.db.prepare(query.sql).bind(...query.params);
        statements.push(stmt);
        recordMap.set(statements.length - 1, record);

      } catch (error: any) {
        validationErrors.push({
          recordId: record.id,
          error: error.message,
          record,
          retryable: this.isRetryableError(error),
        });

        // Call error hook for validation errors
        if (config.hooks?.onError) {
          await config.hooks.onError(error, record);
        }

        console.error(`[SyncEngine] Validation error for record in ${config.tableName}:`, error);
      }
    }

    // Execute all statements in parallel using D1 batch()
    let synced = 0;
    let failed = 0;
    const errors: SyncError[] = [...validationErrors];

    if (statements.length > 0) {
      try {
        const results = await this.db.batch(statements);

        // Process results
        results.forEach((result: any, index: number) => {
          const record = recordMap.get(index);

          if (result.success) {
            synced++;
          } else {
            failed++;
            const error: SyncError = {
              recordId: record?.id,
              error: result.error?.message || 'Unknown database error',
              record,
              retryable: this.isRetryableError(result.error),
            };
            errors.push(error);

            // Call error hook
            if (config.hooks?.onError && record) {
              config.hooks.onError(result.error || new Error(error.error), record).catch(err => {
                console.error(`[SyncEngine] Error hook failed:`, err);
              });
            }

            console.error(`[SyncEngine] Failed to sync record in ${config.tableName}:`, result.error);
          }
        });
      } catch (batchError: any) {
        // Batch operation failed entirely - mark all as failed
        failed = statements.length;
        statements.forEach((_, index) => {
          const record = recordMap.get(index);
          errors.push({
            recordId: record?.id,
            error: `Batch execution failed: ${batchError.message}`,
            record,
            retryable: this.isRetryableError(batchError),
          });
        });
        console.error(`[SyncEngine] Batch operation failed for ${config.tableName}:`, batchError);
      }
    }

    // Add validation failures to failed count
    failed += validationErrors.length;

    return { synced, failed, errors };
  }

  /**
   * Transform record from source format to target schema
   */
  private transformRecord(record: any, columns: ColumnMapping[]): Record<string, any> {
    const transformed: Record<string, any> = {};

    for (const col of columns) {
      let value = record[col.source];

      // Apply transformation
      if (col.transform) {
        value = col.transform(value);
      }

      // Type coercion
      if (value !== null && value !== undefined) {
        if (col.type === 'INTEGER' && typeof value !== 'number') {
          value = parseInt(value, 10);
        } else if (col.type === 'REAL' && typeof value !== 'number') {
          value = parseFloat(value);
        } else if (col.type === 'TEXT' && typeof value !== 'string') {
          value = String(value);
        }
      }

      // Convert undefined to null for D1 compatibility
      // D1 doesn't support undefined values in bound parameters
      if (value === undefined) {
        value = null;
      }

      transformed[col.target] = value;
    }

    // Note: tenant_id NOT added - tenant isolation via separate databases
    // Each tenant has their own D1 database, so no tenant_id column needed

    return transformed;
  }

  /**
   * Validate transformed record
   */
  private validateRecord(record: Record<string, any>, columns: ColumnMapping[]): boolean {
    for (const col of columns) {
      const value = record[col.target];

      // Check required fields
      if (col.required && (value === null || value === undefined)) {
        return false;
      }

      // Custom validation
      if (col.validate && !col.validate(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Build INSERT ... ON CONFLICT DO UPDATE query
   */
  private buildUpsertQuery(
    config: SyncTableConfig,
    record: Record<string, any>
  ): { sql: string; params: any[] } {
    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const params = Object.values(record);

    // Build conflict resolution
    let conflictClause = '';
    if (config.conflictKeys.length > 0) {
      const conflictColumns = config.conflictKeys.join(', ');

      if (config.conflictStrategy === 'last-write-wins' && config.timestampColumn) {
        // Only update if newer
        const updateSet = columns
          .filter(col => !config.conflictKeys.includes(col))
          .map(col => `${col} = excluded.${col}`)
          .join(', ');

        conflictClause = `
          ON CONFLICT(${conflictColumns})
          DO UPDATE SET ${updateSet}
          WHERE excluded.${config.timestampColumn} > ${config.tableName}.${config.timestampColumn}
        `;
      } else if (config.conflictStrategy === 'cloud-wins') {
        // Don't update if exists
        conflictClause = `ON CONFLICT(${conflictColumns}) DO NOTHING`;
      } else {
        // Default: always update (POS wins)
        const updateSet = columns
          .filter(col => !config.conflictKeys.includes(col))
          .map(col => `${col} = excluded.${col}`)
          .join(', ');

        conflictClause = `
          ON CONFLICT(${conflictColumns})
          DO UPDATE SET ${updateSet}
        `;
      }
    }

    const sql = `
      INSERT INTO ${config.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ${conflictClause}
    `.trim();

    return { sql, params };
  }

  /**
   * Ensure table exists with proper schema
   */
  private async ensureTable(config: SyncTableConfig): Promise<void> {
    // This is a simplified version - in production, use migrations
    // For now, we rely on handlers calling ensure{Table}Table()
    // The sync engine can be extended to auto-create tables from config
  }

  /**
   * Create batches from records
   */
  private createBatches<T>(records: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableMessages = [
      'timeout',
      'network',
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
    ];

    return retryableMessages.some(msg =>
      error.message?.toLowerCase().includes(msg.toLowerCase())
    );
  }

  /**
   * Record metrics for observability
   */
  private recordMetrics(config: SyncTableConfig, result: SyncResult): void {
    const metrics: SyncMetrics = {
      timestamp: new Date().toISOString(),
      tableName: config.tableName,
      direction: config.direction,
      recordsProcessed: result.totalRecords,
      recordsSynced: result.synced,
      recordsFailed: result.failed,
      averageBatchTime: result.batchResults.length > 0
        ? result.batchResults.reduce((sum, b) => sum + b.duration, 0) / result.batchResults.length
        : 0,
      totalDuration: result.duration,
      errorRate: result.totalRecords > 0 ? result.failed / result.totalRecords : 0,
    };

    this.metrics.push(metrics);

    console.log(`[SyncEngine] ${config.tableName}: ${result.synced}/${result.totalRecords} synced in ${result.duration}ms`);
  }

  /**
   * Get sync metrics
   */
  getMetrics(): SyncMetrics[] {
    return this.metrics;
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }
}

// =====================================================
// SYNC ENGINE FACTORY
// =====================================================

export function createSyncEngine(db: D1Database, tenantId: string): SyncEngine {
  return new SyncEngine(db, tenantId);
}
