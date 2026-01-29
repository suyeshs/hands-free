/**
 * Plugin Config Modal
 * Configure plugin settings and manage permissions
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Check, AlertCircle } from 'lucide-react';
import { usePluginManager } from '@/hooks/usePluginManager';
import type { InstalledPlugin } from '@/types/plugin';
import { cn } from '@/lib/utils';

interface Props {
  plugin: InstalledPlugin;
  onClose: () => void;
}

export function PluginConfigModal({ plugin, onClose }: Props) {
  const { revokePermission } = usePluginManager();

  const [activeTab, setActiveTab] = useState<'settings' | 'permissions'>('settings');
  const [revokedPermissions, setRevokedPermissions] = useState<Set<string>>(new Set());
  const [revokingPermission, setRevokingPermission] = useState<string | null>(null);

  const handleRevokePermission = async (permission: string) => {
    if (!confirm(`Revoke "${permission}" permission? This may affect plugin functionality.`)) {
      return;
    }

    setRevokingPermission(permission);
    const result = await revokePermission(plugin.manifest.id, permission);
    setRevokingPermission(null);

    if (result.success) {
      setRevokedPermissions(new Set([...revokedPermissions, permission]));
      alert('Permission revoked. Plugin will adapt to reduced access.');
    } else {
      alert(`Failed to revoke permission: ${result.error}`);
    }
  };

  const getPermissionDescription = (permission: string): string => {
    const [type, action, resource] = permission.split('.');

    const descriptions: Record<string, string> = {
      database: {
        read: 'Read data from',
        write: 'Write data to',
      }[action] || 'Access',
      ui: 'Mount UI components at',
      events: action === 'subscribe' ? 'Subscribe to' : 'Emit',
      network: 'Make requests to',
      storage: 'Store data in',
    };

    return `${descriptions[type] || 'Access'} ${resource || 'resources'}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Plugin Configuration
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {plugin.manifest.name} v{plugin.manifest.version}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6">
            <div className="flex gap-6">
              {(['settings', 'permissions'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'py-3 px-1 border-b-2 font-medium text-sm transition-colors capitalize',
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Plugin-specific settings coming soon. This will allow you to configure plugin behavior
                    without modifying code.
                  </p>
                </div>

                {/* Plugin Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Plugin Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
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
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Type</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {plugin.manifest.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Author</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {plugin.manifest.author}
                      </span>
                    </div>

                    {plugin.manifest.homepage && (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Homepage</span>
                        <a
                          href={plugin.manifest.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Visit
                        </a>
                      </div>
                    )}

                    {plugin.manifest.theme_aware && (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Theme Support</span>
                        <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Dark mode enabled
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Data Handling */}
                {plugin.manifest.data && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Data Management
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
                      {plugin.manifest.data.tables && plugin.manifest.data.tables.length > 0 && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Database Tables:</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {plugin.manifest.data.tables.map((table) => (
                              <code
                                key={table}
                                className="px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded text-xs"
                              >
                                {table}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-gray-600 dark:text-gray-400">On Uninstall:</span>
                        <span className="ml-2 text-gray-900 dark:text-white capitalize">
                          {plugin.manifest.data.uninstall_behavior}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'permissions' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        Permission Management
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        Revoking permissions may affect plugin functionality. The plugin will gracefully
                        degrade features that require revoked permissions.
                      </p>
                    </div>
                  </div>
                </div>

                {plugin.manifest.requires_permissions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    This plugin doesn't require any special permissions
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plugin.manifest.requires_permissions.map((permission) => {
                      const isRevoked = revokedPermissions.has(permission);

                      return (
                        <div
                          key={permission}
                          className={cn(
                            'flex items-center justify-between p-4 rounded-lg border',
                            isRevoked
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Shield
                              className={cn(
                                'w-5 h-5 flex-shrink-0',
                                isRevoked
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-400'
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <code
                                className={cn(
                                  'text-sm font-mono block truncate',
                                  isRevoked
                                    ? 'text-red-900 dark:text-red-300'
                                    : 'text-gray-900 dark:text-white'
                                )}
                              >
                                {permission}
                              </code>
                              <p
                                className={cn(
                                  'text-xs mt-0.5',
                                  isRevoked
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-gray-500 dark:text-gray-400'
                                )}
                              >
                                {getPermissionDescription(permission)}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRevokePermission(permission)}
                            disabled={isRevoked || revokingPermission === permission}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
                              isRevoked
                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-red-600 text-white hover:bg-red-700'
                            )}
                          >
                            {isRevoked
                              ? 'Revoked'
                              : revokingPermission === permission
                              ? 'Revoking...'
                              : 'Revoke'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
