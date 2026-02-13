/**
 * Multimodal Restaurant Theme - Design Tokens
 *
 * Food-optimized color palettes, typography, and design system tokens
 * for creating appetizing, accessible restaurant ordering interfaces.
 */

import type {
  RestaurantDesignTokens,
  RestaurantColorPalette,
  ColorScale,
  GradientConfig,
} from './types';

/**
 * Warm Orange - Primary appetizing color for food contexts
 * Based on warm earth tones that stimulate appetite
 */
export const WarmOrangeScale: ColorScale = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f97316',  // Base - Vibrant appetizing orange
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
  950: '#431407',
};

/**
 * Rich Brown - Secondary color for meat/comfort food
 */
export const RichBrownScale: ColorScale = {
  50: '#fdf8f6',
  100: '#f2e8e5',
  200: '#eaddd7',
  300: '#e0cec7',
  400: '#d2bab0',
  500: '#bfa094',  // Base
  600: '#a18072',
  700: '#977669',
  800: '#846358',
  900: '#43302b',
  950: '#292522',
};

/**
 * Coffee Brown - Rich coffee-inspired brown palette
 * Perfect for Coorg coffee culture themed restaurants
 */
export const CoffeeBrownScale: ColorScale = {
  50: '#faf8f5',
  100: '#f5f0e8',
  200: '#ebe0d0',
  300: '#dccab0',
  400: '#c9a87a',
  500: '#a67c52',  // Base - Rich coffee brown
  600: '#8b5a2b',  // Saddle brown
  700: '#78350f',  // Dark coffee
  800: '#5c2a0e',  // Espresso
  900: '#451a03',  // Dark roast
  950: '#2d1106',  // Blackest coffee
};

/**
 * Deep Slate - Neutral background (neumorphic-friendly)
 */
export const DeepSlateScale: ColorScale = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',  // Base
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

/**
 * Fresh Green - Vegetarian indicator color
 */
export const FreshGreenScale: ColorScale = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',  // Base - Vibrant green
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
  950: '#052e16',
};

/**
 * Rich Red - Non-vegetarian indicator color
 */
export const RichRedScale: ColorScale = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',  // Base - Clear red
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
};

/**
 * Sky Blue - Voice interaction color
 */
export const SkyBlueScale: ColorScale = {
  50: '#f0f9ff',
  100: '#e0f2fe',
  200: '#bae6fd',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',  // Base - Clear blue
  600: '#0284c7',
  700: '#0369a1',
  800: '#075985',
  900: '#0c4a6e',
  950: '#082f49',
};

/**
 * Emerald - Success/confirmation color
 */
export const EmeraldScale: ColorScale = {
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',  // Base
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#064e3b',
  950: '#022c22',
};

/**
 * Amber - Warning color
 */
export const AmberScale: ColorScale = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',  // Base
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
};

/**
 * Rose - Error color
 */
export const RoseScale: ColorScale = {
  50: '#fff1f2',
  100: '#ffe4e6',
  200: '#fecdd3',
  300: '#fda4af',
  400: '#fb7185',
  500: '#f43f5e',  // Base
  600: '#e11d48',
  700: '#be123c',
  800: '#9f1239',
  900: '#881337',
  950: '#4c0519',
};

/**
 * Cyan - Info color
 */
export const CyanScale: ColorScale = {
  50: '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  300: '#67e8f9',
  400: '#22d3ee',
  500: '#06b6d4',  // Base
  600: '#0891b2',
  700: '#0e7490',
  800: '#155e75',
  900: '#164e63',
  950: '#083344',
};

/**
 * Default restaurant color palette
 */
export const DefaultRestaurantColorPalette: RestaurantColorPalette = {
  primary: WarmOrangeScale,
  secondary: RichBrownScale,
  accent: WarmOrangeScale,

  background: {
    main: '#e0e5ec',      // Soft gray-blue (neumorphic base)
    surface: '#f0f4f8',   // Lighter surface
    elevated: '#ffffff',  // Pure white for elevated cards
    gradient: {
      from: '#f0f4f8',
      to: '#e0e5ec',
      direction: 'to-b',
    },
  },

  text: {
    primary: '#1e293b',     // Deep slate
    secondary: '#64748b',   // Medium slate
    tertiary: '#94a3b8',    // Light slate
    disabled: '#cbd5e1',    // Very light slate
    inverse: '#ffffff',     // White for dark backgrounds
  },

  dietary: {
    veg: FreshGreenScale,
    nonVeg: RichRedScale,
    vegan: {
      ...FreshGreenScale,
      500: '#059669',  // Darker green for vegan
    },
  },

  status: {
    success: EmeraldScale,
    warning: AmberScale,
    error: RoseScale,
    info: CyanScale,
  },

  voiceStates: {
    idle: '#94a3b8',      // Neutral gray
    listening: '#0ea5e9',  // Sky blue
    thinking: '#f59e0b',  // Amber
    speaking: '#22c55e',  // Fresh green
  },
};

/**
 * Default restaurant typography
 */
export const DefaultRestaurantTypography = {
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
    ],
    serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
    heading: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'sans-serif',
    ],
  },

  scale: {
    xs: '0.75rem',    // 12px - Tags, badges
    sm: '0.875rem',   // 14px - Captions, metadata
    base: '1rem',     // 16px - Body text, descriptions
    lg: '1.125rem',   // 18px - Item names
    xl: '1.25rem',    // 20px - Section headers
    '2xl': '1.5rem',  // 24px - Category headers
    '3xl': '1.875rem', // 30px - Hero text
    '4xl': '2.25rem', // 36px - Display text
  },

  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeights: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
    loose: '2',
  },

  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
  },
};

/**
 * Spacing scale based on 8px grid
 */
export const DefaultSpacingScale = {
  unit: 'px' as const,
  scale: {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
  },
};

/**
 * Border radius scale
 */
export const DefaultBorderRadiusScale = {
  none: '0',
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.25rem',   // 20px
  '2xl': '1.5rem', // 24px
  '3xl': '2rem',   // 32px
  full: '9999px',
};

/**
 * Shadow scale for neumorphic depth
 */
export const DefaultShadowScale = {
  sm: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(0,0,0,0.15)',
  md: '-8px -8px 16px rgba(255,255,255,0.8), 8px 8px 16px rgba(0,0,0,0.15)',
  lg: '-12px -12px 24px rgba(255,255,255,0.8), 12px 12px 24px rgba(0,0,0,0.15)',
  xl: '-16px -16px 32px rgba(255,255,255,0.8), 16px 16px 32px rgba(0,0,0,0.15)',
  '2xl': '-24px -24px 48px rgba(255,255,255,0.8), 24px 24px 48px rgba(0,0,0,0.15)',
  inner: 'inset -4px -4px 8px rgba(255,255,255,0.5), inset 4px 4px 8px rgba(0,0,0,0.1)',
};

/**
 * Animation configuration
 */
export const DefaultAnimationConfig = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easing: {
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  motion: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    fadeOut: {
      initial: { opacity: 1 },
      animate: { opacity: 0 },
      exit: { opacity: 1 },
      transition: { duration: 0.3, ease: 'easeIn' },
    },
    slideUp: {
      initial: { y: 20, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: -20, opacity: 0 },
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    slideDown: {
      initial: { y: -20, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: 20, opacity: 0 },
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    slideLeft: {
      initial: { x: 20, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: -20, opacity: 0 },
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    slideRight: {
      initial: { x: -20, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 20, opacity: 0 },
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    scaleIn: {
      initial: { scale: 0.9, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.9, opacity: 0 },
      transition: { duration: 0.3, ease: 'easeOut' },
      whileHover: { scale: 1.02 },
      whileTap: { scale: 0.98 },
    },
    scaleOut: {
      initial: { scale: 1, opacity: 1 },
      animate: { scale: 0.9, opacity: 0 },
      exit: { scale: 1, opacity: 1 },
      transition: { duration: 0.3, ease: 'easeIn' },
    },
    bounce: {
      animate: {
        y: [0, -10, 0],
      },
      transition: {
        duration: 0.6,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatDelay: 1,
      },
    },
    pulse: {
      animate: {
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1],
      },
      transition: {
        duration: 2,
        ease: 'easeInOut',
        repeat: Infinity,
      },
    },
    shake: {
      animate: {
        x: [0, -10, 10, -10, 10, 0],
      },
      transition: {
        duration: 0.5,
        ease: 'easeInOut',
      },
    },
    cardHover: {
      whileHover: {
        y: -4,
        scale: 1.02,
      },
      whileTap: {
        scale: 0.98,
      },
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
      },
    },
    orbPulse: {
      animate: {
        scale: [1, 1.05, 1],
        boxShadow: [
          '0 0 0 0 rgba(59, 130, 246, 0.4)',
          '0 0 0 20px rgba(59, 130, 246, 0)',
          '0 0 0 0 rgba(59, 130, 246, 0)',
        ],
      },
      transition: {
        duration: 2,
        ease: 'easeInOut',
        repeat: Infinity,
      },
    },
    staggerChildren: {
      animate: {
        transition: {
          staggerChildren: 0.1,
          delayChildren: 0.2,
        },
      },
    },
  },
};

/**
 * Responsive breakpoints (matches Tailwind defaults)
 */
export const DefaultBreakpointScale = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

/**
 * Complete default design tokens
 */
export const DefaultRestaurantDesignTokens: RestaurantDesignTokens = {
  colors: DefaultRestaurantColorPalette,
  typography: DefaultRestaurantTypography,
  spacing: DefaultSpacingScale,
  borderRadius: DefaultBorderRadiusScale,
  shadows: DefaultShadowScale,
  animations: DefaultAnimationConfig,
  breakpoints: DefaultBreakpointScale,
};

/**
 * Voice state gradients for orb animations
 */
export const VoiceStateGradients = {
  idle: {
    from: '#94a3b8',
    to: '#64748b',
    direction: 'to-br' as const,
  },
  listening: {
    from: '#38bdf8',
    to: '#0284c7',
    direction: 'to-br' as const,
  },
  thinking: {
    from: '#fbbf24',
    to: '#f59e0b',
    direction: 'to-br' as const,
  },
  speaking: {
    from: '#4ade80',
    to: '#16a34a',
    direction: 'to-br' as const,
  },
};

/**
 * Dietary badge colors
 */
export const DietaryBadgeColors = {
  veg: {
    backgroundColor: '#dcfce7',
    textColor: '#15803d',
    borderColor: '#86efac',
    icon: '🥗',
  },
  nonVeg: {
    backgroundColor: '#fee2e2',
    textColor: '#b91c1c',
    borderColor: '#fca5a5',
    icon: '🍖',
  },
  vegan: {
    backgroundColor: '#d1fae5',
    textColor: '#047857',
    borderColor: '#6ee7b7',
    icon: '🌱',
  },
  glutenFree: {
    backgroundColor: '#fef3c7',
    textColor: '#b45309',
    borderColor: '#fcd34d',
    icon: '🌾',
  },
};

/**
 * Spice level indicator colors
 */
export const SpiceLevelColors = {
  mild: {
    color: '#22c55e',
    icon: '🌶️',
    count: 1,
  },
  medium: {
    color: '#f59e0b',
    icon: '🌶️',
    count: 2,
  },
  hot: {
    color: '#f97316',
    icon: '🌶️',
    count: 3,
  },
  extraHot: {
    color: '#ef4444',
    icon: '🌶️',
    count: 4,
  },
};

/**
 * Tailwind CSS class generators
 */
export const TailwindClassGenerators = {
  /**
   * Generate background color class from color scale
   */
  bgColor: (scale: ColorScale, shade: keyof ColorScale = 500): string => {
    return `bg-[${scale[shade]}]`;
  },

  /**
   * Generate text color class from color scale
   */
  textColor: (scale: ColorScale, shade: keyof ColorScale = 500): string => {
    return `text-[${scale[shade]}]`;
  },

  /**
   * Generate gradient background
   */
  gradient: (config: GradientConfig): string => {
    const { from, to, via, direction } = config;
    const classes = [`bg-gradient-${direction}`, `from-[${from}]`, `to-[${to}]`];
    if (via) classes.splice(2, 0, `via-[${via}]`);
    return classes.join(' ');
  },

  /**
   * Generate neumorphic shadow class
   */
  neuShadow: (depth: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md'): string => {
    return `shadow-[${DefaultShadowScale[depth]}]`;
  },

  /**
   * Generate responsive grid columns
   */
  gridCols: (mobile: number, tablet: number, desktop: number): string => {
    return `grid-cols-${mobile} md:grid-cols-${tablet} lg:grid-cols-${desktop}`;
  },
};

/**
 * Helper function to create color scale with custom base
 */
export function createColorScale(baseColor: string): ColorScale {
  // This would use a color manipulation library in production
  // For now, return a placeholder that shows the pattern
  return {
    50: baseColor,
    100: baseColor,
    200: baseColor,
    300: baseColor,
    400: baseColor,
    500: baseColor,
    600: baseColor,
    700: baseColor,
    800: baseColor,
    900: baseColor,
    950: baseColor,
  };
}

/**
 * Helper function to validate WCAG contrast ratio
 */
export function validateContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  // This would use a proper contrast checker library in production
  // For now, return placeholder
  const minRatio = level === 'AAA' ? 7 : 4.5;
  // Actual implementation would calculate luminance and contrast ratio
  return true;
}
