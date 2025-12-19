/**
 * CheckoutModal Component
 * Modal for payment and order submission
 */

import { useState } from 'react';
import { PaymentMethod, OrderType } from '../../types/pos';
import { GlassModal } from '../ui-v2/GlassModal';
import { NeoButton } from '../ui-v2/NeoButton';
import { cn } from '../../lib/utils';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  tax: number;
  total: number;
  orderType: OrderType;
  tableNumber: number | null;
  onSubmit: (paymentMethod: PaymentMethod) => Promise<void>;
}

export function CheckoutModal({
  isOpen,
  onClose,
  subtotal,
  tax,
  total,
  orderType,
  tableNumber,
  onSubmit,
}: CheckoutModalProps) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const paymentMethods: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'cash', label: 'Cash', icon: '💵' },
    { id: 'card', label: 'Card', icon: '💳' },
    { id: 'upi', label: 'UPI', icon: '📱' },
    { id: 'wallet', label: 'Wallet', icon: '👛' },
  ];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(selectedPayment);
      onClose();
    } catch (error) {
      console.error('Failed to submit order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassModal open={isOpen} onClose={onClose} title="Place Order" size="sm">
      <div className="space-y-4">
        {/* Order Summary - Compact */}
        <div className="neo-inset p-3 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Order Type</span>
            <span className="font-medium text-foreground capitalize">{orderType}</span>
          </div>
          {orderType === 'dine-in' && tableNumber && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Table Number</span>
              <span className="font-medium text-foreground">#{tableNumber}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 mt-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax (5%)</span>
              <span className="text-foreground">₹{tax.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-xl font-bold text-primary">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method - Compact */}
        <div>
          <h4 className="font-semibold text-foreground mb-2 text-sm">Payment Method</h4>
          <div className="grid grid-cols-4 gap-2">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedPayment(method.id)}
                disabled={isSubmitting}
                className={cn(
                  'p-3 rounded-lg transition-all flex flex-col items-center gap-1',
                  selectedPayment === method.id
                    ? 'neo-pressed bg-primary/10 border-2 border-primary/30'
                    : 'neo-raised-sm hover:shadow-lg',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="text-2xl">{method.icon}</span>
                <span className="text-xs font-medium text-foreground">{method.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <NeoButton
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </NeoButton>
          <NeoButton
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Processing...' : 'Confirm Order'}
          </NeoButton>
        </div>
      </div>
    </GlassModal>
  );
}
