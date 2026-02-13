/**
 * Multimodal Travel Theme - Design Tokens
 * Airbnb-inspired design system with travel-optimized color palettes
 */

// Airbnb Rausch Pink Scale (Primary Brand Color)
export const RauschPinkScale = {
  50: '#FFF5F7',
  100: '#FFE3E9',
  200: '#FFC7D3',
  300: '#FF94A8',
  400: '#FF5A5F', // Airbnb primary
  500: '#FF385C',
  600: '#E31C5F',
  700: '#C13555',
  800: '#A12F4A',
  900: '#872A43',
  950: '#4A1625',
} as const;

// Clean Neutral Scale (Airbnb's clean aesthetic)
export const CleanNeutralScale = {
  50: '#FFFFFF',
  100: '#F7F7F7',
  200: '#EBEBEB',
  300: '#DDDDDD',
  400: '#B0B0B0',
  500: '#717171',
  600: '#484848',
  700: '#222222',
  800: '#1A1A1A',
  900: '#000000',
  950: '#000000',
} as const;

// Sky Blue Scale (Flights & Travel)
export const SkyBlueScale = {
  50: '#F0F9FF',
  100: '#E0F2FE',
  200: '#BAE6FD',
  300: '#7DD3FC',
  400: '#38BDF8',
  500: '#0EA5E9',
  600: '#0284C7',
  700: '#0369A1',
  800: '#075985',
  900: '#0C4A6E',
  950: '#082F49',
} as const;

// Emerald Scale (Success & Confirmation)
export const EmeraldScale = {
  50: '#ECFDF5',
  100: '#D1FAE5',
  200: '#A7F3D0',
  300: '#6EE7B7',
  400: '#34D399',
  500: '#10B981',
  600: '#059669',
  700: '#047857',
  800: '#065F46',
  900: '#064E3B',
  950: '#022C22',
} as const;

// Amber Scale (Warnings & Attention)
export const AmberScale = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
  950: '#451A03',
} as const;

// Rose Scale (Errors & Alerts)
export const RoseScale = {
  50: '#FFF1F2',
  100: '#FFE4E6',
  200: '#FECDD3',
  300: '#FDA4AF',
  400: '#FB7185',
  500: '#F43F5E',
  600: '#E11D48',
  700: '#BE123C',
  800: '#9F1239',
  900: '#881337',
  950: '#4C0519',
} as const;

// Purple Scale (Experiences & Activities)
export const PurpleScale = {
  50: '#FAF5FF',
  100: '#F3E8FF',
  200: '#E9D5FF',
  300: '#D8B4FE',
  400: '#C084FC',
  500: '#A855F7',
  600: '#9333EA',
  700: '#7E22CE',
  800: '#6B21A8',
  900: '#581C87',
  950: '#3B0764',
} as const;

// Travel Category Colors
export const TravelCategoryColors = {
  flights: {
    bg: SkyBlueScale[50],
    text: SkyBlueScale[700],
    border: SkyBlueScale[200],
    icon: SkyBlueScale[500],
  },
  hotels: {
    bg: RauschPinkScale[50],
    text: RauschPinkScale[700],
    border: RauschPinkScale[200],
    icon: RauschPinkScale[500],
  },
  experiences: {
    bg: PurpleScale[50],
    text: PurpleScale[700],
    border: PurpleScale[200],
    icon: PurpleScale[500],
  },
  packages: {
    bg: EmeraldScale[50],
    text: EmeraldScale[700],
    border: EmeraldScale[200],
    icon: EmeraldScale[500],
  },
} as const;

// Amenity Badge Colors
export const AmenityBadgeColors = {
  wifi: { bg: SkyBlueScale[100], text: SkyBlueScale[700], label: 'WiFi' },
  parking: { bg: CleanNeutralScale[200], text: CleanNeutralScale[700], label: 'Parking' },
  pool: { bg: SkyBlueScale[100], text: SkyBlueScale[700], label: 'Pool' },
  breakfast: { bg: AmberScale[100], text: AmberScale[700], label: 'Breakfast' },
  petFriendly: { bg: EmeraldScale[100], text: EmeraldScale[700], label: 'Pet Friendly' },
  gym: { bg: RoseScale[100], text: RoseScale[700], label: 'Gym' },
  spa: { bg: PurpleScale[100], text: PurpleScale[700], label: 'Spa' },
  airConditioning: { bg: SkyBlueScale[100], text: SkyBlueScale[700], label: 'AC' },
  restaurant: { bg: AmberScale[100], text: AmberScale[700], label: 'Restaurant' },
  bar: { bg: PurpleScale[100], text: PurpleScale[700], label: 'Bar' },
  roomService: { bg: RauschPinkScale[100], text: RauschPinkScale[700], label: 'Room Service' },
  concierge: { bg: CleanNeutralScale[200], text: CleanNeutralScale[700], label: 'Concierge' },
  laundry: { bg: SkyBlueScale[100], text: SkyBlueScale[700], label: 'Laundry' },
} as const;

// Flight Class Badge Colors
export const FlightClassColors = {
  economy: { bg: CleanNeutralScale[200], text: CleanNeutralScale[700] },
  premiumEconomy: { bg: SkyBlueScale[100], text: SkyBlueScale[700] },
  business: { bg: PurpleScale[100], text: PurpleScale[700] },
  first: { bg: RauschPinkScale[100], text: RauschPinkScale[700] },
} as const;

// Voice State Indicators
export const VoiceStateColors = {
  idle: {
    gradient: `linear-gradient(135deg, ${CleanNeutralScale[300]} 0%, ${CleanNeutralScale[400]} 100%)`,
    glow: CleanNeutralScale[400],
  },
  listening: {
    gradient: `linear-gradient(135deg, ${SkyBlueScale[400]} 0%, ${SkyBlueScale[600]} 100%)`,
    glow: SkyBlueScale[500],
  },
  thinking: {
    gradient: `linear-gradient(135deg, ${AmberScale[400]} 0%, ${AmberScale[600]} 100%)`,
    glow: AmberScale[500],
  },
  speaking: {
    gradient: `linear-gradient(135deg, ${EmeraldScale[400]} 0%, ${EmeraldScale[600]} 100%)`,
    glow: EmeraldScale[500],
  },
} as const;

// Typography (Airbnb uses Circular, fallback to Inter)
export const Typography = {
  fontFamily: {
    primary: '"Circular", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
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
} as const;

// Spacing (8px base grid)
export const Spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '6rem',   // 96px
} as const;

// Border Radius (Airbnb's rounded aesthetic)
export const BorderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px - Airbnb standard
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',  // Pills and circles
} as const;

// Shadows (Clean, subtle Airbnb shadows)
export const Shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 2px 8px 0 rgba(0, 0, 0, 0.08)',
  lg: '0 4px 16px 0 rgba(0, 0, 0, 0.12)',
  xl: '0 8px 32px 0 rgba(0, 0, 0, 0.16)',
  card: '0 6px 16px rgba(0, 0, 0, 0.12)',
  hover: '0 8px 28px rgba(0, 0, 0, 0.15)',
  none: 'none',
} as const;

// Breakpoints (Mobile-first responsive)
export const Breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px', // Extra large
} as const;

// Animation Durations
export const AnimationDuration = {
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
  slower: '500ms',
} as const;

// Z-Index Scale
export const ZIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
} as const;

// Design System Export
export const TravelDesignTokens = {
  colors: {
    primary: RauschPinkScale,
    neutral: CleanNeutralScale,
    sky: SkyBlueScale,
    emerald: EmeraldScale,
    amber: AmberScale,
    rose: RoseScale,
    purple: PurpleScale,
    category: TravelCategoryColors,
    amenity: AmenityBadgeColors,
    flightClass: FlightClassColors,
    voiceState: VoiceStateColors,
  },
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  breakpoints: Breakpoints,
  animation: AnimationDuration,
  zIndex: ZIndex,
} as const;

export type TravelDesignTokens = typeof TravelDesignTokens;
