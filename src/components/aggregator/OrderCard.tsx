/**
 * OrderCard Component
 * Compact order card with always-visible items list
 * Optimized for viewing many orders simultaneously
 */

import { AggregatorOrder } from '../../types/aggregator';
import { NeoCard } from '../ui-v2/NeoCard';
import { NeoButton } from '../ui-v2/NeoButton';
import { OrderStatusPill } from './OrderStatusPill';
import { OrderItemsList } from './OrderItemsList';
import { cn } from '../../lib/utils';

export interface OrderCardProps {
  order: AggregatorOrder;
  onAccept?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  onMarkReady?: (orderId: string) => void;
  isProcessing?: boolean;
  className?: string;
}

export function OrderCard({
  order,
  onAccept,
  onReject,
  onMarkReady,
  isProcessing = false,
  className,
}: OrderCardProps) {

  // Format time ago
  const timeAgo = () => {
    const now = Date.now();
    const orderTime = new Date(order.createdAt).getTime();
    const diff = Math.floor((now - orderTime) / 1000 / 60);

    if (diff < 1) return 'Just now';
    if (diff === 1) return '1 min ago';
    if (diff < 60) return `${diff} mins ago`;

    const hours = Math.floor(diff / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  // Aggregator logo/badge color
  const aggregatorColor = order.aggregator === 'zomato' ? 'text-red-600' : 'text-orange-600';

  return (
    <NeoCard className={cn('overflow-hidden', className)} padding="sm">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('font-bold text-lg', aggregatorColor)}>
                {order.aggregator === 'zomato' ? 'Zomato' : 'Swiggy'}
              </span>
              <span className="text-muted-foreground text-sm">#{order.orderNumber}</span>
            </div>
            <div className="text-xs text-muted-foreground">{timeAgo()}</div>
          </div>

          <OrderStatusPill status={order.status} />
        </div>

        {/* Customer Info */}
        <div className="text-sm space-y-1">
          <div className="font-medium text-foreground">{order.customer.name}</div>
          {order.customer.phone && (
            <div className="text-muted-foreground">{order.customer.phone}</div>
          )}
        </div>
      </div>

      {/* Order Summary - Always Visible */}
      <div className="p-3 space-y-3">
        {/* Items List - Always Visible in Compact Mode */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            {order.cart.items.length} {order.cart.items.length === 1 ? 'Item' : 'Items'}
          </div>
          <OrderItemsList items={order.cart.items} compact={true} />
        </div>

        {/* Pricing */}
        <div className="neo-inset p-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal:</span>
            <span>₹{order.cart.subtotal.toFixed(2)}</span>
          </div>
          {order.cart.tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax:</span>
              <span>₹{order.cart.tax.toFixed(2)}</span>
            </div>
          )}
          {order.cart.deliveryFee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery Fee:</span>
              <span>₹{order.cart.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          {order.cart.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount:</span>
              <span>-₹{order.cart.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border">
            <span>Total:</span>
            <span>₹{order.cart.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{order.payment.method}</span>
          <span>•</span>
          <span>{order.payment.isPrepaid ? 'Prepaid' : 'Cash on Delivery'}</span>
        </div>
      </div>

      {/* Actions */}
      {order.status === 'pending' && (onAccept || onReject) && (
        <div className="p-3 border-t border-border flex gap-2">
          {onReject && (
            <NeoButton
              variant="destructive"
              onClick={() => onReject(order.orderId)}
              disabled={isProcessing}
              className="flex-1"
            >
              Reject
            </NeoButton>
          )}
          {onAccept && (
            <NeoButton
              variant="primary"
              onClick={() => onAccept(order.orderId)}
              disabled={isProcessing}
              loading={isProcessing}
              className="flex-1"
            >
              Accept Order
            </NeoButton>
          )}
        </div>
      )}

      {order.status === 'preparing' && onMarkReady && (
        <div className="p-3 border-t border-border">
          <NeoButton
            variant="primary"
            onClick={() => onMarkReady(order.orderId)}
            disabled={isProcessing}
            loading={isProcessing}
            className="w-full"
          >
            Mark as Ready
          </NeoButton>
        </div>
      )}
    </NeoCard>
  );
}
