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
} from 'lucide-react';
import { d1ProvisioningService } from '../../services/d1ProvisioningService';
import { createD1SyncService } from '../../services/sync/D1SyncService';
import { useTenantStore } from '../../stores/tenantStore';
import { formatDistanceToNow } from 'date-fns';

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

  const getTenantId = useTenantStore((state) => state.getTenantId);
  const tenantId = getTenantId() || '';

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
        const lastSync = await d1ProvisioningService.getLastSyncTime();
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
        d1ProvisioningService.checkStatus(tenantId),
        d1ProvisioningService.isCloudSyncEnabled(),
        d1ProvisioningService.getLastSyncTime(),
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
    await d1ProvisioningService.disableCloudSync();
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
      const syncService = createD1SyncService(tenantId);

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
                  await d1ProvisioningService.enableCloudSync();
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
      </CardContent>
    </Card>
  );
}
