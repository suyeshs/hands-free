/**
 * Clear Zustand localStorage on App Startup
 * Removes persisted Zustand stores that have been migrated to SQLite-only
 */

export function clearMigratedZustandStores() {
  console.log('[Zustand Cleanup] Clearing migrated stores from localStorage...');

  // List of store keys that have been migrated to SQLite-only
  // These should NO LONGER persist to localStorage
  const migratedStores = [
    // ✅ Completed migrations
    'staff-storage',           // staffStore - now SQLite only
    'multi-location-storage',  // multiLocationStore - now SQLite only
    'chain-config-storage',    // chainConfigStore - now SQLite only

    // 🚧 To be migrated (clear anyway to prevent stale data)
    'inventory-storage',             // inventoryStore
    'payroll-storage',               // payrollStore
    'attendance-storage',            // attendanceStore
    'rostering-storage',             // rosteringStore
    'bar-inventory-storage',         // barInventoryStore
    'leave-storage',                 // leaveStore
    'guest-session-storage',         // guestSessionStore
    'aggregator-extraction-storage', // aggregatorExtractionStore
    'training-storage',              // trainingStore
    'delivery-verification-storage', // deliveryVerificationStore
    'qr-ordering-storage',           // qrOrderingStore
    'bar-pos-storage',               // barPOSStore
    'notification-storage',          // notificationStore
  ];

  // Settings stores - keep these (UI preferences)
  const keepStores = [
    'language-storage',       // languageStore - UI preference (OK)
    'theme-storage',          // themeStore - UI preference (OK)
    'printer-storage',        // printerStore - device settings (OK)
    'device-storage',         // deviceStore - device config (OK)
    'print-storage',          // printStore - print preferences (OK)
    'remote-print-storage',   // remotePrintStore - remote print settings (OK)
    'auth-storage',           // authStore - auth tokens (OK, simplified)
    'provisioning-storage',   // provisioningStore - setup workflow (OK)
    'handsfree-setup-storage',// handsfreeSetupStore - onboarding (OK)
  ];

  let clearedCount = 0;
  let skippedCount = 0;

  // Clear migrated stores
  migratedStores.forEach(storeName => {
    if (localStorage.getItem(storeName)) {
      localStorage.removeItem(storeName);
      console.log(`[Zustand Cleanup] ✅ Cleared: ${storeName}`);
      clearedCount++;
    }
  });

  // Log kept stores for transparency
  keepStores.forEach(storeName => {
    if (localStorage.getItem(storeName)) {
      console.log(`[Zustand Cleanup] ⏭️  Kept: ${storeName}`);
      skippedCount++;
    }
  });

  // Also clear any unknown stores that match the pattern
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (
      (key.endsWith('-storage') || key.startsWith('zustand-')) &&
      !keepStores.includes(key) &&
      !migratedStores.includes(key)
    ) {
      localStorage.removeItem(key);
      console.log(`[Zustand Cleanup] ✅ Cleared (pattern match): ${key}`);
      clearedCount++;
    }
  });

  console.log(
    `[Zustand Cleanup] ✅ Complete! Cleared ${clearedCount} stores, kept ${skippedCount} settings stores`
  );

  return {
    cleared: clearedCount,
    kept: skippedCount,
  };
}

/**
 * Clear ALL localStorage (for complete reset)
 * Use with caution - this removes everything including settings
 */
export function clearAllLocalStorage() {
  console.warn('[Zustand Cleanup] ⚠️  Clearing ALL localStorage...');
  localStorage.clear();
  console.log('[Zustand Cleanup] ✅ localStorage completely cleared');
}
