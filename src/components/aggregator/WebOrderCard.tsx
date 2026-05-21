/**
 * WebOrderCard
 * Dark zinc card for web/direct orders in the delivery screen.
 * Matches the OnlineOrdersDrawer POS card style.
 */

import { Truck, ShoppingBag, Phone, CheckCircle, Archive } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AggregatorOrder } from '../../types/aggregator';

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending:          { label: 'NEW ORDER',  color: 'text-amber-400',   bgColor: 'bg-amber-500/20 border-amber-500/50' },
  confirmed:        { label: 'CONFIRMED',  color: 'text-blue-400',    bgColor: 'bg-blue-500/20 border-blue-500/50' },
  preparing:        { label: 'PREPARING',  color: 'text-orange-400',  bgColor: 'bg-orange-500/20 border-orange-500/50' },
  ready:            { label: 'READY',      color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/50' },
  out_for_delivery: { label: 'ON THE WAY', color: 'text-purple-400',  bgColor: 'bg-purple-500/20 border-purple-500/50' },
  delivered:        { label: 'DELIVERED',  color: 'text-cyan-400',    bgColor: 'bg-cyan-500/20 border-cyan-500/50' },
  completed:        { label: 'DONE',       color: 'text-zinc-400',    bgColor: 'bg-zinc-500/20 border-zinc-500/50' },
  cancelled:        { label: 'CANCELLED',  color: 'text-red-400',     bgColor: 'bg-red-500/20 border-red-500/50' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function elapsedMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export interface WebOrderCardProps {
  order: AggregatorOrder;
  onMarkReady?: (orderId: string) => void;
  onMarkOutForDelivery?: (orderId: string) => void;
  onMarkDelivered?: (orderId: string) => void;
  onMarkCompleted?: (orderId: string) => void;
  isProcessing?: boolean;
}

export function WebOrderCard({
  order,
  onMarkReady,
  onMarkOutForDelivery,
  onMarkDelivered,
  onMarkCompleted,
  isProcessing = false,
}: WebOrderCardProps) {
  const cfg = statusConfig[order.status] ?? statusConfig.confirmed;
  const elapsed = elapsedMinutes(order.createdAt);

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          {order.orderType === 'delivery' ? (
            <Truck size={14} className="text-purple-400" />
          ) : (
            <ShoppingBag size={14} className="text-blue-400" />
          )}
          <span className="font-black text-white text-sm">#{order.orderNumber}</span>
          <span className="text-zinc-400 text-xs">{order.orderType.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-xs">{formatTime(order.createdAt)} · {elapsed}m ago</span>
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-black border', cfg.color, cfg.bgColor)}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Customer */}
      <div className="px-3 py-2 bg-zinc-900 flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-semibold">{order.customer.name}</p>
          {order.customer.phone && (
            <p className="text-zinc-400 text-xs flex items-center gap-1 mt-0.5">
              <Phone size={10} /> {order.customer.phone}
            </p>
          )}
          {order.customer.address && (
            <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{order.customer.address}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-white font-black text-base">₹{order.cart.total.toFixed(0)}</p>
          <p className="text-zinc-400 text-xs">
            {order.payment.isPrepaid ? '✓ PAID' : order.payment.method.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="px-3 py-2 bg-zinc-950/50 space-y-1 max-h-32 overflow-y-auto">
        {order.cart.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">
              <span className="text-amber-400 font-bold mr-1">{item.quantity}×</span>
              {item.name}
            </span>
            {item.total > 0 && (
              <span className="text-zinc-400 text-xs">₹{item.total.toFixed(0)}</span>
            )}
          </div>
        ))}
        {order.specialInstructions && (
          <p className="text-amber-400/80 text-xs italic mt-1">📝 {order.specialInstructions}</p>
        )}
      </div>

      {/* Actions / Status footer */}
      {(order.status === 'confirmed' || order.status === 'preparing') && onMarkReady && (
        <div className="p-2 bg-zinc-900 border-t border-zinc-700/50">
          <button
            onClick={() => onMarkReady(order.orderId)}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors"
          >
            <CheckCircle size={15} /> Mark Ready
          </button>
        </div>
      )}

      {order.status === 'ready' && order.orderType === 'delivery' && onMarkOutForDelivery && (
        <div className="p-2 bg-zinc-900 border-t border-zinc-700/50">
          <button
            onClick={() => onMarkOutForDelivery(order.orderId)}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors"
          >
            <Truck size={15} /> Out for Delivery
          </button>
        </div>
      )}

      {order.status === 'ready' && order.orderType !== 'delivery' && onMarkCompleted && (
        <div className="p-2 bg-zinc-900 border-t border-zinc-700/50">
          <button
            onClick={() => onMarkCompleted(order.orderId)}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors"
          >
            <CheckCircle size={15} /> Picked Up
          </button>
        </div>
      )}

      {order.status === 'out_for_delivery' && onMarkDelivered && (
        <div className="p-2 bg-zinc-900 border-t border-zinc-700/50">
          <button
            onClick={() => onMarkDelivered(order.orderId)}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors"
          >
            <CheckCircle size={15} /> Mark Delivered
          </button>
        </div>
      )}

      {order.status === 'delivered' && onMarkCompleted && (
        <div className="p-2 bg-zinc-900 border-t border-zinc-700/50">
          <button
            onClick={() => onMarkCompleted(order.orderId)}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 text-sm font-bold rounded transition-colors"
          >
            <Archive size={15} /> Archive
          </button>
        </div>
      )}
    </div>
  );
}
