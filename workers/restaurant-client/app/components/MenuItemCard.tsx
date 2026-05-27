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
  const isLocked = cartStore.isLocked;

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

  const isVeg = item.type === 'veg';

  return (
    <div
      ref={cardRef}
      className={`neu-card px-3 py-3 mb-2.5 rounded-2xl relative ${
        isHighlighted ? 'ring-4 ring-voice-listening shadow-2xl' : ''
      }`}
    >
      <div className="flex gap-3 items-start">
        {/* Left side - Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Dietary indicator + Bestseller */}
          <div className="flex items-center gap-2 mb-1">
            {/* FSSAI veg/non-veg indicator */}
            <span
              className={`inline-flex items-center justify-center w-4 h-4 rounded-sm border-2 flex-shrink-0 ${
                isVeg ? 'border-green-600' : 'border-red-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
            </span>
            {item.isBestseller && (
              <span className="text-red-500 text-[10px] font-bold tracking-wide">🔥 BESTSELLER</span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-bold neu-text leading-snug mb-1 pr-1">{item.name}</h3>

          {/* Description */}
          <p className="neu-text-secondary text-[12px] leading-relaxed line-clamp-2 mb-2">{item.description}</p>

          {/* Price & Badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-base font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">₹{item.price}</span>

            {item.rating && (
              <div className="flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                <span className="text-amber-500 text-[10px]">⭐</span>
                <span className="font-bold text-amber-700 text-[10px]">{item.rating.toFixed(1)}</span>
              </div>
            )}

            {(item as any).spiceLevel && (item as any).spiceLevel > 0 && (
              <div className="flex items-center gap-0.5 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                {Array.from({ length: (item as any).spiceLevel }).map((_, i) => (
                  <span key={i} className="text-red-500 text-[10px]">🌶️</span>
                ))}
              </div>
            )}
          </div>

          {/* ADD button */}
          <div>
            {quantity === 0 ? (
              <button
                className="bg-white text-green-600 font-bold py-1.5 px-5 rounded-lg text-xs shadow-sm hover:bg-green-600 hover:text-white transition-all duration-200 border-2 border-green-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-green-600"
                onClick={handleAddToCart}
                disabled={item.available === false || isLocked}
              >
                {item.available === false ? 'N/A' : 'ADD'}
              </button>
            ) : (
              <div className={`inline-flex bg-white rounded-lg shadow-sm border-2 overflow-hidden ${isLocked ? 'border-gray-300 opacity-50' : 'border-green-600'}`}>
                <button
                  className="px-3 py-1.5 font-bold transition-colors text-sm leading-none disabled:cursor-not-allowed text-green-600 hover:bg-green-50"
                  onClick={handleDecreaseQuantity}
                  disabled={isLocked}
                >
                  −
                </button>
                <span className={`px-3 py-1.5 font-bold border-x-2 text-sm leading-none ${isLocked ? 'bg-gray-50 border-gray-300 text-gray-500' : 'bg-green-50 border-green-600 text-green-600'}`}>{quantity}</span>
                <button
                  className="px-3 py-1.5 font-bold transition-colors text-sm leading-none disabled:cursor-not-allowed text-green-600 hover:bg-green-50"
                  onClick={handleIncreaseQuantity}
                  disabled={isLocked}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Image, responsive to screen width */}
        <div
          className="rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200"
          style={{ width: 'clamp(88px, 26vw, 120px)', height: 'clamp(88px, 26vw, 120px)' }}
        >
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-3xl">{isVeg ? '🥗' : '🍖'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default observer(MenuItemCard);
