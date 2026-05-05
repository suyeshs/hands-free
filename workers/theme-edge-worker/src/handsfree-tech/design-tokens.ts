/**
 * Handsfree Tech Theme - Design Tokens
 * Modern, tech-oriented design system inspired by Music Zajno
 *
 * @features
 * - Dark-first color scheme
 * - Glassmorphism effects
 * - Tech-inspired gradients
 * - Sophisticated animations
 * - Voice/gesture UI patterns
 */

// ===========================
// Color Scales
// ===========================

/**
 * Cyber Blue - Primary tech color
 */
export const CyberBlueScale = {
  50: '#e6f0ff',
  100: '#cce0ff',
  200: '#99c2ff',
  300: '#66a3ff',
  400: '#3385ff',
  500: '#0066ff',  // Primary
  600: '#0052cc',
  700: '#003d99',
  800: '#002966',
  900: '#001433',
} as const;

/**
 * Neon Purple - Accent color
 */
export const NeonPurpleScale = {
  50: '#f3e6ff',
  100: '#e6ccff',
  200: '#cc99ff',
  300: '#b366ff',
  400: '#9933ff',
  500: '#8000ff',  // Primary
  600: '#6600cc',
  700: '#4d0099',
  800: '#330066',
  900: '#1a0033',
} as const;

/**
 * Tech Green - Success/active states
 */
export const TechGreenScale = {
  50: '#e6fff2',
  100: '#ccffe6',
  200: '#99ffcc',
  300: '#66ffb3',
  400: '#33ff99',
  500: '#00ff80',  // Primary
  600: '#00cc66',
  700: '#00994d',
  800: '#006633',
  900: '#00331a',
} as const;

/**
 * Dark Neutrals - Base colors
 */
export const DarkNeutralScale = {
  50: '#f8f9fa',
  100: '#e9ecef',
  200: '#dee2e6',
  300: '#ced4da',
  400: '#adb5bd',
  500: '#6c757d',
  600: '#495057',
  700: '#343a40',
  800: '#212529',
  900: '#0d0d0d',
  950: '#000000',
} as const;

/**
 * Holographic gradients
 */
export const HolographicGradients = {
  primary: {
    from: CyberBlueScale[500],
    via: NeonPurpleScale[500],
    to: TechGreenScale[500],
    direction: '135deg' as const,
  },
  glass: {
    from: 'rgba(255, 255, 255, 0.1)',
    to: 'rgba(255, 255, 255, 0.05)',
    direction: '135deg' as const,
  },
  glow: {
    from: CyberBlueScale[500],
    to: 'transparent',
    direction: 'radial' as const,
  },
} as const;

// ===========================
// Typography
// ===========================

export const Typography = {
  fontFamily: {
    primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"Fira Code", "JetBrains Mono", "Courier New", monospace',
    display: '"Cabinet Grotesk", "Inter", sans-serif',
  },
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
    '6xl': '3.75rem',   // 60px
    '7xl': '4.5rem',    // 72px
    '8xl': '6rem',      // 96px
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
  },
} as const;

// ===========================
// Spacing Scale
// ===========================

export const Spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  32: '8rem',       // 128px
} as const;

// ===========================
// Border Radius
// ===========================

export const BorderRadius = {
  none: '0',
  sm: '0.25rem',    // 4px
  base: '0.5rem',   // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px
  full: '9999px',
} as const;

// ===========================
// Shadows
// ===========================

export const Shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // Glow effects
  glowBlue: `0 0 20px ${CyberBlueScale[500]}40, 0 0 40px ${CyberBlueScale[500]}20`,
  glowPurple: `0 0 20px ${NeonPurpleScale[500]}40, 0 0 40px ${NeonPurpleScale[500]}20`,
  glowGreen: `0 0 20px ${TechGreenScale[500]}40, 0 0 40px ${TechGreenScale[500]}20`,

  // Inner shadows for depth
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
} as const;

// ===========================
// Breakpoints
// ===========================

export const Breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ===========================
// Animation Durations
// ===========================

export const AnimationDuration = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  slower: '800ms',
} as const;

// ===========================
// Easing Functions (Music Zajno inspired)
// ===========================

export const EasingFunctions = {
  // Material Design Standard
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Material Design Deceleration
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',

  // Material Design Acceleration
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',

  // Back Ease Out (bounce)
  backOut: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',

  // Elastic
  elastic: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',

  // Smooth
  smooth: 'cubic-bezier(0.45, 0, 0.55, 1)',
} as const;

// ===========================
// Z-Index Scale
// ===========================

export const ZIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
} as const;

// ===========================
// Glassmorphism Effects
// ===========================

export const GlassmorphismEffects = {
  light: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  medium: {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
  },
  heavy: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(30px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
  },
  dark: {
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
} as const;

// ===========================
// Tech-Specific Colors
// ===========================

export const TechColors = {
  terminal: {
    bg: '#0d1117',
    text: '#c9d1d9',
    prompt: TechGreenScale[500],
    error: '#ff6b6b',
    warning: '#f59e0b',
    info: CyberBlueScale[500],
  },
  code: {
    keyword: NeonPurpleScale[400],
    string: TechGreenScale[400],
    number: CyberBlueScale[400],
    comment: DarkNeutralScale[500],
    function: '#f59e0b',
  },
  status: {
    online: TechGreenScale[500],
    offline: DarkNeutralScale[500],
    busy: '#f59e0b',
    away: '#f59e0b',
  },
} as const;

// ===========================
// Main Design Tokens Export
// ===========================

export const HandsfreeDesignTokens = {
  colors: {
    primary: CyberBlueScale,
    accent: NeonPurpleScale,
    success: TechGreenScale,
    neutral: DarkNeutralScale,

    // Backgrounds
    background: {
      dark: DarkNeutralScale[900],
      darker: DarkNeutralScale[950],
      light: DarkNeutralScale[800],
      glass: 'rgba(255, 255, 255, 0.05)',
    },

    // Text
    text: {
      primary: DarkNeutralScale[50],
      secondary: DarkNeutralScale[300],
      tertiary: DarkNeutralScale[500],
      inverse: DarkNeutralScale[900],
    },

    // Borders
    border: {
      default: DarkNeutralScale[700],
      light: DarkNeutralScale[800],
      accent: CyberBlueScale[500],
    },
  },

  gradients: HolographicGradients,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  breakpoints: Breakpoints,
  animation: AnimationDuration,
  easing: EasingFunctions,
  zIndex: ZIndex,
  glassmorphism: GlassmorphismEffects,
  tech: TechColors,
} as const;

export type HandsfreeDesignTokens = typeof HandsfreeDesignTokens;
