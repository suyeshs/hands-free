import React from 'react';
import { SubscriptionStatus, DeliveryStatus } from '../../../types/subscription';

interface StatusPillProps {
  status: SubscriptionStatus | DeliveryStatus | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<string, { color: string; label: string; bgColor: string }> = {
  // Subscription statuses
  active: { color: 'text-green-700', label: 'Active', bgColor: 'bg-green-100' },
  paused: { color: 'text-yellow-700', label: 'Paused', bgColor: 'bg-yellow-100' },
  cancelled: { color: 'text-red-700', label: 'Cancelled', bgColor: 'bg-red-100' },
  expired: { color: 'text-gray-700', label: 'Expired', bgColor: 'bg-gray-100' },

  // Delivery statuses
  scheduled: { color: 'text-blue-700', label: 'Scheduled', bgColor: 'bg-blue-100' },
  preparing: { color: 'text-purple-700', label: 'Preparing', bgColor: 'bg-purple-100' },
  ready: { color: 'text-orange-700', label: 'Ready', bgColor: 'bg-orange-100' },
  assigned: { color: 'text-yellow-700', label: 'Assigned', bgColor: 'bg-yellow-100' },
  out_for_delivery: { color: 'text-blue-700', label: 'Out for Delivery', bgColor: 'bg-blue-100' },
  delivered: { color: 'text-green-700', label: 'Delivered', bgColor: 'bg-green-100' },
  failed: { color: 'text-red-700', label: 'Failed', bgColor: 'bg-red-100' },

  // Other statuses
  pending: { color: 'text-orange-700', label: 'Pending', bgColor: 'bg-orange-100' },
  in_progress: { color: 'text-blue-700', label: 'In Progress', bgColor: 'bg-blue-100' },
  completed: { color: 'text-green-700', label: 'Completed', bgColor: 'bg-green-100' },
  packed: { color: 'text-green-700', label: 'Packed', bgColor: 'bg-green-100' },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  size = 'md',
  className = ''
}) => {
  const config = statusConfig[status] || {
    color: 'text-gray-700',
    label: status,
    bgColor: 'bg-gray-100',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-full font-semibold uppercase tracking-wide
        ${config.bgColor} ${config.color}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {config.label}
    </span>
  );
};
