/**
 * Diagnostics Page
 * Shows device settings, sync status, errors, and system health
 * Useful for debugging sync issues across devices
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantStore } from '../stores/tenantStore';
import { useAuthStore } from '../stores/authStore';
import { useDeviceStore, DeviceMode } from '../stores/deviceStore';
import { isTauri } from '../lib/platform';
import { aggregatorSyncService } from '../lib/aggregatorSyncService';
import { tableSessionService } from '../lib/tableSessionService';
import { orderSyncService } from '../lib/orderSyncService';
import { usePOSStore } from '../stores/posStore';
import { useKDSStore } from '../stores/kdsStore';
import { Monitor, Wifi, Settings2 } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

interface SyncStatus {
  cloudSync: {
    enabled: boolean;
    lastSync: string | null;
    syncedCount: number;
    pendingCount: number;
    errors: string[];
  };
  webSocket: {
    status: 'connected' | 'connecting' | 'disconnected';
    url: string | null;
    lastMessage: string | null;
    cloudStatus?: 'connected' | 'connecting' | 'disconnected';
    lanStatus?: 'connected' | 'connecting' | 'disconnected';
    activePath?: 'cloud' | 'lan' | 'both' | 'none';
  };
  localDb: {
    orderCount: number;
    unsyncedCount: number;
  };
}

// Capture console logs
const capturedLogs: LogEntry[] = [];
const MAX_LOGS = 200;

function captureLog(level: 'info' | 'warn' | 'error', source: string, message: string) {
  capturedLogs.unshift({
    timestamp: new Date().toISOString(),
    level,
    source,
    message: typeof message === 'string' ? message : JSON.stringify(message),
  });
  if (capturedLogs.length > MAX_LOGS) {
    capturedLogs.pop();
  }
}

// Override console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args: any[]) => {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  if (msg.includes('[') && msg.includes(']')) {
    const match = msg.match(/\[([^\]]+)\]/);
    if (match) {
      captureLog('info', match[1], msg);
    }
  }
  originalConsoleLog.apply(console, args);
};

console.warn = (...args: any[]) => {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  captureLog('warn', 'WARN', msg);
  originalConsoleWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  captureLog('error', 'ERROR', msg);
  originalConsoleError.apply(console, args);
};

// Tab type
type TabType = 'device' | 'diagnostics';

// ============== DEVICE SETTINGS TAB ==============
function DeviceSettingsTab() {
  const { deviceMode, setDeviceMode, isLocked, setLocked, lanServerStatus, lanClientStatus, isLanConnected } = useDeviceStore();
  const { tenant } = useTenantStore();

  // Get connected clients from LAN server status
  const connectedClients = lanServerStatus?.connectedClients || [];

  const deviceModes: { mode: DeviceMode; label: string; description: string }[] = [
    { mode: 'owner', label: 'Owner', description: 'Full access owner mode' },
    { mode: 'pos', label: 'POS Terminal', description: 'Point of Sale - runs LAN server' },
    { mode: 'kds', label: 'Kitchen Display', description: 'Kitchen Display System - connects to POS' },
    { mode: 'bds', label: 'Bar Display', description: 'Bar Display System - connects to POS' },
    { mode: 'aggregator', label: 'Aggregator', description: 'Delivery order management' },
    { mode: 'customer', label: 'Customer Display', description: 'Customer-facing display' },
    { mode: 'manager', label: 'Manager', description: 'Full access manager mode' },
  ];

  return (
    <div className="space-y-4">
      {/* Device Mode Selection */}
      <div className="border-2 border-gray-900 bg-white p-4">
        <h3 className="font-black uppercase text-sm mb-3 border-b border-gray-300 pb-2 flex items-center gap-2">
          <Monitor size={16} />
          Device Mode
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {deviceModes.map(({ mode, label, description }) => (
            <button
              key={mode}
              onClick={() => setDeviceMode(mode)}
              className={`p-3 text-left border-2 transition-colors ${
                deviceMode === mode
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-400 bg-gray-50'
              }`}
            >
              <div className="font-bold text-sm">{label}</div>
              <div className="text-xs text-gray-500">{description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Lock Mode */}
      <div className="border-2 border-gray-900 bg-white p-4">
        <h3 className="font-black uppercase text-sm mb-3 border-b border-gray-300 pb-2 flex items-center gap-2">
          <Settings2 size={16} />
          Lock Mode
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Device Locked</p>
            <p className="text-xs text-gray-500">Locks device to current mode, prevents navigation</p>
          </div>
          <button
            onClick={() => setLocked(!isLocked)}
            className={`px-4 py-2 font-bold text-sm uppercase ${
              isLocked
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isLocked ? 'Locked' : 'Unlocked'}
          </button>
        </div>
      </div>

      {/* LAN Sync Status */}
      <div className="border-2 border-gray-900 bg-white p-4">
        <h3 className="font-black uppercase text-sm mb-3 border-b border-gray-300 pb-2 flex items-center gap-2">
          <Wifi size={16} />
          LAN Sync Status
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200">
            <span className="text-sm font-bold">LAN Connection</span>
            <span className={`px-2 py-1 text-xs font-bold uppercase ${
              isLanConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {isLanConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {lanServerStatus && (
            <div className="p-2 bg-blue-50 border border-blue-200">
              <p className="text-xs font-bold text-blue-800 uppercase mb-1">Server Status</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Port: <span className="font-mono">{lanServerStatus.port || 'N/A'}</span></div>
                <div>Clients: <span className="font-mono">{lanServerStatus.connectedClients?.length || 0}</span></div>
              </div>
            </div>
          )}

          {lanClientStatus && (
            <div className="p-2 bg-purple-50 border border-purple-200">
              <p className="text-xs font-bold text-purple-800 uppercase mb-1">Client Status</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Server: <span className="font-mono truncate">{lanClientStatus.serverAddress || 'N/A'}</span></div>
                <div>Connected: <span className="font-mono">{lanClientStatus.isConnected ? 'Yes' : 'No'}</span></div>
              </div>
            </div>
          )}

          {!lanServerStatus && !lanClientStatus && (
            <p className="text-xs text-gray-500 italic">
              {deviceMode === 'pos' ? 'LAN server not running' : 'Not connected to LAN server'}
            </p>
          )}
        </div>
      </div>

      {/* Connected Devices */}
      {deviceMode === 'pos' && (
        <div className="border-2 border-gray-900 bg-white p-4">
          <h3 className="font-black uppercase text-sm mb-3 border-b border-gray-300 pb-2 flex items-center gap-2">
            <Monitor size={16} />
            Connected Devices ({connectedClients.length})
          </h3>
          {connectedClients.length > 0 ? (
            <div className="space-y-2">
              {connectedClients.map((client) => (
                <div
                  key={client.clientId}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      client.deviceType === 'kds' ? 'bg-green-500' :
                      client.deviceType === 'bds' ? 'bg-blue-500' :
                      client.deviceType === 'manager' ? 'bg-purple-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <p className="font-bold text-sm uppercase">{client.deviceType}</p>
                      <p className="text-xs text-gray-500 font-mono">{client.ipAddress}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Connected</p>
                    <p className="text-xs font-mono">
                      {new Date(client.connectedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">No devices connected</p>
              <p className="text-xs text-gray-400 mt-1">
                KDS and BDS devices will appear here when they connect to this POS
              </p>
            </div>
          )}
        </div>
      )}

      {/* Server Info (when connected as client) */}
      {deviceMode !== 'pos' && lanClientStatus?.serverInfo && (
        <div className="border-2 border-gray-900 bg-white p-4">
          <h3 className="font-black uppercase text-sm mb-3 border-b border-gray-300 pb-2 flex items-center gap-2">
            <Monitor size={16} />
            Connected POS Server
          </h3>
          <div className="p-3 bg-green-50 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="font-bold text-sm text-green-800">POS Server</p>
                <p className="text-xs text-green-600 font-mono">{lanClientStatus.serverAddress}</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-green-700">
              <div>Tenant: <span className="font-mono">{lanClientStatus.serverInfo.tenantId}</span></div>
              <div>Clients: <span className="font-mono">{lanClientStatus.serverInfo.connectedClients}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Info */}
      <div className="border-2 border-gray-900 bg-gray-50 p-4">
        <h3 className="font-black uppercase text-sm mb-3 border-b border-gray-300 pb-2">Tenant Info</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 text-xs uppercase">Tenant ID</span>
            <p className="font-mono font-bold break-all text-xs">{tenant?.tenantId || 'NOT SET'}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase">Platform</span>
            <p className="font-mono font-bold">{isTauri() ? 'TAURI' : 'WEB'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== DIAGNOSTICS TAB ==============
function DiagnosticsTab() {
  const { tenant } = useTenantStore();
  const { isAuthenticated, role } = useAuthStore();
  const { activeTables, cart, tableNumber, clearAllTableSessions, clearCart } = usePOSStore();
  const { clearAllOrders: clearKDSOrders } = useKDSStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [filter, setFilter] = useState<'all' | 'error' | 'sync' | 'websocket'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testResults, setTestResults] = useState<{ test: string; status: 'pass' | 'fail' | 'pending'; message: string }[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [tableSessionCount, setTableSessionCount] = useState<number>(0);
  const [tableSessionDetails, setTableSessionDetails] = useState<Array<{ tableNumber: number; itemCount: number; total: number }>>([]);
  const [allSessionsDetails, setAllSessionsDetails] = useState<Array<{ tenantId: string; tableNumber: number; itemCount: number; total: number }>>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);

  const activeTableEntries = Object.entries(activeTables);

  // Refresh logs
  const refreshLogs = useCallback(() => {
    setLogs([...capturedLogs]);
  }, []);

  // Refresh status
  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let orderCount = 0;
      let unsyncedCount = 0;

      if (isTauri()) {
        try {
          const { aggregatorOrderDb } = await import('../lib/aggregatorOrderDb');
          const orders = await aggregatorOrderDb.getActive();
          orderCount = orders.length;
          const unsynced = await aggregatorOrderDb.getUnsynced();
          unsyncedCount = unsynced.length;
        } catch (e) {
          console.error('[Diagnostics] Failed to get DB stats:', e);
        }

        if (tenant?.tenantId) {
          try {
            const sessionCount = await tableSessionService.getActiveSessionCount(tenant.tenantId);
            setTableSessionCount(sessionCount);

            const sessions = await tableSessionService.getActiveSessions(tenant.tenantId);
            const details = Object.values(sessions).map((session: any) => ({
              tableNumber: session.tableNumber,
              itemCount: session.order?.items?.length || 0,
              total: session.order?.total || 0,
            }));
            setTableSessionDetails(details);
          } catch (e) {
            console.error('[Diagnostics] Failed to get table session count:', e);
          }
        }

        try {
          const allSessions = await tableSessionService.getAllActiveSessions();
          setAllSessionsDetails(allSessions);
        } catch (e) {
          console.error('[Diagnostics] Failed to get all sessions:', e);
        }
      }

      // Get actual WebSocket connection status from orderSyncService
      const wsConnectionStatus = orderSyncService.getConnectionStatus();
      const detailedStatus = orderSyncService.getDetailedStatus();

      setSyncStatus({
        cloudSync: {
          enabled: true,
          lastSync: localStorage.getItem('lastCloudSync') || null,
          syncedCount: parseInt(localStorage.getItem('cloudSyncCount') || '0', 10),
          pendingCount: unsyncedCount,
          errors: [],
        },
        webSocket: {
          status: wsConnectionStatus,
          url: tenant?.tenantId ? `wss://handsfree-orders.suyesh.workers.dev/ws/orders/${tenant.tenantId}` : null,
          lastMessage: localStorage.getItem('lastWsMessage') || null,
          cloudStatus: detailedStatus.cloud.status,
          lanStatus: detailedStatus.lan.status,
          activePath: detailedStatus.activePath,
        },
        localDb: {
          orderCount,
          unsyncedCount,
        },
      });
    } catch (e) {
      console.error('[Diagnostics] Failed to refresh status:', e);
    } finally {
      setIsRefreshing(false);
    }
    refreshLogs();
  }, [tenant?.tenantId, refreshLogs]);

  // Run diagnostic tests
  const runTests = useCallback(async () => {
    const results: { test: string; status: 'pass' | 'fail' | 'pending'; message: string }[] = [];

    results.push({
      test: 'Tenant Configuration',
      status: tenant?.tenantId ? 'pass' : 'fail',
      message: tenant?.tenantId ? `Tenant: ${tenant.tenantId}` : 'No tenant configured',
    });

    results.push({
      test: 'Authentication',
      status: isAuthenticated ? 'pass' : 'fail',
      message: isAuthenticated ? `Role: ${role}` : 'Not authenticated',
    });

    results.push({
      test: 'Platform',
      status: 'pass',
      message: isTauri() ? 'Tauri (Desktop/Android)' : 'Web Browser',
    });

    try {
      const response = await fetch('https://handsfree-orders.suyesh.workers.dev/health');
      const data = await response.json();
      results.push({
        test: 'Cloud API Health',
        status: data.status === 'healthy' ? 'pass' : 'fail',
        message: data.status === 'healthy' ? 'API is healthy' : `Status: ${data.status}`,
      });
    } catch (e: any) {
      results.push({
        test: 'Cloud API Health',
        status: 'fail',
        message: `Failed: ${e.message}`,
      });
    }

    if (tenant?.tenantId) {
      try {
        const response = await fetch(`https://handsfree-orders.suyesh.workers.dev/api/aggregator-orders/${tenant.tenantId}`);
        const data = await response.json();
        results.push({
          test: 'Aggregator Orders API',
          status: data.success ? 'pass' : 'fail',
          message: data.success ? `${data.orders?.length || 0} orders in cloud` : `Error: ${data.error}`,
        });
      } catch (e: any) {
        results.push({
          test: 'Aggregator Orders API',
          status: 'fail',
          message: `Failed: ${e.message}`,
        });
      }

      results.push({
        test: 'WebSocket URL',
        status: 'pass',
        message: `wss://.../${tenant.tenantId}`,
      });
    }

    if (isTauri()) {
      try {
        const { aggregatorOrderDb } = await import('../lib/aggregatorOrderDb');
        const orders = await aggregatorOrderDb.getActive();
        results.push({
          test: 'Local Database',
          status: 'pass',
          message: `${orders.length} active orders in local DB`,
        });
      } catch (e: any) {
        results.push({
          test: 'Local Database',
          status: 'fail',
          message: `Error: ${e.message}`,
        });
      }
    }

    setTestResults(results);
  }, [tenant?.tenantId, isAuthenticated, role]);

  // Copy debug info
  const copyDebugInfo = async () => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      tenant: tenant?.tenantId || 'Not set',
      platform: isTauri() ? 'tauri' : 'web',
      authenticated: isAuthenticated,
      role: role || 'none',
      userAgent: navigator.userAgent,
      testResults: testResults.map(r => `${r.test}: ${r.status} - ${r.message}`),
      recentLogs: logs.slice(0, 30).map(l => `[${l.level}] ${l.source}: ${l.message}`),
    };

    const text = `
=== DIAGNOSTICS REPORT ===
Time: ${debugInfo.timestamp}
Tenant: ${debugInfo.tenant}
Platform: ${debugInfo.platform}
Auth: ${debugInfo.authenticated ? 'Yes' : 'No'} (${debugInfo.role})

=== TEST RESULTS ===
${debugInfo.testResults.join('\n')}

=== RECENT LOGS ===
${debugInfo.recentLogs.join('\n')}
    `.trim();

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  // Trigger manual sync
  const triggerManualSync = async () => {
    if (!isTauri()) {
      captureLog('warn', 'Diagnostics', 'Sync only available in Tauri');
      refreshLogs();
      return;
    }

    try {
      captureLog('info', 'Diagnostics', 'Triggering manual sync...');
      const result = await aggregatorSyncService.trigger();
      captureLog('info', 'Diagnostics', `Sync complete: ${result.synced} synced, ${result.errors.length} errors`);
      if (result.errors.length > 0) {
        result.errors.forEach(err => captureLog('error', 'Diagnostics', err));
      }
    } catch (e: any) {
      captureLog('error', 'Diagnostics', `Sync failed: ${e.message}`);
    }
    refreshLogs();
    refreshStatus();
  };

  // Clear table sessions
  const clearTableSessions = async () => {
    if (!tenant?.tenantId) {
      captureLog('error', 'Diagnostics', 'No tenant ID - cannot clear sessions');
      refreshLogs();
      return;
    }

    setIsClearing(true);

    try {
      const clearedCount = await tableSessionService.clearAllActiveSessions(tenant.tenantId);
      captureLog('info', 'Diagnostics', `Cleared ${clearedCount} table sessions from database`);
      clearAllTableSessions();
      captureLog('info', 'Diagnostics', 'Cleared table sessions from POS store');
      setTableSessionCount(0);
      setTableSessionDetails([]);
      setAllSessionsDetails([]);
      captureLog('info', 'Diagnostics', '✅ All sessions cleared successfully');
    } catch (e: any) {
      captureLog('error', 'Diagnostics', `Failed to clear sessions: ${e.message}`);
    } finally {
      setIsClearing(false);
      refreshLogs();
      refreshStatus();
    }
  };

  // Reset ALL POS data
  const resetAllPOSData = async () => {
    if (!confirm('⚠️ RESET ALL POS DATA?\n\nThis will clear:\n• All table sessions\n• All KDS/Kitchen orders\n• Current cart\n• LocalStorage cache\n\nThis action cannot be undone!')) {
      return;
    }

    setIsResettingAll(true);
    try {
      if (tenant?.tenantId && isTauri()) {
        try {
          const clearedCount = await tableSessionService.clearAllActiveSessions(tenant.tenantId);
          captureLog('info', 'RESET', `Cleared ${clearedCount} table sessions from database`);
        } catch (e: any) {
          captureLog('error', 'RESET', `Failed to clear table sessions: ${e.message}`);
        }
      }

      clearAllTableSessions();
      clearCart();
      captureLog('info', 'RESET', 'Cleared POS store (tables & cart)');

      clearKDSOrders();
      captureLog('info', 'RESET', 'Cleared KDS orders');

      const keysToPreserve = ['tenant-storage'];
      const allKeys = Object.keys(localStorage);
      let clearedKeys = 0;
      allKeys.forEach(key => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
          clearedKeys++;
        }
      });
      captureLog('info', 'RESET', `Cleared ${clearedKeys} localStorage keys (preserved tenant config)`);

      setTableSessionCount(0);
      setTableSessionDetails([]);

      captureLog('info', 'RESET', '✅ All POS data has been reset successfully');

      setTimeout(() => {
        if (confirm('Reset complete! Reload the app now for a fresh start?')) {
          window.location.reload();
        }
      }, 500);
    } catch (e: any) {
      captureLog('error', 'RESET', `Reset failed: ${e.message}`);
    } finally {
      setIsResettingAll(false);
      refreshLogs();
    }
  };

  // Initial load
  useEffect(() => {
    refreshStatus();
    runTests();
    const interval = setInterval(refreshLogs, 2000);
    return () => clearInterval(interval);
  }, [refreshStatus, runTests, refreshLogs]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'error') return log.level === 'error';
    if (filter === 'sync') return log.source.toLowerCase().includes('sync') || log.message.toLowerCase().includes('sync');
    if (filter === 'websocket') return log.source.toLowerCase().includes('websocket') || log.source.toLowerCase().includes('ws') || log.message.toLowerCase().includes('websocket');
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={triggerManualSync}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase"
        >
          Sync Now
        </button>
        <button
          onClick={() => { refreshStatus(); runTests(); }}
          disabled={isRefreshing}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-900 font-bold text-xs uppercase disabled:opacity-50"
        >
          {isRefreshing ? '...' : 'Refresh'}
        </button>
      </div>

      {/* In-Memory POS State */}
      <div className="border-2 border-blue-500 bg-blue-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black uppercase text-sm text-blue-800">In-Memory POS State (Zustand)</h3>
          <span className="text-2xl font-black text-blue-600">{activeTableEntries.length}</span>
        </div>
        {activeTableEntries.length > 0 ? (
          <div className="bg-blue-100 border border-blue-300 p-2 mb-3 text-xs">
            <p className="font-bold text-blue-800 mb-1">Active tables in memory:</p>
            {activeTableEntries.map(([tableNum, session]) => (
              <div key={tableNum} className="flex justify-between text-blue-700 py-0.5">
                <span>Table {tableNum}</span>
                <span>{(session as any).order?.items?.length || 0} items • ₹{((session as any).order?.total || 0).toFixed(0)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-blue-600 mb-3">No active tables in memory</p>
        )}
        <div className="text-xs text-blue-700 space-y-1">
          <div>Current cart: {cart.length} items</div>
          <div>Selected table: {tableNumber ?? 'none'}</div>
        </div>
        {activeTableEntries.length > 0 && (
          <button
            onClick={() => clearAllTableSessions()}
            className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase"
          >
            Clear In-Memory State ({activeTableEntries.length} tables)
          </button>
        )}
      </div>

      {/* SQLite Table Sessions */}
      <div className="border-2 border-orange-500 bg-orange-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black uppercase text-sm text-orange-800">SQLite Sessions (DB)</h3>
          <span className="text-2xl font-black text-orange-600">{tableSessionCount}</span>
        </div>
        <p className="text-xs text-orange-600 mb-2">Platform: {isTauri() ? 'Tauri (SQLite available)' : 'Web (no SQLite)'}</p>
        {tableSessionDetails.length > 0 && (
          <div className="bg-orange-100 border border-orange-300 p-2 mb-2 text-xs">
            {tableSessionDetails.map((session) => (
              <div key={session.tableNumber} className="flex justify-between text-orange-700">
                <span>Table {session.tableNumber}</span>
                <span>{session.itemCount} items • ₹{session.total.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={clearTableSessions}
          disabled={isClearing}
          className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-bold text-xs uppercase"
        >
          {isClearing ? 'Clearing...' : `Clear SQLite Sessions (${tableSessionCount})`}
        </button>
      </div>

      {/* ALL Sessions Global */}
      {isTauri() && allSessionsDetails.length > 0 && (
        <div className="border-2 border-purple-500 bg-purple-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-black uppercase text-xs text-purple-800">All Tenants ({allSessionsDetails.length})</h3>
            <button
              onClick={async () => {
                if (!confirm('Clear ALL sessions from ALL tenants?')) return;
                setIsClearing(true);
                try {
                  const count = await tableSessionService.clearAllActiveSessionsGlobal();
                  captureLog('info', 'Diagnostics', `Globally cleared ${count} sessions`);
                  clearAllTableSessions();
                  setAllSessionsDetails([]);
                  setTableSessionCount(0);
                  setTableSessionDetails([]);
                } catch (e: any) {
                  captureLog('error', 'Diagnostics', `Global clear failed: ${e.message}`);
                } finally {
                  setIsClearing(false);
                  refreshLogs();
                  refreshStatus();
                }
              }}
              disabled={isClearing}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold text-xs uppercase"
            >
              {isClearing ? '...' : 'Clear All'}
            </button>
          </div>
        </div>
      )}

      {/* RESET ALL */}
      <div className="border-2 border-red-600 bg-red-50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black uppercase text-sm text-red-800">Reset All POS Data</h3>
            <p className="text-xs text-red-600">Clears SQLite + memory + localStorage</p>
          </div>
          <button
            onClick={resetAllPOSData}
            disabled={isResettingAll}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-black text-xs uppercase"
          >
            {isResettingAll ? '...' : 'RESET ALL'}
          </button>
        </div>
      </div>

      {/* Diagnostic Tests */}
      <div className="border-2 border-gray-900 bg-white p-4">
        <div className="flex items-center justify-between mb-3 border-b border-gray-300 pb-2">
          <h3 className="font-black uppercase text-sm">Diagnostic Tests</h3>
          <button onClick={runTests} className="text-xs text-blue-600 font-bold uppercase hover:underline">
            Run Again
          </button>
        </div>
        <div className="space-y-2">
          {testResults.map((result, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  result.status === 'pass' ? 'bg-green-500' :
                  result.status === 'fail' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="font-bold text-sm">{result.test}</span>
              </div>
              <span className={`text-xs font-mono ${
                result.status === 'pass' ? 'text-green-700' :
                result.status === 'fail' ? 'text-red-700' : 'text-yellow-700'
              }`}>
                {result.message}
              </span>
            </div>
          ))}
          {testResults.length === 0 && (
            <p className="text-sm text-gray-500 italic">Click "Run Again" to check system health</p>
          )}
        </div>
      </div>

      {/* Sync Status Cards */}
      {syncStatus && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border-2 border-gray-900 bg-white p-3">
            <h4 className="text-xs font-black uppercase text-gray-500 mb-2">Cloud Sync</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Enabled</span>
                <span className={`font-bold ${syncStatus.cloudSync.enabled ? 'text-green-600' : 'text-red-600'}`}>
                  {syncStatus.cloudSync.enabled ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pending</span>
                <span className="font-mono font-bold">{syncStatus.cloudSync.pendingCount}</span>
              </div>
            </div>
          </div>

          <div className="border-2 border-gray-900 bg-white p-3">
            <h4 className="text-xs font-black uppercase text-gray-500 mb-2">WebSocket</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`font-bold ${
                  syncStatus.webSocket.status === 'connected' ? 'text-green-600' :
                  syncStatus.webSocket.status === 'connecting' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {syncStatus.webSocket.status.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cloud</span>
                <span className={`font-mono text-xs ${
                  syncStatus.webSocket.cloudStatus === 'connected' ? 'text-green-600' :
                  syncStatus.webSocket.cloudStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {syncStatus.webSocket.cloudStatus?.toUpperCase() || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">LAN</span>
                <span className={`font-mono text-xs ${
                  syncStatus.webSocket.lanStatus === 'connected' ? 'text-green-600' :
                  syncStatus.webSocket.lanStatus === 'connecting' ? 'text-yellow-600' : 'text-gray-400'
                }`}>
                  {syncStatus.webSocket.lanStatus?.toUpperCase() || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Path</span>
                <span className="font-mono text-xs text-gray-800">
                  {syncStatus.webSocket.activePath?.toUpperCase() || 'NONE'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-2 border-gray-900 bg-white p-3">
            <h4 className="text-xs font-black uppercase text-gray-500 mb-2">Local DB</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Orders</span>
                <span className="font-mono font-bold">{syncStatus.localDb.orderCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unsynced</span>
                <span className={`font-mono font-bold ${syncStatus.localDb.unsyncedCount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {syncStatus.localDb.unsyncedCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Console Logs */}
      <div className="border-2 border-gray-900 bg-white p-4">
        <div className="flex items-center justify-between mb-3 border-b border-gray-300 pb-2">
          <h3 className="font-black uppercase text-sm">Console Logs</h3>
          <div className="flex gap-1">
            {(['all', 'error', 'sync', 'websocket'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 text-xs font-bold uppercase ${
                  filter === f
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-gray-900 text-gray-100 p-3 h-[200px] overflow-y-auto font-mono text-xs leading-relaxed touch-pan-y">
          {filteredLogs.length === 0 ? (
            <p className="text-gray-400">No logs captured yet...</p>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className={`py-0.5 border-b border-gray-800 ${
                log.level === 'error' ? 'text-red-400' :
                log.level === 'warn' ? 'text-yellow-400' : 'text-gray-200'
              }`}>
                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                {' '}
                <span className={`font-bold ${
                  log.level === 'error' ? 'text-red-500' :
                  log.level === 'warn' ? 'text-yellow-500' : 'text-blue-400'
                }`}>[{log.source}]</span>
                {' '}
                {log.message}
              </div>
            ))
          )}
        </div>
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>{filteredLogs.length} of {logs.length} logs</span>
          <button
            onClick={() => { capturedLogs.length = 0; refreshLogs(); }}
            className="text-red-600 font-bold uppercase hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-2 border-gray-900 bg-gray-50 p-4">
        <h3 className="font-black uppercase text-sm mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyDebugInfo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase"
          >
            {copyStatus || 'Copy Debug Info'}
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              captureLog('info', 'Diagnostics', 'Cleared localStorage');
              refreshLogs();
            }}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-gray-900 font-bold text-xs uppercase"
          >
            Clear Storage
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 border-2 border-gray-900 font-bold text-xs uppercase"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== MAIN PAGE ==============
export default function DiagnosticsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('device');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'device', label: 'Device', icon: <Monitor size={16} /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Settings2 size={16} /> },
  ];

  return (
    <div className="fixed inset-0 bg-white text-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-gray-900 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-900 font-bold text-sm"
            >
              ← BACK
            </button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">System</h1>
              <p className="text-xs text-gray-600">Device settings & diagnostics</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 max-w-4xl mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 font-bold text-sm uppercase transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'device' && <DeviceSettingsTab />}
          {activeTab === 'diagnostics' && <DiagnosticsTab />}
        </div>
      </main>

      {/* Back to Hub Button */}
      <div className="flex-shrink-0 p-4 border-t-2 border-gray-900 bg-white">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/hub')}
            className="w-full py-3 bg-gray-900 text-white font-black uppercase tracking-wide text-sm hover:bg-gray-800"
          >
            Back to Hub
          </button>
        </div>
      </div>
    </div>
  );
}
