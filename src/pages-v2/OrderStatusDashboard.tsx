/**
 * Order Status Dashboard
 * Real-time overview of ALL order channels - no interaction needed
 * Focus: Timing, delays, and potential customer dissatisfaction
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useKDSStore } from '../stores/kdsStore';
import { usePOSStore } from '../stores/posStore';
import { cn } from '../lib/utils';
import type { AggregatorOrder } from '../types/aggregator';
import type { KitchenOrder } from '../types/kds';
import type { TableSession } from '../types/pos';

// Timing thresholds (minutes)
const TIMING = {
  WARNING: 10,    // Yellow warning after 10 mins
  CRITICAL: 15,   // Red critical after 15 mins
  SEVERE: 20,     // Flashing alert after 20 mins
};

type OrderChannel = 'dine-in' | 'swiggy' | 'zomato' | 'website' | 'takeout';
type OrderHealth = 'healthy' | 'warning' | 'critical' | 'severe';

interface UnifiedOrder {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  channelIcon: string;
  status: string;
  items: { name: string; quantity: number }[];
  total: number;
  tableNumber?: number | null;
  customerName?: string;
  createdAt: string;
  ageMinutes: number;
  health: OrderHealth;
  isInKitchen: boolean;
  estimatedReadyIn?: number;
}

interface ChannelStats {
  channel: OrderChannel;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  totalOrders: number;
  activeOrders: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  severeCount: number;
  totalValue: number;
  avgWaitTime: number;
  oldestOrderMins: number;
}

// Get order age in minutes
function getAgeMinutes(createdAt: string): number {
  const now = new Date().getTime();
  const orderTime = new Date(createdAt).getTime();
  return Math.floor((now - orderTime) / (1000 * 60));
}

// Determine order health based on age and status
function getOrderHealth(ageMinutes: number, status: string): OrderHealth {
  // Completed/delivered orders are always healthy
  if (['completed', 'delivered', 'ready'].includes(status.toLowerCase())) {
    return 'healthy';
  }

  if (ageMinutes >= TIMING.SEVERE) return 'severe';
  if (ageMinutes >= TIMING.CRITICAL) return 'critical';
  if (ageMinutes >= TIMING.WARNING) return 'warning';
  return 'healthy';
}

// Format time display
function formatTime(minutes: number): string {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default function OrderStatusDashboard() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Stores
  const {
    orders: aggregatorOrders,
    markDelivered,
    markCompleted,
  } = useAggregatorStore();
  const { activeOrders: kdsOrders } = useKDSStore();
  const { activeTables } = usePOSStore();

  // Handle marking an order as delivered/completed
  const handleMarkDelivered = useCallback((orderId: string, channel: OrderChannel) => {
    if (channel === 'swiggy' || channel === 'zomato' || channel === 'website') {
      markDelivered(orderId);
    }
  }, [markDelivered]);

  const handleMarkCompleted = useCallback((orderId: string, channel: OrderChannel) => {
    if (channel === 'swiggy' || channel === 'zomato' || channel === 'website') {
      markCompleted(orderId);
    }
  }, [markCompleted]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Unify all orders from different sources
  const unifiedOrders = useMemo((): UnifiedOrder[] => {
    const orders: UnifiedOrder[] = [];
    // currentTime is used to trigger re-computation on interval

    // 1. Dine-in orders from active tables
    Object.values(activeTables).forEach((session: TableSession) => {
      if (!session.order || session.order.items.length === 0) return;

      const ageMinutes = getAgeMinutes(session.startedAt);
      const status = session.order.status || 'pending';

      orders.push({
        id: `dine-${session.tableNumber}`,
        orderNumber: `T${session.tableNumber}`,
        channel: 'dine-in',
        channelIcon: '🪑',
        status: session.kotRecords?.length ? 'In Kitchen' : 'Pending KOT',
        items: session.order.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity })),
        total: session.order.total,
        tableNumber: session.tableNumber,
        createdAt: session.startedAt,
        ageMinutes,
        health: getOrderHealth(ageMinutes, status),
        isInKitchen: !!session.kotRecords?.length,
      });
    });

    // 2. Aggregator orders (Swiggy, Zomato, Website)
    aggregatorOrders.forEach((order: AggregatorOrder) => {
      const ageMinutes = getAgeMinutes(order.createdAt);
      const channel: OrderChannel = order.aggregator === 'swiggy' ? 'swiggy'
        : order.aggregator === 'zomato' ? 'zomato'
        : 'website';
      const channelIcon = channel === 'swiggy' ? '🟠' : channel === 'zomato' ? '🔴' : '🌐';

      // Check if order is in KDS
      const isInKitchen = kdsOrders.some(k => k.orderNumber === order.orderNumber);

      orders.push({
        id: order.orderId,
        orderNumber: order.orderNumber,
        channel,
        channelIcon,
        status: order.status,
        items: order.cart.items.map(i => ({ name: i.name, quantity: i.quantity })),
        total: order.cart.total,
        customerName: order.customer.name,
        createdAt: order.createdAt,
        ageMinutes,
        health: getOrderHealth(ageMinutes, order.status),
        isInKitchen,
      });
    });

    // 3. KDS orders that might not be in other stores (takeout/pickup)
    kdsOrders.forEach((kdsOrder: KitchenOrder) => {
      // Skip if already added from aggregator or dine-in
      const exists = orders.some(o =>
        o.orderNumber === kdsOrder.orderNumber ||
        (kdsOrder.tableNumber && o.tableNumber === kdsOrder.tableNumber)
      );

      if (!exists && kdsOrder.orderType === 'pickup') {
        const ageMinutes = getAgeMinutes(kdsOrder.createdAt);
        orders.push({
          id: kdsOrder.id,
          orderNumber: kdsOrder.orderNumber,
          channel: 'takeout',
          channelIcon: '🥡',
          status: kdsOrder.status,
          items: kdsOrder.items.map(i => ({ name: i.name, quantity: i.quantity })),
          total: 0,
          tableNumber: kdsOrder.tableNumber,
          createdAt: kdsOrder.createdAt,
          ageMinutes,
          health: getOrderHealth(ageMinutes, kdsOrder.status),
          isInKitchen: true,
        });
      }
    });

    // Sort by health severity (severe first) then by age (oldest first)
    return orders.sort((a, b) => {
      const healthOrder = { severe: 0, critical: 1, warning: 2, healthy: 3 };
      const healthDiff = healthOrder[a.health] - healthOrder[b.health];
      if (healthDiff !== 0) return healthDiff;
      return b.ageMinutes - a.ageMinutes;
    });
  }, [activeTables, aggregatorOrders, kdsOrders, currentTime]);

  // Calculate channel statistics
  const channelStats = useMemo((): ChannelStats[] => {
    const channels: OrderChannel[] = ['dine-in', 'swiggy', 'zomato', 'website', 'takeout'];
    const channelConfig: Record<OrderChannel, { icon: string; color: string; bgColor: string; borderColor: string }> = {
      'dine-in': { icon: '🪑', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/50' },
      'swiggy': { icon: '🟠', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/50' },
      'zomato': { icon: '🔴', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/50' },
      'website': { icon: '🌐', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/50' },
      'takeout': { icon: '🥡', color: 'text-teal-400', bgColor: 'bg-teal-500/10', borderColor: 'border-teal-500/50' },
    };

    return channels.map(channel => {
      const channelOrders = unifiedOrders.filter(o => o.channel === channel);
      const activeOrders = channelOrders.filter(o => !['completed', 'delivered', 'ready'].includes(o.status.toLowerCase()));

      return {
        channel,
        ...channelConfig[channel],
        totalOrders: channelOrders.length,
        activeOrders: activeOrders.length,
        healthyCount: activeOrders.filter(o => o.health === 'healthy').length,
        warningCount: activeOrders.filter(o => o.health === 'warning').length,
        criticalCount: activeOrders.filter(o => o.health === 'critical').length,
        severeCount: activeOrders.filter(o => o.health === 'severe').length,
        totalValue: channelOrders.reduce((sum, o) => sum + o.total, 0),
        avgWaitTime: activeOrders.length > 0
          ? Math.round(activeOrders.reduce((sum, o) => sum + o.ageMinutes, 0) / activeOrders.length)
          : 0,
        oldestOrderMins: activeOrders.length > 0
          ? Math.max(...activeOrders.map(o => o.ageMinutes))
          : 0,
      };
    }).filter(s => s.totalOrders > 0 || s.channel === 'dine-in'); // Always show dine-in
  }, [unifiedOrders]);

  // Overall health score
  const overallHealth = useMemo(() => {
    const severeCount = unifiedOrders.filter(o => o.health === 'severe').length;
    const criticalCount = unifiedOrders.filter(o => o.health === 'critical').length;
    const warningCount = unifiedOrders.filter(o => o.health === 'warning').length;

    if (severeCount > 0) return { status: 'CRITICAL', color: 'text-red-500', bgColor: 'bg-red-500/20', borderColor: 'border-red-500' };
    if (criticalCount > 0) return { status: 'ATTENTION', color: 'text-orange-500', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500' };
    if (warningCount > 0) return { status: 'MONITOR', color: 'text-yellow-500', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500' };
    return { status: 'HEALTHY', color: 'text-emerald-500', bgColor: 'bg-emerald-500/20', borderColor: 'border-emerald-500' };
  }, [unifiedOrders]);

  // Filter active orders only
  const activeOrders = unifiedOrders.filter(o =>
    !['completed', 'delivered', 'ready'].includes(o.status.toLowerCase())
  );

  const getHealthColor = (health: OrderHealth) => {
    switch (health) {
      case 'severe': return 'border-red-500 bg-red-500/20 animate-pulse';
      case 'critical': return 'border-orange-500 bg-orange-500/10';
      case 'warning': return 'border-yellow-500 bg-yellow-500/10';
      default: return 'border-zinc-700 bg-zinc-800/50';
    }
  };

  const getHealthTextColor = (health: OrderHealth) => {
    switch (health) {
      case 'severe': return 'text-red-400';
      case 'critical': return 'text-orange-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-emerald-400';
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col overflow-hidden select-none">
      {/* ========== TOP STATUS BAR ========== */}
      <header className={cn(
        "h-20 flex-shrink-0 px-6 flex items-center justify-between border-b-2",
        overallHealth.bgColor,
        overallHealth.borderColor
      )}>
        {/* Left: Status Indicator */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "px-4 py-2 rounded-xl border-2 font-black uppercase tracking-wider",
            overallHealth.color,
            overallHealth.borderColor,
            overallHealth.bgColor
          )}>
            <div className="flex items-center gap-2">
              {overallHealth.status === 'CRITICAL' && (
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              )}
              <span className="text-xl">{overallHealth.status}</span>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black text-white">ORDER STATUS</h1>
            <p className="text-xs text-zinc-500 font-mono">
              {currentTime.toLocaleTimeString()} · Auto-refresh 10s
            </p>
          </div>
        </div>

        {/* Center: Quick Stats */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-black text-white">{activeOrders.length}</div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Active</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-yellow-400">
              {unifiedOrders.filter(o => o.health === 'warning').length}
            </div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Warning</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-orange-400">
              {unifiedOrders.filter(o => o.health === 'critical').length}
            </div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Critical</div>
          </div>
          <div className="text-center">
            <div className={cn(
              "text-3xl font-black",
              unifiedOrders.filter(o => o.health === 'severe').length > 0 ? "text-red-500 animate-pulse" : "text-red-400"
            )}>
              {unifiedOrders.filter(o => o.health === 'severe').length}
            </div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Severe</div>
          </div>
        </div>

        {/* Right: Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/pos')}
            className="h-12 px-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold text-sm hover:bg-zinc-700 transition-colors"
          >
            🍽️ POS
          </button>
          <button
            onClick={() => navigate('/kitchen')}
            className="h-12 px-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold text-sm hover:bg-zinc-700 transition-colors"
          >
            👨‍🍳 Kitchen
          </button>
          <button
            onClick={() => navigate('/manager')}
            className="h-12 px-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold text-sm hover:bg-zinc-700 transition-colors"
          >
            📊 Manager
          </button>
        </div>
      </header>

      {/* ========== CHANNEL SUMMARY BAR ========== */}
      <div className="flex-shrink-0 p-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex gap-4 overflow-x-auto">
          {channelStats.map((stat) => (
            <div
              key={stat.channel}
              className={cn(
                "flex-shrink-0 p-4 rounded-xl border-2 min-w-[200px]",
                stat.bgColor,
                stat.borderColor,
                stat.severeCount > 0 && "animate-pulse"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className={cn("font-black uppercase", stat.color)}>
                    {stat.channel === 'dine-in' ? 'Dine-In' : stat.channel}
                  </span>
                </div>
                <div className="text-2xl font-black text-white">{stat.activeOrders}</div>
              </div>

              {/* Health indicators */}
              <div className="flex gap-2 mb-2">
                {stat.healthyCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    {stat.healthyCount} OK
                  </span>
                )}
                {stat.warningCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                    {stat.warningCount} WARN
                  </span>
                )}
                {stat.criticalCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-xs font-bold animate-pulse">
                    {stat.criticalCount} CRIT
                  </span>
                )}
                {stat.severeCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-red-500/30 text-red-400 text-xs font-black animate-pulse">
                    {stat.severeCount} SEVERE
                  </span>
                )}
              </div>

              {/* Timing info */}
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Avg wait:</span>
                <span className={cn(
                  "font-bold",
                  stat.avgWaitTime >= TIMING.CRITICAL ? "text-red-400" :
                  stat.avgWaitTime >= TIMING.WARNING ? "text-yellow-400" : "text-emerald-400"
                )}>
                  {formatTime(stat.avgWaitTime)}
                </span>
              </div>
              {stat.oldestOrderMins > 0 && (
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-zinc-500">Oldest:</span>
                  <span className={cn(
                    "font-bold",
                    stat.oldestOrderMins >= TIMING.SEVERE ? "text-red-400 animate-pulse" :
                    stat.oldestOrderMins >= TIMING.CRITICAL ? "text-orange-400" :
                    stat.oldestOrderMins >= TIMING.WARNING ? "text-yellow-400" : "text-emerald-400"
                  )}>
                    {formatTime(stat.oldestOrderMins)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ========== MAIN ORDER GRID - Auto-scrolling ========== */}
      <main className="flex-1 overflow-auto p-4 bg-[#0a0a0a]">
        {activeOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <span className="text-8xl mb-4 opacity-30">✅</span>
            <h2 className="text-2xl font-black text-emerald-400">ALL CLEAR</h2>
            <p className="text-zinc-500 mt-2">No active orders at the moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {activeOrders.map((order) => (
              <div
                key={order.id}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all",
                  getHealthColor(order.health)
                )}
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{order.channelIcon}</span>
                      <span className="text-lg font-black text-white">#{order.orderNumber}</span>
                    </div>
                    {order.tableNumber && (
                      <div className="text-xs text-zinc-500 font-mono">Table {order.tableNumber}</div>
                    )}
                    {order.customerName && (
                      <div className="text-xs text-zinc-500 truncate max-w-[120px]">{order.customerName}</div>
                    )}
                  </div>

                  {/* Time Badge */}
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-center",
                    order.health === 'severe' ? "bg-red-500 animate-pulse" :
                    order.health === 'critical' ? "bg-orange-500" :
                    order.health === 'warning' ? "bg-yellow-500" : "bg-zinc-700"
                  )}>
                    <div className="text-lg font-black text-white">{order.ageMinutes}</div>
                    <div className="text-[8px] font-bold text-white/80 uppercase">min</div>
                  </div>
                </div>

                {/* Status */}
                <div className={cn(
                  "text-xs font-bold uppercase tracking-wide mb-2",
                  getHealthTextColor(order.health)
                )}>
                  {order.isInKitchen ? '👨‍🍳 In Kitchen' : '⏳ ' + order.status}
                </div>

                {/* Items Preview */}
                <div className="space-y-1 text-xs text-zinc-400 max-h-16 overflow-hidden">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate flex-1">{item.quantity}× {item.name}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="text-zinc-600">+{order.items.length - 3} more</div>
                  )}
                </div>

                {/* Total */}
                {order.total > 0 && (
                  <div className="mt-3 pt-2 border-t border-zinc-700/50 flex justify-between">
                    <span className="text-xs text-zinc-500">Total</span>
                    <span className="font-bold text-white font-mono">₹{order.total.toFixed(0)}</span>
                  </div>
                )}

                {/* Alert Banner for Severe */}
                {order.health === 'severe' && (
                  <div className="mt-3 p-2 bg-red-500/30 rounded-lg text-center">
                    <span className="text-xs font-black text-red-400 uppercase animate-pulse">
                      ⚠️ CUSTOMER WAITING {order.ageMinutes}+ MINS
                    </span>
                  </div>
                )}

                {/* Action Buttons for Aggregator Orders */}
                {(order.channel === 'swiggy' || order.channel === 'zomato' || order.channel === 'website') && (
                  <div className="mt-3 pt-2 border-t border-zinc-700/50 flex gap-2">
                    {order.status === 'ready' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkDelivered(order.id, order.channel);
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                      >
                        ✓ Delivered
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkCompleted(order.id, order.channel);
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ========== BOTTOM ALERT BAR (if severe issues) ========== */}
      {unifiedOrders.some(o => o.health === 'severe') && (
        <div className="flex-shrink-0 h-16 bg-red-500/30 border-t-2 border-red-500 flex items-center justify-center animate-pulse">
          <span className="text-xl font-black text-red-400 uppercase tracking-wider flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            IMMEDIATE ATTENTION REQUIRED - CUSTOMERS WAITING OVER {TIMING.SEVERE} MINUTES
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
          </span>
        </div>
      )}
    </div>
  );
}
