/**
 * D1 Database Provisioning Button
 *
 * Allows users to provision the D1 database schema using wrangler CLI
 */

import { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { d1ProvisioningService, type D1ProvisionResult, type ProvisionProgress } from '../../services/d1ProvisioningService';
import { useTenantStore } from '../../stores/tenantStore';
import { appDataDir } from '@tauri-apps/api/path';

interface D1ProvisionButtonProps {
  databaseId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function D1ProvisionButton({
  databaseId: propsDbId,
  onSuccess,
  onError,
}: D1ProvisionButtonProps) {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [result, setResult] = useState<D1ProvisionResult | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [databaseId, setDatabaseId] = useState<string | undefined>(propsDbId);
  const [progress, setProgress] = useState<ProvisionProgress | null>(null);
  const [isAlreadyProvisioned, setIsAlreadyProvisioned] = useState(false);
  const [tableCount, setTableCount] = useState<number>(0);

  const getTenantId = useTenantStore((state) => state.getTenantId);
  const tenantId = getTenantId() || '';

  useEffect(() => {
    fetchDatabaseId();
  }, []);

  const fetchDatabaseId = async () => {
    if (!tenantId) return;

    try {
      const status = await d1ProvisioningService.checkStatus(tenantId);
      if (status.databaseId) {
        setDatabaseId(status.databaseId);
        console.log('[D1ProvisionButton] Loaded database ID from SQLite:', status.databaseId);
      }

      // Check if already provisioned with tables
      if (status.tableCount && status.tableCount > 0) {
        setIsAlreadyProvisioned(true);
        setTableCount(status.tableCount);
        console.log('[D1ProvisionButton] Database already provisioned with', status.tableCount, 'tables');
      }
    } catch (error) {
      console.error('[D1ProvisionButton] Failed to fetch database ID:', error);
    }
  };

  const handleProvision = async () => {
    if (!tenantId) {
      alert('Tenant ID not found. Please restart the app.');
      return;
    }

    setIsProvisioning(true);
    setResult(null);
    setProgress(null);

    try {
      // Get local database path
      const appDir = await appDataDir();
      // Ensure proper path separator
      const dbPath = appDir.endsWith('/') || appDir.endsWith('\\')
        ? `${appDir}pos.db`
        : `${appDir}/pos.db`;

      console.log('[D1ProvisionButton] Starting provisioning via worker API');
      console.log('[D1ProvisionButton] Tenant ID:', tenantId);
      console.log('[D1ProvisionButton] Database path:', dbPath);
      console.log('[D1ProvisionButton] App data directory:', appDir);

      // Use worker API to provision D1 with schema from local SQLite
      const provisionResult = await d1ProvisioningService.provisionD1(
        tenantId,
        dbPath,
        (progressUpdate) => {
          setProgress(progressUpdate);
        }
      );

      setResult(provisionResult);

      if (provisionResult.success) {
        console.log('[D1ProvisionButton] Provisioning successful');
        onSuccess?.();
      } else {
        console.error('[D1ProvisionButton] Provisioning failed:', provisionResult.error);
        onError?.(provisionResult.error || 'Provisioning failed');
      }
    } catch (error: any) {
      console.error('[D1ProvisionButton] Exception during provisioning:', error);
      const errorResult: D1ProvisionResult = {
        success: false,
        output: '',
        error: error.message || 'Unknown error',
      };
      setResult(errorResult);
      onError?.(errorResult.error!);
    } finally {
      setIsProvisioning(false);
      setProgress(null);
    }
  };


  const getStatusMessage = () => {
    if (!result) return null;

    if (result.success) {
      return (
        <div className="mt-4 p-4 bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 text-green-800 font-medium">
            <CheckCircle className="w-5 h-5" />
            Database provisioned successfully!
          </div>
          {result.tables_created && (
            <p className="mt-2 text-sm text-green-700">
              Created {result.tables_created} tables
            </p>
          )}
          <button
            onClick={() => setShowOutput(!showOutput)}
            className="mt-2 text-sm text-green-700 underline hover:text-green-800"
          >
            {showOutput ? 'Hide' : 'Show'} output
          </button>
          {showOutput && result.output && (
            <pre className="mt-2 p-3 bg-card border border-green-200 rounded text-xs overflow-auto max-h-64">
              {result.output}
            </pre>
          )}
        </div>
      );
    } else {
      return (
        <div className="mt-4 p-4 bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 text-red-800 font-medium">
            <XCircle className="w-5 h-5" />
            Provisioning failed
          </div>
          {result.error && (
            <p className="mt-2 text-sm text-red-700">{result.error}</p>
          )}
          <button
            onClick={() => setShowOutput(!showOutput)}
            className="mt-2 text-sm text-red-700 underline hover:text-red-800"
          >
            {showOutput ? 'Hide' : 'Show'} error details
          </button>
          {showOutput && result.output && (
            <pre className="mt-2 p-3 bg-card border border-red-200 rounded text-xs overflow-auto max-h-64">
              {result.output}
            </pre>
          )}
        </div>
      );
    }
  };

  return (
    <div className="space-y-4">
      {!databaseId && (
        <div className="p-4 bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <AlertCircle className="w-5 h-5" />
            Database Not Ready
          </div>
          <p className="mt-2 text-sm text-amber-700">
            No D1 database ID found. Please complete tenant activation first.
          </p>
        </div>
      )}

      {/* Progress indicator */}
      {isProvisioning && progress && (
        <div className="p-4 bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2 text-blue-800 font-medium mb-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            {progress.message}
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <p className="text-xs text-blue-700 mt-2">{progress.progress}% complete</p>
        </div>
      )}

      <button
        onClick={handleProvision}
        disabled={isProvisioning || !databaseId}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium rounded"
      >
        {isProvisioning ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            {isAlreadyProvisioned ? 'Syncing Data...' : 'Provisioning Database...'}
          </>
        ) : (
          <>
            <Database className="w-5 h-5" />
            {isAlreadyProvisioned ? 'Sync Data to Cloud' : 'Provision D1 Database'}
          </>
        )}
      </button>

      {getStatusMessage()}

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 text-sm">
        <p className="font-medium text-blue-900">What this does:</p>
        {isAlreadyProvisioned ? (
          <ul className="mt-2 space-y-1 text-blue-800 list-disc list-inside">
            <li>Syncs menu, categories, and inventory to cloud</li>
            <li>Syncs staff, settings, and floor plan data</li>
            <li>Enables automatic background sync</li>
            <li>Database already has {tableCount} tables provisioned</li>
          </ul>
        ) : (
          <ul className="mt-2 space-y-1 text-blue-800 list-disc list-inside">
            <li>Extracts schema from your local SQLite database</li>
            <li>Provisions D1 cloud database with your tables</li>
            <li>Syncs initial data to cloud</li>
            <li>Enables cloud sync for menu, orders, and inventory</li>
          </ul>
        )}
      </div>
    </div>
  );
}
