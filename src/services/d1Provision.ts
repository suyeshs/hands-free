/**
 * D1 Database Provisioning Service
 *
 * Provisions D1 database schema using wrangler CLI via Tauri
 */

import { invoke } from '@tauri-apps/api/core';

export interface D1ProvisionResult {
  success: boolean;
  output: string;
  tables_created?: number;
  error?: string;
}

/**
 * Check if wrangler CLI is installed
 */
export async function checkWranglerInstalled(): Promise<boolean> {
  try {
    const installed = await invoke<boolean>('check_wrangler_installed');
    return installed;
  } catch (error) {
    console.error('[D1 Provision] Failed to check wrangler:', error);
    return false;
  }
}

/**
 * Get wrangler CLI version
 */
export async function getWranglerVersion(): Promise<string | null> {
  try {
    const version = await invoke<string>('get_wrangler_version');
    return version;
  } catch (error) {
    console.error('[D1 Provision] Failed to get wrangler version:', error);
    return null;
  }
}

/**
 * Provision D1 database with schema extracted from local SQLite
 */
export async function provisionD1Schema(databaseId: string): Promise<D1ProvisionResult> {
  try {
    console.log('[D1 Provision] Starting provisioning for database:', databaseId);

    // Get local SQLite database path
    const dbPath = `${await import('@tauri-apps/api/path').then(m => m.appDataDir())}pos.db`;
    console.log('[D1 Provision] Extracting schema from:', dbPath);

    // Extract schema from local SQLite
    const schema = await invoke<string[]>('extract_sqlite_schema', { dbPath });
    console.log(`[D1 Provision] Extracted ${schema.length} schema statements`);

    if (schema.length === 0) {
      return {
        success: false,
        output: '',
        error: 'No schema found in local database',
      };
    }

    // Create temporary SQL file with extracted schema
    const tempDir = await import('@tauri-apps/api/path').then(m => m.tempDir());
    const tempSchemaPath = `${tempDir}d1-schema-${Date.now()}.sql`;

    // Write schema to temp file
    await invoke('write_temp_file', {
      path: tempSchemaPath,
      content: schema.join(';\n\n') + ';',
    });

    console.log('[D1 Provision] Wrote schema to temp file:', tempSchemaPath);

    // Call Tauri command to execute wrangler with the temp schema file
    const result = await invoke<D1ProvisionResult>('provision_d1_schema', {
      databaseId,
      schemaPath: tempSchemaPath,
    });

    console.log('[D1 Provision] Result:', result);

    // Clean up temp file
    try {
      await invoke('delete_temp_file', { path: tempSchemaPath });
    } catch (e) {
      console.warn('[D1 Provision] Failed to delete temp file:', e);
    }

    return result;
  } catch (error: any) {
    console.error('[D1 Provision] Error:', error);
    return {
      success: false,
      output: '',
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Check D1 provisioning status by checking table count
 */
export async function checkD1ProvisioningStatus(
  databaseId: string
): Promise<{ provisioned: boolean; tableCount: number }> {
  try {
    // This would need to be implemented as a Tauri command that runs:
    // wrangler d1 execute <database_id> --remote --command="SELECT COUNT(*) FROM sqlite_master WHERE type='table'"

    // For now, return a placeholder
    console.log('[D1 Provision] Checking status for:', databaseId);
    return {
      provisioned: false,
      tableCount: 0,
    };
  } catch (error) {
    console.error('[D1 Provision] Failed to check status:', error);
    return {
      provisioned: false,
      tableCount: 0,
    };
  }
}
