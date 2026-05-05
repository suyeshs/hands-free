/**
 * Khao Piyo - Custom Theme Preset
 *
 * Hybrid theme combining:
 * - Visual Design: Grab Food (flat, clean, mobile-first)
 * - Interactions: Multimodal (voice+touch+keyboard synchronization)
 *
 * Restaurant: Khao Piyo - Mumbai Street Food
 * Menu: 2000+ items with voice-guided discovery
 */

import type { GrabFoodTheme, ColorScale } from '../types';
import { GrabFoodDefaultTheme } from './grab-food-default';
import {
  createMenuItemCard,
  createPromoCarousel,
  createOrderTracker,
  createBottomNav,
  createSearchBar,
  createVoiceFAB,
  createCartPill,
  createVegToggle,
} from '../primitives';

// Custom color scales for Khao Piyo branding
const khaoPiyoOrange: ColorScale = {
  50: '#FFF5E6',
  100: '#FFE8CC',
  200: '#FFD699',
  300: '#FFC466',
  400: '#FFB233',
  500: '#FFA000', // Main brand color - appetite stimulation
  600: '#CC8000',
  700: '#996000',
  800: '#664000',
  900: '#332000',
  950: '#1A1000',
};

const khaoPiyoGreen: ColorScale = {
  50: '#E8F5E9',
  100: '#C8E6C9',
  200: '#A5D6A7',
  300: '#81C784',
  400: '#66BB6A',
  500: '#4CAF50', // Vegetarian indicator
  600: '#43A047',
  700: '#388E3C',
  800: '#2E7D32',
  900: '#1B5E20',
  950: '#0D3818',
};

const khaoPiyoRed: ColorScale = {
  50: '#FFEBEE',
  100: '#FFCDD2',
  200: '#EF9A9A',
  300: '#E57373',
  400: '#EF5350',
  500: '#F44336', // Non-vegetarian indicator
  600: '#E53935',
  700: '#D32F2F',
  800: '#C62828',
  900: '#B71C1C',
  950: '#8B0000',
};

export const KhaoPiyoTheme: GrabFoodTheme = {
  ...GrabFoodDefaultTheme,

  version: '1.0.0',

  meta: {
    name: 'KHAO PIYO',
    description: 'THE MULTI CUISINE FAMILY RESTAURANT & BAR - Multimodal ordering for 2000+ menu items',
    author: 'Stonepot Platform',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['indian-street-food', 'chaats', 'mumbai', 'vegetarian', 'multimodal', '2000-items'],
  },

  /**
   * Branding Assets (configured via khaopiyo-theme-config.json):
   * - Logo: https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/khao-piyo-logo/public (1348x1349px)
   * - Name Image: https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/khao-piyo-text/public (1658x244px)
   * Uploaded to Cloudflare Images for optimal delivery and CDN caching
   */

  // Design tokens: Inherit Grab Food structure, customize colors
  designTokens: {
    ...GrabFoodDefaultTheme.designTokens,

    colors: {
      ...GrabFoodDefaultTheme.designTokens.colors,

      // Orange primary for appetite stimulation
      primary: khaoPiyoOrange,

      // Green accent for vegetarian emphasis
      accent: khaoPiyoGreen,

      // Keep secondary from default (teal for links/info)
      secondary: GrabFoodDefaultTheme.designTokens.colors.secondary,

      // Dietary-specific colors
      success: khaoPiyoGreen, // For veg indicators
      error: khaoPiyoRed, // For non-veg indicators
    },

    // Inherit all other design tokens from Grab Food
    // This includes: spacing, typography, shadows (flat, not neumorphic),
    // borders, radius, transitions, etc.
  },

  // Inherit layouts from Grab Food
  layouts: GrabFoodDefaultTheme.layouts,

  // Components: Grab Food base + multimodal enhancements
  components: {
    // Menu item card with dietary badges
    // Note: variant is not specified here - it's controlled by the layout (card/list/compact)
    menuItemCard: createMenuItemCard({
      name: 'Khao Piyo Menu Card',
      showImage: true,
      showDescription: true,
      showAddButton: true,
    }),

    // Promo carousel for featured items
    promoCarousel: createPromoCarousel({
      name: 'Khao Piyo Promo Carousel',
      height: '180px',
      autoPlay: true,
      autoPlayInterval: 5000,
      showIndicators: true,
      items: [
        {
          id: 'mumbai-feast',
          title: 'Mumbai Street Food Feast',
          description: 'Authentic Vada Pav & Pav Bhaji at your doorstep.',
          gradient: 'linear-gradient(135deg, #FFA000, #FF6F00)',
          code: 'MUMBAI20'
        },
        {
          id: 'free-delivery',
          title: 'Free Delivery',
          description: 'On all orders above ₹500 today!',
          gradient: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
          code: 'FREEDEL'
        },
        {
          id: 'combo-offer',
          title: 'Lunch Combos',
          description: 'Save 25% on our executive lunch thalis.',
          gradient: 'linear-gradient(135deg, #F44336, #B71C1C)',
          code: 'THALI25'
        }
      ]
    }),

    // Order tracker
    orderTracker: createOrderTracker({
      name: 'Khao Piyo Order Tracker',
      variant: 'detailed',
      showMap: false, // Not needed for street food pickup
      showDriverInfo: false,
    }),

    // Bottom navigation
    bottomNav: createBottomNav({
      name: 'Khao Piyo Bottom Nav',
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

    // Search bar with voice button
    searchBar: createSearchBar({
      name: 'Khao Piyo Search',
      placeholder: 'Search 2000+ items or say "Show me masala dosa"',
      showVoiceButton: true, // MULTIMODAL: Voice search
    }),

    // Voice FAB (Multimodal enhancement)
    voiceFAB: createVoiceFAB({
      name: 'Khao Piyo Voice Assistant',
      size: 'lg',
      position: 'bottom-right',
      showLabel: false,
      pulseIntensity: 'medium',
    }),

    // Cart Pill (floating cart next to voice button)
    cartPill: createCartPill({
      name: 'Khao Piyo Cart',
      position: 'bottom-right',
      offset: { bottom: 24, right: 88 }, // Left of voice FAB (56px + 32px spacing)
      showIcon: true,
      showCount: true,
      showTotal: true,
      enablePulseAnimation: true,
      autoHide: true, // Hide when cart is empty
    }),

    // Veg Toggle (dietary filter in category header)
    vegToggle: createVegToggle({
      name: 'Khao Piyo Dietary Filter',
      defaultFilter: 'all',
      showVegIcon: true,
      showNonVegIcon: false, // Khao Piyo is primarily vegetarian
      position: 'category-header',
    }),
  },

  // Accessibility settings
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
