'use client';
import { observer } from 'mobx-react-lite';
import { cartStore } from '../stores/cartStore';
import { menuStore } from '../stores/menuStore';
import { ComboCardProps } from '../types/types';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ComboCard: React.FC<ComboCardProps> = ({ item, highlighted }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(item.choices[0]);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHighlighted = highlighted || menuStore.isHighlighted(item.name);

  // Scroll into view when highlighted
  useEffect(() => {
    if (menuStore.scrollToItemName === item.name && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      menuStore.clearScrollTarget();
    }
  }, [menuStore.scrollToItemName, item.name]);

  const handleAddToCart = () => {
    cartStore.addComboItem(item, selectedChoice);
  };

  const handleChoiceSelect = (choice: string) => {
    setSelectedChoice(choice);
    setIsExpanded(false);
  };

  return (
    <div
      ref={cardRef}
      className={`neu-card overflow-hidden hover-lift transition-all duration-normal ${
        isHighlighted ? 'ring-4 ring-voice-listening shadow-2xl' : ''
      }`}
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-xl overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">{item.type === 'veg' ? '🥗' : '🍽️'}</span>
          </div>
        )}
        {item.tag && (
          <div className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
            <span>🔥</span>
            <span>{item.tag}</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-xl font-bold neu-text mb-1">{item.name}</h3>
            <span className="inline-block px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs font-bold uppercase tracking-wide rounded-full">
              Combo Meal
            </span>
          </div>
          <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">₹{item.price}</div>
        </div>

        {/* Rating, Spice Level & Type */}
        <div className="flex items-center gap-2 flex-wrap">
          {item.rating && (
            <div className="flex items-center gap-1 bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm">
              <span className="text-amber-500">⭐</span>
              <span className="font-bold text-amber-700 text-sm">{item.rating.toFixed(1)}</span>
              {item.reviews && (
                <span className="text-xs text-amber-600">({item.reviews})</span>
              )}
            </div>
          )}
          {(item as any).spiceLevel && (item as any).spiceLevel > 0 && (
            <div className="flex items-center gap-0.5 bg-gradient-to-r from-red-50 to-orange-50 px-3 py-1.5 rounded-lg border border-red-200 shadow-sm">
              {Array.from({ length: (item as any).spiceLevel }).map((_, i) => (
                <span key={i} className="text-red-500">🌶️</span>
              ))}
            </div>
          )}
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
            item.type === 'veg'
              ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-2 border-green-500'
              : 'bg-gradient-to-r from-red-100 to-orange-100 text-red-700 border-2 border-red-500'
          }`}>
            {item.type === 'veg' ? '🌱 Veg' : '🍖 Non-Veg'}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm neu-text-secondary leading-relaxed">
          {item.description}
        </p>

        {/* Selected Choice with Change Button */}
        {selectedChoice && (
          <div className="neu-concave p-3 rounded-lg flex items-center justify-between">
            <p className="text-sm font-semibold neu-text">{selectedChoice}</p>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-4 py-1.5 text-sm font-semibold text-info hover:text-info/80 neu-button-secondary rounded-md"
            >
              {isExpanded ? 'Hide' : 'Change'}
            </button>
          </div>
        )}

        {/* Choices Dropdown with Animation */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="neu-concave rounded-lg overflow-hidden"
            >
              <p className="text-xs font-semibold neu-text p-3 border-b border-gray-200">
                Choose your option:
              </p>
              <div className="divide-y divide-gray-200">
                {item.choices.map((choice, idx) => (
                  <label
                    key={idx}
                    className="flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="combo-choice"
                      value={choice}
                      checked={selectedChoice === choice}
                      onChange={() => handleChoiceSelect(choice)}
                      className="mr-3"
                    />
                    <span className="text-sm neu-text">{choice}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add to Order Button */}
        <button
          onClick={handleAddToCart}
          disabled={item.available === false}
          className={`w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl px-6 py-3.5 text-base font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] ${
            item.available === false ? 'opacity-50 cursor-not-allowed grayscale' : ''
          }`}
        >
          {item.available === false ? 'Not Available' : `Add to Order • ₹${item.price}`}
        </button>
      </div>
    </div>
  );
};

export default observer(ComboCard);
