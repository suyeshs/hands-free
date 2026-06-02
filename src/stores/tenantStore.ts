/**
 * Tenant Store
 * Manages multi-tenant configuration and activation
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { SKIP_AUTH, TENANT_ID } from '../lib/appConfig';

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

  // Cloudflare D1 Database ID (for cloud sync)
  d1DatabaseId?: string;
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

// Single-tenant build: the tenant id is hardcoded (app.config.json → TENANT_ID). The app boots
// as always-activated for this tenant; any loaded/activated config has its tenantId pinned to it.
const HARDCODED_TENANT: TenantConfig = {
  tenantId: TENANT_ID,
  companyName: '',
  subdomain: TENANT_ID,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  ordersEndpoint: DEFAULT_ORDERS_ENDPOINT,
  menuEndpoint: `${DEFAULT_API_BASE_URL}/api/menu/${TENANT_ID}`,
  theme: { primaryColor: '#0ea5e9' },
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  activatedAt: '',
};

export const useTenantStore = create<TenantStore>()((set, get) => ({
  // Initial state — single-tenant: always activated for the hardcoded tenant.
  tenant: HARDCODED_TENANT,
  isActivated: true,
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
        // Pin tenantId to the hardcoded build tenant (ignore any stale/different stored value).
        set({
          tenant: { ...config, tenantId: TENANT_ID },
          isActivated: true,
          isLoading: false,
        });
      } else {
        console.log('[TenantStore] ℹ️  No tenant config in SQLite — using hardcoded tenant');
        set({
          tenant: HARDCODED_TENANT,
          isActivated: true,
          isLoading: false,
        });
      }
    } catch (error) {
      // Suppress "no such table" errors - expected during migration
      const errorMsg = String(error);
      if (!errorMsg.includes('no such table')) {
        console.error('[TenantStore] ❌ Failed to load from SQLite:', error);
      }
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

      // Map backend response to frontend interface
      // Backend uses snake_case (database_id), frontend uses camelCase (d1DatabaseId)
      const backendData = result.data;
      const config: TenantConfig = {
        tenantId: TENANT_ID, // pinned: single-tenant build

        companyName: backendData.companyName,
        subdomain: backendData.subdomain,
        apiBaseUrl: backendData.apiBaseUrl,
        ordersEndpoint: backendData.ordersEndpoint,
        menuEndpoint: backendData.menuEndpoint,
        theme: backendData.theme,
        currency: backendData.currency,
        timezone: backendData.timezone,
        activatedAt: backendData.activatedAt,
        // Map database_id from backend to d1DatabaseId for frontend
        d1DatabaseId: backendData.d1DatabaseId || backendData.database_id,
      };

      console.log('[TenantStore] Activation successful:', config.tenantId);
      console.log('[TenantStore] D1 Database ID:', config.d1DatabaseId);

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

      // Persist telemetry installation ID now that tenant is created
      try {
        const { telemetry } = await import('../lib/telemetry');
        telemetry.persistInstallationId();
        console.log('[TenantStore] ✅ Installation ID persisted after tenant creation');
      } catch (error) {
        console.error('[TenantStore] ⚠️  Failed to persist installation ID:', error);
        // Don't fail activation if telemetry fails
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

  // Get tenant ID — always the hardcoded build tenant (single-tenant).
  getTenantId: () => TENANT_ID,

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

// Store initialization - silent to reduce startup noise
// Enable debug logging with: localStorage.setItem('debug:stores', 'true')

/**
 * Helper hook to check if app needs activation
 */
export function useNeedsActivation(): boolean {
  const { isActivated, tenant } = useTenantStore();
  // Skip activation if in dev mode with skip auth
  if (SKIP_AUTH) return false;
  return !isActivated || !tenant;
}
