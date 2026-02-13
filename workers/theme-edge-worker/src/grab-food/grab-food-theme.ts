/**
 * Grab Food Theme
 *
 * Mobile-first restaurant ordering theme inspired by Grab Food design
 * Features hierarchical menu structure, efficient workflow, and clean UI
 */

import type { GrabFoodTheme as GrabFoodThemeType } from './types';
import { DefaultGrabFoodDesignTokens } from './design-tokens';
import { DefaultGrabFoodLayouts } from './layouts';
import {
  createMenuItemCard,
  createVoiceFAB,
  createCartPill,
  createSearchBar,
  createPromoCarousel,
  createOrderTracker,
  createBottomNav,
} from './primitives';

/**
 * Grab Food Theme Preset
 *
 * Key Features:
 * - Mobile-first 2-column grid layout
 * - Hierarchical menu (Categories → Sub-Categories → Items)
 * - Search with fuzzy matching
 * - Veg/Non-Veg toggle
 * - Time-based recommendations
 * - Floating cart + voice FAB
 * - Smooth animations
 */
export const GrabFoodTheme: GrabFoodThemeType = {
  version: '1.0.0',

  meta: {
    name: 'Grab Food Theme',
    description: 'Mobile-first restaurant ordering with hierarchical menu structure',
    author: 'Stonepot Platform',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['restaurant', 'grab-food', 'mobile-first', 'hierarchical-menu', 'multimodal'],
  },

  designTokens: DefaultGrabFoodDesignTokens,

  layouts: {
    home: DefaultGrabFoodLayouts.home,
    orderTracking: DefaultGrabFoodLayouts.orderTracking,
    restaurantDetail: DefaultGrabFoodLayouts.restaurantDetail,
  },

  components: {
    menuItemCard: createMenuItemCard({
      name: 'Grab Menu Item Card',
      variant: 'card',
      showImage: true,
      showDescription: true,
      showAddButton: true,
    }),

    promoCarousel: createPromoCarousel({
      name: 'Grab Promo Carousel',
      height: '160px',
      autoPlay: true,
      autoPlayInterval: 5000,
      showIndicators: true,
    }),

    orderTracker: createOrderTracker({
      name: 'Grab Order Tracker',
      variant: 'detailed',
      showMap: false,
      showDriverInfo: false,
    }),

    bottomNav: createBottomNav({
      name: 'Grab Bottom Navigation',
      showLabels: true,
      items: [
        {
          id: 'home',
          label: 'Home',
          icon: '🏠',
          route: '/',
        },
        {
          id: 'menu',
          label: 'Menu',
          icon: '🍽️',
          route: '/menu',
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: '📦',
          route: '/orders',
          badgeCount: 0,
        },
        {
          id: 'cart',
          label: 'Cart',
          icon: '🛒',
          route: '/cart',
          badgeCount: 0,
        },
      ],
    }),

    searchBar: createSearchBar({
      name: 'Grab Search Bar',
      placeholder: 'Search dishes or say "Show me masala dosa"',
      showVoiceButton: true,
    }),

    voiceFAB: createVoiceFAB({
      name: 'Grab Voice Assistant',
      size: 'md',
      position: 'bottom-right',
      showLabel: false,
      pulseIntensity: 'medium',
    }),

    cartPill: createCartPill({
      name: 'Grab Cart Pill',
      position: 'bottom-right',
      offset: { bottom: 24, right: 88 },
      showIcon: true,
      showCount: true,
      showTotal: true,
      enablePulseAnimation: true,
      autoHide: true,
    }),
  },

  interactions: {
    voiceCommands: {
      browse: [],
      order: [],
      tracking: [],
      navigation: [],
    },
    gestures: {
      swipeToRemove: true,
      pullToRefresh: true,
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
      prevCategory: 'ArrowLeft',
      nextCategory: 'ArrowRight',
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

/**
 * Export theme as default
 */
export default GrabFoodTheme;
