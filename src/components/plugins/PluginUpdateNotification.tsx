/**
 * Plugin Update Notification
 *
 * Shows a banner when plugin updates are available
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, X, AlertCircle, RefreshCw } from 'lucide-react';
import { checkForUpdates, type PluginUpdate } from '@/services/pluginRegistry';

export function PluginUpdateNotification() {
  const [updates, setUpdates] = useState<PluginUpdate[]>([]);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for updates on mount and every hour
    const check = async () => {
      try {
        setChecking(true);
        const available = await checkForUpdates();
        setUpdates(available);
      } catch (error) {
        console.error('[PluginUpdate] Failed to check for updates:', error);
      } finally {
        setChecking(false);
      }
    };

    check();

    // Check every hour
    const interval = setInterval(check, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, []);

  if (dismissed || updates.length === 0) return null;

  const criticalUpdates = updates.filter(u => u.urgency === 'critical');
  const highUpdates = updates.filter(u => u.urgency === 'high');

  // Determine banner color based on urgency
  const getColorClasses = () => {
    if (criticalUpdates.length > 0) {
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        icon: 'text-red-400',
        button: 'bg-red-600 hover:bg-red-700',
      };
    }
    if (highUpdates.length > 0) {
      return {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        icon: 'text-orange-400',
        button: 'bg-orange-600 hover:bg-orange-700',
      };
    }
    return {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: 'text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700',
    };
  };

  const colors = getColorClasses();

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top duration-300`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          {criticalUpdates.length > 0 ? (
            <AlertCircle className={`w-5 h-5 ${colors.icon}`} />
          ) : (
            <Download className={`w-5 h-5 ${colors.icon}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white mb-1">
            {criticalUpdates.length > 0 && (
              <span className="text-red-400">Critical Update Available</span>
            )}
            {criticalUpdates.length === 0 && updates.length === 1 && (
              <span>Plugin Update Available</span>
            )}
            {criticalUpdates.length === 0 && updates.length > 1 && (
              <span>{updates.length} Plugin Updates Available</span>
            )}
          </h3>

          <div className="text-sm text-gray-400 space-y-1">
            {updates.slice(0, 3).map((update) => (
              <div key={update.id} className="flex items-center gap-2">
                <span className="font-medium text-white">{update.name}</span>
                <span className="text-gray-500">
                  {update.currentVersion} → {update.latestVersion}
                </span>
                {update.security_patch && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                    Security
                  </span>
                )}
                {update.breaking_changes && (
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                    Breaking
                  </span>
                )}
              </div>
            ))}
            {updates.length > 3 && (
              <span className="text-gray-500">
                +{updates.length - 3} more...
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {checking && (
            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
          )}

          <button
            onClick={() => navigate('/settings')}
            className={`${colors.button} text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium`}
          >
            Update Now
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
