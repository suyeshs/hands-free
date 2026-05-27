/**
 * Online Orders Drawer
 * Shows pending web/app orders waiting for staff confirmation before going to KDS
 */

import { useState, useEffect } from 'react';
import { X, Globe, CheckCircle, XCircle, Clock, Truck, ShoppingBag, AlertCircle, Phone, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOnlineOrderStore } from '../../stores/onlineOrderStore';
import type { OnlineOrder, OnlineOrderStatus } from '../../types/online';

// Orders older than this are stale — can't be actioned
const STALE_HOURS = 8;

interface OnlineOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusConfig: Record<OnlineOrderStatus, { label: string; color: string; bgColor: string }> = {
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
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function elapsedMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

interface OrderCardProps {
  order: OnlineOrder;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}

function OrderCard({ order, onConfirm, onReject }: OrderCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const { confirmOrder, rejectOrder } = useOnlineOrderStore();
  const cfg = statusConfig[order.status] ?? statusConfig.pending;
  const elapsed = elapsedMinutes(order.createdAt);
  const isUrgent = elapsed > 5 && order.status === 'pending';

  const handleConfirm = async () => {
    await confirmOrder(order.id, 20);
    onConfirm(order.id);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    await rejectOrder(order.id, rejectReason);
    setRejecting(false);
    onReject(order.id);
  };

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden mb-3',
      isUrgent ? 'border-red-500/70 animate-pulse' : 'border-zinc-700',
    )}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-3 py-2 border-b border-zinc-700/50', isUrgent ? 'bg-red-500/10' : 'bg-zinc-800')}>
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
          {isUrgent && <AlertCircle size={13} className="text-red-400" />}
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
        </div>
        <div className="text-right">
          <p className="text-white font-black text-base">₹{order.cart.total.toFixed(0)}</p>
          <p className="text-zinc-400 text-xs">
            {order.payment.isPrepaid ? '✓ PAID' : order.payment.method.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Delivery address */}
      {order.orderType === 'delivery' && order.deliveryAddress && (
        <div className="px-3 py-2 bg-zinc-900/70 border-t border-zinc-700/50 flex items-start gap-1.5">
          <MapPin size={11} className="text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-zinc-300 leading-snug">
            {order.deliveryAddress.addressLine2 && (
              <span className="font-semibold text-white">{order.deliveryAddress.addressLine2}, </span>
            )}
            {order.deliveryAddress.addressLine1}
            {order.deliveryAddress.city && `, ${order.deliveryAddress.city}`}
            {order.deliveryAddress.postalCode && ` – ${order.deliveryAddress.postalCode}`}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="px-3 py-2 bg-zinc-950/50 space-y-1 max-h-32 overflow-y-auto">
        {order.cart.items.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">
                <span className="text-amber-400 font-bold mr-1">{item.quantity}×</span>
                {item.name}
              </span>
              <span className="text-zinc-400 text-xs">₹{item.total.toFixed(0)}</span>
            </div>
            {item.variants && item.variants.length > 0 && (
              <p className="text-xs text-zinc-500 ml-5 mt-0.5">{item.variants.join(', ')}</p>
            )}
          </div>
        ))}
        {order.specialInstructions && (
          <p className="text-amber-400/80 text-xs italic mt-1">📝 {order.specialInstructions}</p>
        )}
      </div>

      {/* Actions */}
      {order.status === 'pending' && !rejecting && (
        <div className="flex gap-2 p-2 bg-zinc-900 border-t border-zinc-700/50">
          <button
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded transition-colors"
          >
            <CheckCircle size={15} /> ACCEPT
          </button>
          <button
            onClick={() => setRejecting(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 text-sm font-bold rounded border border-red-600/50 transition-colors"
          >
            <XCircle size={15} /> REJECT
          </button>
        </div>
      )}

      {order.status === 'pending' && rejecting && (
        <div className="p-2 bg-zinc-900 border-t border-zinc-700/50 space-y-2">
          <input
            autoFocus
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold rounded transition-colors"
            >
              Confirm Reject
            </button>
            <button
              onClick={() => { setRejecting(false); setRejectReason(''); }}
              className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {order.status === 'confirmed' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border-t border-blue-500/20">
          <Clock size={13} className="text-blue-400" />
          <span className="text-blue-400 text-xs font-semibold">Sent to kitchen — preparing</span>
        </div>
      )}
    </div>
  );
}

export function OnlineOrdersDrawer({ isOpen, onClose }: OnlineOrdersDrawerProps) {
  const { orders, fetchFromCloud } = useOnlineOrderStore();

  // Trigger an immediate refresh when the drawer opens so the list is always
  // up-to-date the moment staff looks at it (background polling runs every 30 s
  // via WebSocketManager regardless of drawer state).
  useEffect(() => {
    if (isOpen) fetchFromCloud();
  }, [isOpen, fetchFromCloud]);

  const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000;
  // Only show orders awaiting staff confirmation — confirmed+ orders move to the delivery screen
  const activeOrders = orders.filter(
    (o) =>
      o.status === 'pending' &&
      new Date(o.createdAt).getTime() >= cutoff
  );
  const pendingCount = activeOrders.filter((o) => o.status === 'pending').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-sm h-full bg-zinc-900 border-l border-zinc-700 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-blue-400" />
            <span className="font-black text-white text-sm">WEB ORDERS</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-black animate-pulse">
                {pendingCount} NEW
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-700 text-zinc-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500">
              <Globe size={40} className="opacity-30" />
              <p className="text-sm font-semibold">No active web orders</p>
              <p className="text-xs text-center opacity-70">Orders placed on your website will appear here for confirmation</p>
            </div>
          ) : (
            activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onConfirm={() => {}}
                onReject={() => {}}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
