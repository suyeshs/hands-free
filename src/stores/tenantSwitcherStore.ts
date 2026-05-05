/**
 * Tenant Switcher Store
 * Manages tenant switching between master and locations
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantType: 'master' | 'location';
  locationId?: string; // For locations only
  subdomain?: string;
  isActive: boolean;
}

interface TenantSwitcherState {
  // State
  currentTenant: TenantInfo | null;
  availableTenants: TenantInfo[];
  isLoading: boolean;
  isSwitching: boolean;
  error: string | null;

  // Actions
  loadTenants: () => Promise<void>;
  switchTenant: (tenantId: string, tenantType: 'master' | 'location') => Promise<void>;
  getCurrentTenant: () => Promise<void>;
  refreshTenants: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  currentTenant: null,
  availableTenants: [],
  isLoading: false,
  isSwitching: false,
  error: null,
};

export const useTenantSwitcherStore = create<TenantSwitcherState>((set, get) => ({
  ...initialState,

  loadTenants: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('[TenantSwitcher] Loading accessible tenants...');

      // Get list of accessible tenants (master + locations)
      const tenants = await invoke<TenantInfo[]>('get_accessible_tenants');

      console.log('[TenantSwitcher] Loaded tenants:', tenants);

      set({ availableTenants: tenants, isLoading: false });

      // Also get current tenant
      await get().getCurrentTenant();
    } catch (error) {
      console.error('[TenantSwitcher] Failed to load tenants:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load tenants',
        isLoading: false,
      });
    }
  },

  getCurrentTenant: async () => {
    try {
      console.log('[TenantSwitcher] Getting current tenant context...');

      const currentTenant = await invoke<TenantInfo>('get_current_tenant_context');

      console.log('[TenantSwitcher] Current tenant:', currentTenant);

      set({ currentTenant });
    } catch (error) {
      console.error('[TenantSwitcher] Failed to get current tenant:', error);
      // Don't set error state, just log it (tenant might not be set yet)
    }
  },

  switchTenant: async (tenantId: string, tenantType: 'master' | 'location') => {
    set({ isSwitching: true, error: null });
    try {
      console.log(`[TenantSwitcher] Switching to tenant: ${tenantId} (${tenantType})`);

      // Call Rust command to switch tenant
      await invoke('switch_tenant', { tenantId, tenantType });

      console.log('[TenantSwitcher] Switch successful, reloading tenant context...');

      // Reload current tenant
      await get().getCurrentTenant();

      // Emit event to notify all stores to reload
      window.dispatchEvent(new CustomEvent('tenant-switched', {
        detail: { tenantId, tenantType }
      }));

      console.log('[TenantSwitcher] Tenant switched successfully');

      set({ isSwitching: false });
    } catch (error) {
      console.error('[TenantSwitcher] Failed to switch tenant:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to switch tenant',
        isSwitching: false,
      });
      throw error;
    }
  },

  refreshTenants: async () => {
    console.log('[TenantSwitcher] Refreshing tenant list...');
    await get().loadTenants();
  },

  reset: () => {
    console.log('[TenantSwitcher] Resetting state');
    set(initialState);
  },
}));
