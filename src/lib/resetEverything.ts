/**
 * Complete System Reset
 * Deletes ALL data: database files, stores, localStorage, sessionStorage
 * Use with caution - this cannot be undone!
 */

import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { remove, exists } from '@tauri-apps/plugin-fs';
import Database from '@tauri-apps/plugin-sql';

interface ResetProgress {
  step: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  message: string;
}

type ProgressCallback = (progress: ResetProgress[]) => void;

/**
 * Complete system reset - deletes everything
 */
export async function resetEverything(
  onProgress?: ProgressCallback
): Promise<boolean> {
  const steps: ResetProgress[] = [
    { step: 'confirm', status: 'pending', message: 'Confirming reset' },
    { step: 'stores', status: 'pending', message: 'Clearing application stores' },
    { step: 'database-tables', status: 'pending', message: 'Clearing database tables' },
    { step: 'database-files', status: 'pending', message: 'Deleting database files' },
    { step: 'storage', status: 'pending', message: 'Clearing browser storage' },
    { step: 'reload', status: 'pending', message: 'Reloading application' },
  ];

  const updateProgress = (stepIndex: number, status: ResetProgress['status'], message?: string) => {
    steps[stepIndex].status = status;
    if (message) steps[stepIndex].message = message;
    onProgress?.(steps);
  };

  try {
    // Step 1: Confirm with user
    updateProgress(0, 'in-progress');
    const confirmed = window.confirm(
      '⚠️ COMPLETE SYSTEM RESET\n\n' +
      'This will PERMANENTLY DELETE:\n' +
      '• Database files (pos-dev.db, guanix.db)\n' +
      '• All menu items, categories, and prices\n' +
      '• All staff members and access PINs\n' +
      '• All orders and sales history\n' +
      '• All restaurant settings and configurations\n' +
      '• Floor plans and tables\n' +
      '• Inventory data and suppliers\n' +
      '• Tenant activation and cloud sync\n' +
      '• All browser storage\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Click OK to continue or Cancel to abort.'
    );

    if (!confirmed) {
      updateProgress(0, 'error', 'Reset cancelled by user');
      console.log('[ResetEverything] User cancelled reset');
      return false;
    }

    const confirmText = window.prompt(
      'Type "DELETE EVERYTHING" (exactly) to confirm permanent deletion:'
    );

    if (confirmText !== 'DELETE EVERYTHING') {
      updateProgress(0, 'error', 'Reset cancelled - text did not match');
      alert('Reset cancelled. Text did not match.');
      return false;
    }
    updateProgress(0, 'complete', 'Confirmation received');

    // Step 2: Clear all stores
    updateProgress(1, 'in-progress');
    console.log('[ResetEverything] Clearing application stores...');

    try {
      // Import stores dynamically to avoid circular dependencies
      const { useTenantStore } = await import('../stores/tenantStore');
      const { useRestaurantSettingsStore } = await import('../stores/restaurantSettingsStore');
      const { useSetupWizardStore } = await import('../stores/setupWizardStore');
      const { useProvisioningStore } = await import('../stores/provisioningStore');
      const { useMenuStore } = await import('../stores/menuStore');
      const { useAuthStore } = await import('../stores/authStore');

      // Clear tenant config (includes SQLite clear)
      console.log('[ResetEverything] Clearing tenant config...');
      await useTenantStore.getState().clearTenant();

      // Reset restaurant settings
      console.log('[ResetEverything] Resetting restaurant settings...');
      useRestaurantSettingsStore.getState().resetSettings();

      // Reset setup wizard
      console.log('[ResetEverything] Resetting setup wizard...');
      await useSetupWizardStore.getState().resetWizard();

      // Reset provisioning
      console.log('[ResetEverything] Resetting provisioning...');
      if (useProvisioningStore.persist?.clearStorage) {
        useProvisioningStore.persist.clearStorage();
      }

      // Clear menu
      console.log('[ResetEverything] Clearing menu...');
      if (useMenuStore.getState().clearMenu) {
        useMenuStore.getState().clearMenu();
      }

      // Logout
      console.log('[ResetEverything] Logging out...');
      await useAuthStore.getState().logout();

      updateProgress(1, 'complete', 'All stores cleared');
    } catch (error) {
      console.error('[ResetEverything] Error clearing stores:', error);
      updateProgress(1, 'error', `Store clear failed: ${error}`);
      // Continue anyway
    }

    // Step 3: Clear database tables
    updateProgress(2, 'in-progress');
    console.log('[ResetEverything] Clearing database tables...');

    try {
      const dbName = import.meta.env.DEV ? 'sqlite:pos-dev.db' : 'sqlite:guanix.db';
      const db = await Database.load(dbName);

      const tables = [
        'menu_items',
        'menu_categories',
        'menu_item_variants',
        'menu_item_images',
        'specials',
        'staff',
        'floor_plans',
        'tables',
        'sessions',
        'session_items',
        'session_kot_records',
        'aggregator_orders',
        'kds_orders',
        'sales_transactions',
        'sales_transaction_items',
        'daily_cash_registers',
        'cash_payouts',
        'inventory_items',
        'inventory_purchases',
        'inventory_adjustments',
        'inventory_suppliers',
        'order_mappings',
        'out_of_stock_items',
        'customers',
        'attendance_records',
        'leave_requests',
        'roster_shifts',
        'restaurant_settings',
        'tenant_config',
        'setup_wizard',
      ];

      for (const table of tables) {
        try {
          await db.execute(`DELETE FROM ${table}`);
          console.log(`[ResetEverything] Cleared table: ${table}`);
        } catch (err) {
          // Table might not exist, that's OK
          console.warn(`[ResetEverything] Could not clear table ${table}:`, err);
        }
      }

      updateProgress(2, 'complete', `Cleared ${tables.length} database tables`);
    } catch (error) {
      console.error('[ResetEverything] Error clearing database tables:', error);
      updateProgress(2, 'error', `Database clear failed: ${error}`);
      // Continue to file deletion
    }

    // Step 4: Delete database files
    updateProgress(3, 'in-progress');
    console.log('[ResetEverything] Deleting database files...');

    try {
      const appData = await appDataDir();
      console.log('[ResetEverything] App data directory:', appData);

      // List of database files to delete
      const dbFiles = [
        'pos-dev.db',
        'pos-dev.db-shm',
        'pos-dev.db-wal',
        'guanix.db',
        'guanix.db-shm',
        'guanix.db-wal',
      ];

      let deletedCount = 0;

      for (const filename of dbFiles) {
        const filePath = `${appData}${filename}`;
        try {
          const fileExists = await exists(filePath);
          if (fileExists) {
            await remove(filePath);
            console.log(`[ResetEverything] ✅ Deleted: ${filename}`);
            deletedCount++;
          } else {
            console.log(`[ResetEverything] ⏭️  Skipped (not found): ${filename}`);
          }
        } catch (err) {
          console.warn(`[ResetEverything] Could not delete ${filename}:`, err);
        }
      }

      updateProgress(3, 'complete', `Deleted ${deletedCount} database file(s)`);
    } catch (error) {
      console.error('[ResetEverything] Error deleting database files:', error);
      updateProgress(3, 'error', `File deletion failed: ${error}`);
      // Continue anyway
    }

    // Step 5: Clear browser storage
    updateProgress(4, 'in-progress');
    console.log('[ResetEverything] Clearing browser storage...');

    try {
      // Clear localStorage
      console.log('[ResetEverything] Clearing localStorage...');
      localStorage.clear();

      // Clear sessionStorage
      console.log('[ResetEverything] Clearing sessionStorage...');
      sessionStorage.clear();

      // Clear IndexedDB (if any)
      if (window.indexedDB) {
        console.log('[ResetEverything] Clearing IndexedDB...');
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            window.indexedDB.deleteDatabase(db.name);
            console.log(`[ResetEverything] Deleted IndexedDB: ${db.name}`);
          }
        }
      }

      updateProgress(4, 'complete', 'Browser storage cleared');
    } catch (error) {
      console.error('[ResetEverything] Error clearing storage:', error);
      updateProgress(4, 'error', `Storage clear failed: ${error}`);
    }

    // Step 6: Reload application
    updateProgress(5, 'in-progress');
    console.log('[ResetEverything] ✅ Reset complete! Reloading application...');

    // Small delay to show completion
    setTimeout(() => {
      updateProgress(5, 'complete', 'Reloading...');

      // Navigate to root and reload
      window.location.href = '/';
      window.location.reload();
    }, 1000);

    return true;

  } catch (error) {
    console.error('[ResetEverything] ❌ Reset failed:', error);
    alert('Reset failed: ' + error);
    return false;
  }
}

/**
 * Quick reset without confirmation (for development)
 * DO NOT USE IN PRODUCTION
 */
export async function quickResetDev(): Promise<void> {
  if (!import.meta.env.DEV) {
    throw new Error('quickResetDev() can only be used in development mode');
  }

  console.warn('[ResetEverything] Quick dev reset - bypassing confirmation');

  try {
    // Clear stores
    const { useTenantStore } = await import('../stores/tenantStore');
    const { useRestaurantSettingsStore } = await import('../stores/restaurantSettingsStore');
    const { useSetupWizardStore } = await import('../stores/setupWizardStore');

    await useTenantStore.getState().clearTenant();
    useRestaurantSettingsStore.getState().resetSettings();
    await useSetupWizardStore.getState().resetWizard();

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();

    // Delete database files
    const appData = await appDataDir();
    const dbFiles = ['pos-dev.db', 'pos-dev.db-shm', 'pos-dev.db-wal'];

    for (const filename of dbFiles) {
      try {
        const filePath = `${appData}${filename}`;
        if (await exists(filePath)) {
          await remove(filePath);
        }
      } catch (err) {
        console.warn(`Could not delete ${filename}:`, err);
      }
    }

    // Reload
    window.location.href = '/';
    window.location.reload();
  } catch (error) {
    console.error('[ResetEverything] Quick reset failed:', error);
    throw error;
  }
}
