/**
 * Tenant Activation Screen
 * First screen shown when POS app is launched without an activated tenant
 */

import { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTenantStore } from '../stores/tenantStore';
import { SimpleRestaurantOnboarding } from '../components/SimpleRestaurantOnboarding';
import { clearDeviceRegistration, registerDevice } from '../services/tauriAuth';

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
    const savedCode = localStorage.getItem('pos_activation_code');
    if (savedCode) {
      console.log('[TenantActivation] Auto-filling activation code from provisioning');
      // Remove dashes if present (format: XXXX-XXXX-XXXX-XXXX)
      const normalizedCode = savedCode.replace(/-/g, '');
      setCodeSegments([
        normalizedCode.slice(0, 4),
        normalizedCode.slice(4, 8),
        normalizedCode.slice(8, 12),
        normalizedCode.slice(12, 16)
      ]);
      // Clear the saved code after using it
      localStorage.removeItem('pos_activation_code');
    } else {
      // Focus first input on mount if no saved code
      inputRefs[0].current?.focus();
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

  const handleSubmit = async () => {
    if (!isCodeComplete()) {
      setActivationError('Please enter the complete 16-character code');
      return;
    }

    try {
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
      const allLocalStorageKeys = Object.keys(localStorage);
      allLocalStorageKeys.forEach((key) => {
        // Skip tenant-storage (will be overwritten by activateTenant)
        if (key === 'tenant-storage') {
          console.log('[TenantActivation] Keeping tenant-storage (will be overwritten)');
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

      const code = `${codeSegments[0]}-${codeSegments[1]}-${codeSegments[2]}-${codeSegments[3]}`;
      const success = await activateTenant(code);

      if (success) {
        console.log('[TenantActivation] Activation successful, registering device');

        // Get the newly activated tenant info from the store
        const { tenant } = useTenantStore.getState();

        if (tenant) {
          // Register device with the new tenant
          try {
            const deviceName = `POS Terminal - ${new Date().toLocaleDateString()}`;
            await registerDevice(deviceName, tenant.tenantId, tenant.companyName);
            console.log('[TenantActivation] Device registered successfully');
          } catch (regError) {
            console.error('[TenantActivation] Failed to register device:', regError);
            // Don't block activation if device registration fails
          }
        }

        console.log('[TenantActivation] Navigating to hub');
        onActivated();
      }
    } catch (error) {
      console.error('[TenantActivation] Error during activation:', error);
      setActivationError('Failed to clear old data. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🍽️</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider mb-2">
            HandsFree POS
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your activation code to get started
          </p>
        </div>

        {/* Activation Form */}
        <div className="glass-panel rounded-2xl border border-border p-8">
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
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
                    className="w-24 h-14 text-center text-2xl font-mono font-bold uppercase bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    maxLength={4}
                    placeholder="XXXX"
                    disabled={isActivating}
                  />
                  {index < codeSegments.length - 1 && (
                    <span className="text-2xl text-muted-foreground font-bold">-</span>
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
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                  title="Copy activation code"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 text-sm font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground text-sm font-medium">Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error Message */}
            {activationError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                <p className="text-red-400 text-sm">{activationError}</p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isActivating || !isCodeComplete()}
            className="w-full py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3"
          >
            {isActivating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Activating...
              </>
            ) : (
              'Activate POS'
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-muted-foreground text-xs">
            Don't have an activation code?{' '}
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-accent hover:underline focus:outline-none"
            >
              Create a new restaurant
            </button>
          </p>
        </div>

        {/* Version */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground/50 text-xs">
            HandsFree POS v1.0.0
          </p>
        </div>
      </div>

      {/* Create Restaurant Onboarding */}
      {showCreateModal && (
        <SimpleRestaurantOnboarding
          onCancel={() => setShowCreateModal(false)}
          onComplete={(code: string) => {
            console.log('[TenantActivation] Restaurant created with activation code:', code);

            // Close the creation modal
            setShowCreateModal(false);

            // Pre-fill the activation code in the input fields
            const normalizedCode = code.replace(/-/g, '');
            setCodeSegments([
              normalizedCode.slice(0, 4),
              normalizedCode.slice(4, 8),
              normalizedCode.slice(8, 12),
              normalizedCode.slice(12, 16)
            ]);

            // Store the owner flag for use after activation
            localStorage.setItem('is_restaurant_owner', 'true');

            console.log('[TenantActivation] Code pre-filled. User can now copy and activate.');
          }}
        />
      )}
    </div>
  );
}

export default TenantActivation;
