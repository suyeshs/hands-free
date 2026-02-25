'use client';
import { observer } from 'mobx-react-lite';
import { cartStore } from '../stores/cartStore';
import { menuStore } from '../stores/menuStore';
import { MenuItemCardProps } from '../types/types';
import { useState, useEffect, useRef } from 'react';

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, highlighted }) => {
  const [quantity, setQuantity] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHighlighted = highlighted || menuStore.isHighlighted(item.name);

  useEffect(() => {
    const cartItem = cartStore.items.find(i => i.name === item.name && i.type === item.type);
    setQuantity(cartItem ? cartItem.quantity : 0);
  }, [item.name, item.type, cartStore.items.length]);

  // Scroll into view when highlighted
  useEffect(() => {
    if (menuStore.scrollToItemName === item.name && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      menuStore.clearScrollTarget();
    }
  }, [menuStore.scrollToItemName, item.name]);

  const handleAddToCart = () => {
    cartStore.addMenuItem(item);
    setQuantity(1);
  };

  const handleIncreaseQuantity = () => {
    cartStore.updateQuantity(item.name, item.type as 'veg' | 'non-veg', quantity + 1);
    setQuantity(quantity + 1);
  };

  const handleDecreaseQuantity = () => {
    if (quantity > 1) {
      cartStore.updateQuantity(item.name, item.type as 'veg' | 'non-veg', quantity - 1);
      setQuantity(quantity - 1);
    } else if (quantity === 1) {
      cartStore.removeItem(item.name, item.type as 'veg' | 'non-veg');
      setQuantity(0);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`neu-card p-3 mb-3 rounded-xl relative ${
        isHighlighted ? 'ring-4 ring-voice-listening shadow-2xl' : ''
      }`}
    >
      <div className="flex gap-3">
        {/* Left side - Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Top section - Title, Price, Badges */}
          <div>
            {/* Bestseller Badge */}
            {item.isBestseller && (
              <div className="flex items-center gap-1 mb-1">
                <span className="text-red-500 text-xs">🔥</span>
                <span className="text-red-500 text-xs font-bold">BESTSELLER</span>
              </div>
            )}

            {/* Title */}
            <h3 className="text-base font-bold neu-text leading-tight mb-1">{item.name}</h3>

            {/* Price & Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-lg font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">₹{item.price}</span>

              {item.rating && (
                <div className="flex items-center gap-0.5 bg-gradient-to-r from-amber-50 to-yellow-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <span className="text-amber-500 text-xs">⭐</span>
                  <span className="font-bold text-amber-700 text-xs">{item.rating.toFixed(1)}</span>
                </div>
              )}

              {(item as any).spiceLevel && (item as any).spiceLevel > 0 && (
                <div className="flex items-center gap-0.5 bg-gradient-to-r from-red-50 to-orange-50 px-1.5 py-0.5 rounded border border-red-200">
                  {Array.from({ length: (item as any).spiceLevel }).map((_, i) => (
                    <span key={i} className="text-red-500 text-xs">🌶️</span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <p className="neu-text-secondary text-xs leading-snug line-clamp-2">{item.description}</p>
          </div>

          {/* Bottom section - ADD button */}
          <div className="mt-2">
            {quantity === 0 ? (
              <button
                className="bg-white text-green-600 font-bold py-1.5 px-4 rounded-lg text-xs shadow-md hover:bg-green-600 hover:text-white transition-all duration-200 border-2 border-green-600"
                onClick={handleAddToCart}
                disabled={item.available === false}
              >
                {item.available === false ? 'N/A' : 'ADD'}
              </button>
            ) : (
              <div className="bg-white rounded-lg shadow-md flex items-center border-2 border-green-600 inline-flex">
                <button
                  className="px-3 py-1 text-green-600 font-bold hover:bg-green-50 transition-colors text-sm"
                  onClick={handleDecreaseQuantity}
                >
                  -
                </button>
                <span className="px-3 py-1 text-green-600 font-bold bg-green-50 border-x-2 border-green-600 text-sm">{quantity}</span>
                <button
                  className="px-3 py-1 text-green-600 font-bold hover:bg-green-50 transition-colors text-sm"
                  onClick={handleIncreaseQuantity}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Image */}
        <div className="w-24 h-24 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <span className="text-3xl">{item.type === 'veg' ? '🥗' : '🍖'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default observer(MenuItemCard);
