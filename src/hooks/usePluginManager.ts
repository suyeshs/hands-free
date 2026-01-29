/**
 * usePluginManager Hook
 * React hook for managing plugins with the PluginManager
 */

import { useState, useEffect, useCallback } from 'react';
import { getPluginManager } from '@/services/plugins/pluginManager';
import { useTenantStore } from '@/stores/tenantStore';
import type {
  PluginMetadata,
  InstalledPlugin,
  PluginSearchFilters,
  UninstallOptions,
  PluginReview,
  PluginSnapshot,
  DependencyConflict,
} from '@/types/plugin';

export function usePluginManager() {
  const getTenantId = useTenantStore((state: any) => state.getTenantId);
  const tenantId = getTenantId() || 'default';

  const [availablePlugins, setAvailablePlugins] = useState<PluginMetadata[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pluginManager = getPluginManager(tenantId);

  // Load available plugins from registry
  const loadAvailablePlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const plugins = await pluginManager.listAvailable();
      setAvailablePlugins(plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
      console.error('Failed to load available plugins:', err);
    } finally {
      setLoading(false);
    }
  }, [pluginManager]);

  // Load installed plugins
  const loadInstalledPlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const plugins = await pluginManager.listInstalled();
      setInstalledPlugins(plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load installed plugins');
      console.error('Failed to load installed plugins:', err);
    } finally {
      setLoading(false);
    }
  }, [pluginManager]);

  // Search plugins with filters
  const searchPlugins = useCallback(
    async (query: string, filters?: PluginSearchFilters) => {
      try {
        setLoading(true);
        setError(null);
        const results = await pluginManager.searchPlugins(query, filters);
        setAvailablePlugins(results);
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

  // Install plugin
  const installPlugin = useCallback(
    async (pluginId: string, version?: string) => {
      try {
        setLoading(true);
        setError(null);
        await pluginManager.install(pluginId, version);
        await loadInstalledPlugins();
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
    [pluginManager, loadInstalledPlugins]
  );

  // Uninstall plugin
  const uninstallPlugin = useCallback(
    async (pluginId: string, options?: UninstallOptions) => {
      try {
        setLoading(true);
        setError(null);
        await pluginManager.uninstall(pluginId, options);
        await loadInstalledPlugins();
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
    [pluginManager, loadInstalledPlugins]
  );

  // Update plugin
  const updatePlugin = useCallback(
    async (pluginId: string, version?: string) => {
      try {
        setLoading(true);
        setError(null);
        await pluginManager.update(pluginId, version);
        await loadInstalledPlugins();
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
    [pluginManager, loadInstalledPlugins]
  );

  // Enable plugin
  const enablePlugin = useCallback(
    async (pluginId: string) => {
      try {
        setLoading(true);
        setError(null);
        await pluginManager.enable(pluginId);
        await loadInstalledPlugins();
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
    [pluginManager, loadInstalledPlugins]
  );

  // Disable plugin
  const disablePlugin = useCallback(
    async (pluginId: string) => {
      try {
        setLoading(true);
        setError(null);
        await pluginManager.disable(pluginId);
        await loadInstalledPlugins();
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
    [pluginManager, loadInstalledPlugins]
  );

  // Rollback plugin
  const rollbackPlugin = useCallback(
    async (pluginId: string) => {
      try {
        setLoading(true);
        setError(null);
        await pluginManager.rollback(pluginId);
        await loadInstalledPlugins();
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
    [pluginManager, loadInstalledPlugins]
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

  // Initialize on mount
  useEffect(() => {
    loadAvailablePlugins();
    loadInstalledPlugins();
  }, [loadAvailablePlugins, loadInstalledPlugins]);

  return {
    // State
    availablePlugins,
    installedPlugins,
    loading,
    error,

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
