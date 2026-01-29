/**
 * D1 Database Provisioning Button
 *
 * Allows users to provision the D1 database schema using wrangler CLI
 */

import { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  checkWranglerInstalled,
  getWranglerVersion,
  provisionD1Schema,
  type D1ProvisionResult,
} from '../../services/d1Provision';

interface D1ProvisionButtonProps {
  databaseId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function D1ProvisionButton({
  databaseId,
  onSuccess,
  onError,
}: D1ProvisionButtonProps) {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [wranglerInstalled, setWranglerInstalled] = useState<boolean | null>(null);
  const [wranglerVersion, setWranglerVersion] = useState<string | null>(null);
  const [result, setResult] = useState<D1ProvisionResult | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    checkWrangler();
  }, []);

  const checkWrangler = async () => {
    const installed = await checkWranglerInstalled();
    setWranglerInstalled(installed);

    if (installed) {
      const version = await getWranglerVersion();
      setWranglerVersion(version);
    }
  };

  const handleProvision = async () => {
    if (!databaseId) {
      alert('No database ID found. Please complete tenant activation first.');
      return;
    }

    if (!wranglerInstalled) {
      alert(
        'Wrangler CLI is not installed. Please install it with:\nnpm install -g wrangler'
      );
      return;
    }

    setIsProvisioning(true);
    setResult(null);

    try {
      const provisionResult = await provisionD1Schema(databaseId);
      setResult(provisionResult);

      if (provisionResult.success) {
        onSuccess?.();
      } else {
        onError?.(provisionResult.error || 'Provisioning failed');
      }
    } catch (error: any) {
      const errorResult: D1ProvisionResult = {
        success: false,
        output: '',
        error: error.message || 'Unknown error',
      };
      setResult(errorResult);
      onError?.(errorResult.error!);
    } finally {
      setIsProvisioning(false);
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

  if (wranglerInstalled === false) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200">
        <div className="flex items-center gap-2 text-amber-800 font-medium">
          <AlertCircle className="w-5 h-5" />
          Wrangler CLI Required
        </div>
        <p className="mt-2 text-sm text-amber-700">
          To provision the D1 database, you need to install Wrangler CLI:
        </p>
        <code className="mt-2 block p-2 bg-amber-100 rounded text-sm">
          npm install -g wrangler
        </code>
        <button
          onClick={checkWrangler}
          className="mt-3 px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 transition-colors text-sm"
        >
          Check Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {wranglerVersion && (
        <div className="text-sm text-muted-foreground">
          Wrangler CLI: {wranglerVersion}
        </div>
      )}

      <button
        onClick={handleProvision}
        disabled={isProvisioning || !databaseId}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isProvisioning ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Provisioning Database...
          </>
        ) : (
          <>
            <Database className="w-5 h-5" />
            Provision D1 Database
          </>
        )}
      </button>

      {!databaseId && (
        <p className="text-sm text-amber-600">
          No database ID found. Please complete tenant activation first.
        </p>
      )}

      {getStatusMessage()}

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 text-sm">
        <p className="font-medium text-blue-900">What this does:</p>
        <ul className="mt-2 space-y-1 text-blue-800 list-disc list-inside">
          <li>Provisions 45 tables in your D1 database</li>
          <li>Enables cloud sync for menu, orders, and inventory</li>
          <li>Completes in ~5-10 seconds (vs 2+ minutes via API)</li>
          <li>Uses wrangler CLI for reliable batch execution</li>
        </ul>
      </div>
    </div>
  );
}
