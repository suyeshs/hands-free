/**
 * Bar POS - Dedicated Point of Sale for Bar Operations
 * Standalone bar ordering system with drink selection, modifiers, and tab management
 * Features: Quick drink selection, cart management, table/tab support, send to BDS
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Trash2,
  Send,
  Star,
  Plus,
  Minus,




  X,
  Home,
} from 'lucide-react';
import { useBarPOSStore } from '../stores/barPOSStore';
import { useMenuStore } from '../stores/menuStore';
// import { useAuthStore } from '../stores/authStore'; // Unused after switching to loadMenuFromDatabase
import { cn } from '../lib/utils';
import type { MenuItem } from '../types';

const ICE_OPTIONS = ['regular', 'no-ice', 'extra-ice', 'crushed'];
const STRENGTH_OPTIONS = ['single', 'double', 'triple'];
const SERVING_SIZES = ['shot', 'peg', 'glass', 'bottle', 'pitcher'];

export default function BarPOS() {
  const navigate = useNavigate();
  // const { user } = useAuthStore(); // Unused after switching to loadMenuFromDatabase
  const { categories, items: menuItems, loadMenuFromDatabase } = useMenuStore();
  const {
    cart,
    currentTable,
    favoriteItems,
    defaultIce,
    defaultStrength,
    addToCart,
    updateCartItem,
    removeFromCart,
    setTable,
    sendToBar,
    calculateTotal,
    toggleFavorite,
  } = useBarPOSStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [modifierModal, setModifierModal] = useState<{
    item: MenuItem;
    cartItemId?: string;
  } | null>(null);

  // Modifier state
  const [selectedIce, setSelectedIce] = useState(defaultIce);
  const [selectedStrength, setSelectedStrength] = useState(defaultStrength);
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Load menu on mount
  useEffect(() => {
    loadMenuFromDatabase();
  }, [loadMenuFromDatabase]);

  // Filter menu items for bar categories
  const barCategories = categories.filter((cat) =>
    ['beverages', 'drinks', 'bar', 'cocktails', 'beer', 'wine', 'spirits'].some((keyword) =>
      cat.name.toLowerCase().includes(keyword)
    )
  );

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems.filter((item) =>
          barCategories.some((cat) => cat.id === item.category_id)
        )
      : menuItems.filter((item) => item.category_id === selectedCategory);

  const favorites = menuItems.filter((item) => favoriteItems.includes(item.id));

  const { subtotal, tax, serviceCharge, total } = calculateTotal();

  // Handle quick add (no modifiers)
  const handleQuickAdd = (item: MenuItem) => {
    addToCart(item, {
      ice: defaultIce,
      strength: defaultStrength,
    });
  };

  // Handle add with modifiers
  const handleAddWithModifiers = (item: MenuItem) => {
    setModifierModal({ item });
    setSelectedIce(defaultIce);
    setSelectedStrength(defaultStrength);
    setSelectedSize(undefined);
    setSpecialInstructions('');
  };

  const handleConfirmModifiers = () => {
    if (!modifierModal) return;

    if (modifierModal.cartItemId) {
      // Update existing cart item
      updateCartItem(modifierModal.cartItemId, {
        ice: selectedIce,
        strength: selectedStrength,
        servingSize: selectedSize,
        specialInstructions,
      });
    } else {
      // Add new item with modifiers
      addToCart(modifierModal.item, {
        ice: selectedIce,
        strength: selectedStrength,
        servingSize: selectedSize,
        specialInstructions,
      });
    }

    setModifierModal(null);
  };

  const handleSendToBar = async () => {
    if (cart.length === 0) return;
    await sendToBar();
    // Show success message
    console.log('[BarPOS] Order sent to bar successfully');
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-purple-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/hub')}
            className="p-2 hover:bg-white/10 transition"
          >
            <Home className="w-6 h-6 text-purple-400" />
          </button>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            🍸 BAR POS
          </h1>
        </div>

        {/* Table Selection */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Table:</span>
          <input
            type="number"
            value={currentTable || ''}
            onChange={(e) => setTable(parseInt(e.target.value) || 0)}
            placeholder="No table"
            className="w-24 px-3 py-2 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Menu Selection */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category Tabs */}
          <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-2 flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2  font-medium whitespace-nowrap transition',
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
            >
              All Drinks
            </button>
            {selectedCategory === 'all' && favorites.length > 0 && (
              <button
                onClick={() => setSelectedCategory('favorites')}
                className="px-4 py-2 font-medium whitespace-nowrap bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-2"
              >
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                Favorites ({favorites.length})
              </button>
            )}
            {barCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'px-4 py-2  font-medium whitespace-nowrap transition',
                  selectedCategory === cat.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                )}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedCategory === 'favorites' && favorites.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <Star className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No favorite drinks yet</p>
                  <p className="text-sm">Click the star icon to add favorites</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {(selectedCategory === 'favorites' ? favorites : filteredItems).map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-800 p-4 border border-slate-700 hover:border-purple-500 transition group relative"
                  >
                    {/* Favorite Star */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className="absolute top-2 right-2 p-1 hover:bg-slate-700 rounded"
                    >
                      <Star
                        className={cn(
                          'w-4 h-4',
                          favoriteItems.includes(item.id)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-slate-500'
                        )}
                      />
                    </button>

                    <div className="text-4xl mb-2">
                      {item.name.toLowerCase().includes('beer')
                        ? '🍺'
                        : item.name.toLowerCase().includes('wine')
                          ? '🍷'
                          : item.name.toLowerCase().includes('cocktail')
                            ? '🍹'
                            : item.name.toLowerCase().includes('coffee')
                              ? '☕'
                              : '🍸'}
                    </div>

                    <h3 className="font-bold text-white mb-1 pr-6">{item.name}</h3>
                    <p className="text-2xl font-bold text-purple-400 mb-3">
                      ₹{item.price}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleQuickAdd(item)}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 px-3 font-medium transition flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Quick
                      </button>
                      <button
                        onClick={() => handleAddWithModifiers(item)}
                        className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 font-medium transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col">
          {/* Cart Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <ShoppingCart className="w-5 h-5" />
              <span className="font-bold">Cart ({cart.length})</span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => useBarPOSStore.getState().clearCart()}
                className="text-white/80 hover:text-white transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Cart is empty</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-700 p-3 border border-slate-600"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{item.name}</h4>
                        <div className="text-xs text-slate-400 space-y-1 mt-1">
                          {item.strength && (
                            <div>Strength: {item.strength}</div>
                          )}
                          {item.ice && <div>Ice: {item.ice}</div>}
                          {item.servingSize && (
                            <div>Size: {item.servingSize}</div>
                          )}
                          {item.specialInstructions && (
                            <div className="text-yellow-400">
                              Note: {item.specialInstructions}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateCartItem(item.id, {
                              quantity: Math.max(1, item.quantity - 1),
                            })
                          }
                          className="p-1 bg-slate-600 hover:bg-slate-500 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-medium text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateCartItem(item.id, {
                              quantity: item.quantity + 1,
                            })
                          }
                          className="p-1 bg-slate-600 hover:bg-slate-500 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-purple-400">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Total */}
          {cart.length > 0 && (
            <>
              <div className="border-t border-slate-700 p-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax (5%):</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Service (10%):</span>
                  <span>₹{serviceCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-slate-600">
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Send to Bar Button */}
              <div className="p-4 bg-slate-900">
                <button
                  onClick={handleSendToBar}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-4 px-6 font-bold text-lg transition flex items-center justify-center gap-3 shadow-lg"
                >
                  <Send className="w-6 h-6" />
                  Send to Bar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modifier Modal */}
      {modifierModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Customize: {modifierModal.item.name}
              </h2>
              <button
                onClick={() => setModifierModal(null)}
                className="text-white/80 hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Ice */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ice Preference
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ICE_OPTIONS.map((ice) => (
                    <button
                      key={ice}
                      onClick={() => setSelectedIce(ice)}
                      className={cn(
                        'py-3 px-4  font-medium transition',
                        selectedIce === ice
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      {ice.replace('-', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strength */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Strength
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STRENGTH_OPTIONS.map((strength) => (
                    <button
                      key={strength}
                      onClick={() => setSelectedStrength(strength)}
                      className={cn(
                        'py-3 px-4  font-medium transition',
                        selectedStrength === strength
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      {strength.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Serving Size */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Serving Size (Optional)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SERVING_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() =>
                        setSelectedSize(selectedSize === size ? undefined : size)
                      }
                      className={cn(
                        'py-3 px-4  font-medium transition',
                        selectedSize === size
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g., Extra lime, Less sweet..."
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none"
                  rows={3}
                />
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleConfirmModifiers}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-4 px-6 font-bold text-lg transition"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
