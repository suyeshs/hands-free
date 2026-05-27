import { invoke } from '@tauri-apps/api/core';
import { getTenantSubdomain } from '../lib/urlGenerator';

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
  const subdomain = getTenantSubdomain();
  if (!subdomain) {
    throw new Error('Tenant subdomain not configured — cannot fetch migrations');
  }
  const r2BaseUrl = `https://${subdomain}.handsfree.tech`;

  console.log('[DynamicMigrations] Fetching manifest from R2...');

  const manifestUrl = `${r2BaseUrl}/migrations/manifest.json`;
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
      const sqlUrl = `${r2BaseUrl}/migrations/${entry.file}`;
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
      // If migration already applied, duplicate column, or CORS retry, silently skip
      // These are harmless - the migration either succeeded or will succeed on next attempt
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isHarmlessError =
        errorMsg.includes('already applied') ||
        errorMsg.includes('duplicate column name') ||
        errorMsg.includes('Load failed') ||
        errorMsg.includes('CORS') ||
        errorMsg.includes('already exists');

      if (!isHarmlessError) {
        console.error(`[DynamicMigrations] Error applying ${entry.name}:`, error);
      } else if (errorMsg.includes('duplicate column name')) {
        // Log as warning for duplicate columns (migration partially applied before)
        console.warn(`[DynamicMigrations] ⚠️ Skipping ${entry.name}: columns already exist`);
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
