/**
 * usePluginUpdates Hook
 *
 * React hook for managing plugin updates
 */

import { useState, useEffect, useCallback } from 'react';
import {
  checkForUpdates,
  updatePlugin,
  getPluginStats,
  type PluginUpdate,
} from '@/services/pluginRegistry';

export function usePluginUpdates() {
  const [updates, setUpdates] = useState<PluginUpdate[]>([]);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    enabled: 0,
    disabled: 0,
    updates_available: 0,
  });

  /**
   * Check for available updates
   */
  const check = useCallback(async () => {
    try {
      setChecking(true);
      setError(null);

      const [available, pluginStats] = await Promise.all([
        checkForUpdates(),
        getPluginStats(),
      ]);

      setUpdates(available);
      setStats(pluginStats);

      console.log(`[usePluginUpdates] Found ${available.length} updates`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check for updates';
      setError(message);
      console.error('[usePluginUpdates] Error:', err);
    } finally {
      setChecking(false);
    }
  }, []);

  /**
   * Update a specific plugin
   */
  const update = useCallback(async (pluginId: string) => {
    try {
      setUpdating(pluginId);
      setError(null);

      await updatePlugin(pluginId);

      // Refresh updates list
      await check();

      console.log(`[usePluginUpdates] Successfully updated ${pluginId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update plugin';
      setError(message);
      console.error('[usePluginUpdates] Update error:', err);
      throw err;
    } finally {
      setUpdating(null);
    }
  }, [check]);

  /**
   * Update all plugins
   */
  const updateAll = useCallback(async () => {
    for (const pluginUpdate of updates) {
      try {
        await update(pluginUpdate.id);
      } catch (err) {
        console.error(`[usePluginUpdates] Failed to update ${pluginUpdate.id}:`, err);
        // Continue with other updates
      }
    }
  }, [updates, update]);

  /**
   * Initial check on mount
   */
  useEffect(() => {
    check();

    // Check every hour
    const interval = setInterval(check, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, [check]);

  return {
    updates,
    checking,
    updating,
    error,
    stats,
    check,
    update,
    updateAll,
    hasUpdates: updates.length > 0,
    hasCriticalUpdates: updates.some(u => u.urgency === 'critical'),
    hasHighPriorityUpdates: updates.some(u => u.urgency === 'high'),
  };
}
