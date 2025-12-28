/**
 * Guest Cart Component
 * Bottom sheet cart with item list and checkout button
 */

import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useGuestSessionStore } from '../../stores/guestSessionStore';
import { calculateCartTotals } from '../../lib/guestOrderApi';

interface GuestCartProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function GuestCart({ isOpen, onClose, onCheckout }: GuestCartProps) {
  const cart = useGuestSessionStore((state) => state.cart);
  const updateCartItem = useGuestSessionStore((state) => state.updateCartItem);
  const removeFromCart = useGuestSessionStore((state) => state.removeFromCart);
  const getCartTotal = useGuestSessionStore((state) => state.getCartTotal);

  const subtotal = getCartTotal();
  const { tax, total } = calculateCartTotals(cart);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Cart sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Your Order</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Your cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">
                Add items from the menu to get started
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const itemTotal =
                (item.price +
                  (item.modifiers?.reduce((sum, m) => sum + m.priceAdjustment, 0) || 0)) *
                item.quantity;

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  {/* Item details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {item.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                    <p className="text-orange-600 font-medium mt-1">
                      Rs. {itemTotal.toFixed(2)}
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        item.quantity === 1
                          ? removeFromCart(item.id)
                          : updateCartItem(item.id, item.quantity - 1)
                      }
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      ) : (
                        <Minus className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-lg font-medium w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartItem(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary and checkout */}
        {cart.length > 0 && (
          <div className="border-t border-gray-200 p-4 space-y-3 bg-white">
            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax (5%)</span>
                <span>Rs. {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>Rs. {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout button */}
            <button
              onClick={onCheckout}
              className="w-full py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
