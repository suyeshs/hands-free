'use client';

import { observer } from 'mobx-react-lite';
import { cartStore } from '@/app/stores/cartStore';

interface MenuItem {
  itemId: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  category?: string;
  type?: string;
  choices?: any[];
}

const GrabMenuItem = observer(function GrabMenuItem({ item }: { item: MenuItem }) {
  // Compute quantity directly from cart store (reactive via observer)
  const itemType = item.isVegetarian ? 'veg' : 'non-veg';
  const cartItem = cartStore.items.find(i => i.name === item.name && i.type === itemType);
  const quantity = cartItem ? cartItem.quantity : 0;

  const handleAdd = () => {
    // Use the item object directly since it comes from API with all data
    if (item.choices && item.choices.length > 0) {
      // Type cast for combo items and use default choice
      const comboItem = { ...item, category: 'combos' as const };
      const defaultChoice = item.choices[0];
      cartStore.addComboItem(comboItem as any, defaultChoice);
    } else {
      cartStore.addMenuItem(item as any);
    }
  };

  const handleIncrease = () => {
    cartStore.updateQuantity(item.name, itemType as 'veg' | 'non-veg', quantity + 1);
  };

  const handleDecrease = () => {
    if (quantity > 1) {
      cartStore.updateQuantity(item.name, itemType as 'veg' | 'non-veg', quantity - 1);
    } else if (quantity === 1) {
      cartStore.removeItem(item.name, itemType as 'veg' | 'non-veg');
    }
  };

  // Skip dietary labels for beverages and desserts
  const category = item.category?.toLowerCase() || '';
  const skipDietaryLabel = category.includes('beverage') ||
                            category.includes('dessert') ||
                            category.includes('drink') ||
                            category.includes('sweet');

  return (
    <div className="menu-item-card">
      <img
        src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'}
        alt={item.name}
        className="menu-item-image"
      />
      <div className="menu-item-content">
        <div className="menu-item-header">
          <div className="menu-item-name">{item.name}</div>
          {!skipDietaryLabel && item.isVegetarian && (
            <div className="dietary-indicators">
              <span className="dietary-icon" title="Vegetarian">🟢</span>
            </div>
          )}
          {!skipDietaryLabel && item.isVegan && (
            <div className="dietary-indicators">
              <span className="dietary-icon" title="Vegan">🌱</span>
            </div>
          )}
        </div>
        {item.description && (
          <div className="menu-item-description">{item.description}</div>
        )}
        <div className="menu-item-footer">
          <div className="menu-item-price">₹{item.price}</div>
          {quantity === 0 ? (
            <div className="add-button" onClick={handleAdd}>+</div>
          ) : (
            <div className="quantity-controls">
              <button className="quantity-btn" onClick={handleDecrease}>−</button>
              <span className="quantity-display">{quantity}</span>
              <button className="quantity-btn" onClick={handleIncrease}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default GrabMenuItem;
