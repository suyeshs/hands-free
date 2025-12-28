/**
 * Quick Order Modal
 *
 * Minimalistic order interface for fast service:
 * - Large industrial buttons (no images)
 * - Category tabs
 * - Running total
 * - Designed for greasy/quick touch
 */

import { useState, useMemo } from 'react';
import { useMenuStore } from '../../stores/menuStore';
import { usePOSStore } from '../../stores/posStore';
import { MenuItem as DBMenuItem } from '../../types';
import { MenuItem as POSMenuItem } from '../../types/pos';
import { cn } from '../../lib/utils';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: number | null;
  onSendToKitchen: () => void;
}

interface QuickCartItem {
  menuItem: DBMenuItem;
  quantity: number;
}

// Convert DB MenuItem to POS MenuItem for addToCart
function convertToPOSMenuItem(item: DBMenuItem): POSMenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category_id,
    price: item.price,
    image: item.image || item.imageUrl || undefined,
    available: item.active,
    preparationTime: item.preparation_time,
    tags: item.dietary_tags,
    isCombo: item.is_combo,
    comboGroups: item.combo_groups?.map(g => ({
      id: g.id,
      name: g.name,
      required: g.required,
      minSelections: g.min_selections,
      maxSelections: g.max_selections,
      items: g.items.map(gi => ({
        id: gi.id,
        name: gi.name,
        description: gi.description,
        image: gi.image,
        priceAdjustment: gi.price_adjustment,
        available: gi.available,
        tags: gi.tags,
      })),
    })),
  };
}

export function QuickOrderModal({
  isOpen,
  onClose,
  tableNumber,
  onSendToKitchen,
}: QuickOrderModalProps) {
  const { items: menuItems, categories } = useMenuStore();
  const { addToCart } = usePOSStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quickCart, setQuickCart] = useState<QuickCartItem[]>([]);

  // Filter menu items by category
  const filteredItems = useMemo(() => {
    const activeItems = menuItems.filter(item => item.active);
    if (selectedCategory === 'all') {
      return activeItems;
    }
    return activeItems.filter(item => item.category_id === selectedCategory);
  }, [menuItems, selectedCategory]);

  // Quick cart total
  const quickTotal = useMemo(() => {
    return quickCart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  }, [quickCart]);

  const handleItemClick = (item: DBMenuItem) => {
    setQuickCart(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.menuItem.id === item.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setQuickCart(prev => {
      return prev
        .map(item => {
          if (item.menuItem.id === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as QuickCartItem[];
    });
  };

  const handleSendToKitchen = () => {
    // Add all quick cart items to main cart
    quickCart.forEach(item => {
      const posItem = convertToPOSMenuItem(item.menuItem);
      // addToCart(menuItem, quantity, modifiers, specialInstructions, comboSelections)
      addToCart(posItem, item.quantity, []);
    });
    // Clear quick cart
    setQuickCart([]);
    // Trigger send to kitchen
    onSendToKitchen();
    onClose();
  };

  const handleClear = () => {
    setQuickCart([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-slate-900 w-full h-full flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">
              QUICK ORDER {tableNumber ? `- TABLE ${tableNumber}` : ''}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-4"
          >
            X
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Menu */}
          <div className="flex-1 flex flex-col">
            {/* Category tabs */}
            <div className="bg-slate-800 p-2 flex gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors',
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                )}
              >
                ALL
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors',
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  {cat.name.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Item grid */}
            <div className="flex-1 overflow-auto p-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      'bg-slate-800 hover:bg-slate-700 active:bg-slate-600',
                      'border-2 border-slate-600 hover:border-blue-500',
                      'rounded-lg p-3 text-left transition-all',
                      'min-h-[80px] flex flex-col justify-between'
                    )}
                  >
                    <span className="text-white font-bold text-sm line-clamp-2">
                      {item.name}
                    </span>
                    <span className="text-green-400 font-bold text-sm">
                      {item.price}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Quick cart */}
          <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white">ORDER</h3>
              <button
                onClick={handleClear}
                className="text-red-400 hover:text-red-300 text-sm font-bold"
              >
                CLEAR
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-auto p-2">
              {quickCart.length === 0 ? (
                <div className="text-slate-500 text-center py-8">
                  Tap items to add
                </div>
              ) : (
                <div className="space-y-2">
                  {quickCart.map(item => (
                    <div
                      key={item.menuItem.id}
                      className="bg-slate-700 rounded-lg p-2 flex items-center gap-2"
                    >
                      {/* Quantity controls */}
                      <button
                        onClick={() => handleQuantityChange(item.menuItem.id, -1)}
                        className="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-xl"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-lg">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.menuItem.id, 1)}
                        className="w-10 h-10 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-xl"
                      >
                        +
                      </button>

                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-bold truncate">
                          {item.menuItem.name}
                        </div>
                        <div className="text-green-400 text-sm">
                          {item.menuItem.price * item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total and send button */}
            <div className="p-3 border-t border-slate-700 space-y-3">
              <div className="flex justify-between text-xl font-bold">
                <span className="text-slate-300">TOTAL</span>
                <span className="text-green-400">{quickTotal}</span>
              </div>

              <button
                onClick={handleSendToKitchen}
                disabled={quickCart.length === 0}
                className={cn(
                  'w-full py-4 rounded-xl font-bold text-xl transition-all',
                  quickCart.length > 0
                    ? 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                )}
              >
                SEND TO KITCHEN
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
