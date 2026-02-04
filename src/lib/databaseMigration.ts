/**
 * Database Migration Utility
 * Handles schema updates for SQLite database
 * Run missing migrations manually when database schema errors occur
 */

import Database from '@tauri-apps/plugin-sql';
import { isTauri } from './platform';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

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
 * Returns: { applied: boolean, success: boolean }
 */
async function migrateSalesSync(db: Database): Promise<{ applied: boolean; success: boolean }> {
  try {
    const exists = await columnExists(db, 'sales_transactions', 'synced_at');

    if (exists) {
      console.log('[Migration] sales_transactions.synced_at column already exists, skipping');
      return { applied: false, success: true };
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
    return { applied: true, success: true };
  } catch (error) {
    console.error('[Migration] ❌ Failed to migrate sales_transactions:', error);
    return { applied: false, success: false };
  }
}

/**
 * Run all pending migrations
 */
export async function runPendingMigrations(): Promise<{
  success: boolean;
  migrations: string[];
  errors: string[];
  needsMigration: boolean;
}> {
  if (!isTauri()) {
    console.log('[Migration] Not in Tauri, skipping migrations');
    return { success: true, migrations: [], errors: [], needsMigration: false };
  }

  const appliedMigrations: string[] = [];
  const migrationErrors: string[] = [];
  let hadPendingMigrations = false;

  try {
    const db = await Database.load(DB_NAME);

    // Run sales_transactions sync migration
    const salesSyncResult = await migrateSalesSync(db);
    if (salesSyncResult.applied) {
      hadPendingMigrations = true;
      appliedMigrations.push('014_sales_sync - Added synced_at column');
    }
    if (!salesSyncResult.success) {
      migrationErrors.push('014_sales_sync - Failed to add synced_at column');
    }

    // Add more migrations here as needed
    // const nextMigration = await migrateXYZ(db);
    // if (nextMigration.applied) {
    //   hadPendingMigrations = true;
    //   appliedMigrations.push('...');
    // }

    console.log(
      `[Migration] Complete: ${appliedMigrations.length} migrations applied, ${migrationErrors.length} errors, needsMigration: ${hadPendingMigrations}`
    );

    return {
      success: migrationErrors.length === 0,
      migrations: appliedMigrations,
      errors: migrationErrors,
      needsMigration: hadPendingMigrations,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Migration] Fatal error running migrations:', error);
    return {
      success: false,
      migrations: appliedMigrations,
      errors: [errorMsg, ...migrationErrors],
      needsMigration: true, // If we had a fatal error, we probably need to retry
    };
  }
}

/**
 * Check if migrations are needed (without running them)
 */
export async function checkMigrationsNeeded(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  try {
    const db = await Database.load(DB_NAME);

    // Try to check if tables exist first (to handle fresh database)
    try {
      const tables = await db.select<{ name: string }[]>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='sales_transactions'`
      );

      // If sales_transactions table doesn't exist, this is a fresh database
      // Tauri migrations will handle it, so no need for manual migrations
      if (tables.length === 0) {
        console.log('[Migration] Fresh database detected, no migrations needed');
        return false;
      }

      // Check each migration individually
      const needsSalesSync = !(await columnExists(db, 'sales_transactions', 'synced_at'));

      // Add more migration checks here as needed
      // const needsOtherMigration = !(await someOtherCheck(db));

      const needsMigration = needsSalesSync; // || needsOtherMigration

      console.log('[Migration] Check complete - needsMigration:', needsMigration);
      return needsMigration;
    } catch (tableCheckError) {
      console.error('[Migration] Error checking tables:', tableCheckError);
      // If we can't check tables, assume it's a fresh database
      return false;
    }
  } catch (error) {
    console.error('[Migration] Error loading database:', error);
    // If we can't even load the database, it's probably fresh or corrupt
    // Either way, let Tauri handle it
    return false;
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
    const db = await Database.load(DB_NAME);

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
