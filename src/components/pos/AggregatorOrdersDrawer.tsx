/**
 * Aggregator Orders Drawer
 * Shows active Swiggy/Zomato orders with status and actions
 * Displays in POS Dashboard header area
 */

import { X, Package, ChefHat, Clock, CheckCircle, Truck, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAggregatorStore } from '../../stores/aggregatorStore';
import { useKDSStore } from '../../stores/kdsStore';
import { useAuthStore } from '../../stores/authStore';
import { AggregatorOrder, AggregatorOrderStatus } from '../../types/aggregator';

interface AggregatorOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Status configuration for display
const statusConfig: Record<AggregatorOrderStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}> = {
  pending: {
    label: 'NEW',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20 border-amber-500/50',
    icon: <AlertCircle size={14} />
  },
  confirmed: {
    label: 'CONFIRMED',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20 border-blue-500/50',
    icon: <CheckCircle size={14} />
  },
  preparing: {
    label: 'PREPARING',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20 border-orange-500/50',
    icon: <ChefHat size={14} />
  },
  ready: {
    label: 'READY',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20 border-emerald-500/50',
    icon: <CheckCircle size={14} />
  },
  pending_pickup: {
    label: 'AWAITING PICKUP',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20 border-purple-500/50',
    icon: <Clock size={14} />
  },
  picked_up: {
    label: 'PICKED UP',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20 border-cyan-500/50',
    icon: <Truck size={14} />
  },
  out_for_delivery: {
    label: 'OUT FOR DELIVERY',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20 border-indigo-500/50',
    icon: <Truck size={14} />
  },
  delivered: {
    label: 'DELIVERED',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20 border-gray-500/50',
    icon: <CheckCircle size={14} />
  },
  completed: {
    label: 'COMPLETED',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20 border-gray-500/50',
    icon: <CheckCircle size={14} />
  },
  cancelled: {
    label: 'CANCELLED',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20 border-red-500/50',
    icon: <X size={14} />
  },
};

function OrderCard({ order, onAction }: { order: AggregatorOrder; onAction: (action: string) => void }) {
  const config = statusConfig[order.status] || statusConfig.pending;
  const isSwiggy = order.aggregator === 'swiggy';
  const platformColor = isSwiggy ? 'bg-orange-500' : 'bg-red-500';

  // Check KDS for this order's kitchen status
  const { activeOrders: kdsOrders } = useKDSStore();
  const kdsOrder = kdsOrders.find(
    ko => ko.orderNumber === order.orderNumber ||
    ko.id?.includes(order.orderId)
  );

  // Get ready items count from KDS
  const readyItems = kdsOrder?.items.filter(item => item.status === 'ready').length || 0;
  const totalItems = kdsOrder?.items.length || order.cart.items.length;
  const allReady = kdsOrder && readyItems === totalItems && totalItems > 0;

  // Time since order
  const orderTime = new Date(order.createdAt);
  const minutesAgo = Math.floor((Date.now() - orderTime.getTime()) / 60000);
  const timeDisplay = minutesAgo < 60
    ? `${minutesAgo}m ago`
    : `${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}m ago`;

  return (
    <div className={cn(
      "p-3 rounded-xl border-2 transition-all",
      config.bgColor
    )}>
      {/* Header: Platform badge, Order #, Time */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-6 h-6 rounded flex items-center justify-center text-white text-xs font-black",
            platformColor
          )}>
            {isSwiggy ? 'S' : 'Z'}
          </span>
          <span className="font-black text-white text-lg">#{order.orderNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{timeDisplay}</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1",
            config.bgColor, config.color
          )}>
            {config.icon}
            {config.label}
          </span>
        </div>
      </div>

      {/* Customer */}
      <div className="text-sm text-zinc-400 mb-2">
        {order.customer.name}
        {order.customer.phone && <span className="text-zinc-600"> • {order.customer.phone}</span>}
      </div>

      {/* Items summary */}
      <div className="text-sm text-zinc-300 mb-2">
        {order.cart.items.slice(0, 3).map((item, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{item.quantity}× {item.name}</span>
            <span className="text-zinc-500">₹{item.total || (item.price * item.quantity)}</span>
          </div>
        ))}
        {order.cart.items.length > 3 && (
          <div className="text-zinc-500 text-xs">+{order.cart.items.length - 3} more items</div>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
        <span className="text-zinc-500 text-sm">Total</span>
        <span className="font-black text-emerald-400 text-lg">₹{order.cart.total.toFixed(0)}</span>
      </div>

      {/* KDS Progress (if in kitchen) */}
      {kdsOrder && (
        <div className="mt-2 pt-2 border-t border-zinc-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Kitchen Progress</span>
            <span className={allReady ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {readyItems}/{totalItems} items ready
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-700 rounded-full mt-1 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allReady ? "bg-emerald-500" : "bg-amber-500"
              )}
              style={{ width: `${(readyItems / totalItems) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions based on status */}
      <div className="mt-3 flex gap-2">
        {order.status === 'pending' && (
          <button
            onClick={() => onAction('accept')}
            className="flex-1 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-400 transition-all"
          >
            Accept Order
          </button>
        )}

        {(order.status === 'confirmed' || order.status === 'preparing') && allReady && (
          <button
            onClick={() => onAction('ready')}
            className="flex-1 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-400 transition-all animate-pulse"
          >
            Mark Ready for Pickup
          </button>
        )}

        {order.status === 'pending_pickup' && (
          <button
            onClick={() => onAction('picked_up')}
            className="flex-1 py-2 rounded-lg bg-purple-500 text-white font-bold text-sm hover:bg-purple-400 transition-all"
          >
            Rider Picked Up
          </button>
        )}

        {order.status === 'picked_up' && (
          <button
            onClick={() => onAction('completed')}
            className="flex-1 py-2 rounded-lg bg-zinc-600 text-white font-bold text-sm hover:bg-zinc-500 transition-all"
          >
            Complete & Dismiss
          </button>
        )}

        {/* Dismiss button for any status */}
        {order.status !== 'pending' && (
          <button
            onClick={() => onAction('dismiss')}
            className="px-3 py-2 rounded-lg bg-zinc-700 text-zinc-400 text-sm hover:bg-zinc-600 hover:text-white transition-all"
            title="Dismiss order"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AggregatorOrdersDrawer({ isOpen, onClose }: AggregatorOrdersDrawerProps) {
  const { user } = useAuthStore();
  const {
    orders,
    acceptOrder,
    markReady,
    markPickedUp,
    markCompleted,
    dismissOrder,
    getStats
  } = useAggregatorStore();

  const stats = getStats();

  // Filter to show only active orders (not delivered/completed/cancelled)
  const activeOrders = orders.filter(o =>
    !['delivered', 'completed', 'cancelled'].includes(o.status)
  ).sort((a, b) => {
    // Sort by status priority: pending first, then preparing, then ready
    const priority: Record<string, number> = {
      pending: 0,
      confirmed: 1,
      preparing: 2,
      ready: 3,
      pending_pickup: 4,
      picked_up: 5,
    };
    return (priority[a.status] || 99) - (priority[b.status] || 99);
  });

  const handleAction = async (orderId: string, action: string) => {
    switch (action) {
      case 'accept':
        await acceptOrder(orderId);
        break;
      case 'ready':
        await markReady(orderId, user?.tenantId);
        break;
      case 'picked_up':
        await markPickedUp(orderId);
        break;
      case 'completed':
        await markCompleted(orderId);
        break;
      case 'dismiss':
        await dismissOrder(orderId);
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-20 right-4 w-96 max-h-[calc(100vh-120px)] bg-zinc-900 border-2 border-zinc-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="text-orange-400" size={24} />
              <div>
                <h2 className="font-black text-white uppercase tracking-wide">Aggregator Orders</h2>
                <p className="text-xs text-zinc-500">Swiggy & Zomato</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-400 hover:bg-zinc-600 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-2 mt-3">
            {stats.new > 0 && (
              <span className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/50 text-amber-400 text-xs font-bold">
                {stats.new} NEW
              </span>
            )}
            {stats.preparing > 0 && (
              <span className="px-2 py-1 rounded bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs font-bold">
                {stats.preparing} PREPARING
              </span>
            )}
            {stats.ready > 0 && (
              <span className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-xs font-bold animate-pulse">
                {stats.ready} READY
              </span>
            )}
            {stats.pendingPickup > 0 && (
              <span className="px-2 py-1 rounded bg-purple-500/20 border border-purple-500/50 text-purple-400 text-xs font-bold">
                {stats.pendingPickup} PICKUP
              </span>
            )}
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <Package size={48} className="mb-3 opacity-30" />
              <p className="font-bold uppercase tracking-wide">No Active Orders</p>
              <p className="text-xs text-zinc-700 mt-1">Orders from Swiggy/Zomato will appear here</p>
            </div>
          ) : (
            activeOrders.map(order => (
              <OrderCard
                key={order.orderId}
                order={order}
                onAction={(action) => handleAction(order.orderId, action)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
