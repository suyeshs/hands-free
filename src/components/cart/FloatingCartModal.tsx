/**
 * FloatingCartModal Component
 * Expanded cart view with item management and checkout
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { usePOSStore } from '../../stores/posStore';
import { useNavigate } from 'react-router-dom';
import {
  modalVariants,
  backdropVariants,
  cartItemVariants,
  staggerContainer,
  springConfig,
} from '../../lib/motion/variants';
import { cn } from '../../lib/utils';

export interface FloatingCartModalProps {
  onClose: () => void;
}

export function FloatingCartModal({ onClose }: FloatingCartModalProps) {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeFromCart, getCartTotal } = usePOSStore();

  const { subtotal, tax, total } = getCartTotal();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleGoToCheckout = () => {
    onClose();
    navigate('/pos');
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className={cn(
          'fixed z-50 overflow-hidden',
          'bg-white rounded-2xl shadow-2xl',
          'flex flex-col',
          'max-h-[80vh] w-[90vw] max-w-md'
        )}
        style={{
          right: '16px',
          bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
        }}
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
              <p className="text-sm text-gray-500">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <motion.button
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center
                       hover:bg-gray-200 transition-colors"
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-5 h-5 text-gray-600" />
          </motion.button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <AnimatePresence mode="popLayout">
                {cart.map((item) => (
                  <motion.div
                    key={item.id}
                    className="flex gap-3 p-3 bg-gray-50 rounded-xl mb-2"
                    variants={cartItemVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    layout
                  >
                    {/* Item Image or Placeholder */}
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
                      {item.menuItem.image ? (
                        <img
                          src={item.menuItem.image}
                          alt={item.menuItem.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          🍽️
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {item.menuItem.name}
                      </h3>

                      {/* Modifiers */}
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-gray-500 truncate">
                          {item.modifiers.map((m) => m.name).join(', ')}
                        </p>
                      )}

                      {/* Combo Selections */}
                      {item.comboSelections && item.comboSelections.length > 0 && (
                        <p className="text-xs text-gray-500 truncate">
                          {item.comboSelections
                            .flatMap((cs) => cs.selectedItems.map((i) => i.name))
                            .join(', ')}
                        </p>
                      )}

                      <p className="text-sm font-bold text-orange-600 mt-1">
                        Rs. {item.subtotal.toFixed(0)}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex flex-col items-end justify-between">
                      <motion.button
                        className="w-7 h-7 rounded-lg bg-red-50 text-red-500
                                   flex items-center justify-center
                                   hover:bg-red-100 transition-colors"
                        onClick={() => removeFromCart(item.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>

                      <div className="flex items-center gap-1">
                        <motion.button
                          className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700
                                     flex items-center justify-center
                                     hover:bg-gray-300 transition-colors
                                     disabled:opacity-50"
                          onClick={() =>
                            updateQuantity(item.id, Math.max(1, item.quantity - 1))
                          }
                          disabled={item.quantity <= 1}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Minus className="w-4 h-4" />
                        </motion.button>
                        <span className="w-8 text-center font-bold text-gray-900">
                          {item.quantity}
                        </span>
                        <motion.button
                          className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600
                                     flex items-center justify-center
                                     hover:bg-orange-200 transition-colors"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Plus className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Footer - Totals & Checkout */}
        {cart.length > 0 && (
          <div className="border-t border-gray-100 p-4 bg-gray-50">
            {/* Totals */}
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax</span>
                <span>Rs. {tax.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>Rs. {total.toFixed(0)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <motion.button
              className="w-full py-3 px-4 rounded-xl
                         bg-gradient-to-r from-orange-500 to-orange-600
                         text-white font-bold
                         shadow-lg shadow-orange-500/30
                         hover:shadow-xl hover:shadow-orange-500/40
                         transition-shadow"
              onClick={handleGoToCheckout}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springConfig.quick}
            >
              Go to Checkout
            </motion.button>
          </div>
        )}
      </motion.div>
    </>
  );
}
