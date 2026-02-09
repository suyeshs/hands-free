/**
 * Unified Settings App - No Sidebar Edition
 * Pill-based navigation, card grid layout, mobile-first design
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Store,
  UtensilsCrossed,
  LayoutGrid,
  Users,
  Receipt,
  Printer,
  Smartphone,
  Cloud,
  Database,
  GraduationCap,
  HelpCircle,
  LogOut,
  Calendar,
  Briefcase,
  ChevronRight,
  Building2,
  Sparkles,
  UserCircle,
  History,
  Clock,
  Package,
  Puzzle,
  Download,
  Activity,
  X,
  Search,
  Camera,
  Palette,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { RestaurantType } from '../types/restaurantTypes';
import { cn } from '../lib/utils';
import {
  useHasRestaurantBasics,
  useHasTaxBillingSetup,
  useHasMinimumMenu,
  useHasFloorPlan,
  useHasStaff,
} from '../stores/setupWizardStore';

// Import all settings components
import { RestaurantSettingsInline } from '../components/admin/RestaurantSettingsInline';
import { MenuOnboarding } from '../components/admin/MenuOnboarding';
import { SpecialsManager } from '../components/admin/SpecialsManager';
import { FloorPlanManager } from '../components/admin/FloorPlanManager';
import { StaffManager } from '../components/admin/StaffManager';
import { CustomerManager } from '../components/admin/CustomerManager';
import { DeviceSettings } from '../components/admin/DeviceSettings';
import { DineInPricingManager } from '../components/admin/DineInPricingManager';
import { PrinterSettingsInline } from '../components/admin/PrinterSettingsInline';
import { BillingHistoryPanel } from '../components/admin/BillingHistoryPanel';
import { TrainingSettings } from '../components/admin/TrainingSettings';
import { HelpSupportPanel } from '../components/admin/HelpSupportPanel';
import { AttendanceManagement } from '../components/admin/AttendanceManagement';
import { RosterManagement } from '../components/admin/RosterManagement';
import { LeaveManagement } from '../components/admin/LeaveManagement';
import { WiFiAttendanceSettings } from '../components/admin/WiFiAttendanceSettings';
import { MigrationDiagnostics } from '../components/admin/MigrationDiagnostics';
import { CloudSyncSettings } from '../components/admin/CloudSyncSettings';
import { D1ProvisionButton } from '../components/admin/D1ProvisionButton';
import { PayrollManager } from '../components/admin/PayrollManager';
import ChainManagementPage from './ChainManagementPage';
import ImageManagement from './ImageManagement';
import { PluginStore } from '../components/plugins/PluginStore';
import { PluginManagement } from '../components/plugins/PluginManagement';
import { PluginDiagnostics } from '../components/plugins/PluginDiagnostics';
import { usePluginManager } from '../hooks/usePluginManager';
import { getPluginSettingsItemsByCategory } from '../lib/pluginSettingsMap';
import { VisionAISettings } from '../components/admin/VisionAISettings';
import D1SyncTest from './D1SyncTest';
import AppearancePage from '../pages/AppearancePage';
import { DatabaseSetup } from '../components/DatabaseSetup';

interface SettingItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<any>;
  componentProps?: Record<string, any>;
  searchTerms?: string[];
}

interface SettingCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SettingItem[];
  description?: string;
}

const getSettingsCategories = (
  tenantId: string,
  restaurantType: RestaurantType,
  installedPlugins: Array<{ manifest: { id: string }, enabled: boolean }> = []
): SettingCategory[] => {
  const isMultiLocation = restaurantType === RestaurantType.MULTI_BRAND || restaurantType === RestaurantType.LARGE_CHAIN;
  const hasVisionAI = installedPlugins.some(p => p.manifest.id === 'vision-ai' && p.enabled);

  const businessPluginItems = getPluginSettingsItemsByCategory(installedPlugins, 'business');
  const operationsPluginItems = getPluginSettingsItemsByCategory(installedPlugins, 'operations');
  const inventoryPluginItems = getPluginSettingsItemsByCategory(installedPlugins, 'inventory');
  const peoplePluginItems = getPluginSettingsItemsByCategory(installedPlugins, 'people');
  const systemPluginItems = getPluginSettingsItemsByCategory(installedPlugins, 'system');

  const hasInventoryPlugins = inventoryPluginItems.length > 0;

  return [
    {
      id: 'business',
      label: 'Business',
      icon: Store,
      description: 'Restaurant details, ownership, and legal information',
      items: [
        {
          id: 'restaurant-details',
          label: 'Restaurant Details',
          description: 'Basic information, address, contact, and legal IDs',
          icon: Store,
          component: RestaurantSettingsInline,
          searchTerms: ['restaurant', 'name', 'address', 'gst', 'fssai', 'owner'],
        },
        ...(isMultiLocation ? [{
          id: 'multi-location-builtin',
          label: 'Multi Location',
          description: 'Manage multiple locations and franchises',
          icon: Building2,
          component: ChainManagementPage,
          searchTerms: ['chain', 'locations', 'franchise', 'multi-location', 'branches'],
        }] : []),
        ...businessPluginItems,
      ],
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: UtensilsCrossed,
      description: 'Menu items, categories, pricing, and specials',
      items: [
        {
          id: 'menu-onboarding',
          label: 'Menu Management',
          description: 'Categories, items, pricing, and modifiers',
          icon: UtensilsCrossed,
          component: MenuOnboarding,
          searchTerms: ['menu', 'items', 'categories', 'pricing', 'food'],
        },
        {
          id: 'specials',
          label: 'Specials & Promotions',
          description: 'Daily specials and promotional items',
          icon: Sparkles,
          component: SpecialsManager,
          searchTerms: ['specials', 'promotions', 'offers', 'deals'],
        },
        {
          id: 'dine-in-pricing',
          label: 'Dine-in Pricing',
          description: 'Pricing strategies for dine-in orders',
          icon: Receipt,
          component: DineInPricingManager,
          searchTerms: ['pricing', 'dine-in', 'markup'],
        },
        {
          id: 'menu-images',
          label: 'Menu Images',
          description: 'Upload and manage menu item photos',
          icon: Package,
          component: ImageManagement,
          searchTerms: ['images', 'photos', 'pictures', 'menu'],
        },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: LayoutGrid,
      description: 'Floor plans, tables, QR ordering, and service',
      items: [
        {
          id: 'floor-plan',
          label: 'Floor Plan & Tables',
          description: 'Manage dining areas and table layout',
          icon: LayoutGrid,
          component: FloorPlanManager,
          searchTerms: ['floor', 'tables', 'layout', 'dining', 'areas'],
        },
        ...operationsPluginItems,
      ],
    },
    ...(hasInventoryPlugins ? [{
      id: 'inventory',
      label: 'Inventory',
      icon: Package,
      description: 'Stock management, suppliers, and bar inventory',
      items: [...inventoryPluginItems],
    }] : []),
    {
      id: 'people',
      label: 'People',
      icon: Users,
      description: 'Staff, customers, attendance, and payroll',
      items: [
        {
          id: 'staff-management',
          label: 'Staff Management',
          description: 'Add staff, roles, PINs, and documents',
          icon: Users,
          component: StaffManager,
          componentProps: { tenantId },
          searchTerms: ['staff', 'employees', 'roles', 'pin', 'team'],
        },
        {
          id: 'attendance',
          label: 'Attendance Tracking',
          description: 'Clock in/out and attendance records',
          icon: Clock,
          component: AttendanceManagement,
          searchTerms: ['attendance', 'clock', 'time', 'tracking'],
        },
        {
          id: 'wifi-attendance',
          label: 'WiFi & Auto-Attendance',
          description: 'WiFi access control and automatic clock-in',
          icon: Smartphone,
          component: WiFiAttendanceSettings,
          searchTerms: ['wifi', 'auto', 'attendance', 'automatic', 'network', 'ssid', 'device'],
        },
        {
          id: 'roster',
          label: 'Weekly Roster',
          description: 'Staff schedules and shift planning',
          icon: Calendar,
          component: RosterManagement,
          searchTerms: ['roster', 'schedule', 'shifts', 'planning'],
        },
        {
          id: 'leave',
          label: 'Leave Management',
          description: 'Leave requests and approvals',
          icon: Briefcase,
          component: LeaveManagement,
          searchTerms: ['leave', 'vacation', 'time-off', 'absence'],
        },
        {
          id: 'payroll',
          label: 'Payroll & Advances',
          description: 'Salary, advances, and payslips',
          icon: Receipt,
          component: PayrollManager,
          searchTerms: ['payroll', 'salary', 'wages', 'advance', 'payslip'],
        },
        {
          id: 'customers',
          label: 'Customer Management',
          description: 'Customer database and loyalty',
          icon: UserCircle,
          component: CustomerManager,
          componentProps: { tenantId },
          searchTerms: ['customers', 'clients', 'crm', 'loyalty'],
        },
        ...peoplePluginItems,
      ],
    },
    {
      id: 'hardware',
      label: 'Hardware',
      icon: Printer,
      description: 'Printers, devices, and peripherals',
      items: [
        {
          id: 'printer-settings',
          label: 'Printer Configuration',
          description: 'KOT, bill printers, and receipt settings',
          icon: Printer,
          component: PrinterSettingsInline,
          searchTerms: ['printer', 'print', 'kot', 'receipt', 'bill'],
        },
        {
          id: 'device-settings',
          label: 'Device Settings',
          description: 'POS terminals and hardware setup',
          icon: Smartphone,
          component: DeviceSettings,
          searchTerms: ['device', 'hardware', 'terminal', 'pos'],
        },
      ],
    },
    ...(hasVisionAI ? [{
      id: 'vision-ai',
      label: 'Vision AI',
      icon: Camera,
      description: 'Camera devices for inventory, occupancy tracking, and kitchen monitoring',
      items: [
        {
          id: 'vision-ai-settings',
          label: 'Camera Devices',
          description: 'Configure cameras for inventory management, table occupancy, and kitchen monitoring',
          icon: Camera,
          component: VisionAISettings,
          searchTerms: ['vision', 'ai', 'camera', 'inventory', 'occupancy', 'kitchen', 'surveillance'],
        },
      ],
    }] : []),
    {
      id: 'appearance',
      label: 'Appearance',
      icon: Palette,
      description: 'Customize themes, colors, and UI for all screens',
      items: [
        {
          id: 'theme-settings',
          label: 'Theme & Colors',
          description: 'Customize app appearance, themes, and screen-specific colors',
          icon: Palette,
          component: AppearancePage,
          searchTerms: ['theme', 'appearance', 'colors', 'dark', 'light', 'customize', 'ui', 'kds', 'pos'],
        },
      ],
    },
    {
      id: 'system',
      label: 'System',
      icon: Database,
      description: 'Cloud sync, backups, and system diagnostics',
      items: [
        {
          id: 'cloud-sync',
          label: 'Cloud Sync',
          description: 'Sync data to cloud and manage backups',
          icon: Cloud,
          component: CloudSyncSettings,
          searchTerms: ['cloud', 'sync', 'backup', 'online'],
        },
        {
          id: 'migrations',
          label: 'Database Migrations',
          description: 'View and manage database schema updates',
          icon: Database,
          component: MigrationDiagnostics,
          searchTerms: ['migrations', 'database', 'schema', 'updates'],
        },
        {
          id: 'database-setup',
          label: 'Database Setup',
          description: 'Manual database migration control (prevents auto-startup memory usage)',
          icon: Database,
          component: DatabaseSetup,
          searchTerms: ['database', 'setup', 'migrations', 'manual', 'performance'],
        },
        {
          id: 'd1-provision',
          label: 'Cloud Database',
          description: 'Cloud database setup and sync',
          icon: Database,
          component: () => (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-white mb-4">Cloud Database Setup</h2>
              <p className="text-gray-400 mb-6">
                Initialize and manage your cloud database for multi-device sync.
              </p>
              <D1ProvisionButton />
            </div>
          ),
          searchTerms: ['cloud', 'database', 'sync', 'provision'],
        },
        {
          id: 'training',
          label: 'Training Mode',
          description: 'Demo mode and training settings',
          icon: GraduationCap,
          component: TrainingSettings,
          searchTerms: ['training', 'demo', 'sandbox', 'test'],
        },
        {
          id: 'd1-sync-test',
          label: 'D1 Sync Test',
          description: 'Test D1 synchronization with mock data',
          icon: Activity,
          component: D1SyncTest,
          searchTerms: ['d1', 'sync', 'test', 'mock', 'debug', 'database'],
        },
        ...systemPluginItems,
      ],
    },
    {
      id: 'plugins',
      label: 'Plugins',
      icon: Puzzle,
      description: 'Install and manage plugins to extend functionality',
      items: [
        {
          id: 'plugin-store',
          label: 'Plugin Store',
          description: 'Browse and install available plugins',
          icon: Download,
          component: PluginStore,
          searchTerms: ['plugins', 'extensions', 'marketplace', 'install', 'addons'],
        },
        {
          id: 'installed-plugins',
          label: 'Installed Plugins',
          description: 'Manage and configure your plugins',
          icon: Puzzle,
          component: PluginManagement,
          searchTerms: ['plugins', 'installed', 'manage', 'configure', 'enabled'],
        },
        {
          id: 'plugin-diagnostics',
          label: 'Plugin Diagnostics',
          description: 'Monitor plugin health and troubleshoot issues',
          icon: Activity,
          component: PluginDiagnostics,
          searchTerms: ['plugins', 'diagnostics', 'health', 'troubleshoot', 'debug'],
        },
      ],
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: Receipt,
      description: 'Billing history and support',
      items: [
        {
          id: 'billing-history',
          label: 'Billing History',
          description: 'View subscription and payment history',
          icon: History,
          component: BillingHistoryPanel,
          searchTerms: ['billing', 'subscription', 'payment', 'invoice'],
        },
        {
          id: 'help-support',
          label: 'Help & Support',
          description: 'Get help and contact support',
          icon: HelpCircle,
          component: HelpSupportPanel,
          searchTerms: ['help', 'support', 'contact', 'faq'],
        },
      ],
    },
  ];
};

export default function SettingsApp() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { tenant } = useTenantStore();
  const { settings } = useRestaurantSettingsStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { installedPlugins } = usePluginManager();

  // Track newly added plugins and affected categories for pulse animation
  const previousPluginIdsRef = useRef<Set<string>>(new Set());
  const [newlyAddedCategories, setNewlyAddedCategories] = useState<Set<string>>(new Set());
  const [newlyAddedItems, setNewlyAddedItems] = useState<Set<string>>(new Set());

  // Essential setup validation
  const hasRestaurantBasics = useHasRestaurantBasics();
  const hasTaxBilling = useHasTaxBillingSetup();
  const hasMenu = useHasMinimumMenu();
  const hasFloorPlan = useHasFloorPlan();
  const hasStaff = useHasStaff();

  // Map setting IDs to their completion status
  const essentialSettings = {
    'restaurant-details': hasRestaurantBasics && hasTaxBilling,
    'menu-onboarding': hasMenu,
    'floor-plan': hasFloorPlan,
    'staff-management': hasStaff,
  };

  // Map categories to their essential settings
  const categoryEssentials = {
    'business': ['restaurant-details'],
    'menu': ['menu-onboarding'],
    'operations': ['floor-plan'],
    'people': ['staff-management'],
  };

  // Check if a category has incomplete essential settings
  const categoryHasIncomplete = (categoryId: string): boolean => {
    const essentialIds = categoryEssentials[categoryId as keyof typeof categoryEssentials];
    if (!essentialIds) return false;
    return essentialIds.some(id => !essentialSettings[id as keyof typeof essentialSettings]);
  };

  const tenantId = tenant?.tenantId || user?.tenantId || '';
  const restaurantType = settings.restaurantType || RestaurantType.FULL_SERVICE;

  const urlSetting = searchParams.get('setting');
  const urlCategory = searchParams.get('category') || 'business';
  const [activeCategory, setActiveCategory] = useState<string>(urlCategory);
  const [activeSetting, setActiveSetting] = useState<string | null>(urlSetting);
  const [searchQuery, setSearchQuery] = useState('');

  const settingsCategories = getSettingsCategories(tenantId, restaurantType, installedPlugins);

  // Detect newly installed plugins and mark their categories/items for pulse animation
  useEffect(() => {
    if (installedPlugins.length === 0) return;

    const currentPluginIds = new Set(installedPlugins.filter(p => p.enabled).map(p => p.manifest.id));
    const previousPluginIds = previousPluginIdsRef.current;

    // Find newly added plugins
    const newPluginIds = Array.from(currentPluginIds).filter(id => !previousPluginIds.has(id));

    if (newPluginIds.length > 0) {
      console.log('[SettingsApp] Detected newly installed plugins:', newPluginIds);

      // Import the plugin settings map to determine affected categories
      import('../lib/pluginSettingsMap').then(({ PLUGIN_SETTINGS_MAP }) => {
        const affectedCategories = new Set<string>();
        const affectedItems = new Set<string>();

        // Map of plugin IDs that create or trigger their own dedicated categories
        const pluginOwnCategories: Record<string, string> = {
          'vision-ai': 'vision-ai',
          'inventory-management': 'inventory',
          'bar-management-v2': 'inventory',
        };

        // Find which categories and items are affected by the new plugins
        for (const pluginId of newPluginIds) {
          // Check if this plugin has its own category
          const ownCategory = pluginOwnCategories[pluginId];
          if (ownCategory) {
            affectedCategories.add(ownCategory);
            console.log('[SettingsApp] Plugin', pluginId, 'has own category:', ownCategory);
          }

          // Check if this plugin adds items to existing categories
          const pluginSettings = PLUGIN_SETTINGS_MAP[pluginId];
          if (pluginSettings) {
            for (const setting of pluginSettings) {
              affectedCategories.add(setting.category);
              affectedItems.add(setting.id);
            }
          }
        }

        console.log('[SettingsApp] Affected categories:', Array.from(affectedCategories));
        console.log('[SettingsApp] New setting items:', Array.from(affectedItems));

        setNewlyAddedCategories(affectedCategories);
        setNewlyAddedItems(affectedItems);

        // Remove pulse animation after 5 seconds
        setTimeout(() => {
          setNewlyAddedCategories(new Set());
          setNewlyAddedItems(new Set());
        }, 5000);
      });
    }

    // Update the previous plugin IDs
    previousPluginIdsRef.current = currentPluginIds;
  }, [installedPlugins]);

  // Update URL when category or setting changes
  useEffect(() => {
    const params: any = { category: activeCategory };
    if (activeSetting) params.setting = activeSetting;
    setSearchParams(params, { replace: true });
  }, [activeCategory, activeSetting, setSearchParams]);

  // Get active category items
  const activeItems = settingsCategories.find(cat => cat.id === activeCategory)?.items || [];

  // Find the active setting item
  let activeItem: SettingItem | undefined;
  if (activeSetting) {
    for (const category of settingsCategories) {
      const item = category.items.find(i => i.id === activeSetting);
      if (item) {
        activeItem = item;
        break;
      }
    }
  }

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) return;
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('[SettingsApp] Logout failed:', error);
      alert('Logout failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1a1612] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#1a1612]/95 backdrop-blur-md border-b border-[#2a2420]">
        <div className="px-4 md:px-8 py-4 md:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/hub')}
                className="flex items-center gap-2 text-[#e8d4b8]/60 hover:text-[#e8d4b8] transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium hidden md:inline">Back</span>
              </button>
              <div className="w-px h-6 bg-[#2a2420]" />
              <h1 className="text-xl md:text-2xl font-semibold text-[#e8d4b8]">Settings</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Search (Desktop only) */}
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-[#e8d4b8]/5 border border-[#e8d4b8]/10 rounded-full">
                <Search className="w-4 h-4 text-[#e8d4b8]/40" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-[#e8d4b8] placeholder:text-[#e8d4b8]/40 w-48"
                />
              </div>

              {/* User Avatar */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#e8d4b8]/5 rounded-full">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#d97542] to-[#c85a2a] flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="text-sm text-[#e8d4b8] hidden md:inline">
                  {user?.name?.split(' ')[0] || 'User'}
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-2 text-[#e8d4b8]/60 hover:text-[#d97542] transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="sticky top-[60px] md:top-[80px] z-40 bg-[#1a1612]/95 backdrop-blur-md border-b border-[#2a2420]">
        <div className="overflow-x-auto hide-scrollbar">
          <div className="flex gap-2 px-4 md:px-8 py-3 min-w-max">
            {settingsCategories.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              const itemCount = category.items.length;
              const hasIncomplete = categoryHasIncomplete(category.id);
              const isNewlyAdded = newlyAddedCategories.has(category.id);

              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    setActiveSetting(null);
                  }}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 relative',
                    isActive
                      ? 'bg-[#d97542] text-white shadow-lg shadow-[#d97542]/20 scale-105'
                      : hasIncomplete
                        ? 'bg-[#e8d4b8]/5 text-[#e8d4b8]/80 hover:bg-[#e8d4b8]/10 hover:text-[#e8d4b8] ring-2 ring-[#d97542]/40'
                        : 'bg-[#e8d4b8]/5 text-[#e8d4b8]/80 hover:bg-[#e8d4b8]/10 hover:text-[#e8d4b8]',
                    isNewlyAdded && 'animate-pulse-slow ring-2 ring-green-500/60 shadow-lg shadow-green-500/30'
                  )}
                >
                  {/* Incomplete indicator dot */}
                  {hasIncomplete && !isActive && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#d97542] rounded-full border-2 border-[#1a1612] animate-pulse" />
                  )}
                  <Icon className="w-4 h-4" />
                  <span>{category.label}</span>
                  {itemCount > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-xs font-semibold',
                      isActive ? 'bg-white/20' : 'bg-[#e8d4b8]/10'
                    )}>
                      {itemCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Settings Cards Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <AnimatePresence>
              {activeItems.map((item) => {
                const ItemIcon = item.icon || Package;
                const isEssential = item.id in essentialSettings;
                const isIncomplete = isEssential && !essentialSettings[item.id as keyof typeof essentialSettings];
                const isNewlyAdded = newlyAddedItems.has(item.id);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setActiveSetting(item.id)}
                    className={cn(
                      "group relative bg-gradient-to-br from-[#e8d4b8]/5 to-[#e8d4b8]/[0.02] backdrop-blur-xl border rounded-2xl p-6 cursor-pointer transition-all",
                      isIncomplete
                        ? "border-[#d97542] shadow-lg shadow-[#d97542]/20 animate-pulse-slow hover:shadow-xl hover:shadow-[#d97542]/30"
                        : "border-[#e8d4b8]/10 hover:border-[#d97542]/30 hover:shadow-lg hover:shadow-[#d97542]/10",
                      isNewlyAdded && "ring-2 ring-green-500/60 shadow-lg shadow-green-500/30 animate-pulse-slow"
                    )}
                  >
                    {/* Essential Badge */}
                    {isIncomplete && (
                      <div className="absolute top-4 right-4 px-2 py-1 bg-[#d97542] text-white text-xs font-semibold rounded-full">
                        Required
                      </div>
                    )}

                    {/* Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform",
                      isIncomplete
                        ? "bg-gradient-to-br from-[#d97542] to-[#c85a2a] group-hover:scale-110 shadow-lg shadow-[#d97542]/30"
                        : "bg-gradient-to-br from-[#d97542] to-[#c85a2a] group-hover:scale-110"
                    )}>
                      <ItemIcon className="w-6 h-6 text-white" />
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-semibold text-[#e8d4b8] mb-2 flex items-center justify-between">
                      {item.label}
                      <ChevronRight className="w-5 h-5 text-[#e8d4b8]/40 group-hover:text-[#d97542] group-hover:translate-x-1 transition-all" />
                    </h3>

                    <p className="text-sm text-[#e8d4b8]/60 line-clamp-2">
                      {item.description}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {activeItems.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-[#e8d4b8]/20 mx-auto mb-4" />
              <p className="text-[#e8d4b8]/60">No settings available in this category</p>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel / Bottom Sheet for Active Setting */}
      <AnimatePresence>
        {activeItem && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveSetting(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] lg:w-[800px] bg-[#1a1612] border-l border-[#2a2420] z-50 flex flex-col shadow-2xl"
            >
              {/* Panel Header */}
              <div className="px-6 py-5 border-b border-[#2a2420] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeItem.icon && <activeItem.icon className="w-6 h-6 text-[#d97542]" />}
                  <div>
                    <h2 className="text-xl font-semibold text-[#e8d4b8]">{activeItem.label}</h2>
                    {activeItem.description && (
                      <p className="text-sm text-[#e8d4b8]/60 mt-1">{activeItem.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setActiveSetting(null)}
                  className="p-2 text-[#e8d4b8]/60 hover:text-[#e8d4b8] hover:bg-[#e8d4b8]/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto">
                <activeItem.component {...(activeItem.componentProps || {})} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
