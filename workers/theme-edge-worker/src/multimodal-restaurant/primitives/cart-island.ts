/**
 * Cart Island Component Primitive
 *
 * Floating cart indicator showing item count and total
 */

import type { CartIslandComponent } from '../types';

export interface CartIslandOptions {
  id?: string;
  name?: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-right';
  size?: 'sm' | 'md' | 'lg';
  showItemCount?: boolean;
  showTotal?: boolean;
  pulseOnAdd?: boolean;
}

export function createCartIsland(options: CartIslandOptions = {}): CartIslandComponent {
  const {
    id = 'cart-island-1',
    name = 'Cart Island',
    position = 'bottom-right',
    size = 'md',
    showItemCount = true,
    showTotal = true,
    pulseOnAdd = true,
  } = options;

  const sizeMap = {
    sm: { width: '3rem', height: '3rem', padding: 8 },
    md: { width: '4rem', height: '4rem', padding: 12 },
    lg: { width: '5rem', height: '5rem', padding: 16 },
  };

  const dimensions = sizeMap[size];

  return {
    id,
    name,
    type: 'cart-island',
    description: 'Floating cart indicator with item count and total',
    category: 'navigation',

    dimensions: {
      width: dimensions.width,
      height: dimensions.height,
    },

    padding: {
      top: dimensions.padding,
      right: dimensions.padding,
      bottom: dimensions.padding,
      left: dimensions.padding,
    },

    margin: { top: 0, right: 0, bottom: 0, left: 0 },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: '1',
    },

    position,
    size,
    showItemCount,
    showTotal,
    pulseOnAdd,
    expandBehavior: 'click',

    states: {
      default: {
        colors: {
          background: 'linear-gradient(145deg, #ffaa33, #ff9500)',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '-4px -4px 12px rgba(255,255,255,0.5), 4px 4px 12px rgba(0,0,0,0.2)',
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
          background: 'linear-gradient(145deg, #ffbb55, #ffa522)',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '-6px -6px 16px rgba(255,255,255,0.6), 6px 6px 16px rgba(0,0,0,0.25)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
        transform: 'scale(1.1)',
      },
      active: {
        colors: {
          background: 'linear-gradient(145deg, #ff9500, #ea580c)',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'inset -2px -2px 8px rgba(255,255,255,0.3), inset 2px 2px 8px rgba(0,0,0,0.2)',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
        transform: 'scale(1.0)',
      },
      pressed: {
        colors: {
          background: 'linear-gradient(145deg, #ff9500, #ea580c)',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'inset -2px -2px 8px rgba(255,255,255,0.3), inset 2px 2px 8px rgba(0,0,0,0.2)',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
        transform: 'scale(0.95)',
      },
      focused: {
        colors: {
          background: 'linear-gradient(145deg, #ffaa33, #ff9500)',
          text: '#ffffff',
          border: '#0ea5e9',
        },
        shadows: {
          outer: '-4px -4px 12px rgba(255,255,255,0.5), 4px 4px 12px rgba(0,0,0,0.2), 0 0 0 3px rgba(14, 165, 233, 0.3)',
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
          background: 'linear-gradient(145deg, #cbd5e1, #94a3b8)',
          text: '#64748b',
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
          background: 'linear-gradient(145deg, #ffaa33, #ff9500)',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '-4px -4px 12px rgba(255,255,255,0.5), 4px 4px 12px rgba(0,0,0,0.2)',
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
          background: 'linear-gradient(145deg, #fca5a5, #ef4444)',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '-4px -4px 12px rgba(255,255,255,0.5), 4px 4px 12px rgba(239, 68, 68, 0.2)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
      },
      success: {
        colors: {
          background: 'linear-gradient(145deg, #86efac, #22c55e)',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '-4px -4px 12px rgba(255,255,255,0.5), 4px 4px 12px rgba(34, 197, 94, 0.2)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
      },
    },

    transitions: [
      {
        from: 'default',
        to: 'hover',
        animation: { duration: 200, easing: 'ease-out' },
        haptic: false,
      },
      {
        from: 'hover',
        to: 'active',
        animation: { duration: 100, easing: 'ease-in' },
        haptic: true,
      },
    ],

    defaultState: 'default',

    interaction: {
      primary: 'touch',
      alternatives: ['keyboard'],
      touch: {
        minTouchSize: { width: 64, height: 64 },
        haptic: 'medium',
      },
      keyboard: [
        { key: 'c', modifiers: [] },
      ],
    },

    accessibility: {
      role: 'button',
      ariaLabel: 'View shopping cart',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Shopping cart with items',
    },

    platform: 'web',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['cart', 'shopping', 'checkout', 'floating'],
  };
}
