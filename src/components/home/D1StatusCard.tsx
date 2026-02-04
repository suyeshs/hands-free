/**
 * Cloud Sync Status Card
 * Shows the status of cloud synchronization
 */

import { useEffect, useState } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';

interface D1Status {
  isProvisioned: boolean;
  isOnline: boolean;
  lastChecked: string;
  error?: string;
  message?: string;
}

export function D1StatusCard() {
  const { settings } = useRestaurantSettingsStore();
  const [status, setStatus] = useState<D1Status | null>(null);

  const checkD1Status = async () => {
    try {
      // Check if online features are enabled from restaurant settings store
      const onlineEnabled = settings.posSettings?.activateOnline ?? false;

      if (!onlineEnabled) {
        setStatus({
          isProvisioned: false,
          isOnline: false,
          lastChecked: new Date().toISOString(),
          message: 'Cloud sync is disabled. Enable in Settings to sync across devices.'
        });
        return;
      }

      // Try to fetch D1 status from worker
      const tenantId = localStorage.getItem('tenantId');
      const apiUrl = localStorage.getItem('api-base-url') || process.env.VITE_API_URL;

      if (!apiUrl) {
        setStatus({
          isProvisioned: false,
          isOnline: false,
          lastChecked: new Date().toISOString(),
          error: 'Restaurant not activated yet'
        });
        return;
      }

      const response = await fetch(`${apiUrl}/api/d1-status/${tenantId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      setStatus({
        isProvisioned: data.isProvisioned || false,
        isOnline: true,
        lastChecked: new Date().toISOString(),
        message: data.message || 'Cloud sync is active'
      });

    } catch (error: any) {
      console.error('[D1StatusCard] Check failed:', error);
      setStatus({
        isProvisioned: false,
        isOnline: false,
        lastChecked: new Date().toISOString(),
        error: 'Cannot connect to cloud. Check internet connection.'
      });
    }
  };

  useEffect(() => {
    checkD1Status();
    // Auto-refresh every 5 minutes
    const interval = setInterval(checkD1Status, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return (
      <div className="bg-gradient-to-br from-surface-2 to-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-white animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-warm-white">Checking D1 Status...</h3>
            <p className="text-sm text-gray-400">Connecting to cloud database</p>
          </div>
        </div>
      </div>
    );
  }

  const isProvisioned = status.isProvisioned;
  const isOnline = status.isOnline;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-gradient-to-br border rounded-2xl p-6 relative overflow-hidden",
        isProvisioned && isOnline
          ? "from-green-500/10 via-emerald-500/10 to-teal-500/10 border-green-500/30"
          : isOnline
          ? "from-blue-500/10 via-cyan-500/10 to-sky-500/10 border-blue-500/30"
          : "from-gray-500/10 via-slate-500/10 to-zinc-500/10 border-gray-500/30"
      )}
    >
      {/* Status Header */}
      <div className="flex items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            isProvisioned && isOnline
              ? "bg-gradient-to-br from-green-500 to-emerald-500"
              : isOnline
              ? "bg-gradient-to-br from-blue-500 to-cyan-500"
              : "bg-gradient-to-br from-gray-500 to-slate-500"
          )}>
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-warm-white flex items-center gap-2">
              Cloud Sync Status
              {isProvisioned && isOnline && (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              )}
              {status.error && (
                <AlertCircle className="w-5 h-5 text-amber-400" />
              )}
            </h3>
            <p className="text-sm text-gray-400">
              {isProvisioned && isOnline ? 'Active & Syncing' : !isOnline ? 'Offline Mode' : 'Ready to Configure'}
            </p>
          </div>
        </div>
      </div>

      {/* Status Content */}
      <div className="space-y-4">
        {/* Status Message */}
        {status.message && (
          <div className={cn(
            "p-3 rounded-lg border",
            isProvisioned && isOnline
              ? "bg-green-500/10 border-green-500/20"
              : isOnline
              ? "bg-blue-500/10 border-blue-500/20"
              : "bg-gray-500/10 border-gray-500/20"
          )}>
            <div className="flex items-center gap-2">
              {isProvisioned && isOnline && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
              {!isOnline && <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              <div className={cn(
                "text-sm",
                isProvisioned && isOnline ? "text-green-300" : isOnline ? "text-blue-300" : "text-gray-400"
              )}>
                {status.message}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {status.error && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-300">
                  {status.error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button - Enable Cloud Sync */}
        {!isOnline && !status.error && (
          <button
            onClick={() => {
              window.location.href = '/settings';
            }}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
          >
            <Database className="w-4 h-4" />
            <span>Enable Cloud Sync</span>
          </button>
        )}

        {/* Last Checked */}
        <div className="text-xs text-gray-500 text-center">
          Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}
