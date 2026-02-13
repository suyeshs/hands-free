/**
 * Subscription Meals Theme
 *
 * Restaurant theme with weekly meal subscription features
 * Includes subscription management, weekly menu browsing, and delivery scheduling
 */

import type { MultimodalRestaurantTheme, RestaurantDesignTokens } from '../types';
import { DefaultRestaurantDesignTokens, CoffeeBrownScale, DeepSlateScale, FreshGreenScale, RichRedScale } from '../design-tokens';
import { DefaultLayouts } from '../layouts';
import {
  createMenuCard,
  createComboCard,
  // createVoiceOrb, // Voice feature commented out
  createCartIsland,
  createCategoryCarousel,
  createPromoCarousel,
  // createVoicePromoItem, // Voice feature commented out
  createSpecialsPromoItem,
  createAnnouncementItem,
} from '../primitives';

/**
 * Subscription Theme Custom Design Tokens
 * Coffee brown palette with subscription-specific purple accents
 */
const SubscriptionDesignTokens: RestaurantDesignTokens = {
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
    // Subscription features use RoseScale for accents (applied in CSS)
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
    status: {
      ...DefaultRestaurantDesignTokens.colors.status,
      // Use existing status colors: success (green), warning (amber), error (red), info (blue)
    },
    // Voice states disabled
    // voiceStates: {
    //   idle: '#a67c52',      // Warm brown for idle
    //   listening: '#0ea5e9', // Blue for listening
    //   thinking: '#f59e0b',  // Amber for thinking
    //   speaking: '#22c55e',  // Green for speaking
    // },
  },
};

/**
 * Create subscription plan card component
 */
const createSubscriptionPlanCard = (options: {
  size?: 'compact' | 'comfortable' | 'spacious';
  showBadges?: boolean;
  highlightRecommended?: boolean;
}) => ({
  type: 'subscription-plan-card' as const,
  variant: 'default',
  size: options.size || 'comfortable',
  layout: {
    padding: options.size === 'compact' ? '1rem' : options.size === 'spacious' ? '2rem' : '1.5rem',
    gap: '1rem',
    borderRadius: 'lg',
  },
  content: {
    showPlanName: true,
    showPrice: true,
    showDuration: true,
    showMealsPerWeek: true,
    showDeliveryDays: true,
    showCuisineType: true,
    showBenefits: true,
    showBadges: options.showBadges ?? true,
    highlightRecommended: options.highlightRecommended ?? true,
  },
  appearance: {
    backgroundColor: 'surface',
    borderColor: 'primary.200',
    borderWidth: '2px',
    hoverScale: 1.02,
    shadow: 'md',
    hoverShadow: 'lg',
    recommendedGlow: true,
  },
  interactions: {
    onClick: 'view-details',
    hoverEffect: 'lift-subtle',
  },
});

/**
 * Create weekly menu card component
 */
const createWeeklyMenuCard = (options: {
  size?: 'compact' | 'comfortable' | 'spacious';
  showPreview?: boolean;
}) => ({
  type: 'weekly-menu-card' as const,
  variant: 'default',
  size: options.size || 'comfortable',
  layout: {
    padding: '1.5rem',
    gap: '1rem',
    borderRadius: 'lg',
  },
  content: {
    showWeekNumber: true,
    showDateRange: true,
    showCuisineType: true,
    showItemCount: true,
    showOrderStatus: true,
    showPreview: options.showPreview ?? true,
    previewItemCount: 3,
    showOrderCutoff: true,
  },
  appearance: {
    backgroundColor: 'elevated',
    borderColor: 'primary.300',
    borderWidth: '1px',
    shadow: 'sm',
    hoverShadow: 'md',
  },
  interactions: {
    onClick: 'view-menu',
    hoverEffect: 'lift-subtle',
  },
});

/**
 * Create subscription dashboard widget
 */
const createSubscriptionDashboardWidget = () => ({
  type: 'subscription-dashboard' as const,
  variant: 'default',
  layout: {
    padding: '2rem',
    gap: '1.5rem',
    borderRadius: 'xl',
  },
  sections: {
    activePlan: {
      show: true,
      position: 'top',
      showPlanDetails: true,
      showNextBilling: true,
      showActions: true,
    },
    upcomingDeliveries: {
      show: true,
      position: 'middle',
      maxItems: 3,
      showTimeSlots: true,
      showTowerInfo: true,
    },
    weeklyMenus: {
      show: true,
      position: 'bottom',
      maxWeeks: 4,
      showAvailability: true,
      showOrderCutoff: true,
    },
  },
  appearance: {
    backgroundColor: 'surface',
    shadow: 'md',
  },
});

/**
 * Create subscription carousel component
 */
const createSubscriptionCarousel = () => ({
  type: 'subscription-carousel' as const,
  variant: 'default',
  layout: {
    itemsPerView: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
    },
    gap: '1.5rem',
    padding: '1rem',
  },
  navigation: {
    showArrows: true,
    showDots: true,
    autoplay: false,
  },
  appearance: {
    arrowColor: 'primary.600',
    dotColor: 'primary.400',
    activeDotColor: 'primary.700',
  },
});

/**
 * Create delivery schedule widget
 */
const createDeliveryScheduleWidget = () => ({
  type: 'delivery-schedule' as const,
  variant: 'default',
  layout: {
    padding: '1.5rem',
    gap: '1rem',
    borderRadius: 'lg',
  },
  content: {
    showWeekView: true,
    showTimeSlots: true,
    showTowerRoutes: true,
    showDeliveryStatus: true,
    groupByTower: true,
  },
  appearance: {
    backgroundColor: 'elevated',
    borderColor: 'primary.200',
    borderWidth: '1px',
    shadow: 'sm',
  },
  interactions: {
    selectTimeSlot: true,
    viewDetails: true,
    trackDelivery: true,
  },
});

/**
 * Subscription Meals Theme
 */
export const SubscriptionTheme: MultimodalRestaurantTheme = {
  version: '1.0.0',

  meta: {
    name: 'Subscription Meals',
    displayName: 'Subscription',
    description: 'Weekly meal subscriptions with voice-assisted ordering for gated communities',
    restaurantId: 'coorg-food-company-subscriptions',
    author: 'Stonepot Platform',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['restaurant', 'south-indian', 'voice-ordering', 'multimodal', 'subscription', 'weekly-meals'],
    // Logo URL - Cloudflare Images
    logo: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/8d313e79-77a9-4c93-4c21-41015e4e1700/public',
    favicon: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/8d313e79-77a9-4c93-4c21-41015e4e1700/public',
  },

  designTokens: SubscriptionDesignTokens,

  layouts: {
    // Enhanced landing layout with subscription option
    landing: {
      ...DefaultLayouts.landing,
      choiceCards: {
        // Voice ordering disabled - minimal config required by type
        voice: {
          label: 'Voice Ordering (Unavailable)',
          description: 'Voice ordering is currently unavailable',
          icon: '🔇',
          gradient: {
            from: '#e5e7eb',
            to: '#d1d5db',
            direction: 'to-br',
          },
          benefits: [],
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
            icon: '📦',
            title: 'Weekly Subscriptions',
            description: 'Regular deliveries to your tower',
          },
          {
            icon: '⚡',
            title: 'Quick Ordering',
            description: 'Voice, touch, or subscribe',
          },
        ],
      },
    },

    // Voice-assisted layout - disabled but required by type (uses defaults)
    voiceAssisted: {
      ...DefaultLayouts.voiceAssisted,
      // All voice features are disabled in components
    },

    // Enhanced standard browse with subscription sections
    standardBrowse: {
      ...DefaultLayouts.standardBrowse,
      type: 'grid',
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
      filters: {
        show: true,
        position: 'top',
        options: [
          { type: 'dietary', label: 'Dietary', enabled: true },
          { type: 'price', label: 'Price', enabled: true },
          { type: 'spice', label: 'Spice Level', enabled: true },
        ],
      },
      search: {
        show: true,
        position: 'header',
        placeholder: 'Search menu or subscriptions...',
      },
    },
  },

  components: {
    // Standard restaurant components
    menuCard: createMenuCard({
      cardSize: 'comfortable',
      imageHeight: '12rem',
      showRating: true,
      showBadges: true,
      showDescription: true,
    }),

    comboCard: createComboCard({
      cardSize: 'comfortable',
      choiceDisplay: 'expandable',
      choiceStyle: 'radio',
    }),

    // Voice feature disabled - minimal placeholder to satisfy type requirements
    voiceOrb: {
      id: 'disabled-voice-orb',
      name: 'Voice Orb (Disabled)',
      type: 'voice-orb' as const,
      description: 'Voice ordering disabled',
      category: 'action' as const,
      dimensions: { width: '0px', height: '0px' },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 0,
        fontWeight: 400,
        lineHeight: 0,
      },
      size: 'sm' as const,
      position: 'bottom-center' as const,
      showLabel: false,
      showVisualizer: false,
      pulseIntensity: 'off' as const,
      states: {} as any,
      transitions: [],
      defaultState: 'disabled',
      interaction: {
        primary: 'touch' as const,
        alternatives: [],
      },
      accessibility: {
        role: 'button',
        ariaLabel: 'Voice ordering disabled',
        focusable: false,
        keyboardNavigable: false,
        screenReaderText: 'Voice ordering is not available',
      },
      platform: 'web' as const,
      frameworks: ['react'] as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['voice', 'disabled'],
    },

    cartIsland: createCartIsland({
      position: 'bottom-right',
      size: 'md',
      showItemCount: true,
      showTotal: true,
      pulseOnAdd: true,
    }),

    categoryCarousel: createCategoryCarousel({
      layout: 'horizontal',
      itemStyle: 'pills',
      showIcons: true,
      showCount: true,
      scrollBehavior: 'smooth',
    }),

    promoCarousel: createPromoCarousel({
      position: 'top',
      height: '140px',
      autoPlayInterval: 5000,
      showIndicators: true,
      showArrows: false,
      items: [
        // Subscription promo
        createAnnouncementItem({
          id: 'subscription-promo',
          title: 'Weekly Meal Subscriptions',
          subtitle: 'Subscribe & Save',
          description: 'Regular home-cooked meals delivered to your tower',
          icon: '📦',
          backgroundColor: '#faf5ff',
          textColor: '#6b21a8',
          gradient: {
            from: '#faf5ff',
            to: '#f3e8ff',
            direction: 'to-br',
          },
        }),
        // Voice ordering promo - commented out
        // createVoicePromoItem(),
        // Today's specials
        createSpecialsPromoItem(),
      ],
    }),

    orderProgress: {
      id: 'sub-progress',
      name: 'Subscription Order Progress',
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
            background: '#faf8f5',
            text: '#78350f',
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
            background: '#faf8f5',
            text: '#78350f',
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
            background: '#f5f0e8',
            text: '#78350f',
            border: 'transparent',
          },
          shadows: {
            outer: 'none',
            inner: '2px 2px 4px rgba(0,0,0,0.1)',
          },
          border: {
            width: '0',
            style: 'solid',
            radius: '50%',
          },
        },
        pressed: {
          colors: {
            background: '#faf8f5',
            text: '#78350f',
            border: 'transparent',
          },
          shadows: {
            outer: 'none',
            inner: '2px 2px 4px rgba(0,0,0,0.15)',
          },
          border: {
            width: '0',
            style: 'solid',
            radius: '50%',
          },
        },
        focused: {
          colors: {
            background: '#faf8f5',
            text: '#78350f',
            border: '#a67c52',
          },
          shadows: {
            outer: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(0,0,0,0.15), 0 0 0 3px rgba(166, 124, 82, 0.3)',
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
            background: '#e5e7eb',
            text: '#9ca3af',
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
            background: '#faf8f5',
            text: '#a67c52',
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
      id: 'sub-dish-modal',
      name: 'Subscription Dish Details',
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
            background: '#faf8f5',
            text: '#78350f',
            border: '#d4c4a8',
          },
          shadows: {
            outer: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1rem',
          },
        },
        hover: {
          colors: {
            background: '#faf8f5',
            text: '#78350f',
            border: '#d4c4a8',
          },
          shadows: {
            outer: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1rem',
          },
        },
        active: {
          colors: {
            background: '#faf8f5',
            text: '#78350f',
            border: '#d4c4a8',
          },
          shadows: {
            outer: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1rem',
          },
        },
        pressed: {
          colors: {
            background: '#f5f0e8',
            text: '#78350f',
            border: '#d4c4a8',
          },
          shadows: {
            outer: 'none',
            inner: '2px 2px 4px rgba(0,0,0,0.1)',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1rem',
          },
        },
        focused: {
          colors: {
            background: '#faf8f5',
            text: '#78350f',
            border: '#a67c52',
          },
          shadows: {
            outer: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 3px rgba(166, 124, 82, 0.3)',
            inner: 'none',
          },
          border: {
            width: '2px',
            style: 'solid',
            radius: '1rem',
          },
        },
        disabled: {
          colors: {
            background: '#e5e7eb',
            text: '#9ca3af',
            border: '#d1d5db',
          },
          shadows: {
            outer: 'none',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1rem',
          },
        },
        loading: {
          colors: {
            background: '#faf8f5',
            text: '#a67c52',
            border: '#d4c4a8',
          },
          shadows: {
            outer: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1rem',
          },
        },
        error: {
          colors: {
            background: '#fee2e2',
            text: '#b91c1c',
            border: '#fca5a5',
          },
          shadows: {
            outer: '0 20px 25px -5px rgba(239, 68, 68, 0.2)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1rem',
          },
        },
        success: {
          colors: {
            background: '#dcfce7',
            text: '#15803d',
            border: '#86efac',
          },
          shadows: {
            outer: '0 20px 25px -5px rgba(34, 197, 94, 0.2)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '1rem',
          },
        },
      },
      transitions: [],
      defaultState: 'default',
      interaction: {
        primary: 'touch',
        alternatives: [], // Voice disabled
      },
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
      tags: ['modal', 'details'],
    },

    cart: {
      id: 'sub-cart',
      name: 'Subscription Shopping Cart',
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
        showDelivery: true,
        showDiscount: true,
      },
      emptyState: {
        icon: '🛒',
        message: 'Your cart is empty',
        ctaText: 'Browse Menu',
      },
      states: {
        default: {
          colors: {
            background: '#faf8f5',
            text: '#78350f',
            border: '#d4c4a8',
          },
          shadows: {
            outer: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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
            background: '#faf8f5',
            text: '#78350f',
            border: '#d4c4a8',
          },
          shadows: {
            outer: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '0.75rem',
          },
        },
        active: {
          colors: {
            background: '#f5f0e8',
            text: '#78350f',
            border: '#a67c52',
          },
          shadows: {
            outer: 'none',
            inner: '2px 2px 4px rgba(0,0,0,0.1)',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '0.75rem',
          },
        },
        pressed: {
          colors: {
            background: '#f5f0e8',
            text: '#78350f',
            border: '#d4c4a8',
          },
          shadows: {
            outer: 'none',
            inner: '2px 2px 4px rgba(0,0,0,0.15)',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '0.75rem',
          },
        },
        focused: {
          colors: {
            background: '#faf8f5',
            text: '#78350f',
            border: '#a67c52',
          },
          shadows: {
            outer: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(166, 124, 82, 0.3)',
            inner: 'none',
          },
          border: {
            width: '2px',
            style: 'solid',
            radius: '0.75rem',
          },
        },
        disabled: {
          colors: {
            background: '#e5e7eb',
            text: '#9ca3af',
            border: '#d1d5db',
          },
          shadows: {
            outer: 'none',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '0.75rem',
          },
        },
        loading: {
          colors: {
            background: '#faf8f5',
            text: '#a67c52',
            border: '#d4c4a8',
          },
          shadows: {
            outer: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '0.75rem',
          },
        },
        error: {
          colors: {
            background: '#fee2e2',
            text: '#b91c1c',
            border: '#fca5a5',
          },
          shadows: {
            outer: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '0.75rem',
          },
        },
        success: {
          colors: {
            background: '#dcfce7',
            text: '#15803d',
            border: '#86efac',
          },
          shadows: {
            outer: '0 4px 6px -1px rgba(34, 197, 94, 0.2)',
            inner: 'none',
          },
          border: {
            width: '1px',
            style: 'solid',
            radius: '0.75rem',
          },
        },
      },
      transitions: [],
      defaultState: 'default',
      interaction: {
        primary: 'touch',
        alternatives: [], // Voice disabled
      },
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
      tags: ['cart', 'checkout'],
    },
  },

  interactions: {
    // Voice commands disabled - empty arrays satisfy type requirements
    voiceCommands: {
      browse: [],
      order: [],
      cart: [],
      navigation: [],
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
        voiceActivation: false, // Voice disabled
        error: true,
      },
    },

    keyboard: {
      search: '/',
      cart: 'c',
      voiceActivate: '', // Voice disabled - empty binding
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
      alternativeInputMethods: false, // Voice disabled
      visualFeedback: false,
      errorRecovery: false,
    },
  },

  customCSS: `
    /* Coorg Subscription Theme Custom Styles */
    :root {
      /* Coffee Brown palette */
      --cfc-primary-50: #faf8f5;
      --cfc-primary-100: #f5f0e8;
      --cfc-primary-200: #ebe0d0;
      --cfc-primary-300: #d4c4a8;
      --cfc-primary-400: #c9a87a;
      --cfc-primary-500: #a67c52;
      --cfc-primary-600: #8b5a2b;
      --cfc-primary-700: #78350f;
      --cfc-primary-800: #5c2a0e;
      --cfc-primary-900: #3d1d0a;
      --cfc-primary-950: #2d1106;

      /* Subscription purple accent */
      --cfc-subscription-50: #faf5ff;
      --cfc-subscription-100: #f3e8ff;
      --cfc-subscription-500: #9333ea;
      --cfc-subscription-600: #7e22ce;
      --cfc-subscription-700: #6b21a8;

      /* Surface colors */
      --cfc-bg-main: #faf8f5;
      --cfc-bg-surface: #f5f0e8;
      --cfc-bg-elevated: #ffffff;

      /* Text colors */
      --cfc-text-primary: #78350f;
      --cfc-text-secondary: #8b5a2b;
      --cfc-text-tertiary: #a67c52;
    }

    /* Gradient text effect for hero sections */
    .cfc-gradient-text {
      background: linear-gradient(135deg, var(--cfc-primary-700), var(--cfc-primary-500));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Subscription badge glow effect */
    .cfc-subscription-badge {
      background: linear-gradient(135deg, var(--cfc-subscription-500), var(--cfc-subscription-600));
      box-shadow: 0 0 20px rgba(147, 51, 234, 0.3);
      animation: pulse-glow 2s ease-in-out infinite;
    }

    @keyframes pulse-glow {
      0%, 100% {
        box-shadow: 0 0 20px rgba(147, 51, 234, 0.3);
      }
      50% {
        box-shadow: 0 0 30px rgba(147, 51, 234, 0.5);
      }
    }

    /* Card hover animations */
    .cfc-card {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .cfc-card:hover {
      transform: translateY(-4px);
      box-shadow:
        -8px -8px 16px rgba(255, 255, 255, 0.8),
        8px 8px 16px rgba(0, 0, 0, 0.15);
    }

    /* Subscription plan card highlight */
    .cfc-plan-card.recommended {
      border-color: var(--cfc-subscription-500);
      box-shadow:
        0 0 0 2px var(--cfc-subscription-500),
        -8px -8px 16px rgba(255, 255, 255, 0.8),
        8px 8px 16px rgba(0, 0, 0, 0.15);
    }

    /* Voice orb pulse animation - commented out (voice disabled) */
    /* @keyframes voice-pulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(166, 124, 82, 0.4);
      }
      50% {
        box-shadow: 0 0 0 20px rgba(166, 124, 82, 0);
      }
    }

    .cfc-voice-orb.listening {
      animation: voice-pulse 1.5s ease-out infinite;
    } */

    /* Weekly menu status indicators */
    .cfc-menu-status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .cfc-menu-status.available {
      background: rgba(34, 197, 94, 0.1);
      color: #16a34a;
    }

    .cfc-menu-status.cutoff-passed {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
    }

    .cfc-menu-status.past {
      background: rgba(156, 163, 175, 0.1);
      color: #6b7280;
    }

    /* Delivery schedule timeline */
    .cfc-delivery-timeline {
      position: relative;
      padding-left: 2rem;
    }

    .cfc-delivery-timeline::before {
      content: '';
      position: absolute;
      left: 0.5rem;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, var(--cfc-primary-300), var(--cfc-primary-500));
    }

    .cfc-delivery-item {
      position: relative;
      padding: 1rem 0;
    }

    .cfc-delivery-item::before {
      content: '';
      position: absolute;
      left: -1.625rem;
      top: 1.5rem;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--cfc-primary-500);
      border: 2px solid var(--cfc-bg-main);
    }

    /* Subscription action buttons */
    .cfc-btn-primary {
      background: linear-gradient(135deg, var(--cfc-primary-600), var(--cfc-primary-700));
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }

    .cfc-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(120, 53, 15, 0.3);
    }

    .cfc-btn-subscription {
      background: linear-gradient(135deg, var(--cfc-subscription-600), var(--cfc-subscription-700));
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }

    .cfc-btn-subscription:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
    }

    /* Promo icon bounce animation */
    @keyframes bounce-gentle {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-6px);
      }
    }

    .cfc-promo-icon {
      display: inline-block;
      animation: bounce-gentle 2s ease-in-out infinite;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .cfc-card {
        margin: 0.5rem;
      }

      .cfc-btn-primary,
      .cfc-btn-subscription {
        width: 100%;
      }
    }
  `,
};

export default SubscriptionTheme;
