/**
 * Plugin Diagnostics Component
 * Troubleshooting and debugging tools for plugins
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  RefreshCw,
  Package,
  Zap,
  Database,
  Clock,
} from 'lucide-react';
import { usePluginManager } from '@/hooks/usePluginManager';
import type { InstalledPlugin, DependencyConflict, PluginSnapshot } from '@/types/plugin';
import { cn } from '@/lib/utils';

interface DiagnosticItem {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  plugin?: string;
  action?: { label: string; onClick: () => void };
}

export function PluginDiagnostics() {
  const {
    installedPlugins,
    checkUpdates,
    checkConflicts,
    listSnapshots,
    loading,
  } = usePluginManager();

  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [runningCheck, setRunningCheck] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<InstalledPlugin | null>(null);
  const [pluginSnapshots, setPluginSnapshots] = useState<PluginSnapshot[]>([]);
  const [pluginConflicts, setPluginConflicts] = useState<DependencyConflict[]>([]);

  useEffect(() => {
    runDiagnostics();
  }, [installedPlugins]);

  const runDiagnostics = async () => {
    setRunningCheck(true);
    const items: DiagnosticItem[] = [];

    try {
      // Check for disabled plugins
      const disabledPlugins = installedPlugins.filter((p) => !p.enabled);
      if (disabledPlugins.length > 0) {
        items.push({
          id: 'disabled-plugins',
          type: 'info',
          title: `${disabledPlugins.length} Disabled Plugin(s)`,
          message: `The following plugins are installed but disabled: ${disabledPlugins
            .map((p) => p.manifest.name)
            .join(', ')}`,
        });
      }

      // Check for updates
      const updates = await checkUpdates();
      if (updates.length > 0) {
        items.push({
          id: 'updates-available',
          type: 'warning',
          title: `${updates.length} Update(s) Available`,
          message: `Updates are available for: ${updates.map((u) => u.pluginId).join(', ')}`,
        });
      }

      // Check for dependency conflicts
      for (const plugin of installedPlugins) {
        const conflicts = await checkConflicts(plugin.manifest.id);
        if (conflicts.length > 0) {
          items.push({
            id: `conflicts-${plugin.manifest.id}`,
            type: 'error',
            title: `Dependency Conflicts Detected`,
            message: `${plugin.manifest.name} has conflicts with: ${conflicts
              .map((c) => c.plugin_id)
              .join(', ')}`,
            plugin: plugin.manifest.name,
          });
        }
      }

      // Check for expired snapshots
      for (const plugin of installedPlugins) {
        if (plugin.has_snapshot && plugin.snapshot_expires_at) {
          const expiresAt = new Date(plugin.snapshot_expires_at);
          const daysUntilExpiry = Math.floor(
            (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          if (daysUntilExpiry <= 7) {
            items.push({
              id: `snapshot-expiring-${plugin.manifest.id}`,
              type: 'warning',
              title: 'Snapshot Expiring Soon',
              message: `Rollback snapshot for ${plugin.manifest.name} expires in ${daysUntilExpiry} day(s)`,
              plugin: plugin.manifest.name,
            });
          }
        }
      }

      // Check for large cache sizes
      const largePlugins = installedPlugins.filter((p) => p.cache_size && p.cache_size > 10 * 1024 * 1024);
      if (largePlugins.length > 0) {
        items.push({
          id: 'large-cache',
          type: 'info',
          title: 'Large Plugin Cache',
          message: `The following plugins have caches larger than 10MB: ${largePlugins
            .map((p) => `${p.manifest.name} (${(p.cache_size! / (1024 * 1024)).toFixed(2)}MB)`)
            .join(', ')}`,
        });
      }

      // Check for stale plugins (not used in 30 days)
      const stalePlugins = installedPlugins.filter((p) => {
        if (!p.last_used) return false;
        const daysSinceUse = Math.floor(
          (Date.now() - new Date(p.last_used).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceUse > 30;
      });
      if (stalePlugins.length > 0) {
        items.push({
          id: 'stale-plugins',
          type: 'info',
          title: 'Unused Plugins',
          message: `${stalePlugins.length} plugin(s) haven't been used in over 30 days: ${stalePlugins
            .map((p) => p.manifest.name)
            .join(', ')}`,
        });
      }

      // All clear!
      if (items.length === 0) {
        items.push({
          id: 'all-clear',
          type: 'success',
          title: 'All Systems Operational',
          message: 'No issues detected with your installed plugins',
        });
      }

      setDiagnostics(items);
    } catch (err) {
      console.error('Diagnostics failed:', err);
      items.push({
        id: 'diagnostic-error',
        type: 'error',
        title: 'Diagnostic Check Failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      setDiagnostics(items);
    } finally {
      setRunningCheck(false);
    }
  };

  const loadPluginDetails = async (plugin: InstalledPlugin) => {
    setSelectedPlugin(plugin);
    const [snapshots, conflicts] = await Promise.all([
      listSnapshots(plugin.manifest.id),
      checkConflicts(plugin.manifest.id),
    ]);
    setPluginSnapshots(snapshots);
    setPluginConflicts(conflicts);
  };

  const getIcon = (type: DiagnosticItem['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
    }
  };

  const getBgColor = (type: DiagnosticItem['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Plugin Diagnostics</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Monitor plugin health and troubleshoot issues
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={runningCheck}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', runningCheck && 'animate-spin')} />
          Run Diagnostics
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Plugins</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {installedPlugins.length}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Enabled</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {installedPlugins.filter((p) => p.enabled).length}
              </p>
            </div>
            <Zap className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cache Size</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatBytes(
                  installedPlugins.reduce((sum, p) => sum + (p.cache_size || 0), 0)
                )}
              </p>
            </div>
            <Database className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">With Snapshots</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {installedPlugins.filter((p) => p.has_snapshot).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </div>

      {/* Diagnostic Results */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Diagnostic Results
        </h3>

        {loading || runningCheck ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">Running diagnostics...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diagnostics.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('rounded-lg border p-4', getBgColor(item.type))}
              >
                <div className="flex items-start gap-3">
                  {getIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {item.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {item.message}
                    </p>
                    {item.action && (
                      <button
                        onClick={item.action.onClick}
                        className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {item.action.label}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Plugin Details Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Plugin Details
        </h3>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plugin
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cache
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {installedPlugins.map((plugin) => (
                  <tr key={plugin.manifest.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{plugin.manifest.icon || '🔌'}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {plugin.manifest.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          plugin.enabled
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {plugin.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      v{plugin.manifest.version}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {plugin.cache_size ? formatBytes(plugin.cache_size) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {plugin.last_used
                        ? new Date(plugin.last_used).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => loadPluginDetails(plugin)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Selected Plugin Details */}
      {selectedPlugin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {selectedPlugin.manifest.name} - Detailed Information
          </h3>

          {/* Conflicts */}
          {pluginConflicts.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                Dependency Conflicts:
              </h4>
              <div className="space-y-2">
                {pluginConflicts.map((conflict, i) => (
                  <div
                    key={i}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm"
                  >
                    <p className="text-red-800 dark:text-red-300">
                      <strong>{conflict.plugin_id}</strong> has conflicting versions
                    </p>
                    <p className="text-red-700 dark:text-red-400 text-xs mt-1">
                      Required by: {conflict.required_by.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Snapshots */}
          {pluginSnapshots.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                Available Snapshots ({pluginSnapshots.length}):
              </h4>
              <div className="space-y-2">
                {pluginSnapshots.map((snapshot, i) => (
                  <div
                    key={i}
                    className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-amber-800 dark:text-amber-300">
                          Version: {snapshot.manifest.version}
                        </p>
                        <p className="text-amber-700 dark:text-amber-400 text-xs">
                          Created: {formatDate(snapshot.created_at)}
                        </p>
                        <p className="text-amber-700 dark:text-amber-400 text-xs">
                          Expires: {formatDate(snapshot.expires_at)}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs font-medium capitalize">
                        {snapshot.snapshot_reason}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
