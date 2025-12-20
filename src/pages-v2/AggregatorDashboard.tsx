/**
 * Aggregator Dashboard V2
 * Redesigned with neomorphic styling and proper item display
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
import type { AggregatorOrderStatus, AggregatorSource } from '../types/aggregator';

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
      className="p-6"
    >
      {/* Header Section */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Title and Connection Status */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Aggregator Orders</h1>
            <p className="text-muted-foreground mt-1">
              Manage orders from Zomato and Swiggy
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <StatusPill status={isConnected ? 'active' : 'error'} size="sm">
              {isConnected ? '● Live' : '● Disconnected'}
            </StatusPill>

            {/* Dashboard Manager Toggle */}
            <NeoButton
              variant={showDashboardManager ? 'primary' : 'default'}
              size="sm"
              onClick={() => setShowDashboardManager(!showDashboardManager)}
            >
              🖥️ Dashboards
            </NeoButton>

            {/* Auto-Accept Settings */}
            <NeoButton
              variant="default"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              ⚙️ Settings
            </NeoButton>

            {/* Logout */}
            <NeoButton variant="ghost" size="sm" onClick={logout}>
              Logout
            </NeoButton>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NeoCard hoverable className="p-4">
            <div className="text-muted-foreground text-sm mb-1">Pending</div>
            <div className="text-3xl font-bold text-foreground">{stats.pending}</div>
          </NeoCard>
          <NeoCard hoverable className="p-4">
            <div className="text-muted-foreground text-sm mb-1">Active</div>
            <div className="text-3xl font-bold text-foreground">{stats.active}</div>
          </NeoCard>
          <NeoCard hoverable className="p-4">
            <div className="text-muted-foreground text-sm mb-1">Ready</div>
            <div className="text-3xl font-bold text-foreground">{stats.ready}</div>
          </NeoCard>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-2">Source:</span>
            {aggregatorFilters.map((agg) => (
              <button
                key={agg}
                onClick={() => setFilter({ ...filter, aggregator: agg })}
                className={
                  filter.aggregator === agg
                    ? 'pill-nav pill-nav-active'
                    : 'pill-nav'
                }
              >
                {agg === 'all' ? 'All Sources' : agg === 'direct' ? '🌐 Website' : agg.charAt(0).toUpperCase() + agg.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-2">Status:</span>
            {statusFilters.map((status) => (
              <button
                key={status}
                onClick={() => setFilter({ ...filter, status })}
                className={
                  filter.status === status
                    ? 'pill-nav pill-nav-active'
                    : 'pill-nav'
                }
              >
                {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Manager - Embedded Swiggy/Zomato */}
        {showDashboardManager && (
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

        {/* Dev Tools */}
        {showDevTools && (
          <NeoCard variant="raised" padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Dev Tools</h3>
              <button
                onClick={() => setShowDevTools(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Hide
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('zomato')}
              >
                🍕 Zomato Order
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('swiggy')}
              >
                🍜 Swiggy Order
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder()}
              >
                🎲 Random
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateBulk(5)}
              >
                📦 Bulk (5)
              </NeoButton>
              <NeoButton
                variant="default"
                size="sm"
                onClick={() => mockAggregatorService.generateOrder('direct')}
              >
                🌐 Website Order
              </NeoButton>
            </div>
          </NeoCard>
        )}

        {/* Orders Grid */}
        {filteredOrders.length === 0 ? (
          <NeoCard className="text-center py-12">
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
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
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
      </div>

      {/* Auto-Accept Settings Modal */}
      <AutoAcceptSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </AppShell>
  );
}
