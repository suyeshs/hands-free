'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSetup } from '@/app/contexts/SetupContext';
import { useRestaurant } from '@/app/contexts/RestaurantContext';
import { activateRestaurant } from '@/app/lib/activate-restaurant';

/**
 * Activate Button Component
 * Main CTA that triggers restaurant provisioning
 */
export function ActivateButton() {
  const { setupState, canActivate } = useSetup();
  const { profile, refetch } = useRestaurant();
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!canActivate) return;

    setIsActivating(true);
    setError(null);

    try {
      const tenantId = profile?.tenantId || 'demo';
      console.log('[ActivateButton] Starting activation for tenant:', tenantId);

      // Call backend provisioning endpoint
      const result = await activateRestaurant(setupState, tenantId);

      if (!result.success) {
        throw new Error(result.message);
      }

      console.log('[ActivateButton] Activation successful!');

      // Wait a moment for backend to propagate
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Refetch profile to update context
      console.log('[ActivateButton] Refetching profile...');
      await refetch();

      // Force page refresh to update UI
      console.log('[ActivateButton] Refreshing page...');
      router.refresh();
    } catch (err) {
      console.error('[ActivateButton] Activation failed:', err);
      setError(
        err instanceof Error ? err.message : 'Activation failed. Please try again.'
      );
      setIsActivating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Activation Info */}
      <div className="neu-concave rounded-2xl p-6">
        <h3 className="text-xl font-bold text-neu-text mb-3">
          Ready to Activate
        </h3>
        <p className="text-sm text-neu-text-secondary mb-4">
          Click the button below to provision your restaurant. This will:
        </p>
        <ul className="space-y-2 mb-6">
          <li className="flex items-start gap-2 text-sm text-neu-text">
            <span className="text-lg">✓</span>
            <span>Create your restaurant profile in the system</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-neu-text">
            <span className="text-lg">✓</span>
            <span>Configure voice AI with your selected settings</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-neu-text">
            <span className="text-lg">✓</span>
            <span>Apply your chosen theme and branding</span>
          </li>
          {setupState.menuFile && (
            <li className="flex items-start gap-2 text-sm text-neu-text">
              <span className="text-lg">✓</span>
              <span>Process and import your menu items</span>
            </li>
          )}
        </ul>

        {/* Activate Button */}
        <button
          onClick={handleActivate}
          disabled={!canActivate || isActivating}
          className={`w-full py-4 rounded-xl text-lg font-bold transition-all ${
            !canActivate || isActivating
              ? 'neu-flat text-neu-text-secondary cursor-not-allowed'
              : 'neu-button-accent text-white hover:scale-105 hover:shadow-2xl'
          }`}
        >
          {isActivating ? (
            <span className="flex items-center justify-center gap-3">
              <span className="animate-spin text-2xl">⚙️</span>
              <span>Activating Your Restaurant...</span>
            </span>
          ) : !canActivate ? (
            <span>Complete Required Steps First</span>
          ) : (
            <span className="flex items-center justify-center gap-3">
              <span className="text-2xl">✅</span>
              <span>ACTIVATE RESTAURANT</span>
            </span>
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-sm text-red-700 font-medium">❌ {error}</p>
            <p className="text-xs text-red-600 mt-1">
              Please check your information and try again. If the problem persists,
              contact support.
            </p>
          </div>
        )}

        {/* Loading State Info */}
        {isActivating && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm text-blue-700 font-medium">
              ⏳ Setting up your restaurant...
            </p>
            <p className="text-xs text-blue-600 mt-1">
              This may take a few moments. Please don't close this page.
            </p>
          </div>
        )}
      </div>

      {/* Help Text */}
      {!canActivate && (
        <div className="neu-flat rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h5 className="font-semibold text-sm text-neu-text mb-1">
                Complete the Required Steps
              </h5>
              <p className="text-xs text-neu-text-secondary">
                Please fill in all required information in Steps 1-3 before activating.
                Look for the checkmarks (✓) to confirm each step is complete.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
