/**
 * Zod schema for ShipTrack theme validation
 */

import { z } from 'zod';

// Color hex validation
const hexColor = z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be valid hex color');
const hexColorWithAlpha = z.string().regex(/^#[0-9A-F]{6}([0-9A-F]{2})?$/i, 'Must be valid hex color');

// Color scale schema (c50-c950)
const ShipTrackColorScaleSchema = z.object({
  c50: hexColor,
  c100: hexColor,
  c200: hexColor,
  c300: hexColor,
  c400: hexColor,
  c500: hexColor,
  c600: hexColor,
  c700: hexColor,
  c800: hexColor,
  c900: hexColor,
  c950: hexColor,
});

// Text colors schema
const ShipTrackTextColorsSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  tertiary: hexColor,
  disabled: hexColor,
  inverse: hexColor,
});

// Complete color palette schema
const ShipTrackColorsSchema = z.object({
  primary: ShipTrackColorScaleSchema,
  success: ShipTrackColorScaleSchema,
  error: ShipTrackColorScaleSchema,
  warning: ShipTrackColorScaleSchema,
  info: ShipTrackColorScaleSchema,
  text: ShipTrackTextColorsSchema,
  background: z.object({
    main: hexColor,
    surface: hexColor,
    elevated: hexColor,
  }),
});

// Button state schema
const ShipTrackButtonStateSchema = z.object({
  backgroundColor: hexColor,
  borderColor: hexColor.optional(),
  borderWidth: z.string().optional(),
  elevation: z.string().optional(),
  textColor: hexColor,
});

// Button component schema
const ShipTrackButtonSchema = z.object({
  normal: ShipTrackButtonStateSchema,
  pressed: ShipTrackButtonStateSchema,
  disabled: ShipTrackButtonStateSchema,
  cornerRadius: z.string(),
});

// All buttons schema
const ShipTrackButtonsSchema = z.object({
  primary: ShipTrackButtonSchema,
  secondary: ShipTrackButtonSchema,
  nfc: ShipTrackButtonSchema,
  camera: ShipTrackButtonSchema,
});

// Icon schema
const ShipTrackIconSchema = z.object({
  name: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  viewportWidth: z.number().positive(),
  viewportHeight: z.number().positive(),
  pathData: z.string().min(1),
  fillColor: hexColor,
  description: z.string(),
});

// All icons schema
const ShipTrackIconsSchema = z.object({
  ic_login: ShipTrackIconSchema,
  ic_logout: ShipTrackIconSchema,
  ic_check_circle: ShipTrackIconSchema,
  ic_refresh: ShipTrackIconSchema,
  ic_camera: ShipTrackIconSchema,
  ic_nfc: ShipTrackIconSchema,
  ic_check: ShipTrackIconSchema,
  ic_error: ShipTrackIconSchema,
  ic_warning: ShipTrackIconSchema,
  ic_info: ShipTrackIconSchema,
  ic_close: ShipTrackIconSchema,
  ic_copy: ShipTrackIconSchema,
  ic_geofence: ShipTrackIconSchema,
  ic_arrow_back: ShipTrackIconSchema,
});

// Card schema
const ShipTrackCardSchema = z.object({
  backgroundColor: hexColor,
  borderColor: hexColor.optional(),
  borderWidth: z.string().optional(),
  elevation: z.string(),
  cornerRadius: z.string(),
  padding: z.string(),
});

// All cards schema
const ShipTrackCardsSchema = z.object({
  default: ShipTrackCardSchema,
  elevated: ShipTrackCardSchema,
  location: ShipTrackCardSchema,
  shipment: ShipTrackCardSchema,
  status: z.object({
    success: ShipTrackCardSchema,
    error: ShipTrackCardSchema,
    warning: ShipTrackCardSchema,
  }),
});

// Scanner schema
const ShipTrackScannerSchema = z.object({
  overlay: z.object({
    backgroundColor: hexColorWithAlpha,
    cornerColor: hexColor,
    guidelineColor: hexColorWithAlpha,
  }),
  viewfinder: z.object({
    borderColor: hexColor,
    borderWidth: z.string(),
    cornerRadius: z.string(),
  }),
  hint: z.object({
    backgroundColor: hexColorWithAlpha,
    textColor: hexColor,
    fontSize: z.string(),
  }),
});

// Typography schema
const ShipTrackTypographySchema = z.object({
  fontFamily: z.object({
    primary: z.array(z.string()),
    mono: z.array(z.string()),
  }),
  textScale: z.object({
    displayLarge: z.string(),
    displayMedium: z.string(),
    displaySmall: z.string(),
    headlineLarge: z.string(),
    headlineMedium: z.string(),
    headlineSmall: z.string(),
    titleLarge: z.string(),
    titleMedium: z.string(),
    titleSmall: z.string(),
    bodyLarge: z.string(),
    bodyMedium: z.string(),
    bodySmall: z.string(),
    labelLarge: z.string(),
    labelMedium: z.string(),
    labelSmall: z.string(),
  }),
  lineHeight: z.object({
    tight: z.string(),
    normal: z.string(),
    relaxed: z.string(),
  }),
});

// Spacing schema
const ShipTrackSpacingSchema = z.object({
  unit: z.literal('dp'),
  scale: z.object({
    xs: z.string(),
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
    xxl: z.string(),
  }),
});

// Animations schema
const ShipTrackAnimationsSchema = z.object({
  duration: z.object({
    fast: z.string(),
    normal: z.string(),
    slow: z.string(),
    slower: z.string(),
  }),
  easing: z.object({
    standard: z.string(),
    emphasized: z.string(),
    decelerated: z.string(),
    accelerated: z.string(),
  }),
});

// Complete ShipTrack theme schema
export const ShipTrackThemeSchema = z.object({
  version: z.string(),
  meta: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    organizationId: z.string().min(1),
    author: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  colors: ShipTrackColorsSchema,
  components: z.object({
    buttons: ShipTrackButtonsSchema,
    icons: ShipTrackIconsSchema,
    cards: ShipTrackCardsSchema,
    scanner: ShipTrackScannerSchema,
  }),
  typography: ShipTrackTypographySchema,
  spacing: ShipTrackSpacingSchema,
  animations: ShipTrackAnimationsSchema,
  signature: z.string().optional(),
});

export type ShipTrackTheme = z.infer<typeof ShipTrackThemeSchema>;

/**
 * Validate ShipTrack theme JSON
 */
export function validateShipTrackTheme(themeJSON: unknown): {
  valid: boolean;
  data?: ShipTrackTheme;
  errors?: string[];
} {
  try {
    const validated = ShipTrackThemeSchema.parse(themeJSON);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}
