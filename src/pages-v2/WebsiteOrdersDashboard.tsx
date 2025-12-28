/**
 * Website & Aggregator Orders Dashboard
 * Shows orders from all channels (Swiggy, Zomato, Website) with key metrics
 * Auto-sends KOT to kitchen stations when orders are received
 * Optimized for mobile/tablet with responsive layouts
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useKDSStore } from '../stores/kdsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { AppShell } from '../components/layout-v2/AppShell';
import { NeoCard } from '../components/ui-v2/NeoCard';
import { NeoButton } from '../components/ui-v2/NeoButton';
import { StatusPill } from '../components/ui-v2/StatusPill';
import { transformAggregatorToKitchenOrder, createKitchenOrderWithId } from '../lib/orderTransformations';
import { printerService } from '../lib/printerService';
import type { AggregatorOrder, AggregatorSource, AggregatorOrderStatus } from '../types/aggregator';

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

// Listen to Tauri events for extracted orders
let tauriListenerSetup = false;

// Track orders that have been sent to KOT to avoid duplicates
const sentToKotOrderIds = new Set<string>();

interface ChannelMetrics {
  orderCount: number;
  itemCount: number;
  totalValue: number;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  delayedCount: number;
  runningCount: number; // Orders actively being prepared (KOT sent)
  avgPrepTime: number;
}

interface OrderWithDelay extends AggregatorOrder {
  isDelayed: boolean;
  delayMinutes: number;
  isRunning: boolean; // Orders that are in progress (confirmed/preparing)
}

export default function WebsiteOrdersDashboard() {
  const navigate = useNavigate();
  const {
    orders,
    addOrder,
    filter,
    setFilter,
    acceptOrder,
    rejectOrder,
    markReady,
  } = useAggregatorStore();
  const { addOrder: addToKDS, removeOrder: removeFromKDS, activeOrders: kdsOrders } = useKDSStore();
  const { playSound } = useNotificationStore();
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [selectedChannel, setSelectedChannel] = useState<AggregatorSource | 'all'>('all');

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');

  // Map extracted status to AggregatorOrderStatus
  function mapExtractedStatus(status: string): AggregatorOrderStatus {
    const statusLower = status?.toLowerCase() || 'pending';
    if (statusLower.includes('deliver')) return 'delivered';
    if (statusLower.includes('ready')) return 'ready';
    if (statusLower.includes('prepar')) return 'preparing';
    if (statusLower.includes('confirm')) return 'confirmed';
    if (statusLower.includes('cancel')) return 'cancelled';
    if (statusLower.includes('pick')) return 'out_for_delivery';
    return 'pending';
  }

  // Track which orders have KOT in KDS (by order number)
  const ordersInKDS = useMemo(() => {
    const orderNumbers = new Set<string>();
    kdsOrders.forEach((kdsOrder) => {
      orderNumbers.add(kdsOrder.orderNumber);
    });
    return orderNumbers;
  }, [kdsOrders]);

  // Cancel/remove KOT from KDS
  const cancelKOT = useCallback((order: AggregatorOrder) => {
    console.log('[WebsiteOrdersDashboard] Canceling KOT for order:', order.orderNumber);

    // Find the KDS order by order number
    const kdsOrder = kdsOrders.find((k) => k.orderNumber === order.orderNumber);
    if (kdsOrder) {
      removeFromKDS(kdsOrder.id);
      console.log('[WebsiteOrdersDashboard] KOT removed from KDS:', kdsOrder.id);
    }

    // Remove from sent tracking
    sentToKotOrderIds.delete(order.orderId);
  }, [kdsOrders, removeFromKDS]);

  // Send order to KOT/KDS immediately
  const sendToKOT = useCallback(async (order: AggregatorOrder) => {
    // Skip if already sent
    if (sentToKotOrderIds.has(order.orderId)) {
      console.log('[WebsiteOrdersDashboard] Order already sent to KOT:', order.orderNumber);
      return;
    }

    try {
      console.log('[WebsiteOrdersDashboard] Sending order to KOT:', order.orderNumber);

      // Transform to kitchen order format
      const kitchenOrderPartial = transformAggregatorToKitchenOrder(order);
      const kitchenOrder = createKitchenOrderWithId(kitchenOrderPartial);

      // Add to KDS store
      addToKDS(kitchenOrder);

      // Broadcast to other devices (KDS tablets, etc.) via cloud WebSocket
      try {
        const { orderSyncService } = await import('../lib/orderSyncService');
        const result = await orderSyncService.broadcastOrder(
          { orderId: order.orderId, orderNumber: order.orderNumber } as any,
          kitchenOrder
        );
        if (result.cloud || result.lan > 0) {
          console.log(`[WebsiteOrdersDashboard] Order broadcast: cloud=${result.cloud}, lan=${result.lan}`);
        }
      } catch (syncError) {
        console.warn('[WebsiteOrdersDashboard] Broadcast failed:', syncError);
      }

      // Mark as sent
      sentToKotOrderIds.add(order.orderId);

      // Auto-print KOT if enabled
      try {
        await printerService.print(kitchenOrder);
        console.log('[WebsiteOrdersDashboard] KOT printed for order:', order.orderNumber);
      } catch (printError) {
        console.error('[WebsiteOrdersDashboard] KOT print failed:', printError);
        // Continue even if print fails - order is in KDS
      }

      console.log('[WebsiteOrdersDashboard] Order sent to KDS:', order.orderNumber);
    } catch (error) {
      console.error('[WebsiteOrdersDashboard] Failed to send to KOT:', error);
    }
  }, [addToKDS]);

  // Setup Tauri event listener for extracted orders
  useEffect(() => {
    if (tauriListenerSetup) return;

    const setupTauriListener = async () => {
      try {
        // @ts-ignore - Tauri types
        if (window.__TAURI__?.event) {
          // @ts-ignore
          const { listen } = window.__TAURI__.event;

          // Listen for orders extracted from aggregator dashboards
          await listen('aggregator-orders-extracted', (event: { payload: any[] }) => {
            console.log('[WebsiteOrdersDashboard] Received extracted orders:', event.payload);

            // Always use current timestamp when receiving orders
            const receivedAt = new Date().toISOString();

            event.payload.forEach((extractedOrder: any) => {
              // Transform extracted order to AggregatorOrder format
              const order: AggregatorOrder = {
                aggregator: extractedOrder.platform as AggregatorSource,
                aggregatorOrderId: extractedOrder.order_id,
                aggregatorStatus: extractedOrder.status,
                orderId: extractedOrder.order_id,
                orderNumber: extractedOrder.order_number,
                status: mapExtractedStatus(extractedOrder.status),
                orderType: 'delivery',
                // Always use the timestamp when order was received by the app
                createdAt: receivedAt,
                customer: {
                  name: extractedOrder.customer_name || 'Customer',
                  phone: extractedOrder.customer_phone || null,
                  address: extractedOrder.customer_address || null,
                },
                cart: {
                  items: (extractedOrder.items || []).map((item: any, idx: number) => ({
                    id: `${extractedOrder.order_id}-item-${idx}`,
                    name: item.name,
                    quantity: item.quantity || 1,
                    price: item.price || 0,
                    total: (item.price || 0) * (item.quantity || 1),
                    variants: [],
                    addons: [],
                    specialInstructions: item.special_instructions,
                  })),
                  subtotal: extractedOrder.total || 0,
                  tax: 0,
                  deliveryFee: 0,
                  platformFee: 0,
                  discount: 0,
                  total: extractedOrder.total || 0,
                },
                payment: {
                  method: 'online',
                  status: 'paid',
                  isPrepaid: true,
                },
              };

              // Add to aggregator store
              addOrder(order);

              // AUTO-SEND TO KOT: Immediately send new/pending orders to kitchen
              // This broadcasts to all KDS station devices
              const mappedStatus = mapExtractedStatus(extractedOrder.status);
              if (mappedStatus === 'pending' || mappedStatus === 'confirmed' || mappedStatus === 'preparing') {
                console.log('[WebsiteOrdersDashboard] Auto-sending to KOT:', order.orderNumber);
                sendToKOT(order);
              }
            });

            playSound('new_order');
          });

          tauriListenerSetup = true;
          console.log('[WebsiteOrdersDashboard] Tauri event listener setup complete');
        }
      } catch (error) {
        console.error('[WebsiteOrdersDashboard] Failed to setup Tauri listener:', error);
      }
    };

    setupTauriListener();
  }, [addOrder, playSound, sendToKOT]);

  // Calculate delay for each order
  const ordersWithDelay: OrderWithDelay[] = useMemo(() => {
    const now = new Date().getTime();
    const DELAY_THRESHOLD_MINUTES = 15; // Orders older than 15 mins without action are delayed

    return orders.map((order) => {
      const orderTime = new Date(order.createdAt).getTime();
      const ageMinutes = Math.floor((now - orderTime) / (1000 * 60));

      // Delayed if pending/confirmed for too long
      const isDelayed =
        (order.status === 'pending' || order.status === 'confirmed') &&
        ageMinutes > DELAY_THRESHOLD_MINUTES;

      // Running orders are confirmed or preparing (actively being worked on)
      const isRunning = order.status === 'confirmed' || order.status === 'preparing';

      return {
        ...order,
        isDelayed,
        delayMinutes: isDelayed ? ageMinutes - DELAY_THRESHOLD_MINUTES : 0,
        isRunning,
      };
    });
  }, [orders]);

  // Calculate metrics per channel
  const channelMetrics = useMemo(() => {
    const metrics: Record<string, ChannelMetrics> = {
      swiggy: { orderCount: 0, itemCount: 0, totalValue: 0, pendingCount: 0, preparingCount: 0, readyCount: 0, delayedCount: 0, runningCount: 0, avgPrepTime: 0 },
      zomato: { orderCount: 0, itemCount: 0, totalValue: 0, pendingCount: 0, preparingCount: 0, readyCount: 0, delayedCount: 0, runningCount: 0, avgPrepTime: 0 },
      direct: { orderCount: 0, itemCount: 0, totalValue: 0, pendingCount: 0, preparingCount: 0, readyCount: 0, delayedCount: 0, runningCount: 0, avgPrepTime: 0 },
    };

    ordersWithDelay.forEach((order) => {
      const channel = order.aggregator || 'direct';
      if (!metrics[channel]) return;

      metrics[channel].orderCount++;
      metrics[channel].itemCount += order.cart.items.reduce((sum, item) => sum + item.quantity, 0);
      metrics[channel].totalValue += order.cart.total;

      if (order.status === 'pending') metrics[channel].pendingCount++;
      if (order.status === 'preparing' || order.status === 'confirmed') metrics[channel].preparingCount++;
      if (order.status === 'ready') metrics[channel].readyCount++;
      if (order.isDelayed) metrics[channel].delayedCount++;
      if (order.isRunning) metrics[channel].runningCount++;
    });

    return metrics;
  }, [ordersWithDelay]);

  // Filter orders by selected channel
  const filteredOrders = useMemo(() => {
    let filtered = ordersWithDelay;

    if (selectedChannel !== 'all') {
      filtered = filtered.filter((o) => o.aggregator === selectedChannel);
    }

    if (filter.status !== 'all') {
      filtered = filtered.filter((o) => o.status === filter.status);
    }

    // Sort: delayed first, then by creation time
    return filtered.sort((a, b) => {
      if (a.isDelayed && !b.isDelayed) return -1;
      if (!a.isDelayed && b.isDelayed) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [ordersWithDelay, selectedChannel, filter.status]);

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
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await rejectOrder(orderId, 'Rejected by restaurant');
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
    } catch (error) {
      console.error('Failed to mark ready:', error);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const getStatusColor = (status: string, isDelayed: boolean): 'default' | 'pending' | 'active' | 'success' | 'warning' | 'error' => {
    if (isDelayed) return 'error';
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'active';
      case 'preparing': return 'active';
      case 'ready': return 'success';
      case 'delivered': return 'success';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'swiggy': return 'text-orange-500';
      case 'zomato': return 'text-red-500';
      case 'direct': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  const getChannelBgColor = (channel: string) => {
    switch (channel) {
      case 'swiggy': return 'bg-orange-500/10 border-orange-500/30';
      case 'zomato': return 'bg-red-500/10 border-red-500/30';
      case 'direct': return 'bg-purple-500/10 border-purple-500/30';
      default: return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date().getTime();
    const orderTime = new Date(dateString).getTime();
    const diffMinutes = Math.floor((now - orderTime) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}h ${diffMinutes % 60}m ago`;
  };

  // Navigation items
  const navItems = [
    { id: 'orders', label: 'Orders', icon: '📦', path: '/website-orders' },
    { id: 'kitchen', label: 'Kitchen', icon: '👨‍🍳', path: '/kitchen' },
    { id: 'manager', label: 'Dashboard', icon: '📊', path: '/manager' },
  ];

  const channels: { id: AggregatorSource | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All Channels', icon: '📊' },
    { id: 'swiggy', label: 'Swiggy', icon: '🟠' },
    { id: 'zomato', label: 'Zomato', icon: '🔴' },
    { id: 'direct', label: 'Website', icon: '🌐' },
  ];

  const statusFilters: { label: string; value: AggregatorOrderStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Preparing', value: 'preparing' },
    { label: 'Ready', value: 'ready' },
  ];

  return (
    <AppShell
      navItems={navItems}
      activeNavId="orders"
      onNavigate={(_id, path) => navigate(path)}
      className={isMobile ? "p-2" : "p-4"}
    >
      <div className="max-w-full mx-auto space-y-3 sm:space-y-4">
        {/* Header - Responsive */}
        <div className={isMobile ? "space-y-3" : "flex items-center justify-between"}>
          <div>
            <h1 className={`font-bold text-foreground ${isMobile ? 'text-xl' : 'text-2xl'}`}>Orders Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {orders.length} total · {ordersWithDelay.filter(o => o.isRunning).length} running · {ordersWithDelay.filter(o => o.isDelayed).length} delayed
            </p>
          </div>

          {/* Channel filters - horizontal scroll on mobile */}
          <div className={`flex gap-2 ${isMobile ? 'overflow-x-auto pb-2 -mx-2 px-2' : ''}`} style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : undefined}>
            {channels.map((ch) => (
              <NeoButton
                key={ch.id}
                variant={selectedChannel === ch.id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedChannel(ch.id)}
                className={`whitespace-nowrap touch-target ${isMobile ? 'px-3' : ''}`}
              >
                {ch.icon} {isMobile ? '' : ch.label}
              </NeoButton>
            ))}
          </div>
        </div>

        {/* Channel Metrics Cards - Responsive grid */}
        <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {(['swiggy', 'zomato', 'direct'] as const).map((channel) => {
            const m = channelMetrics[channel];
            const hasDelays = m.delayedCount > 0;

            return (
              <NeoCard
                key={channel}
                className={`p-3 sm:p-4 border-2 ${getChannelBgColor(channel)} ${
                  selectedChannel === channel ? 'ring-2 ring-primary' : ''
                } cursor-pointer transition-all hover:scale-[1.02] touch-target`}
                onClick={() => setSelectedChannel(channel)}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h3 className={`text-base sm:text-lg font-bold capitalize ${getChannelColor(channel)}`}>
                    {channel === 'direct' ? 'Website' : channel}
                  </h3>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {m.runningCount > 0 && (
                      <span className="px-1.5 sm:px-2 py-0.5 bg-blue-500 text-white text-[10px] sm:text-xs font-bold rounded-full animate-pulse">
                        {m.runningCount} RUN
                      </span>
                    )}
                    {hasDelays && (
                      <span className="px-1.5 sm:px-2 py-0.5 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full animate-pulse">
                        {m.delayedCount} LATE
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                  {/* Order Count */}
                  <div className="bg-background/50 rounded-lg p-1.5 sm:p-2">
                    <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>{m.orderCount}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Orders</div>
                  </div>

                  {/* Item Count */}
                  <div className="bg-background/50 rounded-lg p-1.5 sm:p-2">
                    <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>{m.itemCount}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Items</div>
                  </div>

                  {/* Value */}
                  <div className="bg-background/50 rounded-lg p-1.5 sm:p-2">
                    <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>₹{m.totalValue.toFixed(0)}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Value</div>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="flex justify-between mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50 text-[10px] sm:text-xs">
                  <span className="text-yellow-500">{m.pendingCount} pending</span>
                  <span className="text-blue-500">{m.preparingCount} prep</span>
                  <span className="text-green-500">{m.readyCount} ready</span>
                </div>
              </NeoCard>
            );
          })}
        </div>

        {/* Status Filters - horizontal scroll on mobile */}
        <div className={`flex gap-2 ${isMobile ? 'overflow-x-auto pb-2 -mx-2 px-2' : ''}`} style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : undefined}>
          {statusFilters.map((f) => (
            <NeoButton
              key={f.value}
              variant={filter.status === f.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter({ status: f.value })}
              className="whitespace-nowrap touch-target"
            >
              {f.label}
            </NeoButton>
          ))}
        </div>

        {/* Orders List - Responsive grid */}
        {filteredOrders.length === 0 ? (
          <NeoCard className={`text-center ${isMobile ? 'p-8' : 'p-12'}`}>
            <div className={isMobile ? 'text-4xl mb-3' : 'text-6xl mb-4'}>📦</div>
            <h3 className={`font-semibold mb-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>No Orders</h3>
            <p className="text-muted-foreground text-sm">
              Orders from {selectedChannel === 'all' ? 'all channels' : selectedChannel} will appear here.
            </p>
          </NeoCard>
        ) : (
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
            {filteredOrders.map((order) => (
              <NeoCard
                key={order.orderId}
                className={`p-3 space-y-3 relative overflow-hidden ${
                  order.isDelayed
                    ? 'border-2 border-red-500 animate-pulse'
                    : order.isRunning
                      ? 'border-2 border-blue-500'
                      : ''
                }`}
              >
                {/* RUNNING indicator - flashing banner for active orders */}
                {order.isRunning && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 text-white text-xs font-bold py-1 text-center animate-pulse">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                      RUNNING - KOT SENT
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className={`flex justify-between items-start ${order.isRunning ? 'mt-6' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase ${getChannelColor(order.aggregator)}`}>
                        {order.aggregator}
                      </span>
                      <span className="text-lg font-bold">#{order.orderNumber}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.customer.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusPill status={getStatusColor(order.status, order.isDelayed)}>
                      {order.isDelayed ? `DELAYED +${order.delayMinutes}m` : order.status}
                    </StatusPill>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(order.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1 text-sm max-h-24 overflow-y-auto">
                  {order.cart.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="truncate flex-1">{item.quantity}x {item.name}</span>
                      {item.price > 0 && <span className="ml-2">₹{item.total}</span>}
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex justify-between font-semibold text-sm pt-2 border-t border-border">
                  <span>Total ({order.cart.items.length} items)</span>
                  <span>₹{order.cart.total.toFixed(2)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {order.status === 'pending' && (
                    <>
                      <NeoButton
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAcceptOrder(order.orderId)}
                        disabled={processingOrders.has(order.orderId)}
                      >
                        {processingOrders.has(order.orderId) ? '...' : 'Accept'}
                      </NeoButton>
                      <NeoButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRejectOrder(order.orderId)}
                        disabled={processingOrders.has(order.orderId)}
                      >
                        Reject
                      </NeoButton>
                    </>
                  )}
                  {(order.status === 'confirmed' || order.status === 'preparing') && (
                    <>
                      <NeoButton
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleMarkReady(order.orderId)}
                        disabled={processingOrders.has(order.orderId)}
                      >
                        {processingOrders.has(order.orderId) ? '...' : 'Mark Ready'}
                      </NeoButton>
                      {/* Cancel KOT button for running orders */}
                      {ordersInKDS.has(order.orderNumber) && (
                        <NeoButton
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:bg-red-500/10"
                          onClick={() => cancelKOT(order)}
                        >
                          Cancel KOT
                        </NeoButton>
                      )}
                    </>
                  )}
                  {order.status === 'ready' && (
                    <div className="text-center text-green-500 font-semibold w-full text-sm">
                      Ready for pickup
                    </div>
                  )}
                  {order.status === 'delivered' && (
                    <div className="text-center text-gray-400 font-semibold w-full text-sm">
                      Delivered
                    </div>
                  )}
                </div>
              </NeoCard>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
