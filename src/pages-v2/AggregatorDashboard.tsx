/**
 * Aggregator Dashboard V2
 * Shows incoming orders from Swiggy/Zomato with real-time status tracking
 * Uses ContextualAppShell with minimal header and action footer
 */

import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAggregatorWebSocket } from '../hooks/useWebSocket';
import { backendApi } from '../lib/backendApi';
import { mockAggregatorService } from '../lib/mockAggregatorService';
import { ContextualAppShell, ContextualAction, NavItem } from '../components/layout-v2/ContextualAppShell';
import { OrderCard } from '../components/aggregator/OrderCard';
import { NeoCard } from '../components/ui-v2/NeoCard';
import { NeoButton } from '../components/ui-v2/NeoButton';
import type { AggregatorOrderStatus, AggregatorSource } from '../types/aggregator';

// Hook to detect screen size
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// Format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  return `${diffHours} hours ago`;
}

export default function AggregatorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    orders,
    filter,
    mergeOrders,
    setFilter,
    setLoading,
    setError,
    acceptOrder,
    rejectOrder,
    markReady,
    markPickedUp,
    markDelivered,
    markCompleted,
    dismissOrder,
    addOrder,
  } = useAggregatorStore();
  const { playSound } = useNotificationStore();
  const { isConnected } = useAggregatorWebSocket();
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [showDevTools, setShowDevTools] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [, setCurrentTime] = useState(new Date());

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');

  // Auto-refresh time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch orders from API and merge with local orders
  // Uses mergeOrders to preserve locally-extracted orders (from Tauri)
  const fetchOrders = useCallback(async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      const { orders: fetchedOrders } = await backendApi.getAggregatorOrders(
        user.tenantId,
        filter.status
      );
      // Use mergeOrders instead of setOrders to preserve locally-extracted orders
      mergeOrders(fetchedOrders);
      setError(null);
    } catch (error) {
      console.error('[AggregatorDashboard] Failed to fetch orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filter.status, mergeOrders, setLoading, setError]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Play sound for new orders
  useEffect(() => {
    const pendingOrders = orders.filter((o) => o.status === 'pending');
    if (pendingOrders.length > 0) {
      playSound('new_order');
    }
  }, [orders, playSound]);

  // Setup mock order callback
  useEffect(() => {
    mockAggregatorService.setOrderCallback((order) => {
      addOrder(order);
      playSound('new_order');
    });
  }, [addOrder, playSound]);

  // Handle order actions
  const handleAcceptOrder = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await acceptOrder(orderId, 20);
      playSound('order_ready');
    } catch (error) {
      console.error('Failed to accept order:', error);
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
    } catch (error) {
      console.error('Failed to reject order:', error);
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
    } catch (error) {
      console.error('Failed to mark order ready:', error);
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
    } catch (error) {
      console.error('Failed to mark order picked up:', error);
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
    } catch (error) {
      console.error('Failed to mark order delivered:', error);
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
    } catch (error) {
      console.error('Failed to mark order completed:', error);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleDismissOrder = async (orderId: string) => {
    try {
      await dismissOrder(orderId);
    } catch (error) {
      console.error('Failed to dismiss order:', error);
    }
  };

  // Accept all pending orders
  const handleAcceptAllPending = async () => {
    const pendingOrders = orders.filter((o) => o.status === 'pending');
    for (const order of pendingOrders) {
      await handleAcceptOrder(order.orderId);
    }
  };

  // Filter options
  const statusFilters: (AggregatorOrderStatus | 'all')[] = [
    'all',
    'pending',
    'confirmed',
    'preparing',
    'pending_pickup',
    'picked_up',
    'delivered',
  ];

  const aggregatorFilters: ('all' | AggregatorSource)[] = [
    'all',
    'zomato',
    'swiggy',
    'direct',
  ];

  // Filtered orders - hide completed/cancelled unless explicitly filtered
  const filteredOrders = orders.filter((o) => {
    const statusMatch = filter.status === 'all' || o.status === filter.status;
    const aggregatorMatch = filter.aggregator === 'all' || o.aggregator === filter.aggregator;
    const hideCompleted = filter.status === 'all' && (o.status === 'completed' || o.status === 'cancelled');
    return statusMatch && aggregatorMatch && !hideCompleted;
  });

  // Stats
  const stats = {
    pending: orders.filter((o) => o.status === 'pending').length,
    active: orders.filter((o) => ['confirmed', 'preparing'].includes(o.status)).length,
    ready: orders.filter((o) => o.status === 'pending_pickup').length,
    pickedUp: orders.filter((o) => o.status === 'picked_up').length,
    total: orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
  };

  // Navigation items for drawer
  const navItems: NavItem[] = [
    { id: 'aggregator', label: 'Aggregator Orders', icon: '📦', path: '/aggregator' },
    { id: 'kitchen', label: 'Kitchen Display', icon: '👨‍🍳', path: '/kitchen' },
    { id: 'manager', label: 'Manager Dashboard', icon: '📊', path: '/manager' },
    { id: 'pos', label: 'POS', icon: '💰', path: '/pos' },
  ];

  // Contextual actions for footer
  const actions: ContextualAction[] = [
    {
      id: 'accept-all',
      label: stats.pending > 0 ? `Accept (${stats.pending})` : 'Accept All',
      icon: '✓',
      onClick: handleAcceptAllPending,
      variant: 'primary',
      disabled: stats.pending === 0,
      badge: stats.pending > 0 ? stats.pending : undefined,
    },
    {
      id: 'filter',
      label: 'Filter',
      icon: '🔍',
      onClick: () => setShowFilters(!showFilters),
      variant: showFilters ? 'primary' : 'default',
    },
    {
      id: 'refresh',
      label: 'Refresh',
      icon: '🔄',
      onClick: fetchOrders,
      variant: 'default',
    },
  ];

  return (
    <ContextualAppShell
      title="Aggregator Orders"
      actions={actions}
      navItems={navItems}
      activeNavId="aggregator"
      onNavigate={(_id, path) => navigate(path)}
      isConnected={isConnected}
      onSettingsClick={() => navigate('/aggregator/settings')}
      onLogoutClick={logout}
      className={isMobile ? 'p-3' : isTablet ? 'p-4' : 'p-6'}
    >
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* New Orders Alert Banner - positioned at top */}
        {stats.pending > 0 && (
          <div className="sticky top-12 z-40 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-2 bg-orange-600 text-white font-bold text-center animate-pulse">
            {stats.pending} NEW ORDER{stats.pending > 1 ? 'S' : ''} - ACCEPT NOW!
          </div>
        )}

        {/* Stats Cards */}
        <div className={isMobile
          ? 'flex gap-3 overflow-x-auto pb-2'
          : 'grid grid-cols-1 md:grid-cols-4 gap-4'
        } style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}>
          <NeoCard
            hoverable
            className={`${isMobile ? 'p-3 flex-shrink-0 min-w-[90px]' : 'p-4'} ${stats.pending > 0 ? 'ring-2 ring-orange-500/50' : ''}`}
          >
            <div className={isMobile ? 'text-muted-foreground text-xs mb-0.5' : 'text-muted-foreground text-sm mb-1'}>
              New
            </div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold ${stats.pending > 0 ? 'text-orange-500' : 'text-foreground'}`}>
              {stats.pending}
            </div>
          </NeoCard>
          <NeoCard hoverable className={isMobile ? 'p-3 flex-shrink-0 min-w-[90px]' : 'p-4'}>
            <div className={isMobile ? 'text-muted-foreground text-xs mb-0.5' : 'text-muted-foreground text-sm mb-1'}>
              Preparing
            </div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-blue-500`}>
              {stats.active}
            </div>
          </NeoCard>
          <NeoCard hoverable className={`${isMobile ? 'p-3 flex-shrink-0 min-w-[90px]' : 'p-4'} ${stats.ready > 0 ? 'ring-2 ring-amber-500/50' : ''}`}>
            <div className={isMobile ? 'text-muted-foreground text-xs mb-0.5' : 'text-muted-foreground text-sm mb-1'}>
              Pickup
            </div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold ${stats.ready > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {stats.ready}
            </div>
          </NeoCard>
          <NeoCard hoverable className={isMobile ? 'p-3 flex-shrink-0 min-w-[90px]' : 'p-4'}>
            <div className={isMobile ? 'text-muted-foreground text-xs mb-0.5' : 'text-muted-foreground text-sm mb-1'}>
              Active
            </div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>
              {stats.total}
            </div>
          </NeoCard>
        </div>

        {/* Filter Pills - Collapsible */}
        {showFilters && (
          <NeoCard padding="sm" className="space-y-3">
            {/* Source filters */}
            <div
              className={isMobile
                ? 'flex items-center gap-2 overflow-x-auto pb-1'
                : 'flex items-center gap-2 flex-wrap'
              }
              style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}
            >
              <span className="text-sm text-muted-foreground mr-2">Source:</span>
              {aggregatorFilters.map((agg) => (
                <button
                  key={agg}
                  onClick={() => setFilter({ ...filter, aggregator: agg })}
                  className={`${
                    filter.aggregator === agg
                      ? 'pill-nav pill-nav-active'
                      : 'pill-nav'
                  } ${isMobile ? 'flex-shrink-0 text-sm py-1.5 px-3' : ''}`}
                >
                  {agg === 'all'
                    ? 'All'
                    : agg === 'direct'
                    ? '🌐 Web'
                    : agg === 'swiggy'
                    ? '🟠 Swiggy'
                    : '🔴 Zomato'}
                </button>
              ))}
            </div>

            {/* Status filters */}
            <div
              className={isMobile
                ? 'flex items-center gap-2 overflow-x-auto pb-1'
                : 'flex items-center gap-2 flex-wrap'
              }
              style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}
            >
              <span className="text-sm text-muted-foreground mr-2">Status:</span>
              {statusFilters.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter({ ...filter, status })}
                  className={`${
                    filter.status === status
                      ? 'pill-nav pill-nav-active'
                      : 'pill-nav'
                  } ${isMobile ? 'flex-shrink-0 text-sm py-1.5 px-3' : ''}`}
                >
                  {status === 'all'
                    ? 'All'
                    : status === 'pending_pickup'
                    ? 'Pickup'
                    : status === 'picked_up'
                    ? 'Picked Up'
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </NeoCard>
        )}

        {/* Dev Tools Toggle */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowDevTools(!showDevTools)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showDevTools ? 'Hide' : 'Show'} Dev Tools
          </button>
        </div>

        {/* Dev Tools */}
        {showDevTools && (
          <NeoCard variant="raised" padding={isMobile ? 'sm' : 'md'}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={isMobile ? 'text-base font-semibold text-foreground' : 'text-lg font-semibold text-foreground'}>
                Dev Tools
              </h3>
            </div>
            <div className={isMobile
              ? 'flex gap-2 overflow-x-auto pb-2'
              : 'grid grid-cols-2 md:grid-cols-5 gap-2'
            } style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('zomato')}
                className={isMobile ? 'flex-shrink-0 whitespace-nowrap' : ''}
              >
                🔴 Zomato
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('swiggy')}
                className={isMobile ? 'flex-shrink-0 whitespace-nowrap' : ''}
              >
                🟠 Swiggy
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('direct')}
                className={isMobile ? 'flex-shrink-0 whitespace-nowrap' : ''}
              >
                🌐 Web
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder()}
                className={isMobile ? 'flex-shrink-0 whitespace-nowrap' : ''}
              >
                🎲 Random
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateBulk(5)}
                className={isMobile ? 'flex-shrink-0 whitespace-nowrap' : ''}
              >
                📦 Bulk (5)
              </NeoButton>
            </div>
          </NeoCard>
        )}

        {/* Orders Grid */}
        {filteredOrders.length === 0 ? (
          <NeoCard className={isMobile ? 'text-center py-8' : 'text-center py-12'}>
            <div className="text-muted-foreground">
              <div className="text-4xl mb-4">📭</div>
              <p>No orders to display</p>
              {filter.status !== 'all' && (
                <div className="mt-3">
                  <button
                    onClick={() => setFilter({ ...filter, status: 'all' })}
                    className="text-primary underline"
                  >
                    Show all orders
                  </button>
                </div>
              )}
            </div>
          </NeoCard>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: isMobile
                ? '1fr'
                : isTablet
                ? 'repeat(2, 1fr)'
                : 'repeat(auto-fill, minmax(320px, 1fr))'
            }}
          >
            {filteredOrders.map((order) => (
              <div key={order.orderId} className="relative">
                <OrderCard
                  order={order}
                  onAccept={handleAcceptOrder}
                  onReject={handleRejectOrder}
                  onMarkReady={handleMarkReady}
                  onMarkPickedUp={handleMarkPickedUp}
                  onMarkCompleted={handleMarkCompleted}
                  onDismiss={handleDismissOrder}
                  isProcessing={processingOrders.has(order.orderId)}
                />

                {/* Additional action buttons for ready/delivered */}
                {(order.status === 'ready' || order.status === 'out_for_delivery') && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleMarkDelivered(order.orderId)}
                      disabled={processingOrders.has(order.orderId)}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                    >
                      ✓ Mark Delivered
                    </button>
                  </div>
                )}

                {order.status === 'delivered' && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleMarkCompleted(order.orderId)}
                      disabled={processingOrders.has(order.orderId)}
                      className="flex-1 py-2 px-3 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                    >
                      Archive Order
                    </button>
                  </div>
                )}

                {/* Time indicator */}
                <div className="absolute top-2 right-8 px-2 py-1 rounded bg-black/50 text-xs text-zinc-400">
                  {formatTimeAgo(new Date(order.createdAt))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom spacer for footer */}
        <div className="h-4" />
      </div>
    </ContextualAppShell>
  );
}
