import { Loader2, CheckCircle2, Circle } from 'lucide-react';

interface LocationProvisioningProgressProps {
  isOpen: boolean;
  locationName: string;
  currentStep: number;
  progress: number;
  steps?: string[];
  substeps?: string[];
}

const PROVISIONING_STEPS = [
  '1. Validating location details',
  '2. Provisioning Cloudflare infrastructure',
  '3. Deploying worker',
  '4. Generating activation code',
  '5. Finalizing location setup',
];

const CLOUDFLARE_SUBSTEPS = [
  'Creating D1 database',
  'Creating KV namespace',
  'Creating R2 bucket',
  'Configuring DNS',
];

export function LocationProvisioningProgress({
  isOpen,
  locationName,
  currentStep,
  progress,
  steps = PROVISIONING_STEPS,
  substeps = [],
}: LocationProvisioningProgressProps) {
  if (!isOpen) return null;

  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />;
    } else {
      return <Circle className="w-5 h-5 text-muted-foreground/50" />;
    }
  };

  const getStepTextClass = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return 'text-green-700';
    } else if (stepIndex === currentStep) {
      return 'text-orange-700 font-medium';
    } else {
      return 'text-muted-foreground';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Creating Location</h2>
          <p className="text-sm text-orange-100 mt-1">{locationName}</p>
        </div>

        {/* Progress Content */}
        <div className="p-6 space-y-6">
          {/* Steps List */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-0.5">{getStepIcon(index)}</div>
                <div className="flex-1">
                  <p className={`text-sm ${getStepTextClass(index)}`}>{step}</p>

                  {/* Substeps for Cloudflare infrastructure */}
                  {index === 1 && currentStep === 1 && (
                    <div className="mt-2 ml-4 space-y-1">
                      {CLOUDFLARE_SUBSTEPS.map((substep, subIndex) => (
                        <p key={subIndex} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="w-1 h-1 bg-muted rounded-full"></span>
                          {substep}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Custom substeps if provided */}
                  {index === currentStep && substeps.length > 0 && (
                    <div className="mt-2 ml-4 space-y-1">
                      {substeps.map((substep, subIndex) => (
                        <p key={subIndex} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="w-1 h-1 bg-muted rounded-full"></span>
                          {substep}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-muted-foreground">{Math.round(progress)}%</p>
          </div>

          {/* Warning Message */}
          <div className="bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-800 text-center">
              ⓘ This may take 2-3 minutes. Do not close this window.
            </p>
          </div>

          {/* Loading Animation */}
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
