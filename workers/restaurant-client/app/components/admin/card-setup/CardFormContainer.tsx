'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { CardFormContainerProps } from './types/setup-cards';

/**
 * Card Form Container
 * Animated wrapper for setup forms that slide in below the card row
 *
 * Design: Large glass panel with warm gradient border (handsfree.tech style)
 *
 * Features:
 * - Glass panel styling with saffron glow border
 * - Header with title and close button
 * - Scrollable content area
 * - Slide-in animation from bottom
 * - Spring physics transitions
 */
export function CardFormContainer({
  cardId,
  title,
  onClose,
  children,
}: CardFormContainerProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={cardId}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{
          type: 'spring',
          bounce: 0.2,
          duration: 0.4,
        }}
        className="mt-8"
      >
        {/* Glass Panel */}
        <div
          className="
            glass-panel
            border-saffron/30
            shadow-saffron-glow
            overflow-hidden
          "
          style={{
            background: 'rgba(255, 248, 240, 0.03)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(242, 140, 56, 0.3)',
            boxShadow: '0 0 30px rgba(242, 140, 56, 0.15)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-warm-white/10">
            <div>
              <h2 className="text-2xl font-bold text-warm-white font-display">
                {title}
              </h2>
              <p className="text-sm text-warm-white/60 mt-1">
                Complete this section to continue setup
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="
                w-10 h-10 rounded-lg flex items-center justify-center
                bg-warm-white/5 hover:bg-warm-white/10
                border border-warm-white/10 hover:border-saffron/30
                text-warm-white/60 hover:text-warm-white
                transition-all duration-200
                hover:shadow-warm-glow
              "
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6 max-h-[600px] overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {children}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
