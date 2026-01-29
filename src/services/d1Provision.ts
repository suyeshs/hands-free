/**
 * D1 Database Provisioning Service
 *
 * Provisions D1 database schema using wrangler CLI via Tauri
 */

import { invoke } from '@tauri-apps/api/core';
import { resourceDir } from '@tauri-apps/api/path';

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
 * Provision D1 database with the full POS schema
 */
export async function provisionD1Schema(databaseId: string): Promise<D1ProvisionResult> {
  try {
    console.log('[D1 Provision] Starting provisioning for database:', databaseId);

    // Get the schema file path from Tauri resources
    const resourceDirPath = await resourceDir();
    const schemaPath = `${resourceDirPath}d1-schema.sql`;

    console.log('[D1 Provision] Schema path:', schemaPath);

    // Call Tauri command to execute wrangler
    const result = await invoke<D1ProvisionResult>('provision_d1_schema', {
      databaseId,
      schemaPath,
    });

    console.log('[D1 Provision] Result:', result);

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
