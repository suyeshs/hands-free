/**
 * Aggregator Settings Page
 * Manage partner dashboard logins (Swiggy/Zomato)
 * Access via main settings menu
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AppShell } from '../components/layout-v2/AppShell';
import { NeoCard } from '../components/ui-v2/NeoCard';
import { NeoButton } from '../components/ui-v2/NeoButton';
import { AutoAcceptSettings } from '../components/aggregator/AutoAcceptSettings';
import { isTauri, hasTauriAPI } from '../lib/platform';

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

// Hook to detect screen size
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export default function AggregatorSettings() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AggregatorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractedCount, setExtractedCount] = useState(0);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showAutoAccept, setShowAutoAccept] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [historyFetchResult, setHistoryFetchResult] = useState<{ platform: string; count: number } | null>(null);
  const isDesktop = isTauri();

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 639px)');

  // Detect if running on Android/mobile browser
  const isAndroidOrMobileBrowser = typeof navigator !== 'undefined' && (
    /Android/i.test(navigator.userAgent) ||
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (isMobile && !hasTauriAPI())
  );

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
      console.log('[AggregatorSettings] Received extracted orders:', orders.length);
      setExtractedCount(prev => prev + orders.length);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [isDesktop]);

  // Listen for history extraction completion
  useEffect(() => {
    if (!isDesktop) return;

    const unlisten = listen('history-extraction-complete', (event: any) => {
      const { platform, count } = event.payload;
      console.log('[AggregatorSettings] History extraction complete:', platform, count);
      setIsFetchingHistory(false);
      setHistoryFetchResult({ platform, count });
      // Clear result after 5 seconds
      setTimeout(() => setHistoryFetchResult(null), 5000);
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
      console.error('[AggregatorSettings] Failed to load config:', err);
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
      console.log(`[AggregatorSettings] Opened ${platform} dashboard`);
    } catch (err) {
      console.error(`[AggregatorSettings] Failed to open ${platform} dashboard:`, err);
      setError(err as string);
    }
  };

  const closeDashboard = async (platform: string) => {
    try {
      await invoke('close_dashboard', { platform });
      console.log(`[AggregatorSettings] Closed ${platform} dashboard`);
    } catch (err) {
      console.error(`[AggregatorSettings] Failed to close ${platform} dashboard:`, err);
    }
  };

  const reloadDashboard = async (platform: string) => {
    try {
      await invoke('reload_dashboard', { platform });
      console.log(`[AggregatorSettings] Reloaded ${platform} dashboard`);
    } catch (err) {
      console.error(`[AggregatorSettings] Failed to reload ${platform} dashboard:`, err);
    }
  };

  const openBothDashboards = async () => {
    try {
      await invoke('open_unified_aggregator');
      console.log('[AggregatorSettings] Opened both dashboards side-by-side');
    } catch (err) {
      console.error('[AggregatorSettings] Failed to open both dashboards:', err);
      setError(err as string);
    }
  };

  const closeBothDashboards = async () => {
    try {
      await invoke('close_unified_aggregator');
      console.log('[AggregatorSettings] Closed both dashboards');
    } catch (err) {
      console.error('[AggregatorSettings] Failed to close both dashboards:', err);
    }
  };

  const fetchHistoricalOrders = async (platform: 'swiggy' | 'zomato', days: number = 2) => {
    try {
      setIsFetchingHistory(true);
      setHistoryFetchResult(null);

      // First, make sure the dashboard is open
      if (platform === 'swiggy') {
        await invoke('open_swiggy_dashboard');
      } else {
        await invoke('open_zomato_dashboard');
      }

      // Wait for dashboard to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Trigger history fetch via eval in the dashboard webview
      await invoke('eval_in_dashboard', {
        platform,
        script: `window.fetchAggregatorHistory(${days})`
      });

      console.log(`[AggregatorSettings] Started history fetch for ${platform}, ${days} days`);
    } catch (err) {
      console.error(`[AggregatorSettings] Failed to fetch ${platform} history:`, err);
      setError(err as string);
      setIsFetchingHistory(false);
    }
  };

  // Navigation items
  const navItems = [
    { id: 'aggregator', label: 'Orders', icon: '📦', path: '/aggregator' },
    { id: 'kitchen', label: 'Kitchen', icon: '👨‍🍳', path: '/kitchen' },
    { id: 'manager', label: 'Manager', icon: '📊', path: '/manager' },
  ];

  return (
    <AppShell
      navItems={navItems}
      activeNavId="aggregator"
      onNavigate={(_id, path) => navigate(path)}
      className={isMobile ? 'p-3 pb-24' : 'p-6 pb-24'}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/aggregator')}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <div>
                <h1 className={isMobile ? 'text-xl font-bold text-foreground' : 'text-2xl font-bold text-foreground'}>
                  Aggregator Settings
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage partner dashboard connections
                </p>
              </div>
            </div>
          </div>
          {isDesktop && extractedCount > 0 && (
            <div className="px-3 py-1 bg-emerald-900/30 rounded-lg text-sm text-emerald-300">
              {extractedCount} orders extracted
            </div>
          )}
        </div>

        {/* Desktop: Partner Dashboard Controls */}
        {isDesktop && !isAndroidOrMobileBrowser && (
          <>
            {loading && (
              <NeoCard className="p-6">
                <p className="text-muted-foreground">Loading configuration...</p>
              </NeoCard>
            )}

            {error && (
              <NeoCard className="p-6 bg-red-900/10 border-red-500/30">
                <p className="text-red-400 font-semibold">Configuration Error</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Make sure aggregator_selectors.json exists in src-tauri/configs/
                </p>
              </NeoCard>
            )}

            {config && (
              <div className="space-y-4">
                {/* Open Both Button - Primary Action */}
                <NeoCard className="p-5 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-2 border-orange-500/30">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <span className="text-3xl">🟠</span>
                        <span className="text-3xl">🔴</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-foreground">Split Screen View</h4>
                        <p className="text-sm text-muted-foreground">Open Swiggy & Zomato side-by-side</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <NeoButton
                        onClick={openBothDashboards}
                        variant="primary"
                        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                        disabled={!config.platforms.swiggy.enabled && !config.platforms.zomato.enabled}
                      >
                        Open Both
                      </NeoButton>
                      <NeoButton
                        onClick={closeBothDashboards}
                        variant="ghost"
                        size="sm"
                      >
                        Close All
                      </NeoButton>
                    </div>
                  </div>
                </NeoCard>

                {/* Dashboard Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Swiggy */}
                  <NeoCard className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">🟠</span>
                          <h4 className="text-xl font-bold text-foreground">Swiggy</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {config.platforms.swiggy.enabled ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      {config.global.debugMode && (
                        <div className="px-2 py-1 bg-yellow-900/30 rounded text-xs text-yellow-400">
                          DEBUG
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <NeoButton
                        onClick={() => openDashboard('swiggy')}
                        variant="primary"
                        className="w-full"
                        disabled={!config.platforms.swiggy.enabled}
                      >
                        Open Swiggy Dashboard
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

                    <div className="mt-4 pt-3 border-t border-zinc-700/50 text-xs text-muted-foreground space-y-1">
                      <p>Polling: {config.platforms.swiggy.polling.intervalMs}ms</p>
                      <p>Observer: {config.platforms.swiggy.polling.useObserver ? 'Yes' : 'No'}</p>
                      <p>Max orders/scan: {config.platforms.swiggy.extraction.maxOrdersPerScan}</p>
                    </div>
                  </NeoCard>

                  {/* Zomato */}
                  <NeoCard className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">🔴</span>
                          <h4 className="text-xl font-bold text-foreground">Zomato</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {config.platforms.zomato.enabled ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      {config.global.debugMode && (
                        <div className="px-2 py-1 bg-yellow-900/30 rounded text-xs text-yellow-400">
                          DEBUG
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <NeoButton
                        onClick={() => openDashboard('zomato')}
                        variant="primary"
                        className="w-full"
                        disabled={!config.platforms.zomato.enabled}
                      >
                        Open Zomato Dashboard
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

                    <div className="mt-4 pt-3 border-t border-zinc-700/50 text-xs text-muted-foreground space-y-1">
                      <p>Polling: {config.platforms.zomato.polling.intervalMs}ms</p>
                      <p>Observer: {config.platforms.zomato.polling.useObserver ? 'Yes' : 'No'}</p>
                      <p>Max orders/scan: {config.platforms.zomato.extraction.maxOrdersPerScan}</p>
                    </div>
                  </NeoCard>
                </div>

                {/* Instructions */}
                <NeoCard className="p-4 bg-blue-900/10 border-blue-500/30">
                  <h4 className="font-semibold text-blue-300 mb-2">How to Use</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>1. Click "Open Dashboard" to launch the partner portal</li>
                    <li>2. Log in to your partner account (credentials are saved)</li>
                    <li>3. Orders will be automatically extracted every 5 seconds</li>
                    <li>4. Minimize the dashboard window - extraction continues in background</li>
                    <li>5. Extracted orders appear in the Aggregator Dashboard</li>
                  </ul>
                </NeoCard>

                {/* Historical Order Fetch */}
                <NeoCard className="p-5 bg-purple-900/10 border-purple-500/30">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-purple-300 text-lg flex items-center gap-2">
                        <span>📜</span> Fetch Past Orders
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Import historical orders from the past 2 days for sales reporting
                      </p>
                    </div>
                  </div>

                  {historyFetchResult && (
                    <div className="mb-4 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
                      <p className="text-emerald-300 text-sm">
                        ✅ Fetched {historyFetchResult.count} orders from {historyFetchResult.platform}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NeoButton
                      onClick={() => fetchHistoricalOrders('swiggy', 2)}
                      variant="default"
                      className="bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30"
                      disabled={isFetchingHistory || !config?.platforms.swiggy.enabled}
                    >
                      {isFetchingHistory ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span> Fetching...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span>🟠</span> Fetch Swiggy History
                        </span>
                      )}
                    </NeoButton>
                    <NeoButton
                      onClick={() => fetchHistoricalOrders('zomato', 2)}
                      variant="default"
                      className="bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
                      disabled={isFetchingHistory || !config?.platforms.zomato.enabled}
                    >
                      {isFetchingHistory ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span> Fetching...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span>🔴</span> Fetch Zomato History
                        </span>
                      )}
                    </NeoButton>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    This will open the dashboard, navigate to Past Orders, and import recent orders.
                    Use this if live extraction missed some orders.
                  </p>
                </NeoCard>

                {/* Config Editor Toggle */}
                <div className="flex justify-end">
                  <NeoButton
                    onClick={() => setShowConfigEditor(!showConfigEditor)}
                    variant="ghost"
                    size="sm"
                  >
                    {showConfigEditor ? 'Hide' : 'Show'} Advanced Config
                  </NeoButton>
                </div>

                {/* Config Editor */}
                {showConfigEditor && (
                  <NeoCard className="p-4">
                    <h4 className="font-semibold text-foreground mb-3">Configuration Preview</h4>
                    <div className="bg-zinc-900 rounded-lg p-3 overflow-auto max-h-96">
                      <pre className="text-xs text-muted-foreground">
                        {JSON.stringify(config, null, 2)}
                      </pre>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      To edit: Modify src-tauri/configs/aggregator_selectors.json and click Reload
                    </p>
                  </NeoCard>
                )}

                {/* Selector Update Guide */}
                {showConfigEditor && (
                  <NeoCard className="p-4 bg-yellow-900/10 border-yellow-500/30">
                    <h4 className="font-semibold text-yellow-300 mb-2">Updating Selectors</h4>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>If orders aren't being extracted correctly:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Open the dashboard in a regular browser</li>
                        <li>Right-click an order → Inspect Element</li>
                        <li>Note the CSS classes and data attributes</li>
                        <li>Update aggregator_selectors.json</li>
                        <li>Click "Reload" button to apply changes</li>
                      </ol>
                    </div>
                  </NeoCard>
                )}
              </div>
            )}
          </>
        )}

        {/* Mobile/Web: External Links */}
        {(isAndroidOrMobileBrowser || !isDesktop) && (
          <NeoCard className="p-5">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🔗</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground text-lg">
                    Partner Dashboards
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Open Swiggy/Zomato partner portals to manage orders. For automatic extraction, use the desktop app.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="https://partner.swiggy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-orange-500/10 border-2 border-orange-500/30 text-orange-600 dark:text-orange-400 font-bold hover:bg-orange-500/20 transition-colors"
                >
                  <span className="text-xl">🟠</span>
                  <span>Swiggy Partner</span>
                  <span className="text-sm">↗</span>
                </a>
                <a
                  href="https://www.zomato.com/partners/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30 text-red-600 dark:text-red-400 font-bold hover:bg-red-500/20 transition-colors"
                >
                  <span className="text-xl">🔴</span>
                  <span>Zomato Partner</span>
                  <span className="text-sm">↗</span>
                </a>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-blue-500">ℹ️</span>
                <p className="text-xs text-blue-300">
                  Orders from aggregators sync automatically when the desktop app extracts them.
                </p>
              </div>
            </div>
          </NeoCard>
        )}

        {/* Auto-Accept Settings Section */}
        <NeoCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-foreground text-lg">Auto-Accept Rules</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Configure automatic order acceptance based on rules
              </p>
            </div>
            <NeoButton
              onClick={() => setShowAutoAccept(true)}
              variant="default"
              size="sm"
            >
              Configure
            </NeoButton>
          </div>
        </NeoCard>
      </div>

      {/* Auto-Accept Settings Modal */}
      <AutoAcceptSettings
        isOpen={showAutoAccept}
        onClose={() => setShowAutoAccept(false)}
      />
    </AppShell>
  );
}
