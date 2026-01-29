import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  provisioningStatusService,
  type ProvisioningStatus,
  type ProvisioningUpdate,
} from '../../services/provisioningStatusService';
import { useSetupWizardStore } from '../../stores/setupWizardStore';

export function ProvisioningStatusCard() {
  const [status, setStatus] = useState<ProvisioningStatus | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provisioningWebSocketUrl = useSetupWizardStore((state) => state.provisioningWebSocketUrl);
  const setProvisioningWebSocketUrl = useSetupWizardStore((state) => state.setProvisioningWebSocketUrl);

  useEffect(() => {
    // Check if we have a provisioning WebSocket URL in SQLite
    if (!provisioningWebSocketUrl) return;

    console.log('[ProvisioningStatusCard] Found WebSocket URL, connecting...');
    setShowCard(true);

    // Connect to Durable Object WebSocket
    provisioningStatusService.connect(provisioningWebSocketUrl);

    // Subscribe to updates
    const unsubscribe = provisioningStatusService.subscribe((update: ProvisioningUpdate) => {
      console.log('[ProvisioningStatusCard] Received update:', update);

      if (update.type === 'status' || update.type === 'progress') {
        setStatus(update.data as ProvisioningStatus);
        setError(null);
      }

      if (update.type === 'complete') {
        setStatus(update.data as ProvisioningStatus);
        setError(null);

        // Remove WebSocket URL and hide card after 5 seconds
        setTimeout(() => {
          setProvisioningWebSocketUrl(null);
          provisioningStatusService.disconnect();

          setTimeout(() => {
            setShowCard(false);
          }, 5000);
        }, 3000);
      }

      if (update.type === 'error') {
        const errorData = update.data as { error: string };
        console.error('[ProvisioningStatusCard] Provisioning error:', errorData);
        setError(errorData.error);
      }
    });

    return () => {
      unsubscribe();
      provisioningStatusService.disconnect();
    };
  }, [provisioningWebSocketUrl, setProvisioningWebSocketUrl]);

  if (!showCard) {
    return null;
  }

  // Don't show if complete
  if (status?.status === 'complete' && !error) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="glass-panel-dark p-6 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/50 to-cyan-950/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30">
            {error || status?.status === 'failed' ? (
              <AlertCircle className="w-6 h-6 text-white" />
            ) : (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">
              {error || status?.status === 'failed'
                ? 'Provisioning Issue'
                : 'Setting Up Your Database'}
            </h3>

            <p className="text-sm text-blue-200 mb-4">
              {error || status?.error || status?.currentStep || 'Initializing...'}
            </p>

            {/* Progress Bar */}
            {!error && status && status.status !== 'failed' && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-blue-300 mb-1">
                  <span>Progress</span>
                  <span>{status.progressPercent}%</span>
                </div>
                <div className="h-2 bg-blue-900/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${status.progressPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Checklist */}
            {status && !error && (
              <div className="space-y-2">
                <ChecklistItem
                  completed={status.progress.metadata}
                  label="Tenant Account"
                />
                <ChecklistItem
                  completed={status.progress.kvNamespaces}
                  label="Cache & Sessions"
                />
                <ChecklistItem
                  completed={status.progress.d1Database}
                  inProgress={!status.progress.d1Database && status.progressPercent >= 50 && status.progressPercent < 60}
                  label="Database"
                />
                <ChecklistItem
                  completed={status.progress.d1Schema}
                  inProgress={!status.progress.d1Schema && status.progressPercent >= 60 && status.progressPercent < 85}
                  label="Schema (45 tables)"
                />
                <ChecklistItem
                  completed={status.progress.r2Bucket}
                  inProgress={!status.progress.r2Bucket && status.progressPercent >= 85 && status.progressPercent < 100}
                  label="File Storage"
                />
              </div>
            )}

            {/* Error Message */}
            {(error || status?.error) && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error || status?.error}</p>
                <p className="text-red-300 text-xs mt-2">
                  Your restaurant may still be created. Please check back in a few minutes or contact support.
                </p>
              </div>
            )}

            {/* Estimated Time */}
            {status?.estimatedTimeRemaining && !error && status.status !== 'failed' && (
              <p className="text-xs text-blue-400 mt-3">
                Estimated time remaining: ~{Math.ceil(status.estimatedTimeRemaining / 60)} min
              </p>
            )}

            {/* Help Text */}
            {!error && status && status.status === 'in_progress' && (
              <p className="text-xs text-blue-300/70 mt-3">
                You can explore the app while we finish setting up the database in the background.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ChecklistItem({
  completed,
  inProgress = false,
  label,
}: {
  completed: boolean;
  inProgress?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {completed ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
        </motion.div>
      ) : inProgress ? (
        <Loader2 className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-zinc-600 flex-shrink-0" />
      )}
      <span
        className={`text-sm ${
          completed
            ? 'text-green-400 font-medium'
            : inProgress
            ? 'text-blue-300 font-medium'
            : 'text-zinc-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
