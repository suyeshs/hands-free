/**
 * Subscription Settings - WASM Plugin Wrapper
 *
 * This is a lightweight wrapper that redirects to the subscription plugin's
 * WASM-based settings page. The actual settings UI is provided by the plugin.
 */

import { useEffect } from 'react';
import { Package } from 'lucide-react';

export default function SubscriptionSettings() {
  useEffect(() => {
    // Use hash change to navigate to subscription plans
    // This ensures the Settings panel overlay closes properly
    console.log('[SubscriptionSettings] Redirecting to /subscriptions/plans');
    window.location.hash = '/subscriptions/plans';
  }, []);

  // Show loading state while redirecting
  return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Package className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Loading Subscription Settings...
        </h2>
        <p className="text-sm text-muted-foreground">
          Redirecting to subscription plans management
        </p>
      </div>
    </div>
  );
}
