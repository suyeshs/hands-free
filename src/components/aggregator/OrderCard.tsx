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
import { useAggregatorExtractionStore, ExtractedButton } from '../../stores/aggregatorExtractionStore';

export interface OrderCardProps {
  order: AggregatorOrder;
  onAccept?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  onMarkReady?: (orderId: string) => void;
  onMarkPickedUp?: (orderId: string) => void;
  onMarkCompleted?: (orderId: string) => void;
  onDismiss?: (orderId: string) => void;
  isProcessing?: boolean;
  className?: string;
}

export function OrderCard({
  order,
  onAccept,
  onReject,
  onMarkReady,
  onMarkPickedUp,
  onMarkCompleted,
  onDismiss,
  isProcessing = false,
  className,
}: OrderCardProps) {
  // Get extraction state and actions
  const {
    extractionEnabled,
    getOrderState,
    getAvailableActions,
    executeAction,
    isLoading: isExecutingAction,
  } = useAggregatorExtractionStore();

  // Get extracted state for this order if available
  const extractedOrderId = `${order.aggregator}_${order.orderNumber}`;
  const extractedState = extractionEnabled ? getOrderState(extractedOrderId) : undefined;
  const availableAggregatorActions = extractionEnabled ? getAvailableActions(extractedOrderId) : [];

  // Handle aggregator action execution
  const handleAggregatorAction = async (button: ExtractedButton) => {
    // Only execute for swiggy or zomato aggregators
    if (order.aggregator === 'swiggy' || order.aggregator === 'zomato') {
      await executeAction(order.aggregator, extractedOrderId, button.type);
    }
  };
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

  // Format time since ready (for pending_pickup status)
  const timeSinceReady = () => {
    if (!order.readyAt) return null;
    const now = Date.now();
    const readyTime = new Date(order.readyAt).getTime();
    const diff = Math.floor((now - readyTime) / 1000 / 60);

    if (diff < 1) return 'Just ready';
    if (diff === 1) return '1 min';
    return `${diff} mins`;
  };

  // Aggregator logo/badge color
  const aggregatorColor =
    order.aggregator === 'zomato' ? 'text-red-600' :
    order.aggregator === 'swiggy' ? 'text-orange-600' :
    'text-blue-600'; // 'direct' / web orders

  // Check if order is stale (older than 30 minutes)
  const isStale = () => {
    const now = Date.now();
    const orderTime = new Date(order.createdAt).getTime();
    const diffMinutes = Math.floor((now - orderTime) / 1000 / 60);
    return diffMinutes > 30;
  };

  return (
    <NeoCard className={cn('overflow-hidden relative', className)} padding="sm">
      {/* Dismiss Button - Always visible in top-right corner */}
      {onDismiss && (
        <button
          onClick={() => onDismiss(order.orderId)}
          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center text-muted-foreground transition-colors"
          title="Dismiss order"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}

      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-3 pr-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('font-bold text-lg', aggregatorColor)}>
                {order.aggregator === 'zomato' ? 'Zomato' :
                 order.aggregator === 'swiggy' ? 'Swiggy' :
                 'Website'}
              </span>
              <span className="text-muted-foreground text-sm">#{order.orderNumber}</span>
              {isStale() && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Stale
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{timeAgo()}</div>
          </div>

          <OrderStatusPill status={order.status} />
        </div>

        {/* Customer Info - Enhanced with extracted details */}
        <div className="text-sm space-y-1">
          <div className="font-medium text-foreground">
            {extractedState?.customer?.name || order.customer.name}
          </div>
          {/* Show phone from extracted state (especially for Zomato) or from order */}
          {(extractedState?.customer?.phone || order.customer.phone) && (
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-medium">
                {extractedState?.customer?.phone || order.customer.phone}
              </span>
              {extractedState?.customer?.phone && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400">
                  Live
                </span>
              )}
            </div>
          )}
          {/* Show address if extracted */}
          {extractedState?.customer?.address && (
            <div className="text-xs text-muted-foreground line-clamp-2">
              {extractedState.customer.address}
            </div>
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

        {/* Delivery Partner Info (if available from extraction) */}
        {extractedState?.deliveryPartner && (
          <div className="neo-inset p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Delivery Partner:</span>
              <span className="text-foreground">
                {extractedState.deliveryPartner.name || extractedState.deliveryPartner.status}
              </span>
            </div>
            {extractedState.deliveryPartner.phone && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="text-foreground">{extractedState.deliveryPartner.phone}</span>
              </div>
            )}
            {extractedState.deliveryPartner.eta && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ETA:</span>
                <span className="text-foreground">{extractedState.deliveryPartner.eta}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aggregator Dashboard Actions - Mirrored from extraction */}
      {extractionEnabled && availableAggregatorActions.length > 0 && (
        <div className="p-3 border-t border-cyan-500/30 bg-cyan-900/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-cyan-400">Dashboard Actions</span>
            <span className="text-xs text-muted-foreground">
              {availableAggregatorActions.length} available
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableAggregatorActions.map((button, idx) => (
              <NeoButton
                key={idx}
                size="sm"
                variant={
                  button.type === 'accept' ? 'primary' :
                  button.type === 'reject' ? 'destructive' :
                  button.type === 'ready' ? 'default' : 'ghost'
                }
                onClick={() => handleAggregatorAction(button)}
                disabled={isExecutingAction || isProcessing}
                loading={isExecutingAction}
                className="text-xs"
              >
                {button.text || button.type}
              </NeoButton>
            ))}
          </div>
          {extractedState?.dashboardStatus && (
            <div className="text-xs text-muted-foreground mt-2">
              Dashboard status: {extractedState.dashboardStatus}
            </div>
          )}
        </div>
      )}

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

      {order.status === 'pending_pickup' && onMarkPickedUp && (
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-600 font-medium">Waiting for pickup</span>
            {timeSinceReady() && (
              <span className="text-muted-foreground">{timeSinceReady()}</span>
            )}
          </div>
          <NeoButton
            variant="primary"
            onClick={() => onMarkPickedUp(order.orderId)}
            disabled={isProcessing}
            loading={isProcessing}
            className="w-full"
          >
            Mark Picked Up
          </NeoButton>
        </div>
      )}

      {order.status === 'picked_up' && onMarkCompleted && (
        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-green-600 font-medium">Picked up by driver</span>
          </div>
          <NeoButton
            variant="default"
            onClick={() => onMarkCompleted(order.orderId)}
            disabled={isProcessing}
            loading={isProcessing}
            className="w-full"
          >
            Complete Order
          </NeoButton>
        </div>
      )}
    </NeoCard>
  );
}
