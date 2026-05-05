/**
 * ShipTrack Theme Type Definitions
 * Material Design 3 theme for Android last-mile delivery app
 */

/**
 * Color scale with Material Design 3 levels
 * Android uses c50-c950 naming convention for color scales
 */
export interface ShipTrackColorScale {
  c50: string;
  c100: string;
  c200: string;
  c300: string;
  c400: string;
  c500: string;  // Base/Primary shade
  c600: string;
  c700: string;
  c800: string;
  c900: string;
  c950: string;
}

/**
 * Text colors for different hierarchy levels
 */
export interface ShipTrackTextColors {
  primary: string;      // Main text
  secondary: string;    // Subdued text
  tertiary: string;     // Hints, placeholders
  disabled: string;     // Disabled state
  inverse: string;      // Text on colored backgrounds
}

/**
 * Complete color palette for ShipTrack app
 */
export interface ShipTrackColors {
  primary: ShipTrackColorScale;    // Slate colors for primary actions
  success: ShipTrackColorScale;    // Green for GPS/success states
  error: ShipTrackColorScale;      // Red for errors
  warning: ShipTrackColorScale;    // Orange for warnings
  info: ShipTrackColorScale;       // Blue for NFC/info
  text: ShipTrackTextColors;
  background: {
    main: string;       // #F5F7FA
    surface: string;    // #FFFFFF
    elevated: string;   // Cards with elevation
  };
}

/**
 * Button state configuration
 */
export interface ShipTrackButtonState {
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: string;
  elevation?: string;
  textColor: string;
}

/**
 * Complete button component definition
 */
export interface ShipTrackButton {
  normal: ShipTrackButtonState;
  pressed: ShipTrackButtonState;
  disabled: ShipTrackButtonState;
  cornerRadius: string;
}

/**
 * All button types in ShipTrack app
 */
export interface ShipTrackButtons {
  primary: ShipTrackButton;      // Slate background
  secondary: ShipTrackButton;    // Light background with border
  nfc: ShipTrackButton;          // Blue NFC action button
  camera: ShipTrackButton;       // Gray camera action button
}

/**
 * Android VectorDrawable icon definition
 */
export interface ShipTrackIcon {
  name: string;
  width: number;           // dp units
  height: number;          // dp units
  viewportWidth: number;
  viewportHeight: number;
  pathData: string;        // Android path syntax (M, L, Z, A only)
  fillColor: string;       // Base color (will be tinted by theme)
  description: string;
}

/**
 * All icons used in ShipTrack app
 */
export interface ShipTrackIcons {
  // Action icons (24dp)
  ic_login: ShipTrackIcon;
  ic_logout: ShipTrackIcon;
  ic_check_circle: ShipTrackIcon;
  ic_refresh: ShipTrackIcon;
  ic_camera: ShipTrackIcon;
  ic_nfc: ShipTrackIcon;

  // Status icons (24dp)
  ic_check: ShipTrackIcon;
  ic_error: ShipTrackIcon;
  ic_warning: ShipTrackIcon;
  ic_info: ShipTrackIcon;
  ic_close: ShipTrackIcon;

  // Utility icons (24dp)
  ic_copy: ShipTrackIcon;
  ic_geofence: ShipTrackIcon;
  ic_arrow_back: ShipTrackIcon;
}

/**
 * Card component configuration
 */
export interface ShipTrackCard {
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: string;
  elevation: string;
  cornerRadius: string;
  padding: string;
}

/**
 * All card types
 */
export interface ShipTrackCards {
  default: ShipTrackCard;
  elevated: ShipTrackCard;
  location: ShipTrackCard;    // Green tint for GPS info
  shipment: ShipTrackCard;    // Package/shipment info
  status: {
    success: ShipTrackCard;
    error: ShipTrackCard;
    warning: ShipTrackCard;
  };
}

/**
 * Scanner overlay styles
 */
export interface ShipTrackScanner {
  overlay: {
    backgroundColor: string;   // Semi-transparent dark
    cornerColor: string;       // Scanning frame corners
    guidelineColor: string;    // Center guidelines
  };
  viewfinder: {
    borderColor: string;
    borderWidth: string;
    cornerRadius: string;
  };
  hint: {
    backgroundColor: string;
    textColor: string;
    fontSize: string;
  };
}

/**
 * Typography scale for Android
 */
export interface ShipTrackTypography {
  fontFamily: {
    primary: string[];    // Roboto, system-ui
    mono: string[];       // Monospace for codes
  };
  textScale: {
    displayLarge: string;   // 57sp
    displayMedium: string;  // 45sp
    displaySmall: string;   // 36sp
    headlineLarge: string;  // 32sp
    headlineMedium: string; // 28sp
    headlineSmall: string;  // 24sp
    titleLarge: string;     // 22sp
    titleMedium: string;    // 16sp
    titleSmall: string;     // 14sp
    bodyLarge: string;      // 16sp
    bodyMedium: string;     // 14sp
    bodySmall: string;      // 12sp
    labelLarge: string;     // 14sp
    labelMedium: string;    // 12sp
    labelSmall: string;     // 11sp
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
  };
}

/**
 * Spacing system (4dp/8dp grid)
 */
export interface ShipTrackSpacing {
  unit: 'dp';
  scale: {
    xs: string;      // 4dp
    sm: string;      // 8dp
    md: string;      // 16dp
    lg: string;      // 24dp
    xl: string;      // 32dp
    xxl: string;     // 48dp
  };
}

/**
 * Animation configuration
 */
export interface ShipTrackAnimations {
  duration: {
    fast: string;       // 100ms
    normal: string;     // 200ms
    slow: string;       // 300ms
    slower: string;     // 500ms
  };
  easing: {
    standard: string;   // Cubic bezier
    emphasized: string;
    decelerated: string;
    accelerated: string;
  };
}

/**
 * Complete ShipTrack theme structure
 */
export interface ShipTrackTheme {
  version: string;
  meta: {
    name: string;
    description?: string;
    organizationId: string;
    author: string;
    createdAt: string;
    updatedAt: string;
  };
  colors: ShipTrackColors;
  components: {
    buttons: ShipTrackButtons;
    icons: ShipTrackIcons;
    cards: ShipTrackCards;
    scanner: ShipTrackScanner;
  };
  typography: ShipTrackTypography;
  spacing: ShipTrackSpacing;
  animations: ShipTrackAnimations;
  signature?: string;
}
