/**
 * Bill Request Modal
 * Shown to POS staff when a customer at a dine-in table requests the bill.
 */

import { useState } from 'react';
import { Receipt, CreditCard, Smartphone, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BillRequest } from '../../stores/billRequestStore';

interface BillRequestModalProps {
  request: BillRequest;
  tenantId: string; // reserved for future direct API calls from modal
  onApprove: (orderId: string) => Promise<void>;
  onDismiss: (orderId: string) => void;
}

export function BillRequestModal({ request, tenantId: _tenantId, onApprove, onDismiss }: BillRequestModalProps) {
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove(request.orderId);
    } finally {
      setApproving(false);
    }
  };

  const tableLabel = request.tableNumber ? `Table ${request.tableNumber}` : `Table ${request.tableId}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border-4 border-green-500 rounded-xl max-w-sm w-full shadow-2xl shadow-green-900/30 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-green-700 px-5 py-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt size={22} className="text-white" />
            <div>
              <p className="font-black text-white text-lg uppercase tracking-wide">Bill Requested</p>
              <p className="text-green-200 text-sm">{tableLabel}</p>
            </div>
          </div>
          <button
            onClick={() => onDismiss(request.orderId)}
            className="p-1 hover:bg-green-600 rounded transition-colors"
            disabled={approving}
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Payment method */}
          <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-4">
            {request.paymentMethod === 'online' ? (
              <>
                <Smartphone size={24} className="text-blue-400 flex-shrink-0" />
                <div>
                  <p className="font-bold text-white">Online Payment</p>
                  <p className="text-sm text-slate-400">Customer wants to pay via Razorpay</p>
                </div>
              </>
            ) : (
              <>
                <CreditCard size={24} className="text-amber-400 flex-shrink-0" />
                <div>
                  <p className="font-bold text-white">Card Machine</p>
                  <p className="text-sm text-slate-400">Customer wants to pay via card machine</p>
                </div>
              </>
            )}
          </div>

          {/* Total if available */}
          {request.total != null && (
            <div className={cn('flex items-center justify-between px-4 py-3 rounded-lg', 'bg-slate-800')}>
              <span className="text-slate-300 font-medium">Total Amount</span>
              <span className="text-2xl font-black text-white">₹{request.total.toFixed(2)}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => onDismiss(request.orderId)}
              disabled={approving}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              Later
            </button>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {approving ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <Check size={18} />
                  Approve Bill
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
