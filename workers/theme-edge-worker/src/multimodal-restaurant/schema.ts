/**
 * Multimodal Restaurant Theme - Zod Validation Schema
 *
 * Runtime validation for restaurant theme configurations
 */

import { z } from 'zod';

/**
 * Hex color validation
 */
const hexColorSchema = z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color');

/**
 * Color scale schema (11 shades: 50-950)
 */
const colorScaleSchema = z.object({
  50: hexColorSchema,
  100: hexColorSchema,
  200: hexColorSchema,
  300: hexColorSchema,
  400: hexColorSchema,
  500: hexColorSchema,
  600: hexColorSchema,
  700: hexColorSchema,
  800: hexColorSchema,
  900: hexColorSchema,
  950: hexColorSchema,
});

/**
 * Gradient configuration schema
 */
const gradientConfigSchema = z.object({
  from: hexColorSchema,
  to: hexColorSchema,
  via: hexColorSchema.optional(),
  direction: z.enum(['to-r', 'to-l', 'to-t', 'to-b', 'to-tr', 'to-tl', 'to-br', 'to-bl']),
});

/**
 * Restaurant color palette schema
 */
const restaurantColorPaletteSchema = z.object({
  primary: colorScaleSchema,
  secondary: colorScaleSchema.optional(),
  accent: colorScaleSchema,
  background: z.object({
    main: hexColorSchema,
    surface: hexColorSchema,
    elevated: hexColorSchema,
    gradient: gradientConfigSchema.optional(),
  }),
  text: z.object({
    primary: hexColorSchema,
    secondary: hexColorSchema,
    tertiary: hexColorSchema,
    disabled: hexColorSchema,
    inverse: hexColorSchema,
  }),
  dietary: z.object({
    veg: colorScaleSchema,
    nonVeg: colorScaleSchema,
    vegan: colorScaleSchema.optional(),
    glutenFree: colorScaleSchema.optional(),
  }),
  status: z.object({
    success: colorScaleSchema,
    warning: colorScaleSchema,
    error: colorScaleSchema,
    info: colorScaleSchema,
  }),
  voiceStates: z.object({
    idle: hexColorSchema,
    listening: hexColorSchema,
    thinking: hexColorSchema,
    speaking: hexColorSchema,
  }),
});

/**
 * Typography schema
 */
const restaurantTypographySchema = z.object({
  fontFamily: z.object({
    sans: z.array(z.string()),
    serif: z.array(z.string()).optional(),
    heading: z.array(z.string()).optional(),
  }),
  scale: z.object({
    xs: z.string(),
    sm: z.string(),
    base: z.string(),
    lg: z.string(),
    xl: z.string(),
    '2xl': z.string(),
    '3xl': z.string(),
    '4xl': z.string(),
  }),
  weights: z.object({
    normal: z.number().min(100).max(900),
    medium: z.number().min(100).max(900),
    semibold: z.number().min(100).max(900),
    bold: z.number().min(100).max(900),
  }),
  lineHeights: z.object({
    tight: z.string(),
    normal: z.string(),
    relaxed: z.string(),
    loose: z.string(),
  }),
  letterSpacing: z.object({
    tight: z.string(),
    normal: z.string(),
    wide: z.string(),
  }).optional(),
});

/**
 * Spacing scale schema
 */
const spacingScaleSchema = z.object({
  unit: z.enum(['px', 'rem']),
  scale: z.object({
    0: z.string(),
    1: z.string(),
    2: z.string(),
    3: z.string(),
    4: z.string(),
    5: z.string(),
    6: z.string(),
    8: z.string(),
    10: z.string(),
    12: z.string(),
    16: z.string(),
    20: z.string(),
    24: z.string(),
  }),
});

/**
 * Border radius scale schema
 */
const borderRadiusScaleSchema = z.object({
  none: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  '3xl': z.string(),
  full: z.string(),
});

/**
 * Shadow scale schema
 */
const shadowScaleSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  inner: z.string(),
});

/**
 * Animation config schema
 */
const animationConfigSchema = z.object({
  duration: z.object({
    fast: z.string(),
    normal: z.string(),
    slow: z.string(),
  }),
  easing: z.object({
    ease: z.string(),
    easeIn: z.string(),
    easeOut: z.string(),
    easeInOut: z.string(),
    spring: z.string(),
  }),
});

/**
 * Breakpoint scale schema
 */
const breakpointScaleSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
});

/**
 * Design tokens schema
 */
const restaurantDesignTokensSchema = z.object({
  colors: restaurantColorPaletteSchema,
  typography: restaurantTypographySchema,
  spacing: spacingScaleSchema,
  borderRadius: borderRadiusScaleSchema,
  shadows: shadowScaleSchema,
  animations: animationConfigSchema,
  breakpoints: breakpointScaleSchema,
});

/**
 * Feature item schema
 */
const featureItemSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
});

/**
 * Choice card config schema
 */
const choiceCardConfigSchema = z.object({
  label: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  gradient: gradientConfigSchema,
  benefits: z.array(z.string()),
});

/**
 * Landing layout config schema
 */
const landingLayoutConfigSchema = z.object({
  type: z.enum(['two-path', 'menu-first', 'hero']),
  choiceCards: z.object({
    voice: choiceCardConfigSchema,
    standard: choiceCardConfigSchema,
  }).optional(),
  hero: z.object({
    showLogo: z.boolean(),
    showTagline: z.boolean(),
    backgroundImage: z.string().optional(),
    height: z.enum(['sm', 'md', 'lg', 'full']),
  }).optional(),
  features: z.object({
    show: z.boolean(),
    items: z.array(featureItemSchema),
  }).optional(),
});

/**
 * Voice orb config schema
 */
const voiceOrbConfigSchema = z.object({
  size: z.enum(['sm', 'md', 'lg']),
  position: z.enum(['bottom-center', 'bottom-right', 'floating']),
  showLabel: z.boolean(),
  showVisualizer: z.boolean(),
  pulseAnimation: z.enum(['subtle', 'medium', 'strong']),
});

/**
 * Voice-assisted layout config schema
 */
const voiceAssistedLayoutConfigSchema = z.object({
  type: z.enum(['split-view', 'overlay', 'immersive']),
  voicePanel: z.object({
    width: z.enum(['narrow', 'medium', 'wide']),
    position: z.enum(['left', 'right']),
    showTranscript: z.boolean(),
    showCartSummary: z.boolean(),
  }).optional(),
  voiceOrb: voiceOrbConfigSchema,
  visualFeed: z.object({
    showCategories: z.boolean(),
    highlightMentioned: z.boolean(),
    autoScroll: z.boolean(),
    gridColumns: z.object({
      mobile: z.number().min(1).max(3),
      tablet: z.number().min(1).max(4),
      desktop: z.number().min(1).max(6),
    }),
  }),
  dishModal: z.object({
    position: z.enum(['center', 'bottom', 'side']),
    size: z.enum(['sm', 'md', 'lg']),
    backdrop: z.enum(['blur', 'dark', 'light']),
  }),
});

/**
 * Filter option schema
 */
const filterOptionSchema = z.object({
  type: z.enum(['dietary', 'price', 'rating', 'spice', 'category']),
  label: z.string(),
  enabled: z.boolean(),
});

/**
 * Standard browse layout config schema
 */
const standardBrowseLayoutConfigSchema = z.object({
  type: z.enum(['grid', 'magazine', 'tabbed']),
  categoryNav: z.object({
    type: z.enum(['tabs', 'carousel', 'sidebar', 'dropdown']),
    position: z.enum(['top', 'left', 'sticky']),
    showIcons: z.boolean(),
    showCount: z.boolean(),
  }),
  menuGrid: z.object({
    columns: z.object({
      mobile: z.number().min(1).max(3),
      tablet: z.number().min(1).max(4),
      desktop: z.number().min(1).max(6),
    }),
    gap: z.string(),
    cardSize: z.enum(['compact', 'comfortable', 'spacious']),
  }),
  filters: z.object({
    show: z.boolean(),
    position: z.enum(['sidebar', 'top', 'modal']),
    options: z.array(filterOptionSchema),
  }),
  search: z.object({
    show: z.boolean(),
    position: z.enum(['header', 'top', 'floating']),
    placeholder: z.string(),
  }),
});

/**
 * Layouts schema
 */
const layoutsSchema = z.object({
  landing: landingLayoutConfigSchema,
  voiceAssisted: voiceAssistedLayoutConfigSchema,
  standardBrowse: standardBrowseLayoutConfigSchema,
});

/**
 * Badge style schema
 */
const badgeStyleSchema = z.object({
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  borderColor: hexColorSchema.optional(),
  icon: z.string().optional(),
});

/**
 * Component schemas (simplified for brevity)
 */
const menuCardComponentSchema = z.object({
  type: z.literal('menu-card'),
  layout: z.object({
    imageHeight: z.string(),
    showImage: z.boolean(),
    showRating: z.boolean(),
    showBadges: z.boolean(),
    showDescription: z.boolean(),
    showPrice: z.boolean(),
  }),
  image: z.object({
    aspectRatio: z.string(),
    objectFit: z.enum(['cover', 'contain']),
    placeholder: z.string(),
    lazyLoad: z.boolean(),
  }).optional(),
  badges: z.object({
    bestseller: badgeStyleSchema,
    new: badgeStyleSchema,
    spicy: badgeStyleSchema,
    dietary: badgeStyleSchema,
  }).optional(),
  priceDisplay: z.object({
    position: z.enum(['header', 'footer']),
    size: z.enum(['sm', 'md', 'lg']),
    showCurrency: z.boolean(),
  }),
  actionButton: z.object({
    type: z.enum(['add', 'quick-add', 'quantity']),
    style: z.enum(['primary', 'secondary', 'ghost']),
  }),
});

/**
 * Voice command schema
 */
const voiceCommandSchema = z.object({
  triggers: z.array(z.string()),
  action: z.string(),
  feedback: z.string(),
  visualIndicator: z.boolean().optional(),
});

/**
 * Interactions schema
 */
const restaurantInteractionsSchema = z.object({
  voiceCommands: z.object({
    browse: z.array(voiceCommandSchema),
    order: z.array(voiceCommandSchema),
    cart: z.array(voiceCommandSchema),
    navigation: z.array(voiceCommandSchema),
  }),
  gestures: z.object({
    swipeToRemove: z.boolean(),
    pullToRefresh: z.boolean(),
    pinchToZoom: z.boolean(),
    longPressForDetails: z.boolean(),
  }),
  haptics: z.object({
    enabled: z.boolean(),
    intensity: z.enum(['light', 'medium', 'heavy']),
    events: z.object({
      addToCart: z.boolean(),
      removeFromCart: z.boolean(),
      voiceActivation: z.boolean(),
      error: z.boolean(),
    }),
  }),
  keyboard: z.object({
    search: z.string(),
    cart: z.string(),
    voiceActivate: z.string(),
    prevCategory: z.string(),
    nextCategory: z.string(),
  }),
});

/**
 * Accessibility config schema
 */
const accessibilityConfigSchema = z.object({
  wcagLevel: z.enum(['A', 'AA', 'AAA']),
  contrastRatios: z.object({
    normal: z.number().min(1),
    large: z.number().min(1),
  }),
  keyboardNav: z.object({
    enabled: z.boolean(),
    showFocusIndicators: z.boolean(),
    skipLinks: z.boolean(),
  }),
  screenReader: z.object({
    announceChanges: z.boolean(),
    liveRegions: z.boolean(),
    ariaLabels: z.boolean(),
  }),
  voiceAccessibility: z.object({
    alternativeInputMethods: z.boolean(),
    visualFeedback: z.boolean(),
    errorRecovery: z.boolean(),
  }),
});

/**
 * Theme metadata schema
 */
const themeMetaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  restaurantId: z.string().optional(),
  author: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.string(),
  tags: z.array(z.string()).optional(),
});

/**
 * Main multimodal restaurant theme schema
 */
export const multimodalRestaurantThemeSchema = z.object({
  version: z.string(),
  meta: themeMetaSchema,
  designTokens: restaurantDesignTokensSchema,
  layouts: layoutsSchema,
  components: z.object({
    menuCard: menuCardComponentSchema,
    // Add other components as needed
  }).passthrough(), // Allow additional components
  interactions: restaurantInteractionsSchema,
  accessibility: accessibilityConfigSchema,
  customCSS: z.string().optional(),
});

/**
 * Validate multimodal restaurant theme
 */
export function validateMultimodalRestaurantTheme(theme: unknown): {
  valid: boolean;
  errors?: string[];
  data?: any;
} {
  try {
    const result = multimodalRestaurantThemeSchema.safeParse(theme);

    if (result.success) {
      return {
        valid: true,
        data: result.data,
      };
    } else {
      return {
        valid: false,
        errors: result.error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`
        ),
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [(error as Error).message],
    };
  }
}

/**
 * Type guard for multimodal restaurant theme
 */
export function isMultimodalRestaurantTheme(theme: unknown): boolean {
  return validateMultimodalRestaurantTheme(theme).valid;
}

/**
 * Export Zod schema for external use
 */
export type MultimodalRestaurantThemeInput = z.infer<typeof multimodalRestaurantThemeSchema>;
