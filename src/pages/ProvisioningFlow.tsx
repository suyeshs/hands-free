/**
 * Provisioning Flow Page
 * Main container for the Restaurant OS installation experience
 */

import { useEffect } from 'react';
import { useProvisioningStore, ProvisioningStep } from '../stores/provisioningStore';
import { ProvisioningProgress } from '../components/provisioning/ProvisioningProgress';
import { PhoneVerificationStep } from '../components/provisioning/PhoneVerificationStep';
import { BusinessSetupWizard } from '../components/provisioning/BusinessSetupWizard';
import { MenuUploadWizard } from '../components/provisioning/MenuUploadWizard';
import { OptionalConfigCards } from '../components/provisioning/OptionalConfigCards';
import { DiagnosticsCheck } from '../components/provisioning/DiagnosticsCheck';
import { TrainingModeToggle } from '../components/provisioning/TrainingModeToggle';

interface ProvisioningFlowProps {
  onComplete: () => void;
}

export function ProvisioningFlow({ onComplete }: ProvisioningFlowProps) {
  const { currentStep, isProvisioned } = useProvisioningStore();

  // Redirect to app when provisioning is complete
  useEffect(() => {
    if (isProvisioned) {
      console.log('[ProvisioningFlow] Provisioning complete, redirecting...');
      onComplete();
    }
  }, [isProvisioned, onComplete]);

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-accent/5 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header with progress */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border">
          <div className="max-w-4xl mx-auto py-6">
            <ProvisioningProgress compact={isBusinessStep(currentStep)} />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <StepContent step={currentStep} onComplete={onComplete} />
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 text-center border-t border-border">
          <p className="text-muted-foreground/50 text-xs">
            HandsFree Restaurant OS v1.0.0
          </p>
          {/* Dev mode reset button */}
          {import.meta.env.DEV && (
            <button
              onClick={() => {
                if (confirm('Reset all provisioning data and start fresh?')) {
                  localStorage.removeItem('provisioning-storage');
                  localStorage.removeItem('tenant-storage');
                  localStorage.removeItem('device-operational-storage');
                  localStorage.removeItem('restaurant-settings');
                  window.location.reload();
                }
              }}
              className="mt-2 text-xs text-red-400/50 hover:text-red-400 underline"
            >
              [DEV] Reset Provisioning
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/**
 * Render the current step content
 */
interface StepContentProps {
  step: ProvisioningStep;
  onComplete: () => void;
}

function StepContent({ step, onComplete }: StepContentProps) {
  switch (step) {
    case 'phone_verification':
      return <PhoneVerificationStep />;

    case 'business_basic':
    case 'business_legal':
    case 'business_invoice':
    case 'business_tax':
      return <BusinessSetupWizard currentSubStep={step} />;

    case 'menu_upload':
      return <MenuUploadWizard />;

    case 'optional_config':
      return <OptionalConfigCards />;

    case 'diagnostics':
      return <DiagnosticsCheck />;

    case 'training_mode':
      return <TrainingModeToggle />;

    case 'complete':
      return <CompletionScreen onContinue={onComplete} />;

    default:
      return (
        <div className="glass-panel rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground">Unknown step: {step}</p>
        </div>
      );
  }
}

/**
 * Check if current step is part of business setup wizard
 */
function isBusinessStep(step: ProvisioningStep): boolean {
  return ['business_basic', 'business_legal', 'business_invoice', 'business_tax'].includes(step);
}

/**
 * Completion screen shown when provisioning is done
 */
interface CompletionScreenProps {
  onContinue: () => void;
}

function CompletionScreen({ onContinue }: CompletionScreenProps) {
  const { isTrainingMode } = useProvisioningStore();

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 text-center animate-fade-in">
      {/* Success icon */}
      <div className="w-24 h-24 bg-green-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
        <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-black uppercase tracking-wider mb-2">
        {isTrainingMode ? 'Training Mode Active' : 'Restaurant is Live!'}
      </h1>

      {/* Description */}
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        {isTrainingMode
          ? 'Your Restaurant OS is ready in training mode. All orders will be marked as test orders. You can switch to live mode anytime from Settings.'
          : 'Congratulations! Your restaurant is now live and ready to accept orders.'}
      </p>

      {/* Status badge */}
      <div
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider mb-8
          ${isTrainingMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}
        `}
      >
        <div
          className={`w-2 h-2 rounded-full ${isTrainingMode ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`}
        />
        {isTrainingMode ? 'Training Mode' : 'Live'}
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="px-8 py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] transition-all"
      >
        Open Dashboard
      </button>
    </div>
  );
}

export default ProvisioningFlow;
