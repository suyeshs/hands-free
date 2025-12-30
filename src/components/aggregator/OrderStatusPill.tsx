/**
 * OrderStatusPill Component
 * Status indicator for aggregator orders
 */

import { AggregatorOrderStatus } from '../../types/aggregator';
import { StatusPill } from '../ui-v2/StatusPill';

export interface OrderStatusPillProps {
  status: AggregatorOrderStatus;
  className?: string;
}

const statusConfig: Record<
  AggregatorOrderStatus,
  {
    label: string;
    variant: 'default' | 'pending' | 'active' | 'success' | 'warning' | 'error';
  }
> = {
  pending: { label: 'Pending', variant: 'pending' },
  confirmed: { label: 'Confirmed', variant: 'active' },
  preparing: { label: 'Preparing', variant: 'active' },
  ready: { label: 'Ready', variant: 'success' },
  pending_pickup: { label: 'Awaiting Pickup', variant: 'warning' },
  picked_up: { label: 'Picked Up', variant: 'success' },
  out_for_delivery: { label: 'Out for Delivery', variant: 'active' },
  delivered: { label: 'Delivered', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'error' },
};

export function OrderStatusPill({ status, className }: OrderStatusPillProps) {
  const config = statusConfig[status];

  return (
    <StatusPill status={config.variant} className={className}>
      {config.label}
    </StatusPill>
  );
}
