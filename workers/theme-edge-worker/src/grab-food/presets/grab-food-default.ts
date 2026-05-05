/**
 * Grab Food - Default Theme Preset
 *
 * Complete Grab-inspired food delivery theme configuration.
 * Mobile-first, app-like interface with voice commands and real-time tracking.
 */

import type { GrabFoodTheme } from '../types';
import { DefaultGrabFoodDesignTokens } from '../design-tokens';
import { DefaultGrabFoodLayouts } from '../layouts';
import {
  createMenuItemCard,
  createPromoCarousel,
  createOrderTracker,
  createBottomNav,
  createSearchBar,
  createVoiceFAB,
} from '../primitives';

export const GrabFoodDefaultTheme: GrabFoodTheme = {
  version: '1.0.0',

  meta: {
    name: 'Grab Food Default',
    description: 'Mobile-first single restaurant menu theme with Grab-inspired design',
    author: 'Stonepot Platform',
    category: 'grab-food',  // Theme category for layout detection
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['food-delivery', 'grab', 'mobile-first', 'order-tracking', 'voice', 'single-restaurant'],
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
      autoPlayInterval: 4000,
      showIndicators: true,
    }),

    orderTracker: createOrderTracker({
      name: 'Grab Order Tracker',
      variant: 'detailed',
      showMap: true,
      showDriverInfo: true,
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
          id: 'orders',
          label: 'Orders',
          icon: '📦',
          route: '/orders',
          badgeCount: 0,
        },
        {
          id: 'account',
          label: 'Account',
          icon: '👤',
          route: '/account',
        },
        {
          id: 'more',
          label: 'More',
          icon: '⋯',
          route: '/more',
        },
      ],
    }),

    searchBar: createSearchBar({
      name: 'Grab Search Bar',
      placeholder: 'Search for dishes',
      showVoiceButton: true,
      showFilters: true,
      sticky: true,
    }),

    voiceFAB: createVoiceFAB({
      name: 'Grab Voice FAB',
      size: 'md',
      position: 'bottom-right',
      showLabel: false,
      pulseIntensity: 'medium',
    }),
  },

  interactions: {
    voiceCommands: {
      browse: [
        {
          triggers: ['show menu', 'find food', 'what can I order'],
          action: 'show-home',
          feedback: 'Showing menu',
          visualIndicator: true,
        },
        {
          triggers: ['show deals', 'what promotions', 'any offers'],
          action: 'show-promos',
          feedback: 'Showing current promotions',
          visualIndicator: true,
        },
        {
          triggers: ['filter by category', 'show categories', 'filter'],
          action: 'show-filters',
          feedback: 'Showing filters',
          visualIndicator: true,
        },
      ],
      order: [
        {
          triggers: ['order', 'add to cart', 'I want'],
          action: 'add-to-cart',
          feedback: 'Adding to cart',
          visualIndicator: true,
        },
        {
          triggers: ['checkout', 'place order', 'confirm order'],
          action: 'checkout',
          feedback: 'Proceeding to checkout',
          visualIndicator: true,
        },
        {
          triggers: ['remove from cart', 'delete', 'cancel item'],
          action: 'remove-from-cart',
          feedback: 'Removing from cart',
          visualIndicator: true,
        },
      ],
      tracking: [
        {
          triggers: ['where is my order', 'track order', 'order status'],
          action: 'show-tracking',
          feedback: 'Showing order tracking',
          visualIndicator: true,
        },
        {
          triggers: ['call driver', 'contact driver'],
          action: 'call-driver',
          feedback: 'Calling driver',
          visualIndicator: true,
        },
        {
          triggers: ['estimated time', 'when will it arrive', 'how long'],
          action: 'show-eta',
          feedback: 'Showing estimated arrival time',
          visualIndicator: true,
        },
      ],
      navigation: [
        {
          triggers: ['go home', 'main screen'],
          action: 'navigate-home',
          feedback: 'Going to home',
          visualIndicator: true,
        },
        {
          triggers: ['my orders', 'order history'],
          action: 'navigate-orders',
          feedback: 'Showing your orders',
          visualIndicator: true,
        },
        {
          triggers: ['my account', 'profile'],
          action: 'navigate-account',
          feedback: 'Opening your account',
          visualIndicator: true,
        },
      ],
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

  customCSS: `
    :root {
      --grab-green: #00B14F;
      --grab-green-hover: #00983F;
      --grab-orange: #ff6c31;
      --grab-charcoal: #1f2937;
      --grab-light-gray: #f3f4f6;
    }

    /* Primary button */
    .grab-primary-button {
      background: linear-gradient(135deg, var(--grab-green), var(--grab-green-hover));
      color: white;
      border: none;
      border-radius: 0.5rem;
      padding: 12px 24px;
      font-weight: 600;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .grab-primary-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 177, 79, 0.3);
    }

    .grab-primary-button:active {
      transform: translateY(0);
    }

    /* Menu item card */
    .grab-menu-item-card {
      background: white;
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .grab-menu-item-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      border: 1px solid var(--grab-green);
    }

    .grab-menu-item-card:active {
      transform: translateY(0);
    }

    /* Bottom navigation */
    .grab-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
      z-index: 1000;
      display: flex;
      justify-content: space-around;
      align-items: center;
      height: 64px;
      padding: 8px 0;
    }

    .grab-bottom-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #6b7280;
      transition: color 0.2s ease;
      cursor: pointer;
    }

    .grab-bottom-nav-item.active {
      color: var(--grab-green);
    }

    /* Voice FAB */
    .grab-voice-fab {
      position: fixed;
      bottom: 80px;
      right: 16px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--grab-green), var(--grab-green-hover));
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0, 177, 79, 0.3);
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 999;
    }

    .grab-voice-fab:hover {
      transform: scale(1.1);
    }

    .grab-voice-fab:active {
      transform: scale(0.95);
    }

    .grab-voice-fab.listening {
      animation: voice-pulse 1.5s ease-in-out infinite;
    }

    @keyframes voice-pulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 4px 16px rgba(0, 177, 79, 0.3), 0 0 0 0 rgba(0, 177, 79, 0.4);
      }
      50% {
        transform: scale(1.1);
        box-shadow: 0 4px 16px rgba(0, 177, 79, 0.5), 0 0 0 16px rgba(0, 177, 79, 0);
      }
    }

    /* Promo badge */
    .grab-promo-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: var(--grab-orange);
      color: white;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    /* Search bar */
    .grab-search-bar {
      background: var(--grab-light-gray);
      border-radius: 0.5rem;
      padding: 12px 16px;
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }

    .grab-search-bar:focus {
      background: white;
      border-color: var(--grab-green);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      outline: none;
    }

    /* Filter chips */
    .grab-filter-chip {
      background: var(--grab-light-gray);
      border: 1px solid transparent;
      border-radius: 0.5rem;
      padding: 8px 16px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--grab-charcoal);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .grab-filter-chip:hover {
      background: white;
      border-color: var(--grab-green);
    }

    .grab-filter-chip.active {
      background: var(--grab-green);
      color: white;
    }

    /* Order tracker */
    .grab-order-tracker {
      background: white;
      border-radius: 0.75rem;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .grab-order-step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      position: relative;
    }

    .grab-order-step:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 20px;
      top: 48px;
      width: 2px;
      height: calc(100% - 48px);
      background: #e5e7eb;
    }

    .grab-order-step.completed::after {
      background: var(--grab-green);
    }

    .grab-order-step-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--grab-light-gray);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      position: relative;
      z-index: 1;
    }

    .grab-order-step.completed .grab-order-step-icon {
      background: var(--grab-green);
      color: white;
    }

    .grab-order-step.in-progress .grab-order-step-icon {
      background: var(--grab-orange);
      color: white;
      animation: icon-pulse 1s ease-in-out infinite;
    }

    @keyframes icon-pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
    }

    /* Responsive utilities */
    @media (max-width: 640px) {
      .grab-bottom-nav-item span {
        font-size: 0.75rem;
      }
    }

    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
    }

    /* Dark mode support (optional) */
    @media (prefers-color-scheme: dark) {
      .grab-menu-item-card {
        background: #1f2937;
        color: white;
      }

      .grab-bottom-nav {
        background: #1f2937;
        border-top: 1px solid #374151;
      }

      .grab-order-tracker {
        background: #1f2937;
        color: white;
      }
    }
  `,
};
