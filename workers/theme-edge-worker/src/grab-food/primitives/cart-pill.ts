/**
 * Cart Pill Primitive - Floating cart widget
 *
 * Features:
 * - Displays cart icon, item count, and total price
 * - Floats next to voice FAB at bottom-right
 * - Hidden when cart is empty
 * - Pulse animation on add to cart
 * - Click to view cart
 */

import type { CartPillComponent } from '../types';

export interface CartPillOptions {
  name?: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-right';
  offset?: { bottom?: number; right?: number; left?: number };
  showIcon?: boolean;
  showCount?: boolean;
  showTotal?: boolean;
  enablePulseAnimation?: boolean;
  autoHide?: boolean; // Hide when empty
}

export function createCartPill(options: CartPillOptions = {}): CartPillComponent {
  const {
    name = 'Cart Pill',
    position = 'bottom-right',
    offset = { bottom: 24, right: 88 }, // Next to voice FAB (56px + 32px spacing)
    showIcon = true,
    showCount = true,
    showTotal = true,
    enablePulseAnimation = true,
    autoHide = true,
  } = options;

  return {
    // BaseComponent properties
    id: 'cart-pill',
    type: 'cart-pill',
    name,
    description: 'Floating cart widget showing item count and total',
    category: 'navigation',
    dimensions: { width: 'auto', height: '56px' },
    padding: { top: 12, right: 20, bottom: 12, left: 20 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      fontWeight: 700,
      lineHeight: '1',
    },
    states: {},
    transitions: [],
    defaultState: 'default',
    interaction: { primary: 'touch', alternatives: [] },
    platform: 'web',
    frameworks: ['react'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['cart', 'floating', 'widget'],

    // CartPillComponent specific properties
    layout: {
      position,
      offset,
      display: autoHide ? 'auto' : 'always', // 'auto' hides when empty
    },

    content: {
      showIcon,
      showCount,
      showTotal,
      icon: '🛒',
    },

    styling: {
      backgroundColor: '#ffffff',
      borderRadius: '28px',
      padding: '12px 20px',
      shadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      hoverShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
    },

    badge: {
      backgroundColor: '#00B14F', // Grab green
      textColor: '#ffffff',
      size: 24,
      fontSize: 12,
      fontWeight: 700,
    },

    total: {
      fontSize: 14,
      fontWeight: 700,
      color: '#1f2937',
    },

    animation: {
      enablePulse: enablePulseAnimation,
      pulseScale: 1.1,
      pulseDuration: 300,
      transition: '0.2s ease',
    },

    interactions: {
      onClick: 'open-cart',
      hover: 'elevate',
      active: 'scale-down',
    },

    accessibility: {
      role: 'button',
      ariaLabel: 'Shopping cart',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Shopping cart - view your items and checkout',
    },
  };
}

/**
 * Compact cart pill (icon + count only)
 */
export function createCompactCartPill(options: CartPillOptions = {}): CartPillComponent {
  return createCartPill({
    ...options,
    showTotal: false,
    offset: { bottom: 24, right: 72 },
  });
}

/**
 * Full cart pill (icon + count + total)
 */
export function createFullCartPill(options: CartPillOptions = {}): CartPillComponent {
  return createCartPill({
    ...options,
    showIcon: true,
    showCount: true,
    showTotal: true,
  });
}
