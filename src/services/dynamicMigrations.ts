import { invoke } from '@tauri-apps/api/core';

// Use Cloudflare Worker URL which has CORS enabled
// Direct R2.dev URLs don't allow CORS from Tauri (localhost:1420)
const R2_BASE_URL = 'https://handsfree-restaurant.suyesh.workers.dev';

export interface AppliedMigration {
  version: number;
  name: string;
  description?: string;
  source: 'built-in' | 'cloud';
  checksum: string;
  applied_at: number;
  app_version: string;
}

interface MigrationManifest {
  version: number;
  migrations: MigrationEntry[];
}

interface MigrationEntry {
  version: number;
  name: string;
  description?: string;
  file: string;
  checksum: string;
  required_app_version: string;
  tenant_whitelist?: string[] | null;
  created_at: string;
}

/**
 * Sync dynamic migrations from cloud using fetch()
 * Downloads manifest and SQL files from R2, applies via Rust
 * Returns list of applied migration names
 */
export async function syncDynamicMigrations(): Promise<string[]> {
  console.log('[DynamicMigrations] Fetching manifest from R2...');

  // Fetch manifest using standard fetch()
  const manifestUrl = `${R2_BASE_URL}/migrations/manifest.json`;
  const manifestResponse = await fetch(manifestUrl);

  if (!manifestResponse.ok) {
    throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
  }

  const manifest: MigrationManifest = await manifestResponse.json();
  console.log(`[DynamicMigrations] Found ${manifest.migrations.length} migrations in manifest`);

  const appliedMigrations: string[] = [];

  // Process each migration
  for (const entry of manifest.migrations) {
    try {
      // Download SQL file using fetch()
      console.log(`[DynamicMigrations] Downloading migration: ${entry.name}`);
      const sqlUrl = `${R2_BASE_URL}/migrations/${entry.file}`;
      const sqlResponse = await fetch(sqlUrl);

      if (!sqlResponse.ok) {
        console.error(`[DynamicMigrations] Failed to download ${entry.name}: ${sqlResponse.status}`);
        continue;
      }

      const sqlContent = await sqlResponse.text();

      // Apply migration via Rust command
      await invoke('apply_migration_sql', {
        version: entry.version,
        name: entry.name,
        description: entry.description,
        sqlContent,
        checksum: entry.checksum,
      });

      appliedMigrations.push(`${entry.name} (v${entry.version})`);
      console.log(`[DynamicMigrations] ✅ Applied: ${entry.name}`);
    } catch (error) {
      // If migration already applied or CORS retry, silently skip
      // These are harmless - the migration either succeeded or will succeed on next attempt
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('already applied') && !errorMsg.includes('Load failed') && !errorMsg.includes('CORS')) {
        console.error(`[DynamicMigrations] Error applying ${entry.name}:`, error);
      }
    }
  }

  return appliedMigrations;
}

/**
 * Get complete migration history
 * Returns all applied migrations (built-in and cloud)
 */
export async function getMigrationHistory(): Promise<AppliedMigration[]> {
  return await invoke<AppliedMigration[]>('get_migration_history');
}
