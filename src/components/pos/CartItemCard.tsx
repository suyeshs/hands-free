/**
 * CartItemCard Component
 * Displays cart item with quantity controls
 */

import { CartItem } from '../../types/pos';
import { cn } from '../../lib/utils';

export interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (cartItemId: string, quantity: number) => void;
  onRemove: (cartItemId: string) => void;
  className?: string;
}

export function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
  className,
}: CartItemCardProps) {
  return (
    <div className={cn('neo-inset p-3', className)}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground text-sm leading-tight">
            {item.menuItem.name}
          </div>
          {item.modifiers.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {item.modifiers.map((mod) => mod.name).join(', ')}
            </div>
          )}
          {item.specialInstructions && (
            <div className="text-xs text-primary mt-1 italic">
              Note: {item.specialInstructions}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold text-foreground text-sm">
            ₹{item.subtotal.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">
            ₹{((item.menuItem.price + item.modifiers.reduce((sum, m) => sum + m.price, 0))).toFixed(2)} each
          </div>
        </div>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg neo-raised-sm hover:shadow-lg active:neo-pressed transition-neo text-foreground font-bold"
          >
            −
          </button>
          <span className="w-8 text-center font-semibold text-foreground">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg neo-raised-sm hover:shadow-lg active:neo-pressed transition-neo text-foreground font-bold"
          >
            +
          </button>
        </div>

        <button
          onClick={() => onRemove(item.id)}
          className="text-xs text-destructive hover:text-destructive/80 font-medium"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
