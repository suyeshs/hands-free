/**
 * Grab Food - Menu Item Card Component
 *
 * Dish/menu item card for displaying food items (similar to Grab's dish cards).
 * Features: image, name, price, description, add to cart, dietary indicators.
 */

import type { BaseComponent } from '../types';

export interface MenuItemCardComponent extends BaseComponent {
  type: 'menu-item-card';
  layout: {
    variant: 'card' | 'list' | 'compact';
    imagePosition: 'top' | 'left' | 'right';
    imageSize: 'sm' | 'md' | 'lg';
    showImage: boolean;
    showDescription: boolean;
    showAddButton: boolean;
  };
  image: {
    aspectRatio: string;
    objectFit: 'cover' | 'contain';
    lazyLoad: boolean;
    fallbackIcon: string;
  };
  metadata: {
    showPrice: boolean;
    showCalories: boolean;
    showPreparationTime: boolean;
    showCustomization: boolean;
    showPopularity: boolean;
  };
  dietary: {
    showIndicators: boolean;
    indicators: {
      vegetarian: { show: boolean; icon: string; color: string };
      vegan: { show: boolean; icon: string; color: string };
      glutenFree: { show: boolean; icon: string; color: string };
      spicy: { show: boolean; icon: string; color: string };
    };
  };
  addButton: {
    style: 'icon' | 'text' | 'both';
    position: 'bottom-right' | 'bottom-center' | 'right';
    size: 'sm' | 'md' | 'lg';
  };
  hoverEffect: 'lift' | 'scale' | 'border' | 'none';
}

export interface MenuItemCardOptions {
  id?: string;
  name?: string;
  variant?: 'card' | 'list' | 'compact';
  showImage?: boolean;
  showDescription?: boolean;
  showAddButton?: boolean;
}

/**
 * Create a menu item card component
 */
export function createMenuItemCard(
  options: MenuItemCardOptions = {}
): MenuItemCardComponent {
  const {
    id = 'menu-item-card-1',
    name = 'Menu Item Card',
    variant = 'card',
    showImage = true,
    showDescription = true,
    showAddButton = true,
  } = options;

  return {
    id,
    name,
    type: 'menu-item-card',
    description: 'Menu item card with image, info, and add to cart',
    category: 'content',

    dimensions: {
      width: '100%',
      minHeight: variant === 'card' ? '280px' : variant === 'list' ? '120px' : '80px',
    },

    padding: {
      top: 0,
      right: 0,
      bottom: 12,
      left: 0,
    },

    margin: {
      top: 0,
      right: 0,
      bottom: 12,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: '1.5',
    },

    layout: {
      variant,
      imagePosition: variant === 'card' ? 'top' : 'left',
      imageSize: variant === 'card' ? 'lg' : variant === 'list' ? 'md' : 'sm',
      showImage,
      showDescription,
      showAddButton,
    },

    image: {
      aspectRatio: variant === 'card' ? '16:9' : '1:1',
      objectFit: 'cover',
      lazyLoad: true,
      fallbackIcon: '🍽️',
    },

    metadata: {
      showPrice: true,
      showCalories: false,
      showPreparationTime: false,
      showCustomization: true,
      showPopularity: true,
    },

    dietary: {
      showIndicators: true,
      indicators: {
        vegetarian: { show: true, icon: '🟢', color: '#22c55e' },
        vegan: { show: true, icon: '🌱', color: '#10b981' },
        glutenFree: { show: true, icon: '🌾', color: '#f59e0b' },
        spicy: { show: true, icon: '🌶️', color: '#ef4444' },
      },
    },

    addButton: {
      style: 'icon',
      position: variant === 'card' ? 'bottom-right' : 'right',
      size: 'md',
    },

    hoverEffect: 'border',

    // States (flat design with Grab green accents)
    states: {
      default: {
        colors: {
          background: '#ffffff',
          text: '#1f2937',
          border: '#e5e7eb',
        },
        shadows: {
          outer: '0 1px 3px rgba(0, 0, 0, 0.08)',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '0.75rem',
        },
      },
      hover: {
        colors: {
          background: '#ffffff',
          text: '#1f2937',
          border: '#00B14F',
        },
        shadows: {
          outer: '0 2px 8px rgba(0, 0, 0, 0.12)',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '0.75rem',
        },
        transform: 'translateY(-1px)',
      },
      active: {
        colors: {
          background: '#f9fafb',
          text: '#1f2937',
          border: '#00B14F',
        },
        shadows: {
          outer: '0 1px 3px rgba(0, 0, 0, 0.08)',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '0.75rem',
        },
        transform: 'translateY(0)',
      },
      focused: {
        colors: {
          background: '#ffffff',
          text: '#1f2937',
          border: '#00B14F',
        },
        shadows: {
          outer: '0 2px 8px rgba(0, 0, 0, 0.12)',
          inner: 'none',
        },
        border: {
          width: '2px',
          style: 'solid',
          radius: '0.75rem',
        },
      },
    },

    transitions: [
      {
        from: 'default',
        to: 'hover',
        animation: { duration: 150, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        haptic: false,
      },
      {
        from: 'hover',
        to: 'active',
        animation: { duration: 100, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
        haptic: true,
      },
      {
        from: 'default',
        to: 'focused',
        animation: { duration: 150, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        haptic: false,
      },
    ],

    defaultState: 'default',

    interaction: {
      primary: 'touch',
      alternatives: ['voice', 'keyboard'],
      touch: {
        minTouchSize: { width: 88, height: 88 },
        haptic: 'medium',
      },
      voice: [
        {
          triggers: ['add', 'order', 'I want'],
          action: 'add-to-cart',
          feedback: 'Adding to cart',
          visualIndicator: true,
        },
        {
          triggers: ['details', 'show more', 'what is'],
          action: 'show-details',
          feedback: 'Showing details',
          visualIndicator: true,
        },
      ],
      keyboard: [
        { key: 'Enter', modifiers: [] },
        { key: ' ', modifiers: [] },
      ],
    },

    accessibility: {
      role: 'button',
      ariaLabel: 'Menu item card with add to cart',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Menu item with name, price, description, and add to cart button',
    },

    platform: 'both',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['menu', 'food', 'dish', 'item', 'card', 'grab'],
  };
}

/**
 * Create a card-variant menu item (default - like Grab)
 */
export function createCardMenuItem(
  options: MenuItemCardOptions = {}
): MenuItemCardComponent {
  return createMenuItemCard({ ...options, variant: 'card' });
}

/**
 * Create a list-variant menu item (horizontal layout)
 */
export function createListMenuItem(
  options: MenuItemCardOptions = {}
): MenuItemCardComponent {
  return createMenuItemCard({ ...options, variant: 'list' });
}

/**
 * Create a compact menu item (minimal info)
 */
export function createCompactMenuItem(
  options: MenuItemCardOptions = {}
): MenuItemCardComponent {
  return createMenuItemCard({
    ...options,
    variant: 'compact',
    showDescription: false,
  });
}
