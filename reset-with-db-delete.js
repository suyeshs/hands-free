/**
 * Complete Reset with Database File Deletion
 * Run this in the browser console to completely reset everything including DB file
 *
 * Usage:
 * 1. Open DevTools (F12)
 * 2. Go to Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter
 */

(async function completeResetWithDBDelete() {
  if (!confirm('⚠️ This will DELETE the entire database file and all settings. Continue?')) {
    console.log('Reset cancelled');
    return;
  }

  console.log('🔄 Starting complete reset with database file deletion...');

  try {
    // Check if we're in Tauri
    if (typeof window.__TAURI__ === 'undefined') {
      alert('This script only works in the Tauri desktop app');
      return;
    }

    // Import Tauri APIs
    const { invoke } = window.__TAURI__.core;
    const { appDataDir } = window.__TAURI__.path;
    const { removeFile, exists } = window.__TAURI__.fs;

    // 1. Clear all stores first
    console.log('1️⃣ Clearing stores...');

    try {
      const { useTenantStore } = await import('./src/stores/tenantStore.ts');
      await useTenantStore.getState().clearTenant();
    } catch (e) {
      console.warn('Could not clear tenant store:', e);
    }

    try {
      const { useRestaurantSettingsStore } = await import('./src/stores/restaurantSettingsStore.ts');
      useRestaurantSettingsStore.getState().resetSettings();
    } catch (e) {
      console.warn('Could not reset restaurant settings:', e);
    }

    try {
      const { useSetupWizardStore } = await import('./src/stores/setupWizardStore.ts');
      await useSetupWizardStore.getState().resetWizard();
    } catch (e) {
      console.warn('Could not reset setup wizard:', e);
    }

    // 2. Clear storage
    console.log('2️⃣ Clearing localStorage...');
    localStorage.clear();

    console.log('3️⃣ Clearing sessionStorage...');
    sessionStorage.clear();

    // 3. Delete the database file
    console.log('4️⃣ Deleting database file...');
    const appData = await appDataDir();

    // Try both dev and prod database names
    const dbFiles = [
      `${appData}pos-dev.db`,
      `${appData}guanix.db`,
      `${appData}pos-dev.db-shm`,
      `${appData}pos-dev.db-wal`,
      `${appData}guanix.db-shm`,
      `${appData}guanix.db-wal`,
    ];

    for (const dbFile of dbFiles) {
      try {
        const fileExists = await exists(dbFile);
        if (fileExists) {
          await removeFile(dbFile);
          console.log(`✅ Deleted: ${dbFile}`);
        }
      } catch (err) {
        console.warn(`Could not delete ${dbFile}:`, err);
      }
    }

    console.log('✅ Reset complete! Reloading app...');

    setTimeout(() => {
      window.location.href = '/';
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error('❌ Reset failed:', error);
    alert('Reset failed: ' + error.message);
  }
})();
