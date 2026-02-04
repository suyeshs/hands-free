import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  provisioningStatusService,
  type ProvisioningStatus,
  type ProvisioningUpdate,
} from '../../services/provisioningStatusService';
import { useSetupWizardStore } from '../../stores/setupWizardStore';

export function ProvisioningStatusPill() {
  const [status, setStatus] = useState<ProvisioningStatus | null>(null);
  const [showPill, setShowPill] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { provisioningWebSocketUrl, setProvisioningWebSocketUrl } = useSetupWizardStore();

  useEffect(() => {
    // Check if we have a provisioning WebSocket URL in SQLite
    if (!provisioningWebSocketUrl) return;

    console.log('[ProvisioningStatusPill] Found WebSocket URL, connecting...');
    setShowPill(true);

    // Set up connection failure detection - auto-cleanup old data
    const connectionTimer = setTimeout(() => {
      if (!provisioningStatusService.isConnected()) {
        console.warn('[ProvisioningStatusPill] Connection failed after 5 seconds, cleaning up old data');
        setProvisioningWebSocketUrl(null);
        setShowPill(false);
        provisioningStatusService.disconnect();
      }
    }, 5000); // Give it 5 seconds to connect

    // Connect to Durable Object WebSocket
    provisioningStatusService.connect(provisioningWebSocketUrl);

    // Subscribe to updates
    const unsubscribe = provisioningStatusService.subscribe((update: ProvisioningUpdate) => {
      // Clear connection timer on first message
      clearTimeout(connectionTimer);
      console.log('[ProvisioningStatusPill] Received update:', update);

      if (update.type === 'status' || update.type === 'progress') {
        setStatus(update.data as ProvisioningStatus);
        setError(null);
      }

      if (update.type === 'complete') {
        const statusData = update.data as ProvisioningStatus;
        setStatus(statusData);
        setError(null);

        // CRITICAL: Save D1 database ID to tenant config when provisioning completes
        if (statusData.resourceIds?.d1DatabaseId) {
          (async () => {
            try {
              console.log('[ProvisioningStatusPill] Provisioning complete, updating tenant config with D1 database ID:', statusData.resourceIds?.d1DatabaseId);

              const { invoke } = await import('@tauri-apps/api/core');
              const { useTenantStore } = await import('../../stores/tenantStore');

              // Get current tenant config
              const currentConfig = await invoke<any>('get_tenant_config');
              if (currentConfig) {
                // Update with D1 database ID
                const updatedConfig = {
                  ...currentConfig,
                  d1DatabaseId: statusData.resourceIds?.d1DatabaseId,
                };

                await invoke('save_tenant_config', { config: updatedConfig });
                console.log('[ProvisioningStatusPill] ✅ Tenant config updated with D1 database ID');

                // Also update the store in memory
                await useTenantStore.getState().loadFromSQLite();
              }
            } catch (error) {
              console.error('[ProvisioningStatusPill] Failed to update tenant config with D1 database ID:', error);
            }
          })();
        }

        // Remove WebSocket URL and hide pill after 5 seconds
        setTimeout(() => {
          setProvisioningWebSocketUrl(null);
          provisioningStatusService.disconnect();

          setTimeout(() => {
            setShowPill(false);
          }, 5000);
        }, 3000);
      }

      if (update.type === 'error') {
        const errorData = update.data as { error: string };
        console.error('[ProvisioningStatusPill] Provisioning error:', errorData);
        setError(errorData.error);
      }
    });

    return () => {
      clearTimeout(connectionTimer);
      unsubscribe();
      provisioningStatusService.disconnect();
    };
  }, []);

  if (!showPill) {
    return null;
  }

  // Don't show if complete and no error
  if (status?.status === 'complete' && !error) {
    return null;
  }

  const getStatusColor = () => {
    if (error || status?.status === 'failed') return 'red';
    if (status?.status === 'complete') return 'green';
    return 'blue';
  };

  const getStatusIcon = () => {
    if (error || status?.status === 'failed') {
      return <AlertCircle className="w-4 h-4" />;
    }
    if (status?.status === 'complete') {
      return <CheckCircle2 className="w-4 h-4" />;
    }
    return <Loader2 className="w-4 h-4 animate-spin" />;
  };

  const getStatusText = () => {
    if (error) return 'Setup Issue';
    if (status?.status === 'failed') return 'Setup Failed';
    if (status?.status === 'complete') return 'Setup Complete';
    return `Setting up database... ${status?.progressPercent || 0}%`;
  };

  const colorMap = {
    blue: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/40',
      text: 'text-blue-300',
      icon: 'text-blue-400',
    },
    green: {
      bg: 'bg-green-500/20',
      border: 'border-green-500/40',
      text: 'text-green-300',
      icon: 'text-green-400',
    },
    red: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/40',
      text: 'text-red-300',
      icon: 'text-red-400',
    },
  };

  const colors = colorMap[getStatusColor()];

  return (
    <AnimatePresence>
      <motion.div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors.bg} ${colors.border} backdrop-blur-sm`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
      >
        <span className={colors.icon}>{getStatusIcon()}</span>
        <span className={`text-sm font-medium ${colors.text}`}>
          {getStatusText()}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
