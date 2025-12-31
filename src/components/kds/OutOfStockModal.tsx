/**
 * Out of Stock Modal
 * Used by kitchen staff to mark an item as "86" with portion count
 */

import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface OutOfStockModalProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  orderContext?: {
    orderId: string;
    orderNumber: string;
    tableNumber?: number;
  };
  onConfirm: (portionsOut: number) => void;
}

export function OutOfStockModal({
  open,
  onClose,
  itemName,
  orderContext,
  onConfirm,
}: OutOfStockModalProps) {
  const [portions, setPortions] = useState(1);

  // Reset portions when modal opens
  useEffect(() => {
    if (open) {
      setPortions(1);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(portions);
    onClose();
  };

  const handleAllOut = () => {
    onConfirm(-1); // -1 indicates "all out"
    onClose();
  };

  const increment = () => setPortions((p) => Math.min(p + 1, 99));
  const decrement = () => setPortions((p) => Math.max(p - 1, 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - clicking does NOT close (kitchen hands might be messy) */}
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm" />

      {/* Modal Content */}
      <div className="relative w-full max-w-md transform">
        <div className="bg-slate-900 border-4 border-red-600 rounded-lg overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-red-800 p-4 border-b-4 border-red-900">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-wider text-white">
                86 - OUT OF STOCK
              </h3>
              <button
                onClick={onClose}
                className="text-white hover:text-red-300 font-black text-3xl px-2 leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Item Name */}
            <div className="text-center">
              <p className="text-slate-400 text-sm uppercase tracking-wide mb-1">Item</p>
              <p className="text-3xl font-black text-white uppercase">{itemName}</p>
              {orderContext && (
                <p className="text-slate-500 text-sm mt-2">
                  From Order #{orderContext.orderNumber}
                  {orderContext.tableNumber && ` - Table ${orderContext.tableNumber}`}
                </p>
              )}
            </div>

            {/* Portions Counter */}
            <div className="text-center">
              <p className="text-slate-400 text-sm uppercase tracking-wide mb-3">
                How many portions out?
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={decrement}
                  disabled={portions <= 1}
                  className={cn(
                    'w-16 h-16 rounded-lg text-4xl font-black border-4 transition-all',
                    portions <= 1
                      ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500 active:scale-95'
                  )}
                >
                  -
                </button>
                <div className="w-24 h-20 bg-slate-800 border-4 border-slate-600 rounded-lg flex items-center justify-center">
                  <span className="text-5xl font-black text-white">{portions}</span>
                </div>
                <button
                  onClick={increment}
                  disabled={portions >= 99}
                  className={cn(
                    'w-16 h-16 rounded-lg text-4xl font-black border-4 transition-all',
                    portions >= 99
                      ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500 active:scale-95'
                  )}
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 5, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => setPortions(num)}
                  className={cn(
                    'py-3 rounded-lg text-lg font-bold border-2 transition-all',
                    portions === num
                      ? 'bg-red-800 border-red-600 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                  )}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              {/* All Out Button */}
              <button
                onClick={handleAllOut}
                className="w-full py-4 bg-red-900 hover:bg-red-800 border-4 border-red-700 rounded-lg text-xl font-black uppercase tracking-wider text-white transition-all active:scale-98"
              >
                ALL OUT - 86'd COMPLETELY
              </button>

              {/* Confirm Button */}
              <button
                onClick={handleConfirm}
                className="w-full py-4 bg-orange-700 hover:bg-orange-600 border-4 border-orange-600 rounded-lg text-xl font-black uppercase tracking-wider text-white transition-all active:scale-98"
              >
                CONFIRM {portions} PORTION{portions !== 1 ? 'S' : ''} OUT
              </button>

              {/* Cancel Button */}
              <button
                onClick={onClose}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 rounded-lg text-lg font-bold uppercase tracking-wider text-slate-400 transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
