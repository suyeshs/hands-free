/**
 * OrderStatusBadge Component
 *
 * Displays the current order status with visual indicators.
 * Used on table cards in POS and Service Dashboard.
 */

import { cn } from '../../lib/utils';

export type OrderStatus = 'pending' | 'in_progress' | 'ready' | 'completed' | null;

interface OrderStatusBadgeProps {
  status: OrderStatus;
  readyCount?: number;
  totalCount?: number;
  hasRunningOrder?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  className?: string;
}

const statusConfig: Record<NonNullable<OrderStatus>, {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: string;
  animate?: boolean;
}> = {
  pending: {
    label: 'WAITING',
    bgClass: 'bg-slate-600',
    textClass: 'text-slate-100',
    borderClass: 'border-slate-500',
    icon: '⏳',
  },
  in_progress: {
    label: 'PREPARING',
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-100',
    borderClass: 'border-blue-400',
    icon: '🔥',
    animate: true,
  },
  ready: {
    label: 'READY',
    bgClass: 'bg-green-600',
    textClass: 'text-green-100',
    borderClass: 'border-green-400',
    icon: '✓',
    animate: true,
  },
  completed: {
    label: 'SERVED',
    bgClass: 'bg-slate-500',
    textClass: 'text-slate-200',
    borderClass: 'border-slate-400',
    icon: '✓',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-2 text-base',
};

export function OrderStatusBadge({
  status,
  readyCount = 0,
  totalCount = 0,
  hasRunningOrder = false,
  size = 'md',
  showProgress = true,
  className,
}: OrderStatusBadgeProps) {
  // If no status, show empty state
  if (!status) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded font-bold uppercase border-2',
          'bg-slate-800 text-slate-400 border-slate-700',
          sizeClasses[size],
          className
        )}
      >
        <span>EMPTY</span>
      </div>
    );
  }

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-bold uppercase border-2',
        config.bgClass,
        config.textClass,
        config.borderClass,
        config.animate && 'animate-pulse',
        sizeClasses[size],
        // Running order override - orange styling
        hasRunningOrder && 'bg-orange-600 text-orange-100 border-orange-400 animate-pulse',
        className
      )}
    >
      {/* Icon */}
      <span className="text-xs">{hasRunningOrder ? '🏃' : config.icon}</span>

      {/* Label */}
      <span>{hasRunningOrder ? 'RUNNING' : config.label}</span>

      {/* Progress indicator */}
      {showProgress && totalCount > 0 && (
        <span className="opacity-80 text-xs">
          ({readyCount}/{totalCount})
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for small spaces
 */
export function OrderStatusDot({
  status,
  hasRunningOrder = false,
  className,
}: {
  status: OrderStatus;
  hasRunningOrder?: boolean;
  className?: string;
}) {
  if (!status) return null;

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        'w-3 h-3 rounded-full',
        config.bgClass,
        config.animate && 'animate-pulse',
        hasRunningOrder && 'bg-orange-500 animate-pulse',
        className
      )}
      title={hasRunningOrder ? 'Running Order' : config.label}
    />
  );
}
