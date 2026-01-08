/**
 * Optional Config Cards
 * Card-based UI for optional configuration during provisioning
 */

import { useState } from 'react';
import {
  useProvisioningStore,
  OptionalConfig,
  OPTIONAL_CONFIG_ITEMS,
  OPTIONAL_CONFIG_LABELS,
} from '../../stores/provisioningStore';
import { ConfigCard } from './ConfigCard';
import { WizardNavigation } from './WizardNavigation';

export function OptionalConfigCards() {
  const { optionalConfigCompleted, markOptionalComplete, markStepComplete, nextStep } =
    useProvisioningStore();

  const [activeConfig, setActiveConfig] = useState<OptionalConfig | null>(null);

  const handleConfigComplete = (config: OptionalConfig) => {
    markOptionalComplete(config);
    setActiveConfig(null);
  };

  const handleContinue = () => {
    // Mark optional_config as complete (skippable)
    markStepComplete('optional_config');
    nextStep();
  };

  const completedCount = Object.values(optionalConfigCompleted).filter(Boolean).length;
  const totalCount = OPTIONAL_CONFIG_ITEMS.length;

  // Render active config modal/panel
  if (activeConfig) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          onClick={() => setActiveConfig(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to configuration
        </button>

        {/* Config content */}
        <div className="glass-panel rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>{OPTIONAL_CONFIG_LABELS[activeConfig].icon}</span>
                {OPTIONAL_CONFIG_LABELS[activeConfig].title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {OPTIONAL_CONFIG_LABELS[activeConfig].description}
              </p>
            </div>
            <button
              onClick={() => handleConfigComplete(activeConfig)}
              className="px-4 py-2 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent/90 transition-colors"
            >
              Done
            </button>
          </div>
          <div className="p-4 max-h-[500px] overflow-auto">
            {activeConfig === 'floor_plan' && <FloorPlanConfigContent />}
            {activeConfig === 'staff' && <StaffConfigContent />}
            {activeConfig === 'printer_settings' && <PrinterConfigContent />}
            {activeConfig === 'pos_workflow' && <POSWorkflowConfigContent />}
            {activeConfig === 'aggregator_settings' && <AggregatorConfigContent />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚙️</span>
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">
          Optional Configuration
        </h1>
        <p className="text-muted-foreground text-sm">
          Configure additional settings or skip for now
        </p>
        <div className="mt-3 text-xs text-muted-foreground">
          {completedCount} of {totalCount} configured
        </div>
      </div>

      {/* Config Cards */}
      <div className="space-y-3 mb-6">
        {OPTIONAL_CONFIG_ITEMS.map((config) => (
          <ConfigCard
            key={config}
            icon={OPTIONAL_CONFIG_LABELS[config].icon}
            title={OPTIONAL_CONFIG_LABELS[config].title}
            description={OPTIONAL_CONFIG_LABELS[config].description}
            isComplete={optionalConfigCompleted[config]}
            onClick={() => setActiveConfig(config)}
          />
        ))}
      </div>

      {/* Navigation */}
      <WizardNavigation
        onNext={handleContinue}
        canGoNext={true}
        nextLabel="Continue to Diagnostics"
        canSkip={false}
      />
    </div>
  );
}

// Placeholder config content components
function FloorPlanConfigContent() {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground mb-4">
        Floor plan configuration is available in the Manager Dashboard after setup.
      </p>
      <div className="bg-white/5 rounded-xl p-4 text-sm text-left">
        <h4 className="font-bold mb-2">What you can configure:</h4>
        <ul className="space-y-1 text-muted-foreground">
          <li>- Create dining sections (Indoor, Outdoor, Private, etc.)</li>
          <li>- Add tables with capacity settings</li>
          <li>- Assign staff to sections</li>
        </ul>
      </div>
    </div>
  );
}

function StaffConfigContent() {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground mb-4">
        Staff management is available in the Manager Dashboard after setup.
      </p>
      <div className="bg-white/5 rounded-xl p-4 text-sm text-left">
        <h4 className="font-bold mb-2">What you can configure:</h4>
        <ul className="space-y-1 text-muted-foreground">
          <li>- Add staff members with roles (Server, Kitchen, Manager)</li>
          <li>- Set up PIN codes for POS login</li>
          <li>- Configure permissions per role</li>
        </ul>
      </div>
    </div>
  );
}

function PrinterConfigContent() {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground mb-4">
        Printer settings are available in the Settings menu after setup.
      </p>
      <div className="bg-white/5 rounded-xl p-4 text-sm text-left">
        <h4 className="font-bold mb-2">What you can configure:</h4>
        <ul className="space-y-1 text-muted-foreground">
          <li>- Receipt printer (USB or Network)</li>
          <li>- KOT printer for kitchen</li>
          <li>- Paper size (58mm or 80mm)</li>
          <li>- Print logo and QR code settings</li>
        </ul>
      </div>
    </div>
  );
}

function POSWorkflowConfigContent() {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground mb-4">
        POS workflow settings are available in Restaurant Settings after setup.
      </p>
      <div className="bg-white/5 rounded-xl p-4 text-sm text-left">
        <h4 className="font-bold mb-2">What you can configure:</h4>
        <ul className="space-y-1 text-muted-foreground">
          <li>- Require staff PIN for POS access</li>
          <li>- Filter tables by staff assignment</li>
          <li>- Session timeout settings</li>
          <li>- Order flow customization</li>
        </ul>
      </div>
    </div>
  );
}

function AggregatorConfigContent() {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground mb-4">
        Aggregator integration is available in the Aggregator section after setup.
      </p>
      <div className="bg-white/5 rounded-xl p-4 text-sm text-left">
        <h4 className="font-bold mb-2">What you can configure:</h4>
        <ul className="space-y-1 text-muted-foreground">
          <li>- Connect Zomato Partner Dashboard</li>
          <li>- Connect Swiggy Partner Dashboard</li>
          <li>- Auto-accept order settings</li>
          <li>- Menu sync preferences</li>
        </ul>
      </div>
    </div>
  );
}

export default OptionalConfigCards;
