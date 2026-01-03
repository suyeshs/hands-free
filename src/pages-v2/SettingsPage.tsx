/**
 * Settings Page
 * Comprehensive settings page with all management features
 * Includes: Restaurant Settings, Menu, Specials, Floor Plan, Staff, Customers, Billing, Device
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  ArrowLeft,
  Store,
  UtensilsCrossed,
  Sparkles,
  LayoutGrid,
  Users,
  UserCircle,
  Receipt,
  Smartphone,
  ChevronRight,
  History,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';

// Import all the management components
import { MenuOnboarding } from '../components/admin/MenuOnboarding';
import { SpecialsManager } from '../components/admin/SpecialsManager';
import { FloorPlanManager } from '../components/admin/FloorPlanManager';
import { StaffManager } from '../components/admin/StaffManager';
import { CustomerManager } from '../components/admin/CustomerManager';
import { DeviceSettings } from '../components/admin/DeviceSettings';
import { DineInPricingManager } from '../components/admin/DineInPricingManager';
import { RestaurantSettingsInline } from '../components/admin/RestaurantSettingsInline';
import { PrinterSettingsInline } from '../components/admin/PrinterSettingsInline';
import { BillingHistoryPanel } from '../components/admin/BillingHistoryPanel';

type SettingsTab =
  | 'restaurant'
  | 'menu'
  | 'dine-in-pricing'
  | 'specials'
  | 'floor-plan'
  | 'staff'
  | 'customers'
  | 'billing'
  | 'billing-history'
  | 'device';

interface TabConfig {
  id: SettingsTab;
  label: string;
  description: string;
  icon: typeof Store;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(null);

  // Get effective tenant ID
  const tenantId = user?.tenantId || tenant?.tenantId || '';

  const tabs: TabConfig[] = [
    {
      id: 'restaurant',
      label: 'Restaurant Settings',
      description: 'Basic info, tax, invoice, and print settings',
      icon: Store,
    },
    {
      id: 'menu',
      label: 'Menu Management',
      description: 'Categories, items, prices, and availability',
      icon: UtensilsCrossed,
    },
    {
      id: 'dine-in-pricing',
      label: 'Dine-In Pricing',
      description: 'Configure dine-in price adjustments',
      icon: Receipt,
    },
    {
      id: 'specials',
      label: 'Daily Specials',
      description: 'Manage special dishes and promotions',
      icon: Sparkles,
    },
    {
      id: 'floor-plan',
      label: 'Floor Plan',
      description: 'Configure sections, tables, and seating',
      icon: LayoutGrid,
    },
    {
      id: 'staff',
      label: 'Staff Management',
      description: 'Staff members, PINs, and assignments',
      icon: Users,
    },
    {
      id: 'customers',
      label: 'Customers',
      description: 'Customer database and loyalty info',
      icon: UserCircle,
    },
    {
      id: 'billing',
      label: 'Printer & Billing',
      description: 'Receipt printer and billing configuration',
      icon: Receipt,
    },
    {
      id: 'billing-history',
      label: 'Billing History',
      description: 'View and reprint previous bills',
      icon: History,
    },
    {
      id: 'device',
      label: 'Device Settings',
      description: 'Sync, mode, and device configuration',
      icon: Smartphone,
    },
  ];

  // Render the selected tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'restaurant':
        return <RestaurantSettingsInline />;
      case 'menu':
        return <MenuOnboarding tenantId={tenantId} />;
      case 'dine-in-pricing':
        return <DineInPricingManager />;
      case 'specials':
        return <SpecialsManager tenantId={tenantId} />;
      case 'floor-plan':
        return <FloorPlanManager />;
      case 'staff':
        return <StaffManager />;
      case 'customers':
        return <CustomerManager tenantId={tenantId} />;
      case 'billing':
        return <PrinterSettingsInline />;
      case 'billing-history':
        return <BillingHistoryPanel />;
      case 'device':
        return <DeviceSettings />;
      default:
        return null;
    }
  };

  // If a tab is selected, show its content
  if (activeTab) {
    const currentTab = tabs.find(t => t.id === activeTab);

    return (
      <div className="fixed inset-0 bg-slate-900 text-white flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab(null)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold">{currentTab?.label}</h1>
              <p className="text-sm text-slate-400">{currentTab?.description}</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          {renderTabContent()}
        </main>
      </div>
    );
  }

  // Main settings menu
  return (
    <div className="fixed inset-0 bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/hub')}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-slate-400">Configure your restaurant</p>
          </div>
        </div>
      </header>

      {/* Settings Grid */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl',
                  'bg-slate-800 hover:bg-slate-700 transition-colors',
                  'text-left group'
                )}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center group-hover:bg-slate-600 transition-colors">
                  <Icon size={24} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white">{tab.label}</h3>
                  <p className="text-sm text-slate-400 truncate">{tab.description}</p>
                </div>
                <ChevronRight size={20} className="text-slate-500 group-hover:text-slate-400" />
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
