/**
 * Store Creation Modal
 * Shows animated provisioning progress matching the admin panel UI
 */

import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface StoreCreationStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  duration?: number;
}

interface StoreCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (activationCode: string) => void;
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
    { id: 'validate', label: 'Validating restaurant information', status: 'pending' },
    { id: 'provision', label: 'Provisioning infrastructure (DNS, KV, D1, R2)', status: 'pending' },
    { id: 'worker', label: 'Deploying tenant worker', status: 'pending' },
    { id: 'activation', label: 'Generating activation code', status: 'pending' },
    { id: 'finalize', label: 'Finalizing restaurant setup', status: 'pending' },
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

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
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  // Copy activation code to clipboard
  const copyToClipboard = async () => {
    if (!activationCode) return;
    try {
      await navigator.clipboard.writeText(activationCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Store creation with actual provisioning
  useEffect(() => {
    if (!isOpen) return;

    const runStoreCreation = async () => {
      try {
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

        // Store activation code and mark as owner
        localStorage.setItem('pos_activation_code', code);
        localStorage.setItem('is_restaurant_owner', 'true');

        await new Promise((resolve) => setTimeout(resolve, 800));
        setSteps((prev) =>
          prev.map((step, idx) => (idx === 4 ? { ...step, status: 'completed', duration: 800 } : step))
        );

        setIsCompleted(true);
        console.log('[StoreCreationModal] Setup complete with code:', code);
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-panel rounded-2xl border border-border p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {isCompleted ? (
              <svg
                className="w-10 h-10 text-green-400"
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
            ) : error ? (
              <svg
                className="w-10 h-10 text-red-400"
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
              <span className="text-3xl">🏗️</span>
            )}
          </div>
          <h2 className="text-xl font-black uppercase tracking-wider mb-2">
            {isCompleted
              ? 'Restaurant Created!'
              : error
              ? 'Creation Failed'
              : 'Creating Restaurant'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isCompleted
              ? 'Your restaurant is ready to activate'
              : error
              ? 'An error occurred during provisioning'
              : 'Please wait while we set up your infrastructure'}
          </p>
        </div>

        {/* Stopwatch */}
        {!error && (
          <div className="flex items-center justify-center gap-2 mb-6 text-accent font-mono text-lg">
            <svg
              className="w-5 h-5"
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
            {formatTime(elapsedTime)}
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3 mb-8">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-3">
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  step.status === 'completed'
                    ? 'bg-green-500/20 text-green-400'
                    : step.status === 'in-progress'
                    ? 'bg-accent/20 text-accent'
                    : step.status === 'error'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-white/5 text-muted-foreground'
                }`}
              >
                {step.status === 'completed' ? (
                  <svg
                    className="w-5 h-5"
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
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
                ) : step.status === 'error' ? (
                  <svg
                    className="w-5 h-5"
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
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>

              {/* Label */}
              <div className="flex-1">
                <p
                  className={`text-sm ${
                    step.status === 'in-progress'
                      ? 'text-foreground font-medium'
                      : step.status === 'completed'
                      ? 'text-green-400'
                      : step.status === 'error'
                      ? 'text-red-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </p>
                {step.duration && (
                  <p className="text-xs text-muted-foreground">
                    Completed in {(step.duration / 1000).toFixed(2)}s
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Activation Code Display */}
        {isCompleted && activationCode && (
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 text-center">
              Activation Code
            </p>
            <div className="relative">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                <p className="text-2xl font-mono font-bold text-accent tracking-wider">
                  {activationCode}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                title="Copy to clipboard"
              >
                {isCopied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-2 text-center">
              Save this code - you'll need it to activate your POS system
            </p>
          </div>
        )}

        {/* Action Button */}
        {isCompleted && activationCode && (
          <button
            onClick={() => onComplete(activationCode)}
            className="w-full py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] transition-all"
          >
            Continue to Activation
          </button>
        )}

        {error && (
          <button
            onClick={onClose}
            className="w-full py-4 rounded-xl bg-white/10 border border-white/10 text-foreground font-bold uppercase tracking-widest text-sm hover:bg-white/20 transition-all"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

export default StoreCreationModal;
