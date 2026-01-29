import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Cloud,
  CloudOff,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Database,
  RefreshCw,
  X,
} from 'lucide-react';
import { d1ProvisioningService, type ProvisionProgress } from '../../services/d1ProvisioningService';
import { createInitialD1Sync, type InitialSyncProgress } from '../../services/sync/InitialD1Sync';
import { createD1SyncService } from '../../services/sync/D1SyncService';
import { getTieredSyncManager } from '../../services/sync/TieredSyncManager';
import { useTenantStore } from '../../stores/tenantStore';
import { formatDistanceToNow } from 'date-fns';

interface CloudSyncSettingsProps {
  showDismissButton?: boolean;
  onDismiss?: () => void;
}

export function CloudSyncSettings({ showDismissButton, onDismiss }: CloudSyncSettingsProps) {
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningProgress, setProvisioningProgress] = useState<ProvisionProgress | null>(null);
  const [initialSyncProgress, setInitialSyncProgress] = useState<InitialSyncProgress | null>(null);
  const [isPerformingInitialSync, setIsPerformingInitialSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [tableCount, setTableCount] = useState<number | null>(null);

  const getTenantId = useTenantStore((state) => state.getTenantId);
  const tenantId = getTenantId() || '';

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [tenantId]);

  // Poll last sync time
  useEffect(() => {
    if (isEnabled) {
      const interval = setInterval(() => {
        const lastSync = d1ProvisioningService.getLastSyncTime();
        setLastSyncTime(lastSync);
      }, 10000); // Update every 10 seconds

      return () => clearInterval(interval);
    }
  }, [isEnabled]);

  const checkStatus = async () => {
    if (!tenantId) return;

    try {
      const status = await d1ProvisioningService.checkStatus(tenantId);
      setIsProvisioned(status.provisioned);
      setTableCount(status.tableCount || null);

      const syncEnabled = d1ProvisioningService.isCloudSyncEnabled();
      setIsEnabled(syncEnabled);

      const lastSync = d1ProvisioningService.getLastSyncTime();
      setLastSyncTime(lastSync);
    } catch (error) {
      console.error('[CloudSyncSettings] Failed to check status:', error);
    }
  };

  const handleEnableCloud = async () => {
    if (!tenantId) {
      setError('Tenant ID not found. Please restart the app.');
      return;
    }

    setIsProvisioning(true);
    setError(null);

    try {
      // Get database path from local storage or default
      const dbPath = localStorage.getItem('sqlite:db_path') || `${tenantId}.db`;

      const result = await d1ProvisioningService.provisionD1(
        tenantId,
        dbPath,
        (progress) => {
          setProvisioningProgress(progress);
        }
      );

      if (result.success) {
        setIsProvisioned(true);
        d1ProvisioningService.enableCloudSync();
        setIsEnabled(true);
        setTableCount(result.tables_created || null);

        // Trigger initial bulk sync
        console.log('[CloudSyncSettings] D1 provisioned successfully, starting initial sync');
        await performInitialSync();

        // Enable D1 sync in TieredSyncManager for ongoing sync
        const syncManager = getTieredSyncManager(tenantId);
        syncManager.enableD1Sync(tenantId);
      } else {
        setError(result.error || 'Provisioning failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      console.error('[CloudSyncSettings] Provisioning failed:', error);
    } finally {
      setIsProvisioning(false);
      setProvisioningProgress(null);
    }
  };

  const handleDisableCloud = () => {
    d1ProvisioningService.disableCloudSync();
    setIsEnabled(false);
  };

  const performInitialSync = async () => {
    if (!tenantId) return;

    setIsPerformingInitialSync(true);
    setError(null);

    try {
      const initialSync = createInitialD1Sync(tenantId, (progress) => {
        setInitialSyncProgress(progress);
      });

      const result = await initialSync.performInitialSync();

      if (result.success) {
        console.log('[CloudSyncSettings] Initial sync complete:', result);
        setLastSyncTime(new Date());
      } else {
        setError(`Initial sync completed with errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Initial sync failed: ${errorMessage}`);
      console.error('[CloudSyncSettings] Initial sync failed:', error);
    } finally {
      setIsPerformingInitialSync(false);
      setInitialSyncProgress(null);
    }
  };

  const handleSyncNow = async () => {
    if (!tenantId) {
      setError('Tenant ID not found');
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const syncService = createD1SyncService(tenantId);

      // Sync all data types
      const results = await Promise.all([
        syncService.syncSalesToD1(),
        syncService.syncTipsToD1(),
        syncService.syncMenuToD1(),
        syncService.syncStaffToD1(),
        syncService.syncSettingsToD1(),
        syncService.syncFloorPlanToD1(),
        syncService.syncBarInventoryToD1(),
      ]);

      const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

      console.log('[CloudSyncSettings] Manual sync complete:', { totalSynced, totalFailed });
      setLastSyncTime(new Date());

      if (totalFailed > 0) {
        setError(`Sync completed with ${totalFailed} failures`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Manual sync failed: ${errorMessage}`);
      console.error('[CloudSyncSettings] Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Not Enabled State
  if (!isProvisioned && !isProvisioning) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-green-600" />
              Cloud Sync & Backup
            </CardTitle>
            <Badge variant="outline" className="mt-2">
              Not Enabled
            </Badge>
          </div>
          {showDismissButton && (
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-700">
            Enable cloud sync to unlock powerful features:
          </p>
          <ul className="mb-6 space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Automatic cloud backup of all your data</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Sync across multiple devices in real-time</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Access analytics and reports from anywhere</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Essential for multi-location management</span>
            </li>
          </ul>
          <Button onClick={handleEnableCloud} className="w-full bg-green-600 hover:bg-green-700">
            <Cloud className="mr-2 h-4 w-4" />
            Enable Cloud Sync
          </Button>
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Provisioning State
  if ((isProvisioning && provisioningProgress) || (isPerformingInitialSync && initialSyncProgress)) {
    const progress = initialSyncProgress || provisioningProgress;
    if (!progress) return null;

    return (
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            {isPerformingInitialSync ? 'Syncing Data to Cloud' : 'Enabling Cloud Sync'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{progress.message}</span>
                <span className="text-gray-500">{progress.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>

            {isProvisioning && provisioningProgress && (
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  {provisioningProgress.step === 'extracting' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : provisioningProgress.progress > 30 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span>Extracting database schema</span>
                </div>

                <div className="flex items-center gap-2">
                  {provisioningProgress.step === 'provisioning' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : provisioningProgress.progress > 70 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span>Creating cloud database</span>
                </div>

                <div className="flex items-center gap-2">
                  {provisioningProgress.step === 'complete' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span>Starting initial sync</span>
                </div>
              </div>
            )}

            {isPerformingInitialSync && initialSyncProgress && (
              <div className="space-y-2 text-sm text-gray-600">
                <p className="font-medium">
                  Syncing {initialSyncProgress.currentDataType || 'data'} ({initialSyncProgress.completed} of {initialSyncProgress.total} steps)
                </p>
              </div>
            )}
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
        <div className="rounded-md bg-gray-50 p-4">
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
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSyncNow}
            variant="outline"
            className="flex-1"
            disabled={isSyncing || !isEnabled}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          {isEnabled ? (
            <Button onClick={handleDisableCloud} variant="outline" className="flex-1">
              <CloudOff className="mr-2 h-4 w-4" />
              Pause Sync
            </Button>
          ) : (
            <Button
              onClick={() => {
                d1ProvisioningService.enableCloudSync();
                setIsEnabled(true);
              }}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Cloud className="mr-2 h-4 w-4" />
              Resume Sync
            </Button>
          )}
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
