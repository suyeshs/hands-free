import { useState } from 'react';
import { VoiceMenuItemCard } from './VoiceMenuItemCard';
import { VoiceComboCard } from './VoiceComboCard';
import { PaymentPending } from './displays/PaymentPending';
import { CheckoutSummaryDisplay } from './displays/CheckoutSummaryDisplay';
import { OrderConfirmed } from './displays/OrderConfirmed';
import { AddressVerification as AddressVerificationDisplay } from './displays/AddressVerification';
import { ManualAddressForm } from './displays/ManualAddressForm';

interface MultimodalDisplayProps {
  visualData: any;
  onAction?: (action: string, data: any) => void;
}

export function MultimodalDisplay({ visualData, onAction }: MultimodalDisplayProps) {
  if (!visualData) {
    return null;
  }

  // Backend sends 'data' property, not 'displayData'
  const { type, data: displayData } = visualData;

  switch (type) {
    case 'dish_card':
      // Check if it's a combo based on choices/category
      if (displayData?.choices || displayData?.category === 'combos') {
        return <VoiceComboCard data={displayData} onAction={onAction} />;
      }
      return <VoiceMenuItemCard data={displayData} onAction={onAction} />;

    case 'menu_item':
      return <VoiceMenuItemCard data={displayData} onAction={onAction} />;

    case 'combo_item':
      return <VoiceComboCard data={displayData} onAction={onAction} />;

    case 'menu_section':
      return <MenuSection data={displayData} />;

    case 'menu_grid':
      return <MenuGrid data={displayData} onAction={onAction} />;

    case 'order_summary':
    case 'cart_updated':
      return <OrderSummary data={displayData} onAction={onAction} />;

    case 'cart_item_added':
      return <CartItemAdded data={displayData} />;

    case 'confirmation':
      return <Confirmation data={displayData} />;

    case 'address_verification':
      return <AddressVerificationDisplay data={displayData} />;

    case 'manual_address_form':
      return <ManualAddressForm data={displayData} onAction={onAction} />;

    case 'checkout_summary':
      return <CheckoutSummaryDisplay data={displayData} />;

    case 'payment_pending':
      return <PaymentPending data={displayData} />;

    case 'order_confirmed':
      return <OrderConfirmed data={displayData} />;

    case 'webpage':
      return <WebPage url={displayData?.url} />;

    case 'snippet':
      return <Snippet content={displayData?.content} title={displayData?.title} />;

    default:
      return (
        <div className="p-4 bg-gray-100 rounded">
          <p className="text-sm text-gray-600">Unknown display type: {type}</p>
          <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(visualData, null, 2)}</pre>
        </div>
      );
  }
}

/**
 * Interactive Dish Card with Add to Cart button
 */
interface DishCardProps {
  data: {
    dishId: string;
    name: string;
    description: string;
    price: number;
    image?: string;
    dietary?: string[];
    spiceLevel?: number;
    actions?: Array<{ id: string; label: string; type: string }>;
  };
  onAction?: (action: string, data: any) => void;
}

function DishCard({ data, onAction }: DishCardProps) {
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    onAction?.('add_to_cart', {
      dishId: data.dishId,
      dishName: data.name,
      quantity,
      customizations: []
    });
  };

  const renderSpiceLevel = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < level ? 'text-error/70' : 'opacity-30'}>
        🌶️
      </span>
    ));
  };

  return (
    <div className="neu-card overflow-hidden hover-lift animate-fade-in">
      {/* Dish Image */}
      {data.image && (
        <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
          <img
            src={data.image}
            alt={data.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Dish Name & Price */}
        <div className="flex justify-between items-start">
          <h3 className="text-2xl font-bold neu-text">{data.name}</h3>
          <div className="text-right">
            <div className="text-2xl font-bold neu-text-accent">₹{data.price}</div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm neu-text-secondary leading-relaxed">{data.description}</p>

        {/* Dietary Tags & Spice Level */}
        <div className="flex flex-wrap gap-2 items-center">
          {data.dietary?.map((tag) => (
            <span
              key={tag}
              className="neu-tag"
            >
              {tag === 'vegetarian' ? '🌱 Veg' : tag === 'non-veg' ? '🍖 Non-Veg' : tag}
            </span>
          ))}

          {data.spiceLevel !== undefined && data.spiceLevel > 0 && (
            <div className="flex items-center gap-1 text-xs">
              {renderSpiceLevel(data.spiceLevel)}
            </div>
          )}
        </div>

        {/* Quantity Selector */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium neu-text-secondary">Quantity:</span>
          <div className="flex items-center gap-2 neu-concave rounded-xl overflow-hidden">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-4 py-2 neu-button font-bold transition-all"
            >
              −
            </button>
            <span className="px-4 py-2 font-semibold neu-text">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="px-4 py-2 neu-button font-bold transition-all"
            >
              +
            </button>
          </div>
        </div>

        {/* Add to Order Button */}
        <button
          onClick={handleAddToCart}
          className="w-full neu-button-accent rounded-xl px-6 py-3 text-base font-semibold transition-all duration-200 transform hover:-translate-y-0.5"
        >
          Add to Order • ₹{data.price * quantity}
        </button>
      </div>
    </div>
  );
}

/**
 * Cart Item Added Notification (Toast)
 */
interface CartItemAddedProps {
  data: {
    item: {
      dishName: string;
      quantity: number;
      itemTotal: number;
    };
    cart: {
      total: number;
    };
  };
}

function CartItemAdded({ data }: CartItemAddedProps) {
  return (
    <div className="neu-card animate-fade-in border-l-4 border-success">
      <div className="flex items-start gap-3 p-4">
        <div className="text-2xl">✅</div>
        <div className="flex-1">
          <h4 className="text-lg font-bold neu-text-accent mb-1">Added to Cart</h4>
          <p className="text-sm neu-text">
            {data.item.quantity}x {data.item.dishName} • ₹{data.item.itemTotal}
          </p>
          <p className="text-xs neu-text-secondary mt-2">
            Cart Total: ₹{data.cart.total}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Order Summary with interactive controls
 */
interface OrderSummaryProps {
  data: {
    items: Array<{
      id: string;
      dishName: string;
      quantity: number;
      price: number;
      itemTotal: number;
      customizations?: string[];
      imageUrl?: string;
      photo_url?: string;
    }>;
    subtotal: number;
    tax: number;
    total: number;
  };
  onAction?: (action: string, data: any) => void;
}

function OrderSummary({ data, onAction }: OrderSummaryProps) {
  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="text-center neu-text-secondary py-8">
        <p className="text-sm">Your order is empty</p>
      </div>
    );
  }

  const handleRemoveItem = (itemId: string) => {
    onAction?.('remove_from_cart', { itemId });
  };

  const handleUpdateQuantity = (itemId: string, action: 'increment' | 'decrement', currentQty: number) => {
    const newQuantity = action === 'increment' ? currentQty + 1 : Math.max(1, currentQty - 1);
    onAction?.('update_quantity', { itemId, action, newQuantity });
  };

  return (
    <div className="neu-card overflow-hidden animate-fade-in">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-xl font-bold neu-text">🛒 Your Order</h3>
        <p className="text-sm neu-text-secondary mt-1">{data.items.length} item{data.items.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="divide-y divide-gray-200">
        {data.items.map((item) => {
          const imageUrl = item.imageUrl || item.photo_url;
          return (
            <div key={item.id} className="p-4 hover-lift transition-all">
              <div className="flex items-start gap-4">
                {/* Item Image */}
                {imageUrl && (
                  <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={imageUrl}
                      alt={item.dishName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold neu-text">{item.dishName}</h4>
                  {item.customizations && item.customizations.length > 0 && (
                    <p className="text-xs neu-text-secondary mt-1">
                      {item.customizations.join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 'decrement', item.quantity)}
                      className="w-8 h-8 flex items-center justify-center neu-button rounded-lg text-sm font-bold"
                    >
                      −
                    </button>
                    <span className="text-sm font-medium neu-text min-w-[2rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 'increment', item.quantity)}
                      className="w-8 h-8 flex items-center justify-center neu-button rounded-lg text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Price & Remove */}
                <div className="text-right flex-shrink-0">
                  <div className="font-bold neu-text">₹{item.itemTotal}</div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-xs text-error hover:text-error/80 mt-2 transition-colors font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="px-6 py-4 space-y-2 border-t border-gray-200 neu-concave">
        <div className="flex justify-between text-sm">
          <span className="neu-text-secondary">Subtotal</span>
          <span className="font-medium neu-text">₹{data.subtotal}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="neu-text-secondary">Tax (5%)</span>
          <span className="font-medium neu-text">₹{data.tax}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-300">
          <span className="neu-text">Total</span>
          <span className="neu-text-accent">₹{data.total}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Menu Section Display
 */
function MenuSection({ data }: { data: any }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow">
      <h3 className="text-xl font-bold">📋 Menu Section</h3>
      <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

/**
 * Menu Grid Display - Shows multiple dishes in a responsive grid
 */
interface MenuGridProps {
  data: {
    title?: string;
    items: Array<{
      id: string;
      name: string;
      description?: string;
      price: number;
      imageUrl?: string;
      photo_url?: string;
      type?: string;
      dietary?: string[];
      dietaryTags?: string[];
      spiceLevel?: number;
      category?: string;
      tag?: string;
      rating?: number;
    }>;
    totalCount?: number;
  };
  onAction?: (action: string, data: any) => void;
}

function MenuGrid({ data, onAction }: MenuGridProps) {
  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="text-center neu-text-secondary py-8">
        <p className="text-sm">No dishes found</p>
      </div>
    );
  }

  const handleSelectDish = (item: MenuGridProps['data']['items'][0]) => {
    // Trigger show_dish_details for the selected item
    onAction?.('select_dish', { dishName: item.name, dishId: item.id });
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      {data.title && (
        <div className="mb-4 px-2">
          <h3 className="text-xl font-bold neu-text">{data.title}</h3>
          {data.totalCount && data.totalCount > data.items.length && (
            <p className="text-sm neu-text-secondary mt-1">
              Showing {data.items.length} of {data.totalCount} dishes
            </p>
          )}
        </div>
      )}

      {/* Grid of dishes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[70vh] overflow-y-auto p-2">
        {data.items.map((item) => {
          const imageUrl = item.imageUrl || item.photo_url;
          const dietary = item.dietary || item.dietaryTags || [];
          const isVeg = item.type === 'veg' || dietary.includes('vegetarian') || dietary.includes('veg');
          const isNonVeg = item.type === 'non-veg' || dietary.includes('non-veg') || dietary.includes('non-vegetarian');

          return (
            <div
              key={item.id}
              onClick={() => handleSelectDish(item)}
              className="neu-card overflow-hidden cursor-pointer hover-lift transition-all duration-200 group"
            >
              {/* Image */}
              <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
                    🍽️
                  </div>
                )}

                {/* Veg/Non-Veg indicator */}
                {(isVeg || isNonVeg) && (
                  <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isVeg ? 'border-green-600 bg-white' : 'border-red-600 bg-white'
                  }`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      isVeg ? 'bg-green-600' : 'bg-red-600'
                    }`} />
                  </div>
                )}

                {/* Tag badge */}
                {item.tag && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold bg-accent text-white rounded-full">
                    {item.tag}
                  </div>
                )}

                {/* Rating */}
                {item.rating && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 text-xs font-semibold bg-black/70 text-white rounded flex items-center gap-1">
                    <span>⭐</span> {item.rating.toFixed(1)}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-3">
                <h4 className="font-semibold text-sm neu-text line-clamp-2 min-h-[2.5rem]">
                  {item.name}
                </h4>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-sm neu-text-accent">₹{item.price}</span>
                  {item.spiceLevel !== undefined && item.spiceLevel > 0 && (
                    <span className="text-xs">
                      {'🌶️'.repeat(Math.min(item.spiceLevel, 3))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint text */}
      <div className="text-center mt-4 text-sm neu-text-secondary">
        Tap a dish to see details and add to cart
      </div>
    </div>
  );
}

/**
 * Order Confirmation
 */
function Confirmation({ data }: { data: any }) {
  return (
    <div className="neu-card rounded-xl p-6 backdrop-blur-sm border-l-4 border-success">
      <div className="text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h3 className="text-xl font-bold text-success">Order Confirmed!</h3>
        {data?.message && (
          <p className="text-sm neu-text-secondary">{data.message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Web Page Display
 */
function WebPage({ url }: { url?: string }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow">
      <h3 className="text-xl font-bold">🌐 Web Page</h3>
      <p className="mt-2">URL: {url}</p>
      {url && (
        <iframe
          src={url}
          className="w-full h-96 mt-4 border rounded"
          sandbox="allow-scripts allow-same-origin"
        />
      )}
    </div>
  );
}

/**
 * Snippet Display
 */
function Snippet({ content, title }: { content?: string; title?: string }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow">
      <h3 className="text-xl font-bold">📝 {title || 'Snippet'}</h3>
      <div className="mt-4 prose">
        {content}
      </div>
    </div>
  );
}

