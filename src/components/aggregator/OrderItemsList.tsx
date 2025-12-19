/**
 * OrderItemsList Component
 * Displays list of order items with optional compact mode
 * Compact mode: Single-line condensed view for space efficiency
 * Regular mode: Detailed view with variants, addons, and instructions
 */

import { AggregatorOrderItem } from '../../types/aggregator';
import { cn } from '../../lib/utils';

export interface OrderItemsListProps {
  items: AggregatorOrderItem[];
  className?: string;
  showPrices?: boolean;
  compact?: boolean; // New prop for compact mode
}

export function OrderItemsList({
  items,
  className,
  showPrices = true,
  compact = false,
}: OrderItemsListProps) {
  if (!items || items.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-4">
        No items in this order
      </div>
    );
  }

  // Compact mode - single line per item
  if (compact) {
    return (
      <div className={cn('space-y-1', className)}>
        {items.map((item, index) => (
          <div
            key={item.id || index}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-foreground truncate">
              <span className="font-medium">{item.quantity}x</span> {item.name}
            </span>
            {showPrices && (
              <span className="text-foreground font-semibold flex-shrink-0">
                ₹{item.total.toFixed(0)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Regular mode - detailed view
  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, index) => (
        <div
          key={item.id || index}
          className="neo-inset p-3 flex items-start justify-between gap-4"
        >
          <div className="flex-1 min-w-0">
            {/* Item Name and Quantity */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-medium text-foreground">
                {item.quantity}x
              </span>
              <span className="text-foreground font-medium">{item.name}</span>
            </div>

            {/* Variants */}
            {item.variants && item.variants.length > 0 && (
              <div className="text-xs text-muted-foreground mb-1">
                {item.variants.join(', ')}
              </div>
            )}

            {/* Addons */}
            {item.addons && item.addons.length > 0 && (
              <div className="text-xs text-muted-foreground mb-1">
                + {item.addons.map((addon: any) => addon.name || addon).join(', ')}
              </div>
            )}

            {/* Special Instructions */}
            {item.specialInstructions && (
              <div className="text-xs text-muted-foreground italic mt-2">
                Note: {item.specialInstructions}
              </div>
            )}
          </div>

          {/* Price */}
          {showPrices && (
            <div className="text-right flex-shrink-0">
              <div className="text-foreground font-semibold">
                ₹{item.total.toFixed(2)}
              </div>
              {item.quantity > 1 && (
                <div className="text-xs text-muted-foreground">
                  ₹{item.price.toFixed(2)} each
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Summary */}
      {showPrices && (
        <div className="pt-3 border-t border-border flex justify-between text-sm">
          <span className="text-muted-foreground">
            {items.reduce((sum, item) => sum + item.quantity, 0)} items total
          </span>
          <span className="font-semibold text-foreground">
            ₹{items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
