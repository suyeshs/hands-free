/**
 * Provisioning Progress Component
 * Shows visual progress indicator for the Restaurant OS installation
 */

import { useProvisioningProgress, STEP_ORDER, STEP_LABELS, ProvisioningStep } from '../../stores/provisioningStore';

interface ProvisioningProgressProps {
  showStepLabels?: boolean;
  compact?: boolean;
}

export function ProvisioningProgress({ showStepLabels = true, compact = false }: ProvisioningProgressProps) {
  const { currentStep, progress, stepIndex, totalSteps, isTrainingMode } = useProvisioningProgress();

  // Steps to display (exclude 'complete' from visual progress)
  const displaySteps = STEP_ORDER.filter((step) => step !== 'complete');

  return (
    <div className={`w-full ${compact ? 'px-4' : 'px-8'}`}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <span className="text-xl">
              {currentStep === 'complete' ? '✅' : '🍽️'}
            </span>
          </div>
          <h2 className="text-lg font-black uppercase tracking-wider">
            {currentStep === 'complete' ? 'Restaurant OS Ready' : 'Installing Restaurant OS'}
          </h2>
        </div>
        {!compact && (
          <p className="text-sm text-muted-foreground">
            {currentStep === 'complete'
              ? isTrainingMode
                ? 'Your system is ready in training mode'
                : 'Your restaurant is live!'
              : `Step ${stepIndex + 1} of ${totalSteps}: ${STEP_LABELS[currentStep]}`}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative mb-4">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent/80 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="absolute right-0 -top-6 text-xs font-bold text-accent">
          {progress}%
        </div>
      </div>

      {/* Step Indicators */}
      {showStepLabels && !compact && (
        <div className="flex justify-between mt-6">
          {displaySteps.map((step, index) => (
            <StepIndicator
              key={step}
              step={step}
              index={index}
              isActive={step === currentStep}
              isComplete={index < stepIndex}
              showLabel={displaySteps.length <= 6}
            />
          ))}
        </div>
      )}

      {/* Compact step dots */}
      {compact && (
        <div className="flex justify-center gap-2 mt-4">
          {displaySteps.map((step, index) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all ${
                index < stepIndex
                  ? 'bg-accent'
                  : step === currentStep
                  ? 'bg-accent/60 ring-2 ring-accent/30'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StepIndicatorProps {
  step: ProvisioningStep;
  index: number;
  isActive: boolean;
  isComplete: boolean;
  showLabel: boolean;
}

function StepIndicator({ step, index, isActive, isComplete, showLabel }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Circle */}
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
          transition-all duration-300
          ${
            isComplete
              ? 'bg-accent text-white'
              : isActive
              ? 'bg-accent/20 text-accent ring-2 ring-accent/50'
              : 'bg-white/10 text-muted-foreground'
          }
        `}
      >
        {isComplete ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          index + 1
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <span
          className={`
            mt-2 text-[10px] uppercase tracking-wider text-center max-w-[60px]
            ${isActive ? 'text-accent font-bold' : isComplete ? 'text-foreground' : 'text-muted-foreground'}
          `}
        >
          {STEP_LABELS[step]}
        </span>
      )}
    </div>
  );
}

export default ProvisioningProgress;
