import { useState, useEffect } from 'react';
import { MenuItem as BackendMenuItem } from '../../lib/backendApi';
import { needsMenuSync, syncMenuFromBackend } from '../../lib/menuSync';
import ExcelUploader from './ExcelUploader';
import MenuConfirmationTable from './MenuConfirmationTable';
import PhotoUploader from './PhotoUploader';
import MenuItemsList from './MenuItemsList';

interface MenuOnboardingProps {
  tenantId: string;
}

type Step = 'check' | 'upload' | 'confirm' | 'photos';

export function MenuOnboarding({ tenantId }: MenuOnboardingProps) {
  const [currentStep, setCurrentStep] = useState<Step>('check');
  const [parsedItems, setParsedItems] = useState<BackendMenuItem[]>([]);
  const [_confirmedItems, setConfirmedItems] = useState<BackendMenuItem[]>([]);
  const [_overallConfidence, setOverallConfidence] = useState<number | undefined>();
  const [menuSynced, setMenuSynced] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Check if menu needs sync on mount
  useEffect(() => {
    checkMenuStatus();
  }, []);

  const checkMenuStatus = async () => {
    try {
      const needsSync = await needsMenuSync();
      setMenuSynced(!needsSync);
    } catch (error) {
      console.error('[MenuOnboarding] Failed to check menu status:', error);
      setMenuSynced(false);
    }
  };

  const handleSyncMenu = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await syncMenuFromBackend(tenantId);
      setMenuSynced(true);
      alert('Menu synced successfully! You can now view it in the POS.');
    } catch (error) {
      console.error('[MenuOnboarding] Sync failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Failed to sync menu');
      setMenuSynced(false);
    } finally {
      setSyncing(false);
    }
  };

  const handleExcelParsed = (items: BackendMenuItem[], confidence?: number) => {
    setParsedItems(items);
    setOverallConfidence(confidence);
    setCurrentStep('confirm');
  };

  const handleMenuConfirmed = (items: BackendMenuItem[]) => {
    setConfirmedItems(items);
    setCurrentStep('photos');
  };

  const handlePhotosComplete = () => {
    // Menu onboarding complete
    alert('Menu onboarding complete! All items have been uploaded.');
  };

  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('check');
    } else if (currentStep === 'photos') {
      setCurrentStep('confirm');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with Step Indicator */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-3xl font-bold mb-6">Menu Onboarding</h1>

        {/* Step Indicator */}
        <div className="flex items-center justify-between max-w-2xl">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              currentStep === 'upload' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
            }`}>
              {currentStep === 'upload' ? '1' : '✓'}
            </div>
            <div className="ml-3">
              <div className="text-sm font-medium">Step 1</div>
              <div className="text-xs text-gray-600">Upload Excel</div>
            </div>
          </div>

          <div className={`flex-1 h-1 mx-4 ${
            currentStep !== 'upload' ? 'bg-green-500' : 'bg-gray-300'
          }`} />

          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              currentStep === 'confirm' ? 'bg-orange-500 text-white' :
              currentStep === 'photos' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              {currentStep === 'photos' ? '✓' : '2'}
            </div>
            <div className="ml-3">
              <div className="text-sm font-medium">Step 2</div>
              <div className="text-xs text-gray-600">Confirm Menu</div>
            </div>
          </div>

          <div className={`flex-1 h-1 mx-4 ${
            currentStep === 'photos' ? 'bg-green-500' : 'bg-gray-300'
          }`} />

          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              currentStep === 'photos' ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              3
            </div>
            <div className="ml-3">
              <div className="text-sm font-medium">Step 3</div>
              <div className="text-xs text-gray-600">Upload Photos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {currentStep === 'check' && (
          <div className="flex items-center justify-center p-12">
            <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
              {menuSynced === null ? (
                // Loading state
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Checking menu status...</p>
                </div>
              ) : menuSynced ? (
                // Menu already synced - show menu items list
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Menu Synced from HandsFree</h2>
                        <p className="text-sm text-gray-600">Your menu is ready to use in the POS</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSyncMenu}
                        disabled={syncing}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 text-sm"
                      >
                        {syncing ? 'Syncing...' : '↻ Re-sync'}
                      </button>
                      <button
                        onClick={() => setCurrentStep('upload')}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Upload Custom Menu
                      </button>
                    </div>
                  </div>
                  <MenuItemsList onRefresh={checkMenuStatus} />
                </div>
              ) : (
                // Menu not synced
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">No Menu Found</h2>
                  <p className="text-gray-600 mb-6">
                    Sync your menu from the HandsFree platform or upload a new menu document.
                  </p>
                  {syncError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-600 text-sm">{syncError}</p>
                    </div>
                  )}
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={handleSyncMenu}
                      disabled={syncing}
                      className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
                    >
                      {syncing ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Syncing...
                        </span>
                      ) : (
                        'Sync from HandsFree'
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentStep('upload')}
                      className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Upload Menu Document
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <ExcelUploader
            tenantId={tenantId}
            onParsed={handleExcelParsed}
          />
        )}

        {currentStep === 'confirm' && (
          <MenuConfirmationTable
            tenantId={tenantId}
            items={parsedItems}
            onConfirmed={handleMenuConfirmed}
            onBack={handleBack}
          />
        )}

        {currentStep === 'photos' && (
          <PhotoUploader
            tenantId={tenantId}
            onComplete={handlePhotosComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}

export default MenuOnboarding;
