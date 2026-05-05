/**
 * Category Carousel Component Primitive
 *
 * Horizontal scrolling category navigation
 */

import type { CategoryCarouselComponent } from '../types';

export interface CategoryCarouselOptions {
  id?: string;
  name?: string;
  layout?: 'horizontal' | 'vertical';
  itemStyle?: 'pills' | 'cards' | 'tabs';
  showIcons?: boolean;
  showCount?: boolean;
  scrollBehavior?: 'snap' | 'smooth' | 'momentum';
}

export function createCategoryCarousel(options: CategoryCarouselOptions = {}): CategoryCarouselComponent {
  const {
    id = 'category-carousel-1',
    name = 'Category Carousel',
    layout = 'horizontal',
    itemStyle = 'pills',
    showIcons = true,
    showCount = true,
    scrollBehavior = 'smooth',
  } = options;

  return {
    id,
    name,
    type: 'category-carousel',
    description: 'Scrollable category navigation with visual indicators',
    category: 'navigation',

    dimensions: {
      width: '100%',
      height: 'auto',
    },

    padding: {
      top: 12,
      right: 16,
      bottom: 12,
      left: 16,
    },

    margin: { top: 0, right: 0, bottom: 16, left: 0 },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: '1.25',
    },

    layout,
    itemStyle,
    showIcons,
    showCount,
    scrollBehavior,
    activeIndicator: itemStyle === 'tabs' ? 'underline' : 'background',

    states: {
      default: {
        colors: {
          background: 'transparent',
          text: '#64748b',
          border: '#e2e8f0',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '9999px',
        },
      },
      hover: {
        colors: {
          background: '#f8fafc',
          text: '#475569',
          border: '#cbd5e1',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '9999px',
        },
      },
      active: {
        colors: {
          background: 'linear-gradient(145deg, #ffaa33, #ff9500)',
          text: '#ffffff',
          border: '#ff9500',
        },
        shadows: {
          outer: '-2px -2px 8px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.15)',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '9999px',
        },
      },
      pressed: {
        colors: {
          background: 'linear-gradient(145deg, #ff9500, #ea580c)',
          text: '#ffffff',
          border: '#ff9500',
        },
        shadows: {
          outer: 'none',
          inner: 'inset -1px -1px 4px rgba(255,255,255,0.3), inset 1px 1px 4px rgba(0,0,0,0.2)',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '9999px',
        },
      },
      focused: {
        colors: {
          background: 'transparent',
          text: '#64748b',
          border: '#0ea5e9',
        },
        shadows: {
          outer: '0 0 0 3px rgba(14, 165, 233, 0.3)',
          inner: 'none',
        },
        border: {
          width: '2px',
          style: 'solid',
          radius: '9999px',
        },
      },
      disabled: {
        colors: {
          background: 'transparent',
          text: '#cbd5e1',
          border: '#e2e8f0',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '9999px',
        },
      },
      loading: {
        colors: {
          background: '#f8fafc',
          text: '#94a3b8',
          border: '#e2e8f0',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '9999px',
        },
      },
      error: {
        colors: {
          background: '#fee2e2',
          text: '#b91c1c',
          border: '#fca5a5',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '9999px',
        },
      },
      success: {
        colors: {
          background: '#dcfce7',
          text: '#15803d',
          border: '#86efac',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '9999px',
        },
      },
    },

    transitions: [
      {
        from: 'default',
        to: 'hover',
        animation: { duration: 150, easing: 'ease-out' },
        haptic: false,
      },
      {
        from: 'hover',
        to: 'active',
        animation: { duration: 200, easing: 'ease-out' },
        haptic: true,
      },
    ],

    defaultState: 'default',

    interaction: {
      primary: 'touch',
      alternatives: ['keyboard', 'voice'],
      touch: {
        minTouchSize: { width: 88, height: 44 },
        haptic: 'light',
      },
      voice: [
        {
          triggers: ['show', 'go to', 'filter by'],
          feedback: 'Category selected',
          visualIndicator: true,
        },
      ],
      keyboard: [
        { key: 'ArrowLeft', modifiers: [] },
        { key: 'ArrowRight', modifiers: [] },
      ],
      gesture: [
        {
          type: 'swipe',
          direction: 'horizontal',
          action: 'scroll',
        },
      ],
    },

    accessibility: {
      role: 'navigation',
      ariaLabel: 'Category navigation',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Navigate between menu categories',
    },

    platform: 'web',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['category', 'navigation', 'carousel', 'filter'],
  };
}
