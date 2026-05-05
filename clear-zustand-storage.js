/**
 * Clear Zustand localStorage keys
 * Run this in browser console to clear all persisted Zustand store data
 *
 * Usage: Copy and paste this entire script into browser DevTools console
 */

console.log('[Zustand Cleanup] Starting localStorage cleanup...');

// List of all Zustand stores that persist to localStorage
const zustandStores = [
  // Data stores (should NOT use localStorage - migrating to SQLite only)
  'staff-storage',
  'payroll-storage',
  'attendance-storage',
  'rostering-storage',
  'inventory-storage',
  'bar-inventory-storage',
  'leave-storage',
  'multi-location-storage',
  'chain-config-storage',
  'guest-session-storage',
  'aggregator-extraction-storage',
  'training-storage',
  'delivery-verification-storage',
  'qr-ordering-storage',
  'bar-pos-storage',
  'notification-storage',

  // Settings stores (can keep, but clearing for fresh start)
  'language-storage',
  'theme-storage',
  'printer-storage',
  'device-storage',
  'print-storage',
  'remote-print-storage',
  'aggregator-settings-storage',

  // Auth/Session stores
  'auth-storage',
  'provisioning-storage',
  'handsfree-setup-storage',
  'setup-wizard-storage',
];

// Get all localStorage keys before cleanup
const beforeKeys = Object.keys(localStorage);
console.log(`[Zustand Cleanup] Found ${beforeKeys.length} localStorage keys`);

// Clear Zustand stores
let clearedCount = 0;
zustandStores.forEach(storeName => {
  if (localStorage.getItem(storeName)) {
    localStorage.removeItem(storeName);
    console.log(`[Zustand Cleanup] ✅ Cleared: ${storeName}`);
    clearedCount++;
  }
});

// Also clear any keys that look like Zustand stores but weren't in our list
const remainingKeys = Object.keys(localStorage);
remainingKeys.forEach(key => {
  if (key.endsWith('-storage') || key.startsWith('zustand-')) {
    localStorage.removeItem(key);
    console.log(`[Zustand Cleanup] ✅ Cleared (pattern match): ${key}`);
    clearedCount++;
  }
});

console.log(`[Zustand Cleanup] ✅ Cleared ${clearedCount} Zustand store(s)`);
console.log(`[Zustand Cleanup] Remaining localStorage keys: ${Object.keys(localStorage).length}`);

// Optional: Clear ALL localStorage (uncomment if you want a complete wipe)
// localStorage.clear();
// console.log('[Zustand Cleanup] ✅ Cleared ALL localStorage');

// Show remaining keys for debugging
const remaining = Object.keys(localStorage);
if (remaining.length > 0) {
  console.log('[Zustand Cleanup] Remaining localStorage keys:', remaining);
} else {
  console.log('[Zustand Cleanup] ✅ localStorage is empty');
}

console.log('[Zustand Cleanup] ✅ Cleanup complete! Reload the app to see fresh data from SQLite.');
console.log('[Zustand Cleanup] Run: window.location.reload()');
