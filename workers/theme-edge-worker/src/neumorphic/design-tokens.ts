/**
 * Neumorphic Design Tokens
 * Comprehensive token system for pixel-perfect rendering across all devices
 * Based on LINE Design System Guidelines (LDSG) principles
 */

import type { NeumorphicShadows, NeumorphicTypography } from './types';
import { ShadowGenerator } from './style-generator';

// ============================================================================
// Color System
// ============================================================================

/**
 * Base surface colors for Light/Dark modes
 * Soft background with minimal contrast for neumorphic depth
 */
export const ColorTokens = {
  light: {
    // Surface colors
    bgSurface: '#F0F0F3',      // Main background surface
    bgRaised: '#F5F5F8',       // Raised/elevated surface
    bgPressed: '#E8E8EB',      // Pressed/inset surface
    bgContainer: '#FAFAFA',    // Container background

    // Shadow colors for neumorphic depth
    shadowLight: '#FFFFFF',    // Light outer shadow
    shadowDark: '#CBD2E0',     // Dark inner shadow
    shadowSoft: '#B6B9C5',     // Softer dark shadow for subtle depth

    // Text colors (high legibility)
    textPrimary: '#1A1A1A',    // Primary text (AA contrast)
    textSecondary: '#666666',  // Secondary text
    textTertiary: '#999999',   // Tertiary/hint text
    textInverse: '#FFFFFF',    // Text on dark backgrounds

    // Accent colors
    accentPrimary: '#2563EB',  // Primary blue accent
    accentSecondary: '#7C3AED', // Secondary purple accent
    accentSuccess: '#10B981',  // Success green
    accentWarning: '#F59E0B',  // Warning amber
    accentError: '#EF4444',    // Error red
    accentInfo: '#3B82F6',     // Info blue

    // Border colors
    border: '#E0E0E0',         // Default border
    borderSubtle: '#F0F0F0',   // Subtle border
    borderStrong: '#CCCCCC',   // Strong border

    // Interactive states
    hover: 'rgba(0, 0, 0, 0.04)',     // Hover overlay
    active: 'rgba(0, 0, 0, 0.08)',    // Active overlay
    focus: 'rgba(37, 99, 235, 0.12)', // Focus ring
    disabled: 'rgba(0, 0, 0, 0.38)',  // Disabled overlay
  },

  dark: {
    // Surface colors
    bgSurface: '#14141C',      // Main background surface
    bgRaised: '#1C1C28',       // Raised/elevated surface
    bgPressed: '#0F0F16',      // Pressed/inset surface
    bgContainer: '#1A1A24',    // Container background

    // Shadow colors for neumorphic depth
    shadowLight: '#252530',    // Light outer shadow (subtle in dark mode)
    shadowDark: '#08080C',     // Dark inner shadow
    shadowSoft: '#10101A',     // Softer dark shadow

    // Text colors (high legibility on dark)
    textPrimary: '#FFFFFF',    // Primary text
    textSecondary: '#B3B3B3',  // Secondary text
    textTertiary: '#808080',   // Tertiary/hint text
    textInverse: '#1A1A1A',    // Text on light backgrounds

    // Accent colors (slightly brighter for dark mode)
    accentPrimary: '#3B82F6',  // Primary blue accent
    accentSecondary: '#8B5CF6', // Secondary purple accent
    accentSuccess: '#34D399',  // Success green
    accentWarning: '#FBBF24',  // Warning amber
    accentError: '#F87171',    // Error red
    accentInfo: '#60A5FA',     // Info blue

    // Border colors
    border: '#2A2A35',         // Default border
    borderSubtle: '#202028',   // Subtle border
    borderStrong: '#404050',   // Strong border

    // Interactive states
    hover: 'rgba(255, 255, 255, 0.06)',   // Hover overlay
    active: 'rgba(255, 255, 255, 0.12)',  // Active overlay
    focus: 'rgba(59, 130, 246, 0.24)',    // Focus ring
    disabled: 'rgba(255, 255, 255, 0.38)', // Disabled overlay
  },
};

// ============================================================================
// Spacing System
// ============================================================================

/**
 * 8px spacing scale for consistent layout
 * All spacing values are multiples of 8 for pixel-perfect alignment
 */
export const SpacingTokens = {
  '0': 0,
  '4': 4,      // 0.5 units
  '8': 8,      // 1 unit (base)
  '12': 12,    // 1.5 units
  '16': 16,    // 2 units
  '20': 20,    // 2.5 units
  '24': 24,    // 3 units
  '32': 32,    // 4 units
  '40': 40,    // 5 units
  '48': 48,    // 6 units
  '56': 56,    // 7 units
  '64': 64,    // 8 units
  '72': 72,    // 9 units
  '80': 80,    // 10 units
  '96': 96,    // 12 units
  '128': 128,  // 16 units
  '160': 160,  // 20 units
};

/**
 * Semantic spacing names for common use cases
 */
export const SemanticSpacing = {
  xxs: SpacingTokens['4'],
  xs: SpacingTokens['8'],
  sm: SpacingTokens['12'],
  md: SpacingTokens['16'],
  lg: SpacingTokens['24'],
  xl: SpacingTokens['32'],
  xxl: SpacingTokens['48'],
  xxxl: SpacingTokens['64'],
};

// ============================================================================
// Border Radius System
// ============================================================================

/**
 * Corner rounding tokens for different component types
 */
export const BorderRadiusTokens = {
  // Component-specific rounding
  none: 0,
  sm: 8,       // Small elements (badges, tags)
  md: 12,      // Medium elements (inputs, small buttons)
  lg: 16,      // Large elements (cards, large buttons)
  xl: 20,      // Extra large elements (modals, containers)
  xxl: 24,     // Containers and panels

  // Special purpose
  fab: 32,     // Floating Action Buttons (32px+)
  fabLarge: 40, // Large FABs
  pill: 9999,  // Fully rounded pills/chips
  circle: '50%', // Perfect circles
};

/**
 * Semantic border radius for component types
 */
export const SemanticBorderRadius = {
  button: BorderRadiusTokens.lg,      // 16px
  input: BorderRadiusTokens.md,       // 12px
  card: BorderRadiusTokens.xl,        // 20px
  modal: BorderRadiusTokens.xxl,      // 24px
  container: BorderRadiusTokens.xl,   // 20px
  fab: BorderRadiusTokens.fab,        // 32px
  chip: BorderRadiusTokens.pill,      // Full rounded
  avatar: BorderRadiusTokens.circle,  // Circle
};

// ============================================================================
// Typography System
// ============================================================================

/**
 * Large, highly legible sans-serif fonts
 * Optimized for both web and mobile readability
 */
export const TypographyTokens = {
  // Font families
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", "Roboto Mono", "Courier New", monospace',
  },

  // Font sizes (large, legible scale)
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,    // Base size
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display1: 36,
    display2: 48,
    display3: 60,
  },

  // Font weights
  fontWeight: {
    light: 300 as const,
    regular: 400 as const,
    medium: 500 as const,
    semibold: 600 as const,
    bold: 700 as const,
  },

  // Line heights (ample spacing for readability)
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2.0,
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.05em',
  },
};

/**
 * Semantic typography for component types
 * Includes subtle drop-shadow for headings
 */
export const SemanticTypography: Record<string, NeumorphicTypography> = {
  h1: {
    fontFamily: TypographyTokens.fontFamily.sans,
    fontSize: TypographyTokens.fontSize.display2,
    fontWeight: 700,
    lineHeight: TypographyTokens.lineHeight.tight,
    letterSpacing: TypographyTokens.letterSpacing.tight,
    textTransform: 'none',
    textDecoration: 'none',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', // Subtle drop-shadow
  },
  h2: {
    fontFamily: TypographyTokens.fontFamily.sans,
    fontSize: TypographyTokens.fontSize.display1,
    fontWeight: 600,
    lineHeight: TypographyTokens.lineHeight.tight,
    letterSpacing: TypographyTokens.letterSpacing.tight,
    textTransform: 'none',
    textDecoration: 'none',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
  },
  h3: {
    fontFamily: TypographyTokens.fontFamily.sans,
    fontSize: TypographyTokens.fontSize.xxxl,
    fontWeight: 600,
    lineHeight: TypographyTokens.lineHeight.normal,
    letterSpacing: TypographyTokens.letterSpacing.normal,
    textTransform: 'none',
    textDecoration: 'none',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  h4: {
    fontFamily: TypographyTokens.fontFamily.sans,
    fontSize: TypographyTokens.fontSize.xxl,
    fontWeight: 500,
    lineHeight: TypographyTokens.lineHeight.normal,
    letterSpacing: TypographyTokens.letterSpacing.normal,
    textTransform: 'none',
    textDecoration: 'none',
  },
  body: {
    fontFamily: TypographyTokens.fontFamily.sans,
    fontSize: TypographyTokens.fontSize.md,
    fontWeight: 400,
    lineHeight: TypographyTokens.lineHeight.relaxed, // Ample line-height
    letterSpacing: TypographyTokens.letterSpacing.normal,
    textTransform: 'none',
    textDecoration: 'none',
  },
  bodySmall: {
    fontFamily: TypographyTokens.fontFamily.sans,
    fontSize: TypographyTokens.fontSize.sm,
    fontWeight: 400,
    lineHeight: TypographyTokens.lineHeight.normal,
    letterSpacing: TypographyTokens.letterSpacing.normal,
    textTransform: 'none',
    textDecoration: 'none',
  },
  button: {
    fontFamily: TypographyTokens.fontFamily.sans,
    fontSize: TypographyTokens.fontSize.md,
    fontWeight: 600,
    lineHeight: TypographyTokens.lineHeight.normal,
    letterSpacing: TypographyTokens.letterSpacing.wide,
    textTransform: 'uppercase',
    textDecoration: 'none',
  },
  caption: {
    fontFamily: TypographyTokens.fontFamily.sans,
    fontSize: TypographyTokens.fontSize.xs,
    fontWeight: 400,
    lineHeight: TypographyTokens.lineHeight.normal,
    letterSpacing: TypographyTokens.letterSpacing.normal,
    textTransform: 'none',
    textDecoration: 'none',
  },
};

// ============================================================================
// Elevation & Shadow System
// ============================================================================

/**
 * Dual shadow presets for different elevation levels
 * Outset (raised) and inset (pressed) variants
 */
export const ShadowTokens = {
  light: {
    // Raised (outset) shadows - light top-left, dark bottom-right
    raised: {
      sm: ShadowGenerator.generateNeumorphicShadows(ColorTokens.light.bgSurface, 2, 'top-left', false),
      md: ShadowGenerator.generateNeumorphicShadows(ColorTokens.light.bgSurface, 5, 'top-left', false),
      lg: ShadowGenerator.generateNeumorphicShadows(ColorTokens.light.bgSurface, 8, 'top-left', false),
      xl: ShadowGenerator.generateNeumorphicShadows(ColorTokens.light.bgSurface, 12, 'top-left', false),
    },

    // Pressed (inset) shadows
    pressed: {
      sm: ShadowGenerator.generateNeumorphicShadows(ColorTokens.light.bgSurface, 2, 'top-left', true),
      md: ShadowGenerator.generateNeumorphicShadows(ColorTokens.light.bgSurface, 5, 'top-left', true),
      lg: ShadowGenerator.generateNeumorphicShadows(ColorTokens.light.bgSurface, 8, 'top-left', true),
    },
  },

  dark: {
    // Raised (outset) shadows - subtle in dark mode
    raised: {
      sm: ShadowGenerator.generateNeumorphicShadows(ColorTokens.dark.bgSurface, 2, 'top-left', false),
      md: ShadowGenerator.generateNeumorphicShadows(ColorTokens.dark.bgSurface, 5, 'top-left', false),
      lg: ShadowGenerator.generateNeumorphicShadows(ColorTokens.dark.bgSurface, 8, 'top-left', false),
      xl: ShadowGenerator.generateNeumorphicShadows(ColorTokens.dark.bgSurface, 12, 'top-left', false),
    },

    // Pressed (inset) shadows
    pressed: {
      sm: ShadowGenerator.generateNeumorphicShadows(ColorTokens.dark.bgSurface, 2, 'top-left', true),
      md: ShadowGenerator.generateNeumorphicShadows(ColorTokens.dark.bgSurface, 5, 'top-left', true),
      lg: ShadowGenerator.generateNeumorphicShadows(ColorTokens.dark.bgSurface, 8, 'top-left', true),
    },
  },
};

// ============================================================================
// Responsive Breakpoints
// ============================================================================

/**
 * Device breakpoints for pixel-perfect responsive rendering
 * Covers all common device sizes in the market
 */
export const Breakpoints = {
  // Mobile devices
  xs: 320,   // Small phones (iPhone SE, Android small)
  sm: 375,   // Standard phones (iPhone 12/13/14)
  md: 428,   // Large phones (iPhone 14 Pro Max)

  // Tablets
  tablet: 768,    // iPad Mini, small tablets
  tabletLg: 1024, // iPad Pro, large tablets

  // Desktop
  laptop: 1280,   // Small laptops
  desktop: 1440,  // Standard desktop
  desktopLg: 1920, // Large desktop
  desktopXl: 2560, // 4K displays
};

/**
 * Media query helpers
 */
export const MediaQueries = {
  xs: `(min-width: ${Breakpoints.xs}px)`,
  sm: `(min-width: ${Breakpoints.sm}px)`,
  md: `(min-width: ${Breakpoints.md}px)`,
  tablet: `(min-width: ${Breakpoints.tablet}px)`,
  tabletLg: `(min-width: ${Breakpoints.tabletLg}px)`,
  laptop: `(min-width: ${Breakpoints.laptop}px)`,
  desktop: `(min-width: ${Breakpoints.desktop}px)`,
  desktopLg: `(min-width: ${Breakpoints.desktopLg}px)`,
  desktopXl: `(min-width: ${Breakpoints.desktopXl}px)`,

  // Device-specific
  mobile: `(max-width: ${Breakpoints.md}px)`,
  tabletOnly: `(min-width: ${Breakpoints.tablet}px) and (max-width: ${Breakpoints.tabletLg - 1}px)`,
  desktopOnly: `(min-width: ${Breakpoints.laptop}px)`,

  // Orientation
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',

  // High DPI
  retina: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',
};

// ============================================================================
// Animation & Transition Tokens
// ============================================================================

/**
 * Smooth transition presets for state changes
 * Animates between outset (raised) and inset (pressed) on interaction
 */
export const AnimationTokens = {
  duration: {
    instant: 0,
    fast: 100,
    normal: 150,
    medium: 200,
    slow: 300,
    slower: 500,
  },

  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy spring effect
  },

  // Common transitions for neumorphic interactions
  hoverTransition: 'all 150ms cubic-bezier(0, 0, 0.2, 1)',
  pressTransition: 'all 100ms cubic-bezier(0.4, 0, 1, 1)',
  releaseTransition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// ============================================================================
// Touch Target Sizes (for mobile accessibility)
// ============================================================================

/**
 * Minimum touch target sizes for accessibility
 * Based on Apple HIG and Android Material guidelines
 */
export const TouchTargets = {
  minWidth: 44,   // Apple HIG minimum
  minHeight: 44,  // Apple HIG minimum
  comfortable: 48, // Android Material minimum
  large: 56,      // Large touch targets
  xl: 64,         // Extra large
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get color tokens for current theme
 */
export function getColorTokens(mode: 'light' | 'dark' = 'light') {
  return ColorTokens[mode];
}

/**
 * Get shadow tokens for current theme
 */
export function getShadowTokens(mode: 'light' | 'dark' = 'light') {
  return ShadowTokens[mode];
}

/**
 * Get responsive value based on viewport width
 */
export function getResponsiveValue<T>(
  values: { xs?: T; sm?: T; md?: T; tablet?: T; laptop?: T; desktop?: T },
  viewportWidth: number
): T | undefined {
  if (viewportWidth >= Breakpoints.desktop && values.desktop) return values.desktop;
  if (viewportWidth >= Breakpoints.laptop && values.laptop) return values.laptop;
  if (viewportWidth >= Breakpoints.tablet && values.tablet) return values.tablet;
  if (viewportWidth >= Breakpoints.md && values.md) return values.md;
  if (viewportWidth >= Breakpoints.sm && values.sm) return values.sm;
  return values.xs;
}

/**
 * Export all tokens for AI prompt injection
 */
export const DesignSystem = {
  colors: ColorTokens,
  spacing: SpacingTokens,
  semanticSpacing: SemanticSpacing,
  borderRadius: BorderRadiusTokens,
  semanticBorderRadius: SemanticBorderRadius,
  typography: TypographyTokens,
  semanticTypography: SemanticTypography,
  shadows: ShadowTokens,
  breakpoints: Breakpoints,
  mediaQueries: MediaQueries,
  animation: AnimationTokens,
  touchTargets: TouchTargets,
};
