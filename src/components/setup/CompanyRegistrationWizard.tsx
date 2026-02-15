/**
 * Company Registration Wizard
 * Main wizard for company-first workflow
 * Steps: Company Details → First Location → Activation Choice → Provisioning
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { CompanyDetailsStep, type CompanyInfo } from './CompanyDetailsStep';
import { FirstLocationStep, type FirstLocationInfo } from './FirstLocationStep';
import { ActivationChoiceStep, type ActivationChoice } from './ActivationChoiceStep';
import { ActivationCodeModal } from '../locations/ActivationCodeModal';
import { generateActivationCode } from '../../lib/activationCode';
import { syncMenuFromBackend } from '../../lib/menuSync';
import { useChainStore } from '../../stores/chainStore';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';

type Step = 'company-details' | 'first-location' | 'activation-choice' | 'provisioning';

interface ProvisioningProgress {
  step: string;
  progress: number;
}

export function CompanyRegistrationWizard() {
  const navigate = useNavigate();
  const { provisionLocationTenant, ensureChainExists } = useChainStore();
  const updateSettings = useRestaurantSettingsStore((state) => state.updateSettings);

  const [currentStep, setCurrentStep] = useState<Step>('company-details');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [firstLocationInfo, setFirstLocationInfo] = useState<FirstLocationInfo | null>(null);
  const [activationChoice, setActivationChoice] = useState<ActivationChoice | null>(null);

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningProgress, setProvisioningProgress] = useState<ProvisioningProgress>({
    step: '',
    progress: 0,
  });
  const [provisioningError, setProvisioningError] = useState<string | null>(null);

  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationCode, setActivationCode] = useState<string>('');

  // Step 1: Company details completed
  const handleCompanyDetailsComplete = async (data: CompanyInfo) => {
    console.log('[CompanyWizard] Company details:', data);
    setCompanyInfo(data);

    // Save company info to restaurant_settings
    try {
      await invoke('update_company_info', {
        companyInfo: {
          companyName: data.companyName,
          ownerName: data.ownerName,
          ownerEmail: data.ownerEmail,
          ownerPhone: data.ownerPhone,
          companyRegistrationNumber: data.companyRegistrationNumber,
          operationalScale: data.operationalScale,
        },
      });

      // Also update restaurant settings with company name
      await updateSettings({
        name: data.companyName, // For backward compatibility
        ownerName: data.ownerName,
        email: data.ownerEmail,
        phone: data.ownerPhone,
        operationalScale: data.operationalScale,
      });

      console.log('[CompanyWizard] Company info saved');
      setCurrentStep('first-location');
    } catch (error) {
      console.error('[CompanyWizard] Failed to save company info:', error);
      setProvisioningError('Failed to save company information. Please try again.');
    }
  };

  // Step 2: First location details completed
  const handleFirstLocationComplete = (data: FirstLocationInfo) => {
    console.log('[CompanyWizard] First location:', data);
    setFirstLocationInfo(data);
    setCurrentStep('activation-choice');
  };

  // Step 3: Activation choice made
  const handleActivationChoiceComplete = async (choice: ActivationChoice) => {
    console.log('[CompanyWizard] Activation choice:', choice);
    setActivationChoice(choice);
    setCurrentStep('provisioning');

    // Start provisioning
    await startProvisioning(choice);
  };

  // Start provisioning the first location
  const startProvisioning = async (choice: ActivationChoice) => {
    if (!companyInfo || !firstLocationInfo) {
      setProvisioningError('Missing company or location information');
      return;
    }

    setIsProvisioning(true);
    setProvisioningError(null);
    setProvisioningProgress({ step: 'Starting provisioning...', progress: 0 });

    try {
      // Step 1: Ensure chain exists
      console.log('[CompanyWizard] Ensuring chain exists...');
      setProvisioningProgress({ step: 'Creating company chain...', progress: 10 });
      const chainId = await ensureChainExists();
      console.log('[CompanyWizard] Chain ID:', chainId);

      // Step 2: Provision the first location
      console.log('[CompanyWizard] Provisioning first location...');
      const locationMetadata = await provisionLocationTenant(
        chainId,
        {
          locationName: firstLocationInfo.locationName,
          address: firstLocationInfo.address,
          country: 'India',
          phone: firstLocationInfo.phone,
          email: firstLocationInfo.email,
          restaurantType: 'FULL_SERVICE',
        },
        (step, progress) => {
          setProvisioningProgress({ step, progress });
        }
      );

      console.log('[CompanyWizard] Location provisioned:', locationMetadata);

      // Step 3: Generate activation code
      const code = generateActivationCode(companyInfo.companyName, firstLocationInfo.locationName);
      setActivationCode(code);
      console.log('[CompanyWizard] Activation code generated:', code);

      // Step 4: Handle based on activation choice
      if (choice === 'hybrid') {
        // Option A: Activate on this device
        setProvisioningProgress({ step: 'Activating location on this device...', progress: 90 });

        // Configure as location
        await invoke('configure_as_location', {
          location: {
            location_id: locationMetadata.locationId,
            location_tenant_id: locationMetadata.locationTenantId,
            location_name: locationMetadata.locationName,
            chain_id: chainId,
            chain_name: companyInfo.companyName,
            master_tenant_id: locationMetadata.locationTenantId, // TODO: Get actual master tenant ID
            address: locationMetadata.address,
            phone: locationMetadata.phone || '',
            email: locationMetadata.email,
          },
        });

        // Sync menu from master
        // Note: For first location, there may not be a menu yet, so this might be skipped
        try {
          await syncMenuFromBackend(locationMetadata.locationTenantId);
        } catch (error) {
          console.log('[CompanyWizard] Menu sync skipped (no menu yet):', error);
        }

        setProvisioningProgress({ step: 'Setup complete!', progress: 100 });

        // Wait a moment then redirect to POS
        setTimeout(() => {
          navigate('/pos');
        }, 1500);
      } else {
        // Option B: Management-only - Show activation code
        setProvisioningProgress({ step: 'Location created successfully!', progress: 100 });
        setShowActivationModal(true);
        setIsProvisioning(false);
      }
    } catch (error) {
      console.error('[CompanyWizard] Provisioning failed:', error);
      setProvisioningError(
        error instanceof Error ? error.message : 'Failed to provision location'
      );
      setIsProvisioning(false);
    }
  };

  const handleActivationModalClose = () => {
    setShowActivationModal(false);
    // Redirect to management dashboard
    navigate('/hub');
  };

  const steps = [
    { id: 'company-details', title: 'Company Details' },
    { id: 'first-location', title: 'First Location' },
    { id: 'activation-choice', title: 'Device Setup' },
    { id: 'provisioning', title: 'Provisioning' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;

              return (
                <div key={step.id} className="flex-1 relative">
                  <div className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                        isActive
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isCompleted
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isCompleted ? <Check className="w-6 h-6" /> : <span>{index + 1}</span>}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-1 mx-4 rounded transition-all ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div
                      className={`text-sm font-semibold ${
                        isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-lg p-8 mb-6"
          >
            {currentStep === 'company-details' && companyInfo === null && (
              <CompanyDetailsStep
                onComplete={handleCompanyDetailsComplete}
              />
            )}

            {currentStep === 'first-location' && companyInfo && (
              <FirstLocationStep
                companyName={companyInfo.companyName}
                companyPhone={companyInfo.ownerPhone}
                companyEmail={companyInfo.ownerEmail}
                onComplete={handleFirstLocationComplete}
                onBack={() => setCurrentStep('company-details')}
              />
            )}

            {currentStep === 'activation-choice' && firstLocationInfo && (
              <ActivationChoiceStep
                locationName={firstLocationInfo.locationName}
                onComplete={handleActivationChoiceComplete}
                onBack={() => setCurrentStep('first-location')}
                isProcessing={isProvisioning}
              />
            )}

            {currentStep === 'provisioning' && (
              <div className="text-center py-12 space-y-6">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                    {isProvisioning ? (
                      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    ) : provisioningError ? (
                      <AlertCircle className="w-10 h-10 text-red-600" />
                    ) : (
                      <Check className="w-10 h-10 text-green-600" />
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {provisioningError
                      ? 'Provisioning Failed'
                      : isProvisioning
                      ? 'Setting Up Your Location...'
                      : 'Setup Complete!'}
                  </h2>
                  <p className="text-gray-600">
                    {provisioningError
                      ? provisioningError
                      : provisioningProgress.step || 'Creating infrastructure...'}
                  </p>
                </div>

                {isProvisioning && (
                  <div className="max-w-md mx-auto">
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${provisioningProgress.progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {provisioningProgress.progress}% complete
                    </p>
                  </div>
                )}

                {provisioningError && (
                  <button
                    onClick={() => setCurrentStep('activation-choice')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Activation Code Modal (for management-only choice) */}
      {showActivationModal && (
        <ActivationCodeModal
          code={activationCode}
          locationName={firstLocationInfo?.locationName || 'Location'}
          onClose={handleActivationModalClose}
        />
      )}
    </div>
  );
}
