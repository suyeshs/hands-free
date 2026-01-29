/**
 * Plugin Uninstall Modal
 * Safely uninstall plugin with data handling options
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Archive, Download, Trash2, Shield } from 'lucide-react';
import { usePluginManager } from '@/hooks/usePluginManager';
import type { InstalledPlugin } from '@/types/plugin';
import { cn } from '@/lib/utils';

interface Props {
  plugin: InstalledPlugin;
  onClose: () => void;
}

export function PluginUninstallModal({ plugin, onClose }: Props) {
  const { uninstallPlugin } = usePluginManager();

  const [dataHandling, setDataHandling] = useState<'archive' | 'export' | 'delete'>(
    plugin.manifest.data?.uninstall_behavior || 'archive'
  );
  const [createSnapshot, setCreateSnapshot] = useState(true);
  const [uninstalling, setUninstalling] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const hasData =
    plugin.manifest.data?.tables && plugin.manifest.data.tables.length > 0;

  const handleUninstall = async () => {
    if (confirmText !== plugin.manifest.name) {
      alert('Please type the plugin name exactly to confirm');
      return;
    }

    setUninstalling(true);

    const result = await uninstallPlugin(plugin.manifest.id, {
      dataHandling,
      createSnapshot,
      force: false,
    });

    setUninstalling(false);

    if (result.success) {
      alert(`${plugin.manifest.name} uninstalled successfully`);
      onClose();
    } else {
      alert(`Failed to uninstall: ${result.error}`);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Uninstall Plugin
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

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Warning */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>Warning:</strong> Uninstalling this plugin will remove all its functionality
                from your system. Make sure you understand the impact before proceeding.
              </p>
            </div>

            {/* Data Handling Options */}
            {hasData && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  What should we do with plugin data?
                </h3>
                <div className="space-y-2">
                  {/* Archive */}
                  <button
                    onClick={() => setDataHandling('archive')}
                    className={cn(
                      'w-full flex items-start gap-3 p-4 rounded-lg border transition-all text-left',
                      dataHandling === 'archive'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <Archive
                      className={cn(
                        'w-5 h-5 flex-shrink-0 mt-0.5',
                        dataHandling === 'archive'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400'
                      )}
                    />
                    <div className="flex-1">
                      <h4
                        className={cn(
                          'font-medium mb-1',
                          dataHandling === 'archive'
                            ? 'text-blue-900 dark:text-blue-300'
                            : 'text-gray-900 dark:text-white'
                        )}
                      >
                        Archive (Recommended)
                      </h4>
                      <p
                        className={cn(
                          'text-xs',
                          dataHandling === 'archive'
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400'
                        )}
                      >
                        Keep data in database. You can rollback within 30 days to restore the plugin
                        with all data intact.
                      </p>
                    </div>
                    {dataHandling === 'archive' && (
                      <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </button>

                  {/* Export */}
                  <button
                    onClick={() => setDataHandling('export')}
                    className={cn(
                      'w-full flex items-start gap-3 p-4 rounded-lg border transition-all text-left',
                      dataHandling === 'export'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <Download
                      className={cn(
                        'w-5 h-5 flex-shrink-0 mt-0.5',
                        dataHandling === 'export'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400'
                      )}
                    />
                    <div className="flex-1">
                      <h4
                        className={cn(
                          'font-medium mb-1',
                          dataHandling === 'export'
                            ? 'text-blue-900 dark:text-blue-300'
                            : 'text-gray-900 dark:text-white'
                        )}
                      >
                        Export to File
                      </h4>
                      <p
                        className={cn(
                          'text-xs',
                          dataHandling === 'export'
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400'
                        )}
                      >
                        Export data to JSON file, then remove from database. Data can be backed up
                        externally.
                      </p>
                    </div>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDataHandling('delete')}
                    className={cn(
                      'w-full flex items-start gap-3 p-4 rounded-lg border transition-all text-left',
                      dataHandling === 'delete'
                        ? 'border-red-600 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <Trash2
                      className={cn(
                        'w-5 h-5 flex-shrink-0 mt-0.5',
                        dataHandling === 'delete'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-400'
                      )}
                    />
                    <div className="flex-1">
                      <h4
                        className={cn(
                          'font-medium mb-1',
                          dataHandling === 'delete'
                            ? 'text-red-900 dark:text-red-300'
                            : 'text-gray-900 dark:text-white'
                        )}
                      >
                        Permanently Delete
                      </h4>
                      <p
                        className={cn(
                          'text-xs',
                          dataHandling === 'delete'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-gray-600 dark:text-gray-400'
                        )}
                      >
                        Permanently delete all plugin data. This action cannot be undone.
                      </p>
                    </div>
                    {dataHandling === 'delete' && (
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                  </button>
                </div>

                {/* Show affected tables */}
                {plugin.manifest.data?.tables && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Affected tables:
                    </p>
                    <div className="flex flex-wrap gap-1">
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
              </div>
            )}

            {/* Rollback Option */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createSnapshot}
                  onChange={(e) => setCreateSnapshot(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Create rollback snapshot
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Allow restoration within 30 days (recommended)
                  </p>
                </div>
              </label>
            </div>

            {/* Confirmation Input */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Type <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                  {plugin.manifest.name}
                </code> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={plugin.manifest.name}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleUninstall}
              disabled={uninstalling || confirmText !== plugin.manifest.name}
              className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uninstalling ? 'Uninstalling...' : 'Uninstall Plugin'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
