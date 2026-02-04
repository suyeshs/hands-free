/**
 * Database Path Utility
 * Provides the correct file system path to the SQLite database
 */

import { appDataDir } from '@tauri-apps/api/path';

let cachedPath: string | null = null;

// Determine database filename based on environment
// Dev mode uses pos-dev.db, production uses guanix.db
const DB_FILENAME = import.meta.env.DEV ? 'pos-dev.db' : 'guanix.db';

/**
 * Get the file system path to the SQLite database
 * Returns the actual file path (e.g., /Users/.../guanix.db or /Users/.../pos-dev.db)
 * NOT the Tauri SQL plugin format (sqlite:guanix.db)
 */
export async function getDatabasePath(): Promise<string> {
  if (cachedPath) {
    return cachedPath;
  }

  try {
    const dataDir = await appDataDir();
    cachedPath = dataDir.endsWith('/') || dataDir.endsWith('\\')
      ? `${dataDir}${DB_FILENAME}`
      : `${dataDir}/${DB_FILENAME}`;
    console.log(`[DatabasePath] Using database file: ${cachedPath}`);
    return cachedPath;
  } catch (error) {
    console.error('[DatabasePath] Failed to get app data dir:', error);
    // Fallback to relative path
    return DB_FILENAME;
  }
}

/**
 * Clear the cached path (useful for testing)
 */
export function clearCachedPath(): void {
  cachedPath = null;
}
