/**
 * usePluginManager Hook
 * React hook for managing plugins with the PluginManager
 * Now uses the global pluginStore for shared state across components
 */

import { useState, useEffect, useCallback } from 'react';
import { getPluginManager } from '@/services/plugins/pluginManager';
import { useTenantStore } from '@/stores/tenantStore';
import { usePluginStore } from '@/stores/pluginStore';
import type {
  PluginSearchFilters,
  UninstallOptions,
  PluginReview,
  PluginSnapshot,
  DependencyConflict,
} from '@/types/plugin';

export function usePluginManager() {
  const getTenantId = useTenantStore((state: any) => state.getTenantId);
  const tenantId = getTenantId() || 'default';

  // Use global plugin store instead of local state
  const installedPlugins = usePluginStore((state) => state.installed);
  const availablePlugins = usePluginStore((state) => state.available);
  const initialized = usePluginStore((state) => state.initialized);
  const initializeStore = usePluginStore((state) => state.initialize);
  const refreshInstalled = usePluginStore((state) => state.refreshInstalled);
  const refreshAvailable = usePluginStore((state) => state.refreshAvailable);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pluginManager = getPluginManager(tenantId);

  // Initialize plugin manager on mount
  useEffect(() => {
    let mounted = true;

    const initializeManager = async () => {
      try {
        console.log('[usePluginManager] Initializing plugin manager...');
        await initializeStore(tenantId);
        if (mounted) {
          console.log('[usePluginManager] Plugin manager initialized successfully');
        }
      } catch (err) {
        console.error('[usePluginManager] Failed to initialize plugin manager:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize plugin manager');
        }
      }
    };

    if (!initialized) {
      initializeManager();
    }

    return () => {
      mounted = false;
    };
  }, [initialized, initializeStore, tenantId]);

  // Auto-load available plugins after initialization
  useEffect(() => {
    if (!initialized) return;

    let mounted = true;

    const autoLoadPlugins = async () => {
      try {
        console.log('[usePluginManager] Loading available plugins from registry...');
        await refreshAvailable();
        if (mounted) {
          console.log('[usePluginManager] Loaded', availablePlugins.length, 'available plugins');
        }
      } catch (err) {
        console.error('[usePluginManager] Failed to auto-load plugins:', err);
      }
    };

    if (availablePlugins.length === 0) {
      autoLoadPlugins();
    }

    return () => {
      mounted = false;
    };
  }, [initialized, availablePlugins.length, refreshAvailable]);

  // Load available plugins from registry
  const loadAvailablePlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await refreshAvailable();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
      console.error('Failed to load available plugins:', err);
    } finally {
      setLoading(false);
    }
  }, [refreshAvailable]);

  // Load installed plugins
  const loadInstalledPlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await refreshInstalled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load installed plugins');
      console.error('Failed to load installed plugins:', err);
    } finally {
      setLoading(false);
    }
  }, [refreshInstalled]);

  // Search plugins with filters
  const searchPlugins = useCallback(
    async (query: string, filters?: PluginSearchFilters) => {
      try {
        setLoading(true);
        setError(null);
        const results = await pluginManager.searchPlugins(query, filters);
        // Update the available plugins in the store
        usePluginStore.setState({ available: results });
        return results;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        console.error('Plugin search failed:', err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [pluginManager]
  );

  // Install plugin - use store method
  const installPluginFromStore = usePluginStore((state) => state.install);
  const installPlugin = useCallback(
    async (pluginId: string, version?: string) => {
      if (!initialized) {
        const message = 'Plugin manager not initialized';
        setError(message);
        return { success: false, error: message };
      }

      try {
        setLoading(true);
        setError(null);
        await installPluginFromStore(pluginId, version);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Installation failed';
        setError(message);
        console.error('Plugin installation failed:', err);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [initialized, installPluginFromStore]
  );

  // Uninstall plugin - use store method
  const uninstallPluginFromStore = usePluginStore((state) => state.uninstall);
  const uninstallPlugin = useCallback(
    async (pluginId: string, _options?: UninstallOptions) => {
      if (!initialized) {
        const message = 'Plugin manager not initialized';
        setError(message);
        return { success: false, error: message };
      }

      try {
        setLoading(true);
        setError(null);
        await uninstallPluginFromStore(pluginId);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Uninstallation failed';
        setError(message);
        console.error('Plugin uninstallation failed:', err);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [initialized, uninstallPluginFromStore]
  );

  // Update plugin - use store method
  const updatePluginFromStore = usePluginStore((state) => state.update);
  const updatePlugin = useCallback(
    async (pluginId: string, _version?: string) => {
      try {
        setLoading(true);
        setError(null);
        await updatePluginFromStore(pluginId);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Update failed';
        setError(message);
        console.error('Plugin update failed:', err);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [updatePluginFromStore]
  );

  // Enable plugin - use store method
  const enablePluginFromStore = usePluginStore((state) => state.enable);
  const enablePlugin = useCallback(
    async (pluginId: string) => {
      if (!initialized) {
        const message = 'Plugin manager not initialized';
        setError(message);
        return { success: false, error: message };
      }

      try {
        setLoading(true);
        setError(null);
        await enablePluginFromStore(pluginId);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Enable failed';
        setError(message);
        console.error('Plugin enable failed:', err);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [initialized, enablePluginFromStore]
  );

  // Disable plugin - use store method
  const disablePluginFromStore = usePluginStore((state) => state.disable);
  const disablePlugin = useCallback(
    async (pluginId: string) => {
      if (!initialized) {
        const message = 'Plugin manager not initialized';
        setError(message);
        return { success: false, error: message };
      }

      try {
        setLoading(true);
        setError(null);
        await disablePluginFromStore(pluginId);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Disable failed';
        setError(message);
        console.error('Plugin disable failed:', err);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [initialized, disablePluginFromStore]
  );

  // Rollback plugin
  const rollbackPlugin = useCallback(
    async (pluginId: string) => {
      if (!initialized) {
        const message = 'Plugin manager not initialized';
        setError(message);
        return { success: false, error: message };
      }

      try {
        setLoading(true);
        setError(null);
        await pluginManager.rollback(pluginId);
        await refreshInstalled();
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Rollback failed';
        setError(message);
        console.error('Plugin rollback failed:', err);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [initialized, pluginManager, refreshInstalled]
  );

  // Get plugin details
  const getPluginDetails = useCallback(
    async (pluginId: string) => {
      try {
        const info = await pluginManager.getInfo(pluginId);
        return info;
      } catch (err) {
        console.error('Failed to get plugin details:', err);
        return null;
      }
    },
    [pluginManager]
  );

  // Get installed plugin
  const getInstalledPlugin = useCallback(
    async (pluginId: string) => {
      try {
        const plugin = await pluginManager.getInstalled(pluginId);
        return plugin;
      } catch (err) {
        console.error('Failed to get installed plugin:', err);
        return null;
      }
    },
    [pluginManager]
  );

  // Check for updates
  const checkUpdates = useCallback(async () => {
    try {
      const updates = await pluginManager.checkUpdates();
      return updates;
    } catch (err) {
      console.error('Failed to check updates:', err);
      return [];
    }
  }, [pluginManager]);

  // Submit review
  const submitReview = useCallback(
    async (pluginId: string, rating: number, comment?: string) => {
      try {
        await pluginManager.submitReview(pluginId, rating, comment);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit review';
        console.error('Failed to submit review:', err);
        return { success: false, error: message };
      }
    },
    [pluginManager]
  );

  // Get reviews
  const getReviews = useCallback(
    async (pluginId: string, limit?: number): Promise<PluginReview[]> => {
      try {
        const reviews = await pluginManager.getReviews(pluginId, limit);
        return reviews;
      } catch (err) {
        console.error('Failed to get reviews:', err);
        return [];
      }
    },
    [pluginManager]
  );

  // List snapshots
  const listSnapshots = useCallback(
    async (pluginId: string): Promise<PluginSnapshot[]> => {
      try {
        const snapshots = await pluginManager.listSnapshots(pluginId);
        return snapshots;
      } catch (err) {
        console.error('Failed to list snapshots:', err);
        return [];
      }
    },
    [pluginManager]
  );

  // Check dependency conflicts
  const checkConflicts = useCallback(
    async (pluginId: string): Promise<DependencyConflict[]> => {
      try {
        const conflicts = await pluginManager.checkDependencyConflicts(pluginId);
        return conflicts;
      } catch (err) {
        console.error('Failed to check conflicts:', err);
        return [];
      }
    },
    [pluginManager]
  );

  // Revoke permission
  const revokePermission = useCallback(
    async (pluginId: string, permission: string) => {
      try {
        await pluginManager.revokePermission(pluginId, permission);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to revoke permission';
        console.error('Failed to revoke permission:', err);
        return { success: false, error: message };
      }
    },
    [pluginManager]
  );

  return {
    // State
    availablePlugins,
    installedPlugins,
    loading,
    error,
    initialized,

    // Actions
    loadAvailablePlugins,
    loadInstalledPlugins,
    searchPlugins,
    installPlugin,
    uninstallPlugin,
    updatePlugin,
    enablePlugin,
    disablePlugin,
    rollbackPlugin,
    getPluginDetails,
    getInstalledPlugin,
    checkUpdates,
    submitReview,
    getReviews,
    listSnapshots,
    checkConflicts,
    revokePermission,
  };
}
