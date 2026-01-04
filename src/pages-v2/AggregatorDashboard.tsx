/**
 * Aggregator Dashboard V2
 * Dark industrial theme (like KDS) with active/archived tabs
 * Uses floating orb for navigation and actions
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  RefreshCw,
  Settings,
  BarChart2,
  X,
  Package,
  Archive,
  CheckCircle,
  Clock,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAggregatorWebSocket } from '../hooks/useWebSocket';
import { backendApi } from '../lib/backendApi';
import { OrderCard } from '../components/aggregator/OrderCard';
import { cn } from '../lib/utils';
import { springConfig, backdropVariants } from '../lib/motion/variants';
import { isTauri } from '../lib/platform';
import type { AggregatorSource, AggregatorOrder } from '../types/aggregator';

type ViewTab = 'active' | 'archived';

// Format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1m';
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1h';
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// Aggregator FAB Menu Item
interface AggregatorOrbMenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: number;
  variant?: 'default' | 'danger';
}

// Radial menu positions (5 items now)
const menuPositions = [
  { angle: -45, distance: 80 },   // Top-Right - POS
  { angle: -90, distance: 80 },   // Top - Home
  { angle: -135, distance: 80 },  // Top-Left - Settings
  { angle: -180, distance: 80 },  // Left - Refresh
  { angle: 135, distance: 80 },   // Bottom-Left - Stats
];

const getPosition = (angle: number, distance: number) => ({
  x: Math.cos((angle * Math.PI) / 180) * distance,
  y: Math.sin((angle * Math.PI) / 180) * distance,
});

export default function AggregatorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    orders,
    filter,
    mergeOrders,
    setLoading,
    setError,
    acceptOrder,
    rejectOrder,
    markReady,
    markPickedUp,
    markDelivered,
    markCompleted,
    dismissOrder,
  } = useAggregatorStore();
  const { playSound } = useNotificationStore();
  const { isConnected } = useAggregatorWebSocket();

  // UI State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<ViewTab>('active');
  const [sourceFilter, setSourceFilter] = useState<'all' | AggregatorSource>('all');
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [isOrbMenuOpen, setIsOrbMenuOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [archivedOrders, setArchivedOrders] = useState<AggregatorOrder[]>([]);

  // Update time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      const { orders: fetchedOrders } = await backendApi.getAggregatorOrders(
        user.tenantId,
        filter.status
      );
      mergeOrders(fetchedOrders);
      setError(null);
    } catch (error) {
      console.error('[AggregatorDashboard] Failed to fetch orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filter.status, mergeOrders, setLoading, setError]);

  // Load archived orders
  const loadArchivedOrders = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      // Get archived orders from the API
      const { orders: archived } = await backendApi.getAggregatorOrders(
        user.tenantId,
        'completed'
      );
      setArchivedOrders(archived);
    } catch (error) {
      console.error('[AggregatorDashboard] Failed to load archived orders:', error);
    }
  }, [user?.tenantId]);

  // Initial load
  useEffect(() => {
    fetchOrders();
    if (activeTab === 'archived') {
      loadArchivedOrders();
    }
  }, [fetchOrders, activeTab, loadArchivedOrders]);

  // Play sound for new orders
  useEffect(() => {
    const pendingOrders = orders.filter((o) => o.status === 'pending');
    if (pendingOrders.length > 0) {
      playSound('new_order');
    }
  }, [orders, playSound]);


  // Handle order actions
  const handleAcceptOrder = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await acceptOrder(orderId, 20);
      playSound('order_ready');
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await rejectOrder(orderId, reason);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleMarkReady = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await markReady(orderId, user?.tenantId);
      playSound('order_ready');
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleMarkPickedUp = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await markPickedUp(orderId);
      playSound('order_ready');
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await markDelivered(orderId);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleMarkCompleted = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await markCompleted(orderId);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Accept all pending orders
  const handleAcceptAllPending = async () => {
    const pendingOrders = orders.filter((o) => o.status === 'pending');
    for (const order of pendingOrders) {
      await handleAcceptOrder(order.orderId);
    }
  };

  // Filter orders based on current tab and source
  const displayOrders = useMemo(() => {
    const sourceOrders = activeTab === 'active'
      ? orders.filter(o => !['completed', 'cancelled'].includes(o.status))
      : archivedOrders;

    if (sourceFilter === 'all') return sourceOrders;
    return sourceOrders.filter(o => o.aggregator === sourceFilter);
  }, [orders, archivedOrders, activeTab, sourceFilter]);

  // Stats
  const stats = useMemo(() => ({
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => ['confirmed', 'preparing'].includes(o.status)).length,
    ready: orders.filter((o) => o.status === 'pending_pickup' || o.status === 'ready').length,
    total: orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
  }), [orders]);

  // Navigate to POS and minimize aggregator dashboards
  const goToPOS = async () => {
    // Minimize dashboard windows if in Tauri
    if (isTauri()) {
      try {
        await invoke('minimize_aggregator_dashboards');
      } catch (err) {
        console.log('[AggregatorDashboard] Could not minimize dashboards:', err);
      }
    }
    navigate('/pos');
  };

  // FAB menu items
  const menuItems: AggregatorOrbMenuItem[] = [
    {
      id: 'pos',
      icon: ShoppingCart,
      label: 'POS',
      onClick: goToPOS,
    },
    {
      id: 'home',
      icon: Home,
      label: 'Home',
      onClick: () => navigate('/hub'),
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      onClick: () => navigate('/aggregator/settings'),
    },
    {
      id: 'refresh',
      icon: RefreshCw,
      label: 'Refresh',
      onClick: () => {
        fetchOrders();
        if (activeTab === 'archived') loadArchivedOrders();
      },
    },
    {
      id: 'stats',
      icon: BarChart2,
      label: showStats ? 'Hide Stats' : 'Show Stats',
      onClick: () => setShowStats(!showStats),
    },
  ];

  const handleMenuItemClick = (item: AggregatorOrbMenuItem) => {
    item.onClick();
    if (item.id !== 'stats') {
      setIsOrbMenuOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black tracking-tight">DELIVERY</h1>
            <div className={cn(
              "px-2 py-1 rounded text-xs font-bold",
              isConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            )}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Partner Login Button */}
            <button
              onClick={() => navigate('/aggregator/settings')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase flex items-center gap-2 transition-colors"
            >
              <Settings size={14} />
              Partner Login
            </button>
            {/* Time */}
            <div className="text-lg font-mono text-slate-400">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Stats row (toggle-able) */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-4 pt-3">
                <div className={cn(
                  "px-3 py-2 rounded-lg",
                  stats.pending > 0 ? "bg-orange-500/20 border border-orange-500/50" : "bg-slate-800"
                )}>
                  <div className={cn("text-2xl font-black", stats.pending > 0 ? "text-orange-400" : "text-slate-400")}>
                    {stats.pending}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">New</div>
                </div>
                <div className="px-3 py-2 rounded-lg bg-slate-800">
                  <div className="text-2xl font-black text-blue-400">{stats.preparing}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Preparing</div>
                </div>
                <div className={cn(
                  "px-3 py-2 rounded-lg",
                  stats.ready > 0 ? "bg-amber-500/20 border border-amber-500/50" : "bg-slate-800"
                )}>
                  <div className={cn("text-2xl font-black", stats.ready > 0 ? "text-amber-400" : "text-slate-400")}>
                    {stats.ready}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Pickup</div>
                </div>
                <div className="px-3 py-2 rounded-lg bg-slate-800">
                  <div className="text-2xl font-black text-white">{stats.total}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Active</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Tabs + Filters */}
      <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Tab pills */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('active')}
              className={cn(
                "px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2",
                activeTab === 'active'
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              )}
            >
              <Package size={16} />
              Active
              {stats.total > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-xs">{stats.total}</span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('archived');
                loadArchivedOrders();
              }}
              className={cn(
                "px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2",
                activeTab === 'archived'
                  ? "bg-slate-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              )}
            >
              <Archive size={16} />
              Archived
            </button>
          </div>

          {/* Source filter chips */}
          <div className="flex gap-2">
            {(['all', 'zomato', 'swiggy', 'direct'] as const).map((source) => (
              <button
                key={source}
                onClick={() => setSourceFilter(source)}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-bold text-xs transition-colors",
                  sourceFilter === source
                    ? source === 'zomato' ? "bg-red-600 text-white"
                    : source === 'swiggy' ? "bg-orange-500 text-white"
                    : source === 'direct' ? "bg-purple-600 text-white"
                    : "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                )}
              >
                {source === 'all' ? 'All' : source === 'direct' ? 'Web' : source.charAt(0).toUpperCase() + source.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* New orders alert */}
      {stats.pending > 0 && activeTab === 'active' && (
        <div className="flex-shrink-0 bg-orange-500 px-4 py-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <span className="font-black">
                {stats.pending} NEW ORDER{stats.pending > 1 ? 'S' : ''} - ACCEPT NOW!
              </span>
            </div>
            <button
              onClick={handleAcceptAllPending}
              className="px-4 py-1.5 bg-white text-orange-600 rounded-lg font-bold text-sm hover:bg-orange-50 transition-colors"
            >
              Accept All
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main
        className="flex-1 overflow-y-auto overscroll-contain p-4"
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >
        {displayOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <span className="text-6xl mb-4 opacity-30">
              {activeTab === 'active' ? '📭' : '📦'}
            </span>
            <h2 className="text-xl font-bold text-slate-400">
              {activeTab === 'active' ? 'No active orders' : 'No archived orders'}
            </h2>
            <p className="text-slate-600 mt-2">
              {activeTab === 'active' ? 'Orders from Zomato, Swiggy, and web will appear here' : 'Completed orders will be shown here'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayOrders.map((order) => (
              <div key={order.orderId} className="relative">
                <OrderCard
                  order={order}
                  onAccept={handleAcceptOrder}
                  onReject={handleRejectOrder}
                  onMarkReady={handleMarkReady}
                  onMarkPickedUp={handleMarkPickedUp}
                  onMarkCompleted={handleMarkCompleted}
                  onDismiss={dismissOrder}
                  isProcessing={processingOrders.has(order.orderId)}
                />

                {/* Additional action buttons */}
                {(order.status === 'ready' || order.status === 'out_for_delivery') && activeTab === 'active' && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleMarkDelivered(order.orderId)}
                      disabled={processingOrders.has(order.orderId)}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                    >
                      <CheckCircle size={14} className="inline mr-1" />
                      Mark Delivered
                    </button>
                  </div>
                )}

                {order.status === 'delivered' && activeTab === 'active' && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleMarkCompleted(order.orderId)}
                      disabled={processingOrders.has(order.orderId)}
                      className="flex-1 py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                    >
                      <Archive size={14} className="inline mr-1" />
                      Archive
                    </button>
                  </div>
                )}

                {/* Time indicator */}
                <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-slate-300 flex items-center gap-1">
                  <Clock size={10} />
                  {formatTimeAgo(new Date(order.createdAt))}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Floating Orb FAB */}
      <>
        {/* Backdrop */}
        <AnimatePresence>
          {isOrbMenuOpen && (
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setIsOrbMenuOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* FAB Container */}
        <div
          className="fixed z-50"
          style={{
            right: 16,
            bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Radial Menu Items */}
          <AnimatePresence>
            {isOrbMenuOpen &&
              menuItems.map((item, index) => {
                const pos = getPosition(menuPositions[index].angle, menuPositions[index].distance);
                const Icon = item.icon;

                return (
                  <motion.button
                    key={item.id}
                    className={cn(
                      'absolute w-14 h-14 rounded-full flex items-center justify-center shadow-lg',
                      item.variant === 'danger'
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-700 text-white hover:bg-slate-600'
                    )}
                    style={{
                      right: 32 - 28,
                      bottom: 32 - 28,
                    }}
                    initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                      x: pos.x,
                      y: pos.y,
                      transition: {
                        delay: index * 0.05,
                        ...springConfig.snappy,
                      },
                    }}
                    exit={{
                      scale: 0,
                      opacity: 0,
                      x: 0,
                      y: 0,
                      transition: { duration: 0.15 },
                    }}
                    onClick={() => handleMenuItemClick(item)}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Icon size={24} />
                    {item.badge !== undefined && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </motion.button>
                );
              })}
          </AnimatePresence>

          {/* Main FAB Orb */}
          <motion.button
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center',
              'bg-slate-800 border-2 border-slate-600 shadow-xl',
              'transition-colors',
              isOrbMenuOpen ? 'bg-slate-700' : 'bg-slate-800'
            )}
            style={{
              boxShadow: stats.pending > 0
                ? '0 4px 20px rgba(249, 115, 22, 0.4), 0 0 40px rgba(249, 115, 22, 0.2)'
                : '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOrbMenuOpen(!isOrbMenuOpen)}
          >
            <AnimatePresence mode="wait">
              {isOrbMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X size={28} className="text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="package"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Package size={28} className="text-white" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Order Count Badge */}
            {!isOrbMenuOpen && stats.total > 0 && (
              <motion.span
                className={cn(
                  'absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full flex items-center justify-center text-xs font-black',
                  stats.pending > 0
                    ? 'bg-orange-500 text-white animate-pulse'
                    : 'bg-blue-500 text-white'
                )}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                {stats.total}
              </motion.span>
            )}
          </motion.button>

          {/* Pending order pulse ring */}
          {stats.pending > 0 && !isOrbMenuOpen && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-orange-500"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.8, 0, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </div>
      </>
    </div>
  );
}
