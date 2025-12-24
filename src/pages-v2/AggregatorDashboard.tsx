/**
 * Aggregator Dashboard V2
 * Redesigned with neomorphic styling and proper item display
 * Mobile-responsive with touch-friendly UI
 */

import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAggregatorWebSocket } from '../hooks/useWebSocket';
import { backendApi } from '../lib/backendApi';
import { mockAggregatorService } from '../lib/mockAggregatorService';
import { AppShell } from '../components/layout-v2/AppShell';
import { OrderCard } from '../components/aggregator/OrderCard';
import { AutoAcceptSettings } from '../components/aggregator/AutoAcceptSettings';
import { DashboardManager } from '../components/aggregator/DashboardManager';
import { NeoCard } from '../components/ui-v2/NeoCard';
import { NeoButton } from '../components/ui-v2/NeoButton';
import { StatusPill } from '../components/ui-v2/StatusPill';
import { hasTauriAPI } from '../lib/platform';
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

export default function AggregatorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    orders,
    filter,
    setOrders,
    setFilter,
    setLoading,
    setError,
    acceptOrder,
    rejectOrder,
    markReady,
    addOrder,
  } = useAggregatorStore();
  const { playSound } = useNotificationStore();
  const { isConnected } = useAggregatorWebSocket();
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [showDevTools, setShowDevTools] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDashboardManager, setShowDashboardManager] = useState(true);

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Detect if running on Android/mobile browser (DashboardManager won't work there)
  // DashboardManager uses Tauri WebView automation which only works on desktop
  const isAndroidOrMobileBrowser = typeof navigator !== 'undefined' && (
    /Android/i.test(navigator.userAgent) ||
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (isMobile && !hasTauriAPI())
  );

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      const { orders: fetchedOrders } = await backendApi.getAggregatorOrders(
        user.tenantId,
        filter.status
      );
      setOrders(fetchedOrders);
      setError(null);
    } catch (error) {
      console.error('[AggregatorDashboard] Failed to fetch orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filter.status, setOrders, setLoading, setError]);

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
      await markReady(orderId);
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

  // Filter options
  const statusFilters: (AggregatorOrderStatus | 'all')[] = [
    'all',
    'pending',
    'confirmed',
    'preparing',
    'ready',
  ];

  const aggregatorFilters: ('all' | AggregatorSource)[] = [
    'all',
    'zomato',
    'swiggy',
    'direct',
  ];

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const statusMatch = filter.status === 'all' || o.status === filter.status;
    const aggregatorMatch = filter.aggregator === 'all' || o.aggregator === filter.aggregator;
    return statusMatch && aggregatorMatch;
  });

  // Stats
  const stats = {
    pending: orders.filter((o) => o.status === 'pending').length,
    active: orders.filter((o) => ['confirmed', 'preparing'].includes(o.status)).length,
    ready: orders.filter((o) => o.status === 'ready').length,
  };

  // Navigation items
  const navItems = [
    {
      id: 'aggregator',
      label: 'Orders',
      icon: '📦',
      path: '/aggregator',
    },
    {
      id: 'kitchen',
      label: 'Kitchen',
      icon: '👨‍🍳',
      path: '/kitchen',
    },
    {
      id: 'manager',
      label: 'Manager',
      icon: '📊',
      path: '/manager',
    },
  ];

  return (
    <AppShell
      navItems={navItems}
      activeNavId="aggregator"
      onNavigate={(_id, path) => navigate(path)}
      className={isMobile ? 'p-3 pb-24' : isTablet ? 'p-4 pb-24' : 'p-6 pb-24'}
    >
      {/* Header Section - Scrollable container */}
      <div
        className="max-w-7xl mx-auto space-y-4 md:space-y-6"
        style={{ minHeight: 'calc(100vh - 120px)' }}
      >
        {/* Title and Connection Status */}
        <div className={isMobile ? 'space-y-3' : 'flex items-center justify-between'}>
          <div className={isMobile ? 'flex items-center justify-between' : ''}>
            <div>
              <h1 className={isMobile ? 'text-xl font-bold text-foreground' : 'text-3xl font-bold text-foreground'}>
                {isMobile ? 'Aggregator' : 'Aggregator Orders'}
              </h1>
              {!isMobile && (
                <p className="text-muted-foreground mt-1">
                  Manage orders from Zomato and Swiggy
                </p>
              )}
            </div>
            {/* Connection Status - always visible */}
            {isMobile && (
              <StatusPill status={isConnected ? 'active' : 'error'} size="sm">
                {isConnected ? '● Live' : '● Off'}
              </StatusPill>
            )}
          </div>

          {/* Action buttons - responsive layout */}
          <div className={isMobile
            ? 'flex items-center gap-2 overflow-x-auto pb-2'
            : 'flex items-center gap-3'
          } style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}>
            {/* Connection Status - desktop */}
            {!isMobile && (
              <StatusPill status={isConnected ? 'active' : 'error'} size="sm">
                {isConnected ? '● Live' : '● Disconnected'}
              </StatusPill>
            )}

            {/* Dashboard Manager Toggle - only show on desktop (Tauri only feature) */}
            {!isAndroidOrMobileBrowser && isDesktop && (
              <NeoButton
                variant={showDashboardManager ? 'primary' : 'default'}
                size="sm"
                onClick={() => setShowDashboardManager(!showDashboardManager)}
              >
                🖥️ Dashboards
              </NeoButton>
            )}

            {/* Auto-Accept Settings */}
            <NeoButton
              variant="default"
              size="sm"
              onClick={() => setShowSettings(true)}
              className={isMobile ? 'flex-shrink-0' : ''}
            >
              {isMobile ? '⚙️' : '⚙️ Settings'}
            </NeoButton>

            {/* Logout */}
            <NeoButton
              variant="ghost"
              size="sm"
              onClick={logout}
              className={isMobile ? 'flex-shrink-0' : ''}
            >
              {isMobile ? '🚪' : 'Logout'}
            </NeoButton>
          </div>
        </div>

        {/* Stats Cards - horizontal scroll on mobile */}
        <div className={isMobile
          ? 'flex gap-3 overflow-x-auto pb-2'
          : 'grid grid-cols-1 md:grid-cols-3 gap-4'
        } style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}>
          <NeoCard hoverable className={isMobile ? 'p-3 flex-shrink-0 min-w-[100px]' : 'p-4'}>
            <div className={isMobile ? 'text-muted-foreground text-xs mb-0.5' : 'text-muted-foreground text-sm mb-1'}>
              Pending
            </div>
            <div className={isMobile ? 'text-2xl font-bold text-orange-500' : 'text-3xl font-bold text-foreground'}>
              {stats.pending}
            </div>
          </NeoCard>
          <NeoCard hoverable className={isMobile ? 'p-3 flex-shrink-0 min-w-[100px]' : 'p-4'}>
            <div className={isMobile ? 'text-muted-foreground text-xs mb-0.5' : 'text-muted-foreground text-sm mb-1'}>
              Active
            </div>
            <div className={isMobile ? 'text-2xl font-bold text-blue-500' : 'text-3xl font-bold text-foreground'}>
              {stats.active}
            </div>
          </NeoCard>
          <NeoCard hoverable className={isMobile ? 'p-3 flex-shrink-0 min-w-[100px]' : 'p-4'}>
            <div className={isMobile ? 'text-muted-foreground text-xs mb-0.5' : 'text-muted-foreground text-sm mb-1'}>
              Ready
            </div>
            <div className={isMobile ? 'text-2xl font-bold text-green-500' : 'text-3xl font-bold text-foreground'}>
              {stats.ready}
            </div>
          </NeoCard>
        </div>

        {/* Filter Pills - horizontal scroll on mobile */}
        <div className={isMobile ? 'space-y-2' : 'flex flex-col gap-4'}>
          {/* Source filters */}
          <div
            className={isMobile
              ? 'flex items-center gap-2 overflow-x-auto pb-1'
              : 'flex items-center gap-2 flex-wrap'
            }
            style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}
          >
            {!isMobile && <span className="text-sm text-muted-foreground mr-2">Source:</span>}
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
                  ? isMobile ? 'All' : 'All Sources'
                  : agg === 'direct'
                  ? '🌐 Web'
                  : agg.charAt(0).toUpperCase() + agg.slice(1)}
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
            {!isMobile && <span className="text-sm text-muted-foreground mr-2">Status:</span>}
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
                  ? isMobile ? 'All' : 'All Status'
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Manager - Embedded Swiggy/Zomato (Desktop Tauri only) */}
        {showDashboardManager && !isAndroidOrMobileBrowser && isDesktop && (
          <NeoCard variant="raised" padding="md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Partner Dashboards</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Embed Swiggy/Zomato dashboards for automatic order extraction
                </p>
              </div>
              <button
                onClick={() => setShowDashboardManager(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Hide
              </button>
            </div>
            <DashboardManager />
          </NeoCard>
        )}

        {/* Mobile Partner Portal Access */}
        {(isAndroidOrMobileBrowser || isMobile || isTablet) && (
          <NeoCard className="p-4">
            <div className="space-y-4">
              {/* Info header */}
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔗</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">
                    Partner Dashboards
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Open Swiggy/Zomato partner portals to manage orders. For automatic extraction, use the desktop app.
                  </p>
                </div>
              </div>

              {/* Quick access buttons */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="https://partner.swiggy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-orange-500/10 border-2 border-orange-500/30 text-orange-600 dark:text-orange-400 font-bold touch-target hover:bg-orange-500/20 transition-colors"
                >
                  <span className="text-xl">🟠</span>
                  <span>Swiggy</span>
                  <span className="text-sm">↗</span>
                </a>
                <a
                  href="https://www.zomato.com/partners/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30 text-red-600 dark:text-red-400 font-bold touch-target hover:bg-red-500/20 transition-colors"
                >
                  <span className="text-xl">🔴</span>
                  <span>Zomato</span>
                  <span className="text-sm">↗</span>
                </a>
              </div>

              {/* Note about sync */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-blue-500">ℹ️</span>
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  Orders from aggregators sync automatically when the desktop app extracts them, or through webhook integrations.
                </p>
              </div>
            </div>
          </NeoCard>
        )}

        {/* Dev Tools - responsive grid */}
        {showDevTools && (
          <NeoCard variant="raised" padding={isMobile ? 'sm' : 'md'}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={isMobile ? 'text-base font-semibold text-foreground' : 'text-lg font-semibold text-foreground'}>
                Dev Tools
              </h3>
              <button
                onClick={() => setShowDevTools(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Hide
              </button>
            </div>
            <div className={isMobile
              ? 'flex gap-2 overflow-x-auto pb-2'
              : 'grid grid-cols-2 md:grid-cols-4 gap-2'
            } style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('zomato')}
                className={isMobile ? 'flex-shrink-0 whitespace-nowrap' : ''}
              >
                {isMobile ? '🍕 Zomato' : '🍕 Zomato Order'}
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('swiggy')}
                className={isMobile ? 'flex-shrink-0 whitespace-nowrap' : ''}
              >
                {isMobile ? '🍜 Swiggy' : '🍜 Swiggy Order'}
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
                📦 Bulk
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('direct')}
                className={isMobile ? 'flex-shrink-0 whitespace-nowrap' : ''}
              >
                {isMobile ? '🌐 Web' : '🌐 Website Order'}
              </NeoButton>
            </div>
          </NeoCard>
        )}

        {/* Orders Grid - responsive */}
        {filteredOrders.length === 0 ? (
          <NeoCard className={isMobile ? 'text-center py-8' : 'text-center py-12'}>
            <div className="text-muted-foreground">
              No orders to display
              {filter.status !== 'all' && (
                <div className="mt-2">
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
            className="grid gap-3"
            style={{
              gridTemplateColumns: isMobile
                ? '1fr'  // Single column on mobile
                : isTablet
                ? 'repeat(2, 1fr)'  // 2 columns on tablet
                : 'repeat(auto-fill, minmax(280px, 1fr))'  // Auto-fill on desktop
            }}
          >
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                onAccept={handleAcceptOrder}
                onReject={handleRejectOrder}
                onMarkReady={handleMarkReady}
                isProcessing={processingOrders.has(order.orderId)}
              />
            ))}
          </div>
        )}

        {/* Bottom spacer for safe area on mobile */}
        {isMobile && <div className="h-4" />}
      </div>

      {/* Auto-Accept Settings Modal */}
      <AutoAcceptSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </AppShell>
  );
}
