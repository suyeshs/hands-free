/**
 * Custom Item Modal
 * Allows adding a custom/misc item with name and price for dine-in orders
 *
 * Custom items are stored with category "Custom" and appear in:
 * - Cart and order with custom name
 * - KOT sent to kitchen
 * - Bill print with line item
 * - Sales transactions for reporting (grouped under "Custom" category)
 */

import { useState, useRef, useEffect } from 'react';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { X, Plus, Minus } from 'lucide-react';
import { MenuItem } from '../../types/pos';

interface CustomItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (menuItem: MenuItem, quantity: number) => void;
}

export function CustomItemModal({ isOpen, onClose, onAdd }: CustomItemModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setPrice('');
      setQuantity(1);
      setError('');
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    // Validate
    if (!name.trim()) {
      setError('Please enter item name');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price');
      return;
    }

    // Create a MenuItem object for the custom item
    // This ensures it flows through the same path as regular menu items
    // and appears correctly in cart, orders, bills, and reports
    const customMenuItem: MenuItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      price: priceNum,
      category: 'Custom', // Special category for reporting
      available: true,
      tags: ['custom'],
    };

    onAdd(customMenuItem, quantity);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Quick price buttons
  const quickPrices = [50, 100, 150, 200, 250, 500];

  return (
    <IndustrialModal
      open={isOpen}
      onClose={onClose}
      title="Add Custom Item"
      size="md"
    >
      <div className="p-4 space-y-4">
        {/* Item Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Item Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Extra Gravy, Special Request..."
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Price Input */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Price (₹)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="0"
            min="0"
            step="0.01"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Quick Price Buttons */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Quick Select
          </label>
          <div className="grid grid-cols-6 gap-2">
            {quickPrices.map((p) => (
              <button
                key={p}
                onClick={() => setPrice(p.toString())}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  price === p.toString()
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                ₹{p}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Quantity
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-12 h-12 rounded-lg bg-zinc-700 text-white flex items-center justify-center disabled:opacity-50 hover:bg-zinc-600"
            >
              <Minus size={20} />
            </button>
            <span className="text-2xl font-bold text-white w-12 text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-12 h-12 rounded-lg bg-zinc-700 text-white flex items-center justify-center hover:bg-zinc-600"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Total Preview */}
        {name && price && !isNaN(parseFloat(price)) && (
          <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-white font-medium">{name}</div>
                <div className="text-zinc-400 text-sm">
                  ₹{parseFloat(price).toFixed(2)} × {quantity}
                </div>
              </div>
              <div className="text-xl font-bold text-emerald-400">
                ₹{(parseFloat(price) * quantity).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <IndustrialButton
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            <X size={18} className="mr-2" />
            Cancel
          </IndustrialButton>
          <IndustrialButton
            variant="primary"
            onClick={handleSubmit}
            disabled={!name.trim() || !price}
            className="flex-1"
          >
            <Plus size={18} className="mr-2" />
            Add to Order
          </IndustrialButton>
        </div>
      </div>
    </IndustrialModal>
  );
}
