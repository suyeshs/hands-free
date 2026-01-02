/**
 * HubPage - Unified Home/Dashboard
 * Central hub connecting all dashboards with role-based visibility
 */

import { motion } from 'framer-motion';
import {
  CreditCard,
  ChefHat,
  Package,
  Users,
  BarChart3,
  Settings,
  Boxes,
  Activity,
} from 'lucide-react';
import { DashboardCard } from '../components/home/DashboardCard';
import { useAuthStore } from '../stores/authStore';
import { useKDSStore } from '../stores/kdsStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { usePOSStore } from '../stores/posStore';
import { useServiceRequestStore } from '../stores/serviceRequestStore';
import { UserRole } from '../types/auth';
import { staggerContainer } from '../lib/motion/variants';

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
}

export default function HubPage() {
  const { user } = useAuthStore();
  const { activeOrders } = useKDSStore();
  const { orders: aggregatorOrders } = useAggregatorStore();
  const { activeTables } = usePOSStore();
  const { requests: serviceRequests } = useServiceRequestStore();

  // Calculate stats
  const activeTableCount = Object.keys(activeTables).length;
  const pendingKitchenOrders = activeOrders.length;
  const pendingAggregatorOrders = aggregatorOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing'
  ).length;
  const newAggregatorOrders = aggregatorOrders.filter((o) => o.status === 'pending').length;
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
      roles: [UserRole.SERVER, UserRole.MANAGER],
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
      roles: [UserRole.KITCHEN, UserRole.MANAGER],
      accentColor: 'green',
      getStats: () =>
        pendingKitchenOrders > 0 ? `${pendingKitchenOrders} order${pendingKitchenOrders !== 1 ? 's' : ''} pending` : 'No pending orders',
      getBadgeCount: () => (pendingKitchenOrders > 0 ? pendingKitchenOrders : undefined),
      getUrgent: () => hasUrgentKitchenOrders,
    },
    {
      id: 'aggregator',
      title: 'Delivery Orders',
      description: 'Manage Swiggy, Zomato, and other delivery orders',
      icon: Package,
      path: '/aggregator',
      roles: [UserRole.AGGREGATOR, UserRole.MANAGER, UserRole.SERVER],
      accentColor: 'purple',
      getStats: () =>
        pendingAggregatorOrders > 0
          ? `${pendingAggregatorOrders} order${pendingAggregatorOrders !== 1 ? 's' : ''} in progress`
          : 'No active orders',
      getBadgeCount: () => (newAggregatorOrders > 0 ? newAggregatorOrders : undefined),
      getUrgent: () => newAggregatorOrders > 3,
    },
    {
      id: 'service',
      title: 'Service Dashboard',
      description: 'Track table status and service requests',
      icon: Users,
      path: '/service',
      roles: [UserRole.SERVER, UserRole.MANAGER],
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
      roles: [UserRole.MANAGER],
      accentColor: 'green',
    },
    {
      id: 'inventory',
      title: 'Inventory',
      description: 'Track stock levels and manage inventory',
      icon: Boxes,
      path: '/inventory',
      roles: [UserRole.MANAGER],
      accentColor: 'blue',
    },
    {
      id: 'diagnostics',
      title: 'System & Devices',
      description: 'Device settings, diagnostics, and connected devices',
      icon: Activity,
      path: '/diagnostics',
      roles: [UserRole.MANAGER],
      accentColor: 'purple',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Configure restaurant, menu, and system settings',
      icon: Settings,
      path: '/settings',
      roles: [UserRole.MANAGER],
      accentColor: 'orange',
    },
  ];

  // Filter dashboards based on user role
  const visibleDashboards = dashboards.filter((dashboard) => {
    if (!user) return dashboard.roles.includes('*');
    return dashboard.roles.includes('*') || dashboard.roles.includes(user.role);
  });

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-black text-gray-900">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </motion.div>

      {/* Dashboard Grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
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
          />
        ))}
      </motion.div>

      {/* Quick Stats Bar - for managers */}
      {user?.role === UserRole.MANAGER && (
        <motion.div
          className="mt-8 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/60"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-2xl font-black text-gray-900">{activeTableCount}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Active Tables</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div>
              <p className="text-2xl font-black text-gray-900">{pendingKitchenOrders}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Kitchen Queue</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div>
              <p className="text-2xl font-black text-gray-900">{pendingAggregatorOrders}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Deliveries</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div>
              <p className="text-2xl font-black text-gray-900">{pendingServiceRequests}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Service Requests</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
