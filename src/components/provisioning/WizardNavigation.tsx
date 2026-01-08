/**
 * Wizard Navigation Component
 * Provides consistent Back/Next/Skip navigation for provisioning steps
 */

import { useProvisioningStore } from '../../stores/provisioningStore';

interface WizardNavigationProps {
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
  canSkip?: boolean;
  nextLabel?: string;
  backLabel?: string;
  skipLabel?: string;
  isLoading?: boolean;
  hideBack?: boolean;
  hideNext?: boolean;
}

export function WizardNavigation({
  onBack,
  onNext,
  onSkip,
  canGoBack = true,
  canGoNext = true,
  canSkip = false,
  nextLabel = 'Continue',
  backLabel = 'Back',
  skipLabel = 'Skip for now',
  isLoading = false,
  hideBack = false,
  hideNext = false,
}: WizardNavigationProps) {
  const { previousStep, nextStep, getCurrentStepIndex } = useProvisioningStore();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      previousStep();
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      nextStep();
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      nextStep();
    }
  };

  const isFirstStep = getCurrentStepIndex() === 0;
  const showBack = !hideBack && !isFirstStep && canGoBack;

  return (
    <div className="flex items-center justify-between gap-4 pt-6 border-t border-border">
      {/* Back Button */}
      <div className="flex-1">
        {showBack && (
          <button
            onClick={handleBack}
            disabled={isLoading}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </button>
        )}
      </div>

      {/* Right side buttons */}
      <div className="flex items-center gap-3">
        {/* Skip Button */}
        {canSkip && (
          <button
            onClick={handleSkip}
            disabled={isLoading}
            className="px-6 py-3 rounded-xl text-muted-foreground font-bold uppercase tracking-widest text-xs hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {skipLabel}
          </button>
        )}

        {/* Next Button */}
        {!hideNext && (
          <button
            onClick={handleNext}
            disabled={!canGoNext || isLoading}
            className="px-8 py-3 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Processing...
              </>
            ) : (
              <>
                {nextLabel}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Simple footer with just a single action button
 */
interface SimpleFooterProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function SimpleFooter({
  label,
  onClick,
  disabled = false,
  isLoading = false,
  variant = 'primary',
}: SimpleFooterProps) {
  const variantStyles = {
    primary: 'bg-accent text-white shadow-lg shadow-accent/20 hover:scale-[1.02]',
    secondary: 'bg-white/5 border border-white/10 text-foreground hover:bg-white/10',
    danger: 'bg-red-500 text-white shadow-lg shadow-red-500/20 hover:scale-[1.02]',
  };

  return (
    <div className="flex justify-center pt-6 border-t border-border">
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`
          px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs
          disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed
          transition-all flex items-center gap-2
          ${variantStyles[variant]}
        `}
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Processing...
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );
}

export default WizardNavigation;
