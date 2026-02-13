/**
 * Clear Browser Auth Session
 * Run this in browser DevTools console to clear cached authentication
 * and force a fresh login with the new database
 */

console.log('🧹 Clearing cached authentication...');

// Clear all auth-related localStorage
localStorage.removeItem('auth-storage');
localStorage.removeItem('tenant-storage');
localStorage.removeItem('pos-storage');
localStorage.removeItem('kds-storage');

console.log('✅ Auth cache cleared');
console.log('🔄 Reloading page...');

// Reload to fresh state
window.location.reload();
