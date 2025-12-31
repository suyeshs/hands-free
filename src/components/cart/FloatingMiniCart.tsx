/**
 * FloatingMiniCart Component
 * Small floating indicator showing cart summary, expands to full modal
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { usePOSStore } from '../../stores/posStore';
import { FloatingCartModal } from './FloatingCartModal';
import { floatingElementVariants, pulseVariants, springConfig } from '../../lib/motion/variants';
import { cn } from '../../lib/utils';

export interface FloatingMiniCartProps {
  /** Additional CSS classes */
  className?: string;
}

export function FloatingMiniCart({ className }: FloatingMiniCartProps) {
  const { cart, getCartTotal } = usePOSStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(false);
  const prevCountRef = useRef(0);

  // Calculate totals
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const { total } = getCartTotal();

  // Detect when items are added for pulse animation
  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setShouldPulse(true);
      const timer = setTimeout(() => setShouldPulse(false), 300);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  // Don't render if cart is empty
  if (itemCount === 0) {
    return null;
  }

  return (
    <>
      {/* Mini Cart Button */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.button
            className={cn(
              'fixed z-40',
              'flex items-center gap-3 px-4 py-3',
              'bg-white/90 backdrop-blur-xl rounded-2xl',
              'border border-white/60',
              'shadow-lg shadow-black/10',
              'cursor-pointer select-none',
              'hover:shadow-xl hover:bg-white',
              'transition-shadow duration-200',
              className
            )}
            style={{
              right: '16px',
              bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            }}
            variants={floatingElementVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setIsExpanded(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Cart Icon with Badge */}
            <motion.div
              className="relative"
              variants={pulseVariants}
              animate={shouldPulse ? 'pulse' : 'initial'}
            >
              <ShoppingCart className="w-6 h-6 text-orange-500" />
              <motion.span
                className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5
                           flex items-center justify-center
                           bg-gradient-to-br from-orange-400 to-orange-600
                           text-white text-xs font-bold rounded-full
                           shadow-md"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={springConfig.quick}
              >
                {itemCount > 99 ? '99+' : itemCount}
              </motion.span>
            </motion.div>

            {/* Summary Text */}
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500">
                Rs. {total.toFixed(0)}
              </p>
            </div>

            {/* Expand Arrow */}
            <motion.div
              className="ml-2 text-gray-400"
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 4L10 8L6 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded Cart Modal */}
      <AnimatePresence>
        {isExpanded && (
          <FloatingCartModal onClose={() => setIsExpanded(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
