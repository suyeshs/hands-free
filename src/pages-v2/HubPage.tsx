/**
 * HubPage - Unified Home/Dashboard
 * Central hub connecting all dashboards with role-based visibility
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard,
  ChefHat,
  Users,
  BarChart3,
  Settings,
  Package,
  ExternalLink,
  X,
  Wine,
  Bike,
  Wrench,
  Palette,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { DashboardCard } from '../components/home/DashboardCard';
import { FirstTimeSetupWalkthrough } from '../components/home/FirstTimeSetupWalkthrough';
import { AggregatorSetupCard } from '../components/aggregator/AggregatorSetupCard';
import { PluginUpdateNotification } from '../components/plugins/PluginUpdateNotification';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { useStaffStore } from '../stores/staffStore';
import { useFloorPlanStore } from '../stores/floorPlanStore';
import {
  useIsReadyForPOS,
  useSetupWizardStore,
  useHasRestaurantBasics,
  useHasTaxBillingSetup,
  useHasMinimumMenu,
  useHasFloorPlan,
  useHasStaff,
} from '../stores/setupWizardStore';
import { useKDSStore } from '../stores/kdsStore';
import { usePOSStore } from '../stores/posStore';
import { useServiceRequestStore } from '../stores/serviceRequestStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { usePluginManager } from '../hooks/usePluginManager';
import { UserRole } from '../types/auth';
import { staggerContainer } from '../lib/motion/variants';
import { isTauri, isDesktop } from '../lib/platform';
import { cn } from '../lib/utils';
import { isDashboardCardAllowed } from '../config/buildConfig';
import { checkDeviceRegistration } from '../services/tauriAuth';
import { useProvisioningStore } from '../stores/provisioningStore';

interface DashboardConfig {
  id: string;
  title: string;
  description: string;
  icon: typeof CreditCard;
  path: string;
  roles: (UserRole | '*')[];
  accentColor: 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'cyan' | 'amber';
  getStats?: () => string | undefined;
  getBadgeCount?: () => number | undefined;
  getUrgent?: () => boolean;
  disabled?: boolean;
  disabledMessage?: string;
  requiresAttention?: boolean;
  attentionMessage?: string;
}

export default function HubPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { settings } = useRestaurantSettingsStore();
  const { tenant } = useTenantStore();
  const { loadStaffFromDatabase, isLoaded: staffLoaded } = useStaffStore();
  const { loadFloorPlan, isLoaded: floorPlanLoaded } = useFloorPlanStore();
  const { activeOrders } = useKDSStore();
  const { activeTables } = usePOSStore();
  const { requests: serviceRequests } = useServiceRequestStore();
  const { orders: aggregatorOrders } = useAggregatorStore();
  const { installedPlugins } = usePluginManager();
  const isTauriApp = isTauri();
  const isDesktopDevice = isDesktop();
  const isReadyForPOS = useIsReadyForPOS();
  const { checklistDismissed } = useSetupWizardStore();
  const { isProvisioned } = useProvisioningStore();
  const [isDeviceRegistered, setIsDeviceRegistered] = useState<boolean>(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

  // Debug: Detailed validation logging
  const hasBasics = useHasRestaurantBasics();
  const hasTaxBilling = useHasTaxBillingSetup();
  const hasMenu = useHasMinimumMenu();
  const hasFloorPlan = useHasFloorPlan();
  const hasStaff = useHasStaff();

  // Load staff and floor plan stores so the setup checklist reflects real data
  useEffect(() => {
    const tenantId = tenant?.tenantId;
    if (!tenantId) return;
    if (!staffLoaded) loadStaffFromDatabase(tenantId);
    if (!floorPlanLoaded) loadFloorPlan(tenantId);
  }, [tenant?.tenantId, staffLoaded, floorPlanLoaded, loadStaffFromDatabase, loadFloorPlan]);

  // Check device registration status
  useEffect(() => {
    const loadDeviceStatus = async () => {
      try {
        const status = await checkDeviceRegistration();
        setIsDeviceRegistered(status.isRegistered);
      } catch (err) {
        console.error('[HubPage] Failed to check device registration:', err);
        setIsDeviceRegistered(false);
      }
    };

    const dismissed = localStorage.getItem('device-reg-banner-dismissed');
    setBannerDismissed(dismissed === 'true');

    loadDeviceStatus();
  }, []);

  useEffect(() => {
    if (!isReadyForPOS) {
      console.group('🔍 [HubPage] Setup Validation Status');
      console.log('Overall Ready:', isReadyForPOS);
      console.log('✓ Restaurant Basics (name, phone 7-15 digits, address):', hasBasics);
      console.log('✓ Tax & Billing (tax config, invoice settings):', hasTaxBilling);
      console.log('✓ Menu (3+ items):', hasMenu);
      console.log('✓ Floor Plan (1+ section, 2+ tables):', hasFloorPlan);
      console.log('✓ Staff (2+ active staff):', hasStaff);
      console.log('---');
      console.log('Failed validations:', {
        basics: !hasBasics,
        taxBilling: !hasTaxBilling,
        menu: !hasMenu,
        floorPlan: !hasFloorPlan,
        staff: !hasStaff,
      });
      console.log('📝 Note: Phone numbers now support international format (7-15 digits)');
      console.log('📝 Note: Pincode/postal code length is no longer restricted');
      console.groupEnd();
    }
  }, [isReadyForPOS, hasBasics, hasTaxBilling, hasMenu, hasFloorPlan, hasStaff]);

  // Check which plugins are installed and enabled
  const hasAggregatorPlugin = installedPlugins.some(
    p => p.manifest.id === 'aggregator-integration-india' && p.enabled
  );
  const hasBarPlugin = installedPlugins.some(
    p => p.manifest.id === 'bar-management-v2' && p.enabled
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('[HubPage] Not authenticated, redirecting to login');
      navigate('/login');
    }
  }, [isAuthenticated, user, navigate]);

  // Redirect to settings on first install (if setup incomplete)
  // DISABLED: User should be able to access Hub with just basic restaurant details
  // useEffect(() => {
  //   if (isAuthenticated && user && !isReadyForPOS) {
  //     console.log('[HubPage] Setup incomplete, redirecting to settings');
  //     navigate('/settings?setting=restaurant-details');
  //   }
  // }, [isAuthenticated, user, isReadyForPOS, navigate]);

  // Aggregator dashboard status
  const [swiggyActive, setSwiggyActive] = useState(false);
  const [zomatoActive, setZomatoActive] = useState(false);
  const [extractedCount, setExtractedCount] = useState(0);

  // Count pending aggregator orders
  const pendingAggregatorOrders = aggregatorOrders.filter(
    o => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing'
  ).length;

  // Listen for extracted orders to track active status
  useEffect(() => {
    if (!isTauriApp) return;

    const unlisten = listen('aggregator-orders-extracted', (event: any) => {
      const orders = event.payload;
      if (orders.length > 0) {
        const platform = orders[0]?.platform?.toLowerCase();
        if (platform === 'swiggy') setSwiggyActive(true);
        if (platform === 'zomato') setZomatoActive(true);
        setExtractedCount(prev => prev + orders.length);
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [isTauriApp]);

  // Aggregator dashboard controls
  const openBothDashboards = async () => {
    try {
      await invoke('open_unified_aggregator');
    } catch (err) {
      console.error('[HubPage] Failed to open aggregator dashboards:', err);
    }
  };

  const closeBothDashboards = async () => {
    try {
      await invoke('close_unified_aggregator');
      setSwiggyActive(false);
      setZomatoActive(false);
    } catch (err) {
      console.error('[HubPage] Failed to close aggregator dashboards:', err);
    }
  };

  const openDashboard = async (platform: 'swiggy' | 'zomato') => {
    try {
      if (platform === 'swiggy') {
        await invoke('open_swiggy_dashboard');
      } else {
        await invoke('open_zomato_dashboard');
      }
    } catch (err) {
      console.error(`[HubPage] Failed to open ${platform} dashboard:`, err);
    }
  };

  // Calculate stats
  const activeTableCount = Object.keys(activeTables).length;
  const pendingKitchenOrders = activeOrders.length;
  const pendingServiceRequests = serviceRequests.filter((r) => r.status === 'pending').length;

  // Check for urgent items (orders older than 15 minutes)
  const hasUrgentKitchenOrders = activeOrders.some((order) => {
    const orderTime = new Date(order.createdAt).getTime();
    const now = Date.now();
    return now - orderTime > 15 * 60 * 1000; // 15 minutes
  });

  // Map icon names to Lucide components
  const iconMap: Record<string, LucideIcon> = {
    'wine': Wine,
    'bike': Bike,
    'package': Package,
    'settings': Settings,
    'chef-hat': ChefHat,
    // Add more icon mappings as needed
  };

  // Helper to check if plugin is newly installed (within last 7 days)
  const isPluginNew = (installedAt?: string): boolean => {
    if (!installedAt) return false;
    const installDate = new Date(installedAt);
    const now = new Date();
    const daysSinceInstall = (now.getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceInstall <= 7;
  };

  // Create dashboard configs from installed plugins
  const pluginDashboards: DashboardConfig[] = installedPlugins
    .filter(p => p.enabled && p.manifest.frontend?.hub_card)
    .map(p => {
      const hubCard = p.manifest.frontend!.hub_card!;
      const IconComponent = iconMap[hubCard.icon] || Package;
      const isNew = isPluginNew(p.installed_at);

      return {
        id: `plugin-${p.manifest.id}`,
        title: hubCard.title,
        description: hubCard.description,
        icon: IconComponent,
        path: hubCard.path,
        roles: hubCard.roles?.length ? hubCard.roles.map((r: string) => r as UserRole) : ['*' as const],
        accentColor: hubCard.accent_color,
        // Show "New" badge for newly installed plugins
        getStats: isNew ? () => '🆕 New' : (hubCard.show_stats ? () => undefined : undefined),
        getBadgeCount: hubCard.badge_endpoint ? () => undefined : undefined,
        getUrgent: hubCard.urgent_endpoint ? () => false : undefined,
      } as DashboardConfig;
    })
    .sort((a, b) => {
      // Sort by order if available (from manifest)
      const aPlugin = installedPlugins.find(p => `plugin-${p.manifest.id}` === a.id);
      const bPlugin = installedPlugins.find(p => `plugin-${p.manifest.id}` === b.id);
      const aOrder = aPlugin?.manifest.frontend?.hub_card?.order ?? 100;
      const bOrder = bPlugin?.manifest.frontend?.hub_card?.order ?? 100;
      return aOrder - bOrder;
    });

  const coreDashboards: DashboardConfig[] = [
    {
      id: 'pos',
      title: 'Point of Sale',
      description: 'Take orders, manage tables, and process payments',
      icon: CreditCard,
      path: '/pos',
      roles: [UserRole.SERVER, UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'orange',
      getStats: () =>
        activeTableCount > 0 ? `${activeTableCount} active table${activeTableCount !== 1 ? 's' : ''}` : undefined,
    },
    {
      id: 'kitchen',
      title: 'Kitchen Display',
      description: 'View and manage incoming orders in real-time',
      icon: ChefHat,
      path: '/kitchen',
      roles: [UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'green',
      getStats: () =>
        pendingKitchenOrders > 0 ? `${pendingKitchenOrders} order${pendingKitchenOrders !== 1 ? 's' : ''} pending` : 'No pending orders',
      getBadgeCount: () => (pendingKitchenOrders > 0 ? pendingKitchenOrders : undefined),
      getUrgent: () => hasUrgentKitchenOrders,
    },
    // Delivery Orders card removed - aggregator orders now go directly to KDS
    {
      id: 'service',
      title: 'Service Dashboard',
      description: 'Track table status and service requests',
      icon: Users,
      path: '/service',
      roles: [UserRole.SERVER, UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'blue',
      getStats: () =>
        pendingServiceRequests > 0
          ? `${pendingServiceRequests} request${pendingServiceRequests !== 1 ? 's' : ''} pending`
          : undefined,
      getBadgeCount: () => (pendingServiceRequests > 0 ? pendingServiceRequests : undefined),
    },
    {
      id: 'reports',
      title: 'Sales Reports',
      description: 'View daily sales, trends, and analytics',
      icon: BarChart3,
      path: '/sales-report',
      roles: [UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'green',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Configure restaurant, menu, and system settings',
      icon: Settings,
      path: '/settings',
      roles: [UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'orange',
      // Mark as requiring attention if setup is incomplete
      requiresAttention: !isReadyForPOS,
      attentionMessage: !isReadyForPOS ? 'Action Required' : undefined,
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Customize themes, colors, and UI for all screens',
      icon: Palette,
      path: '/settings?setting=theme-settings',
      roles: [UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'purple',
    },
    {
      id: 'plugins',
      title: 'Plugins',
      description: 'Browse, install, and manage plugins',
      icon: Package,
      path: '/settings?setting=plugin-store',
      roles: [UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'cyan',
    },
  ];

  // Merge core dashboards with plugin dashboards
  const dashboards: DashboardConfig[] = [...coreDashboards, ...pluginDashboards];

  // Filter dashboards based on user role, platform, and build variant
  const visibleDashboards = dashboards.filter((dashboard) => {
    // Hide POS, Reports, Diagnostics, Aggregator on mobile devices (ALL users, regardless of role)
    // Mobile devices can see: KDS, Service, Settings, Inventory (for photos/updates)
    if (!isDesktopDevice && ['pos', 'reports', 'diagnostics', 'aggregator'].includes(dashboard.id)) {
      return false;
    }

    // Build variant filtering (Staff build restrictions)
    if (!isDashboardCardAllowed(dashboard.id, user?.role)) return false;

    // Role-based filtering
    if (!user) return dashboard.roles.includes('*');
    return dashboard.roles.includes('*') || dashboard.roles.includes(user.role);
  });

  return (
    <div className="min-h-full bg-warm-charcoal text-warm-white p-6 relative overflow-hidden">
      {/* Ambient Orbs - Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          className="ambient-orb-paprika"
          style={{
            top: '-30%',
            left: '-20%',
            width: '1000px',
            height: '1000px',
          }}
          animate={{
            y: [0, 100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="ambient-orb-saffron"
          style={{
            bottom: '-40%',
            right: '-20%',
            width: '900px',
            height: '900px',
          }}
          animate={{
            y: [0, -80, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Header - with Guanix logo and space for burger nav on right */}
      <motion.div
        className="mb-8 flex items-center gap-4 pr-16 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Guanix Logo */}
        <div className="w-16 h-16 flex-shrink-0">
          <img
            src="/handsfree-logo.svg"
            alt="Guanix"
            className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(242,140,56,0.3)]"
          />
        </div>
        {/* Welcome text */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-display-light text-warm-white truncate">
            Welcome back{settings.ownerName ? `, ${settings.ownerName.split(' ')[0]}` : user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-gray-400 text-sm sm:text-base font-light">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <span className="text-gray-500">•</span>
            <p className="text-sm text-gray-400">
              {isReadyForPOS ? 'Live' : 'Setup'} mode • {isDesktopDevice ? 'Desktop' : 'Mobile'} device
            </p>
          </div>
        </div>
      </motion.div>

      {/* First-time setup walkthrough - Only shown in setup mode and not dismissed */}
      {!isReadyForPOS && !checklistDismissed && <FirstTimeSetupWalkthrough />}

      {/* Plugin Update Notification - Show for Managers and Owners */}
      {(user?.role === UserRole.MANAGER || user?.role === UserRole.OWNER) && (
        <PluginUpdateNotification />
      )}

      {/* Device Registration Banner - Show after provisioning if device not registered */}
      {isProvisioned && !isDeviceRegistered && !bannerDismissed && (user?.role === UserRole.MANAGER || user?.role === UserRole.OWNER) && (
        <motion.div
          className="mb-6 p-4 glass-panel-dark border-2 border-saffron/30 relative z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-saffron/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-saffron" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-warm-white mb-1">Register This Device</h3>
              <p className="text-sm text-gray-400 mb-3">
                Register this device to enable multi-device features like LAN sync and remote printing.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/settings', {
                    state: { openCategory: 'hardware', openSetting: 'device-registration' }
                  })}
                  className="px-4 py-2 bg-saffron hover:bg-saffron/90 text-warm-charcoal font-bold text-sm rounded-lg transition-colors"
                >
                  Register Device
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('device-reg-banner-dismissed', 'true');
                    setBannerDismissed(true);
                  }}
                  className="px-4 py-2 bg-warm-charcoal-lighter hover:bg-warm-charcoal-light text-gray-300 font-medium text-sm rounded-lg transition-colors border border-gray-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('device-reg-banner-dismissed', 'true');
                setBannerDismissed(true);
              }}
              className="text-gray-400 hover:text-warm-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Aggregator Setup Card - Desktop only, always visible for Manager/Owner */}
      {isDesktopDevice && isTauriApp && (user?.role === UserRole.MANAGER || user?.role === UserRole.OWNER) && (
        <AggregatorSetupCard
          swiggyActive={swiggyActive}
          zomatoActive={zomatoActive}
          pendingOrderCount={pendingAggregatorOrders}
          extractedCount={extractedCount}
          onOpenBoth={openBothDashboards}
          onCloseBoth={closeBothDashboards}
        />
      )}

      {/* Bar Management Card - Desktop only (hidden on mobile, requires plugin) */}
      {hasBarPlugin && isReadyForPOS && isDesktopDevice && (user?.role === UserRole.MANAGER || user?.role === UserRole.OWNER) && (
        <motion.div
          className="mb-6 p-4 glass-panel-dark relative z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Left: Bar info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-saffron" />
                <span className="font-semibold text-warm-white">Bar Management</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                <span>Inventory, Recipes & Closing</span>
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/bar')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-warm text-white text-sm font-bold shadow-warm-glow hover:shadow-2xl hover:scale-105 transition-all"
              >
                <ChefHat className="w-4 h-4" />
                <span>Open Bar Dashboard</span>
              </button>
              <button
                onClick={() => navigate('/settings?setting=bar-inventory')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-saffron/20 text-saffron text-sm font-semibold hover:bg-saffron/30 transition-colors border border-saffron/30"
                title="Bar Settings"
              >
                <Wrench className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Dashboard Grid - Always visible, individual cards may be disabled */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 relative z-10"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {visibleDashboards.map((dashboard) => (
          <DashboardCard
            key={dashboard.id}
            id={dashboard.id}
            title={dashboard.title}
            description={dashboard.description}
            icon={dashboard.icon}
            path={dashboard.path}
            accentColor={dashboard.accentColor}
            stats={dashboard.getStats?.()}
            badgeCount={dashboard.getBadgeCount?.()}
            urgent={dashboard.getUrgent?.()}
            disabled={dashboard.disabled}
            disabledMessage={dashboard.disabledMessage}
            requiresAttention={dashboard.requiresAttention}
            attentionMessage={dashboard.attentionMessage}
          />
        ))}
      </motion.div>

    </div>
  );
}
