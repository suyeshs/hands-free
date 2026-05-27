'use client';

import { observer } from 'mobx-react-lite';
import Image from 'next/image';
import { Minus, Plus, X, ChevronRight, NotebookPen } from 'lucide-react';
import { cartStore } from '../stores/cartStore';
import { orderStore } from '../stores/orderStore';
import { useMenu } from '../contexts/MenuContext';

interface CartProps {
  onPlaceOrder?: () => void;
  onClose?: () => void;
}

export const Cart = observer(function Cart({ onPlaceOrder, onClose }: CartProps) {
  const { items: menuItems } = useMenu();

  // Suggested items: menu items not already in cart, capped at 8
  const cartItemNames = new Set(cartStore.items.map(i => i.name));
  const suggestions = menuItems
    .filter(item => !cartItemNames.has(item.name))
    .slice(0, 8);

  if (cartStore.items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-6xl opacity-20">🍽️</div>
          <div>
            <h3 className="text-xl font-light neu-text mb-2">Your order is empty</h3>
            <p className="text-sm neu-text-secondary opacity-60">
              Browse the menu and add items to get started
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 px-6 py-3 rounded-2xl font-semibold text-sm border-2 border-[#78350f] text-[#78350f] hover:bg-[#78350f] hover:text-white transition-colors"
            >
              Browse Menu
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-light neu-text tracking-tight">Your Order</h2>
            <p className="text-sm neu-text-secondary opacity-60 mt-1">
              {cartStore.itemCount} {cartStore.itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          {onClose && !cartStore.isLocked && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-sm font-semibold text-[#78350f] hover:text-[#5c2a0e] transition-colors"
            >
              Add Items <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Items + Suggestions */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4">
        {/* Cart Items */}
        {cartStore.items.map((item, index) => (
          <div
            key={`${item.name}-${item.customization || 'default'}-${index}`}
            className="group relative"
            style={{ animation: `fadeInUp 0.4s ease-out ${index * 0.1}s both` }}
          >
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100/50">
              <div className="flex gap-4">
                {item.imageUrl && (
                  <div className="flex-shrink-0">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={100}
                      height={100}
                      className="rounded-xl object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-lg neu-text">{item.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{
                        backgroundColor: item.type === 'veg' ? '#dcfce7' : '#fee2e2',
                        color: item.type === 'veg' ? '#166534' : '#991b1b'
                      }}>
                        {item.type === 'veg' ? '🟢' : '🔴'}
                      </span>
                    </div>
                    {item.customization && (
                      <p className="text-sm neu-text-secondary opacity-60 mt-1">
                        {item.customization}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3 bg-gray-50/80 rounded-full px-3 py-1.5">
                      <button
                        onClick={() => {
                          if (item.quantity > 1) {
                            cartStore.updateQuantity(item.name, item.type, item.quantity - 1);
                          } else {
                            cartStore.removeItem(item.name, item.type);
                          }
                        }}
                        disabled={cartStore.isLocked}
                        className="w-7 h-7 rounded-full bg-white shadow-sm hover:shadow transition-all flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {item.quantity === 1 ? <X className="w-4 h-4" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <span className="font-semibold neu-text min-w-[1.5rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => cartStore.updateQuantity(item.name, item.type, item.quantity + 1)}
                        disabled={cartStore.isLocked}
                        className="w-7 h-7 rounded-full bg-white shadow-sm hover:shadow transition-all flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-semibold neu-text-accent">
                        ₹{item.price * item.quantity}
                      </div>
                      {item.quantity > 1 && (
                        <div className="text-xs neu-text-secondary opacity-60">
                          ₹{item.price} each
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Suggested Items — hidden once bill is requested */}
        {suggestions.length > 0 && !cartStore.isLocked && (
          <div className="pt-2 pb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              You might also like
            </p>
            <div
              className="flex gap-3 overflow-x-auto pb-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {suggestions.map((item) => (
                <div
                  key={item.name}
                  className="flex-shrink-0 w-36 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {item.imageUrl ? (
                    <div className="h-24 overflow-hidden bg-gray-50">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-24 bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                      <span className="text-3xl">🍽️</span>
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight min-h-[2rem]">
                      {item.name}
                    </p>
                    <p className="text-xs font-bold text-amber-700 mt-1">₹{item.price}</p>
                    <button
                      onClick={() => cartStore.addMenuItem(item as any)}
                      className="w-full mt-2 py-1.5 text-xs font-bold rounded-lg border-2 border-[#78350f] text-[#78350f] hover:bg-[#78350f] hover:text-white transition-colors"
                    >
                      ADD
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Special Instructions */}
      <div className="px-6 pb-4">
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-gray-100/50">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <NotebookPen className="w-4 h-4 text-gray-400" />
            Special Instructions
          </label>
          <textarea
            value={orderStore.specialInstructions}
            onChange={(e) => orderStore.setSpecialInstructions(e.target.value)}
            placeholder="Allergies, spice level, extra sauce… anything for the kitchen"
            rows={2}
            maxLength={300}
            className="w-full text-sm text-gray-700 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
          />
          {orderStore.specialInstructions.length > 0 && (
            <p className="text-xs text-gray-400 text-right mt-1">
              {orderStore.specialInstructions.length}/300
            </p>
          )}
        </div>
      </div>

      {/* Total & CTA */}
      <div className="sticky bottom-0 p-6 bg-gradient-to-t from-white via-white/98 to-white/95 backdrop-blur-xl border-t border-gray-200/30">
        <div className="flex items-baseline justify-between mb-6">
          <span className="text-lg font-light neu-text-secondary">Total</span>
          <div className="text-right">
            <div className="text-3xl font-light neu-text tracking-tight">
              ₹{cartStore.total}
            </div>
            <div className="text-xs neu-text-secondary opacity-60 mt-1">
              incl. taxes
            </div>
          </div>
        </div>

        {cartStore.isLocked ? (
          <div className="w-full py-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
            <p className="text-amber-700 font-semibold text-sm">Bill requested — ordering closed</p>
            <p className="text-amber-500 text-xs mt-1">Staff will bring your bill shortly</p>
          </div>
        ) : (
          <button
            onClick={onPlaceOrder}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-2xl font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            {cartStore.tableId ? 'Send to Kitchen' : 'Place Order'}
          </button>
        )}
      </div>
    </div>
  );
});
