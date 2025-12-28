/**
 * Guest Checkout Component
 * Handles guest name, payment method selection, and order submission
 */

import { useState } from 'react';
import { X, CreditCard, Wallet, Loader2, MessageSquare } from 'lucide-react';
import { useGuestSessionStore } from '../../stores/guestSessionStore';
import { calculateCartTotals, submitGuestOrder } from '../../lib/guestOrderApi';
import type { GuestOrder } from '../../types/guest-order';

interface GuestCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tenantId: string;
  onOrderSuccess: (orderId: string, orderNumber: string) => void;
}

export function GuestCheckout({
  isOpen,
  onClose,
  tableId,
  tenantId,
  onOrderSuccess,
}: GuestCheckoutProps) {
  const cart = useGuestSessionStore((state) => state.cart);
  const guestName = useGuestSessionStore((state) => state.guestName);
  const setGuestName = useGuestSessionStore((state) => state.setGuestName);
  const specialInstructions = useGuestSessionStore((state) => state.specialInstructions);
  const setSpecialInstructions = useGuestSessionStore((state) => state.setSpecialInstructions);
  const session = useGuestSessionStore((state) => state.session);
  const addOrderId = useGuestSessionStore((state) => state.addOrderId);
  const clearCart = useGuestSessionStore((state) => state.clearCart);

  const [paymentMethod, setPaymentMethod] = useState<'pay_now' | 'pay_later'>('pay_later');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { subtotal, tax, total } = calculateCartTotals(cart);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const order: GuestOrder = {
        sessionToken: session?.sessionToken || '',
        tableId,
        items: cart,
        paymentMethod,
        guestName: guestName || undefined,
        specialInstructions: specialInstructions || undefined,
      };

      const response = await submitGuestOrder(tenantId, order);

      // Add order ID to session
      addOrderId(response.orderId);

      // Clear cart after successful order
      clearCart();

      // Notify parent
      onOrderSuccess(response.orderId, response.orderNumber);
    } catch (err) {
      console.error('[GuestCheckout] Order submission failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isSubmitting ? onClose : undefined}
      />

      {/* Checkout sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Checkout</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Guest name (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name (Optional)
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              This helps the server deliver your order
            </p>
          </div>

          {/* Special instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Special Instructions (Optional)
            </label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any allergies or special requests..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Payment Method
            </label>
            <div className="space-y-3">
              <button
                onClick={() => setPaymentMethod('pay_later')}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'pay_later'
                    ? 'border-orange-600 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'pay_later'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Pay at Counter</p>
                  <p className="text-sm text-gray-500">
                    Pay when you leave with cash or card
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'pay_later'
                      ? 'border-orange-600'
                      : 'border-gray-300'
                  }`}
                >
                  {paymentMethod === 'pay_later' && (
                    <div className="w-2.5 h-2.5 bg-orange-600 rounded-full" />
                  )}
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('pay_now')}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'pay_now'
                    ? 'border-orange-600 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'pay_now'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Pay Now</p>
                  <p className="text-sm text-gray-500">
                    Pay online using UPI, cards, or wallets
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'pay_now'
                      ? 'border-orange-600'
                      : 'border-gray-300'
                  }`}
                >
                  {paymentMethod === 'pay_now' && (
                    <div className="w-2.5 h-2.5 bg-orange-600 rounded-full" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {item.name} x {item.quantity}
                </span>
                <span className="text-gray-900">
                  Rs.{' '}
                  {(
                    (item.price +
                      (item.modifiers?.reduce((s, m) => s + m.priceAdjustment, 0) || 0)) *
                    item.quantity
                  ).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-200 my-2 pt-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax (5%)</span>
                <span>Rs. {tax.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>Rs. {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Submit button */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <button
            onClick={handleSubmitOrder}
            disabled={isSubmitting || cart.length === 0}
            className="w-full py-4 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Placing Order...
              </>
            ) : paymentMethod === 'pay_now' ? (
              `Pay Rs. ${total.toFixed(2)}`
            ) : (
              'Place Order'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
