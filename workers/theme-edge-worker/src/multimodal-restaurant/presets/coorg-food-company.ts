/**
 * The Coorg Food Company - Preset Theme
 *
 * Restaurant-specific theme for CFC with South Indian cuisine focus
 */

import type { MultimodalRestaurantTheme, RestaurantDesignTokens } from '../types';
import { DefaultRestaurantDesignTokens, CoffeeBrownScale, DeepSlateScale, FreshGreenScale, RichRedScale } from '../design-tokens';
import { DefaultLayouts } from '../layouts';

/**
 * Coorg Food Company Custom Design Tokens
 * Uses Coffee Brown palette for authentic Coorg coffee culture theme
 */
const CoorgDesignTokens: RestaurantDesignTokens = {
  ...DefaultRestaurantDesignTokens,
  colors: {
    ...DefaultRestaurantDesignTokens.colors,
    primary: CoffeeBrownScale,
    secondary: DeepSlateScale,
    accent: {
      ...CoffeeBrownScale,
      500: '#c9a87a', // Warm tan accent
      600: '#a67c52',
    },
    background: {
      main: '#faf8f5',     // Cream background
      surface: '#f5f0e8',   // Light tan surface
      elevated: '#ffffff',  // Pure white for elevated elements
    },
    text: {
      primary: '#78350f',   // Dark coffee for main text
      secondary: '#8b5a2b', // Saddle brown for secondary
      tertiary: '#a67c52',  // Medium brown for tertiary
      disabled: '#c9a87a',  // Light brown for disabled
      inverse: '#faf8f5',   // Cream for dark backgrounds
    },
    dietary: {
      veg: FreshGreenScale,
      nonVeg: RichRedScale,
    },
    voiceStates: {
      idle: '#a67c52',      // Warm brown for idle
      listening: '#0ea5e9', // Blue for listening
      thinking: '#f59e0b',  // Amber for thinking
      speaking: '#22c55e',  // Green for speaking
    },
  },
};
import {
  createMenuCard,
  createComboCard,
  createVoiceOrb,
  createCartIsland,
  createCategoryCarousel,
  createPromoCarousel,
  createVoicePromoItem,
  createSpecialsPromoItem,
  createAnnouncementItem,
} from '../primitives';

/**
 * The Coorg Food Company theme
 */
export const CoorgFoodCompanyTheme: MultimodalRestaurantTheme = {
  version: '1.0.0',

  meta: {
    name: 'The Coorg Food Company',
    displayName: 'Coorg Food Company',  // For voice greetings
    description: 'South Indian comfort food with voice-assisted ordering',
    restaurantId: 'coorg-food-company',
    author: 'Stonepot Platform',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['restaurant', 'south-indian', 'voice-ordering', 'multimodal'],
    // Logo URL - Cloudflare Images
    logo: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/8d313e79-77a9-4c93-4c21-41015e4e1700/public',
    favicon: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/8d313e79-77a9-4c93-4c21-41015e4e1700/public',
  },

  designTokens: CoorgDesignTokens,

  layouts: {
    landing: {
      ...DefaultLayouts.landing,
      choiceCards: {
        voice: {
          label: 'Voice Ordering',
          description: 'Order in English or Hindi with your voice',
          icon: '🎤',
          gradient: {
            from: '#faf8f5',
            to: '#f5f0e8',
            direction: 'to-br',
          },
          benefits: [
            'Natural conversation',
            'Bilingual support (EN/HI)',
            'Instant recommendations',
            'Hands-free experience',
          ],
        },
        standard: {
          label: 'Browse Menu',
          description: 'Explore our South Indian specialties',
          icon: '🍽️',
          gradient: {
            from: '#f5f0e8',
            to: '#ebe0d0',
            direction: 'to-br',
          },
          benefits: [
            'View all dishes',
            'Detailed descriptions',
            'Filter by preferences',
            'Visual menu browsing',
          ],
        },
      },
      features: {
        show: true,
        items: [
          {
            icon: '🌶️',
            title: 'Authentic Coorg Flavors',
            description: 'Traditional recipes from Karnataka',
          },
          {
            icon: '🥗',
            title: 'Veg & Non-Veg Options',
            description: 'Something for everyone',
          },
          {
            icon: '⚡',
            title: 'Quick Ordering',
            description: 'Voice or touch, your choice',
          },
        ],
      },
    },

    voiceAssisted: {
      ...DefaultLayouts.voiceAssisted,
      type: 'split-view',
      voicePanel: {
        width: 'medium',
        position: 'left',
        showTranscript: true,
        showCartSummary: true,
      },
      voiceOrb: {
        size: 'lg',
        position: 'floating',
        showLabel: true,
        showVisualizer: true,
        pulseAnimation: 'medium',
      },
    },

    standardBrowse: {
      ...DefaultLayouts.standardBrowse,
      categoryNav: {
        type: 'carousel',
        position: 'sticky',
        showIcons: true,
        showCount: true,
      },
      menuGrid: {
        columns: {
          mobile: 1,
          tablet: 2,
          desktop: 3,
        },
        gap: '1.5rem',
        cardSize: 'comfortable',
      },
    },
  },

  components: {
    menuCard: createMenuCard({
      name: 'CFC Menu Card',
      cardSize: 'comfortable',
      showImage: true,
      showRating: true,
      showBadges: true,
      showDescription: true,
      imageHeight: '12rem',
    }),

    comboCard: createComboCard({
      name: 'CFC Combo Card',
      cardSize: 'comfortable',
      choiceDisplay: 'expandable',
      choiceStyle: 'radio',
    }),

    voiceOrb: createVoiceOrb({
      name: 'CFC Voice Assistant',
      size: 'lg',
      position: 'bottom-center',
      showLabel: true,
      showVisualizer: true,
      pulseIntensity: 'medium',
    }),

    cartIsland: createCartIsland({
      name: 'CFC Cart',
      position: 'bottom-right',
      size: 'md',
      showItemCount: true,
      showTotal: true,
      pulseOnAdd: true,
    }),

    categoryCarousel: createCategoryCarousel({
      name: 'CFC Categories',
      layout: 'horizontal',
      itemStyle: 'pills',
      showIcons: true,
      showCount: true,
      scrollBehavior: 'smooth',
    }),

    orderProgress: {
      id: 'cfc-progress',
      name: 'CFC Order Progress',
      type: 'order-progress',
      description: 'Track your ordering progress',
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
        { id: 'browse', label: 'Browse', icon: '🔍' },
        { id: 'cart', label: 'Cart', icon: '🛒' },
        { id: 'checkout', label: 'Pay', icon: '💳' },
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
            background: 'linear-gradient(145deg, #a67c52, #78350f)',
            text: '#ffffff',
            border: 'transparent',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(120, 53, 15, 0.3)',
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
      interaction: {
        primary: 'touch',
        alternatives: [],
      },
      accessibility: {
        role: 'progressbar',
        ariaLabel: 'Order progress',
        focusable: false,
        keyboardNavigable: false,
        screenReaderText: 'Current ordering step',
      },
      platform: 'web',
      frameworks: ['react'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['progress', 'indicator'],
    },

    dishModal: {
      id: 'cfc-dish-modal',
      name: 'CFC Dish Details',
      type: 'dish-modal',
      description: 'Detailed dish information modal',
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
      showIngredients: true,
      showAllergens: false,
      showCustomization: true,
      imageSize: 'lg',
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
      interaction: {
        primary: 'touch',
        alternatives: ['keyboard'],
      },
      accessibility: {
        role: 'dialog',
        ariaLabel: 'Dish details',
        focusable: true,
        keyboardNavigable: true,
        screenReaderText: 'Detailed information about the selected dish',
      },
      platform: 'web',
      frameworks: ['react'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['modal', 'details'],
    },

    cart: {
      id: 'cfc-cart',
      name: 'CFC Shopping Cart',
      type: 'cart',
      description: 'Full cart view with checkout',
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
        showCustomization: true,
        allowEdit: true,
      },
      summary: {
        showSubtotal: true,
        showTax: true,
        showDelivery: false,
        showDiscount: false,
      },
      emptyState: {
        icon: '🛒',
        message: 'Your cart is empty',
        ctaText: 'Start Ordering',
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
      interaction: {
        primary: 'touch',
        alternatives: ['keyboard'],
      },
      accessibility: {
        role: 'region',
        ariaLabel: 'Shopping cart',
        focusable: true,
        keyboardNavigable: true,
        screenReaderText: 'Your shopping cart with items and checkout',
      },
      platform: 'web',
      frameworks: ['react'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['cart', 'checkout'],
    },

    // Promotional carousel with voice ordering and specials
    promoCarousel: createPromoCarousel({
      name: 'CFC Promo Carousel',
      height: '140px',
      autoPlayInterval: 5000,
      showIndicators: true,
      showArrows: false,
      position: 'top',
      items: [
        // Voice ordering promo
        {
          id: 'voice-promo',
          type: 'voice-promo',
          title: 'Try Voice Ordering!',
          subtitle: 'Speak in English or Hindi',
          description: 'Just tap the mic and tell us what you\'d like to eat',
          icon: '🎤',
          backgroundColor: '#faf8f5',
          textColor: '#78350f',
          accentColor: '#c9a87a',
          gradient: {
            from: '#faf8f5',
            to: '#f5f0e8',
            direction: 'to-br',
          },
          action: {
            type: 'action',
            target: 'start-voice-ordering',
            label: 'Start Voice Order',
          },
          badge: {
            text: 'NEW',
            color: '#78350f',
          },
        },
        // Today's specials
        {
          id: 'todays-specials',
          type: 'special',
          title: "Chef's Specials",
          subtitle: 'Limited time offers',
          description: 'Try our handpicked favorites from Coorg',
          icon: '⭐',
          backgroundColor: '#f5f0e8',
          textColor: '#78350f',
          accentColor: '#a67c52',
          gradient: {
            from: '#f5f0e8',
            to: '#ebe0d0',
            direction: 'to-br',
          },
          action: {
            type: 'link',
            target: '/specials',
            label: 'View Specials',
          },
          badge: {
            text: 'HOT',
            color: '#ef4444',
          },
        },
        // Coorg coffee promo
        {
          id: 'coorg-coffee',
          type: 'announcement',
          title: 'Authentic Coorg Coffee',
          subtitle: 'From our plantations',
          description: 'Experience the rich aroma of fresh-brewed Coorg coffee',
          icon: '☕',
          backgroundColor: '#ebe0d0',
          textColor: '#5c2a0e',
          accentColor: '#8b5a2b',
          gradient: {
            from: '#ebe0d0',
            to: '#dccab0',
            direction: 'to-br',
          },
          action: {
            type: 'link',
            target: '/beverages',
            label: 'Order Coffee',
          },
        },
      ],
    }),

    // Inline promo carousel (below category pills)
    inlinePromoCarousel: createPromoCarousel({
      id: 'cfc-inline-promo',
      name: 'CFC Inline Promo Carousel',
      height: '120px',
      autoPlayInterval: 6000,
      showIndicators: true,
      showArrows: false,
      position: 'inline',
      items: [
        // Daily specials from menu
        createSpecialsPromoItem({
          id: 'daily-specials-inline',
          title: "Today's Specials",
          description: 'Fresh picks from our kitchen',
          primaryColor: '#78350f',
          accentColor: '#a67c52',
        }),
        // Free delivery promo
        createAnnouncementItem({
          id: 'free-delivery',
          title: 'Free Delivery',
          subtitle: 'Orders above ₹500',
          description: 'No delivery charges on orders over ₹500',
          icon: '🚚',
          backgroundColor: '#dcfce7',
          textColor: '#15803d',
          gradient: {
            from: '#dcfce7',
            to: '#bbf7d0',
            direction: 'to-br',
          },
        }),
        // Weekend special
        createAnnouncementItem({
          id: 'weekend-special',
          title: 'Weekend Feast',
          subtitle: 'Saturday & Sunday',
          description: 'Enjoy our special weekend menu with family combos',
          icon: '🎉',
          backgroundColor: '#fef3c7',
          textColor: '#92400e',
          gradient: {
            from: '#fef3c7',
            to: '#fde68a',
            direction: 'to-br',
          },
        }),
      ],
    }),

    // Marketing carousel for offers and communications
    marketingCarousel: createPromoCarousel({
      id: 'cfc-marketing-carousel',
      name: 'CFC Marketing & Offers',
      height: '240px',
      autoPlayInterval: 7000,
      showIndicators: false,
      showArrows: false,
      position: 'hero',
      items: [
        {
          id: 'call-us-hero',
          type: 'special',
          heroHeight: '240px',
          title: 'Order Directly & Save!',
          subtitle: 'Skip the app fees — call or WhatsApp us',
          description: 'Fresh Coorg flavours, delivered to you.',
          icon: '📞',
          backgroundColor: '#78350f',
          textColor: '#faf8f5',
          accentColor: '#fbbf24',
          badgeTextColor: '#78350f',
          gradient: {
            from: '#78350f',
            to: '#3b1a06',
            direction: 'to-br',
          },
          action: {
            type: 'link',
            target: 'tel:9886725947',
            label: '📞 Call Now',
          },
          secondaryAction: {
            label: '💬 WhatsApp',
            target: 'https://wa.me/919886725947?text=Hi%2C%20I%27d%20like%20to%20place%20an%20order',
            backgroundColor: '#25D366',
            textColor: '#ffffff',
            borderColor: 'transparent',
          },
          badge: {
            text: 'CALL US',
            color: '#fbbf24',
          },
        },
      ],
    }),
  },

  interactions: {
    voiceCommands: {
      browse: [
        {
          triggers: ['show menu', 'what do you have', 'menu please'],
          action: 'show_menu',
          feedback: 'Here is our menu',
          visualIndicator: true,
        },
        {
          triggers: ['show combos', 'combo meals'],
          action: 'filter_combos',
          feedback: 'Showing combo meals',
          visualIndicator: true,
        },
      ],
      order: [
        {
          triggers: ['add', 'order', 'I want'],
          action: 'add_to_cart',
          feedback: 'Added to cart',
          visualIndicator: true,
        },
        {
          triggers: ['remove', 'delete', 'take out'],
          action: 'remove_from_cart',
          feedback: 'Removed from cart',
          visualIndicator: true,
        },
      ],
      cart: [
        {
          triggers: ['show cart', 'my order', 'what did I order'],
          action: 'show_cart',
          feedback: 'Here is your cart',
          visualIndicator: true,
        },
        {
          triggers: ['checkout', 'pay now', 'complete order'],
          action: 'checkout',
          feedback: 'Proceeding to checkout',
          visualIndicator: true,
        },
      ],
      navigation: [
        {
          triggers: ['go back', 'previous'],
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
      longPressForDetails: true,
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

  customCSS: `
    /* CFC Custom Styles - Rich Coffee Brown Theme */
    :root {
      --cfc-primary: #78350f;
      --cfc-secondary: #a67c52;
      --cfc-accent: #c9a87a;
      --cfc-background: #faf8f5;
      --cfc-surface: #f5f0e8;
      --cfc-muted: #ebe0d0;
      --cfc-espresso: #5c2a0e;
    }

    .cfc-hero-text {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      background: linear-gradient(145deg, #78350f, #a67c52);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cfc-menu-card:hover {
      transform: translateY(-4px);
      transition: transform 0.3s ease-out;
    }

    .cfc-voice-orb-pulse {
      animation: cfcPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes cfcPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Promo Carousel Styles */
    .cfc-promo-slide {
      border-radius: 1rem;
      padding: 1.25rem;
      transition: transform 0.3s ease-out;
    }

    .cfc-promo-slide:hover {
      transform: scale(1.02);
    }

    .cfc-promo-badge {
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
    }

    .cfc-promo-icon {
      font-size: 2rem;
      animation: gentleBounce 2s ease-in-out infinite;
    }

    @keyframes gentleBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    /* Coffee theme button styles */
    .cfc-btn-primary {
      background: linear-gradient(145deg, #78350f, #5c2a0e);
      color: #faf8f5;
      border-radius: 0.75rem;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      transition: all 0.2s ease-out;
    }

    .cfc-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(120, 53, 15, 0.3);
    }

    .cfc-btn-secondary {
      background: linear-gradient(145deg, #f5f0e8, #ebe0d0);
      color: #78350f;
      border-radius: 0.75rem;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      transition: all 0.2s ease-out;
    }

    .cfc-btn-secondary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(166, 124, 82, 0.2);
    }
  `,
};

/**
 * Export as default
 */
export default CoorgFoodCompanyTheme;
