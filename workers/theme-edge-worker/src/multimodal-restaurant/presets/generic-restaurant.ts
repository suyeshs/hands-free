/**
 * Generic Restaurant Theme Preset
 *
 * Customizable base theme for any restaurant
 */

import type { MultimodalRestaurantTheme } from '../types';
import { DefaultRestaurantDesignTokens } from '../design-tokens';
import { DefaultLayouts } from '../layouts';
import {
  createMenuCard,
  createComboCard,
  createVoiceOrb,
  createCartIsland,
  createCategoryCarousel,
} from '../primitives';

/**
 * Generic restaurant theme with sensible defaults
 */
export const GenericRestaurantTheme: MultimodalRestaurantTheme = {
  version: '1.0.0',

  meta: {
    name: 'Generic Restaurant Theme',
    description: 'Customizable multimodal restaurant ordering theme',
    author: 'Stonepot Platform',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['restaurant', 'generic', 'customizable', 'multimodal'],
  },

  designTokens: DefaultRestaurantDesignTokens,
  layouts: DefaultLayouts,

  components: {
    menuCard: createMenuCard(),
    comboCard: createComboCard(),
    voiceOrb: createVoiceOrb(),
    cartIsland: createCartIsland(),
    categoryCarousel: createCategoryCarousel(),
    orderProgress: {
      id: 'order-progress',
      name: 'Order Progress',
      type: 'order-progress',
      description: 'Order progress indicator',
      category: 'feedback',
      dimensions: { width: '60px', height: '60px' },
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: '1',
      },
      position: 'top-right',
      size: 60,
      steps: [
        { id: 'browse', label: 'Browse' },
        { id: 'cart', label: 'Cart' },
        { id: 'checkout', label: 'Checkout' },
      ],
      showLabel: true,
      showPercentage: false,
      states: {
        default: {
          colors: {
            background: '#e0e5ec',
            text: '#1e293b',
            border: 'transparent',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(0,0,0,0.15)',
            inner: 'none',
          },
          border: {
            width: '0',
            style: 'solid',
            radius: '50%',
          },
        },
        hover: {
          colors: {
            background: '#e0e5ec',
            text: '#1e293b',
            border: 'transparent',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(0,0,0,0.15)',
            inner: 'none',
          },
          border: {
            width: '0',
            style: 'solid',
            radius: '50%',
          },
        },
        active: {
          colors: {
            background: 'linear-gradient(145deg, #ffaa33, #ff9500)',
            text: '#ffffff',
            border: 'transparent',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(255, 149, 0, 0.3)',
            inner: 'none',
          },
          border: {
            width: '0',
            style: 'solid',
            radius: '50%',
          },
        },
        pressed: {
          colors: {
            background: '#e0e5ec',
            text: '#1e293b',
            border: 'transparent',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(0,0,0,0.15)',
            inner: 'none',
          },
          border: {
            width: '0',
            style: 'solid',
            radius: '50%',
          },
        },
        focused: {
          colors: {
            background: '#e0e5ec',
            text: '#1e293b',
            border: '#0ea5e9',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(0,0,0,0.15), 0 0 0 3px rgba(14, 165, 233, 0.3)',
            inner: 'none',
          },
          border: {
            width: '2px',
            style: 'solid',
            radius: '50%',
          },
        },
        disabled: {
          colors: {
            background: '#e0e5ec',
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
            radius: '50%',
          },
        },
        loading: {
          colors: {
            background: '#e0e5ec',
            text: '#94a3b8',
            border: 'transparent',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(0,0,0,0.15)',
            inner: 'none',
          },
          border: {
            width: '0',
            style: 'solid',
            radius: '50%',
          },
        },
        error: {
          colors: {
            background: '#fee2e2',
            text: '#b91c1c',
            border: '#fca5a5',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(239, 68, 68, 0.15)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '50%',
          },
        },
        success: {
          colors: {
            background: '#dcfce7',
            text: '#15803d',
            border: '#86efac',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(34, 197, 94, 0.15)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '50%',
          },
        },
      },
      transitions: [],
      defaultState: 'default',
      interaction: { primary: 'touch', alternatives: [] },
      accessibility: {
        role: 'progressbar',
        ariaLabel: 'Order progress',
        focusable: false,
        keyboardNavigable: false,
        screenReaderText: 'Current step in ordering process',
      },
      platform: 'web',
      frameworks: ['react'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['progress'],
    },
    dishModal: {
      id: 'dish-modal',
      name: 'Dish Modal',
      type: 'dish-modal',
      description: 'Dish details modal',
      category: 'content',
      dimensions: { width: '100%', height: 'auto', maxWidth: '32rem' },
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: '1.5',
      },
      layout: 'detailed',
      showNutritionInfo: false,
      showIngredients: false,
      showAllergens: false,
      showCustomization: false,
      imageSize: 'md',
      states: {
        default: {
          colors: {
            background: 'linear-gradient(145deg, #e6ebf1, #d5dae1)',
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
        },
        hover: {
          colors: {
            background: 'linear-gradient(145deg, #e6ebf1, #d5dae1)',
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
        },
        focused: {
          colors: {
            background: 'linear-gradient(145deg, #e6ebf1, #d5dae1)',
            text: '#1e293b',
            border: '#0ea5e9',
          },
          shadows: {
            outer: '-12px -12px 24px rgba(255,255,255,0.8), 12px 12px 24px rgba(0,0,0,0.15), 0 0 0 3px rgba(14, 165, 233, 0.3)',
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
            outer: '-12px -12px 24px rgba(255,255,255,0.8), 12px 12px 24px rgba(0,0,0,0.15)',
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
            outer: '-12px -12px 24px rgba(255,255,255,0.8), 12px 12px 24px rgba(239, 68, 68, 0.15)',
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
            outer: '-12px -12px 24px rgba(255,255,255,0.8), 12px 12px 24px rgba(34, 197, 94, 0.15)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1.25rem',
          },
        },
      },
      transitions: [],
      defaultState: 'default',
      interaction: { primary: 'touch', alternatives: ['keyboard'] },
      accessibility: {
        role: 'dialog',
        ariaLabel: 'Dish details',
        focusable: true,
        keyboardNavigable: true,
        screenReaderText: 'Detailed dish information',
      },
      platform: 'web',
      frameworks: ['react'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['modal'],
    },
    cart: {
      id: 'cart',
      name: 'Cart',
      type: 'cart',
      description: 'Shopping cart',
      category: 'content',
      dimensions: { width: '100%', height: 'auto', maxWidth: '48rem' },
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: '1.5',
      },
      layout: 'list',
      itemDisplay: {
        showImage: true,
        showPrice: true,
        showCustomization: false,
        allowEdit: true,
      },
      summary: {
        showSubtotal: true,
        showTax: false,
        showDelivery: false,
        showDiscount: false,
      },
      emptyState: {
        icon: '🛒',
        message: 'Your cart is empty',
        ctaText: 'Browse Menu',
      },
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
      transitions: [],
      defaultState: 'default',
      interaction: { primary: 'touch', alternatives: ['keyboard'] },
      accessibility: {
        role: 'region',
        ariaLabel: 'Shopping cart',
        focusable: true,
        keyboardNavigable: true,
        screenReaderText: 'Shopping cart with items',
      },
      platform: 'web',
      frameworks: ['react'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['cart'],
    },
  },

  interactions: {
    voiceCommands: {
      browse: [
        {
          triggers: ['show menu', 'menu please'],
          action: 'show_menu',
          feedback: 'Showing menu',
          visualIndicator: true,
        },
      ],
      order: [
        {
          triggers: ['add', 'order'],
          action: 'add_to_cart',
          feedback: 'Added to cart',
          visualIndicator: true,
        },
      ],
      cart: [
        {
          triggers: ['show cart', 'my cart'],
          action: 'show_cart',
          feedback: 'Showing cart',
          visualIndicator: true,
        },
      ],
      navigation: [
        {
          triggers: ['go back'],
          action: 'navigate_back',
          feedback: 'Going back',
          visualIndicator: false,
        },
      ],
    },
    gestures: {
      swipeToRemove: true,
      pullToRefresh: false,
      pinchToZoom: false,
      longPressForDetails: false,
    },
    haptics: {
      enabled: true,
      intensity: 'medium',
      events: {
        addToCart: true,
        removeFromCart: true,
        voiceActivation: true,
        error: true,
      },
    },
    keyboard: {
      search: '/',
      cart: 'c',
      voiceActivate: 'v',
      prevCategory: '[',
      nextCategory: ']',
    },
  },

  accessibility: {
    wcagLevel: 'AA',
    contrastRatios: {
      normal: 4.5,
      large: 3.0,
    },
    keyboardNav: {
      enabled: true,
      showFocusIndicators: true,
      skipLinks: true,
    },
    screenReader: {
      announceChanges: true,
      liveRegions: true,
      ariaLabels: true,
    },
    voiceAccessibility: {
      alternativeInputMethods: true,
      visualFeedback: true,
      errorRecovery: true,
    },
  },
};

export default GenericRestaurantTheme;
