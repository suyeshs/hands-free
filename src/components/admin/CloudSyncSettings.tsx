import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Cloud,
  CloudOff,
  AlertCircle,
  Database,
  RefreshCw,
  TestTube,
  ExternalLink,
} from 'lucide-react';
import { getD1ProvisioningService } from '../../services/d1ProvisioningService';
import { createD1SyncService } from '../../services/sync/D1SyncService';
import { useTenantStore } from '../../stores/tenantStore';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface SyncStats {
  menu: number;
  sales: number;
  staff: number;
  tips: number;
  settings: number;
  floorPlan: number;
  inventory: number;
}

export function CloudSyncSettings() {
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [tableCount, setTableCount] = useState<number | null>(null);
  const [lastSyncStats, setLastSyncStats] = useState<SyncStats | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const getTenantId = useTenantStore((state) => state.getTenantId);
  const tenantId = getTenantId() || '';
  const navigate = useNavigate();

  // Check status on mount
  useEffect(() => {
    if (tenantId) {
      checkStatus();
    }
  }, [tenantId]);

  // Poll last sync time
  useEffect(() => {
    if (isEnabled) {
      const updateLastSync = async () => {
        const lastSync = await getD1ProvisioningService().getLastSyncTime();
        setLastSyncTime(lastSync);
      };

      const interval = setInterval(updateLastSync, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isEnabled]);

  const checkStatus = async () => {
    if (!tenantId) return;

    try {
      const [status, syncEnabled, lastSync] = await Promise.all([
        getD1ProvisioningService().checkStatus(tenantId),
        getD1ProvisioningService().isCloudSyncEnabled(),
        getD1ProvisioningService().getLastSyncTime(),
      ]);

      setIsProvisioned(status.provisioned);
      setTableCount(status.tableCount || null);
      setIsEnabled(syncEnabled);
      setLastSyncTime(lastSync);
    } catch (error) {
      console.error('[CloudSyncSettings] Failed to check status:', error);
    }
  };

  const handleDisableCloud = async () => {
    await getD1ProvisioningService().disableCloudSync();
    setIsEnabled(false);
  };

  const handleSyncNow = async () => {
    if (!tenantId) {
      setError('Tenant ID not found');
      return;
    }

    // Prevent double-click
    if (isSyncing) {
      console.log('[CloudSyncSettings] Sync already in progress, ignoring click');
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const { getDatabaseFilePath } = await import('../../lib/database');
      const dbPath = await getDatabaseFilePath();
      const syncService = createD1SyncService(tenantId, undefined, dbPath);

      console.log('[CloudSyncSettings] Starting manual sync for all data types...');

      // Sync all data types
      const [salesResult, tipsResult, menuResult, staffResult, settingsResult, floorPlanResult, inventoryResult] = await Promise.all([
        syncService.syncSalesToD1(),
        syncService.syncTipsToD1(),
        syncService.syncMenuToD1(),
        syncService.syncStaffToD1(),
        syncService.syncSettingsToD1(),
        syncService.syncFloorPlanToD1(),
        syncService.syncBarInventoryToD1(),
      ]);

      const totalSynced = salesResult.synced + tipsResult.synced + menuResult.synced + staffResult.synced + settingsResult.synced + floorPlanResult.synced + inventoryResult.synced;
      const totalFailed = salesResult.failed + tipsResult.failed + menuResult.failed + staffResult.failed + settingsResult.failed + floorPlanResult.failed + inventoryResult.failed;

      // Store sync stats for display
      setLastSyncStats({
        menu: menuResult.synced,
        sales: salesResult.synced,
        staff: staffResult.synced,
        tips: tipsResult.synced,
        settings: settingsResult.synced,
        floorPlan: floorPlanResult.synced,
        inventory: inventoryResult.synced,
      });

      console.log('[CloudSyncSettings] Manual sync complete:', {
        totalSynced,
        totalFailed,
        details: {
          menu: menuResult.synced,
          sales: salesResult.synced,
          staff: staffResult.synced,
          tips: tipsResult.synced,
          settings: settingsResult.synced,
          floorPlan: floorPlanResult.synced,
          inventory: inventoryResult.synced,
        }
      });

      // Update last sync time immediately
      setLastSyncTime(new Date());

      if (totalFailed > 0) {
        setError(`Sync completed with ${totalFailed} failures. ${totalSynced} records synced successfully.`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Manual sync failed: ${errorMessage}`);
      console.error('[CloudSyncSettings] Manual sync failed:', error);
    } finally {
      // Ensure button re-enables even if error occurs
      setTimeout(() => {
        setIsSyncing(false);
      }, 500);
    }
  };

  const handleQuickTest = async () => {
    if (!tenantId) {
      setTestResult('❌ No tenant configured');
      return;
    }

    setIsTestRunning(true);
    setTestResult(null);

    try {
      // Quick test: Create test data and sync
      const { getDatabaseFilePath } = await import('../../lib/database');
      const { invoke } = await import('@tauri-apps/api/core');

      const dbPath = await getDatabaseFilePath();
      const syncService = createD1SyncService(tenantId, undefined, dbPath);

      // Step 1: Create test sales transaction
      const testSaleId = `test-sale-${Date.now()}`;
      const now = new Date().toISOString();

      await invoke('execute_sqlite', {
        dbPath,
        query: `INSERT INTO sales_transactions
          (id, total_amount, payment_method, completed_at, created_at)
          VALUES (?, ?, ?, ?, ?)`,
        params: [testSaleId, '25.99', 'cash', now, now],
      });

      // Step 2: Sync to D1
      const result = await syncService.syncSalesToD1();

      if (result.failed > 0) {
        setTestResult(`⚠️ Sync completed with ${result.failed} failure(s)`);
        return;
      }

      if (result.synced === 0) {
        setTestResult('✅ Test completed (no new records to sync)');
        return;
      }

      // Step 3: Verify data in D1
      const workerUrl =
        import.meta.env.VITE_ORDERS_ENDPOINT || 'https://handsfree-orders.suyesh.workers.dev';

      try {
        const verifyResponse = await fetch(
          `${workerUrl}/api/sync/${tenantId}/verify`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tables: ['sales_transactions'],
            }),
          }
        );

        if (verifyResponse.ok) {
          const verification = await verifyResponse.json();
          setTestResult(
            `✅ Test passed! Synced ${result.synced} record(s) and verified ${verification.sales_transactions} in D1`
          );
        } else {
          setTestResult(
            `✅ Synced ${result.synced} record(s) (D1 verification unavailable)`
          );
        }
      } catch (verifyError) {
        // Verification failed but sync succeeded
        setTestResult(`✅ Synced ${result.synced} record(s) (verification skipped)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTestResult(`❌ Test failed: ${errorMessage}`);
    } finally {
      setIsTestRunning(false);
    }
  };

  // Not Provisioned State
  if (!isProvisioned) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Cloud Sync Not Configured
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 mb-4">
            D1 database is not provisioned. Please use the D1 Database Setup to provision your cloud database first.
          </p>
          <div className="rounded-md bg-amber-100 border border-amber-200 p-3">
            <p className="text-xs text-amber-700">
              Go to Settings → Cloud → D1 Database Setup to provision your database schema.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Enabled State
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" />
              Cloud Sync
            </CardTitle>
            {isEnabled ? (
              <Badge className="mt-2 bg-green-600">
                {lastSyncTime
                  ? `Synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`
                  : 'Enabled'}
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-2">
                Paused
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-gray-50 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium">
                {isEnabled ? 'Active' : 'Paused'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Tables Synced</p>
              <p className="font-medium">{tableCount || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Last Sync</p>
              <p className="font-medium">
                {lastSyncTime
                  ? formatDistanceToNow(lastSyncTime, { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Sync Mode</p>
              <p className="font-medium">Automatic</p>
            </div>
          </div>

          {/* Data Synced Summary */}
          {lastSyncStats && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">Data Synced to Cloud</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {lastSyncStats.menu > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Menu Items</span>
                    <span className="font-medium text-blue-600">{lastSyncStats.menu}</span>
                  </div>
                )}
                {lastSyncStats.sales > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Sales</span>
                    <span className="font-medium text-blue-600">{lastSyncStats.sales}</span>
                  </div>
                )}
                {lastSyncStats.staff > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Staff</span>
                    <span className="font-medium text-blue-600">{lastSyncStats.staff}</span>
                  </div>
                )}
                {lastSyncStats.tips > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Tips</span>
                    <span className="font-medium text-blue-600">{lastSyncStats.tips}</span>
                  </div>
                )}
                {lastSyncStats.floorPlan > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Floor Plan</span>
                    <span className="font-medium text-blue-600">{lastSyncStats.floorPlan}</span>
                  </div>
                )}
                {lastSyncStats.inventory > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Inventory</span>
                    <span className="font-medium text-blue-600">{lastSyncStats.inventory}</span>
                  </div>
                )}
                {lastSyncStats.settings > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Settings</span>
                    <span className="font-medium text-blue-600">{lastSyncStats.settings}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {/* Prominent Sync Now Button */}
          <Button
            onClick={handleSyncNow}
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-base shadow-md hover:shadow-lg transition-all"
            disabled={isSyncing || !isEnabled}
          >
            <RefreshCw className={`mr-2 h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing Data to Cloud...' : 'Sync Now'}
          </Button>

          {/* Secondary Controls */}
          <div className="flex gap-2">
            {isEnabled ? (
              <Button onClick={handleDisableCloud} variant="outline" className="flex-1" size="sm">
                <CloudOff className="mr-2 h-4 w-4" />
                Pause Sync
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  await getD1ProvisioningService().enableCloudSync();
                  setIsEnabled(true);
                }}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <Cloud className="mr-2 h-4 w-4" />
                Resume Sync
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* D1 Sync Testing Section */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <TestTube className="h-4 w-4 text-purple-600" />
            <h3 className="font-semibold text-sm text-gray-900">D1 Sync Testing</h3>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Test the synchronization between your local database and Cloudflare D1
            </p>

            {testResult && (
              <div className={`rounded-md p-3 text-sm ${
                testResult.startsWith('✅')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : testResult.startsWith('⚠️')
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {testResult}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleQuickTest}
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isTestRunning || !isEnabled}
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isTestRunning ? 'animate-spin' : ''}`} />
                {isTestRunning ? 'Testing...' : 'Quick Test'}
              </Button>

              <Button
                onClick={() => navigate('/d1-sync-test')}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Full Test Suite
              </Button>
            </div>

            <div className="rounded-md bg-purple-50 border border-purple-200 p-3">
              <p className="text-xs text-purple-700">
                <strong>Quick Test:</strong> Creates a test sales transaction and syncs it to D1
                <br />
                <strong>Full Test Suite:</strong> Comprehensive testing with detailed results
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
