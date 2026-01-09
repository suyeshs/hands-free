/**
 * OrderBottomSheet Component
 * Mobile-friendly bottom sheet for order management on compact screens
 * Shows collapsed bar with total, expands to show full order
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { usePOSStore } from '../../stores/posStore';
import { CartItem } from '../../types/pos';
import { ChevronUp, ChevronDown, X, Trash2 } from 'lucide-react';

interface OrderBottomSheetProps {
  cart: CartItem[];
  grandTotal: number;
  activeTableOrder?: {
    items: CartItem[];
    total: number;
  } | null;
  tableNumber: number | null;
  orderType: 'dine-in' | 'takeout' | 'delivery';
  canGenerateBill: boolean;
  isOrderBilled?: boolean;  // Whether the bill has been printed (awaiting payment)
  onSendToKitchen: () => void;
  onBill: () => void;
  onPayment?: () => void;  // Called when clicking payment button for billed orders
  itemStatuses?: Map<string, string>;
  orderStatus?: { status: string | null; readyItemCount: number; totalItemCount: number; hasRunningOrder?: boolean };
  areAllKotsCompleted?: boolean;
}

export function OrderBottomSheet({
  cart,
  grandTotal,
  activeTableOrder,
  tableNumber,
  orderType,
  canGenerateBill,
  isOrderBilled = false,
  onSendToKitchen,
  onBill,
  onPayment,
  itemStatuses,
  orderStatus,
  areAllKotsCompleted,
}: OrderBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { removeFromCart } = usePOSStore();

  // Calculate cart item count
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const activeItemCount = activeTableOrder?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalItemCount = cartItemCount + activeItemCount;

  // Close sheet when clicking outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  // Get status display for items
  const getStatusDisplay = (itemName: string) => {
    const status = itemStatuses?.get(itemName) || 'pending';
    switch (status) {
      case 'ready':
        return { text: 'READY', color: 'text-emerald-400', bgColor: 'bg-emerald-500' };
      case 'in_progress':
        return { text: 'PREP', color: 'text-blue-400', bgColor: 'bg-blue-500' };
      default:
        return { text: 'WAIT', color: 'text-amber-400', bgColor: 'bg-amber-500' };
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ease-out",
          isExpanded ? "translate-y-0" : "translate-y-[calc(100%-80px)]"
        )}
      >
        {/* Main Sheet Container */}
        <div className="bg-zinc-900 border-t-2 border-zinc-700 rounded-t-3xl shadow-2xl shadow-black/50">
          {/* Drag Handle / Collapsed Bar */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {/* Item Count Badge */}
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg",
                totalItemCount > 0
                  ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                  : "bg-zinc-800 border-2 border-zinc-700 text-zinc-500"
              )}>
                {totalItemCount}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                  {totalItemCount === 0 ? 'No Items' : totalItemCount === 1 ? '1 Item' : `${totalItemCount} Items`}
                </div>
                {tableNumber && orderType === 'dine-in' && (
                  <div className="text-xs text-emerald-400 font-mono">Table {tableNumber}</div>
                )}
              </div>
            </div>

            {/* Total and Expand Button */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-zinc-500 uppercase">Total</div>
                <div className="text-xl font-black text-white font-mono">Rs.{grandTotal.toFixed(0)}</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                {isExpanded ? (
                  <ChevronDown size={18} className="text-zinc-400" />
                ) : (
                  <ChevronUp size={18} className="text-zinc-400" />
                )}
              </div>
            </div>
          </button>

          {/* Expanded Content */}
          <div className={cn(
            "overflow-hidden transition-all duration-300",
            isExpanded ? "max-h-[60vh] opacity-100" : "max-h-0 opacity-0"
          )}>
            {/* Scrollable Order Items */}
            <div className="px-4 pb-2 max-h-[40vh] overflow-y-auto space-y-3">
              {/* NEW ITEMS */}
              {cart.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    NEW ({cartItemCount})
                  </div>
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 bg-zinc-800 rounded-xl border border-emerald-500/30"
                    >
                      <span className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-xs font-black text-emerald-400">
                        {item.quantity}
                      </span>
                      <span className="flex-1 text-sm font-bold text-white truncate">{item.menuItem.name}</span>
                      <span className="font-mono text-emerald-400 text-sm">Rs.{item.subtotal.toFixed(0)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.id);
                        }}
                        className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center"
                      >
                        <X size={12} className="text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ACTIVE ORDER ITEMS */}
              {activeTableOrder && activeTableOrder.items.length > 0 && (
                <div className="space-y-2">
                  <div className={cn(
                    "text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                    areAllKotsCompleted ? "text-emerald-400" : orderStatus?.status === 'in_progress' ? "text-blue-400" : "text-amber-400"
                  )}>
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      areAllKotsCompleted ? "bg-emerald-400" : orderStatus?.status === 'in_progress' ? "bg-blue-400 animate-pulse" : "bg-amber-400 animate-pulse"
                    )} />
                    {areAllKotsCompleted ? 'SERVED' : 'IN KITCHEN'} ({activeItemCount})
                  </div>
                  {activeTableOrder.items.map((item, idx) => {
                    const status = getStatusDisplay(item.menuItem.name);
                    return (
                      <div
                        key={`active-${idx}`}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-xl border",
                          areAllKotsCompleted
                            ? "bg-emerald-500/5 border-emerald-500/30"
                            : status.text === 'READY'
                              ? "bg-emerald-500/5 border-emerald-500/30"
                              : status.text === 'PREP'
                                ? "bg-blue-500/5 border-blue-500/30"
                                : "bg-amber-500/5 border-amber-500/30"
                        )}
                      >
                        <span className={cn("w-6 h-6 rounded flex items-center justify-center text-xs font-black", status.bgColor + "/20 border " + status.bgColor + "/50", status.color)}>
                          {item.quantity}
                        </span>
                        <span className="flex-1 text-sm font-bold text-white truncate">{item.menuItem.name}</span>
                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded", status.bgColor + "/20", status.color)}>
                          {areAllKotsCompleted ? 'DONE' : status.text}
                        </span>
                        <span className={cn("font-mono text-sm", status.color)}>Rs.{item.subtotal.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty State */}
              {cart.length === 0 && (!activeTableOrder || activeTableOrder.items.length === 0) && (
                <div className="py-8 text-center text-zinc-600">
                  <span className="text-4xl mb-2 block opacity-30">📋</span>
                  <p className="text-xs font-bold uppercase tracking-wider">Add items to order</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-zinc-800 space-y-3">
              {/* Total Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 rounded-xl">
                <span className="font-bold text-zinc-400 uppercase text-sm">Grand Total</span>
                <span className="text-2xl font-black text-white font-mono">Rs.{grandTotal.toFixed(0)}</span>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={cart.length === 0}
                  onClick={() => {
                    onSendToKitchen();
                    setIsExpanded(false);
                  }}
                  className={cn(
                    "h-12 rounded-xl font-black uppercase tracking-wide text-sm transition-all border-2",
                    cart.length === 0
                      ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
                      : "bg-amber-500/20 border-amber-500 text-amber-400 active:scale-95"
                  )}
                >
                  SEND KOT
                </button>
                {isOrderBilled ? (
                  <button
                    onClick={() => {
                      onPayment?.();
                      setIsExpanded(false);
                    }}
                    className="h-12 rounded-xl font-black uppercase tracking-wide text-sm transition-all border-2 bg-pink-500 border-pink-400 text-white active:scale-95 shadow-lg shadow-pink-500/30"
                  >
                    💳 PAYMENT
                  </button>
                ) : (
                  <button
                    disabled={!canGenerateBill}
                    onClick={() => {
                      onBill();
                      setIsExpanded(false);
                    }}
                    className={cn(
                      "h-12 rounded-xl font-black uppercase tracking-wide text-sm transition-all border-2",
                      canGenerateBill
                        ? "bg-emerald-500 border-emerald-400 text-white active:scale-95 shadow-lg shadow-emerald-500/30"
                        : "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
                    )}
                  >
                    BILL
                  </button>
                )}
              </div>

              {/* Clear Cart */}
              {cart.length > 0 && (
                <button
                  onClick={() => usePOSStore.getState().clearCart()}
                  className="w-full py-2 text-red-400 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Clear New Items
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default OrderBottomSheet;
