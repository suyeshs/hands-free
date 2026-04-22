/**
 * Activation Code Card
 * Displays the tenant's activation code for sharing with other devices/staff.
 * Fetches live from the backend so it's always available in settings,
 * including for single restaurants that want to activate additional devices.
 */

import { useState, useEffect } from 'react';
import { Copy, Check, Key, RefreshCw } from 'lucide-react';
import { useTenantStore } from '../../stores/tenantStore';

export function ActivationCodeCard() {
  const getTenantId = useTenantStore((state) => state.getTenantId);
  const getApiBaseUrl = useTenantStore((state) => state.getApiBaseUrl);

  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchActivationCode = async () => {
    const tenantId = getTenantId();
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/tenant/activation-code?tenantId=${tenantId}`);
      const data = await res.json() as { activationCode?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load activation code');
      setActivationCode(data.activationCode ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activation code');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivationCode();
  }, []);

  const handleCopy = async () => {
    if (!activationCode) return;
    try {
      await navigator.clipboard.writeText(activationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy activation code:', err);
    }
  };

  const tenantId = getTenantId();
  if (!tenantId) return null;

  return (
    <div className="glass-panel-dark rounded-2xl p-5 border border-white/10">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
          <Key className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-base font-bold text-white mb-1">Activation Code</h3>
          <p className="text-sm text-zinc-400 mb-3">
            Share this code to activate additional devices for this restaurant
          </p>

          {isLoading ? (
            <div className="h-10 bg-black/40 border border-white/10 rounded animate-pulse" />
          ) : error ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm text-red-400">{error}</p>
              <button
                onClick={fetchActivationCode}
                className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded"
                title="Retry"
              >
                <RefreshCw className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          ) : activationCode ? (
            <>
              {/* Code Display */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/40 px-3 py-2.5 border border-white/10 rounded">
                  <code className="text-orange-400 font-mono text-base tracking-wide">
                    {activationCode}
                  </code>
                </div>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded flex items-center gap-2"
                  title="Copy activation code"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-zinc-400" />
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Keep this code secure — it grants access to your POS system
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">No activation code found for this tenant.</p>
          )}
        </div>
      </div>
    </div>
  );
}
