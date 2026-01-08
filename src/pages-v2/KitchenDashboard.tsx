/**
 * Kitchen Display System V2 - Industrial Redesign
 * "Idiot Proof" Industrial KDS design - Full screen, high visibility
 * Optimized for tablets and mobile devices with large touch targets
 * Features floating orb FAB for mobile-app-like experience
 *
 * V2.1: Added station grouping and history view
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useKDSStore } from '../stores/kdsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useOutOfStockStore } from '../stores/outOfStockStore';
import type { KitchenOrder, KitchenOrderItem, KitchenItemStatus } from '../types/kds';
import { cn } from '../lib/utils';
import { OutOfStockModal } from '../components/kds/OutOfStockModal';
import { OutOfStockManagerModal } from '../components/kds/OutOfStockManagerModal';
import { KDSFloatingOrb } from '../components/kds/KDSFloatingOrb';
import { KDSGroupedOrderCard } from '../components/kds/KDSGroupedOrderCard';

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

type ViewTab = 'active' | 'history';

export default function KitchenDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    activeOrders,
    completedOrders,
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

  const [currentTime, setCurrentTime] = useState(Date.now());

  // View tab state
  const [activeTab, setActiveTab] = useState<ViewTab>('active');

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

  // Handle item status change (from grouped card)
  const handleItemStatusChange = async (orderId: string, itemId: string, newStatus: KitchenItemStatus) => {
    try {
      if (newStatus === 'in_progress') {
        await markItemStatus(orderId, itemId, 'in_progress');
      } else if (newStatus === 'ready') {
        await markItemReady(orderId, itemId);
        playSound('order_ready');
      }
    } catch (error) {
      console.error('Failed to update item status:', error);
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

  // Handle 86 (out of stock) button click from order card
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

  // Sort completed orders by completion time (newest first)
  const sortedCompletedOrders = [...completedOrders].sort((a, b) => {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });

  // Count running orders for stats
  const runningOrdersCount = activeOrders.filter((o: KitchenOrder) => o.isRunningOrder).length;

  // Stats
  const activeOrdersCount = activeOrders.filter((o: KitchenOrder) => o.status !== 'completed').length;
  const pendingItems = activeOrders.reduce(
    (sum: number, o: KitchenOrder) => sum + o.items.filter((i: KitchenOrderItem) => i.status === 'pending').length,
    0
  );
  const urgentOrders = activeOrders.filter((o: KitchenOrder) => getOrderAge(o) > 20).length;

  // Tab bar component
  const TabBar = ({ className }: { className?: string }) => (
    <div className={cn('flex gap-2', className)}>
      <button
        onClick={() => setActiveTab('active')}
        className={cn(
          'px-4 py-2 font-black uppercase tracking-wider text-sm rounded-t border-2 border-b-0 transition-all',
          activeTab === 'active'
            ? 'bg-slate-800 border-slate-600 text-white'
            : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800/50'
        )}
      >
        Active
        {activeOrdersCount > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white">
            {activeOrdersCount}
          </span>
        )}
      </button>
      <button
        onClick={() => setActiveTab('history')}
        className={cn(
          'px-4 py-2 font-black uppercase tracking-wider text-sm rounded-t border-2 border-b-0 transition-all',
          activeTab === 'history'
            ? 'bg-slate-800 border-slate-600 text-white'
            : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800/50'
        )}
      >
        History
        {completedOrders.length > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-600 text-slate-300">
            {completedOrders.length}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col overflow-hidden font-mono antialiased">
      {/* ==================== MOBILE/TABLET MINIMAL HEADER ==================== */}
      {(isMobile || isSmallTablet || isTablet) && (
        <header className="bg-black border-b-2 border-slate-800 px-4 pr-16 py-2 flex-shrink-0 safe-area-top">
          <div className="flex items-center justify-between">
            {/* Left: Title + Tabs */}
            <div className="flex items-center gap-3">
              <h1 className={cn(
                "font-black tracking-widest uppercase text-white",
                isMobile ? "text-lg" : "text-xl"
              )}>KDS</h1>
              <TabBar />
            </div>

            {/* Right: Time + Optional mini-stats */}
            <div className="flex items-center gap-3">
              <span className={cn(
                "font-bold text-slate-400 font-mono",
                isMobile ? "text-sm" : "text-base"
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
              <TabBar />
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
        {/* ==================== ACTIVE ORDERS VIEW ==================== */}
        {activeTab === 'active' && (
          <>
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
              <div className={cn(
                "grid gap-4",
                isMobile && "grid-cols-1",
                isSmallTablet && "grid-cols-1",
                isTablet && "grid-cols-2",
                isDesktop && "grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              )}>
                {filteredOrders.map((order: KitchenOrder) => {
                  const age = getOrderAge(order);
                  const urgency = getUrgency(age);

                  return (
                    <KDSGroupedOrderCard
                      key={order.id}
                      order={order}
                      orderAge={age}
                      urgency={urgency}
                      onItemStatusChange={handleItemStatusChange}
                      onBumpOrder={handleCompleteOrder}
                      onMarkOutOfStock={handleMarkOutOfStock}
                      isItemOutOfStock={isItemOutOfStock}
                      isCompact={isMobile || isSmallTablet}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ==================== HISTORY VIEW ==================== */}
        {activeTab === 'history' && (
          <>
            {sortedCompletedOrders.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className={cn(
                  "text-center opacity-20",
                  isMobile ? "" : "transform scale-150"
                )}>
                  <div className={cn("mb-4", isMobile ? "text-6xl" : "text-9xl")}>📋</div>
                  <div className={cn("font-black uppercase", isMobile ? "text-2xl" : "text-4xl")}>No History Yet</div>
                  <div className={cn("mt-2 text-slate-500", isMobile ? "text-sm" : "text-lg")}>
                    Completed orders will appear here
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn(
                "grid gap-4",
                isMobile && "grid-cols-1",
                isSmallTablet && "grid-cols-1",
                isTablet && "grid-cols-2",
                isDesktop && "grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              )}>
                {sortedCompletedOrders.map((order: KitchenOrder) => {
                  // For completed orders, calculate age from creation to completion
                  const completionTime = order.completedAt
                    ? new Date(order.completedAt).getTime()
                    : currentTime;
                  const creationTime = new Date(order.createdAt).getTime();
                  const prepTime = Math.floor((completionTime - creationTime) / 1000 / 60);

                  return (
                    <KDSGroupedOrderCard
                      key={order.id}
                      order={order}
                      orderAge={prepTime}
                      urgency="normal"
                      isItemOutOfStock={isItemOutOfStock}
                      isCompact={isMobile || isSmallTablet}
                      isReadOnly
                    />
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
          onToggleHistory={() => {
            setActiveTab(activeTab === 'active' ? 'history' : 'active');
            setIsOrbMenuOpen(false);
          }}
          isHistoryView={activeTab === 'history'}
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
