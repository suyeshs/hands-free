/**
 * Database Reset Utilities
 * Functions to completely wipe the local database for "Create New Restaurant" workflow
 */

import Database from '@tauri-apps/plugin-sql';
import { useProvisioningStore } from '../stores/provisioningStore';
import { useTenantStore } from '../stores/tenantStore';

/**
 * Completely reset the database and all app state
 * WARNING: This will delete ALL local data
 */
export async function resetAppForNewRestaurant(): Promise<void> {
  console.log('[DatabaseReset] Starting complete app reset...');

  try {
    // Connect to database
    const db = await Database.load('sqlite:pos.db');

    // List of all tables to clear
    const tables = [
      'menu_items',
      'menu_categories',
      'menu_item_variants',
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
    ];

    console.log('[DatabaseReset] Clearing tables:', tables.join(', '));

    // Delete all data from each table
    for (const table of tables) {
      try {
        await db.execute(`DELETE FROM ${table}`);
        console.log(`[DatabaseReset] Cleared table: ${table}`);
      } catch (err) {
        // Table might not exist, that's OK
        console.warn(`[DatabaseReset] Could not clear table ${table}:`, err);
      }
    }

    console.log('[DatabaseReset] Database tables cleared');

    // Reset Zustand stores
    console.log('[DatabaseReset] Resetting provisioning store...');
    useProvisioningStore.getState().resetProvisioning();

    console.log('[DatabaseReset] Clearing tenant store...');
    useTenantStore.getState().clearTenant();

    // Clear all localStorage (except provisioning which was just reset)
    console.log('[DatabaseReset] Clearing localStorage (preserving reset state)...');
    const keysToPreserve = ['provisioning-storage', 'tenant-storage'];
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (!keysToPreserve.includes(key)) {
        localStorage.removeItem(key);
      }
    }

    console.log('[DatabaseReset] ✅ App reset complete!');
  } catch (error) {
    console.error('[DatabaseReset] ❌ Reset failed:', error);
    throw error;
  }
}

/**
 * Confirm and execute restaurant reset
 * Shows confirmation dialog before proceeding
 */
export async function confirmAndResetRestaurant(): Promise<boolean> {
  const confirmed = window.confirm(
    '⚠️ CREATE NEW RESTAURANT\n\n' +
    'This will PERMANENTLY DELETE:\n' +
    '• All menu items and categories\n' +
    '• All staff members\n' +
    '• All orders and sales history\n' +
    '• All settings and configurations\n' +
    '• Floor plans and tables\n' +
    '• Inventory data\n\n' +
    'This action CANNOT be undone!\n\n' +
    'Type "DELETE" in the next prompt to confirm.'
  );

  if (!confirmed) {
    return false;
  }

  const confirmText = window.prompt(
    'Type "DELETE" (all caps) to confirm permanent deletion:'
  );

  if (confirmText !== 'DELETE') {
    alert('Reset cancelled. Text did not match.');
    return false;
  }

  try {
    await resetAppForNewRestaurant();
    alert('✅ Database cleared successfully!\n\nThe app will now reload to start the setup wizard.');
    return true;
  } catch (error) {
    alert('❌ Reset failed: ' + error);
    return false;
  }
}
