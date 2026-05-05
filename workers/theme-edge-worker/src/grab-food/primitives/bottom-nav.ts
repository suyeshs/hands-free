/**
 * Grab Food - Bottom Navigation Component
 *
 * Fixed bottom navigation bar with icons, labels, and badge support.
 * App-like navigation for mobile-first design.
 */

import type { BottomNavComponent, BottomNavItem } from '../types';

export interface BottomNavOptions {
  id?: string;
  name?: string;
  showLabels?: boolean;
  items?: BottomNavItem[];
}

/**
 * Create a bottom navigation component
 */
export function createBottomNav(
  options: BottomNavOptions = {}
): BottomNavComponent {
  const defaultItems: BottomNavItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: '🏠',
      activeIcon: '🏠',
      route: '/',
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: '📦',
      activeIcon: '📦',
      route: '/orders',
      badgeCount: 0,
    },
    {
      id: 'account',
      label: 'Account',
      icon: '👤',
      activeIcon: '👤',
      route: '/account',
    },
    {
      id: 'more',
      label: 'More',
      icon: '⋯',
      activeIcon: '⋯',
      route: '/more',
    },
  ];

  const {
    id = 'bottom-nav-1',
    name = 'Bottom Navigation',
    showLabels = true,
    items = defaultItems,
  } = options;

  return {
    id,
    name,
    type: 'bottom-nav',
    description: 'Fixed bottom navigation bar with icons and labels',
    category: 'navigation',

    dimensions: {
      width: '100%',
      height: '64px',
    },

    padding: {
      top: 8,
      right: 0,
      bottom: 8,
      left: 0,
    },

    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: '1.2',
    },

    layout: {
      height: '64px',
      backgroundColor: '#ffffff',
      showLabels,
      iconSize: 'md',
    },

    items,

    activeIndicator: {
      type: 'color',
      color: '#00B14F',
      animation: 'fade',
    },

    badge: {
      showOnItems: items.filter(item => item.badgeCount).map(item => item.id),
      backgroundColor: '#ff6c31',
      textColor: '#ffffff',
      position: 'top-right',
    },

    states: {
      default: {
        colors: {
          background: '#ffffff',
          text: '#6b7280',
          border: '#e5e7eb',
        },
        shadows: {
          outer: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '0',
        },
      },
    },

    transitions: [],

    defaultState: 'default',

    interaction: {
      primary: 'touch',
      alternatives: ['keyboard'],
      touch: {
        minTouchSize: { width: 64, height: 64 },
        haptic: 'light',
      },
    },

    accessibility: {
      role: 'navigation',
      ariaLabel: 'Main navigation',
      focusable: false,
      keyboardNavigable: true,
      screenReaderText: 'Bottom navigation bar',
    },

    platform: 'both',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['navigation', 'bottom', 'tabs', 'mobile', 'app'],
  };
}
