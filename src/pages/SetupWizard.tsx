/**
 * SetupWizard Component
 * Main wizard orchestrator - manages screen navigation and setup flow
 */

// import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSetupWizardStore } from '../stores/setupWizardStore';
import { SetupScreenLayout } from '../components/setup/SetupScreenLayout';

// Screen components
import { WelcomeScreen } from '../components/setup/screens/WelcomeScreen';
import { RestaurantBasicsScreen } from '../components/setup/screens/RestaurantBasicsScreen';
import { LegalInfoScreen } from '../components/setup/screens/LegalInfoScreen';
import { TaxConfigScreen } from '../components/setup/screens/TaxConfigScreen';
import { OptionalSelectorScreen } from '../components/setup/screens/OptionalSelectorScreen';
import { MenuSetupScreen } from '../components/setup/screens/MenuSetupScreen';
import { StaffSetupScreen } from '../components/setup/screens/StaffSetupScreen';
import { FloorPlanSetupScreen } from '../components/setup/screens/FloorPlanSetupScreen';
import { PrinterSetupScreen } from '../components/setup/screens/PrinterSetupScreen';
import { TrainingModeScreen } from '../components/setup/screens/TrainingModeScreen';
import { SystemCheckScreen } from '../components/setup/screens/SystemCheckScreen';
import { CompletionScreen } from '../components/setup/screens/CompletionScreen';

export default function SetupWizard() {
  const {
    currentScreen,
    markScreenComplete,
    skipScreen,
    goToNextScreen,
    goToPreviousScreen,
    getNextScreen,
    getPreviousScreen,
    canProceed,
    getCurrentScreenIndex,
    getTotalScreens,
    resetWizard,
  } = useSetupWizardStore();

  const currentIndex = getCurrentScreenIndex();
  const totalScreens = getTotalScreens();
  const nextScreen = getNextScreen();
  const prevScreen = getPreviousScreen();

  // Check for corrupted state and show reset UI (only if truly beyond bounds)
  // Note: currentIndex is 0-based, totalScreens is count. So currentIndex should be < totalScreens.
  // Example: 12 screens means indices 0-11, so currentIndex 12 is invalid.
  if (currentIndex >= totalScreens && currentScreen !== 'completion') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fee',
        padding: '20px',
      }}>
        <div style={{
          maxWidth: '600px',
          background: 'white',
          padding: '40px',
          borderRadius: '8px',
          border: '4px solid red',
          textAlign: 'center',
        }}>
          <h1 style={{ color: 'red', fontSize: '24px', marginBottom: '20px' }}>
            ⚠️ Setup Wizard Corrupted
          </h1>
          <p style={{ fontSize: '16px', marginBottom: '10px' }}>
            Step {currentIndex + 1}/{totalScreens} - Invalid state detected
          </p>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '30px' }}>
            The setup wizard is in an invalid state. Click below to reset and start fresh.
          </p>
          <button
            onClick={() => {
              console.log('[SetupWizard] Resetting wizard...');
              resetWizard();
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{
              padding: '15px 30px',
              background: 'red',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Reset Setup Wizard
          </button>
        </div>
      </div>
    );
  }

  // Handle navigation
  const handleNext = () => {
    if (!canProceed()) return;
    markScreenComplete(currentScreen);
    goToNextScreen();
  };

  const handleBack = () => {
    goToPreviousScreen();
  };

  const handleSkip = () => {
    skipScreen(currentScreen);
    goToNextScreen();
  };

  // Get screen-specific props
  const getScreenProps = () => {
    const baseProps = {
      currentStep: currentIndex + 1,
      totalSteps: totalScreens,
      onBack: prevScreen ? handleBack : undefined,
      isNextDisabled: !canProceed(),
    };

    switch (currentScreen) {
      case 'welcome':
        return {
          ...baseProps,
          onNext: handleNext,
          nextLabel: 'Get Started',
          showProgress: false,
        };

      case 'restaurant_basics':
        return {
          ...baseProps,
          onNext: handleNext,
          nextLabel: 'Continue',
        };

      case 'legal_info':
        return {
          ...baseProps,
          onNext: handleNext,
          onSkip: handleSkip,
          nextLabel: 'Continue',
          skipLabel: 'Skip Legal Info',
        };

      case 'tax_config':
        return {
          ...baseProps,
          onNext: handleNext,
          nextLabel: 'Continue',
        };

      case 'optional_selector':
        return {
          ...baseProps,
          onNext: handleNext,
          nextLabel: 'Continue',
        };

      case 'menu_setup':
        return {
          ...baseProps,
          onNext: handleNext,
          nextLabel: 'Continue',
        };

      case 'staff_setup':
        return {
          ...baseProps,
          onNext: handleNext,
          nextLabel: 'Continue',
        };

      case 'floor_plan':
        return {
          ...baseProps,
          onNext: handleNext,
          nextLabel: 'Continue',
        };

      case 'training_mode':
        return {
          ...baseProps,
          onNext: handleNext,
          nextLabel: 'Continue',
        };

      case 'system_check':
        return {
          ...baseProps,
          showProgress: true,
        };

      case 'completion':
        return {
          ...baseProps,
          showProgress: false,
        };

      default:
        return {
          ...baseProps,
          onNext: nextScreen ? handleNext : undefined,
          onSkip: handleSkip,
        };
    }
  };

  const screenProps = getScreenProps();

  // Render current screen content
  const renderScreen = () => {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen />;

      case 'restaurant_basics':
        return <RestaurantBasicsScreen />;

      case 'legal_info':
        return <LegalInfoScreen />;

      case 'tax_config':
        return <TaxConfigScreen />;

      case 'optional_selector':
        return <OptionalSelectorScreen />;

      case 'menu_setup':
        return <MenuSetupScreen />;

      case 'staff_setup':
        return <StaffSetupScreen />;

      case 'floor_plan':
        return <FloorPlanSetupScreen />;

      case 'printer_setup':
        return <PrinterSetupScreen />;

      case 'invoice_config':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Invoice Configuration</h2>
            <p className="text-muted-foreground mb-8">
              Invoice configuration is not yet implemented. Click Next to skip.
            </p>
          </div>
        );

      case 'training_mode':
        return <TrainingModeScreen />;

      case 'system_check':
        return <SystemCheckScreen />;

      case 'completion':
        return <CompletionScreen />;

      default:
        return (
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fee',
            padding: '20px',
          }}>
            <div style={{
              maxWidth: '600px',
              background: 'white',
              padding: '40px',
              borderRadius: '8px',
              border: '4px solid orange',
              textAlign: 'center',
            }}>
              <h1 style={{ color: 'orange', fontSize: '24px', marginBottom: '20px' }}>
                ⚠️ Unknown Screen
              </h1>
              <p style={{ fontSize: '16px', marginBottom: '10px' }}>
                Current screen: <strong>"{currentScreen}"</strong>
              </p>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '30px' }}>
                This screen is not recognized by the setup wizard.
              </p>
              <button
                onClick={() => {
                  console.log('[SetupWizard] Unknown screen, resetting...');
                  resetWizard();
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }}
                style={{
                  padding: '15px 30px',
                  background: 'orange',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Reset and Start Over
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {currentScreen === 'completion' ? (
          // Render completion screen without layout wrapper
          <div key={currentScreen}>
            {renderScreen()}
          </div>
        ) : (
          <SetupScreenLayout key={currentScreen} {...screenProps}>
            {renderScreen()}
          </SetupScreenLayout>
        )}
      </AnimatePresence>
    </>
  );
}
