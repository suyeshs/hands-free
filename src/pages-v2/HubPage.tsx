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
  Boxes,
  Activity,
  Package,
  ExternalLink,
  X,
  Wrench,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { DashboardCard } from '../components/home/DashboardCard';
import { AttendanceHubCard } from '../components/home/AttendanceHubCard';
import { D1StatusCard } from '../components/home/D1StatusCard';
import { ProvisioningStatusPill } from '../components/home/ProvisioningStatusPill';
import { CloudSyncBanner } from '../components/home/CloudSyncBanner';
import { useAuthStore } from '../stores/authStore';
import { useIsReadyForPOS } from '../stores/setupWizardStore';
import { useKDSStore } from '../stores/kdsStore';
import { usePOSStore } from '../stores/posStore';
import { useServiceRequestStore } from '../stores/serviceRequestStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { UserRole } from '../types/auth';
import { staggerContainer } from '../lib/motion/variants';
import { isTauri, isDesktop } from '../lib/platform';
import { cn } from '../lib/utils';

interface DashboardConfig {
  id: string;
  title: string;
  description: string;
  icon: typeof CreditCard;
  path: string;
  roles: (UserRole | '*')[];
  accentColor: 'orange' | 'green' | 'blue' | 'purple' | 'red';
  getStats?: () => string | undefined;
  getBadgeCount?: () => number | undefined;
  getUrgent?: () => boolean;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function HubPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { activeOrders } = useKDSStore();
  const { activeTables } = usePOSStore();
  const { requests: serviceRequests } = useServiceRequestStore();
  const { orders: aggregatorOrders } = useAggregatorStore();
  const isTauriApp = isTauri();
  const isDesktopDevice = isDesktop();
  const isReadyForPOS = useIsReadyForPOS();

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

  const dashboards: DashboardConfig[] = [
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
      disabled: !isReadyForPOS,
      disabledMessage: 'Complete essential setup first',
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
      id: 'inventory',
      title: 'Inventory',
      description: 'Track stock levels and manage inventory',
      icon: Boxes,
      path: '/inventory',
      roles: [UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'blue',
    },
    {
      id: 'diagnostics',
      title: 'System & Devices',
      description: 'Device settings, diagnostics, and connected devices',
      icon: Activity,
      path: '/diagnostics',
      roles: [UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'purple',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Configure restaurant, menu, and system settings',
      icon: Settings,
      path: '/settings',
      roles: [UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'orange',
    },
    {
      id: 'restaurant-setup',
      title: 'Restaurant Setup',
      description: 'Configure details, operational mode, and features',
      icon: Wrench,
      path: '/settings?setting=restaurant-details',
      roles: [UserRole.MANAGER, UserRole.OWNER],
      accentColor: 'blue',
    },
  ];

  // Filter dashboards based on user role and platform
  const visibleDashboards = dashboards.filter((dashboard) => {
    // Hide POS, Reports, Diagnostics, Aggregator on mobile devices (ALL users, regardless of role)
    // Mobile devices can see: KDS, Service, Settings, Inventory (for photos/updates)
    if (!isDesktopDevice && ['pos', 'reports', 'diagnostics', 'aggregator'].includes(dashboard.id)) {
      return false;
    }
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

      {/* Header - with HandsFree logo and space for burger nav on right */}
      <motion.div
        className="mb-8 flex items-center gap-4 pr-16 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* HandsFree Logo */}
        <div className="w-16 h-16 flex-shrink-0">
          <img
            src="/handsfree-logo.svg"
            alt="HandsFree"
            className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(242,140,56,0.3)]"
          />
        </div>
        {/* Welcome text */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-display-light text-warm-white truncate">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-gray-400 text-sm sm:text-base font-light">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <ProvisioningStatusPill />
          </div>
        </div>
      </motion.div>

      {/* Cloud Sync Banner - Promotes cloud sync if not enabled */}
      <CloudSyncBanner />

      {/* D1 Database Status - Shows provisioning status */}
      <motion.div
        className="mt-6 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <D1StatusCard />
      </motion.div>

      {/* Aggregator Status Card - Desktop only (hidden on mobile) */}
      {isReadyForPOS && isDesktopDevice && isTauriApp && (user?.role === UserRole.MANAGER || user?.role === UserRole.OWNER) && (
        <motion.div
          className="mb-6 p-4 glass-panel-dark relative z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Left: Status indicators */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-saffron" />
                <span className="font-semibold text-warm-white">Aggregator Dashboards</span>
              </div>

              {/* Platform status pills */}
              <div className="flex items-center gap-2">
                {/* Swiggy */}
                <button
                  onClick={() => openDashboard('swiggy')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all",
                    swiggyActive
                      ? "bg-orange-100 text-orange-700 border-2 border-orange-300"
                      : "bg-gray-100 text-gray-500 border-2 border-gray-200 hover:bg-orange-50 hover:border-orange-200"
                  )}
                >
                  <span className="text-lg">🟠</span>
                  <span>Swiggy</span>
                  {swiggyActive && (
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                </button>

                {/* Zomato */}
                <button
                  onClick={() => openDashboard('zomato')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all",
                    zomatoActive
                      ? "bg-red-100 text-red-700 border-2 border-red-300"
                      : "bg-gray-100 text-gray-500 border-2 border-gray-200 hover:bg-red-50 hover:border-red-200"
                  )}
                >
                  <span className="text-lg">🔴</span>
                  <span>Zomato</span>
                  {zomatoActive && (
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                </button>
              </div>

              {/* Pending orders badge */}
              {pendingAggregatorOrders > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
                  <span>{pendingAggregatorOrders}</span>
                  <span className="hidden sm:inline">pending</span>
                </div>
              )}
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2">
              {(swiggyActive || zomatoActive) && (
                <button
                  onClick={closeBothDashboards}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-warm-white text-sm font-semibold hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Close All</span>
                </button>
              )}
              <button
                onClick={openBothDashboards}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-warm text-white text-sm font-bold shadow-warm-glow hover:shadow-2xl hover:scale-105 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Both</span>
              </button>
              <button
                onClick={() => navigate('/aggregator/settings')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-saffron/20 text-saffron text-sm font-semibold hover:bg-saffron/30 transition-colors border border-saffron/30"
                title="Aggregator Settings"
              >
                <Wrench className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>

          {/* Extracted orders count */}
          {extractedCount > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>{extractedCount} orders extracted this session</span>
            </div>
          )}
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
          />
        ))}

        {/* Attendance Hub Card - Interactive clock in/out */}
        <AttendanceHubCard />
      </motion.div>

    </div>
  );
}
