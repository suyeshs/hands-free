/**
 * Restaurant Settings Component (USA - Full Service)
 * Sales tax system with tip management
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
  StaffAccessSection,
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
  StaffAccessSection,
  AppearanceSection,
};

// Help text for each tab
const TAB_HELP_TEXT = {
  basics: {
    icon: '💡',
    title: 'What this enables',
    description: 'Essential business information for your full-service restaurant including contact details, location for reservations, and branding.',
    note: 'Complete business information helps with customer communication and online presence.',
  },
  tax: {
    icon: '💡',
    title: 'What this enables',
    description: 'Sales tax configuration with state and local tax rates. Tip suggestions help servers maximize earnings while maintaining customer satisfaction.',
    note: 'Tax rates vary by state and locality. Verify with your local tax authority.',
  },
  legal: {
    icon: '💡',
    title: 'What this enables',
    description: 'Health permits, liquor licenses, and tax identification numbers required for legal operations in the United States.',
    note: 'EIN and health permit numbers must be available for inspections. Liquor license required if serving alcohol.',
  },
  invoice: {
    icon: '💡',
    title: 'What this enables',
    description: 'Customize invoice format, add disclaimers, and set billing preferences for your restaurant.',
    note: 'Professional invoices build customer trust and simplify accounting.',
  },
  print: {
    icon: '💡',
    title: 'What this enables',
    description: 'Configure receipt printing for thermal printers, including tip lines and payment details.',
    note: 'Ensure paper width matches your printer model (usually 80mm for full-service restaurants).',
  },
  staff: {
    icon: '💡',
    title: 'What this enables',
    description: 'Staff authentication with PIN codes, table assignments for servers, and access control for sensitive operations.',
    note: 'Staff PINs help track sales per server and prevent unauthorized access.',
  },
  appearance: {
    icon: '💡',
    title: 'What this enables',
    description: 'Adjust interface brightness and styling to match your restaurant ambiance and lighting conditions.',
    note: 'Dark mode is popular for evening service in dimly-lit dining rooms.',
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
        title="Restaurant Settings"
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
