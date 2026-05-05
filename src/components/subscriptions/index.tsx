/**
 * Subscription Plugin - Main Entry Point
 *
 * This file serves as the entry point for the subscription meals plugin.
 * It exports all subscription components and integrates with the coorg-subscription theme.
 *
 * Theme: coorg-subscription (voice features disabled)
 * Location: /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/theme-edge-worker/src/multimodal-restaurant/presets/coorg-subscription.ts
 */

// Export all subscription components
export { SubscriptionDashboard } from './SubscriptionDashboard';
export { SubscriptionMenuManager } from './SubscriptionMenuManager';
export { SubscriptionMenuImporter } from './SubscriptionMenuImporter';
export { SubscriptionSyncTester } from './SubscriptionSyncTester';
export { SubscriptionKDS } from './SubscriptionKDS';
export { SubscriptionPlans } from './SubscriptionPlans';
export { PlanFormPage } from './PlanFormPage';
export { SubscriptionChangelog } from './SubscriptionChangelog';

// Component registry for the plugin system
export const SUBSCRIPTION_COMPONENTS = {
  SubscriptionDashboard: 'SubscriptionDashboard',
  SubscriptionPlans: 'SubscriptionPlans',
  SubscriptionMenuManager: 'SubscriptionMenuManager',
  SubscriptionMenuImporter: 'SubscriptionMenuImporter',
  SubscriptionKDS: 'SubscriptionKDS',
  // Additional components referenced in manifest but not yet implemented
  SubscriptionCustomers: 'SubscriptionCustomers',
  DeliverySchedule: 'DeliverySchedule',
  CustomerSubscriptionBrowser: 'CustomerSubscriptionBrowser',
  CustomerPortal: 'CustomerPortal',
  ParcelDispatchScreen: 'ParcelDispatchScreen',
} as const;

// Theme configuration
export const SUBSCRIPTION_THEME_CONFIG = {
  themeId: 'coorg-subscription',
  themePath: '/handsfree-restaurant-new/platform/workers/theme-edge-worker/src/multimodal-restaurant/presets/coorg-subscription.ts',
  features: {
    voice: false, // Voice features disabled in theme
    subscriptionMenu: true,
    weeklyRotation: true,
    deliveryScheduling: true,
    towerBasedRouting: true,
  },
};

// Plugin metadata
export const SUBSCRIPTION_PLUGIN_METADATA = {
  id: 'subscription-meals',
  name: 'Weekly Subscription Meals',
  version: '1.0.0',
  description: 'Weekly meal subscription service with rotating menus and delivery scheduling',
  icon: '📦',
  category: 'Operations',
  author: 'Guanix Team',
};

/**
 * Plugin initialization function
 * Called when the plugin is loaded by the plugin manager
 */
export function initializeSubscriptionPlugin() {
  console.log('[Subscription Plugin] Initializing subscription meals plugin...');
  console.log('[Subscription Plugin] Theme:', SUBSCRIPTION_THEME_CONFIG.themeId);
  console.log('[Subscription Plugin] Components:', Object.keys(SUBSCRIPTION_COMPONENTS));

  // Register event listeners for menu management conflicts
  if (typeof window !== 'undefined') {
    window.addEventListener('subscription:activated', handleSubscriptionActivated);
    window.addEventListener('subscription:deactivated', handleSubscriptionDeactivated);
  }

  return {
    success: true,
    components: SUBSCRIPTION_COMPONENTS,
    theme: SUBSCRIPTION_THEME_CONFIG,
    metadata: SUBSCRIPTION_PLUGIN_METADATA,
  };
}

/**
 * Handle subscription plugin activation
 * Disables core menu management when subscription is active
 */
function handleSubscriptionActivated() {
  console.log('[Subscription Plugin] Plugin activated - taking over menu management');

  // Emit event to hide core menu management
  const event = new CustomEvent('core:disable-menu-management', {
    detail: {
      reason: 'subscription-plugin-active',
      replacement: '/subscriptions/menu',
    },
  });
  window.dispatchEvent(event);

  // Store activation state
  localStorage.setItem('subscription-plugin-active', 'true');
}

/**
 * Handle subscription plugin deactivation
 * Re-enables core menu management when subscription is deactivated
 */
function handleSubscriptionDeactivated() {
  console.log('[Subscription Plugin] Plugin deactivated - restoring core menu management');

  // Emit event to show core menu management
  const event = new CustomEvent('core:enable-menu-management');
  window.dispatchEvent(event);

  // Remove activation state
  localStorage.removeItem('subscription-plugin-active');
}

/**
 * Check if subscription plugin is currently active
 */
export function isSubscriptionPluginActive(): boolean {
  return localStorage.getItem('subscription-plugin-active') === 'true';
}

/**
 * Cleanup function called when plugin is uninstalled
 */
export function cleanupSubscriptionPlugin() {
  console.log('[Subscription Plugin] Cleaning up subscription plugin...');

  if (typeof window !== 'undefined') {
    window.removeEventListener('subscription:activated', handleSubscriptionActivated);
    window.removeEventListener('subscription:deactivated', handleSubscriptionDeactivated);
  }

  // Re-enable core menu management
  handleSubscriptionDeactivated();
}
