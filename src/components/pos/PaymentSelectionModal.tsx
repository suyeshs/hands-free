/**
 * Payment Selection Modal
 * Shows payment options after bill is printed
 * Used to close table with selected payment method
 */

import { useState } from 'react';
import { PaymentMethod } from '../../types/pos';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { salesTransactionService } from '../../lib/salesTransactionService';

interface PaymentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber?: number | null;  // For dine-in
  pickupOrderNumber?: string;  // For pickup display (e.g., "P1")
  billTotal: number;
  invoiceNumber?: string;  // To update payment method in sales record
  onPaymentSelect: (paymentMethod: PaymentMethod) => void;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string; color: string }[] = [
  { id: 'cash', label: 'CASH', icon: '💵', color: 'green' },
  { id: 'card', label: 'CARD', icon: '💳', color: 'blue' },
  { id: 'upi', label: 'UPI', icon: '📱', color: 'purple' },
  { id: 'swiggy_coupon', label: 'SWIGGY', icon: '🟠', color: 'orange' },
  { id: 'zomato_coupon', label: 'ZOMATO', icon: '🔴', color: 'red' },
];

export function PaymentSelectionModal({
  isOpen,
  onClose,
  tableNumber,
  pickupOrderNumber,
  billTotal,
  invoiceNumber,
  onPaymentSelect,
}: PaymentSelectionModalProps) {
  // Determine the title based on whether it's a table or pickup
  const modalTitle = tableNumber
    ? `TABLE ${tableNumber} - SELECT PAYMENT`
    : pickupOrderNumber
    ? `${pickupOrderNumber} - SELECT PAYMENT`
    : 'SELECT PAYMENT';
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentSelect = async (method: PaymentMethod) => {
    setSelectedPayment(method);
    setIsProcessing(true);

    try {
      // Update payment method in sales record if invoice number provided
      if (invoiceNumber) {
        await salesTransactionService.updatePaymentMethod(invoiceNumber, method);
        console.log(`[PaymentSelectionModal] Payment method updated: ${invoiceNumber} - ${method}`);
      }

      // Notify parent to close table
      onPaymentSelect(method);
    } catch (error) {
      console.error('[PaymentSelectionModal] Failed to update payment method:', error);
      // Still close the table even if update fails
      onPaymentSelect(method);
    } finally {
      setIsProcessing(false);
      setSelectedPayment(null);
    }
  };

  const getColorClasses = (color: string, isSelected: boolean) => {
    if (isSelected) {
      return {
        cash: 'bg-green-600 border-green-400 text-white',
        card: 'bg-blue-600 border-blue-400 text-white',
        upi: 'bg-purple-600 border-purple-400 text-white',
        orange: 'bg-orange-600 border-orange-400 text-white',
        red: 'bg-red-600 border-red-400 text-white',
      }[color] || 'bg-slate-600 border-slate-400 text-white';
    }
    return {
      green: 'bg-slate-700 border-slate-600 text-slate-300 hover:border-green-500 hover:bg-green-500/20',
      blue: 'bg-slate-700 border-slate-600 text-slate-300 hover:border-blue-500 hover:bg-blue-500/20',
      purple: 'bg-slate-700 border-slate-600 text-slate-300 hover:border-purple-500 hover:bg-purple-500/20',
      orange: 'bg-slate-700 border-slate-600 text-slate-300 hover:border-orange-500 hover:bg-orange-500/20',
      red: 'bg-slate-700 border-slate-600 text-slate-300 hover:border-red-500 hover:bg-red-500/20',
    }[color] || 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-400';
  };

  return (
    <IndustrialModal
      open={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="sm"
    >
      <div className="space-y-6">
        {/* Bill Total */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
          <div className="text-emerald-400/70 text-xs uppercase tracking-wider mb-1">
            Bill Total
          </div>
          <div className="text-emerald-400 text-3xl font-black font-mono">
            ₹{billTotal.toFixed(2)}
          </div>
        </div>

        {/* Payment Methods Grid */}
        <div className="grid grid-cols-3 gap-3">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => handlePaymentSelect(method.id)}
              disabled={isProcessing}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                getColorClasses(method.color, selectedPayment === method.id)
              } ${isProcessing && selectedPayment !== method.id ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-3xl">{method.icon}</span>
              <span className="text-xs font-bold uppercase tracking-wider">{method.label}</span>
            </button>
          ))}
        </div>

        {/* Processing indicator */}
        {isProcessing && (
          <div className="p-3 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-center text-sm animate-pulse">
            Closing table with {selectedPayment?.toUpperCase()} payment...
          </div>
        )}

        {/* Cancel button */}
        <IndustrialButton
          variant="secondary"
          onClick={onClose}
          disabled={isProcessing}
          size="lg"
          className="w-full"
        >
          CANCEL
        </IndustrialButton>
      </div>
    </IndustrialModal>
  );
}
