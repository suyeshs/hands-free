/**
 * Settings Page - Reorganized with Category Hierarchy
 * 6 main categories: Business Setup, Menu & Products, Operations, Hardware & Printing, System & Training, Help & Support
 * 3-level navigation: Categories → Category Detail → Setting Component
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  History,
  GraduationCap,
  HelpCircle,
  Printer,
  LogOut,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useProvisioningStore } from '../stores/provisioningStore';
import { confirmAndArchiveDatabase } from '../lib/databaseBackup';

// Import setting components
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
import { TrainingSettings } from '../components/admin/TrainingSettings';
import { HelpSupportPanel } from '../components/admin/HelpSupportPanel';
import { BulkComboPanel } from '../components/admin/BulkComboPanel';

// Import new category components
import { SettingsCategoryCard } from '../components/settings/SettingsCategoryCard';
import { SettingsCategoryDetail } from '../components/settings/SettingsCategoryDetail';

type SettingsTab =
  | 'restaurant'
  | 'menu'
  | 'dine-in-pricing'
  | 'specials'
  | 'bulk-combo'
  | 'floor-plan'
  | 'staff'
  | 'customers'
  | 'billing'
  | 'billing-history'
  | 'device'
  | 'training'
  | 'help';

type CategoryId = 'business-setup' | 'menu-products' | 'operations' | 'hardware' | 'system-training' | 'help-support';

interface SettingItem {
  id: SettingsTab;
  label: string;
  description: string;
  icon: typeof Store;
  component: React.ComponentType<any>;
  componentProps?: Record<string, any>;
}

interface Category {
  id: CategoryId;
  title: string;
  description: string;
  icon: typeof Store;
  accentColor: 'orange' | 'green' | 'blue' | 'purple' | 'teal' | 'gray';
  settings: SettingItem[];
  priority?: boolean;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { tenant } = useTenantStore();
  const { isTrainingMode } = useProvisioningStore();

  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
  const [activeSetting, setActiveSetting] = useState<SettingsTab | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('[SettingsPage] Not authenticated, redirecting to login');
      navigate('/login');
    }
  }, [isAuthenticated, user, navigate]);

  // Get effective tenant ID
  const tenantId = tenant?.tenantId || user?.tenantId || '';

  // Handle logout
  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('[SettingsPage] Logout failed:', error);
      alert('Logout failed. Please try again.');
    }
  };

  // Handle database backup
  const handleBackup = async () => {
    await confirmAndArchiveDatabase(tenantId);
  };

  // Define all categories with their settings
  const categories: Category[] = [
    {
      id: 'operations',
      title: 'Operations',
      description: 'Staff, customers, and service setup',
      icon: Users,
      accentColor: 'blue',
      priority: true,
      settings: [
        {
          id: 'staff',
          label: 'Staff Management',
          description: 'Staff members, roles, PINs, and assignments',
          icon: Users,
          component: StaffManager,
        },
        {
          id: 'floor-plan',
          label: 'Floor Plan',
          description: 'Configure sections, tables, and seating',
          icon: LayoutGrid,
          component: FloorPlanManager,
        },
        {
          id: 'customers',
          label: 'Customers',
          description: 'Customer database and loyalty info',
          icon: UserCircle,
          component: CustomerManager,
          componentProps: { tenantId },
        },
        {
          id: 'billing-history',
          label: 'Billing History',
          description: 'View and reprint previous bills',
          icon: History,
          component: BillingHistoryPanel,
        },
      ],
    },
    {
      id: 'menu-products',
      title: 'Menu & Products',
      description: 'Manage your menu and offerings',
      icon: UtensilsCrossed,
      accentColor: 'green',
      priority: true,
      settings: [
        {
          id: 'menu',
          label: 'Menu Management',
          description: 'Categories, items, prices, and availability',
          icon: UtensilsCrossed,
          component: MenuOnboarding,
          componentProps: { tenantId },
        },
        {
          id: 'specials',
          label: 'Daily Specials',
          description: 'Manage special dishes and promotions',
          icon: Sparkles,
          component: SpecialsManager,
          componentProps: { tenantId },
        },
        {
          id: 'dine-in-pricing',
          label: 'Dine-In Pricing',
          description: 'Configure dine-in price adjustments',
          icon: Receipt,
          component: DineInPricingManager,
        },
        {
          id: 'bulk-combo',
          label: 'Bulk Combo Setup',
          description: 'Apply same combo options to all items in a category',
          icon: LayoutGrid,
          component: BulkComboPanel,
        },
      ],
    },
    {
      id: 'hardware',
      title: 'Hardware & Printing',
      description: 'Configure printers and devices',
      icon: Printer,
      accentColor: 'purple',
      priority: true,
      settings: [
        {
          id: 'billing',
          label: 'Printer Setup',
          description: 'Configure receipt and KOT printers',
          icon: Printer,
          component: PrinterSettingsInline,
        },
        {
          id: 'device',
          label: 'Device Configuration',
          description: 'Device modes, sync, and network settings',
          icon: Smartphone,
          component: DeviceSettings,
        },
      ],
    },
    {
      id: 'system-training',
      title: 'System & Training',
      description: 'Training mode and system settings',
      icon: GraduationCap,
      accentColor: 'teal',
      settings: [
        {
          id: 'training',
          label: 'Training & Voice AI',
          description: 'Training mode toggle and voice AI walkthrough',
          icon: GraduationCap,
          component: TrainingSettings,
        },
      ],
    },
    {
      id: 'business-setup',
      title: 'Business Setup',
      description: 'Restaurant information and compliance',
      icon: Store,
      accentColor: 'orange',
      settings: [
        {
          id: 'restaurant',
          label: 'Restaurant Information',
          description: 'Basic info, legal, tax, invoice, and print settings',
          icon: Store,
          component: RestaurantSettingsInline,
        },
      ],
    },
    {
      id: 'help-support',
      title: 'Help & Support',
      description: 'Get help and support',
      icon: HelpCircle,
      accentColor: 'gray',
      settings: [
        {
          id: 'help',
          label: 'Help Resources',
          description: 'Guides, tutorials, and diagnostics',
          icon: HelpCircle,
          component: HelpSupportPanel,
        },
      ],
    },
  ];

  // Find active category and setting
  const currentCategory = categories.find(c => c.id === activeCategory);
  const currentSetting = currentCategory?.settings.find(s => s.id === activeSetting);

  // Render setting component content
  const renderSettingContent = () => {
    if (!currentSetting) return null;
    const Component = currentSetting.component;
    return <Component {...(currentSetting.componentProps || {})} />;
  };

  // View 3: Setting Detail
  if (activeSetting && currentSetting) {
    return (
      <div className="settings-page">
        {/* Header */}
        <header className="settings-header">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveSetting(null)}
                className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">{currentSetting.label}</h1>
                <p className="text-sm text-muted-foreground">{currentSetting.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <button
                    onClick={handleBackup}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg font-bold transition-colors"
                    title="Backup Database"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <span className="hidden sm:inline">Backup</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg font-bold transition-colors"
                  >
                    <LogOut size={18} />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          {renderSettingContent()}
        </main>
      </div>
    );
  }

  // View 2: Category Detail
  if (activeCategory && currentCategory) {
    return (
      <div className="settings-page">
        {/* Header */}
        <header className="settings-header">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/hub')}
                className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground">Configure your restaurant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <button
                    onClick={handleBackup}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg font-bold transition-colors"
                    title="Backup Database"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <span className="hidden sm:inline">Backup</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg font-bold transition-colors"
                  >
                    <LogOut size={18} />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="settings-content">
          <div className="max-w-3xl mx-auto">
            <SettingsCategoryDetail
              categoryTitle={currentCategory.title}
              categoryIcon={currentCategory.icon}
              accentColor={currentCategory.accentColor}
              settings={currentCategory.settings.map(s => ({
                id: s.id,
                label: s.label,
                description: s.description,
                icon: s.icon,
              }))}
              onBack={() => setActiveCategory(null)}
              onSelectSetting={(settingId) => setActiveSetting(settingId as SettingsTab)}
            />
          </div>
        </main>
      </div>
    );
  }

  // View 1: Categories View (Default)
  return (
    <div className="settings-page">
      {/* Header */}
      <header className="settings-header">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/hub')}
              className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Configure your restaurant</p>
            </div>
          </div>
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg font-bold transition-colors"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="settings-content">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Status Banner */}
          {isTrainingMode && (
            <div className="bg-yellow-500/20 border-2 border-yellow-500/40 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={24} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-1">
                    Training Mode Active
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                    Orders are not synced to the cloud. Perfect for practice and testing!
                  </p>
                  <button
                    onClick={() => {
                      setActiveCategory('system-training');
                      setActiveSetting('training');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-md"
                  >
                    <CheckCircle2 size={16} />
                    Switch to Live Mode
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Category Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((category) => (
              <SettingsCategoryCard
                key={category.id}
                id={category.id}
                title={category.title}
                description={category.description}
                icon={category.icon}
                accentColor={category.accentColor}
                priority={category.priority}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </div>

          {/* Quick Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
            <p className="text-sm text-blue-200">
              <strong>Tip:</strong> Settings are organized by category to help you find what you need quickly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
