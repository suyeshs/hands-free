/**
 * Restaurant Settings Component (India - Quick Service)
 * Uses shared components library and manifest-driven layout
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RestaurantSettingsProvider } from '@/components/settings-shared/contexts/RestaurantSettingsContext';
import { SettingsHeader } from '@/components/settings-shared/layout/SettingsHeader';
import { TabNavigation } from '@/components/settings-shared/layout/TabNavigation';
import { SettingsFooter } from '@/components/settings-shared/layout/SettingsFooter';
import { Info } from 'lucide-react';

// Import all section components
import {
  RestaurantTypeSection,
  RestaurantDetailsSection,
  AddressContactSection,
  OnlineFeaturesSection,
  LogoUploadSection,
  TaxConfigurationSection,
  LegalInfoSection,
  InvoiceConfigSection,
  PrintingSection,
  AppearanceSection,
} from '@/components/settings-shared/sections';

// Import manifest to get layout config
import manifest from '../../manifest.json';

// Component registry - maps component names to actual components
const COMPONENT_REGISTRY = {
  RestaurantTypeSection,
  RestaurantDetailsSection,
  AddressContactSection,
  OnlineFeaturesSection,
  LogoUploadSection,
  TaxConfigurationSection,
  LegalInfoSection,
  InvoiceConfigSection,
  PrintingSection,
  AppearanceSection,
};

// Help text for each tab
const TAB_HELP_TEXT = {
  essentials: {
    icon: '💡',
    title: 'What this enables',
    description: 'Essential information for your quick-service restaurant including business details, contact information, and online features for order management.',
    note: 'Complete these fields to get started with taking orders and generating receipts.',
  },
  'tax-legal': {
    icon: '💡',
    title: 'What this enables',
    description: 'GST-compliant billing for Indian quick-service restaurants. GSTIN and FSSAI numbers are printed on all receipts.',
    note: 'Required for legal operations in India. Complete within 7 days of starting operations.',
  },
  operations: {
    icon: '💡',
    title: 'What this enables',
    description: 'Customize invoice numbering, receipt format, and printing options for your thermal printer.',
    note: 'Configure these settings to match your branding and operational preferences.',
  },
  appearance: {
    icon: '💡',
    title: 'What this enables',
    description: 'Adjust screen brightness and interface style to match your environment and preferences.',
    note: 'Optimize for daylight or evening operations with adaptive brightness.',
  },
};

function RestaurantSettingsContent() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(manifest.layout.tabs[0].id);
  const [showBillPreview, setShowBillPreview] = useState(false);

  // Find current tab config
  const currentTab = manifest.layout.tabs.find(tab => tab.id === activeTab) || manifest.layout.tabs[0];

  // Get help text for current tab
  const helpText = TAB_HELP_TEXT[activeTab as keyof typeof TAB_HELP_TEXT];

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <SettingsHeader
        title="Restaurant Settings"
        breadcrumbs={['Settings', 'Business Setup', 'Restaurant Information']}
        onBack={() => navigate('/settings')}
      />

      {/* Sticky Tabs */}
      <TabNavigation
        tabs={manifest.layout.tabs.map(tab => ({
          id: tab.id,
          label: tab.label,
          icon: tab.icon,
          priority: tab.priority as 'essential' | 'advanced',
        }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 pb-32">
        <div className="space-y-6 w-full">
          {/* Contextual Help Box */}
          {helpText && (
            <div className="neo-raised bg-info/10 border border-info/30 p-5 flex gap-3 rounded-lg">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">{helpText.icon} {helpText.title}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  {helpText.description}
                </p>
                <p className="text-xs text-muted-foreground italic">
                  {helpText.note}
                </p>
              </div>
            </div>
          )}

          {/* Render sections for current tab */}
          {currentTab.sections.map((section) => {
            const Component = COMPONENT_REGISTRY[section.component as keyof typeof COMPONENT_REGISTRY];
            if (!Component) {
              console.warn(`[RestaurantSettings] Component not found: ${section.component}`);
              return null;
            }
            return <Component key={section.id} />;
          })}
        </div>
      </div>

      {/* Fixed Footer */}
      <SettingsFooter
        showBillPreview={showBillPreview}
        onTogglePreview={() => setShowBillPreview(!showBillPreview)}
      />
    </div>
  );
}

export function RestaurantSettings() {
  return (
    <RestaurantSettingsProvider>
      <RestaurantSettingsContent />
    </RestaurantSettingsProvider>
  );
}
