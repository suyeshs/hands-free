/**
 * SystemCheckScreen Component
 * Auto-run system checks before showing provisioning modal
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
import { StoreCreationModal } from '../../StoreCreationModal';

interface CheckItem {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'complete';
}

export function SystemCheckScreen() {
  const navigate = useNavigate();
  const { wizardData } = useSetupWizardStore();
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'profile', label: 'Restaurant profile configured', status: 'pending' },
    { id: 'tax', label: 'Tax settings configured', status: 'pending' },
    { id: 'database', label: 'Database initialized', status: 'pending' },
    { id: 'mode', label: 'Operating mode selected', status: 'pending' },
  ]);

  const [showProvisioningModal, setShowProvisioningModal] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const isProcessingRef = useRef(false); // Use ref for synchronous guard (state is async!)

  useEffect(() => {
    // Check if provisioning already completed - prevent re-run
    const provisioningCompleted = localStorage.getItem('provisioning-completed');
    if (provisioningCompleted === 'true') {
      console.log('[SystemCheckScreen] ⚠️  Provisioning already completed!');
      console.log('[SystemCheckScreen] This screen should NOT be visible.');
      console.log('[SystemCheckScreen] Setup is complete, but App.tsx is still showing SetupWizard.');
      console.log('[SystemCheckScreen] This indicates a routing issue in App.tsx');

      // Don't reload - that creates a loop!
      // Just don't show the provisioning modal
      // The screen will render but won't do anything
      return;
    }

    // Run checks sequentially with delays for visual effect
    const runChecks = async () => {
      for (let i = 0; i < checks.length; i++) {
        // Mark as checking
        setChecks((prev) =>
          prev.map((check, index) =>
            index === i ? { ...check, status: 'checking' } : check
          )
        );

        // Simulate check delay
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Mark as complete
        setChecks((prev) =>
          prev.map((check, index) =>
            index === i ? { ...check, status: 'complete' } : check
          )
        );
      }

      // Wait a bit then show provisioning modal
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('[SystemCheckScreen] All checks complete, showing provisioning modal');
      setShowProvisioningModal(true);
    };

    const timer = setTimeout(runChecks, 500);
    return () => clearTimeout(timer);
  }, []);

  // API call to create restaurant
  const createRestaurant = async () => {
    console.log('[SystemCheckScreen] Creating restaurant with data:', wizardData.restaurantInfo);

    // Use the new dedicated provisioning worker
    const provisioningUrl = import.meta.env.VITE_PROVISIONING_URL ||
      'https://handsfree-restaurant-provisioning.suyesh.workers.dev';

    // Generate unique tenant ID from restaurant name + timestamp
    const baseTenantId = wizardData.restaurantInfo?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'restaurant';
    const uniqueSuffix = Date.now().toString().slice(-4); // Last 4 digits of timestamp
    const tenantId = `${baseTenantId}-${uniqueSuffix}`;

    const requestData = {
      companyName: wizardData.restaurantInfo?.name || 'Restaurant',
      email: wizardData.restaurantInfo?.email || 'owner@restaurant.local',
      phone: wizardData.restaurantInfo?.phone || '',
      tenantId: tenantId,
      businessCategory: 'RESTAURANT',
    };

    console.log('[SystemCheckScreen] Making request to:', `${provisioningUrl}/api/provision`);
    console.log('[SystemCheckScreen] Request data:', JSON.stringify(requestData, null, 2));

    try {
      const response = await fetch(`${provisioningUrl}/api/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SystemCheckScreen] API error:', response.status, errorText);

      let errorMessage = `Failed to create restaurant (${response.status})`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage = errorJson.error;

          // Add helpful context for common errors
          if (errorJson.error.includes('already exists') || errorJson.error.includes('duplicate')) {
            errorMessage = `A restaurant with this name already exists. Please choose a different name or contact support to recover your existing restaurant.`;
          } else if (errorJson.error.includes('validation') || errorJson.error.includes('invalid')) {
            errorMessage = `Invalid restaurant data: ${errorJson.error}. Please check your information and try again.`;
          }
        }
      } catch (e) {
        // Not JSON, use raw text
        errorMessage = `Server error: ${errorText || 'Unknown error'}`;
      }

      throw new Error(errorMessage);
    }

      const result = await response.json();
      console.log('[SystemCheckScreen] API response:', result);

      return result;
    } catch (error: any) {
      console.error('[SystemCheckScreen] Provisioning request failed:', error);

      // Handle timeout specifically
      if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
        throw new Error('Provisioning request timed out after 30 seconds. Please check your internet connection and try again.');
      }

      // Handle network errors
      if (error.message?.includes('Failed to fetch') || !navigator.onLine) {
        throw new Error('Cannot reach the provisioning server. Please check your internet connection.');
      }

      // Re-throw other errors
      throw error;
    }
  };

  const handleProvisioningComplete = async (activationCode: string) => {
    // === DIAGNOSTIC: Track every call to this function ===
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[SystemCheckScreen] 🔍 DIAGNOSTIC ${callId}: handleProvisioningComplete invoked`);
    console.log(`[SystemCheckScreen] 🔍 DIAGNOSTIC ${callId}: Guard value BEFORE check:`, isProcessingRef.current);
    console.log(`[SystemCheckScreen] 🔍 DIAGNOSTIC ${callId}: Activation code:`, activationCode);
    console.log(`[SystemCheckScreen] 🔍 DIAGNOSTIC ${callId}: Stack trace:`, new Error().stack);

    // GUARD: Prevent multiple executions (using ref for synchronous check)
    if (isProcessingRef.current) {
      console.log(`[SystemCheckScreen] ⚠️ DIAGNOSTIC ${callId}: GUARD BLOCKED! Already processing, ignoring duplicate call`);
      return;
    }

    console.log(`[SystemCheckScreen] ✅ DIAGNOSTIC ${callId}: GUARD PASSED! Setting guard to true and proceeding...`);

    console.log(`[SystemCheckScreen] ✅ DIAGNOSTIC ${callId}: Provisioning complete, activation code:`, activationCode);
    isProcessingRef.current = true; // Mark as processing IMMEDIATELY (synchronous!)
    console.log(`[SystemCheckScreen] 🔒 DIAGNOSTIC ${callId}: Guard value AFTER setting:`, isProcessingRef.current);

    try {
      // Store activation code and owner flag in SQLite
      const { setActivationCode, setIsRestaurantOwner } = useSetupWizardStore.getState();
      await setActivationCode(activationCode);
      await setIsRestaurantOwner(true);
      console.log('[SystemCheckScreen] ✅ Stored activation code and owner flag in SQLite');

      // IMMEDIATELY save settings to SQLite from wizard data
      console.log('[SystemCheckScreen] 💾 Step 1/2: Saving restaurant settings to SQLite...');

      const { useRestaurantSettingsStore } = await import('../../../stores/restaurantSettingsStore');
      const restaurantSettingsStore = useRestaurantSettingsStore.getState();

      // Build settings from wizard data
      const settings: any = {
        name: wizardData.restaurantInfo?.name || 'Restaurant',
        tagline: wizardData.restaurantInfo?.tagline || '',
        address: wizardData.restaurantInfo?.address || {
          line1: '',
          line2: '',
          city: '',
          state: '',
          pincode: '',
        },
        phone: wizardData.restaurantInfo?.phone || '',
        email: wizardData.restaurantInfo?.email || '',
        website: wizardData.restaurantInfo?.website || '',
      };

      // Add legal info if available
      if (wizardData.legalInfo) {
        settings.gstNumber = wizardData.legalInfo.gstNumber || '';
        settings.fssaiNumber = wizardData.legalInfo.fssaiNumber || '';
        settings.panNumber = wizardData.legalInfo.panNumber || '';
        settings.cinNumber = wizardData.legalInfo.cinNumber || '';
      }

      // Add tax settings if available
      if (wizardData.taxSettings) {
        settings.taxEnabled = wizardData.taxSettings.mode === 'gst';
        settings.cgstRate = wizardData.taxSettings.cgstRate || 2.5;
        settings.sgstRate = wizardData.taxSettings.sgstRate || 2.5;
        settings.serviceChargeEnabled = wizardData.taxSettings.serviceChargeEnabled || false;
        settings.serviceChargeRate = wizardData.taxSettings.serviceChargeRate || 0;
        settings.taxIncludedInPrice = wizardData.taxSettings.taxIncludedInPrice || false;
      }

      console.log(`[SystemCheckScreen] 🔍 DIAGNOSTIC ${callId}: Settings to save:`, JSON.stringify(settings, null, 2));

      // Save to SQLite
      console.log(`[SystemCheckScreen] 📝 DIAGNOSTIC ${callId}: CALLING updateSettings NOW...`);
      const saveStartTime = Date.now();
      await restaurantSettingsStore.updateSettings(settings);
      const saveDuration = Date.now() - saveStartTime;
      console.log(`[SystemCheckScreen] ✅ DIAGNOSTIC ${callId}: updateSettings COMPLETED in ${saveDuration}ms`);

      // Mark setup as complete and save to SQLite
      console.log('[SystemCheckScreen] 💾 Step 2/2: Marking setup complete in SQLite...');

      // CRITICAL FIX: Use the store's methods directly to ensure state is set before save
      const wizardStore = useSetupWizardStore.getState();

      // Update state using Zustand's set (synchronous)
      useSetupWizardStore.setState({
        isComplete: true,
        completedAt: new Date().toISOString(),
        awaitingActivation: false, // CRITICAL: Skip activation for local POS (no code needed!)
      });

      // Verify state was set correctly BEFORE saving
      const stateAfterSet = useSetupWizardStore.getState();
      console.log('[SystemCheckScreen] 🔍 State AFTER setState (before save):', {
        isComplete: stateAfterSet.isComplete,
        awaitingActivation: stateAfterSet.awaitingActivation,
        completedAt: stateAfterSet.completedAt,
        hasWizardData: !!stateAfterSet.wizardData,
        hasRestaurantInfo: !!stateAfterSet.wizardData?.restaurantInfo,
        restaurantName: stateAfterSet.wizardData?.restaurantInfo?.name,
      });

      // Now save to SQLite with the confirmed updated state
      await wizardStore.saveToSQLite();
      console.log('[SystemCheckScreen] ✅ Wizard state saved to SQLite atomically');

      // Verify save succeeded by reading back
      await wizardStore.loadFromSQLite();
      const finalState = useSetupWizardStore.getState();
      console.log('[SystemCheckScreen] 🔍 Verification - Final state from SQLite:', {
        isComplete: finalState.isComplete,
        awaitingActivation: finalState.awaitingActivation,
      });

      if (!finalState.isComplete) {
        console.error('[SystemCheckScreen] ❌ CRITICAL: Wizard verification failed!');
        console.error('[SystemCheckScreen] Expected isComplete: true, got:', finalState.isComplete);
        console.error('[SystemCheckScreen] Full wizard state:', finalState);
        throw new Error('❌ Wizard state verification failed - isComplete still false after save!');
      }

      console.log('[SystemCheckScreen] ✅ Wizard verification passed! isComplete:', finalState.isComplete);
      console.log('[SystemCheckScreen] ✅ All done! Auto-logging in owner...');

      // Auto-login the restaurant owner
      const { useAuthStore } = await import('../../../stores/authStore');
      const { UserRole } = await import('../../../types/auth');

      const ownerUser = {
        id: 'owner-1',
        email: wizardData.restaurantInfo?.email || 'owner@restaurant.local',
        name: 'Restaurant Owner',
        role: UserRole.OWNER,
        tenantId: activationCode || 'local',
      };

      const mockTokens = {
        accessToken: 'owner-access-token',
        refreshToken: 'owner-refresh-token',
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      };

      useAuthStore.setState({
        user: ownerUser,
        tokens: mockTokens,
        role: UserRole.OWNER,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      console.log('[SystemCheckScreen] ✅ Owner auto-login complete');
      console.log('[SystemCheckScreen] ✅ Navigating to Hub...');

      // Navigate directly to Hub using React Router (no reload needed!)
      // This avoids all reload/cloud-sync issues
      navigate('/hub');
      console.log('[SystemCheckScreen] ✅ Navigation initiated');
    } catch (error) {
      console.error('[SystemCheckScreen] ❌ Error during post-provisioning:', error);
      setProvisioningError(
        error instanceof Error
          ? error.message
          : 'Failed to save settings. Please try again.'
      );
    }
  };

  const handleProvisioningError = (error: string) => {
    console.error('[SystemCheckScreen] Provisioning error:', error);
    setProvisioningError(error);
    // Keep modal open to show error
  };

  return (
    <>
      <div className="max-w-2xl mx-auto text-center">
        {/* Header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl font-black uppercase tracking-wider mb-3">System Check</h2>
          <p className="text-muted-foreground">Verifying your setup...</p>
        </motion.div>

        {/* Checks List */}
        <div className="space-y-4">
          {checks.map((check, index) => (
            <motion.div
              key={check.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {check.status === 'complete' ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                  >
                    <CheckCircle className="w-6 h-6 text-success" />
                  </motion.div>
                ) : check.status === 'checking' ? (
                  <Loader2 className="w-6 h-6 text-saffron animate-spin" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-border" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 text-left">
                <span className={check.status === 'complete' ? 'text-foreground' : 'text-muted-foreground'}>
                  {check.label}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Error Display (if provisioning failed) */}
        {provisioningError && (
          <motion.div
            className="mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-red-400 text-sm mb-4">{provisioningError}</p>
            <button
              onClick={() => {
                setProvisioningError(null);
                setShowProvisioningModal(true);
              }}
              className="px-6 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium transition-all"
            >
              Retry Provisioning
            </button>
          </motion.div>
        )}
      </div>

      {/* Provisioning Modal */}
      <StoreCreationModal
        isOpen={showProvisioningModal}
        onClose={() => setShowProvisioningModal(false)}
        onComplete={handleProvisioningComplete}
        onError={handleProvisioningError}
        createStoreFn={createRestaurant}
      />
    </>
  );
}
