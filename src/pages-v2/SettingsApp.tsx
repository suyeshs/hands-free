/**
 * Unified Settings App
 * OS-style settings interface with left sidebar navigation and categorized settings
 * Replaces individual modal-based forms with inline panels
 */

import { useState, useEffect } from 'react';
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
  ChefHat,
  Package,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { RestaurantType } from '../types/restaurantTypes';
import { cn } from '../lib/utils';

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
import { MigrationDiagnostics } from '../components/admin/MigrationDiagnostics';
import { CloudSyncSettings } from '../components/admin/CloudSyncSettings';
import { D1ProvisionButton } from '../components/admin/D1ProvisionButton';
import { QROrderingSettings } from './QROrderingSettings';
import { PayrollManager } from '../components/admin/PayrollManager';
import ChainManagementPage from './ChainManagementPage';
import ImageManagement from './ImageManagement';
import BarInventory from './BarInventory';
import { InventoryDashboard } from './InventoryDashboard';

interface SettingItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<any>;
  componentProps?: Record<string, any>;
  searchTerms?: string[]; // For search/filter
}

interface SettingCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SettingItem[];
  description?: string;
}

const getSettingsCategories = (tenantId: string, restaurantType: RestaurantType): SettingCategory[] => {
  // Determine if multi-location management should be visible
  const isMultiLocation = restaurantType === RestaurantType.MULTI_BRAND || restaurantType === RestaurantType.LARGE_CHAIN;

  return [
  {
    id: 'business',
    label: 'Business Setup',
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
      // Multi Location Management - Only visible for MULTI_BRAND and LARGE_CHAIN
      ...(isMultiLocation ? [{
        id: 'multi-location',
        label: 'Multi Location',
        description: 'Manage multiple locations and franchises',
        icon: Building2,
        component: ChainManagementPage,
        searchTerms: ['chain', 'locations', 'franchise', 'multi-location', 'branches'],
      }] : []),
    ],
  },
  {
    id: 'menu-products',
    label: 'Menu & Products',
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
      {
        id: 'qr-ordering',
        label: 'QR Code Ordering',
        description: 'Configure customer self-ordering via QR',
        icon: Smartphone,
        component: QROrderingSettings,
        searchTerms: ['qr', 'code', 'ordering', 'self-service', 'customer'],
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    description: 'Stock management, suppliers, and bar inventory',
    items: [
      {
        id: 'inventory-management',
        label: 'Stock Management',
        description: 'Track inventory, suppliers, and stock levels',
        icon: Package,
        component: InventoryDashboard,
        searchTerms: ['inventory', 'stock', 'suppliers', 'purchase'],
      },
      {
        id: 'bar-inventory',
        label: 'Bar Inventory',
        description: 'Manage bar stock, recipes, and closing',
        icon: ChefHat,
        component: BarInventory,
        searchTerms: ['bar', 'liquor', 'recipes', 'cocktails', 'closing'],
      },
    ],
  },
  {
    id: 'people',
    label: 'People & Payroll',
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
    ],
  },
  {
    id: 'hardware',
    label: 'Hardware & Printing',
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
  {
    id: 'system',
    label: 'System & Cloud',
    icon: Database,
    description: 'Cloud sync, backups, and system diagnostics',
    items: [
      {
        id: 'cloud-sync',
        label: 'Cloud Sync',
        description: 'Sync data to cloud and manage backups',
        icon: Cloud,
        component: CloudSyncSettings,
        searchTerms: ['cloud', 'sync', 'backup', 'cloudflare'],
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
        id: 'd1-provision',
        label: 'D1 Provisioning',
        description: 'Cloudflare D1 database setup',
        icon: Database,
        component: () => (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-white mb-4">D1 Database Provisioning</h2>
            <p className="text-gray-400 mb-6">
              Provision and manage your Cloudflare D1 database for cloud sync.
            </p>
            <D1ProvisionButton />
          </div>
        ),
        searchTerms: ['d1', 'provision', 'cloudflare', 'database'],
      },
      {
        id: 'training',
        label: 'Training Mode',
        description: 'Demo mode and training settings',
        icon: GraduationCap,
        component: TrainingSettings,
        searchTerms: ['training', 'demo', 'sandbox', 'test'],
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & Support',
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

  // Get effective tenant ID
  const tenantId = tenant?.tenantId || user?.tenantId || '';

  // Get restaurant type for contextual settings
  const restaurantType = settings.restaurantType || RestaurantType.FULL_SERVICE;

  // Get active setting from URL params (e.g., ?setting=restaurant-details)
  const urlSetting = searchParams.get('setting');
  const [activeSetting, setActiveSetting] = useState<string>(
    urlSetting || 'restaurant-details'
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['business']) // Expand first category by default
  );

  // Update URL when setting changes
  useEffect(() => {
    if (activeSetting) {
      setSearchParams({ setting: activeSetting }, { replace: true });
    }
  }, [activeSetting, setSearchParams]);

  // Get settings categories with tenantId and restaurant type
  const settingsCategories = getSettingsCategories(tenantId, restaurantType);

  // Find the active setting item
  let activeItem: SettingItem | undefined;

  for (const category of settingsCategories) {
    const item = category.items.find((i) => i.id === activeSetting);
    if (item) {
      activeItem = item;
      break;
    }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('[SettingsApp] Logout failed:', error);
      alert('Logout failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex">
      {/* Left Sidebar - Category Navigation */}
      <div className="w-64 bg-card border-r border flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border">
          <button
            onClick={() => navigate('/hub')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-3 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Hub</span>
          </button>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {user?.name ? `${user.name.split(' ')[0]}'s workspace` : 'Configure your restaurant'}
          </p>
        </div>

        {/* Scrollable Categories */}
        <div className="flex-1 overflow-y-auto py-2">
          {settingsCategories.map((category) => {
            const isExpanded = expandedCategories.has(category.id);
            const hasActiveSetting = category.items.some((item) => item.id === activeSetting);

            return (
              <div key={category.id} className="mb-1">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-2 transition-colors group',
                    hasActiveSetting
                      ? 'bg-accent/10 text-accent'
                      : 'text-foreground hover:bg-surface-2'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <category.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium text-sm">{category.label}</span>
                  </div>
                  <ChevronRight
                    className={cn(
                      'w-4 h-4 transition-transform text-muted-foreground',
                      isExpanded ? 'rotate-90' : ''
                    )}
                  />
                </button>

                {/* Category Items */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden bg-surface-2"
                    >
                      <div className="py-1">
                        {category.items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setActiveSetting(item.id)}
                            className={cn(
                              'w-full text-left px-4 pl-11 py-2 text-sm transition-colors',
                              activeSetting === item.id
                                ? 'bg-accent text-white font-medium'
                                : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer - Logout */}
        <div className="p-3 border-t border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 bg-card hover:bg-destructive/10 text-foreground hover:text-destructive transition-colors group border border"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Right Panel - Active Setting Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Setting Header */}
        <div className="bg-card border-b border px-8 py-5">
          <div className="flex items-center gap-3 mb-1">
            {activeItem?.icon && <activeItem.icon className="w-5 h-5 text-accent" />}
            <h2 className="text-2xl font-semibold text-foreground">{activeItem?.label || 'Settings'}</h2>
          </div>
          {activeItem?.description && (
            <p className="text-muted-foreground text-sm mt-1">{activeItem.description}</p>
          )}
        </div>

        {/* Setting Content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <AnimatePresence mode="wait">
            {activeItem && (
              <motion.div
                key={activeItem.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <activeItem.component {...(activeItem.componentProps || {})} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
