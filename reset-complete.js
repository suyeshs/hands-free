/**
 * Complete Tenant Reset Script
 * Run this in the browser console to completely reset the app
 *
 * Usage:
 * 1. Open DevTools (F12 or Cmd+Option+I)
 * 2. Go to Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter
 */

(async function completeReset() {
  console.log('🔄 Starting complete tenant reset...');

  try {
    // Import necessary stores
    const { useTenantStore } = await import('./src/stores/tenantStore.ts');
    const { useRestaurantSettingsStore } = await import('./src/stores/restaurantSettingsStore.ts');
    const { useSetupWizardStore } = await import('./src/stores/setupWizardStore.ts');
    const { useProvisioningStore } = await import('./src/stores/provisioningStore.ts');
    const { useMenuStore } = await import('./src/stores/menuStore.ts');

    // 1. Clear Tenant Config
    console.log('1️⃣ Clearing tenant configuration...');
    await useTenantStore.getState().clearTenant();

    // 2. Reset Restaurant Settings
    console.log('2️⃣ Resetting restaurant settings...');
    useRestaurantSettingsStore.getState().resetSettings();

    // 3. Reset Setup Wizard
    console.log('3️⃣ Resetting setup wizard...');
    await useSetupWizardStore.getState().resetWizard();

    // 4. Reset Provisioning
    console.log('4️⃣ Resetting provisioning store...');
    useProvisioningStore.persist.clearStorage();

    // 5. Clear Menu Store
    console.log('5️⃣ Clearing menu store...');
    useMenuStore.getState().clearMenu();

    // 6. Clear localStorage
    console.log('6️⃣ Clearing localStorage...');
    localStorage.clear();

    // 7. Clear sessionStorage
    console.log('7️⃣ Clearing sessionStorage...');
    sessionStorage.clear();

    console.log('✅ Reset complete! Reloading app...');

    // Reload the app
    setTimeout(() => {
      window.location.href = '/';
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error('❌ Reset failed:', error);
    alert('Reset failed. Please navigate to /#/reset instead.');
  }
})();
