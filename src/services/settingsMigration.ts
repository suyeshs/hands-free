/**
 * Settings Migration Service
 * Migrates restaurant settings from localStorage (v3.0 and earlier) to SQLite (v3.1+)
 */

import { getRestaurantSettings, saveRestaurantSettings } from './tauriSettings';
import type { RestaurantDetails } from '../stores/restaurantSettingsStore';
import { isTauri } from '../lib/platform';

const MIGRATION_KEY = 'settings-migration-v3.1';
const OLD_SETTINGS_KEY = 'restaurant-settings';

export interface MigrationStatus {
  needsMigration: boolean;
  hasOldSettings: boolean;
  hasSQLiteSettings: boolean;
  migrationComplete: boolean;
}

/**
 * Check if migration is needed
 */
export async function checkMigrationStatus(): Promise<MigrationStatus> {
  // Migration only applies in Tauri app
  if (!isTauri()) {
    return {
      needsMigration: false,
      hasOldSettings: false,
      hasSQLiteSettings: false,
      migrationComplete: true,
    };
  }

  // Check if migration was already completed
  const migrationComplete = localStorage.getItem(MIGRATION_KEY) === 'complete';
  if (migrationComplete) {
    return {
      needsMigration: false,
      hasOldSettings: false,
      hasSQLiteSettings: true,
      migrationComplete: true,
    };
  }

  // Check for old localStorage settings
  const oldSettingsRaw = localStorage.getItem(OLD_SETTINGS_KEY);
  const hasOldSettings = !!oldSettingsRaw && oldSettingsRaw !== '{}';

  // Check if SQLite has settings
  let hasSQLiteSettings = false;
  try {
    const sqliteSettings = await getRestaurantSettings();
    // Check if it's not the default placeholder
    hasSQLiteSettings = sqliteSettings.name !== 'Restaurant Name' && !!sqliteSettings.name?.trim();
  } catch (error) {
    console.log('[Migration] SQLite settings not available (fresh database or table missing)');
    hasSQLiteSettings = false;

    // If there are no old settings either, this is a fresh start - mark migration complete
    if (!hasOldSettings) {
      console.log('[Migration] Fresh database with no old settings - marking migration complete');
      localStorage.setItem(MIGRATION_KEY, 'complete');
      return {
        needsMigration: false,
        hasOldSettings: false,
        hasSQLiteSettings: false,
        migrationComplete: true,
      };
    }
  }

  // Need migration if we have old settings but no SQLite settings
  const needsMigration = hasOldSettings && !hasSQLiteSettings;

  return {
    needsMigration,
    hasOldSettings,
    hasSQLiteSettings,
    migrationComplete,
  };
}

/**
 * Migrate settings from localStorage to SQLite
 */
export async function migrateSettings(
  onProgress?: (step: string, progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  if (!isTauri()) {
    return { success: false, error: 'Migration only works in Tauri app' };
  }

  try {
    onProgress?.('Reading old settings...', 10);

    // Read old settings from localStorage
    const oldSettingsRaw = localStorage.getItem(OLD_SETTINGS_KEY);
    if (!oldSettingsRaw) {
      return { success: false, error: 'No old settings found' };
    }

    onProgress?.('Parsing settings data...', 30);

    const oldData = JSON.parse(oldSettingsRaw);

    // Extract settings from Zustand persist format
    const oldSettings = oldData.state?.settings || oldData.settings;
    if (!oldSettings) {
      return { success: false, error: 'Invalid settings format' };
    }

    onProgress?.('Validating settings...', 50);

    // Validate that we have at least basic data
    if (!oldSettings.name || oldSettings.name === 'Restaurant Name') {
      return { success: false, error: 'Settings appear to be unconfigured' };
    }

    onProgress?.('Saving to SQLite database...', 70);

    // Save to SQLite
    await saveRestaurantSettings(oldSettings as RestaurantDetails);

    onProgress?.('Verifying migration...', 90);

    // Verify the migration worked
    const sqliteSettings = await getRestaurantSettings();
    if (sqliteSettings.name !== oldSettings.name) {
      throw new Error('Migration verification failed');
    }

    onProgress?.('Migration complete!', 100);

    // Mark migration as complete
    localStorage.setItem(MIGRATION_KEY, 'complete');

    // Optionally: Clear old settings after successful migration
    // localStorage.removeItem(OLD_SETTINGS_KEY);
    // Note: We keep old settings as backup for now

    console.log('[Migration] ✅ Settings migrated successfully from localStorage to SQLite');

    return { success: true };
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Skip migration (user chose to start fresh)
 */
export function skipMigration(): void {
  localStorage.setItem(MIGRATION_KEY, 'complete');
  console.log('[Migration] User skipped migration, starting fresh');
}

/**
 * Reset migration status (for testing)
 */
export function resetMigrationStatus(): void {
  localStorage.removeItem(MIGRATION_KEY);
  console.log('[Migration] Migration status reset');
}

/**
 * Get a summary of old settings for preview
 */
export function getOldSettingsPreview(): {
  restaurantName?: string;
  phone?: string;
  address?: string;
} | null {
  try {
    const oldSettingsRaw = localStorage.getItem(OLD_SETTINGS_KEY);
    if (!oldSettingsRaw) return null;

    const oldData = JSON.parse(oldSettingsRaw);
    const oldSettings = oldData.state?.settings || oldData.settings;

    if (!oldSettings) return null;

    return {
      restaurantName: oldSettings.name,
      phone: oldSettings.phone,
      address: oldSettings.address
        ? `${oldSettings.address.line1}, ${oldSettings.address.city}`
        : undefined,
    };
  } catch (error) {
    console.error('[Migration] Failed to get old settings preview:', error);
    return null;
  }
}
