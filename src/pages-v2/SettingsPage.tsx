/**
 * Settings Page - Reorganized with Category Hierarchy
 * 6 main categories: Business Setup, Menu & Products, Operations, Hardware & Printing, System & Training, Help & Support
 * 3-level navigation: Categories → Category Detail → Setting Component
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Clock,
  Calendar,
  Briefcase,
  Database,
  Cloud,
  Mic,
  Globe,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useProvisioningStore } from '../stores/provisioningStore';

// Import setting components
import { MenuOnboarding } from '../components/admin/MenuOnboarding';
import { SpecialsManager } from '../components/admin/SpecialsManager';
import { FloorPlanManager } from '../components/admin/FloorPlanManager';
import { StaffManager } from '../components/admin/StaffManager';
import { CustomerManager } from '../components/admin/CustomerManager';
import { DeviceSettings } from '../components/admin/DeviceSettings';
import { DeviceRegistrationManager } from '../components/admin/DeviceRegistrationManager';
import { DineInPricingManager } from '../components/admin/DineInPricingManager';
import { RestaurantSettingsInline } from '../components/admin/RestaurantSettingsInline';
import { PrinterSettingsInline } from '../components/admin/PrinterSettingsInline';
import { BillingHistoryPanel } from '../components/admin/BillingHistoryPanel';
import { TrainingSettings } from '../components/admin/TrainingSettings';
import { HelpSupportPanel } from '../components/admin/HelpSupportPanel';
import { AttendanceManagement } from '../components/admin/AttendanceManagement';
import { RosterManagement } from '../components/admin/RosterManagement';
import { LeaveManagement } from '../components/admin/LeaveManagement';
import { MigrationDiagnostics } from '../components/admin/MigrationDiagnostics';
import { CloudSyncSettings } from '../components/admin/CloudSyncSettings';
import { D1ProvisionButton } from '../components/admin/D1ProvisionButton';
// Import new category components
import { SettingsCategoryCard } from '../components/settings/SettingsCategoryCard';
import { SettingsCategoryDetail } from '../components/settings/SettingsCategoryDetail';
import { ActivationCodeCard } from '../components/settings/ActivationCodeCard';
import { QROrderingSettings } from './QROrderingSettings';
import { OnlinePresenceSettings } from './OnlinePresenceSettings';
import { HandsfreeSetupPanel } from '../components/handsfree/HandsfreeSetupPanel';
import { cn } from '../lib/utils';
import { TenantSwitcher } from '../components/locations/TenantSwitcher';

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
  | 'device'
  | 'device-registration'
  | 'qr-ordering'
  | 'online-presence'
  | 'attendance-tracking'
  | 'weekly-roster'
  | 'leave-management'
  | 'training'
  | 'handsfree-setup'
  | 'cloud-sync'
  | 'migrations'
  | 'd1-provision'
  | 'help';

type CategoryId = 'business-setup' | 'menu-products' | 'operations' | 'hardware' | 'attendance-rostering' | 'system-training' | 'help-support';

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
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { tenant } = useTenantStore();
  const { isTrainingMode } = useProvisioningStore();

  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
  const [activeSetting, setActiveSetting] = useState<SettingsTab | null>(null);

  // Handle deep linking from /menu route or other shortcuts
  useEffect(() => {
    const state = location.state as { openCategory?: CategoryId; openSetting?: SettingsTab } | undefined;
    if (state?.openCategory) {
      setActiveCategory(state.openCategory);
      if (state.openSetting) {
        setActiveSetting(state.openSetting);
      }
      // Clear the state to prevent re-opening on back navigation
      window.history.replaceState({}, document.title);
    }
  }, [location]);

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

  // Handle setting selection
  const handleSelectSetting = (settingId: SettingsTab) => {
    setActiveSetting(settingId);
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
          componentProps: { tenantId },
        },
        {
          id: 'floor-plan',
          label: 'Floor Plan',
          description: 'Configure sections, tables, and seating',
          icon: LayoutGrid,
          component: FloorPlanManager,
        },
        {
          id: 'qr-ordering',
          label: 'QR Code Ordering',
          description: 'Enable customer ordering via table QR codes',
          icon: Smartphone,
          component: QROrderingSettings,
        },
        {
          id: 'online-presence',
          label: 'Online Presence',
          description: 'Customer-facing website theme, URL, and online menu',
          icon: Globe,
          component: OnlinePresenceSettings,
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
          description: 'Upload, edit, sync menu items, categories, prices, photos, and themes',
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
      ],
    },
    {
      id: 'hardware',
      title: 'Hardware & Printing',
      description: 'Configure printers, device registration, and device settings',
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
          id: 'device-registration',
          label: 'Device Registration',
          description: 'Register, view, and manage connected devices',
          icon: Smartphone,
          component: DeviceRegistrationManager,
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
      id: 'attendance-rostering',
      title: 'Attendance & Rostering',
      description: 'Time tracking, schedules, and leave management',
      icon: Clock,
      accentColor: 'teal',
      priority: true,
      settings: [
        {
          id: 'attendance-tracking',
          label: 'Attendance Tracking',
          description: 'Clock in/out history, hours, and overtime reports',
          icon: Clock,
          component: AttendanceManagement,
        },
        {
          id: 'weekly-roster',
          label: 'Weekly Roster',
          description: 'Create and manage weekly schedules',
          icon: Calendar,
          component: RosterManagement,
        },
        {
          id: 'leave-management',
          label: 'Leave Management',
          description: 'Leave requests, approvals, and balances',
          icon: Briefcase,
          component: LeaveManagement,
        },
      ],
    },
    {
      id: 'system-training',
      title: 'System & Training',
      description: 'Training mode and system settings',
      icon: GraduationCap,
      accentColor: 'gray',
      settings: [
        {
          id: 'handsfree-setup',
          label: 'Setup Assistant',
          description: 'Interactive settings navigation and configuration',
          icon: Mic,
          component: HandsfreeSetupPanel,
        },
        {
          id: 'training',
          label: 'Training & Voice AI',
          description: 'Training mode toggle and voice AI walkthrough',
          icon: GraduationCap,
          component: TrainingSettings,
        },
        {
          id: 'cloud-sync',
          label: 'Cloud Sync',
          description: 'Manual sync trigger and sync status monitoring',
          icon: Cloud,
          component: CloudSyncSettings,
        },
        {
          id: 'migrations',
          label: 'Migration Diagnostics',
          description: 'View and manage database and settings migrations',
          icon: Database,
          component: MigrationDiagnostics,
        },
        {
          id: 'd1-provision',
          label: 'Cloud Database Setup',
          description: 'Initialize cloud database for multi-device sync',
          icon: Database,
          component: D1ProvisionButton,
          componentProps: { databaseId: localStorage.getItem('d1_database_id') || undefined },
        },
      ],
    },
    {
      id: 'business-setup',
      title: 'Business Setup',
      description: 'Restaurant information and compliance',
      icon: Store,
      accentColor: 'orange',
      priority: true,
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

  // View 3: Setting Detail (Two-panel layout: 20% sidebar + 80% content)
  if (activeSetting && currentSetting) {
    // Restaurant settings get full-screen treatment (no sidebar)
    if (activeSetting === 'restaurant') {
      return (
        <div className="fixed inset-0 bg-background">
          {renderSettingContent()}
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="settings-header flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/hub')}
                className="p-2 hover:bg-surface-2 transition-colors rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground">Configure your restaurant</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TenantSwitcher />
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 status-error hover:bg-destructive/20 font-bold transition-colors rounded-lg"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Two-panel layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - 20% */}
          <aside className="w-[20%] flex-shrink-0 bg-background border-r border-border overflow-y-auto p-4">
            <div className="space-y-3">
              {currentCategory && currentCategory.settings.map((setting) => {
                const isActive = setting.id === activeSetting;
                const Icon = setting.icon;
                return (
                  <button
                    key={setting.id}
                    onClick={() => setActiveSetting(setting.id)}
                    className={cn(
                      "w-full p-4 rounded-xl text-left transition-all",
                      isActive
                        ? "neo-raised bg-primary/10 border-2 border-primary"
                        : "neo-raised-sm hover:neo-hover"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={20} className={cn("flex-shrink-0 mt-0.5", isActive ? "text-primary" : "text-muted-foreground")} />
                      <div className="flex-1 min-w-0">
                        <h3 className={cn("text-sm font-semibold mb-1 truncate", isActive ? "text-foreground" : "text-foreground")}>
                          {setting.label}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Content - 80% */}
          <main className="flex-1 overflow-y-auto overscroll-contain">
            {renderSettingContent()}
          </main>
        </div>
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
                onClick={() => setActiveCategory(null)}
                className="p-2 hover:bg-surface-2 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">{currentCategory.title}</h1>
                <p className="text-sm text-muted-foreground">{currentCategory.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TenantSwitcher />
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 status-error hover:bg-destructive/20 font-bold transition-colors"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
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
              onSelectSetting={(settingId) => handleSelectSetting(settingId as SettingsTab)}
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
              className="p-2 hover:bg-surface-2 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Configure your restaurant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TenantSwitcher />
            {user && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 status-error hover:bg-destructive/20 font-bold transition-colors"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="settings-content">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Status Banner */}
          {isTrainingMode && (
            <div className="status-pending rounded-2xl p-4 border-2">
              <div className="flex items-start gap-3">
                <AlertCircle size={24} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold mb-1">
                    Training Mode Active
                  </h3>
                  <p className="text-sm mb-3">
                    Orders are not synced to the cloud. Perfect for practice and testing!
                  </p>
                  <button
                    onClick={() => {
                      setActiveCategory('system-training');
                      setActiveSetting('training');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success/90 text-white font-semibold text-sm transition-colors shadow-md"
                  >
                    <CheckCircle2 size={16} />
                    Switch to Live Mode
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Activation Code Card */}
          <ActivationCodeCard />

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
          <div className="status-info p-4 text-center">
            <p className="text-sm">
              <strong>Tip:</strong> Settings are organized by category to help you find what you need quickly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
