/**
 * MenuItemCard Component
 * Displays a menu item with add to cart action
 */

import { MenuItem } from '../../types/pos';
import { NeoCard } from '../ui-v2/NeoCard';
import { cn } from '../../lib/utils';

export interface MenuItemCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  className?: string;
}

export function MenuItemCard({ item, onAddToCart, className }: MenuItemCardProps) {
  const isVeg = item.tags?.includes('veg');
  const isNonVeg = item.tags?.includes('non-veg');
  const isSpicy = item.tags?.includes('spicy');

  return (
    <NeoCard
      variant="raised"
      hoverable
      padding="none"
      className={cn('overflow-hidden', !item.available && 'opacity-50', className)}
    >
      <button
        onClick={() => item.available && onAddToCart(item)}
        disabled={!item.available}
        className="w-full text-left"
      >
        {/* Image placeholder */}
        <div className="h-32 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center relative">
          <span className="text-4xl opacity-50">🍽️</span>

          {/* Tags */}
          <div className="absolute top-2 left-2 flex gap-1">
            {isVeg && (
              <span className="w-5 h-5 bg-green-600 rounded-sm flex items-center justify-center">
                <span className="w-3 h-3 border-2 border-white rounded-full" />
              </span>
            )}
            {isNonVeg && (
              <span className="w-5 h-5 bg-red-600 rounded-sm flex items-center justify-center">
                <span className="w-3 h-3 border-2 border-white rounded-full" />
              </span>
            )}
            {isSpicy && <span className="text-xs">🌶️</span>}
          </div>

          {/* Availability */}
          {!item.available && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <span className="text-sm font-semibold text-muted-foreground">Unavailable</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-foreground leading-tight">{item.name}</h3>
            <span className="text-sm font-bold text-primary flex-shrink-0">
              ₹{item.price}
            </span>
          </div>

          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {item.description}
            </p>
          )}

          {item.preparationTime && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>⏱️</span>
              <span>{item.preparationTime} min</span>
            </div>
          )}

          {item.modifiers && item.modifiers.length > 0 && (
            <div className="text-xs text-primary mt-2">
              Customizable
            </div>
          )}
        </div>
      </button>
    </NeoCard>
  );
}
