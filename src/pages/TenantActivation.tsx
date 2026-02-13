/**
 * Tenant Activation Screen
 * First screen shown when POS app is launched without an activated tenant
 */

import { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTenantStore } from '../stores/tenantStore';
import { SimpleRestaurantOnboarding } from '../components/SimpleRestaurantOnboarding';
import { clearDeviceRegistration } from '../services/tauriAuth';
import { useSetupWizardStore } from '../stores/setupWizardStore';
import { buildConfig } from '../config/buildConfig';

interface TenantActivationProps {
  onActivated: () => void;
}

export function TenantActivation({ onActivated }: TenantActivationProps) {
  const { activateTenant, isActivating, activationError, setActivationError } = useTenantStore();

  // 16 character code split into 4 groups of 4
  const [codeSegments, setCodeSegments] = useState(['', '', '', '']);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Auto-fill activation code from provisioning if available
  useEffect(() => {
    console.log('[TenantActivation] ===== COMPONENT MOUNTED =====');
    console.log('[TenantActivation] Checking for saved activation code...');

    const { activationCode, setActivationCode } = useSetupWizardStore.getState();

    console.log('[TenantActivation] activationCode from SQLite:', activationCode);

    if (activationCode) {
      console.log('[TenantActivation] Auto-filling activation code from SQLite');
      // Remove dashes if present (format: XXXX-XXXX-XXXX-XXXX)
      const normalizedCode = activationCode.replace(/-/g, '');
      console.log('[TenantActivation] Normalized code:', normalizedCode);
      console.log('[TenantActivation] Code length:', normalizedCode.length);

      setCodeSegments([
        normalizedCode.slice(0, 4),
        normalizedCode.slice(4, 8),
        normalizedCode.slice(8, 12),
        normalizedCode.slice(12, 16)
      ]);

      console.log('[TenantActivation] Code segments set:', [
        normalizedCode.slice(0, 4),
        normalizedCode.slice(4, 8),
        normalizedCode.slice(8, 12),
        normalizedCode.slice(12, 16)
      ]);

      // Clear the saved code after using it
      setActivationCode(null);
      console.log('[TenantActivation] Cleared activationCode from SQLite');
    } else {
      console.log('[TenantActivation] No saved code found, focusing first input');
      // Focus first input on mount if no saved code
      inputRefs[0].current?.focus();
    }

    // Staff build: Auto-show activation code input (skip welcome screen)
    if (buildConfig.isStaffBuild) {
      console.log('[TenantActivation] Staff build detected - auto-showing activation code input');
      setShowActivationCode(true);
    }
  }, []);

  const handleInputChange = (index: number, value: string) => {
    // Only allow alphanumeric characters
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

    const newSegments = [...codeSegments];
    newSegments[index] = sanitized;
    setCodeSegments(newSegments);
    setActivationError(null);

    // Auto-focus next input when current is full
    if (sanitized.length === 4 && index < inputRefs.length - 1) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to previous input on backspace if current is empty
    if (e.key === 'Backspace' && codeSegments[index] === '' && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    // Submit on Enter if code is complete
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (pasted.length >= 16) {
      setCodeSegments([
        pasted.slice(0, 4),
        pasted.slice(4, 8),
        pasted.slice(8, 12),
        pasted.slice(12, 16)
      ]);
      inputRefs[3].current?.focus();
    } else if (pasted.length >= 12) {
      setCodeSegments([
        pasted.slice(0, 4),
        pasted.slice(4, 8),
        pasted.slice(8, 12),
        pasted.slice(12, 16) || ''
      ]);
      inputRefs[3].current?.focus();
    } else if (pasted.length >= 8) {
      setCodeSegments([
        pasted.slice(0, 4),
        pasted.slice(4, 8),
        pasted.slice(8, 12) || '',
        ''
      ]);
      inputRefs[2].current?.focus();
    } else if (pasted.length >= 4) {
      setCodeSegments([
        pasted.slice(0, 4),
        pasted.slice(4, 8) || '',
        '',
        ''
      ]);
      inputRefs[1].current?.focus();
    } else {
      setCodeSegments([pasted, '', '', '']);
    }
    setActivationError(null);
  };

  const getFullCode = () => codeSegments.join('');
  const isCodeComplete = () => getFullCode().length === 16;

  // Copy activation code to clipboard
  const copyToClipboard = async () => {
    const fullCode = codeSegments.join('-');
    if (!fullCode || fullCode.replace(/-/g, '').length === 0) return;

    try {
      await navigator.clipboard.writeText(fullCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSubmit = async (providedCode?: string) => {
    console.log('[TenantActivation] ===== HANDLE SUBMIT CALLED =====');
    console.log('[TenantActivation] Button clicked at:', new Date().toISOString());
    console.log('[TenantActivation] Provided code:', providedCode);
    console.log('[TenantActivation] Code segments:', codeSegments);
    console.log('[TenantActivation] Is code complete:', isCodeComplete());
    console.log('[TenantActivation] Full code:', getFullCode());

    // Use provided code if available, otherwise use code segments
    const codeToActivate = providedCode || getFullCode();

    if (!providedCode && !isCodeComplete()) {
      console.log('[TenantActivation] Code incomplete, showing error');
      setActivationError('Please enter the complete 16-character code');
      return;
    }

    if (codeToActivate.length !== 16) {
      console.log('[TenantActivation] Invalid code length:', codeToActivate.length);
      setActivationError('Please enter a valid 16-character code');
      return;
    }

    try {
      // Log is_restaurant_owner flag BEFORE clearing anything
      console.log('[TenantActivation] ===== PRE-ACTIVATION STATE =====');
      const isOwnerBeforeClear = useSetupWizardStore.getState().isRestaurantOwner;
      console.log('[TenantActivation] is_restaurant_owner BEFORE clear:', isOwnerBeforeClear);

      // Clear ALL tenant-related data before activating new tenant
      console.log('[TenantActivation] Clearing ALL old tenant data before activation');

      // CRITICAL: Clear device registration first (this clears Tauri's device storage)
      console.log('[TenantActivation] Clearing device registration...');
      await clearDeviceRegistration();
      console.log('[TenantActivation] Device registration cleared');

      // Clear specific known keys
      const keysToRemove = [
        'auth-storage',
        'restaurant-settings',
        'staff-storage',
        'menu-storage',
        'orders-storage',
        'tables-storage',
        'floor-plan-storage',
        'provisioning-storage',
        'tenant-storage',
      ];

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      // Clear all Zustand persisted stores related to tenant data
      // EXCEPT tenant-storage itself (will be overwritten by new activation)
      // AND setup-wizard-storage (needed for saving settings after activation)
      const allLocalStorageKeys = Object.keys(localStorage);
      allLocalStorageKeys.forEach((key) => {
        // Skip tenant-storage (will be overwritten by activateTenant)
        if (key === 'tenant-storage') {
          console.log('[TenantActivation] Keeping tenant-storage (will be overwritten)');
          return;
        }

        // Skip setup-wizard-storage (needed for saving settings after activation)
        if (key.includes('setup') || key.includes('wizard')) {
          console.log('[TenantActivation] Keeping setup wizard data:', key);
          return;
        }

        // Clear any stores that contain auth, staff, menu, or other tenant data
        if (
          key.includes('auth') ||
          key.includes('staff') ||
          key.includes('menu') ||
          key.includes('order') ||
          key.includes('table') ||
          key.includes('restaurant')
        ) {
          console.log('[TenantActivation] Removing persisted store:', key);
          localStorage.removeItem(key);
        }
      });

      console.log('[TenantActivation] All old data cleared, activating new tenant');
      const isOwnerAfterClear = useSetupWizardStore.getState().isRestaurantOwner;
      console.log('[TenantActivation] is_restaurant_owner AFTER clear:', isOwnerAfterClear);

      // Format code with dashes if not already formatted
      const formattedCode = codeToActivate.includes('-')
        ? codeToActivate
        : `${codeToActivate.slice(0, 4)}-${codeToActivate.slice(4, 8)}-${codeToActivate.slice(8, 12)}-${codeToActivate.slice(12, 16)}`;

      console.log('[TenantActivation] Calling activateTenant with code:', formattedCode);
      const success = await activateTenant(formattedCode);
      console.log('[TenantActivation] activateTenant returned success:', success);

      if (success) {
        console.log('[TenantActivation] ✅ Activation successful');
        console.log('[TenantActivation] Checking activation state...');

        // Verify tenant was saved
        const { tenant: savedTenant, isActivated } = useTenantStore.getState();
        console.log('[TenantActivation] isActivated:', isActivated);
        console.log('[TenantActivation] tenant object:', savedTenant ? 'exists' : 'null');
        console.log('[TenantActivation] tenant ID:', savedTenant?.tenantId);

        if (!savedTenant || !isActivated) {
          console.error('[TenantActivation] ❌ Activation succeeded but tenant not in store!');
          setActivationError('Activation failed to save tenant data. Please try again.');
          return;
        }

        // STEP: AUTOMATIC MENU SYNC (for location tenants)
        // Check if this is a location tenant with a master tenant
        const { tenant } = useTenantStore.getState();
        const masterTenantId = (tenant as any)?.masterTenantId;

        if (masterTenantId) {
          console.log('[TenantActivation] ===== AUTOMATIC MENU SYNC =====');
          console.log('[TenantActivation] Master tenant ID detected:', masterTenantId);
          console.log('[TenantActivation] This is a location tenant - fetching master menu...');

          try {
            // Import invoke dynamically to avoid errors in non-Tauri environments
            const { invoke } = await import('@tauri-apps/api/core');

            console.log('[TenantActivation] Calling fetch_and_load_master_menu...');

            const itemCount = await invoke<number>('fetch_and_load_master_menu', {
              masterTenantId,
            });

            console.log(`[TenantActivation] ✅ Menu sync complete: ${itemCount} items loaded`);

            // Brief visual feedback (could add toast here)
            sessionStorage.setItem('menu-synced', 'true');
            sessionStorage.setItem('menu-item-count', itemCount.toString());

          } catch (menuError) {
            console.error('[TenantActivation] ❌ Menu sync failed:', menuError);
            // Don't fail activation if menu sync fails
            // Menu can be manually synced later
            sessionStorage.setItem('menu-sync-failed', 'true');
          }
        } else {
          console.log('[TenantActivation] No master tenant ID - this is a master tenant (menu will be created from scratch)');
        }

        // Store flags for post-activation processing (will happen after reload)
        const isNewRestaurant = useSetupWizardStore.getState().isRestaurantOwner;

        console.log('[TenantActivation] ===== POST-ACTIVATION PROCESSING =====');
        console.log('[TenantActivation] is_restaurant_owner flag:', isNewRestaurant);
        console.log('[TenantActivation] isNewRestaurant:', isNewRestaurant);

        if (isNewRestaurant) {
          console.log('[TenantActivation] NEW restaurant - verifying settings were saved during provisioning');

          try {
            // Settings should already be saved by SystemCheckScreen after provisioning
            // Just verify they exist
            const { getRestaurantSettings } = await import('../services/tauriSettings');
            const savedSettings = await getRestaurantSettings();

            console.log('[TenantActivation] Verifying saved settings:', JSON.stringify(savedSettings, null, 2));

            if (!savedSettings.name || savedSettings.name === 'Restaurant Name') {
              console.warn('[TenantActivation] ⚠️  Settings not found or show defaults - may need to save from wizard data');

              // Fallback: Save from wizard data if not already saved
              const { useSetupWizardStore } = await import('../stores/setupWizardStore');
              const { useRestaurantSettingsStore } = await import('../stores/restaurantSettingsStore');
              const wizardState = useSetupWizardStore.getState();
              const restaurantSettingsStore = useRestaurantSettingsStore.getState();

              if (wizardState.wizardData.restaurantInfo) {
                const settings: any = {
                  name: wizardState.wizardData.restaurantInfo.name,
                  tagline: wizardState.wizardData.restaurantInfo.tagline || '',
                  address: wizardState.wizardData.restaurantInfo.address || { line1: '', line2: '', city: '', state: '', pincode: '' },
                  phone: wizardState.wizardData.restaurantInfo.phone || '',
                  email: wizardState.wizardData.restaurantInfo.email || '',
                  website: wizardState.wizardData.restaurantInfo.website || '',
                };

                if (wizardState.wizardData.legalInfo) {
                  settings.gstNumber = wizardState.wizardData.legalInfo.gstNumber || '';
                  settings.fssaiNumber = wizardState.wizardData.legalInfo.fssaiNumber || '';
                  settings.panNumber = wizardState.wizardData.legalInfo.panNumber || '';
                  settings.cinNumber = wizardState.wizardData.legalInfo.cinNumber || '';
                }

                if (wizardState.wizardData.taxSettings) {
                  settings.taxEnabled = wizardState.wizardData.taxSettings.mode === 'gst';
                  settings.cgstRate = wizardState.wizardData.taxSettings.cgstRate || 2.5;
                  settings.sgstRate = wizardState.wizardData.taxSettings.sgstRate || 2.5;
                  settings.serviceChargeEnabled = wizardState.wizardData.taxSettings.serviceChargeEnabled || false;
                  settings.serviceChargeRate = wizardState.wizardData.taxSettings.serviceChargeRate || 0;
                  settings.taxIncludedInPrice = wizardState.wizardData.taxSettings.taxIncludedInPrice || false;
                }

                console.log('[TenantActivation] Saving settings as fallback...');
                await restaurantSettingsStore.updateSettings(settings);
                console.log('[TenantActivation] ✅ Fallback save completed');
              }
            } else {
              console.log('[TenantActivation] ✅ Settings already saved, restaurant name:', savedSettings.name);
            }

            // Ensure wizard is marked complete
            const { useSetupWizardStore } = await import('../stores/setupWizardStore');
            const wizardState = useSetupWizardStore.getState();
            if (!wizardState.isComplete) {
              console.log('[TenantActivation] Marking wizard as complete...');
              useSetupWizardStore.setState({
                isComplete: true,
                completedAt: new Date().toISOString(),
              });
              console.log('[TenantActivation] ✅ Wizard marked as complete');
            }

          } catch (error: any) {
            console.error('[TenantActivation] ❌ Error verifying settings:', error);
            // Don't block activation
          }

          // Set flags for cloud push after reload (this can be async)
          sessionStorage.setItem('activation-just-completed', 'true'); // Skip auto-reset check on reload (for setupWizardStore)
          sessionStorage.setItem('setup-just-completed', 'true'); // Skip auto-reset check on reload (for App.tsx)
          sessionStorage.setItem('activation-needs-cloud-push', 'true');
          sessionStorage.setItem('skip-initial-sync', 'true');
          sessionStorage.setItem('translations-needed', 'true'); // Trigger translation generation for multi-language support
        }

        // Device registration is now handled manually in Settings → Hardware & Printing → Device Registration
        // Users can optionally register their device after provisioning to enable multi-device features

        console.log('[TenantActivation] Navigating to hub - setup completion and cloud sync will happen after reload');
        onActivated();
      } else {
        // Activation failed
        console.error('[TenantActivation] ❌ Activation returned false');
        console.error('[TenantActivation] Activation error:', useTenantStore.getState().activationError);
        // Error is already set in tenantStore and displayed in UI
      }
    } catch (error) {
      console.error('[TenantActivation] ❌ Exception during activation:', error);
      setActivationError('Failed to clear old data. Please try again.');
    }
  };

  // State to toggle between welcome screen and activation code entry
  const [showActivationCode, setShowActivationCode] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-neutral-900 to-stone-900 flex flex-col items-center justify-center p-6">
      {/* Debug Overlay Access Button - Always visible */}
      <button
        onClick={() => {
          localStorage.setItem('show-diagnostic', 'true');
          window.location.reload();
        }}
        className="fixed top-4 right-4 z-50 px-3 py-2 text-xs bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg transition-colors backdrop-blur-sm"
        title="Open Diagnostic Mode (Cmd/Ctrl+Shift+D)"
      >
        🔍 Debug
      </button>

      {!showActivationCode && !showCreateModal ? (
        // Welcome Screen - Primary focus on new restaurant setup
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
            {/* Logo/Branding */}
            <div className="text-center mb-8">
              <div className="w-32 h-32 mx-auto mb-6">
                <img
                  src="/handsfree-logo.svg"
                  alt="Guanix"
                  className="w-full h-full object-contain drop-shadow-lg"
                  onError={(e) => {
                    // Fallback to emoji if logo not found
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<span class="text-5xl">🍽️</span>';
                  }}
                />
              </div>
              <h1 className="text-3xl font-bold text-orange-500 mb-3">
                {buildConfig.isStaffBuild ? 'Welcome, Team Member!' : 'Guanix Restaurant OS'}
              </h1>
              <p className="text-zinc-300 text-base leading-relaxed">
                {buildConfig.isStaffBuild
                  ? "Enter your restaurant's activation code to join the team"
                  : 'Modern restaurant operations platform'}
              </p>
            </div>

            {/* Primary Action - Setup Restaurant (Owner only) */}
            <div className="space-y-4">
              {!buildConfig.isStaffBuild && (
                <>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full py-4 rounded-lg bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-bold text-lg shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    <span className="text-2xl">✨</span>
                    <span>Setup New Restaurant</span>
                  </button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-black/40 px-3 text-zinc-500 font-medium">or</span>
                    </div>
                  </div>
                </>
              )}

              {/* Activation Code Entry - Primary for Staff, Secondary for Owner */}
              <button
                onClick={() => setShowActivationCode(true)}
                className={buildConfig.isStaffBuild
                  ? "w-full py-4 rounded-lg bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-bold text-lg shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3"
                  : "w-full py-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-zinc-300 font-medium hover:bg-white/[0.08] hover:border-orange-500/50 transition-all"}
              >
                {buildConfig.isStaffBuild ? 'Enter Activation Code' : 'I have an activation code'}
              </button>
            </div>

            {/* Info Section */}
            {!buildConfig.isStaffBuild && (
              <div className="mt-8 p-4 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Getting Started</h3>
                <ul className="text-xs text-zinc-400 space-y-1">
                  <li>• New restaurants: Click "Setup New Restaurant"</li>
                  <li>• Existing users: Enter your activation code</li>
                  <li>• Get started in under 5 minutes</li>
                </ul>
              </div>
            )}
          </div>

          {/* Version */}
          <div className="mt-6 text-center">
            <p className="text-zinc-500 text-xs">
              Powered by Gaunix
            </p>
          </div>
        </div>
      ) : showActivationCode ? (
        // Activation Code Entry Screen (for existing users)
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
            {/* Back Button */}
            <button
              type="button"
              onClick={() => {
                setShowActivationCode(false);
                setCodeSegments(['', '', '', '']);
                setActivationError(null);
              }}
              className="mb-6 flex items-center gap-2 text-zinc-400 hover:text-orange-500 transition-colors group"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-orange-500 mb-2">
                Enter Activation Code
              </h1>
              <p className="text-zinc-300 text-sm">
                Enter the 16-character code you received
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-200 mb-3">
                Activation Code
              </label>

              {/* Code Input */}
              <div className="flex items-center justify-center gap-3">
                {codeSegments.map((segment, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      ref={inputRefs[index]}
                      type="text"
                      value={segment}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      className="w-20 h-14 text-center text-xl font-mono font-bold uppercase bg-white/[0.03] border border-white/[0.08] rounded-lg focus:outline-none focus:border-orange-500 focus:shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all text-white placeholder:text-zinc-600"
                      maxLength={4}
                      placeholder="XXXX"
                      disabled={isActivating}
                    />
                    {index < codeSegments.length - 1 && (
                      <span className="text-xl text-zinc-500 font-bold">-</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Copy Button */}
              {getFullCode().length > 0 && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={copyToClipboard}
                    disabled={isActivating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] transition-all disabled:opacity-50 text-zinc-300"
                    title="Copy activation code"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="text-sm font-medium">Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Error Message */}
              {activationError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                  <p className="text-red-400 text-sm">{activationError}</p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={(e) => {
                console.log('[TenantActivation] ===== BUTTON CLICKED =====');
                console.log('[TenantActivation] Event:', e.type);
                console.log('[TenantActivation] isActivating:', isActivating);
                console.log('[TenantActivation] isCodeComplete:', isCodeComplete());
                console.log('[TenantActivation] Calling handleSubmit...');
                handleSubmit();
              }}
              disabled={isActivating || !isCodeComplete()}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-medium shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-300 flex items-center justify-center gap-3"
            >
              {isActivating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Activating...
                </>
              ) : (
                'Activate Restaurant'
              )}
            </button>
          </div>

          {/* Version */}
          <div className="mt-6 text-center">
            <p className="text-zinc-500 text-xs">
              Guanix Restaurant OS v3.1.4
            </p>
          </div>
        </div>
      ) : null}

      {/* Create Restaurant Onboarding */}
      {showCreateModal && (
        <SimpleRestaurantOnboarding
          onCancel={() => setShowCreateModal(false)}
          onComplete={async (code: string) => {
            console.log('[TenantActivation] Restaurant created with activation code:', code);
            console.log('[TenantActivation] Code length:', code?.length);
            console.log('[TenantActivation] Code type:', typeof code);

            // Validate code before proceeding
            if (!code || code.length === 0) {
              console.error('[TenantActivation] ERROR: No activation code received!');
              setShowCreateModal(false);
              setActivationError('No activation code received. Please try again.');
              return;
            }

            // Close the creation modal
            setShowCreateModal(false);

            // Normalize the code (remove dashes)
            const normalizedCode = code.replace(/-/g, '');
            console.log('[TenantActivation] Normalized code:', normalizedCode);
            console.log('[TenantActivation] Normalized code length:', normalizedCode.length);

            // Pre-fill the activation code in the input fields
            setCodeSegments([
              normalizedCode.slice(0, 4),
              normalizedCode.slice(4, 8),
              normalizedCode.slice(8, 12),
              normalizedCode.slice(12, 16)
            ]);

            // Store the owner flag in SQLite for use after activation
            await useSetupWizardStore.getState().setIsRestaurantOwner(true);
            console.log('[TenantActivation] ✅ Owner flag saved to SQLite');

            console.log('[TenantActivation] Auto-activating with code:', normalizedCode);

            // Auto-trigger activation after delay to ensure all state is persisted
            // Pass the code as parameter to avoid state race condition
            setTimeout(() => {
              console.log('[TenantActivation] Calling handleSubmit with code:', normalizedCode);
              handleSubmit(normalizedCode);
            }, 300); // Increased from 100ms to 300ms
          }}
        />
      )}
    </div>
  );
}

export default TenantActivation;
