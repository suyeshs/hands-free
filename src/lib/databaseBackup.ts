/**
 * Database Backup Utilities
 * Functions to backup and archive the SQLite database
 */

import Database from '@tauri-apps/plugin-sql';
import { appDataDir } from '@tauri-apps/api/path';
import { exists, copyFile, writeTextFile } from '@tauri-apps/plugin-fs';

/**
 * Get the path to the current database file
 */
export async function getDatabasePath(): Promise<string> {
  const dataDir = await appDataDir();
  return `${dataDir}pos.db`;
}

/**
 * Create a backup of the database with timestamp and tenant ID
 */
export async function backupDatabase(tenantId: string): Promise<{
  success: boolean;
  backupPath?: string;
  error?: string;
}> {
  try {
    console.log('[DatabaseBackup] Starting backup for tenant:', tenantId);

    const dataDir = await appDataDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `pos_backup_${tenantId}_${timestamp}.db`;
    const backupPath = `${dataDir}${backupFileName}`;

    const sourcePath = await getDatabasePath();

    // Check if source database exists
    const sourceExists = await exists(sourcePath);
    if (!sourceExists) {
      throw new Error(`Source database not found at ${sourcePath}`);
    }

    // Copy the database file
    await copyFile(sourcePath, backupPath);

    console.log('[DatabaseBackup] ✅ Backup created successfully:', backupPath);

    return {
      success: true,
      backupPath,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DatabaseBackup] ❌ Backup failed:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Export database metadata (for reference)
 */
export async function exportDatabaseMetadata(tenantId: string): Promise<{
  success: boolean;
  metadata?: {
    tenantId: string;
    exportDate: string;
    tables: string[];
    recordCounts: Record<string, number>;
  };
  error?: string;
}> {
  try {
    console.log('[DatabaseBackup] Exporting metadata for tenant:', tenantId);

    const db = await Database.load('sqlite:pos.db');

    // Get all tables
    const tables = await db.select<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );

    const tableNames = tables.map((t) => t.name);
    const recordCounts: Record<string, number> = {};

    // Get record count for each table
    for (const table of tableNames) {
      try {
        const countResult = await db.select<{ count: number }[]>(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        recordCounts[table] = countResult[0]?.count || 0;
      } catch (err) {
        console.warn(`[DatabaseBackup] Could not count records in ${table}:`, err);
        recordCounts[table] = -1;
      }
    }

    const metadata = {
      tenantId,
      exportDate: new Date().toISOString(),
      tables: tableNames,
      recordCounts,
    };

    console.log('[DatabaseBackup] ✅ Metadata exported:', metadata);

    return {
      success: true,
      metadata,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DatabaseBackup] ❌ Metadata export failed:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Archive database and create a full backup with metadata
 */
export async function archiveDatabase(
  tenantId: string,
  includeMetadata: boolean = true
): Promise<{
  success: boolean;
  backupPath?: string;
  metadataPath?: string;
  metadata?: any;
  error?: string;
}> {
  try {
    console.log('[DatabaseBackup] Archiving database for tenant:', tenantId);

    // Create database backup
    const backupResult = await backupDatabase(tenantId);
    if (!backupResult.success) {
      throw new Error(backupResult.error || 'Backup failed');
    }

    let metadataPath: string | undefined;
    let metadata: any;

    // Export metadata if requested
    if (includeMetadata) {
      const metadataResult = await exportDatabaseMetadata(tenantId);
      if (metadataResult.success && metadataResult.metadata) {
        metadata = metadataResult.metadata;

        // Save metadata to file
        const dataDir = await appDataDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        metadataPath = `${dataDir}pos_backup_${tenantId}_${timestamp}_metadata.json`;

        const metadataJson = JSON.stringify(metadata, null, 2);
        await writeTextFile(metadataPath, metadataJson);

        console.log('[DatabaseBackup] ✅ Metadata saved to:', metadataPath);
      }
    }

    console.log('[DatabaseBackup] ✅ Archive complete!');
    console.log('[DatabaseBackup] Backup file:', backupResult.backupPath);
    if (metadataPath) {
      console.log('[DatabaseBackup] Metadata file:', metadataPath);
    }

    return {
      success: true,
      backupPath: backupResult.backupPath,
      metadataPath,
      metadata,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DatabaseBackup] ❌ Archive failed:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * User-friendly archive function with confirmation
 */
export async function confirmAndArchiveDatabase(tenantId: string): Promise<boolean> {
  const confirmed = window.confirm(
    `📦 ARCHIVE DATABASE\n\n` +
      `This will create a backup of your database for tenant:\n` +
      `"${tenantId}"\n\n` +
      `The backup will be saved with a timestamp in your app data directory.\n\n` +
      `Do you want to proceed?`
  );

  if (!confirmed) {
    return false;
  }

  try {
    const result = await archiveDatabase(tenantId, true);

    if (result.success) {
      alert(
        `✅ Database archived successfully!\n\n` +
          `Backup file: ${result.backupPath}\n\n` +
          (result.metadataPath ? `Metadata: ${result.metadataPath}\n\n` : '') +
          (result.metadata
            ? `Tables backed up: ${result.metadata.tables.length}\n` +
              `Total records: ${Object.values(result.metadata.recordCounts).reduce(
                (a: any, b: any) => a + (b > 0 ? b : 0),
                0
              )}`
            : '')
      );
      return true;
    } else {
      alert(`❌ Archive failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    alert(`❌ Archive failed: ${error}`);
    return false;
  }
}
