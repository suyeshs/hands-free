/**
 * Grab Food - Restaurant Card Component
 *
 * Merchant/restaurant card for displaying restaurant info in grid or list layout.
 * Features: image, rating, delivery info, promo badge, touch-optimized.
 */

import type { RestaurantCardComponent } from '../types';

export interface RestaurantCardOptions {
  id?: string;
  name?: string;
  variant?: 'grid' | 'list';
  showRating?: boolean;
  showDeliveryInfo?: boolean;
  showPromoBadge?: boolean;
  imageHeight?: string;
}

/**
 * Create a restaurant card component
 */
export function createRestaurantCard(
  options: RestaurantCardOptions = {}
): RestaurantCardComponent {
  const {
    id = 'restaurant-card-1',
    name = 'Restaurant Card',
    variant = 'grid',
    showRating = true,
    showDeliveryInfo = true,
    showPromoBadge = true,
    imageHeight = variant === 'grid' ? '140px' : '80px',
  } = options;

  return {
    id,
    name,
    type: 'restaurant-card',
    description: 'Restaurant/merchant card with image, info, and promo badge',
    category: 'content',

    dimensions: {
      width: '100%',
      minHeight: variant === 'grid' ? '200px' : '100px',
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
      bottom: 0,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: '1.5',
    },

    layout: {
      variant,
      imageHeight,
      showImage: true,
      showRating,
      showDeliveryInfo,
      showPromoBadge,
    },

    image: {
      aspectRatio: variant === 'grid' ? '16:9' : '1:1',
      objectFit: 'cover',
      overlayGradient: variant === 'grid',
      lazyLoad: true,
    },

    metadata: {
      showCuisine: true,
      showDistance: true,
      showDeliveryTime: true,
      showDeliveryFee: true,
      showMinOrder: false,
    },

    promoBadge: showPromoBadge ? {
      backgroundColor: '#ff6c31',
      textColor: '#ffffff',
      position: 'top-left',
    } : undefined,

    hoverEffect: 'lift',

    // States (flat design, not neumorphic)
    states: {
      default: {
        colors: {
          background: '#ffffff',
          text: '#1f2937',
          border: '#e5e7eb',
        },
        shadows: {
          outer: '0 2px 8px rgba(0, 0, 0, 0.08)',
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
          outer: '0 4px 16px rgba(0, 0, 0, 0.12)',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '0.75rem',
        },
        transform: 'translateY(-2px)',
      },
      active: {
        colors: {
          background: '#f9fafb',
          text: '#1f2937',
          border: '#00B14F',
        },
        shadows: {
          outer: '0 2px 8px rgba(0, 0, 0, 0.08)',
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
          outer: '0 4px 16px rgba(0, 0, 0, 0.12)',
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
        animation: { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
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
        animation: { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
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
          triggers: ['open', 'show menu', 'order from'],
          action: 'open-restaurant',
          feedback: 'Opening restaurant',
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
      ariaLabel: 'Restaurant card',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Restaurant with rating, cuisine, and delivery info',
    },

    platform: 'both',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['restaurant', 'merchant', 'card', 'delivery', 'grab'],
  };
}

/**
 * Create a grid-variant restaurant card
 */
export function createGridRestaurantCard(
  options: RestaurantCardOptions = {}
): RestaurantCardComponent {
  return createRestaurantCard({ ...options, variant: 'grid' });
}

/**
 * Create a list-variant restaurant card (horizontal layout)
 */
export function createListRestaurantCard(
  options: RestaurantCardOptions = {}
): RestaurantCardComponent {
  return createRestaurantCard({ ...options, variant: 'list' });
}
