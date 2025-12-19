/**
 * Kitchen Display System V2 - Industrial Redesign
 * "Idiot Proof" Industrial KDS design - Full screen, high visibility
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useKDSStore } from '../stores/kdsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useMenuStore } from '../stores/menuStore';
import { KitchenOrder, KitchenStation } from '../types/kds';
import { IndustrialButton } from '../components/ui-industrial/IndustrialButton';
import { IndustrialCard } from '../components/ui-industrial/IndustrialCard';
import { cn } from '../lib/utils';
import { IndustrialBadge } from '../components/ui-industrial/IndustrialBadge';

type StationFilter = string; // Changed from KitchenStation to support dynamic categories

export default function KitchenDashboard() {
  const { user } = useAuthStore();
  const {
    activeOrders,
    fetchOrders,
    markItemStatus,
    markItemReady,
    markOrderComplete,
  } = useKDSStore();
  const { playSound } = useNotificationStore();
  const { categories } = useMenuStore();

  const [stationFilter, setStationFilter] = useState<StationFilter>('all');
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for timers
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch orders on mount and periodically
  useEffect(() => {
    if (!user?.tenantId) return;

    fetchOrders(user.tenantId);
    const interval = setInterval(() => {
      if (user?.tenantId) {
        fetchOrders(user.tenantId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user?.tenantId, fetchOrders]);

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

  // Filter orders by station
  const filteredOrders = activeOrders.filter((order: KitchenOrder) => {
    if (stationFilter === 'all') return true;
    return order.items.some((item: any) => item.station === stationFilter);
  });

  // Stations - dynamically generated from menu categories
  const stations: { id: StationFilter; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '🔍' },
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
      icon: category.icon || '🍽️',
    })),
  ];

  // Stats
  const activeOrdersCount = activeOrders.filter((o: KitchenOrder) => o.status !== 'completed').length;
  const pendingItems = activeOrders.reduce(
    (sum: number, o: KitchenOrder) => sum + o.items.filter((i: any) => i.status === 'pending').length,
    0
  );
  const urgentOrders = activeOrders.filter((o: KitchenOrder) => getOrderAge(o) > 20).length;

  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden font-mono antialiased">
      {/* Top Header Bar */}
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
          <div className={cn("bg-slate-900 border-2 border-slate-700 px-6 py-2 rounded flex flex-col items-center min-w-[120px]", urgentOrders > 0 && "animate-pulse border-red-500 bg-red-900/20")}>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Urgent</span>
            <span className={cn("text-3xl font-black text-white", urgentOrders > 0 ? "text-red-500" : "text-green-500")}>{urgentOrders}</span>
          </div>
        </div>
      </div>

      {/* Station Filters */}
      {/* Station Filters */}
      <div className="bg-slate-900 p-2 flex gap-2 overflow-x-auto border-b-4 border-black">
        {stations.map((station) => (
          <button
            key={station.id}
            onClick={() => setStationFilter(station.id)}
            className={cn(
              'px-4 py-4 font-black text-lg xl:text-xl uppercase tracking-wider border-2 transition-all flex-1 whitespace-nowrap min-w-[120px]',
              stationFilter === station.id
                ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] transform scale-105 z-10'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            )}
          >
            <span className="mr-2 opacity-50">{station.icon}</span>
            {station.label}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center opacity-20 transform scale-150">
              <div className="text-9xl mb-4">✓</div>
              <div className="text-4xl font-black uppercase">All Caught Up</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
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
                    urgency === 'urgent' && 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]',
                    urgency === 'warning' && 'border-yellow-500',
                    urgency === 'normal' && 'border-slate-700'
                  )}
                >
                  {/* Order Header */}
                  <div className={cn(
                    'p-4 flex justify-between items-start border-b-4',
                    urgency === 'urgent' ? 'bg-red-700 border-red-800' :
                      urgency === 'warning' ? 'bg-yellow-700 border-yellow-800' :
                        'bg-slate-800 border-slate-900'
                  )}>
                    <div>
                      <div className="text-4xl font-black">#{order.orderNumber}</div>
                      <div className="flex gap-2 mt-2">
                        {order.source && (
                          <IndustrialBadge size="sm" className="bg-black border-black text-white">
                            {order.source}
                          </IndustrialBadge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black">{age}m</div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="p-4 flex-1 space-y-3 bg-slate-900/50">
                    {order.items
                      .filter((item: any) => stationFilter === 'all' || item.station === stationFilter)
                      .map((item: any) => {
                        const itemKey = `${order.id}-${item.id}`;
                        const isProcessing = processingItems.has(itemKey);

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              'p-3 border-l-4 bg-slate-800 mb-2',
                              item.status === 'ready' && 'border-l-green-500 bg-slate-800/50 opacity-50',
                              item.status === 'in_progress' && 'border-l-blue-500 bg-blue-900/20',
                              item.status === 'pending' && 'border-l-slate-500'
                            )}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <div className={cn("text-xl font-bold leading-tight", item.status === 'ready' && 'line-through decoration-2')}>
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

                              {/* Item Action Button */}
                              <div className="w-24">
                                {item.status === 'pending' && (
                                  <IndustrialButton
                                    size="sm"
                                    variant="primary"
                                    fullWidth
                                    disabled={isProcessing}
                                    onClick={() => handleStartItem(order.id, item.id)}
                                    className="h-12 text-lg"
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
                                    className="h-12 text-lg"
                                  >
                                    DONE
                                  </IndustrialButton>
                                )}
                                {item.status === 'ready' && (
                                  <div className="h-12 flex items-center justify-center text-green-500 font-bold border-2 border-green-900/30 bg-green-900/10 uppercase">
                                    READY
                                  </div>
                                )}
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
                      className="w-full py-6 bg-green-600 hover:bg-green-500 text-white font-black text-2xl uppercase tracking-widest transition-colors animate-pulse"
                    >
                      BUMP ORDER
                    </button>
                  )}
                </IndustrialCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
