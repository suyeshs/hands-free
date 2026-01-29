/**
 * Tenant Store
 * Manages multi-tenant configuration and activation
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { SKIP_AUTH } from '../lib/appConfig';

// Helper to check if running in Tauri
const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

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
  isLoading: boolean;

  // Actions
  activateTenant: (code: string) => Promise<boolean>;
  clearTenant: () => void;
  setActivationError: (error: string | null) => void;
  loadFromSQLite: () => Promise<void>;

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

export const useTenantStore = create<TenantStore>()((set, get) => ({
  // Initial state
  tenant: null,
  isActivated: false,
  isActivating: false,
  activationError: null,
  isLoading: false,

  // Load tenant config from SQLite
  loadFromSQLite: async () => {
    if (!isTauri()) {
      console.log('[TenantStore] Not in Tauri, skipping SQLite load');
      return;
    }

    try {
      set({ isLoading: true });
      console.log('[TenantStore] Loading tenant config from SQLite...');

      const config = await invoke<TenantConfig | null>('get_tenant_config');

      if (config) {
        console.log('[TenantStore] ✅ Tenant config loaded from SQLite:', config.tenantId);
        set({
          tenant: config,
          isActivated: true,
          isLoading: false,
        });
      } else {
        console.log('[TenantStore] ℹ️  No tenant config in SQLite (not activated)');
        set({
          tenant: null,
          isActivated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[TenantStore] ❌ Failed to load from SQLite:', error);
      set({ isLoading: false });
    }
  },

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

      // Save to memory first
      set({
        tenant: config,
        isActivated: true,
        isActivating: false,
        activationError: null,
      });

      // Save to SQLite if in Tauri
      if (isTauri()) {
        try {
          console.log('[TenantStore] Saving to SQLite...');
          await invoke('save_tenant_config', { config });
          console.log('[TenantStore] ✅ Saved to SQLite successfully');
        } catch (error) {
          console.error('[TenantStore] ⚠️  Failed to save to SQLite:', error);
          // Don't fail activation if SQLite save fails
        }
      }

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
  clearTenant: async () => {
    console.log('[TenantStore] Clearing tenant');

    // Clear from memory
    set({
      tenant: null,
      isActivated: false,
      isActivating: false,
      activationError: null,
    });

    // Clear from SQLite if in Tauri
    if (isTauri()) {
      try {
        console.log('[TenantStore] Clearing from SQLite...');
        await invoke('clear_tenant_config');
        console.log('[TenantStore] ✅ Cleared from SQLite');
      } catch (error) {
        console.error('[TenantStore] ⚠️  Failed to clear from SQLite:', error);
      }
    }
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
}));

// Log store state immediately after creation
console.log('[TenantStore] ═══════════════════════════════════════════════');
console.log('[TenantStore] 🏪 Store initialized (IN-MEMORY ONLY - no localStorage)');
console.log('[TenantStore] Initial state:', {
  isActivated: useTenantStore.getState().isActivated,
  tenantId: useTenantStore.getState().tenant?.tenantId,
});
console.log('[TenantStore] ═══════════════════════════════════════════════');

/**
 * Helper hook to check if app needs activation
 */
export function useNeedsActivation(): boolean {
  const { isActivated, tenant } = useTenantStore();
  // Skip activation if in dev mode with skip auth
  if (SKIP_AUTH) return false;
  return !isActivated || !tenant;
}
