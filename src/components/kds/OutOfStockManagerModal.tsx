/**
 * Out of Stock Manager Modal
 * Shows all currently 86'd items and allows marking them back in stock
 */

import { useEffect } from 'react';
import { useOutOfStockStore } from '../../stores/outOfStockStore';
import { cn } from '../../lib/utils';

interface OutOfStockManagerModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
}

export function OutOfStockManagerModal({
  open,
  onClose,
  tenantId,
}: OutOfStockManagerModalProps) {
  const { getActiveItems, markBackInStock } = useOutOfStockStore();
  const activeItems = getActiveItems();

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

  const handleBackInStock = async (itemId: string) => {
    await markBackInStock(tenantId, itemId);
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeElapsed = (isoString: string): string => {
    const created = new Date(isoString).getTime();
    const now = Date.now();
    const minutes = Math.floor((now - created) / 1000 / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m ago`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl transform">
        <div className="bg-slate-900 border-4 border-slate-700 rounded-lg overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-slate-800 p-4 border-b-4 border-slate-900 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚫</span>
              <h3 className="text-2xl font-black uppercase tracking-wider text-white">
                86'd ITEMS
              </h3>
              {activeItems.length > 0 && (
                <span className="bg-red-600 text-white text-lg font-black px-3 py-1 rounded">
                  {activeItems.length}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-400 font-black text-3xl px-2 leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {activeItems.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">✓</span>
                <p className="text-2xl font-bold text-slate-400">All items in stock</p>
                <p className="text-slate-500 mt-2">No items are currently 86'd</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-800 border-2 border-red-800/50 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-red-500 font-black text-sm uppercase">86'd</span>
                        <span className="text-xl font-bold text-white">{item.itemName}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                        <span>
                          {item.portionsOut === -1 ? (
                            <span className="text-red-400 font-bold">ALL OUT</span>
                          ) : (
                            <>{item.portionsOut} portion{item.portionsOut !== 1 ? 's' : ''}</>
                          )}
                        </span>
                        <span>•</span>
                        <span>{formatTime(item.createdAt)}</span>
                        <span className="text-slate-500">({getTimeElapsed(item.createdAt)})</span>
                        {item.createdByStaffName && (
                          <>
                            <span>•</span>
                            <span>by {item.createdByStaffName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleBackInStock(item.id)}
                      className={cn(
                        'px-4 py-3 rounded-lg font-black uppercase text-sm',
                        'bg-green-800 hover:bg-green-700 border-2 border-green-600',
                        'text-white transition-all active:scale-95'
                      )}
                    >
                      BACK IN STOCK
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-800 p-4 border-t-2 border-slate-700">
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 rounded-lg text-lg font-bold uppercase tracking-wider text-white transition-all"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
