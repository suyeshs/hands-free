/**
 * Quick Reset Script for Browser Console
 *
 * Copy and paste this into the browser console (F12 or Cmd+Option+I)
 * to quickly reset the system
 */

// Method 1: Navigate to Complete Reset UI
window.location.href = '/#/complete-reset';

// OR Method 2: Direct reset with confirmation
/*
(async function() {
  const { resetEverything } = await import('./src/lib/resetEverything.ts');
  await resetEverything((progress) => {
    console.table(progress);
  });
})();
*/
