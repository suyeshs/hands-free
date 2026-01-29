/**
 * Plugin Store
 *
 * Global state management for plugins using Zustand
 * Tracks installed plugins, loading states, and provides actions
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  InstalledPlugin,
  PluginMetadata,
  PluginLoadingState,
} from '@/types/plugin';
import { getPluginManager, initializePluginManager } from '@/services/plugins/pluginManager';

interface PluginStore {
  /**
   * List of installed plugins
   */
  installed: InstalledPlugin[];

  /**
   * Loading states for each plugin
   */
  loadingStates: Record<string, PluginLoadingState>;

  /**
   * Available plugins from registry
   */
  available: PluginMetadata[];

  /**
   * Whether the plugin manager is initialized
   */
  initialized: boolean;

  /**
   * Pending updates
   */
  updates: Array<{
    pluginId: string;
    currentVersion: string;
    latestVersion: string;
  }>;

  /**
   * Initialize plugin manager
   */
  initialize: (tenantId: string) => Promise<void>;

  /**
   * Refresh installed plugins list
   */
  refreshInstalled: () => Promise<void>;

  /**
   * Refresh available plugins list
   */
  refreshAvailable: () => Promise<void>;

  /**
   * Install a plugin
   */
  install: (pluginId: string, version?: string) => Promise<void>;

  /**
   * Uninstall a plugin
   */
  uninstall: (pluginId: string) => Promise<void>;

  /**
   * Enable a plugin
   */
  enable: (pluginId: string) => Promise<void>;

  /**
   * Disable a plugin
   */
  disable: (pluginId: string) => Promise<void>;

  /**
   * Update a plugin
   */
  update: (pluginId: string) => Promise<void>;

  /**
   * Check for updates
   */
  checkUpdates: () => Promise<void>;

  /**
   * Update loading state for a plugin
   */
  setLoadingState: (pluginId: string, state: PluginLoadingState) => void;

  /**
   * Get installed plugin by ID
   */
  getInstalled: (pluginId: string) => InstalledPlugin | undefined;

  /**
   * Check if plugin is enabled
   */
  isEnabled: (pluginId: string) => boolean;

  /**
   * Check if plugin is installed
   */
  isInstalled: (pluginId: string) => boolean;
}

let currentTenantId: string | null = null;

export const usePluginStore = create<PluginStore>()(
  persist(
    (set, get) => ({
      installed: [],
      loadingStates: {},
      available: [],
      initialized: false,
      updates: [],

      initialize: async (tenantId: string) => {
        if (get().initialized && currentTenantId === tenantId) {
          return;
        }

        try {
          currentTenantId = tenantId;
          await initializePluginManager(tenantId);

          set({ initialized: true });

          // Load installed plugins
          await get().refreshInstalled();
        } catch (error) {
          console.error('Failed to initialize plugin manager:', error);
          throw error;
        }
      },

      refreshInstalled: async () => {
        if (!currentTenantId) {
          throw new Error('Plugin manager not initialized');
        }

        try {
          const manager = getPluginManager(currentTenantId);
          const installed = await manager.listInstalled();

          set({ installed });
        } catch (error) {
          console.error('Failed to refresh installed plugins:', error);
          throw error;
        }
      },

      refreshAvailable: async () => {
        if (!currentTenantId) {
          throw new Error('Plugin manager not initialized');
        }

        try {
          const manager = getPluginManager(currentTenantId);
          const available = await manager.listAvailable();

          set({ available });
        } catch (error) {
          console.error('Failed to refresh available plugins:', error);
          throw error;
        }
      },

      install: async (pluginId: string, version?: string) => {
        if (!currentTenantId) {
          throw new Error('Plugin manager not initialized');
        }

        try {
          set(state => ({
            loadingStates: { ...state.loadingStates, [pluginId]: 'loading' },
          }));

          const manager = getPluginManager(currentTenantId);
          await manager.install(pluginId, version);

          set(state => ({
            loadingStates: { ...state.loadingStates, [pluginId]: 'loaded' },
          }));

          // Refresh installed list
          await get().refreshInstalled();
        } catch (error) {
          set(state => ({
            loadingStates: { ...state.loadingStates, [pluginId]: 'error' },
          }));
          throw error;
        }
      },

      uninstall: async (pluginId: string) => {
        if (!currentTenantId) {
          throw new Error('Plugin manager not initialized');
        }

        try {
          const manager = getPluginManager(currentTenantId);
          await manager.uninstall(pluginId);

          set(state => ({
            installed: state.installed.filter(p => p.manifest.id !== pluginId),
            loadingStates: { ...state.loadingStates, [pluginId]: 'idle' },
          }));
        } catch (error) {
          console.error(`Failed to uninstall plugin ${pluginId}:`, error);
          throw error;
        }
      },

      enable: async (pluginId: string) => {
        if (!currentTenantId) {
          throw new Error('Plugin manager not initialized');
        }

        try {
          const manager = getPluginManager(currentTenantId);
          await manager.enable(pluginId);

          // Update installed list
          await get().refreshInstalled();
        } catch (error) {
          console.error(`Failed to enable plugin ${pluginId}:`, error);
          throw error;
        }
      },

      disable: async (pluginId: string) => {
        if (!currentTenantId) {
          throw new Error('Plugin manager not initialized');
        }

        try {
          const manager = getPluginManager(currentTenantId);
          await manager.disable(pluginId);

          // Update installed list
          await get().refreshInstalled();
        } catch (error) {
          console.error(`Failed to disable plugin ${pluginId}:`, error);
          throw error;
        }
      },

      update: async (pluginId: string) => {
        if (!currentTenantId) {
          throw new Error('Plugin manager not initialized');
        }

        try {
          set(state => ({
            loadingStates: { ...state.loadingStates, [pluginId]: 'loading' },
          }));

          const manager = getPluginManager(currentTenantId);
          await manager.update(pluginId);

          set(state => ({
            loadingStates: { ...state.loadingStates, [pluginId]: 'loaded' },
            updates: state.updates.filter(u => u.pluginId !== pluginId),
          }));

          // Refresh installed list
          await get().refreshInstalled();
        } catch (error) {
          set(state => ({
            loadingStates: { ...state.loadingStates, [pluginId]: 'error' },
          }));
          throw error;
        }
      },

      checkUpdates: async () => {
        if (!currentTenantId) {
          throw new Error('Plugin manager not initialized');
        }

        try {
          const manager = getPluginManager(currentTenantId);
          const updates = await manager.checkUpdates();

          set({ updates });
        } catch (error) {
          console.error('Failed to check for updates:', error);
          throw error;
        }
      },

      setLoadingState: (pluginId: string, state: PluginLoadingState) => {
        set(prev => ({
          loadingStates: { ...prev.loadingStates, [pluginId]: state },
        }));
      },

      getInstalled: (pluginId: string) => {
        return get().installed.find(p => p.manifest.id === pluginId);
      },

      isEnabled: (pluginId: string) => {
        const plugin = get().getInstalled(pluginId);
        return plugin?.enabled || false;
      },

      isInstalled: (pluginId: string) => {
        return get().installed.some(p => p.manifest.id === pluginId);
      },
    }),
    {
      name: 'plugin-store',
      partialize: (state) => ({
        // Only persist loading states and updates
        // Installed plugins come from database
        loadingStates: state.loadingStates,
        updates: state.updates,
      }),
    }
  )
);

/**
 * Initialize plugin store on app startup
 */
export async function initializePluginStore(tenantId: string) {
  const store = usePluginStore.getState();
  await store.initialize(tenantId);
}

/**
 * Selectors for common use cases
 */
export const pluginStoreSelectors = {
  enabledPlugins: (state: PluginStore) =>
    state.installed.filter(p => p.enabled),

  disabledPlugins: (state: PluginStore) =>
    state.installed.filter(p => !p.enabled),

  loadingPlugins: (state: PluginStore) =>
    Object.entries(state.loadingStates)
      .filter(([_, state]) => state === 'loading')
      .map(([id]) => id),

  hasUpdates: (state: PluginStore) =>
    state.updates.length > 0,

  getLoadingState: (pluginId: string) => (state: PluginStore) =>
    state.loadingStates[pluginId] || 'idle',
};
