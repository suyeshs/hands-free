/**
 * Out of Stock Alert Modal
 * Full-screen blocking modal shown on POS and Service Dashboard
 * when kitchen marks an item as 86'd
 */

import { useEffect } from 'react';
import type { OutOfStockAlert } from '../../types/stock';

interface OutOfStockAlertModalProps {
  alert: OutOfStockAlert | null;
  onAcknowledge: () => void;
}

export function OutOfStockAlertModal({
  alert,
  onAcknowledge,
}: OutOfStockAlertModalProps) {
  useEffect(() => {
    if (alert) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [alert]);

  if (!alert) return null;

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop - Cannot click to dismiss */}
      <div className="fixed inset-0 bg-red-950/95 backdrop-blur-md animate-pulse-subtle" />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg transform animate-bounce-subtle">
        <div className="bg-slate-900 border-8 border-red-600 rounded-2xl overflow-hidden shadow-2xl shadow-red-900/50">
          {/* Warning Header */}
          <div className="bg-red-700 p-6 text-center">
            <div className="text-6xl mb-2">⚠️</div>
            <h2 className="text-3xl font-black uppercase tracking-wider text-white">
              ITEM 86'd
            </h2>
            <p className="text-red-200 text-sm mt-1 uppercase tracking-wide">
              Kitchen Alert
            </p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6 text-center bg-slate-900">
            {/* Item Name */}
            <div>
              <p className="text-slate-400 text-sm uppercase tracking-wide mb-2">
                Out of Stock
              </p>
              <p className="text-4xl font-black text-white uppercase">
                {alert.itemName}
              </p>
            </div>

            {/* Portions */}
            <div className="bg-red-900/30 border-2 border-red-800 rounded-lg p-4">
              {alert.portionsOut === -1 ? (
                <p className="text-2xl font-black text-red-400 uppercase">
                  COMPLETELY OUT - ALL PORTIONS
                </p>
              ) : (
                <p className="text-2xl font-black text-red-400">
                  {alert.portionsOut} PORTION{alert.portionsOut !== 1 ? 'S' : ''} OUT
                </p>
              )}
            </div>

            {/* Order Context (if available) */}
            {alert.orderContext && (
              <div className="bg-slate-800 border-2 border-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-sm">
                  Triggered from Order{' '}
                  <span className="text-white font-bold">
                    #{alert.orderContext.orderNumber}
                  </span>
                  {alert.orderContext.tableNumber && (
                    <>
                      {' '}
                      - Table{' '}
                      <span className="text-white font-bold">
                        {alert.orderContext.tableNumber}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Timestamp */}
            <p className="text-slate-500 text-sm">
              Reported at {formatTime(alert.createdAt)}
            </p>

            {/* Acknowledge Button */}
            <button
              onClick={onAcknowledge}
              className="w-full py-5 bg-green-700 hover:bg-green-600 border-4 border-green-500 rounded-xl text-2xl font-black uppercase tracking-wider text-white transition-all active:scale-98 shadow-lg shadow-green-900/50"
            >
              ACKNOWLEDGE
            </button>

            <p className="text-slate-500 text-xs uppercase tracking-wide">
              Inform guests and update orders as needed
            </p>
          </div>
        </div>
      </div>

      {/* CSS for subtle animations */}
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.85; }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
