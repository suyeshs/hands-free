/**
 * Grab Food - Order Tracker Component
 *
 * Real-time order tracking with progress indicator, driver info, and status updates.
 * Features: stepped progress, map integration ready, driver contact.
 */

import type { OrderTrackerComponent, OrderStep } from '../types';

export interface OrderTrackerOptions {
  id?: string;
  name?: string;
  variant?: 'compact' | 'detailed' | 'fullscreen';
  showMap?: boolean;
  showDriverInfo?: boolean;
}

/**
 * Create an order tracker component
 */
export function createOrderTracker(
  options: OrderTrackerOptions = {}
): OrderTrackerComponent {
  const {
    id = 'order-tracker-1',
    name = 'Order Tracker',
    variant = 'detailed',
    showMap = true,
    showDriverInfo = true,
  } = options;

  const defaultSteps: OrderStep[] = [
    {
      id: 'preparing',
      label: 'Preparing your order',
      icon: '👨‍🍳',
      status: 'in-progress',
      estimatedTime: '15-20 min',
    },
    {
      id: 'picked-up',
      label: 'Driver picked up order',
      icon: '🏍️',
      status: 'pending',
      estimatedTime: '5 min',
    },
    {
      id: 'on-the-way',
      label: 'On the way',
      icon: '📍',
      status: 'pending',
      estimatedTime: '10 min',
    },
    {
      id: 'delivered',
      label: 'Delivered',
      icon: '✅',
      status: 'pending',
    },
  ];

  return {
    id,
    name,
    type: 'order-tracker',
    description: 'Real-time order tracking with progress and driver info',
    category: 'feedback',

    dimensions: {
      width: '100%',
      minHeight: variant === 'compact' ? '120px' : '400px',
    },

    padding: {
      top: 16,
      right: 16,
      bottom: 16,
      left: 16,
    },

    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: '1.5',
    },

    layout: {
      variant,
      showMap,
      showDriverInfo,
      showItemSummary: variant !== 'compact',
    },

    progressBar: {
      style: 'stepped',
      showPercentage: false,
      showETA: true,
      animateProgress: true,
    },

    steps: defaultSteps,

    driverCard: showDriverInfo ? {
      showPhoto: true,
      showName: true,
      showRating: true,
      showVehicleInfo: true,
      showCallButton: true,
      showChatButton: true,
    } : undefined,

    realTimeUpdates: {
      enabled: true,
      updateInterval: 10000,  // 10 seconds
      showNotifications: true,
    },

    states: {
      default: {
        colors: {
          background: '#ffffff',
          text: '#1f2937',
          border: '#e5e7eb',
        },
        shadows: {
          outer: '0 2px 8px rgba(0, 0, 0, 0.08)',
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
      alternatives: ['voice'],
      touch: {
        minTouchSize: { width: 88, height: 88 },
        haptic: 'medium',
      },
      voice: [
        {
          triggers: ['where is my order', 'track order', 'order status'],
          action: 'show-status',
          feedback: 'Showing order status',
          visualIndicator: true,
        },
      ],
    },

    accessibility: {
      role: 'region',
      ariaLabel: 'Order tracking',
      focusable: false,
      keyboardNavigable: false,
      screenReaderText: 'Real-time order tracking with current status and estimated delivery time',
    },

    platform: 'both',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['order', 'tracking', 'status', 'progress', 'delivery'],
  };
}

/**
 * Create a compact order tracker (for inline display)
 */
export function createCompactOrderTracker(
  options: OrderTrackerOptions = {}
): OrderTrackerComponent {
  return createOrderTracker({ ...options, variant: 'compact', showMap: false });
}

/**
 * Create a detailed order tracker (default)
 */
export function createDetailedOrderTracker(
  options: OrderTrackerOptions = {}
): OrderTrackerComponent {
  return createOrderTracker({ ...options, variant: 'detailed' });
}

/**
 * Create a fullscreen order tracker
 */
export function createFullscreenOrderTracker(
  options: OrderTrackerOptions = {}
): OrderTrackerComponent {
  return createOrderTracker({ ...options, variant: 'fullscreen', showMap: true, showDriverInfo: true });
}
