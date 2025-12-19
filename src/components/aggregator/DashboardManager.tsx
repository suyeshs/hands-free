/**
 * Aggregator Dashboard Manager Component
 * Controls for opening/closing embedded dashboards and managing selectors
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '../../lib/platform';
import { NeoButton } from '../ui-v2/NeoButton';
import { NeoCard } from '../ui-v2/NeoCard';

interface PlatformConfig {
  enabled: boolean;
  dashboardUrl: string;
  selectors: Record<string, string>;
  attributes: Record<string, string>;
  polling: {
    enabled: boolean;
    intervalMs: number;
    useObserver: boolean;
  };
  extraction: {
    skipProcessedOrders: boolean;
    maxOrdersPerScan: number;
    parseNumericValues: boolean;
  };
}

interface AggregatorConfig {
  version: string;
  lastUpdated: string;
  platforms: {
    swiggy: PlatformConfig;
    zomato: PlatformConfig;
  };
  global: {
    debugMode: boolean;
    logExtractions: boolean;
    notifyOnNewOrder: boolean;
    autoAcceptOrders: boolean;
  };
}

export function DashboardManager() {
  const [config, setConfig] = useState<AggregatorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractedCount, setExtractedCount] = useState(0);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const isDesktop = isTauri();

  // Load config on mount (only in Tauri)
  useEffect(() => {
    if (isDesktop) {
      loadConfig();
    } else {
      setLoading(false);
    }
  }, [isDesktop]);

  // Listen for extracted orders (only in Tauri)
  useEffect(() => {
    if (!isDesktop) return;

    const unlisten = listen('aggregator-orders-extracted', (event: any) => {
      const orders = event.payload;
      console.log('[DashboardManager] Received extracted orders:', orders.length);
      setExtractedCount(prev => prev + orders.length);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [isDesktop]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const cfg = await invoke<AggregatorConfig>('get_aggregator_config');
      setConfig(cfg);
    } catch (err) {
      setError(err as string);
      console.error('[DashboardManager] Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDashboard = async (platform: 'swiggy' | 'zomato') => {
    try {
      if (platform === 'swiggy') {
        await invoke('open_swiggy_dashboard');
      } else {
        await invoke('open_zomato_dashboard');
      }
      console.log(`[DashboardManager] Opened ${platform} dashboard`);
    } catch (err) {
      console.error(`[DashboardManager] Failed to open ${platform} dashboard:`, err);
      setError(err as string);
    }
  };

  const closeDashboard = async (platform: string) => {
    try {
      await invoke('close_dashboard', { platform });
      console.log(`[DashboardManager] Closed ${platform} dashboard`);
    } catch (err) {
      console.error(`[DashboardManager] Failed to close ${platform} dashboard:`, err);
    }
  };

  const reloadDashboard = async (platform: string) => {
    try {
      await invoke('reload_dashboard', { platform });
      console.log(`[DashboardManager] Reloaded ${platform} dashboard`);
    } catch (err) {
      console.error(`[DashboardManager] Failed to reload ${platform} dashboard:`, err);
    }
  };

  // Show web version with links
  if (!isDesktop) {
    return (
      <div className="space-y-4">
        <NeoCard className="p-6 bg-blue-900/10 border-blue-500/30">
          <div className="flex items-start gap-4">
            <span className="text-4xl">🖥️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-300 mb-2">Partner Dashboards</h4>
              <p className="text-sm text-gray-300 mb-3">
                Open partner dashboards in a new tab to manage orders manually.
              </p>
              <p className="text-xs text-gray-500 mb-4">
                For automatic order extraction, use the desktop version of the app which can embed dashboards directly.
              </p>

              {/* Quick access buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="https://partner.swiggy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <NeoButton
                    variant="primary"
                    className="w-full"
                  >
                    <span className="mr-2">🟠</span>
                    Open Swiggy Partner
                  </NeoButton>
                </a>

                <a
                  href="https://www.zomato.com/partners/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <NeoButton
                    variant="primary"
                    className="w-full"
                  >
                    <span className="mr-2">🔴</span>
                    Open Zomato Partner
                  </NeoButton>
                </a>
              </div>
            </div>
          </div>
        </NeoCard>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-gray-400">Loading configuration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400 font-semibold">Configuration Error</p>
          <p className="text-sm text-gray-400 mt-2">{error}</p>
          <p className="text-xs text-gray-500 mt-2">
            Make sure aggregator_selectors.json exists in src-tauri/configs/
          </p>
        </div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Aggregator Dashboards</h3>
          <p className="text-sm text-gray-400">
            Automatically extract orders from partner dashboards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-blue-900/30 rounded-lg text-sm text-blue-300">
            {extractedCount} orders extracted
          </div>
          <NeoButton
            onClick={() => setShowConfigEditor(!showConfigEditor)}
            variant="ghost"
            size="sm"
          >
            {showConfigEditor ? 'Hide' : 'Show'} Config
          </NeoButton>
        </div>
      </div>

      {/* Dashboard Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Swiggy */}
        <NeoCard className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🟠</span>
                <h4 className="text-lg font-bold text-white">Swiggy</h4>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {config.platforms.swiggy.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            {config.global.debugMode && (
              <div className="px-2 py-1 bg-yellow-900/30 rounded text-xs text-yellow-400">
                DEBUG
              </div>
            )}
          </div>

          <div className="space-y-2">
            <NeoButton
              onClick={() => openDashboard('swiggy')}
              variant="primary"
              className="w-full"
              disabled={!config.platforms.swiggy.enabled}
            >
              Open Dashboard
            </NeoButton>
            <div className="grid grid-cols-2 gap-2">
              <NeoButton
                onClick={() => closeDashboard('swiggy')}
                variant="ghost"
                size="sm"
              >
                Close
              </NeoButton>
              <NeoButton
                onClick={() => reloadDashboard('swiggy')}
                variant="ghost"
                size="sm"
              >
                Reload
              </NeoButton>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <p>• Polling: {config.platforms.swiggy.polling.intervalMs}ms</p>
            <p>• Observer: {config.platforms.swiggy.polling.useObserver ? 'Yes' : 'No'}</p>
            <p>• Max orders/scan: {config.platforms.swiggy.extraction.maxOrdersPerScan}</p>
          </div>
        </NeoCard>

        {/* Zomato */}
        <NeoCard className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔴</span>
                <h4 className="text-lg font-bold text-white">Zomato</h4>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {config.platforms.zomato.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            {config.global.debugMode && (
              <div className="px-2 py-1 bg-yellow-900/30 rounded text-xs text-yellow-400">
                DEBUG
              </div>
            )}
          </div>

          <div className="space-y-2">
            <NeoButton
              onClick={() => openDashboard('zomato')}
              variant="primary"
              className="w-full"
              disabled={!config.platforms.zomato.enabled}
            >
              Open Dashboard
            </NeoButton>
            <div className="grid grid-cols-2 gap-2">
              <NeoButton
                onClick={() => closeDashboard('zomato')}
                variant="ghost"
                size="sm"
              >
                Close
              </NeoButton>
              <NeoButton
                onClick={() => reloadDashboard('zomato')}
                variant="ghost"
                size="sm"
              >
                Reload
              </NeoButton>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <p>• Polling: {config.platforms.zomato.polling.intervalMs}ms</p>
            <p>• Observer: {config.platforms.zomato.polling.useObserver ? 'Yes' : 'No'}</p>
            <p>• Max orders/scan: {config.platforms.zomato.extraction.maxOrdersPerScan}</p>
          </div>
        </NeoCard>
      </div>

      {/* Instructions */}
      <NeoCard className="p-4 bg-blue-900/10 border-blue-500/30">
        <h4 className="font-semibold text-blue-300 mb-2">📋 How to Use</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>1. Click "Open Dashboard" to launch the partner portal</li>
          <li>2. Log in to your partner account (credentials are saved)</li>
          <li>3. Orders will be automatically extracted every 5 seconds</li>
          <li>4. Minimize the dashboard window - extraction continues in background</li>
          <li>5. Extracted orders appear in the Aggregator Dashboard</li>
        </ul>
      </NeoCard>

      {/* Config Editor (collapsed by default) */}
      {showConfigEditor && (
        <NeoCard className="p-4">
          <h4 className="font-semibold text-white mb-3">Configuration Preview</h4>
          <div className="bg-gray-900 rounded-lg p-3 overflow-auto max-h-96">
            <pre className="text-xs text-gray-300">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            To edit: Modify src-tauri/configs/aggregator_selectors.json and click Reload
          </p>
        </NeoCard>
      )}

      {/* Selector Update Guide */}
      <NeoCard className="p-4 bg-yellow-900/10 border-yellow-500/30">
        <h4 className="font-semibold text-yellow-300 mb-2">⚙️ Updating Selectors</h4>
        <div className="text-sm text-gray-300 space-y-2">
          <p>If orders aren't being extracted correctly:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Open the dashboard in a regular browser</li>
            <li>Right-click an order → Inspect Element</li>
            <li>Note the CSS classes and data attributes</li>
            <li>Update <code className="bg-gray-800 px-1 rounded">aggregator_selectors.json</code></li>
            <li>Click "Reload" button to apply changes</li>
          </ol>
          <p className="text-xs text-gray-500 mt-2">
            File location: <code className="bg-gray-800 px-1 rounded">src-tauri/configs/aggregator_selectors.json</code>
          </p>
        </div>
      </NeoCard>
    </div>
  );
}
