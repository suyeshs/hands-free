/**
 * Store Creation Modal
 * Shows animated provisioning progress with menu upload UI style
 * Uses form colors (orange/amber gradient)
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslations } from '../hooks/useTranslations';
import { useSetupWizardStore } from '../stores/setupWizardStore';

interface StoreCreationStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  duration?: number;
}

interface StoreCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (activationCode: string, tenantData?: any) => void;
  onError: (error: string) => void;
  createStoreFn: () => Promise<any>;
}

export function StoreCreationModal({
  isOpen,
  onClose,
  onComplete,
  onError,
  createStoreFn,
}: StoreCreationModalProps) {
  const { t } = useTranslations('common');

  // Helper to use fallback if translation returns the key
  const tf = (key: string, fallback: string) => {
    const translation = t(key);
    return translation === key || translation === `common.${key}` ? fallback : translation;
  };

  const [steps, setSteps] = useState<StoreCreationStep[]>([
    { id: 'validate', label: tf('provisioning.validateStep', 'Validating restaurant information'), status: 'pending' },
    { id: 'provision', label: tf('provisioning.provisionStep', 'Provisioning infrastructure (DNS, KV, D1, R2)'), status: 'pending' },
    { id: 'worker', label: tf('provisioning.workerStep', 'Deploying tenant worker'), status: 'pending' },
    { id: 'activation', label: tf('provisioning.activationStep', 'Generating activation code'), status: 'pending' },
    { id: 'finalize', label: tf('provisioning.finalizeStep', 'Finalizing restaurant setup'), status: 'pending' },
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Stopwatch - Update every 100ms (memoized to prevent unnecessary re-renders)
  useEffect(() => {
    if (!isOpen || isCompleted || error) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isCompleted, error]);

  // Format elapsed time as MM:SS.ms (memoized)
  const formattedTime = useMemo(() => {
    const totalSeconds = Math.floor(elapsedTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((elapsedTime % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }, [elapsedTime]);

  // Copy activation code to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!activationCode) return;
    try {
      await navigator.clipboard.writeText(activationCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [activationCode]);

  // Store creation with actual provisioning
  useEffect(() => {
    if (!isOpen) return;

    const runStoreCreation = async () => {
      try {
        // Step 0: Check API health before starting
        console.log('[StoreCreationModal] 🔍 Checking API health...');
        const apiUrl = import.meta.env.VITE_PLATFORM_API_URL || 'https://handsfree-admin.pages.dev';

        try {
          // Test basic connectivity
          const healthCheck = await fetch(`${apiUrl}`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });

          console.log('[StoreCreationModal] API response:', healthCheck.status);

          if (!healthCheck.ok && healthCheck.status !== 404) {
            console.warn('[StoreCreationModal] ⚠️  API health check failed:', healthCheck.status);
            throw new Error(`API health check failed: ${healthCheck.status}`);
          }

          console.log('[StoreCreationModal] ✅ API is accessible at', apiUrl);
        } catch (healthError: any) {
          console.error('[StoreCreationModal] ❌ API health check failed:', healthError);

          // Check if offline
          if (!navigator.onLine) {
            throw new Error('You are offline. Please check your internet connection and try again.');
          }

          // Check if it's a timeout
          if (healthError.name === 'TimeoutError' || healthError.message?.includes('timeout')) {
            throw new Error(`Cannot reach provisioning server (timeout). Please check your internet connection.`);
          }

          throw new Error(`Cannot reach provisioning server at ${apiUrl}. Please check your internet connection or try again later.`);
        }

        // Step 1: Validate (quick client-side)
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 0 ? { ...step, status: 'in-progress' } : step))
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 0 ? { ...step, status: 'completed', duration: 300 } : step
          )
        );
        setCurrentStepIndex(1);

        // Step 2: Provision infrastructure (actual API call)
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 1 ? { ...step, status: 'in-progress' } : step))
        );

        const provisionStartTime = Date.now();
        const result = await createStoreFn(); // Actual store creation API call
        const provisionDuration = Date.now() - provisionStartTime;

        console.log('[StoreCreationModal] ===== PROVISIONING RESULT =====');
        console.log('[StoreCreationModal] Full API result:', JSON.stringify(result, null, 2));
        console.log('[StoreCreationModal] =====================================');

        if (!result || !result.success) {
          throw new Error(result?.error || 'Failed to create restaurant');
        }

        // Extract activation code
        const code = result.activationCode;
        if (!code) {
          throw new Error('No activation code received from server');
        }
        setActivationCode(code);

        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 1 ? { ...step, status: 'completed', duration: provisionDuration } : step
          )
        );
        setCurrentStepIndex(2);

        // Step 3: Worker deployment simulation (happens server-side)
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 2 ? { ...step, status: 'in-progress' } : step))
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 2 ? { ...step, status: 'completed', duration: 1500 } : step))
        );
        setCurrentStepIndex(3);

        // Step 4: Activation code (already received)
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 3 ? { ...step, status: 'in-progress' } : step))
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 3 ? { ...step, status: 'completed', duration: 500 } : step))
        );
        setCurrentStepIndex(4);

        // Step 5: Finalize and auto-activate
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 4 ? { ...step, status: 'in-progress' } : step))
        );

        // Store activation code and mark as owner in SQLite
        await useSetupWizardStore.getState().setActivationCode(code);
        await useSetupWizardStore.getState().setIsRestaurantOwner(true);

        await new Promise((resolve) => setTimeout(resolve, 800));
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 4 ? { ...step, status: 'completed', duration: 800 } : step))
        );

        setIsCompleted(true);
        console.log('[StoreCreationModal] ✅ Setup complete with code:', code);

        // AUTO-ADVANCE: Automatically proceed to activation after brief delay
        console.log('[StoreCreationModal] Setting up auto-advance timer (1s)...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('[StoreCreationModal] Auto-advancing to activation...');
        onComplete(code, result);
      } catch (err: any) {
        console.error('Store creation error:', err);
        setError(err.message || 'Failed to create restaurant');
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === currentStepIndex ? { ...step, status: 'error' } : step
          )
        );
        onError(err.message || 'Failed to create restaurant');
      }
    };

    runStoreCreation();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-gradient-to-br from-zinc-900 via-neutral-900 to-stone-900 border-2 border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* Current Stage Icon */}
            <div className="text-center mb-8">
              <motion.div
                className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 mb-6 shadow-lg shadow-orange-500/30"
                animate={{
                  scale: isCompleted ? 1 : [1, 1.05, 1],
                }}
                transition={{
                  scale: { duration: 2, repeat: isCompleted ? 0 : Infinity },
                }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={3} />
                ) : error ? (
                  <svg
                    className="w-12 h-12 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                )}
              </motion.div>

              <h2 className="text-2xl font-bold text-orange-500 mb-2">
                {isCompleted
                  ? tf('provisioning.completed', 'Restaurant Created!')
                  : error
                  ? tf('provisioning.failed', 'Creation Failed')
                  : tf('provisioning.creating', 'Creating Restaurant')}
              </h2>
              <p className="text-zinc-300 text-sm">
                {isCompleted
                  ? tf('provisioning.readyMessage', 'Your restaurant is ready!')
                  : error
                  ? tf('provisioning.errorMessage', 'An error occurred during provisioning')
                  : tf('provisioning.pleaseWait', 'Please wait while we set up your infrastructure')}
              </p>
            </div>

            {/* Stopwatch */}
            {!error && (
              <motion.div
                className="flex items-center justify-center gap-2 mb-6 text-orange-500 font-mono text-2xl font-bold"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {formattedTime}
              </motion.div>
            )}

            {/* Steps */}
            <div className="space-y-3 mb-8">
              {steps.map((step, idx) => (
                <motion.div
                  key={step.id}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      step.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : step.status === 'in-progress'
                        ? 'bg-orange-500/20 text-orange-500'
                        : step.status === 'error'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-white/5 text-zinc-500'
                    }`}
                  >
                    {step.status === 'completed' ? (
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : step.status === 'in-progress' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" />
                    ) : step.status === 'error' ? (
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : (
                      <span className="text-sm">{idx + 1}</span>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        step.status === 'in-progress'
                          ? 'text-white'
                          : step.status === 'completed'
                          ? 'text-green-400'
                          : step.status === 'error'
                          ? 'text-red-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <p className="text-red-400 text-sm">{error}</p>
              </motion.div>
            )}

            {/* Activation Code Display */}
            {isCompleted && activationCode && (
              <motion.div
                className="mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 text-center">
                  {tf('provisioning.activationCode', 'Activation Code')}
                </p>
                <div className="relative">
                  <div className="p-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-center">
                    <p className="text-2xl font-mono font-bold text-orange-500 tracking-wider">
                      {activationCode}
                    </p>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] transition-all"
                    title={tf('provisioning.copyToClipboard', 'Copy to clipboard')}
                  >
                    {isCopied ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-zinc-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-2 text-center">
                  {tf('provisioning.saveCodeMessage', "Code saved automatically")}
                </p>
              </motion.div>
            )}

            {/* Error Close Button */}
            {error && (
              <motion.button
                onClick={onClose}
                className="w-full py-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white font-medium hover:bg-white/[0.08] transition-all"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {tf('close', 'Close')}
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default StoreCreationModal;
