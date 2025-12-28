/**
 * Guest Menu Item Card
 * Displays a menu item with add to cart functionality
 */

import { useState } from 'react';
import { Plus, Minus, Leaf } from 'lucide-react';
import { useGuestSessionStore } from '../../stores/guestSessionStore';
import type { GuestCartModifier } from '../../types/guest-order';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  is_veg?: boolean;
  is_vegan?: boolean;
  dietary_tags?: string[];
  modifiers?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

interface GuestMenuItemCardProps {
  item: MenuItem;
}

export function GuestMenuItemCard({ item }: GuestMenuItemCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<GuestCartModifier[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const addToCart = useGuestSessionStore((state) => state.addToCart);

  const handleAddToCart = () => {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      quantity,
      price: item.price,
      modifiers: selectedModifiers.length > 0 ? selectedModifiers : undefined,
    });

    // Reset after adding
    setQuantity(1);
    setSelectedModifiers([]);
    setShowDetails(false);
  };

  const toggleModifier = (modifier: { id: string; name: string; price: number }) => {
    setSelectedModifiers((prev) => {
      const exists = prev.find((m) => m.id === modifier.id);
      if (exists) {
        return prev.filter((m) => m.id !== modifier.id);
      }
      return [...prev, { id: modifier.id, name: modifier.name, priceAdjustment: modifier.price }];
    });
  };

  const totalPrice =
    (item.price + selectedModifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * quantity;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div
        className="flex gap-3 p-3 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* Item image */}
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl text-gray-400">
              {item.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Item details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Veg/Non-veg indicator */}
            {item.is_veg && (
              <span className="flex-shrink-0 w-4 h-4 border-2 border-green-600 rounded-sm flex items-center justify-center">
                <span className="w-2 h-2 bg-green-600 rounded-full" />
              </span>
            )}
            {item.is_vegan && (
              <Leaf className="w-4 h-4 text-green-600 flex-shrink-0" />
            )}
            <h3 className="font-medium text-gray-900 line-clamp-2">{item.name}</h3>
          </div>

          {item.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mt-1">{item.description}</p>
          )}

          <p className="text-orange-600 font-semibold mt-2">
            Rs. {item.price.toFixed(2)}
          </p>
        </div>

        {/* Quick add button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!item.modifiers?.length) {
              addToCart({
                menuItemId: item.id,
                name: item.name,
                quantity: 1,
                price: item.price,
              });
            } else {
              setShowDetails(true);
            }
          }}
          className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center hover:bg-orange-700 transition-colors self-center"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Expanded details with modifiers and quantity */}
      {showDetails && (
        <div className="border-t border-gray-200 p-3 space-y-3 bg-gray-50">
          {/* Modifiers */}
          {item.modifiers && item.modifiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Add-ons</p>
              {item.modifiers.map((modifier) => {
                const isSelected = selectedModifiers.some((m) => m.id === modifier.id);
                return (
                  <button
                    key={modifier.id}
                    onClick={() => toggleModifier(modifier)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg border ${
                      isSelected
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className="text-sm">{modifier.name}</span>
                    <span className="text-sm text-gray-600">
                      +Rs. {modifier.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quantity selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-lg font-medium w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className="px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
            >
              Add Rs. {totalPrice.toFixed(2)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
