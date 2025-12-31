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
  accentColor?: 'orange' | 'green' | 'blue' | 'purple' | 'red';
  /** Additional CSS classes */
  className?: string;
}

const accentColors = {
  orange: {
    gradient: 'from-orange-400 to-orange-600',
    shadow: 'shadow-orange-500/30',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
  },
  green: {
    gradient: 'from-emerald-400 to-emerald-600',
    shadow: 'shadow-emerald-500/30',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
  },
  blue: {
    gradient: 'from-blue-400 to-blue-600',
    shadow: 'shadow-blue-500/30',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  purple: {
    gradient: 'from-purple-400 to-purple-600',
    shadow: 'shadow-purple-500/30',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
  },
  red: {
    gradient: 'from-red-400 to-red-600',
    shadow: 'shadow-red-500/30',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
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
}: DashboardCardProps) {
  const navigate = useNavigate();
  const colors = accentColors[accentColor];

  return (
    <motion.div
      className={cn(
        'relative cursor-pointer select-none',
        'bg-white/80 backdrop-blur-sm rounded-2xl',
        'border border-white/60',
        'shadow-lg shadow-black/5',
        'p-5 flex flex-col gap-4',
        'transition-shadow duration-300',
        'hover:shadow-xl hover:shadow-black/10',
        className
      )}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      onClick={() => navigate(path)}
      style={{ willChange: 'transform' }}
    >
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
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>

      {/* Stats Footer */}
      {stats && (
        <div
          className={cn(
            'pt-3 border-t',
            colors.border
          )}
        >
          <span className={cn('text-sm font-medium', colors.text)}>
            {stats}
          </span>
        </div>
      )}
    </motion.div>
  );
}
