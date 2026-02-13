/**
 * Restaurant Settings Component (India - Cloud Kitchen)
 * Delivery-focused configuration for cloud kitchens
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

// Component registry
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
    description: 'Essential information for your cloud kitchen including business details, delivery address, and online ordering integration with aggregators like Zomato and Swiggy.',
    note: 'Accurate address is critical for delivery operations. Enable online features to sync with food aggregators.',
  },
  'tax-legal': {
    icon: '💡',
    title: 'What this enables',
    description: 'GST-compliant billing for cloud kitchens. FSSAI license is mandatory and will be displayed on all packaging and receipts.',
    note: 'FSSAI certification is critical for cloud kitchens. Ensure it\'s up to date before accepting orders.',
  },
  operations: {
    icon: '💡',
    title: 'What this enables',
    description: 'Customize packaging slips, delivery notes, and order management. Configure packaging charges and thermal printer settings.',
    note: 'Packaging charges help cover container costs. Print order details clearly for kitchen staff.',
  },
  appearance: {
    icon: '💡',
    title: 'What this enables',
    description: 'Optimize kitchen display brightness for various lighting conditions in preparation areas.',
    note: 'Adjust brightness for kitchen environment - often requires higher brightness due to ambient lighting.',
  },
};

function RestaurantSettingsContent() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(manifest.layout.tabs[0].id);
  const [showBillPreview, setShowBillPreview] = useState(false);

  const currentTab = manifest.layout.tabs.find(tab => tab.id === activeTab) || manifest.layout.tabs[0];
  const helpText = TAB_HELP_TEXT[activeTab as keyof typeof TAB_HELP_TEXT];

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <SettingsHeader
        title="Cloud Kitchen Settings"
        breadcrumbs={['Settings', 'Business Setup', 'Restaurant Information']}
        onBack={() => navigate('/settings')}
      />

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

      <div className="flex-1 overflow-y-auto p-8 pb-32">
        <div className="space-y-6 w-full">
          {helpText && (
            <div className="neo-raised bg-info/10 border border-info/30 p-5 flex gap-3 rounded-lg">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">{helpText.icon} {helpText.title}</h4>
                <p className="text-sm text-muted-foreground mb-2">{helpText.description}</p>
                <p className="text-xs text-muted-foreground italic">{helpText.note}</p>
              </div>
            </div>
          )}

          {currentTab.sections.map((section) => {
            const Component = COMPONENT_REGISTRY[section.component as keyof typeof COMPONENT_REGISTRY];
            if (!Component) return null;
            return <Component key={section.id} />;
          })}
        </div>
      </div>

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
