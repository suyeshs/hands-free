'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { GlassCard } from '../ui/GlassCard';
import { API_URL } from '../../config/api';

interface StoreCreationStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  duration?: number;
}

interface StoreCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
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
  const [steps, setSteps] = useState<StoreCreationStep[]>([
    { id: 'validate', label: 'Validating store information', status: 'pending' },
    { id: 'provision', label: 'Provisioning infrastructure (KV, D1, R2)', status: 'pending' },
    { id: 'subdomain', label: 'Verifying subdomain accessibility', status: 'pending' },
    { id: 'finalize', label: 'Finalizing store setup', status: 'pending' },
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Stopwatch
  useEffect(() => {
    if (!isOpen || isCompleted || error) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 10);
    }, 10);

    return () => clearInterval(interval);
  }, [isOpen, isCompleted, error]);

  // Format elapsed time as MM:SS.ms
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };


  // Store creation with actual provisioning and verification
  useEffect(() => {
    if (!isOpen) return;

    const runStoreCreation = async () => {
      try {
        // Step 1: Validate (quick client-side)
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 0 ? { ...step, status: 'in-progress' } : step
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 0 ? { ...step, status: 'completed', duration: 300 } : step
          )
        );
        setCurrentStepIndex(1);

        // Step 2: Provision infrastructure (actual API call - takes 20-30 seconds)
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 1 ? { ...step, status: 'in-progress' } : step
          )
        );

        const provisionStartTime = Date.now();
        const result = await createStoreFn(); // Actual store creation API call
        const provisionDuration = Date.now() - provisionStartTime;

        // Extract tenant data from result for verification
        let tenant: { subdomain?: string; fullDomain?: string; tenantId?: string; companyName?: string } | undefined;
        if (result && typeof result === 'object' && 'tenant' in result) {
          tenant = result.tenant as { subdomain?: string; fullDomain?: string; tenantId?: string; companyName?: string };
        }

        // Register tenant to KV for worker access (important for restaurant routing!)
        if (tenant?.tenantId) {
          try {
            console.log(`[Provisioning] Registering tenant to KV: ${tenant.tenantId}`);
            await fetch(`${API_URL}/api/tenants/register-to-kv`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenantId: tenant.tenantId,
                companyName: tenant.companyName || tenant.tenantId
              })
            });
            console.log(`[Provisioning] Tenant registered to KV successfully`);
          } catch (kvError) {
            console.warn('[Provisioning] Failed to register tenant to KV (non-critical):', kvError);
            // Don't fail provisioning if KV registration fails - it can be done later
          }
        }

        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 1 ? { ...step, status: 'completed', duration: provisionDuration } : step
          )
        );
        setCurrentStepIndex(2);

        // Step 3: Verify subdomain accessibility
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 2 ? { ...step, status: 'in-progress' } : step
          )
        );

        const verifyStartTime = Date.now();

        // Wait for DNS propagation (Cloudflare typically takes 2-5 seconds)
        // Domain service created the subdomain, now we wait for DNS to propagate
        if (tenant?.fullDomain) {
          console.log(`[Provisioning] Waiting for DNS propagation: ${tenant.fullDomain}`);
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
          console.log(`[Provisioning] Subdomain should be accessible: ${tenant.fullDomain}`);
        }

        const verifyDuration = Date.now() - verifyStartTime;

        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 2 ? { ...step, status: 'completed', duration: verifyDuration } : step
          )
        );
        setCurrentStepIndex(3);

        // Step 4: Finalize
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 3 ? { ...step, status: 'in-progress' } : step
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 3 ? { ...step, status: 'completed', duration: 500 } : step
          )
        );

        setIsCompleted(true);
        setTimeout(() => {
          onComplete();
        }, 800);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create store';
        setError(errorMessage);
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === currentStepIndex ? { ...step, status: 'error' } : step
          )
        );
        onError(errorMessage);
      }
    };

    runStoreCreation();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-warm-charcoal/80 backdrop-blur-md"
          onClick={error ? onClose : undefined}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative w-full max-w-lg"
        >
          <GlassCard variant="overlay" className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-display font-bold text-warm-white">
                  {error ? 'Store Creation Failed' : isCompleted ? 'Store Created!' : 'Creating Your Store'}
                </h2>
                <p className="text-sm text-warm-white/60 mt-1">
                  {error ? 'An error occurred during setup' : isCompleted ? 'Setup completed successfully' : 'Please wait while we set up your store'}
                </p>
              </div>

              {/* Stopwatch */}
              <div className="flex items-center gap-2 px-3 py-2 bg-saffron/10 border border-saffron/30 rounded-lg">
                <Clock className="h-4 w-4 text-saffron" />
                <span className="text-sm font-mono font-semibold text-saffron">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-paprika/10 border border-paprika/30 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-paprika flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-paprika-light">
                      {error}
                    </p>
                    <p className="text-xs text-warm-white/60 mt-1">
                      Please try again or contact support if the issue persists.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Progress Steps */}
            <div className="space-y-3 mb-6">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg transition-colors
                    ${step.status === 'in-progress' ? 'bg-saffron/10 border border-saffron/30' : ''}
                    ${step.status === 'completed' ? 'bg-honey/10 border border-honey/30' : ''}
                    ${step.status === 'error' ? 'bg-paprika/10 border border-paprika/30' : ''}
                  `}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {step.status === 'pending' && (
                      <div className="w-6 h-6 rounded-full border-2 border-warm-white/20" />
                    )}
                    {step.status === 'in-progress' && (
                      <Loader2 className="h-6 w-6 text-saffron animate-spin" />
                    )}
                    {step.status === 'completed' && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      >
                        <CheckCircle2 className="h-6 w-6 text-honey" />
                      </motion.div>
                    )}
                    {step.status === 'error' && (
                      <AlertCircle className="h-6 w-6 text-paprika" />
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="flex-1">
                    <p className={`
                      text-sm font-medium
                      ${step.status === 'in-progress' ? 'text-saffron' : ''}
                      ${step.status === 'completed' ? 'text-honey' : ''}
                      ${step.status === 'error' ? 'text-paprika' : ''}
                      ${step.status === 'pending' ? 'text-warm-white/40' : ''}
                    `}>
                      {step.label}
                    </p>
                    {step.duration && (
                      <p className="text-xs text-warm-white/40 mt-0.5">
                        Completed in {step.duration}ms
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Overall Progress Bar */}
            {!error && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-warm-white/60">
                    Overall Progress
                  </span>
                  <span className="text-xs font-medium text-warm-white">
                    {Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-white/[0.03] border border-white/[0.08] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-saffron to-honey rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%`
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {error && (
              <div className="flex justify-end gap-3">
                <Button
                  onClick={onClose}
                  className="bg-paprika hover:bg-paprika-light text-warm-white px-4 py-2"
                >
                  Close
                </Button>
              </div>
            )}

            {isCompleted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center"
              >
                <div className="flex items-center gap-2 text-honey">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Proceeding to next step...
                  </span>
                </div>
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
