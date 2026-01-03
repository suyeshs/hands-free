/**
 * PortionSelectionModal Component
 * Modal for selecting portion size for specific items:
 * - Rice items (Ney Kulu, Steamed Rice): Half / Full portion (half price for half)
 * - Akki Roti: 1 Pc / 2 Pc (1 pc = ₹40, 2 pc = ₹80 for dine-in/takeout)
 */

import { useState, useEffect } from 'react';
import { MenuItem, CartModifier } from '../../types/pos';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { cn } from '../../lib/utils';
import { useMenuStore } from '../../stores/menuStore';
import { usePOSStore } from '../../stores/posStore';

export type PortionSize = 'half' | 'full';
export type PieceCount = '1pc' | '2pc';

type SelectionType = 'portion' | 'piece';

export interface PortionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  onAddToCart: (
    menuItem: MenuItem,
    quantity: number,
    modifiers: CartModifier[],
    specialInstructions?: string
  ) => void;
}

/**
 * Get the selection type and config for an item
 * Uses effective dine-in price when applicable
 */
function getItemConfig(
  item: MenuItem,
  effectivePrice: number
): {
  type: SelectionType;
  defaultSelection: PortionSize | PieceCount;
  singlePrice: number;
  doublePrice: number;
  singleLabel: string;
  doubleLabel: string;
  singleEmoji: string;
  doubleEmoji: string;
  singleSuffix: string;
  doubleSuffix: string;
} {
  const name = item.name.toLowerCase().trim();

  if (name.includes('akki roti') || name.includes('akki otti')) {
    // Akki Otti/Roti: 1 Pc = ₹40, 2 Pc = ₹80 (default to 1 pc for dine-in)
    return {
      type: 'piece',
      defaultSelection: '1pc',
      singlePrice: 40,
      doublePrice: 80,
      singleLabel: '1 Pc',
      doubleLabel: '2 Pc',
      singleEmoji: '🫓',
      doubleEmoji: '🫓🫓',
      singleSuffix: '(1 Pc)',
      doubleSuffix: '(2 Pc)',
    };
  }

  // Rice items: Half/Full portion (half = 50% of effective dine-in price)
  return {
    type: 'portion',
    defaultSelection: 'full',
    singlePrice: Math.round(effectivePrice / 2),
    doublePrice: effectivePrice,
    singleLabel: 'Half',
    doubleLabel: 'Full',
    singleEmoji: '🍚',
    doubleEmoji: '🍚🍚',
    singleSuffix: '(Half)',
    doubleSuffix: '',
  };
}

export function PortionSelectionModal({
  isOpen,
  onClose,
  menuItem,
  onAddToCart,
}: PortionSelectionModalProps) {
  const [selectedOption, setSelectedOption] = useState<PortionSize | PieceCount>('full');
  const [quantity, setQuantity] = useState(1);

  // Get effective price based on order type (dine-in/takeout uses dine-in pricing)
  const { getEffectivePrice } = useMenuStore();
  const { orderType } = usePOSStore();
  const usesDineInPricing = orderType === 'dine-in' || orderType === 'takeout';

  // Get the effective price for this item
  const effectivePrice = menuItem ? getEffectivePrice(menuItem.id, usesDineInPricing) : 0;

  // Reset selection when item changes
  useEffect(() => {
    if (menuItem) {
      const config = getItemConfig(menuItem, effectivePrice);
      setSelectedOption(config.defaultSelection);
      setQuantity(1);
    }
  }, [menuItem?.id, effectivePrice]);

  if (!menuItem) return null;

  const config = getItemConfig(menuItem, effectivePrice);
  const isSingleSelected = selectedOption === 'half' || selectedOption === '1pc';
  const selectedPrice = isSingleSelected ? config.singlePrice : config.doublePrice;
  const itemTotal = selectedPrice * quantity;

  const handleAddToCart = () => {
    const suffix = isSingleSelected ? config.singleSuffix : config.doubleSuffix;
    const adjustedMenuItem: MenuItem = {
      ...menuItem,
      price: selectedPrice,
      name: suffix ? `${menuItem.name} ${suffix}` : menuItem.name,
    };

    onAddToCart(adjustedMenuItem, quantity, [], undefined);

    // Reset and close
    setSelectedOption(config.defaultSelection);
    setQuantity(1);
    onClose();
  };

  const handleClose = () => {
    setSelectedOption(config.defaultSelection);
    setQuantity(1);
    onClose();
  };

  const handleSelectSingle = () => {
    setSelectedOption(config.type === 'piece' ? '1pc' : 'half');
  };

  const handleSelectDouble = () => {
    setSelectedOption(config.type === 'piece' ? '2pc' : 'full');
  };

  return (
    <IndustrialModal open={isOpen} onClose={handleClose} title={menuItem.name} size="md">
      <div className="space-y-6">
        {/* Item Info */}
        <div className="bg-gray-50 p-4 border border-gray-200">
          <p className="text-gray-700 font-medium text-lg leading-relaxed">
            {menuItem.description || `Select ${config.type === 'piece' ? 'quantity' : 'portion size'}`}
          </p>
        </div>

        {/* Selection */}
        <div>
          <h4 className="font-black text-slate-800 uppercase tracking-wide mb-4 border-b-2 border-slate-200 pb-2">
            {config.type === 'piece' ? 'Select Quantity' : 'Select Portion Size'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {/* Single Option (Half / 1 Pc) */}
            <button
              onClick={handleSelectSingle}
              className={cn(
                'p-6 border-4 rounded-xl flex flex-col items-center justify-center transition-all',
                isSingleSelected
                  ? 'bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-500/20'
                  : 'bg-white border-gray-300 hover:border-gray-400'
              )}
            >
              <span className="text-4xl mb-2">{config.singleEmoji}</span>
              <span
                className={cn(
                  'font-black text-xl uppercase',
                  isSingleSelected ? 'text-emerald-600' : 'text-slate-800'
                )}
              >
                {config.singleLabel}
              </span>
              <span
                className={cn(
                  'font-black text-2xl mt-2',
                  isSingleSelected ? 'text-emerald-600' : 'text-slate-600'
                )}
              >
                ₹{config.singlePrice}
              </span>
            </button>

            {/* Double Option (Full / 2 Pc) */}
            <button
              onClick={handleSelectDouble}
              className={cn(
                'p-6 border-4 rounded-xl flex flex-col items-center justify-center transition-all',
                !isSingleSelected
                  ? 'bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-500/20'
                  : 'bg-white border-gray-300 hover:border-gray-400'
              )}
            >
              <span className="text-4xl mb-2">{config.doubleEmoji}</span>
              <span
                className={cn(
                  'font-black text-xl uppercase',
                  !isSingleSelected ? 'text-emerald-600' : 'text-slate-800'
                )}
              >
                {config.doubleLabel}
              </span>
              <span
                className={cn(
                  'font-black text-2xl mt-2',
                  !isSingleSelected ? 'text-emerald-600' : 'text-slate-600'
                )}
              >
                ₹{config.doublePrice}
              </span>
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block font-black text-slate-800 uppercase tracking-wide mb-2">
            How Many Orders?
          </label>
          <div className="flex items-center gap-0 border-2 border-slate-800 bg-white">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-16 h-16 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 font-black text-3xl text-slate-800 flex items-center justify-center border-r-2 border-slate-800"
            >
              −
            </button>
            <div className="flex-1 text-center font-black text-4xl text-slate-900">{quantity}</div>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-16 h-16 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 font-black text-3xl text-slate-800 flex items-center justify-center border-l-2 border-slate-800"
            >
              +
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-2 border-black rounded-lg">
          <span className="font-bold uppercase tracking-wider">Total Amount</span>
          <span className="font-black text-3xl">₹{itemTotal}</span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          <IndustrialButton variant="secondary" onClick={handleClose} size="lg">
            CANCEL
          </IndustrialButton>
          <IndustrialButton variant="success" onClick={handleAddToCart} size="lg">
            ADD TO CART
          </IndustrialButton>
        </div>
      </div>
    </IndustrialModal>
  );
}

/**
 * Helper function to check if a menu item needs portion/piece selection
 * Applies to:
 * - Ney Kulu and Steamed Rice (half/full portion)
 * - Akki Otti/Roti (1 pc / 2 pc)
 */
export function needsPortionSelection(item: MenuItem): boolean {
  const name = item.name.toLowerCase().trim();
  return (
    name.includes('ney kulu') ||
    name.includes('steamed rice') ||
    name.includes('akki roti') ||
    name.includes('akki otti')
  );
}
