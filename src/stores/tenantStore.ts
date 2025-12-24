/**
 * Tenant Store
 * Manages multi-tenant configuration and activation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TenantTheme {
  primaryColor: string;
  secondaryColor?: string;
  logoUrl?: string | null;
}

export interface TenantConfig {
  tenantId: string;
  companyName: string;
  subdomain: string;

  // API endpoints
  apiBaseUrl: string;
  ordersEndpoint: string;
  menuEndpoint: string;

  // Theme/branding
  theme: TenantTheme;

  // Config
  currency: string;
  timezone: string;

  // Activation metadata
  activatedAt: string;
}

interface TenantStore {
  // State
  tenant: TenantConfig | null;
  isActivated: boolean;
  isActivating: boolean;
  activationError: string | null;

  // Actions
  activateTenant: (code: string) => Promise<boolean>;
  clearTenant: () => void;
  setActivationError: (error: string | null) => void;

  // Computed
  getTenantId: () => string | null;
  getApiBaseUrl: () => string;
  getOrdersEndpoint: () => string;
  getMenuEndpoint: () => string;
}

// Default API URLs (fallback for non-activated state or dev)
const DEFAULT_API_BASE_URL = import.meta.env.VITE_HANDSFREE_API_URL || 'https://handsfree-restaurant-client.suyesh.workers.dev';
const DEFAULT_ORDERS_ENDPOINT = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';

// Admin panel URL for activation
const ADMIN_PANEL_URL = import.meta.env.VITE_ADMIN_PANEL_URL || 'https://handsfree-admin.pages.dev';

export const useTenantStore = create<TenantStore>()(
  persist(
    (set, get) => ({
      // Initial state
      tenant: null,
      isActivated: false,
      isActivating: false,
      activationError: null,

      // Activate tenant with code
      activateTenant: async (code: string): Promise<boolean> => {
        set({ isActivating: true, activationError: null });

        try {
          console.log('[TenantStore] Activating with code:', code.substring(0, 4) + '****');

          const response = await fetch(`${ADMIN_PANEL_URL}/api/pos/activate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ activationCode: code }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            const errorMessage = result.error || 'Activation failed';
            console.error('[TenantStore] Activation failed:', errorMessage);
            set({
              isActivating: false,
              activationError: errorMessage,
            });
            return false;
          }

          const config = result.data as TenantConfig;

          console.log('[TenantStore] Activation successful:', config.tenantId);

          set({
            tenant: config,
            isActivated: true,
            isActivating: false,
            activationError: null,
          });

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Network error';
          console.error('[TenantStore] Activation error:', message);
          set({
            isActivating: false,
            activationError: message,
          });
          return false;
        }
      },

      // Clear tenant (for logout or reset)
      clearTenant: () => {
        console.log('[TenantStore] Clearing tenant');
        set({
          tenant: null,
          isActivated: false,
          isActivating: false,
          activationError: null,
        });
      },

      // Set activation error
      setActivationError: (error) => {
        set({ activationError: error });
      },

      // Get tenant ID
      getTenantId: () => {
        const { tenant } = get();
        return tenant?.tenantId || null;
      },

      // Get API base URL
      getApiBaseUrl: () => {
        const { tenant } = get();
        return tenant?.apiBaseUrl || DEFAULT_API_BASE_URL;
      },

      // Get orders endpoint
      getOrdersEndpoint: () => {
        const { tenant } = get();
        return tenant?.ordersEndpoint || DEFAULT_ORDERS_ENDPOINT;
      },

      // Get menu endpoint
      getMenuEndpoint: () => {
        const { tenant } = get();
        if (tenant?.menuEndpoint) {
          return tenant.menuEndpoint;
        }
        // Fallback: construct from base URL and tenant ID
        const tenantId = get().getTenantId();
        if (tenantId) {
          return `${DEFAULT_API_BASE_URL}/api/menu/${tenantId}`;
        }
        return `${DEFAULT_API_BASE_URL}/api/menu`;
      },
    }),
    {
      name: 'tenant-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        tenant: state.tenant,
        isActivated: state.isActivated,
      }),
    }
  )
);

/**
 * Helper hook to check if app needs activation
 */
export function useNeedsActivation(): boolean {
  const { isActivated, tenant } = useTenantStore();
  // Skip activation if in dev mode with skip auth
  const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true';
  if (skipAuth) return false;
  return !isActivated || !tenant;
}
