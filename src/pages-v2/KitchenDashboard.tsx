/**
 * Kitchen Display System V2 - Industrial Redesign
 * "Idiot Proof" Industrial KDS design - Full screen, high visibility
 * Optimized for tablets and mobile devices with large touch targets
 * Features floating orb FAB for mobile-app-like experience
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useKDSStore } from '../stores/kdsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useOutOfStockStore } from '../stores/outOfStockStore';
import type { KitchenOrder, KitchenOrderItem } from '../types/kds';
import { IndustrialButton } from '../components/ui-industrial/IndustrialButton';
import { IndustrialCard } from '../components/ui-industrial/IndustrialCard';
import { cn } from '../lib/utils';
import { IndustrialBadge } from '../components/ui-industrial/IndustrialBadge';
import { OutOfStockModal } from '../components/kds/OutOfStockModal';
import { OutOfStockManagerModal } from '../components/kds/OutOfStockManagerModal';
import { KDSFloatingOrb } from '../components/kds/KDSFloatingOrb';

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

export default function KitchenDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    activeOrders,
    fetchOrders,
    markItemStatus,
    markItemReady,
    markOrderComplete,
    loadOrdersFromDb,
  } = useKDSStore();
  const { playSound } = useNotificationStore();
  const {
    isItemOutOfStock,
    getActiveItems,
    markOutOfStock,
    loadFromDb: loadOOSFromDb,
  } = useOutOfStockStore();

  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Out of Stock modal state
  const [oosModalOpen, setOosModalOpen] = useState(false);
  const [oosManagerOpen, setOosManagerOpen] = useState(false);
  const [selectedOosItem, setSelectedOosItem] = useState<{
    itemName: string;
    orderId: string;
    orderNumber: string;
    tableNumber?: number;
  } | null>(null);

  // FAB orb state
  const [isOrbMenuOpen, setIsOrbMenuOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isSmallTablet = useMediaQuery('(min-width: 640px) and (max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Ref for horizontal scroll on mobile
  const ordersScrollRef = useRef<HTMLDivElement>(null);

  // Update current time every second for timers
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load orders from SQLite first (preserves local orders), then fetch from API
  useEffect(() => {
    if (!user?.tenantId) return;

    // First load from SQLite to get persisted orders (important for generic mode switching)
    loadOrdersFromDb(user.tenantId).then(() => {
      // Then fetch from API and merge
      fetchOrders(user.tenantId);
    });

    // Load out-of-stock items from SQLite
    loadOOSFromDb(user.tenantId);

    const interval = setInterval(() => {
      if (user?.tenantId) {
        fetchOrders(user.tenantId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user?.tenantId, fetchOrders, loadOrdersFromDb, loadOOSFromDb]);

  // Handle item actions
  const handleStartItem = async (orderId: string, itemId: string) => {
    const key = `${orderId}-${itemId}`;
    setProcessingItems((prev) => new Set(prev).add(key));
    try {
      await markItemStatus(orderId, itemId, 'in_progress');
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleReadyItem = async (orderId: string, itemId: string) => {
    const key = `${orderId}-${itemId}`;
    setProcessingItems((prev) => new Set(prev).add(key));
    try {
      await markItemReady(orderId, itemId);
      playSound('order_ready');
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      await markOrderComplete(orderId);
      playSound('order_ready');
    } catch (error) {
      console.error('Failed to complete order:', error);
    }
  };

  // Handle 86 (out of stock) button click
  const handleMarkOutOfStock = (order: KitchenOrder, item: KitchenOrderItem) => {
    setSelectedOosItem({
      itemName: item.name,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber ?? undefined,
    });
    setOosModalOpen(true);
  };

  // Confirm marking item as out of stock
  const handleConfirmOutOfStock = async (portionsOut: number) => {
    if (!user?.tenantId || !selectedOosItem) return;

    await markOutOfStock(
      user.tenantId,
      selectedOosItem.itemName,
      portionsOut,
      {
        orderId: selectedOosItem.orderId,
        orderNumber: selectedOosItem.orderNumber,
        tableNumber: selectedOosItem.tableNumber,
      },
      user.name
    );

    setSelectedOosItem(null);
  };

  // Get active OOS items count
  const oosItemsCount = getActiveItems().length;

  // Calculate order age in minutes
  const getOrderAge = (order: KitchenOrder): number => {
    const startTime = new Date(order.createdAt).getTime();
    return Math.floor((currentTime - startTime) / 1000 / 60);
  };

  // Get urgency level
  const getUrgency = (minutes: number): 'normal' | 'warning' | 'urgent' => {
    if (minutes > 20) return 'urgent';
    if (minutes > 15) return 'warning';
    return 'normal';
  };

  // Show all orders (no station filtering needed for KDS)
  // Sort running orders first (priority), then by creation time
  const filteredOrders = [...activeOrders].sort((a, b) => {
    // Running orders come first
    if (a.isRunningOrder && !b.isRunningOrder) return -1;
    if (!a.isRunningOrder && b.isRunningOrder) return 1;
    // Then sort by creation time (oldest first)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Count running orders for stats
  const runningOrdersCount = activeOrders.filter((o: KitchenOrder) => o.isRunningOrder).length;

  // Stats
  const activeOrdersCount = activeOrders.filter((o: KitchenOrder) => o.status !== 'completed').length;
  const pendingItems = activeOrders.reduce(
    (sum: number, o: KitchenOrder) => sum + o.items.filter((i: any) => i.status === 'pending').length,
    0
  );
  const urgentOrders = activeOrders.filter((o: KitchenOrder) => getOrderAge(o) > 20).length;

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col overflow-hidden font-mono antialiased">
      {/* ==================== MOBILE/TABLET MINIMAL HEADER ==================== */}
      {(isMobile || isSmallTablet || isTablet) && (
        <header className="bg-black border-b-2 border-slate-800 px-4 py-2 flex-shrink-0 safe-area-top">
          <div className="flex items-center justify-between">
            {/* Left: Title */}
            <h1 className={cn(
              "font-black tracking-widest uppercase text-white",
              isMobile ? "text-xl" : "text-2xl"
            )}>KDS</h1>

            {/* Right: Time + Optional mini-stats */}
            <div className="flex items-center gap-3">
              <span className={cn(
                "font-bold text-slate-400 font-mono",
                isMobile ? "text-base" : "text-lg"
              )}>
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>

              {/* Collapsible mini stats - controlled by FAB toggle */}
              {showStats && (
                <div className="flex gap-2">
                  <div className="bg-slate-900 border border-slate-700 rounded px-2 py-1 flex items-center gap-1">
                    <span className="font-black text-blue-400 text-sm">{activeOrdersCount}</span>
                    <span className="text-[8px] text-slate-500 uppercase">Act</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded px-2 py-1 flex items-center gap-1">
                    <span className="font-black text-yellow-500 text-sm">{pendingItems}</span>
                    <span className="text-[8px] text-slate-500 uppercase">Pend</span>
                  </div>
                  {runningOrdersCount > 0 && (
                    <div className="bg-orange-900/20 border border-orange-500 rounded px-2 py-1 flex items-center gap-1 animate-pulse">
                      <span className="font-black text-orange-500 text-sm">{runningOrdersCount}</span>
                      <span className="text-[8px] text-slate-500 uppercase">Run</span>
                    </div>
                  )}
                  {urgentOrders > 0 && (
                    <div className="bg-red-900/20 border border-red-500 rounded px-2 py-1 flex items-center gap-1 animate-pulse">
                      <span className="font-black text-red-500 text-sm">{urgentOrders}</span>
                      <span className="text-[8px] text-slate-500 uppercase">Urg</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ==================== DESKTOP HEADER ==================== */}
      {isDesktop && (
        <>
          <div className="bg-black border-b-4 border-slate-800 px-6 py-4 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-3xl font-black tracking-widest uppercase text-white">KDS</h1>
              <div className="text-xl font-bold text-slate-500">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex gap-4">
              <div className="bg-slate-900 border-2 border-slate-700 px-6 py-2 rounded flex flex-col items-center min-w-[120px]">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active</span>
                <span className="text-3xl font-black text-blue-400">{activeOrdersCount}</span>
              </div>
              <div className="bg-slate-900 border-2 border-slate-700 px-6 py-2 rounded flex flex-col items-center min-w-[120px]">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pending</span>
                <span className="text-3xl font-black text-yellow-500">{pendingItems}</span>
              </div>
              {runningOrdersCount > 0 && (
                <div className="bg-orange-900/20 border-2 border-orange-500 px-6 py-2 rounded flex flex-col items-center min-w-[120px] animate-pulse">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Running</span>
                  <span className="text-3xl font-black text-orange-500">{runningOrdersCount}</span>
                </div>
              )}
              <div className={cn("bg-slate-900 border-2 border-slate-700 px-6 py-2 rounded flex flex-col items-center min-w-[120px]", urgentOrders > 0 && "animate-pulse border-red-500 bg-red-900/20")}>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Urgent</span>
                <span className={cn("text-3xl font-black text-white", urgentOrders > 0 ? "text-red-500" : "text-green-500")}>{urgentOrders}</span>
              </div>
              {/* OOS (86) Button */}
              <button
                onClick={() => setOosManagerOpen(true)}
                className={cn(
                  "px-6 py-2 rounded flex flex-col items-center min-w-[120px] transition-all",
                  oosItemsCount > 0
                    ? "bg-red-900/30 border-2 border-red-600 hover:bg-red-900/50"
                    : "bg-slate-900 border-2 border-slate-700 hover:bg-slate-800"
                )}
              >
                <span className={cn(
                  "text-xs font-black uppercase tracking-wider",
                  oosItemsCount > 0 ? "text-red-400" : "text-slate-400"
                )}>86'd</span>
                <span className={cn(
                  "text-3xl font-black",
                  oosItemsCount > 0 ? "text-red-500" : "text-slate-500"
                )}>{oosItemsCount}</span>
              </button>
            </div>
          </div>

        </>
      )}

      {/* ==================== MAIN ORDERS GRID ==================== */}
      <main
        ref={ordersScrollRef}
        className={cn(
          "flex-1 overflow-y-auto overscroll-contain bg-slate-950",
          isMobile ? "p-2" : "p-4"
        )}
        style={{
          paddingBottom: isMobile ? 'calc(96px + env(safe-area-inset-bottom, 0px))' : undefined,
        }}
      >
        {filteredOrders.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className={cn(
              "text-center opacity-20",
              isMobile ? "" : "transform scale-150"
            )}>
              <div className={cn("mb-4", isMobile ? "text-6xl" : "text-9xl")}>✓</div>
              <div className={cn("font-black uppercase", isMobile ? "text-2xl" : "text-4xl")}>All Caught Up</div>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile: Vertical stack with order numbers on top */}
            {isMobile && (
              <div className="flex flex-col gap-4 pb-4">
                {filteredOrders.map((order: KitchenOrder) => {
                  const age = getOrderAge(order);
                  const urgency = getUrgency(age);
                  const allItemsReady = order.items.every((i: any) => i.status === 'ready');

                  return (
                    <div key={order.id} className="w-full">
                      <IndustrialCard
                        variant="dark"
                        padding="none"
                        className={cn(
                          'flex flex-col h-full border-4',
                          // Running orders get orange border and flashing animation
                          order.isRunningOrder && 'border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-pulse',
                          // Non-running orders use urgency-based styling
                          !order.isRunningOrder && urgency === 'urgent' && 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]',
                          !order.isRunningOrder && urgency === 'warning' && 'border-yellow-500',
                          !order.isRunningOrder && urgency === 'normal' && 'border-slate-700'
                        )}
                      >
                        {/* Order Header - Large prominent number on top for mobile */}
                        <div className={cn(
                          'p-4 border-b-4',
                          // Running orders get orange header
                          order.isRunningOrder ? 'bg-orange-600 border-orange-700' :
                          urgency === 'urgent' ? 'bg-red-700 border-red-800' :
                            urgency === 'warning' ? 'bg-yellow-700 border-yellow-800' :
                              'bg-slate-800 border-slate-900'
                        )}>
                          {/* Order number prominently on top */}
                          <div className="text-center mb-2">
                            <div className="text-5xl font-black tracking-wider">#{order.orderNumber}</div>
                            {order.tableNumber && (
                              <div className="text-xl font-bold mt-1 opacity-90">TABLE {order.tableNumber}</div>
                            )}
                          </div>
                          {/* Badges and timer row */}
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {order.isRunningOrder && (
                                <IndustrialBadge size="sm" className="bg-orange-900 border-orange-400 text-orange-100 font-black">
                                  🏃 RUNNING
                                </IndustrialBadge>
                              )}
                              {order.source && !order.isRunningOrder && (
                                <IndustrialBadge size="sm" className="bg-black border-black text-white">
                                  {order.source}
                                </IndustrialBadge>
                              )}
                            </div>
                            <div className="timer-badge-urgent">
                              <span className="text-2xl font-black">{age}m</span>
                            </div>
                          </div>
                        </div>

                        {/* Items List */}
                        <div className="p-3 flex-1 space-y-2 bg-slate-900/50 max-h-[50vh] overflow-y-auto">
                          {order.items
                            .map((item: any) => {
                              const itemKey = `${order.id}-${item.id}`;
                              const isProcessing = processingItems.has(itemKey);
                              const isOOS = isItemOutOfStock(item.name);

                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    'p-3 border-l-4 bg-slate-800',
                                    item.status === 'ready' && 'border-l-green-500 bg-slate-800/50 opacity-50',
                                    item.status === 'in_progress' && 'border-l-blue-500 bg-blue-900/20',
                                    item.status === 'pending' && !isOOS && 'border-l-slate-500',
                                    isOOS && 'border-l-red-500 bg-red-950/30'
                                  )}
                                >
                                  <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className={cn(
                                        "text-lg font-bold leading-tight",
                                        item.status === 'ready' && 'line-through decoration-2'
                                      )}>
                                        {isOOS && (
                                          <span className="text-red-500 font-black text-xs mr-2 bg-red-900/50 px-1 py-0.5 rounded">86'd</span>
                                        )}
                                        <span className="text-yellow-400 mr-2">{item.quantity}x</span>
                                        {item.name}
                                      </div>

                                      {item.modifiers && item.modifiers.length > 0 && (
                                        <div className="text-xs text-slate-400 mt-1 uppercase font-semibold">
                                          + {item.modifiers.join(', ')}
                                        </div>
                                      )}

                                      {item.specialInstructions && (
                                        <div className="text-xs font-bold text-red-400 mt-1 bg-red-950/30 p-1 border border-red-900/50 uppercase">
                                          ⚠️ {item.specialInstructions}
                                        </div>
                                      )}
                                    </div>

                                    {/* Item Action Buttons - Larger for touch */}
                                    <div className="flex gap-1 flex-shrink-0">
                                      {/* 86 Button - shown for pending and in_progress items */}
                                      {item.status !== 'ready' && !isOOS && (
                                        <button
                                          onClick={() => handleMarkOutOfStock(order, item)}
                                          className="w-12 h-14 bg-red-800 hover:bg-red-700 text-white font-black text-xs uppercase rounded border-2 border-red-600 touch-target"
                                          title="Mark Out of Stock"
                                        >
                                          86
                                        </button>
                                      )}
                                      <div className="w-20">
                                        {item.status === 'pending' && (
                                          <button
                                            disabled={isProcessing}
                                            onClick={() => handleStartItem(order.id, item.id)}
                                            className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase rounded border-2 border-blue-400 disabled:opacity-50 touch-target"
                                          >
                                            START
                                          </button>
                                        )}
                                        {item.status === 'in_progress' && (
                                          <button
                                            disabled={isProcessing}
                                            onClick={() => handleReadyItem(order.id, item.id)}
                                            className="w-full h-14 bg-green-600 hover:bg-green-500 text-white font-black text-sm uppercase rounded border-2 border-green-400 disabled:opacity-50 touch-target"
                                          >
                                            DONE
                                          </button>
                                        )}
                                        {item.status === 'ready' && (
                                          <div className="h-14 flex items-center justify-center text-green-500 font-bold border-2 border-green-900/30 bg-green-900/10 uppercase text-sm rounded">
                                            ✓
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* Order Bottom Action */}
                        {allItemsReady && (
                          <button
                            onClick={() => handleCompleteOrder(order.id)}
                            className="w-full py-5 bg-green-600 hover:bg-green-500 text-white font-black text-xl uppercase tracking-widest transition-colors animate-pulse touch-target"
                          >
                            BUMP ORDER
                          </button>
                        )}
                      </IndustrialCard>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tablet/Desktop: Grid layout */}
            {!isMobile && (
              <div className={cn(
                "grid gap-4",
                isSmallTablet && "grid-cols-1",
                isTablet && "grid-cols-2",
                isDesktop && "grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
              )}>
                {filteredOrders.map((order: KitchenOrder) => {
                  const age = getOrderAge(order);
                  const urgency = getUrgency(age);
                  const allItemsReady = order.items.every((i: any) => i.status === 'ready');

                  return (
                    <IndustrialCard
                      key={order.id}
                      variant="dark"
                      padding="none"
                      className={cn(
                        'flex flex-col h-full border-4',
                        // Running orders get orange border and flashing animation
                        order.isRunningOrder && 'border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-pulse',
                        // Non-running orders use urgency-based styling
                        !order.isRunningOrder && urgency === 'urgent' && 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]',
                        !order.isRunningOrder && urgency === 'warning' && 'border-yellow-500',
                        !order.isRunningOrder && urgency === 'normal' && 'border-slate-700'
                      )}
                    >
                      {/* Order Header */}
                      <div className={cn(
                        'p-4 flex justify-between items-start border-b-4',
                        // Running orders get orange header
                        order.isRunningOrder ? 'bg-orange-600 border-orange-700' :
                        urgency === 'urgent' ? 'bg-red-700 border-red-800' :
                          urgency === 'warning' ? 'bg-yellow-700 border-yellow-800' :
                            'bg-slate-800 border-slate-900'
                      )}>
                        <div>
                          <div className={cn("font-black", isTablet ? "text-3xl" : "text-4xl")}>#{order.orderNumber}</div>
                          <div className="flex gap-2 mt-2">
                            {order.isRunningOrder && (
                              <IndustrialBadge size="sm" className="bg-orange-900 border-orange-400 text-orange-100 font-black">
                                🏃 RUNNING
                              </IndustrialBadge>
                            )}
                            {order.source && !order.isRunningOrder && (
                              <IndustrialBadge size="sm" className="bg-black border-black text-white">
                                {order.source}
                              </IndustrialBadge>
                            )}
                            {order.tableNumber && (
                              <IndustrialBadge size="sm" className="bg-slate-700 border-slate-600 text-slate-200">
                                Table {order.tableNumber}
                              </IndustrialBadge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("font-black", isTablet ? "text-3xl" : "text-4xl")}>{age}m</div>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="p-4 flex-1 space-y-3 bg-slate-900/50">
                        {order.items.map((item: any) => {
                            const itemKey = `${order.id}-${item.id}`;
                            const isProcessing = processingItems.has(itemKey);
                            const isOOS = isItemOutOfStock(item.name);

                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  'p-3 border-l-4 bg-slate-800 mb-2',
                                  item.status === 'ready' && 'border-l-green-500 bg-slate-800/50 opacity-50',
                                  item.status === 'in_progress' && 'border-l-blue-500 bg-blue-900/20',
                                  item.status === 'pending' && !isOOS && 'border-l-slate-500',
                                  isOOS && 'border-l-red-500 bg-red-950/30'
                                )}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex-1">
                                    <div className={cn(
                                      "font-bold leading-tight",
                                      isTablet ? "text-lg" : "text-xl",
                                      item.status === 'ready' && 'line-through decoration-2'
                                    )}>
                                      {isOOS && (
                                        <span className="text-red-500 font-black text-xs mr-2 bg-red-900/50 px-1 py-0.5 rounded">86'd</span>
                                      )}
                                      <span className="text-yellow-400 mr-2">{item.quantity}x</span>
                                      {item.name}
                                    </div>

                                    {item.modifiers && item.modifiers.length > 0 && (
                                      <div className="text-sm text-slate-400 mt-1 uppercase font-semibold">
                                        + {item.modifiers.join(', ')}
                                      </div>
                                    )}

                                    {item.specialInstructions && (
                                      <div className="text-sm font-bold text-red-400 mt-1 bg-red-950/30 p-1 border border-red-900/50 uppercase inline-block">
                                        ⚠️ {item.specialInstructions}
                                      </div>
                                    )}
                                  </div>

                                  {/* Item Action Buttons */}
                                  <div className="flex gap-1 flex-shrink-0">
                                    {/* 86 Button - shown for pending and in_progress items */}
                                    {item.status !== 'ready' && !isOOS && (
                                      <button
                                        onClick={() => handleMarkOutOfStock(order, item)}
                                        className={cn(
                                          "bg-red-800 hover:bg-red-700 text-white font-black text-xs uppercase rounded border-2 border-red-600 touch-target",
                                          isTablet ? "w-12 h-14" : "w-14 h-12"
                                        )}
                                        title="Mark Out of Stock"
                                      >
                                        86
                                      </button>
                                    )}
                                    <div className={cn(isTablet ? "w-20" : "w-24")}>
                                      {item.status === 'pending' && (
                                        <IndustrialButton
                                          size="sm"
                                          variant="primary"
                                          fullWidth
                                          disabled={isProcessing}
                                          onClick={() => handleStartItem(order.id, item.id)}
                                          className={cn("text-lg touch-target", isTablet ? "h-14" : "h-12")}
                                        >
                                          START
                                        </IndustrialButton>
                                      )}
                                      {item.status === 'in_progress' && (
                                        <IndustrialButton
                                          size="sm"
                                          variant="success"
                                          fullWidth
                                          disabled={isProcessing}
                                          onClick={() => handleReadyItem(order.id, item.id)}
                                          className={cn("text-lg touch-target", isTablet ? "h-14" : "h-12")}
                                        >
                                          DONE
                                        </IndustrialButton>
                                      )}
                                      {item.status === 'ready' && (
                                        <div className={cn(
                                          "flex items-center justify-center text-green-500 font-bold border-2 border-green-900/30 bg-green-900/10 uppercase",
                                          isTablet ? "h-14" : "h-12"
                                        )}>
                                          READY
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {/* Order Bottom Action */}
                      {allItemsReady && (
                        <button
                          onClick={() => handleCompleteOrder(order.id)}
                          className={cn(
                            "w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest transition-colors animate-pulse touch-target",
                            isTablet ? "py-5 text-xl" : "py-6 text-2xl"
                          )}
                        >
                          BUMP ORDER
                        </button>
                      )}
                    </IndustrialCard>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Orb FAB - Mobile/Tablet only */}
      {(isMobile || isSmallTablet || isTablet) && (
        <KDSFloatingOrb
          isOpen={isOrbMenuOpen}
          onToggle={() => setIsOrbMenuOpen(!isOrbMenuOpen)}
          activeOrderCount={activeOrdersCount}
          urgentOrderCount={urgentOrders}
          oosCount={oosItemsCount}
          onNavigateHome={() => navigate('/hub')}
          onOpen86Manager={() => {
            setOosManagerOpen(true);
            setIsOrbMenuOpen(false);
          }}
          onRefresh={() => {
            if (user?.tenantId) {
              fetchOrders(user.tenantId);
            }
            setIsOrbMenuOpen(false);
          }}
          onToggleStats={() => setShowStats(!showStats)}
          showStats={showStats}
        />
      )}

      {/* Out of Stock Modal (portions input) */}
      <OutOfStockModal
        open={oosModalOpen}
        onClose={() => {
          setOosModalOpen(false);
          setSelectedOosItem(null);
        }}
        itemName={selectedOosItem?.itemName ?? ''}
        orderContext={selectedOosItem ? {
          orderId: selectedOosItem.orderId,
          orderNumber: selectedOosItem.orderNumber,
          tableNumber: selectedOosItem.tableNumber,
        } : undefined}
        onConfirm={handleConfirmOutOfStock}
      />

      {/* Out of Stock Manager Modal */}
      <OutOfStockManagerModal
        open={oosManagerOpen}
        onClose={() => setOosManagerOpen(false)}
        tenantId={user?.tenantId ?? ''}
      />
    </div>
  );
}
