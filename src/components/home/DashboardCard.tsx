/**
 * DashboardCard Component
 * Animated card for the Hub page with glass/neo styling
 */

import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { cardVariants, springConfig } from '../../lib/motion/variants';

export interface DashboardCardProps {
  /** Unique identifier */
  id: string;
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Navigation path */
  path: string;
  /** Live stats text (e.g., "3 active orders") */
  stats?: string;
  /** Whether there's something urgent (shows pulse) */
  urgent?: boolean;
  /** Badge count (shows notification badge) */
  badgeCount?: number;
  /** Card accent color */
  accentColor?: 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'cyan' | 'amber';
  /** Additional CSS classes */
  className?: string;
  /** Disabled state (shows lock icon, prevents navigation) */
  disabled?: boolean;
  /** Message shown when disabled */
  disabledMessage?: string;
  /** Requires attention (shows glow animation) */
  requiresAttention?: boolean;
  /** Overlay message when attention is required */
  attentionMessage?: string;
}

const accentColors = {
  orange: {
    gradient: 'from-orange-400 to-orange-600',
    shadow: 'shadow-orange-500/30',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
    glow: 'shadow-orange-400/50',
  },
  green: {
    gradient: 'from-emerald-400 to-emerald-600',
    shadow: 'shadow-emerald-500/30',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    glow: 'shadow-emerald-400/50',
  },
  blue: {
    gradient: 'from-blue-400 to-blue-600',
    shadow: 'shadow-blue-500/30',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    glow: 'shadow-blue-400/50',
  },
  purple: {
    gradient: 'from-purple-400 to-purple-600',
    shadow: 'shadow-purple-500/30',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
    glow: 'shadow-purple-400/50',
  },
  red: {
    gradient: 'from-red-400 to-red-600',
    shadow: 'shadow-red-500/30',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    glow: 'shadow-red-400/50',
  },
  cyan: {
    gradient: 'from-cyan-400 to-cyan-600',
    shadow: 'shadow-cyan-500/30',
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
    border: 'border-cyan-200',
    glow: 'shadow-cyan-400/50',
  },
  amber: {
    gradient: 'from-amber-400 to-amber-600',
    shadow: 'shadow-amber-500/30',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    glow: 'shadow-amber-400/50',
  },
};

export function DashboardCard({
  title,
  description,
  icon: Icon,
  path,
  stats,
  urgent = false,
  badgeCount,
  accentColor = 'orange',
  className,
  disabled = false,
  disabledMessage,
  requiresAttention = false,
  attentionMessage,
}: DashboardCardProps) {
  const navigate = useNavigate();
  const colors = accentColors[accentColor];

  const handleClick = () => {
    if (disabled) return;
    navigate(path);
  };

  return (
    <motion.div
      className={cn(
        'relative select-none',
        'glass-panel-dark',
        'p-5 flex flex-col gap-4',
        'transition-all duration-300',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className
      )}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : "tap"}
      onClick={handleClick}
      style={{ willChange: 'transform' }}
    >
      {/* Disabled Overlay */}
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl z-10 backdrop-blur-sm">
          <div className="text-center px-4">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="text-sm font-semibold text-white">
              {disabledMessage || 'Complete setup first'}
            </p>
          </div>
        </div>
      )}

      {/* Attention Overlay Badge */}
      {requiresAttention && attentionMessage && !disabled && (
        <div className="absolute top-3 right-3 z-10">
          <motion.div
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold',
              'bg-gradient-to-br',
              colors.gradient,
              'text-white shadow-lg',
              colors.shadow
            )}
            animate={{
              scale: [1, 1.05, 1],
              boxShadow: [
                `0 0 0 0 rgba(255, 140, 0, 0.7)`,
                `0 0 0 10px rgba(255, 140, 0, 0)`,
                `0 0 0 0 rgba(255, 140, 0, 0)`,
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            ⚠️ {attentionMessage}
          </motion.div>
        </div>
      )}

      {/* Icon Container */}
      <div className="flex items-start justify-between">
        <motion.div
          className={cn(
            'w-14 h-14 rounded-xl flex items-center justify-center',
            'bg-gradient-to-br',
            colors.gradient,
            'shadow-lg',
            colors.shadow
          )}
          whileHover={{ scale: 1.05, rotate: 3 }}
          transition={springConfig.quick}
        >
          <Icon className="w-7 h-7 text-white" />
        </motion.div>

        {/* Badge */}
        {badgeCount !== undefined && badgeCount > 0 && (
          <motion.div
            className={cn(
              'min-w-[24px] h-6 px-2 rounded-full flex items-center justify-center',
              'bg-gradient-to-br',
              urgent ? 'from-red-500 to-red-600' : colors.gradient,
              'text-white text-xs font-bold',
              'shadow-md'
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={springConfig.quick}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </motion.div>
        )}

        {/* Urgent indicator (pulse) */}
        {urgent && !badgeCount && (
          <motion.div
            className="w-3 h-3 rounded-full bg-red-500"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-warm-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400 font-light leading-relaxed">{description}</p>
      </div>

      {/* Stats Footer */}
      {stats && (
        <div
          className={cn(
            'pt-3 border-t border-white/10'
          )}
        >
          <span className={cn('text-sm font-medium text-saffron')}>
            {stats}
          </span>
        </div>
      )}
    </motion.div>
  );
}
