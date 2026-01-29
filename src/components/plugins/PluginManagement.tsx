/**
 * Plugin Management Component
 * Manage installed plugins - enable/disable, uninstall, configure, rollback
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Power,
  PowerOff,
  Trash2,
  Settings as SettingsIcon,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Shield,
} from 'lucide-react';
import { usePluginManager } from '@/hooks/usePluginManager';
import type { InstalledPlugin } from '@/types/plugin';
import { cn } from '@/lib/utils';
import { PluginConfigModal } from './PluginConfigModal';
import { PluginUninstallModal } from './PluginUninstallModal';

export function PluginManagement() {
  const {
    installedPlugins,
    loading,
    error,
    enablePlugin,
    disablePlugin,
    updatePlugin,
    rollbackPlugin,
    checkUpdates,
  } = usePluginManager();

  const [selectedPlugin, setSelectedPlugin] = useState<InstalledPlugin | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showUninstall, setShowUninstall] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [availableUpdates, setAvailableUpdates] = useState<
    Array<{ pluginId: string; currentVersion: string; latestVersion: string }>
  >([]);

  // Filter plugins
  const filteredPlugins = useMemo(() => {
    if (filter === 'all') return installedPlugins;
    return installedPlugins.filter((p) => (filter === 'enabled' ? p.enabled : !p.enabled));
  }, [installedPlugins, filter]);

  const handleToggleEnabled = async (plugin: InstalledPlugin) => {
    const result = plugin.enabled
      ? await disablePlugin(plugin.manifest.id)
      : await enablePlugin(plugin.manifest.id);

    if (!result.success) {
      alert(`Failed to ${plugin.enabled ? 'disable' : 'enable'} plugin: ${result.error}`);
    }
  };

  const handleUpdate = async (plugin: InstalledPlugin) => {
    setUpdating(plugin.manifest.id);
    const result = await updatePlugin(plugin.manifest.id);
    setUpdating(null);

    if (result.success) {
      alert(`${plugin.manifest.name} updated successfully!`);
      // Refresh available updates
      const updates = await checkUpdates();
      setAvailableUpdates(updates);
    } else {
      alert(`Failed to update: ${result.error}`);
    }
  };

  const handleRollback = async (plugin: InstalledPlugin) => {
    if (!confirm(`Rollback ${plugin.manifest.name} to previous version?`)) {
      return;
    }

    setRollingBack(plugin.manifest.id);
    const result = await rollbackPlugin(plugin.manifest.id);
    setRollingBack(null);

    if (result.success) {
      alert(`${plugin.manifest.name} rolled back successfully!`);
    } else {
      alert(`Failed to rollback: ${result.error}`);
    }
  };

  const handleCheckUpdates = async () => {
    const updates = await checkUpdates();
    setAvailableUpdates(updates);
    if (updates.length === 0) {
      alert('All plugins are up to date!');
    }
  };

  const getUpdateInfo = (pluginId: string) => {
    return availableUpdates.find((u) => u.pluginId === pluginId);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysSince = (dateString: string) => {
    const days = Math.floor(
      (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Installed Plugins</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage and configure your installed plugins
          </p>
        </div>

        <button
          onClick={handleCheckUpdates}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Check Updates
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {(['all', 'enabled', 'disabled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 border-b-2 font-medium text-sm transition-colors capitalize',
              filter === f
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {f}
            <span className="ml-2 text-xs">
              (
              {f === 'all'
                ? installedPlugins.length
                : installedPlugins.filter((p) => (f === 'enabled' ? p.enabled : !p.enabled)).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Update Banner */}
      {availableUpdates.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                {availableUpdates.length} Update{availableUpdates.length !== 1 ? 's' : ''} Available
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                Update your plugins to get the latest features and security fixes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Plugin List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No plugins {filter !== 'all' && filter}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filter === 'all'
              ? 'Install plugins from the Plugin Store to get started'
              : `No ${filter} plugins found`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPlugins.map((plugin) => {
            const updateInfo = getUpdateInfo(plugin.manifest.id);

            return (
              <motion.div
                key={plugin.manifest.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0',
                      plugin.enabled
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                        : 'bg-gray-300 dark:bg-gray-700'
                    )}
                  >
                    {plugin.manifest.icon || '🔌'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          {plugin.manifest.name}
                          {(plugin.manifest as any).verified && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          )}
                          {!plugin.enabled && (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                              Disabled
                            </span>
                          )}
                          {updateInfo && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                              Update Available
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {plugin.manifest.description}
                        </p>
                      </div>

                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => handleToggleEnabled(plugin)}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          plugin.enabled
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        )}
                        title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
                      >
                        {plugin.enabled ? (
                          <Power className="w-5 h-5" />
                        ) : (
                          <PowerOff className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span>v{plugin.manifest.version}</span>
                      <span>•</span>
                      <span>by {plugin.manifest.author}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Installed {getDaysSince(plugin.installed_at)}
                      </span>
                      {plugin.cache_size && (
                        <>
                          <span>•</span>
                          <span>{formatBytes(plugin.cache_size)}</span>
                        </>
                      )}
                    </div>

                    {/* Update Info */}
                    {updateInfo && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                              Update available: v{updateInfo.currentVersion} → v
                              {updateInfo.latestVersion}
                            </p>
                          </div>
                          <button
                            onClick={() => handleUpdate(plugin)}
                            disabled={updating === plugin.manifest.id}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {updating === plugin.manifest.id ? 'Updating...' : 'Update Now'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rollback Info */}
                    {plugin.has_snapshot && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <div>
                              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                                Rollback available
                              </p>
                              <p className="text-xs text-amber-700 dark:text-amber-400">
                                Expires {plugin.snapshot_expires_at ? formatDate(plugin.snapshot_expires_at) : 'soon'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRollback(plugin)}
                            disabled={rollingBack === plugin.manifest.id}
                            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {rollingBack === plugin.manifest.id ? 'Rolling back...' : 'Rollback'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedPlugin(plugin);
                          setShowConfig(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                      >
                        <SettingsIcon className="w-4 h-4" />
                        Configure
                      </button>

                      {plugin.manifest.requires_permissions.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedPlugin(plugin);
                            setShowConfig(true);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                        >
                          <Shield className="w-4 h-4" />
                          Permissions ({plugin.manifest.requires_permissions.length})
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setSelectedPlugin(plugin);
                          setShowUninstall(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Uninstall
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Config Modal */}
      {showConfig && selectedPlugin && (
        <PluginConfigModal plugin={selectedPlugin} onClose={() => setShowConfig(false)} />
      )}

      {/* Uninstall Modal */}
      {showUninstall && selectedPlugin && (
        <PluginUninstallModal plugin={selectedPlugin} onClose={() => setShowUninstall(false)} />
      )}
    </div>
  );
}
