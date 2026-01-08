/**
 * Business Setup Wizard
 * Orchestrates the business setup sub-steps in provisioning
 */

import { ProvisioningStep } from '../../stores/provisioningStore';
import { BasicInfoForm } from './forms/BasicInfoForm';
import { LegalInfoForm } from './forms/LegalInfoForm';
import { InvoiceSettingsForm } from './forms/InvoiceSettingsForm';
import { TaxSettingsForm } from './forms/TaxSettingsForm';

interface BusinessSetupWizardProps {
  currentSubStep: ProvisioningStep;
}

// Sub-step configuration
const SUB_STEPS = [
  { step: 'business_basic', label: 'Basic Info', number: 1 },
  { step: 'business_legal', label: 'Legal & Tax IDs', number: 2 },
  { step: 'business_invoice', label: 'Invoice Settings', number: 3 },
  { step: 'business_tax', label: 'Tax Configuration', number: 4 },
];

export function BusinessSetupWizard({ currentSubStep }: BusinessSetupWizardProps) {
  // Find current sub-step index
  const currentIndex = SUB_STEPS.findIndex((s) => s.step === currentSubStep);

  return (
    <div className="space-y-6">
      {/* Sub-step indicator */}
      <div className="flex justify-center gap-2 mb-4">
        {SUB_STEPS.map((subStep, index) => (
          <div key={subStep.step} className="flex items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                transition-all duration-300
                ${
                  index < currentIndex
                    ? 'bg-accent text-white'
                    : index === currentIndex
                    ? 'bg-accent/20 text-accent ring-2 ring-accent/50'
                    : 'bg-white/10 text-muted-foreground'
                }
              `}
            >
              {index < currentIndex ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                subStep.number
              )}
            </div>
            {index < SUB_STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-1 transition-colors ${
                  index < currentIndex ? 'bg-accent' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Current form */}
      {currentSubStep === 'business_basic' && <BasicInfoForm />}
      {currentSubStep === 'business_legal' && <LegalInfoForm />}
      {currentSubStep === 'business_invoice' && <InvoiceSettingsForm />}
      {currentSubStep === 'business_tax' && <TaxSettingsForm />}
    </div>
  );
}

export default BusinessSetupWizard;
