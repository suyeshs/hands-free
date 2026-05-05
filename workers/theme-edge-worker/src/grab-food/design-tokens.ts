/**
 * Grab Food Theme - Design Tokens
 *
 * Mobile-first color palettes, typography, and design system tokens
 * for creating a Grab-inspired food delivery interface.
 */

import type {
  ColorScale,
  GradientConfig,
} from './types';

/**
 * Grab Green - Primary brand color
 * Grab's signature green with full scale
 */
export const GrabGreenScale: ColorScale = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#00B14F',  // Base - Grab's signature green
  600: '#00983F',
  700: '#007A32',
  800: '#005C26',
  900: '#003E19',
  950: '#00200D',
};

/**
 * Charcoal Gray - Secondary color for text and UI elements
 */
export const CharcoalGrayScale: ColorScale = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',  // Base - Text and UI elements
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
  950: '#030712',
};

/**
 * Promo Orange - Accent color for promotions and highlights
 */
export const PromoOrangeScale: ColorScale = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#ff6c31',  // Base - Grab's promo color
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
  950: '#431407',
};

/**
 * Sky Blue - Information and link color
 */
export const SkyBlueScale: ColorScale = {
  50: '#f0f9ff',
  100: '#e0f2fe',
  200: '#bae6fd',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',  // Base - Info/links
  600: '#0284c7',
  700: '#0369a1',
  800: '#075985',
  900: '#0c4a6e',
  950: '#082f49',
};

/**
 * Success Green - Success states and confirmations
 */
export const SuccessGreenScale: ColorScale = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#10b981',  // Base - Success
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#064e3b',
  950: '#022c22',
};

/**
 * Warning Orange - Warning states
 */
export const WarningOrangeScale: ColorScale = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',  // Base - Warning
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
};

/**
 * Error Red - Error states
 */
export const ErrorRedScale: ColorScale = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',  // Base - Error
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
};

/**
 * Delivery Status Colors
 * Colors for different order/delivery states
 */
export const DeliveryStatusColors = {
  preparing: {
    color: '#ff6c31',  // Orange
    label: 'Preparing',
    icon: '👨‍🍳',
  },
  pickedUp: {
    color: '#0ea5e9',  // Blue
    label: 'Picked up',
    icon: '🏍️',
  },
  onTheWay: {
    color: '#00B14F',  // Green
    label: 'On the way',
    icon: '📍',
  },
  nearby: {
    color: '#10b981',  // Success green
    label: 'Nearby',
    icon: '📍',
  },
  delivered: {
    color: '#10b981',  // Success green
    label: 'Delivered',
    icon: '✅',
  },
  cancelled: {
    color: '#ef4444',  // Red
    label: 'Cancelled',
    icon: '❌',
  },
};

/**
 * Typography System
 * Mobile-optimized font families, scales, and properties
 */
export const GrabFoodTypography = {
  fontFamily: {
    sans: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ].join(', '),
    display: [
      'Inter',
      'sans-serif',
    ].join(', '),
  },

  scale: {
    xs: '0.75rem',     // 12px - Badges, distance labels
    sm: '0.875rem',    // 14px - Metadata, delivery time
    base: '1rem',      // 16px - Card descriptions, body text
    lg: '1.125rem',    // 18px - Restaurant names
    xl: '1.25rem',     // 20px - Section headers
    '2xl': '1.5rem',   // 24px - Page titles
    '3xl': '1.875rem', // 30px - Hero text
    '4xl': '2.25rem',  // 36px - Large numbers (price, ETA)
  },

  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeights: {
    tight: '1.2',      // For large numbers, prices
    normal: '1.5',     // Body text
    relaxed: '1.75',   // Descriptions
  },

  letterSpacing: {
    tight: '-0.015em',
    normal: '0',
    wide: '0.015em',
  },
};

/**
 * Spacing Scale
 * Mobile touch-optimized spacing based on 8px unit
 */
export const GrabFoodSpacing = {
  unit: 'px' as const,
  scale: {
    0: '0',
    1: '4px',    // Micro spacing
    2: '8px',    // Small spacing
    3: '12px',   // Comfortable spacing
    4: '16px',   // Standard spacing
    5: '20px',   // Large spacing
    6: '24px',   // Section spacing
    8: '32px',   // Card spacing
    10: '40px',  // Bottom nav height
    12: '48px',  // Header height
    14: '56px',  // Touch target height (44px + padding)
    16: '64px',  // Large touch targets
    20: '80px',  // Hero sections
    24: '96px',  // Bottom safe area
  },
};

/**
 * Border Radius Scale
 * Rounded, modern borders
 */
export const GrabFoodBorderRadius = {
  none: '0',
  sm: '0.375rem',  // 6px - Small elements
  md: '0.5rem',    // 8px - Buttons, chips
  lg: '0.75rem',   // 12px - Cards
  xl: '1rem',      // 16px - Large cards
  '2xl': '1.5rem', // 24px - Modals
  full: '9999px',  // Pills, avatar
};

/**
 * Shadow Scale
 * Flat design with subtle elevation (not neumorphic)
 */
export const GrabFoodShadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  card: '0 2px 8px rgba(0, 0, 0, 0.08)',
  float: '0 4px 16px rgba(0, 0, 0, 0.12)',
  bottomNav: '0 -2px 8px rgba(0, 0, 0, 0.08)',
};

/**
 * Animation Durations
 */
export const GrabFoodAnimations = {
  durations: {
    fast: 150,      // Quick interactions
    normal: 300,    // Standard animations
    slow: 500,      // Deliberate transitions
  },

  easings: {
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
};

/**
 * Breakpoints
 * Tailwind-aligned responsive breakpoints
 */
export const GrabFoodBreakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

/**
 * Gradients
 * Pre-defined gradients for buttons and accents
 */
export const GrabFoodGradients: Record<string, GradientConfig> = {
  primary: {
    from: '#00B14F',
    to: '#00983F',
    direction: 'to-br',
  },
  promo: {
    from: '#ff6c31',
    to: '#ea580c',
    direction: 'to-br',
  },
  info: {
    from: '#0ea5e9',
    to: '#0284c7',
    direction: 'to-br',
  },
  success: {
    from: '#10b981',
    to: '#059669',
    direction: 'to-br',
  },
};

/**
 * Default Design Tokens
 * Complete set of design tokens for Grab Food theme
 */
export const DefaultGrabFoodDesignTokens = {
  colors: {
    primary: GrabGreenScale,
    secondary: CharcoalGrayScale,
    accent: PromoOrangeScale,
    info: SkyBlueScale,
    success: SuccessGreenScale,
    warning: WarningOrangeScale,
    error: ErrorRedScale,

    background: {
      main: '#ffffff',
      surface: '#f9fafb',
      elevated: '#ffffff',
    },

    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
      tertiary: '#9ca3af',
      disabled: '#d1d5db',
      inverse: '#ffffff',
    },

    delivery: DeliveryStatusColors,
  },

  typography: GrabFoodTypography,
  spacing: GrabFoodSpacing,
  borderRadius: GrabFoodBorderRadius,
  shadows: GrabFoodShadows,
  animations: GrabFoodAnimations,
  breakpoints: GrabFoodBreakpoints,
  gradients: GrabFoodGradients,
};
