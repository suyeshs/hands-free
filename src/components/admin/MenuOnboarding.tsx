import { useState, useEffect } from 'react';
import { MenuItem as BackendMenuItem } from '../../lib/backendApi';
import { needsMenuSync, syncMenuFromBackend } from '../../lib/menuSync';
import ExcelUploader from './ExcelUploader';
import MenuConfirmationTable from './MenuConfirmationTable';
import PhotoUploader from './PhotoUploader';
import MenuItemsList from './MenuItemsList';
import { cn } from '../../lib/utils';

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

  const steps = [
    { id: 'upload', label: 'Upload Excel', number: 1 },
    { id: 'confirm', label: 'Confirm Menu', number: 2 },
    { id: 'photos', label: 'Upload Photos', number: 3 },
  ];

  const getStepStatus = (stepId: string) => {
    if (currentStep === 'check') return 'pending';
    const stepOrder = ['upload', 'confirm', 'photos'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Step Indicator */}
      <div className="glass-panel p-6 rounded-2xl border border-border mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-2xl">
              📜
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Menu Management</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Sync or upload your restaurant menu
              </p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between max-w-2xl">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all",
                    status === 'completed' && "bg-green-500/20 text-green-400 border border-green-500/30",
                    status === 'active' && "bg-accent text-white shadow-lg shadow-accent/30",
                    status === 'pending' && "bg-white/5 text-muted-foreground border border-white/10"
                  )}>
                    {status === 'completed' ? '✓' : step.number}
                  </div>
                  <div className="ml-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {step.number}</div>
                    <div className={cn(
                      "text-sm font-bold",
                      status === 'active' ? "text-accent" : "text-foreground"
                    )}>{step.label}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-4 rounded-full transition-all",
                    status === 'completed' ? "bg-green-500/50" : "bg-white/10"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {currentStep === 'check' && (
          <div className="flex items-center justify-center p-8">
            <div className="max-w-3xl w-full glass-panel rounded-2xl border border-border p-8 animate-fade-in">
              {menuSynced === null ? (
                // Loading state
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
                  </div>
                  <p className="text-muted-foreground font-bold">Checking menu status...</p>
                </div>
              ) : menuSynced ? (
                // Menu already synced - show menu items list
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Menu Synced</h2>
                        <p className="text-sm text-muted-foreground">Your menu is ready to use in the POS</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSyncMenu}
                        disabled={syncing}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold uppercase tracking-wider hover:bg-white/10 disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {syncing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                            Syncing...
                          </>
                        ) : (
                          <>↻ Re-sync</>
                        )}
                      </button>
                      <button
                        onClick={() => setCurrentStep('upload')}
                        className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold uppercase tracking-wider shadow-lg shadow-accent/20 hover:scale-105 transition-all"
                      >
                        Upload Custom
                      </button>
                    </div>
                  </div>
                  <MenuItemsList onRefresh={checkMenuStatus} />
                </div>
              ) : (
                // Menu not synced
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl">📋</span>
                  </div>
                  <h2 className="text-2xl font-black uppercase mb-2">No Menu Found</h2>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Sync your menu from the HandsFree platform or upload a new menu document to get started.
                  </p>
                  {syncError && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl max-w-md mx-auto">
                      <p className="text-red-400 text-sm">{syncError}</p>
                    </div>
                  )}
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={handleSyncMenu}
                      disabled={syncing}
                      className="px-6 py-3 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center gap-2"
                    >
                      {syncing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Syncing...
                        </>
                      ) : (
                        <>Sync from HandsFree</>
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentStep('upload')}
                      className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors"
                    >
                      Upload Document
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
