/**
 * Restaurant Settings Component (India - Cafe)
 * Flexible configuration for casual cafes
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

// Import manifest
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
  basics: {
    icon: '💡',
    title: 'What this enables',
    description: 'Essential cafe information including name, location, contact details, and branding. Perfect for coffee shops, tea lounges, and casual dining cafes.',
    note: 'Your cafe details appear on receipts and help customers find you online.',
  },
  tax: {
    icon: '💡',
    title: 'What this enables',
    description: 'GST configuration for Indian cafes. Service charge is optional and typically 5% for table service. FSSAI license required for food service.',
    note: 'GST rates: 2.5% CGST + 2.5% SGST = 5% total. Service charge is optional for cafes.',
  },
  operations: {
    icon: '💡',
    title: 'What this enables',
    description: 'Customize receipts, invoice format, and thermal printer settings for your cafe counter.',
    note: 'Most cafes use 80mm thermal printers for clean, professional receipts.',
  },
  appearance: {
    icon: '💡',
    title: 'What this enables',
    description: 'Adjust screen brightness and interface styling to match your cafe ambiance.',
    note: 'Bright mode for daytime cafes with natural light, darker for evening coffee bars.',
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
        title="Cafe Settings"
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
