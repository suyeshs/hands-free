/**
 * D1 Database Status Card
 * Shows the provisioning status of Cloudflare D1 database
 */

import { useEffect, useState } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';

interface D1Status {
  isProvisioned: boolean;
  tableCount: number;
  requiredTables: number;
  missingTables: string[];
  lastChecked: string;
  error?: string;
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
          tableCount: 0,
          requiredTables: 45,
          missingTables: [],
          lastChecked: new Date().toISOString(),
          error: 'Online features are disabled in Settings'
        });
        return;
      }

      // Try to fetch D1 status from worker
      const tenantId = localStorage.getItem('tenantId');
      const apiUrl = localStorage.getItem('api-base-url') || process.env.VITE_API_URL;

      if (!apiUrl) {
        setStatus({
          isProvisioned: false,
          tableCount: 0,
          requiredTables: 45,
          missingTables: [],
          lastChecked: new Date().toISOString(),
          error: 'No API URL configured'
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
        isProvisioned: data.tableCount === 45,
        tableCount: data.tableCount || 0,
        requiredTables: 45,
        missingTables: data.missingTables || [],
        lastChecked: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error('[D1StatusCard] Check failed:', error);
      setStatus({
        isProvisioned: false,
        tableCount: 0,
        requiredTables: 45,
        missingTables: [],
        lastChecked: new Date().toISOString(),
        error: error.message === 'HTTP 404'
          ? 'D1 status endpoint not available'
          : 'Cannot connect to cloud service'
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
  const progress = (status.tableCount / status.requiredTables) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-gradient-to-br border rounded-2xl p-6 relative overflow-hidden",
        isProvisioned
          ? "from-green-500/10 via-emerald-500/10 to-teal-500/10 border-green-500/30"
          : "from-orange-500/10 via-amber-500/10 to-yellow-500/10 border-amber-500/30"
      )}
    >
      {/* Status Header */}
      <div className="flex items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            isProvisioned
              ? "bg-gradient-to-br from-green-500 to-emerald-500"
              : "bg-gradient-to-br from-amber-500 to-orange-500"
          )}>
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-warm-white flex items-center gap-2">
              D1 Cloud Database
              {isProvisioned && (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              )}
              {!isProvisioned && status.error && (
                <AlertCircle className="w-5 h-5 text-amber-400" />
              )}
            </h3>
            <p className="text-sm text-gray-400">
              {isProvisioned ? 'Fully Provisioned' : 'Setup Required'}
            </p>
          </div>
        </div>
      </div>

      {/* Status Content */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Tables Provisioned</span>
            <span className={cn(
              "font-bold",
              isProvisioned ? "text-green-400" : "text-amber-400"
            )}>
              {status.tableCount} / {status.requiredTables}
            </span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn(
                "h-full",
                isProvisioned
                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                  : "bg-gradient-to-r from-amber-500 to-orange-500"
              )}
            />
          </div>
        </div>

        {/* Error Message */}
        {status.error && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-300">
                  {status.error}
                </div>
                {status.error.includes('Online features') && (
                  <div className="text-xs text-gray-400 mt-1">
                    Enable in Settings → Restaurant Settings → Activate Online
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Status */}
        {isProvisioned && !status.error && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <div className="text-sm text-green-300">
                All {status.requiredTables} tables are ready for cloud sync
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Multi-device sync is active and operational
            </div>
          </div>
        )}

        {/* Setup Required */}
        {!isProvisioned && !status.error && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-sm font-semibold text-amber-300 mb-1">
                Cloud Database Setup Required
              </div>
              <div className="text-xs text-gray-400">
                Run the D1 migration to enable multi-device sync
              </div>
            </div>

            {/* Setup Instructions Button */}
            <button
              onClick={() => {
                // Open provisioning guide
                window.open('https://github.com/yourusername/restaurant-pos-ai/blob/main/D1_PROVISIONING_GUIDE.md', '_blank');
              }}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View Setup Guide</span>
            </button>

            {/* Quick Command */}
            <div className="p-3 rounded-lg bg-surface border border-border">
              <div className="text-xs text-gray-400 mb-2">Run this command:</div>
              <code className="text-xs text-cyan-400 block font-mono break-all">
                wrangler d1 execute your-db-name --file=./docs/d1-complete-migration.sql
              </code>
            </div>
          </div>
        )}

        {/* Missing Tables Info */}
        {!isProvisioned && status.missingTables.length > 0 && (
          <details className="text-xs">
            <summary className="text-gray-400 cursor-pointer hover:text-gray-300">
              View missing tables ({status.missingTables.length})
            </summary>
            <div className="mt-2 p-2 rounded bg-surface max-h-32 overflow-y-auto">
              <ul className="space-y-1">
                {status.missingTables.slice(0, 10).map((table) => (
                  <li key={table} className="text-gray-500">• {table}</li>
                ))}
                {status.missingTables.length > 10 && (
                  <li className="text-gray-600">
                    ... and {status.missingTables.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          </details>
        )}

        {/* Last Checked */}
        <div className="text-xs text-gray-500 text-center">
          Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}
