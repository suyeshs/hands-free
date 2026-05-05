/**
 * Grab Food - Promo Carousel Component
 *
 * Auto-scrolling promotional banner carousel with swipe gestures and indicators.
 * Mobile-optimized for deals and promotional content.
 */

import type { PromoCarouselComponent, PromoItem } from '../types';

export interface PromoCarouselOptions {
  id?: string;
  name?: string;
  height?: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showIndicators?: boolean;
  items?: PromoItem[];
}

/**
 * Create a promo carousel component
 */
export function createPromoCarousel(
  options: PromoCarouselOptions = {}
): PromoCarouselComponent {
  const {
    id = 'promo-carousel-1',
    name = 'Promo Carousel',
    height = '160px',
    autoPlay = true,
    autoPlayInterval = 4000,
    showIndicators = true,
    items = [],
  } = options;

  return {
    id,
    name,
    type: 'promo-carousel',
    description: 'Auto-scrolling promo banner carousel with indicators',
    category: 'marketing',
    items,

    dimensions: {
      width: '100%',
      height,
    },

    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },

    margin: {
      top: 0,
      right: 0,
      bottom: 16,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: '1.5',
    },

    layout: {
      height,
      aspectRatio: '2:1',
      gap: '12px',
      snap: true,
      autoPlay,
      autoPlayInterval,
    },

    indicators: {
      show: showIndicators,
      position: 'bottom-center',
      style: 'dots',
    },

    navigation: {
      showArrows: false,  // Mobile-first, no arrows
      showOnHover: false,
    },

    gestures: {
      swipe: true,
      momentum: true,
    },

    states: {
      default: {
        colors: {
          background: '#ffffff',
          text: '#1f2937',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '0.75rem',
        },
      },
    },

    transitions: [],

    defaultState: 'default',

    interaction: {
      primary: 'touch',
      alternatives: ['keyboard'],
      touch: {
        minTouchSize: { width: 320, height: 160 },
        haptic: 'light',
      },
      gesture: [
        {
          type: 'swipe-left',
          action: 'next-slide',
        },
        {
          type: 'swipe-right',
          action: 'prev-slide',
        },
      ],
    },

    accessibility: {
      role: 'region',
      ariaLabel: 'Promotions and deals carousel',
      focusable: false,
      keyboardNavigable: true,
      screenReaderText: 'Promotional banners',
    },

    platform: 'both',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['promo', 'carousel', 'banner', 'deals', 'marketing'],
  };
}
