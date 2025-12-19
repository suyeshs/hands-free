/**
 * ModifierModal Component
 * Modal for selecting modifiers and adding to cart
 */

import { useState } from 'react';
import { MenuItem, CartModifier } from '../../types/pos';
import { GlassModal } from '../ui-v2/GlassModal';
import { NeoButton } from '../ui-v2/NeoButton';
import { cn } from '../../lib/utils';

export interface ModifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  onAddToCart: (menuItem: MenuItem, quantity: number, modifiers: CartModifier[], specialInstructions?: string) => void;
}

export function ModifierModal({
  isOpen,
  onClose,
  menuItem,
  onAddToCart,
}: ModifierModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());
  const [specialInstructions, setSpecialInstructions] = useState('');

  if (!menuItem) return null;

  const handleToggleModifier = (modifierId: string) => {
    setSelectedModifiers((prev) => {
      const next = new Set(prev);
      if (next.has(modifierId)) {
        next.delete(modifierId);
      } else {
        next.add(modifierId);
      }
      return next;
    });
  };

  const handleAddToCart = () => {
    const modifiers: CartModifier[] = menuItem.modifiers
      ? menuItem.modifiers
          .filter((mod) => selectedModifiers.has(mod.id))
          .map((mod) => ({
            id: mod.id,
            name: mod.name,
            price: mod.price,
          }))
      : [];

    onAddToCart(menuItem, quantity, modifiers, specialInstructions || undefined);

    // Reset and close
    setQuantity(1);
    setSelectedModifiers(new Set());
    setSpecialInstructions('');
    onClose();
  };

  const modifiersTotal = menuItem.modifiers
    ? menuItem.modifiers
        .filter((mod) => selectedModifiers.has(mod.id))
        .reduce((sum, mod) => sum + mod.price, 0)
    : 0;

  const itemTotal = (menuItem.price + modifiersTotal) * quantity;

  return (
    <GlassModal open={isOpen} onClose={onClose} title={menuItem.name}>
      <div className="space-y-6">
        {/* Description */}
        {menuItem.description && (
          <p className="text-sm text-muted-foreground">{menuItem.description}</p>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">Base Price</span>
          <span className="font-bold text-primary">₹{menuItem.price}</span>
        </div>

        {/* Modifiers */}
        {menuItem.modifiers && menuItem.modifiers.length > 0 && (
          <div>
            <h4 className="font-semibold text-foreground mb-3">Customize</h4>
            <div className="space-y-2">
              {menuItem.modifiers.map((modifier) => (
                <button
                  key={modifier.id}
                  onClick={() => handleToggleModifier(modifier.id)}
                  disabled={!modifier.available}
                  className={cn(
                    'w-full p-3 rounded-lg transition-all flex items-center justify-between',
                    selectedModifiers.has(modifier.id)
                      ? 'neo-pressed bg-primary/10 border border-primary/30'
                      : 'neo-inset',
                    !modifier.available && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        selectedModifiers.has(modifier.id)
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      )}
                    >
                      {selectedModifiers.has(modifier.id) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M13.485 1.515a2.5 2.5 0 0 1 0 3.536l-7 7a2.5 2.5 0 0 1-3.536 0l-3-3a2.5 2.5 0 1 1 3.536-3.536L5 7.03l5.485-5.515a2.5 2.5 0 0 1 3.536 0z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {modifier.name}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {modifier.price > 0 ? `+₹${modifier.price}` : 'Free'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Special Instructions */}
        <div>
          <label className="block font-semibold text-foreground mb-2 text-sm">
            Special Instructions (Optional)
          </label>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="e.g., Extra spicy, no onions..."
            className="w-full p-3 rounded-lg neo-inset bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={3}
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block font-semibold text-foreground mb-2 text-sm">
            Quantity
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 flex items-center justify-center rounded-lg neo-raised-sm hover:shadow-lg active:neo-pressed transition-neo text-foreground font-bold text-lg"
            >
              −
            </button>
            <span className="text-xl font-bold text-foreground min-w-[3ch] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-lg neo-raised-sm hover:shadow-lg active:neo-pressed transition-neo text-foreground font-bold text-lg"
            >
              +
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="neo-raised p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="text-2xl font-bold text-primary">₹{itemTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <NeoButton variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </NeoButton>
          <NeoButton variant="primary" onClick={handleAddToCart} className="flex-1">
            Add to Cart
          </NeoButton>
        </div>
      </div>
    </GlassModal>
  );
}
