/**
 * Menu Card Component Primitive
 *
 * Factory function for creating menu item cards with various styles and interactions
 */

import type { MenuCardComponent, ComboCardComponent, BadgeStyle } from '../types';
import { DietaryBadgeColors } from '../design-tokens';

export interface MenuCardOptions {
  id?: string;
  name?: string;
  layout?: 'standard' | 'compact' | 'detailed';
  showImage?: boolean;
  showRating?: boolean;
  showBadges?: boolean;
  showDescription?: boolean;
  imageHeight?: string;
  cardSize?: 'compact' | 'comfortable' | 'spacious';
}

export interface ComboCardOptions extends MenuCardOptions {
  choiceDisplay?: 'inline' | 'expandable' | 'modal';
  choiceStyle?: 'radio' | 'dropdown' | 'cards';
}

/**
 * Create a standard menu card component
 */
export function createMenuCard(options: MenuCardOptions = {}): MenuCardComponent {
  const {
    id = 'menu-card-1',
    name = 'Menu Card',
    layout = 'standard',
    showImage = true,
    showRating = true,
    showBadges = true,
    showDescription = true,
    imageHeight = '12rem',
    cardSize = 'comfortable',
  } = options;

  // Adjust sizing based on card size
  const paddingMap = {
    compact: { top: 12, right: 12, bottom: 12, left: 12 },
    comfortable: { top: 16, right: 16, bottom: 16, left: 16 },
    spacious: { top: 20, right: 20, bottom: 20, left: 20 },
  };

  const fontSizeMap = {
    compact: '1rem',
    comfortable: '1.125rem',
    spacious: '1.25rem',
  };

  return {
    id,
    name,
    type: 'menu-card',
    description: 'Restaurant menu item card with image, rating, and add to cart',
    category: 'content',

    // Visual dimensions
    dimensions: {
      width: '100%',
      height: 'auto',
      minHeight: showImage ? '20rem' : '12rem',
    },

    padding: paddingMap[cardSize],

    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: fontSizeMap[cardSize],
      fontWeight: 600,
      lineHeight: '1.5',
    },

    // Layout configuration
    layout: {
      imageHeight: showImage ? imageHeight : '0',
      showImage,
      showRating,
      showBadges,
      showDescription,
      showPrice: true,
    },

    // Image configuration
    image: showImage ? {
      aspectRatio: '16/9',
      objectFit: 'cover',
      placeholder: 'https://via.placeholder.com/400x225?text=Menu+Item',
      lazyLoad: true,
    } : undefined,

    // Badge configuration
    badges: showBadges ? {
      bestseller: {
        backgroundColor: '#fef3c7',
        textColor: '#b45309',
        borderColor: '#fcd34d',
        icon: '⭐',
      },
      new: {
        backgroundColor: '#dbeafe',
        textColor: '#1e40af',
        borderColor: '#93c5fd',
        icon: '✨',
      },
      spicy: {
        backgroundColor: '#fee2e2',
        textColor: '#b91c1c',
        borderColor: '#fca5a5',
        icon: '🌶️',
      },
      dietary: DietaryBadgeColors.veg,
    } : undefined,

    // Price display
    priceDisplay: {
      position: 'header',
      size: 'lg',
      showCurrency: true,
    },

    // Action button
    actionButton: {
      type: 'add',
      style: 'primary',
    },

    // States (neumorphic)
    states: {
      default: {
        colors: {
          background: 'linear-gradient(145deg, #e6ebf1, #d5dae1)',
          text: '#1e293b',
          border: 'transparent',
        },
        shadows: {
          outer: '-8px -8px 20px rgba(255,255,255,0.8), 8px 8px 20px rgba(0,0,0,0.15)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1.25rem',
        },
      },
      hover: {
        colors: {
          background: 'linear-gradient(145deg, #eaf0f6, #dae0e6)',
          text: '#1e293b',
          border: 'transparent',
        },
        shadows: {
          outer: '-12px -12px 24px rgba(255,255,255,0.8), 12px 12px 24px rgba(0,0,0,0.15)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1.25rem',
        },
        transform: 'translateY(-4px)',
      },
      active: {
        colors: {
          background: '#e0e5ec',
          text: '#1e293b',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'inset -4px -4px 12px rgba(255,255,255,0.5), inset 4px 4px 12px rgba(0,0,0,0.1)',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1.25rem',
        },
        transform: 'translateY(0)',
      },
      pressed: {
        colors: {
          background: '#e0e5ec',
          text: '#1e293b',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'inset -4px -4px 12px rgba(255,255,255,0.5), inset 4px 4px 12px rgba(0,0,0,0.1)',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1.25rem',
        },
        transform: 'scale(0.98)',
      },
      focused: {
        colors: {
          background: 'linear-gradient(145deg, #e6ebf1, #d5dae1)',
          text: '#1e293b',
          border: '#0ea5e9',
        },
        shadows: {
          outer: '-8px -8px 20px rgba(255,255,255,0.8), 8px 8px 20px rgba(0,0,0,0.15), 0 0 0 3px rgba(14, 165, 233, 0.3)',
          inner: 'none',
        },
        border: {
          width: '2px',
          style: 'solid',
          radius: '1.25rem',
        },
      },
      disabled: {
        colors: {
          background: 'linear-gradient(145deg, #f1f5f9, #e2e8f0)',
          text: '#cbd5e1',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1.25rem',
        },
      },
      loading: {
        colors: {
          background: 'linear-gradient(145deg, #e6ebf1, #d5dae1)',
          text: '#94a3b8',
          border: 'transparent',
        },
        shadows: {
          outer: '-8px -8px 20px rgba(255,255,255,0.8), 8px 8px 20px rgba(0,0,0,0.15)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1.25rem',
        },
      },
      error: {
        colors: {
          background: 'linear-gradient(145deg, #fee2e2, #fecaca)',
          text: '#b91c1c',
          border: '#fca5a5',
        },
        shadows: {
          outer: '-8px -8px 20px rgba(255,255,255,0.8), 8px 8px 20px rgba(239, 68, 68, 0.15)',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '1.25rem',
        },
      },
      success: {
        colors: {
          background: 'linear-gradient(145deg, #dcfce7, #bbf7d0)',
          text: '#15803d',
          border: '#86efac',
        },
        shadows: {
          outer: '-8px -8px 20px rgba(255,255,255,0.8), 8px 8px 20px rgba(34, 197, 94, 0.15)',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '1.25rem',
        },
      },
    },

    // Transitions
    transitions: [
      {
        from: 'default',
        to: 'hover',
        animation: { duration: 300, easing: 'ease-out' },
        haptic: false,
      },
      {
        from: 'hover',
        to: 'active',
        animation: { duration: 100, easing: 'ease-in' },
        haptic: true,
      },
      {
        from: 'active',
        to: 'default',
        animation: { duration: 200, easing: 'ease-out' },
        haptic: false,
      },
    ],

    defaultState: 'default',

    // Multimodal interaction
    interaction: {
      primary: 'touch',
      alternatives: ['voice', 'keyboard'],
      touch: {
        minTouchSize: { width: 88, height: 88 },
        haptic: 'medium',
      },
      voice: [
        {
          triggers: ['add', 'add to cart', 'order'],
          feedback: 'Item added to cart',
          visualIndicator: true,
        },
      ],
      keyboard: [
        { key: 'Enter', modifiers: [] },
      ],
    },

    // Accessibility
    accessibility: {
      role: 'article',
      ariaLabel: 'Menu item card',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Menu item with image, name, price, and add to cart button',
    },

    // Metadata
    platform: 'web',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['menu', 'food', 'restaurant', 'card'],
  };
}

/**
 * Create a combo card component with choice selection
 */
export function createComboCard(options: ComboCardOptions = {}): ComboCardComponent {
  const baseCard = createMenuCard(options);

  const {
    choiceDisplay = 'expandable',
    choiceStyle = 'radio',
  } = options;

  return {
    ...baseCard,
    type: 'combo-card',
    name: options.name || 'Combo Card',
    description: 'Menu combo card with choice selection',

    // Combo-specific configuration
    choiceSelection: {
      display: choiceDisplay,
      style: choiceStyle,
      showImages: false,
    },

    tags: [...(baseCard.tags || []), 'combo', 'choices'],
  };
}

/**
 * Create a compact menu card for list views
 */
export function createCompactMenuCard(options: MenuCardOptions = {}): MenuCardComponent {
  return createMenuCard({
    ...options,
    layout: 'compact',
    cardSize: 'compact',
    imageHeight: '6rem',
    showDescription: false,
  });
}

/**
 * Create a detailed menu card for modal/detail views
 */
export function createDetailedMenuCard(options: MenuCardOptions = {}): MenuCardComponent {
  return createMenuCard({
    ...options,
    layout: 'detailed',
    cardSize: 'spacious',
    imageHeight: '16rem',
    showDescription: true,
    showRating: true,
    showBadges: true,
  });
}
