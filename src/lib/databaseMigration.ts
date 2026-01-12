/**
 * Database Migration Utility
 * Handles schema updates for SQLite database
 * Run missing migrations manually when database schema errors occur
 */

import Database from '@tauri-apps/plugin-sql';
import { isTauri } from './platform';

/**
 * Check if a column exists in a table
 */
async function columnExists(
  db: Database,
  tableName: string,
  columnName: string
): Promise<boolean> {
  try {
    const result = await db.select<{ name: string }[]>(
      `PRAGMA table_info(${tableName})`
    );
    return result.some((col) => col.name === columnName);
  } catch (error) {
    console.error(`[Migration] Error checking column ${tableName}.${columnName}:`, error);
    return false;
  }
}

/**
 * Apply sales_transactions synced_at column migration
 * Migration 014 from src-tauri/migrations/014_sales_sync.sql
 */
async function migrateSalesSync(db: Database): Promise<boolean> {
  try {
    const exists = await columnExists(db, 'sales_transactions', 'synced_at');

    if (exists) {
      console.log('[Migration] sales_transactions.synced_at column already exists');
      return true;
    }

    console.log('[Migration] Adding synced_at column to sales_transactions...');

    // Add the column
    await db.execute('ALTER TABLE sales_transactions ADD COLUMN synced_at TEXT');

    // Create index for unsynced transactions
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_sales_transactions_unsynced
       ON sales_transactions(synced_at)
       WHERE synced_at IS NULL`
    );

    // Create index for tenant sync queries
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_sales_transactions_tenant_sync
       ON sales_transactions(tenant_id, synced_at)`
    );

    console.log('[Migration] ✅ Successfully added synced_at column');
    return true;
  } catch (error) {
    console.error('[Migration] ❌ Failed to migrate sales_transactions:', error);
    return false;
  }
}

/**
 * Run all pending migrations
 */
export async function runPendingMigrations(): Promise<{
  success: boolean;
  migrations: string[];
  errors: string[];
}> {
  if (!isTauri()) {
    console.log('[Migration] Not in Tauri, skipping migrations');
    return { success: true, migrations: [], errors: [] };
  }

  const appliedMigrations: string[] = [];
  const migrationErrors: string[] = [];

  try {
    const db = await Database.load('sqlite:pos.db');

    // Run sales_transactions sync migration
    const salesSyncResult = await migrateSalesSync(db);
    if (salesSyncResult) {
      appliedMigrations.push('014_sales_sync - Added synced_at column');
    } else {
      migrationErrors.push('014_sales_sync - Failed to add synced_at column');
    }

    // Add more migrations here as needed
    // const nextMigration = await migrateXYZ(db);

    console.log(
      `[Migration] Complete: ${appliedMigrations.length} migrations applied, ${migrationErrors.length} errors`
    );

    return {
      success: migrationErrors.length === 0,
      migrations: appliedMigrations,
      errors: migrationErrors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Migration] Fatal error running migrations:', error);
    return {
      success: false,
      migrations: appliedMigrations,
      errors: [errorMsg, ...migrationErrors],
    };
  }
}

/**
 * Check database health and schema
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  issues: string[];
  tables: string[];
}> {
  if (!isTauri()) {
    return { healthy: true, issues: ['Not in Tauri environment'], tables: [] };
  }

  const issues: string[] = [];
  const tables: string[] = [];

  try {
    const db = await Database.load('sqlite:pos.db');

    // Get all tables
    const tableResult = await db.select<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );
    tables.push(...tableResult.map((t) => t.name));

    // Check critical columns
    const criticalChecks = [
      { table: 'sales_transactions', column: 'synced_at' },
      { table: 'kds_orders', column: 'id' },
      { table: 'aggregator_orders', column: 'id' },
    ];

    for (const check of criticalChecks) {
      const exists = await columnExists(db, check.table, check.column);
      if (!exists) {
        issues.push(`Missing column: ${check.table}.${check.column}`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      tables,
    };
  } catch (error) {
    return {
      healthy: false,
      issues: [error instanceof Error ? error.message : String(error)],
      tables,
    };
  }
}
