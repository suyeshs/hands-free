/**
 * Reset Setup Page
 * Utility page to completely reset all setup data for fresh start
 * Access at: /#/reset-setup
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetupWizardStore } from '../stores/setupWizardStore';
import { useProvisioningStore } from '../stores/provisioningStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
// import { useTenantStore } from '../stores/tenantStore';

export function ResetSetup() {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset ALL setup data? This cannot be undone.')) {
      return;
    }

    setIsResetting(true);

    try {
      // Clear all Zustand stores
      console.log('[ResetSetup] Resetting setup wizard store (SQLite)...');
      await useSetupWizardStore.getState().resetWizard();

      console.log('[ResetSetup] Resetting provisioning store...');
      useProvisioningStore.persist.clearStorage();

      console.log('[ResetSetup] Resetting restaurant settings store...');
      useRestaurantSettingsStore.getState().resetSettings();

      // Clear localStorage
      console.log('[ResetSetup] Clearing localStorage...');
      localStorage.removeItem('setup-wizard-storage');
      localStorage.removeItem('provisioning-store');
      localStorage.removeItem('restaurant-settings-storage');
      localStorage.removeItem('tenant-store');
      localStorage.removeItem('tenant-storage'); // Tenant activation state
      localStorage.removeItem('settings-migration-v3.1'); // Migration flag
      localStorage.removeItem('restaurant-settings'); // Old settings

      // Clear sessionStorage
      console.log('[ResetSetup] Clearing sessionStorage...');
      sessionStorage.clear();

      setResetComplete(true);

      // Reload after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('[ResetSetup] Error during reset:', error);
      alert('Error during reset: ' + error);
    } finally {
      setIsResetting(false);
    }
  };

  if (resetComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-surface-1 to-surface-2">
        <div className="max-w-md w-full p-8">
          <div className="glass-panel rounded-2xl border border-border p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-wider mb-4">Reset Complete</h1>
            <p className="text-muted-foreground mb-4">
              All setup data has been cleared. Reloading app...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-surface-1 to-surface-2">
      <div className="max-w-md w-full p-8">
        <div className="glass-panel rounded-2xl border border-border p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-wider mb-2">Reset Setup</h1>
            <p className="text-muted-foreground text-sm">
              Clear all setup data and start fresh
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                <strong>Warning:</strong> This will delete:
              </p>
              <ul className="text-xs text-yellow-600/80 dark:text-yellow-400/80 mt-2 space-y-1 list-disc list-inside">
                <li>All setup wizard progress</li>
                <li>Restaurant settings</li>
                <li>Provisioning state</li>
                <li>Tenant information</li>
                <li>Demo menu, staff, and floor plan data</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>Note:</strong> The database file has already been deleted.
                This will clear browser storage to complete the reset.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              disabled={isResetting}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold uppercase tracking-widest text-sm shadow-lg hover:bg-red-600 transition-all disabled:opacity-50"
            >
              {isResetting ? 'Resetting...' : 'Reset All'}
            </button>
          </div>
        </div>

        <p className="text-center text-muted-foreground/60 text-xs mt-6">
          Development utility • Use with caution
        </p>
      </div>
    </div>
  );
}

export default ResetSetup;
