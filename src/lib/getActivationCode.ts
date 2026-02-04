/**
 * Quick helper to get the current tenant's activation code
 * Usage: window.getActivationCode() in browser console
 */

import { useSetupWizardStore } from '../stores/setupWizardStore';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';

function getActivationCodeInfo() {
  console.clear();
  console.log('🔑 Tenant Activation Code\n');

  // Check if logged in
  const user = useAuthStore.getState().user;
  if (!user) {
    console.error('❌ Not logged in');
    return { error: 'Not logged in' };
  }

  // Get tenant info
  const tenant = useTenantStore.getState().tenant;
  const tenantId = user.tenantId;

  console.log('Tenant ID:', tenantId);
  if (tenant) {
    console.log('Company Name:', tenant.companyName);
    console.log('Subdomain:', tenant.subdomain);
  }

  // Get activation code from setup wizard store
  const activationCode = useSetupWizardStore.getState().activationCode;

  if (!activationCode) {
    console.warn('\n⚠️ No activation code found');
    console.log('\nThis can happen if:');
    console.log('1. You activated this device using an activation code (staff device)');
    console.log('2. The setup wizard data was not saved properly');
    console.log('3. This is an older installation');
    console.log('\nTo get the activation code:');
    console.log('- Check the owner/main device');
    console.log('- Go to Settings → look for "Activation Code" card');
    console.log('- Or create a new activation code from the admin panel');
    return { error: 'No activation code found', tenantId };
  }

  console.log('\n✅ Activation Code:\n');
  console.log('┌─────────────────────────────┐');
  console.log('│                             │');
  console.log(`│     ${activationCode}     │`);
  console.log('│                             │');
  console.log('└─────────────────────────────┘\n');

  console.log('📋 Code copied to clipboard!');

  // Copy to clipboard
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(activationCode).catch(() => {
        console.warn('Could not copy to clipboard automatically');
      });
    }
  } catch (err) {
    console.warn('Could not copy to clipboard:', err);
  }

  console.log('\n💡 Share this code with staff to activate other devices');
  console.log('⚠️  Keep this code secure - it grants access to your POS system\n');

  return {
    activationCode,
    tenantId,
    companyName: tenant?.companyName,
    subdomain: tenant?.subdomain,
  };
}

// Expose globally
if (typeof window !== 'undefined') {
  (window as any).getActivationCode = getActivationCodeInfo;
  console.log('[Activation Code] Type getActivationCode() to view your activation code');
}

export { getActivationCodeInfo };
