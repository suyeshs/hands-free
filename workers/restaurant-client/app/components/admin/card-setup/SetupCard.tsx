'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { SetupCardProps, CardStatus } from './types/setup-cards';

/**
 * Setup Card Component
 * Individual card with two display modes: full and compact
 *
 * Design: Glassmorphism with warm accents following handsfree.tech aesthetic
 *
 * Full Card (Grid Mode):
 * - Glass panel background with backdrop blur
 * - Warm border glow based on status
 * - Icon, title, description, status badge
 * - Hover: Elevated shadow with saffron glow
 *
 * Compact Card (Row Mode):
 * - Minimal glass card (80px square)
 * - Icon only with status indicator dot
 * - Warm border pulse on active
 */
export function SetupCard({
  id,
  title,
  description,
  icon: Icon,
  status,
  isActive,
  isCompact,
  required,
  onClick,
}: SetupCardProps) {
  // Get status-specific glass styling
  const getStatusClass = () => {
    switch (status) {
      case CardStatus.COMPLETE:
        return 'glass-complete';
      case CardStatus.IN_PROGRESS:
        return 'glass-in-progress';
      default:
        return 'glass-incomplete';
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case CardStatus.COMPLETE:
        return <CheckCircle2 className="w-5 h-5 text-honey" />;
      case CardStatus.IN_PROGRESS:
        return <Clock className="w-5 h-5 text-saffron" />;
      default:
        return <Circle className="w-5 h-5 text-warm-white/30" />;
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (status) {
      case CardStatus.COMPLETE:
        return 'Complete';
      case CardStatus.IN_PROGRESS:
        return 'In Progress';
      default:
        return required ? 'Required' : 'Optional';
    }
  };

  // Get status badge color
  const getStatusBadgeClass = () => {
    switch (status) {
      case CardStatus.COMPLETE:
        return 'bg-honey/20 text-honey border-honey/30';
      case CardStatus.IN_PROGRESS:
        return 'bg-saffron/20 text-saffron border-saffron/30';
      default:
        return 'bg-warm-white/5 text-warm-white/60 border-warm-white/10';
    }
  };

  if (isCompact) {
    // Compact mode (row layout when a card is active)
    return (
      <motion.button
        layout
        onClick={onClick}
        className={`
          ${getStatusClass()}
          relative p-4 rounded-xl cursor-pointer
          transition-all duration-300
          hover:scale-105
          ${isActive ? 'ring-2 ring-saffron shadow-saffron-glow' : ''}
        `}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{
          layout: {
            type: 'spring',
            bounce: 0.2,
            duration: 0.4,
          },
        }}
      >
        {/* Icon */}
        <div className="flex flex-col items-center gap-2">
          <div
            className={`
              w-12 h-12 rounded-lg flex items-center justify-center
              ${
                status === CardStatus.COMPLETE
                  ? 'bg-gradient-to-br from-honey/30 to-coffee/30'
                  : status === CardStatus.IN_PROGRESS
                  ? 'bg-gradient-to-br from-saffron/30 to-paprika/30'
                  : 'bg-warm-white/5'
              }
            `}
          >
            <Icon className="w-6 h-6 text-warm-white" />
          </div>

          {/* Status Indicator Dot */}
          <div className="flex items-center justify-center">
            <div
              className={`
                w-2 h-2 rounded-full
                ${
                  status === CardStatus.COMPLETE
                    ? 'bg-honey'
                    : status === CardStatus.IN_PROGRESS
                    ? 'bg-saffron animate-pulse'
                    : 'bg-warm-white/30'
                }
              `}
            />
          </div>
        </div>

        {/* Tooltip on hover */}
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="glass-panel px-3 py-1 text-xs text-warm-white whitespace-nowrap">
            {title}
          </div>
        </div>
      </motion.button>
    );
  }

  // Full card mode (grid layout)
  return (
    <motion.button
      layout
      onClick={onClick}
      className={`
        ${getStatusClass()}
        p-6 rounded-2xl cursor-pointer text-left
        transition-all duration-300
        hover:shadow-warm-glow hover:-translate-y-1
      `}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        layout: {
          type: 'spring',
          bounce: 0.2,
          duration: 0.4,
        },
      }}
    >
      {/* Icon and Status Badge Row */}
      <div className="flex items-start justify-between mb-4">
        {/* Icon */}
        <div
          className={`
            w-14 h-14 rounded-xl flex items-center justify-center
            ${
              status === CardStatus.COMPLETE
                ? 'bg-gradient-to-br from-honey/30 to-coffee/30'
                : status === CardStatus.IN_PROGRESS
                ? 'bg-gradient-to-br from-saffron/30 to-paprika/30'
                : 'bg-warm-white/5'
            }
          `}
        >
          <Icon className="w-7 h-7 text-warm-white" />
        </div>

        {/* Status Icon */}
        <div>{getStatusIcon()}</div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-warm-white font-display mb-2">
        {title}
        {required && <span className="text-saffron ml-1">*</span>}
      </h3>

      {/* Description */}
      <p className="text-sm text-warm-white/60 mb-4 leading-relaxed">
        {description}
      </p>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <div
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
            border text-xs font-semibold
            ${getStatusBadgeClass()}
          `}
        >
          <span>{getStatusText()}</span>
        </div>
      </div>
    </motion.button>
  );
}
