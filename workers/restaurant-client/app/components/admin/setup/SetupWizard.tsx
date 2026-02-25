'use client';

import { useState } from 'react';
import { StepTheme } from './StepTheme';
import { StepAI } from './StepAI';
import { StepMenu } from './StepMenu';
import { Loader2, Check } from 'lucide-react';
import { Card, CardContent } from '../Card';

interface SetupData {
  themePresetId?: string;
  aiConfig?: any;
  menuItems?: any[];
}

interface SetupWizardProps {
  adminToken?: string | null;
}

const RESTAURANT_BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://handsfree-domain-service-prod.suyesh.workers.dev';

export function SetupWizard({ adminToken }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>({});
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTenantId = () => {
    if (typeof window === 'undefined') return 'demo';
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    return subdomain;
  };

  const handleThemeNext = (data: { themePresetId: string }) => {
    setSetupData((prev) => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleAINext = (data: { aiConfig: any }) => {
    setSetupData((prev) => ({ ...prev, ...data }));
    setCurrentStep(3);
  };

  const handleLaunch = async (data: { menuItems: any[] }) => {
    setSetupData((prev) => ({ ...prev, ...data }));
    setLaunching(true);
    setError(null);

    const tenantId = getTenantId();
    const finalData = { ...setupData, ...data };

    try {
      const response = await fetch(
        `${RESTAURANT_BACKEND_URL}/api/restaurant/tenants/provision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            companyName: tenantId,
            restaurantProfile: {
              cuisine: 'Restaurant',
              address: 'TBD',
              phone: '+1234567890',
              hours: '10 AM - 10 PM',
              about: '',
            },
            aiConfig: finalData.aiConfig,
            menuItems: finalData.menuItems || [],
            brandIdentity: {
              primaryColor: '#7c3aed',
              logo: null,
              tagline: null,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to provision restaurant');
      }

      window.location.href = '/admin';
    } catch (err) {
      console.error('Launch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to launch restaurant');
      setLaunching(false);
    }
  };

  if (launching) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: 'var(--admin-primary)' }} />
            <h2 className="text-2xl font-semibold mb-2 font-display">Launching Your Restaurant</h2>
            <p style={{ color: 'var(--admin-muted-fg)' }}>
              Setting up your menu, AI assistant, and theme
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#FDE8E8' }}>
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-semibold mb-4 text-center" style={{ color: '#991B1B' }}>
              Launch Failed
            </h2>
            <p className="text-center mb-6" style={{ color: 'var(--admin-muted-fg)' }}>{error}</p>
            <button
              onClick={() => setError(null)}
              className="admin-btn admin-btn-primary admin-btn-default w-full"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = [
    { number: 1, label: 'Choose Theme' },
    { number: 2, label: 'Configure AI' },
    { number: 3, label: 'Upload Menu' },
  ];

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold tracking-tight mb-2 font-display">
            Restaurant Setup
          </h1>
          <p style={{ color: 'var(--admin-muted-fg)' }}>
            Get your restaurant up and running in 3 simple steps
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto mb-4">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300 ${currentStep >= step.number
                        ? 'text-white'
                        : ''
                      }`}
                    style={{
                      background: currentStep >= step.number ? 'var(--admin-primary)' : 'var(--admin-muted)',
                      color: currentStep >= step.number ? 'white' : 'var(--admin-muted-fg)'
                    }}
                  >
                    {currentStep > step.number ? (
                      <Check size={20} />
                    ) : (
                      step.number
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div
                      className="text-sm font-medium"
                      style={{
                        color: currentStep >= step.number ? 'var(--admin-fg)' : 'var(--admin-muted-fg)'
                      }}
                    >
                      {step.label}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-px mx-4">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        background: currentStep > step.number ? 'var(--admin-primary)' : 'var(--admin-border)'
                      }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="pt-6">
            {currentStep === 1 && <StepTheme onNext={handleThemeNext} />}
            {currentStep === 2 && (
              <StepAI
                onNext={handleAINext}
                onBack={() => setCurrentStep(1)}
              />
            )}
            {currentStep === 3 && (
              <StepMenu
                tenantId={getTenantId()}
                onLaunch={handleLaunch}
                onBack={() => setCurrentStep(2)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
