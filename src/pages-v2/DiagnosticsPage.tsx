/**
 * Diagnostics Page
 * Shows sync status, errors, and system health
 * Useful for debugging sync issues across devices
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantStore } from '../stores/tenantStore';
import { useAuthStore } from '../stores/authStore';
import { isTauri } from '../lib/platform';
import { aggregatorSyncService } from '../lib/aggregatorSyncService';

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

export default function DiagnosticsPage() {
  const navigate = useNavigate();
  const { tenant } = useTenantStore();
  const { isAuthenticated, role } = useAuthStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [filter, setFilter] = useState<'all' | 'error' | 'sync' | 'websocket'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testResults, setTestResults] = useState<{ test: string; status: 'pass' | 'fail' | 'pending'; message: string }[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Refresh logs
  const refreshLogs = useCallback(() => {
    setLogs([...capturedLogs]);
  }, []);

  // Refresh status
  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Get local DB stats if in Tauri
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
      }

      setSyncStatus({
        cloudSync: {
          enabled: true,
          lastSync: localStorage.getItem('lastCloudSync') || null,
          syncedCount: parseInt(localStorage.getItem('cloudSyncCount') || '0', 10),
          pendingCount: unsyncedCount,
          errors: [],
        },
        webSocket: {
          status: 'disconnected',
          url: tenant?.tenantId ? `wss://handsfree-orders.suyesh.workers.dev/ws/orders/${tenant.tenantId}` : null,
          lastMessage: localStorage.getItem('lastWsMessage') || null,
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

    // Test 1: Tenant configuration
    results.push({
      test: 'Tenant Configuration',
      status: tenant?.tenantId ? 'pass' : 'fail',
      message: tenant?.tenantId ? `Tenant: ${tenant.tenantId}` : 'No tenant configured',
    });

    // Test 2: Authentication
    results.push({
      test: 'Authentication',
      status: isAuthenticated ? 'pass' : 'fail',
      message: isAuthenticated ? `Role: ${role}` : 'Not authenticated',
    });

    // Test 3: Platform detection
    results.push({
      test: 'Platform',
      status: 'pass',
      message: isTauri() ? 'Tauri (Desktop/Android)' : 'Web Browser',
    });

    // Test 4: Cloud API health
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

    // Test 5: Aggregator orders endpoint
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
    }

    // Test 6: WebSocket connection
    if (tenant?.tenantId) {
      results.push({
        test: 'WebSocket URL',
        status: 'pass',
        message: `wss://.../${tenant.tenantId}`,
      });
    }

    // Test 7: Local database (Tauri only)
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
    } catch (e) {
      // Fallback for devices without clipboard API
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
    <div className="min-h-screen bg-white text-gray-900 p-4 pb-24 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-gray-900 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-900 font-bold text-sm"
            >
              ← BACK
            </button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Diagnostics</h1>
              <p className="text-xs text-gray-600">System health & sync status</p>
            </div>
          </div>
          <div className="flex gap-2">
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
        </div>

        {/* System Info Card */}
        <div className="border-2 border-gray-900 bg-gray-50 p-4">
          <h3 className="font-black uppercase text-sm mb-3 border-b border-gray-300 pb-2">System Info</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 text-xs uppercase">Tenant</span>
              <p className="font-mono font-bold break-all">{tenant?.tenantId || 'NOT SET'}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase">Platform</span>
              <p className="font-mono font-bold">{isTauri() ? 'TAURI' : 'WEB'}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase">Auth</span>
              <p className="font-mono font-bold">{isAuthenticated ? `YES (${role})` : 'NO'}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase">Device</span>
              <p className="font-mono font-bold text-xs truncate">{navigator.userAgent.includes('Android') ? 'Android' : navigator.userAgent.includes('Mac') ? 'Mac' : 'Other'}</p>
            </div>
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
          <div className="bg-gray-900 text-gray-100 p-3 min-h-[200px] max-h-[400px] overflow-y-scroll font-mono text-xs leading-relaxed" style={{ WebkitOverflowScrolling: 'touch' }}>
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

        {/* Back to Manager */}
        <button
          onClick={() => navigate('/manager')}
          className="w-full py-3 bg-gray-900 text-white font-black uppercase tracking-wide text-sm hover:bg-gray-800"
        >
          Back to Manager Dashboard
        </button>
      </div>
    </div>
  );
}
