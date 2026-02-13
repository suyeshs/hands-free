/**
 * Grab Food Theme - Zod Validation Schemas
 *
 * Runtime validation schemas for theme configuration and components.
 */

import { z } from 'zod';
import type { GrabFoodTheme } from './types';

// ============================================================================
// Base Schemas
// ============================================================================

const hexColorSchema = z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color');

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

const gradientConfigSchema = z.object({
  from: hexColorSchema,
  to: hexColorSchema,
  direction: z.enum(['to-t', 'to-tr', 'to-r', 'to-br', 'to-b', 'to-bl', 'to-l', 'to-tl']),
});

// ============================================================================
// Component Schemas
// ============================================================================

const restaurantCardComponentSchema = z.object({
  type: z.literal('restaurant-card'),
  layout: z.object({
    variant: z.enum(['grid', 'list']),
    imageHeight: z.string(),
    showImage: z.boolean(),
    showRating: z.boolean(),
    showDeliveryInfo: z.boolean(),
    showPromoBadge: z.boolean(),
  }),
  image: z.object({
    aspectRatio: z.string(),
    objectFit: z.enum(['cover', 'contain']),
    overlayGradient: z.boolean(),
    lazyLoad: z.boolean(),
  }),
  metadata: z.object({
    showCuisine: z.boolean(),
    showDistance: z.boolean(),
    showDeliveryTime: z.boolean(),
    showDeliveryFee: z.boolean(),
    showMinOrder: z.boolean(),
  }),
  promoBadge: z.object({
    backgroundColor: hexColorSchema,
    textColor: hexColorSchema,
    position: z.enum(['top-left', 'top-right']),
  }).optional(),
  hoverEffect: z.enum(['lift', 'scale', 'none']),
}).passthrough();

const menuItemCardComponentSchema = z.object({
  type: z.literal('menu-item-card'),
  layout: z.object({
    variant: z.enum(['card', 'list', 'compact']),
    imagePosition: z.enum(['top', 'left', 'right']),
    imageSize: z.enum(['sm', 'md', 'lg']),
    showImage: z.boolean(),
    showDescription: z.boolean(),
    showAddButton: z.boolean(),
  }),
  image: z.object({
    aspectRatio: z.string(),
    objectFit: z.enum(['cover', 'contain']),
    lazyLoad: z.boolean(),
    placeholderIcon: z.string(),
  }),
  dietary: z.object({
    showIndicators: z.boolean(),
    indicators: z.object({
      vegetarian: z.object({
        show: z.boolean(),
        icon: z.string(),
        color: hexColorSchema,
      }),
      vegan: z.object({
        show: z.boolean(),
        icon: z.string(),
        color: hexColorSchema,
      }),
      glutenFree: z.object({
        show: z.boolean(),
        icon: z.string(),
        color: hexColorSchema,
      }),
      spicy: z.object({
        show: z.boolean(),
        icon: z.string(),
        color: hexColorSchema,
      }),
    }),
  }),
  addButton: z.object({
    style: z.enum(['icon', 'text', 'both']),
    position: z.enum(['bottom-right', 'bottom-center', 'right']),
    size: z.enum(['sm', 'md', 'lg']),
  }),
  metadata: z.object({
    showPrice: z.boolean(),
    showCalories: z.boolean(),
    showPrepTime: z.boolean(),
    showCustomization: z.boolean(),
    showPopularity: z.boolean(),
  }),
  hoverEffect: z.enum(['lift', 'scale', 'border', 'none']),
}).passthrough();

const promoCarouselComponentSchema = z.object({
  type: z.literal('promo-carousel'),
  layout: z.object({
    height: z.string(),
    aspectRatio: z.string(),
    gap: z.string(),
    snap: z.boolean(),
    autoPlay: z.boolean(),
    autoPlayInterval: z.number(),
  }),
  indicators: z.object({
    show: z.boolean(),
    position: z.enum(['bottom-center', 'bottom-right', 'bottom-left']),
    style: z.enum(['dots', 'bars', 'thumbnails']),
  }),
  navigation: z.object({
    showArrows: z.boolean(),
    showOnHover: z.boolean(),
  }),
  gestures: z.object({
    swipe: z.boolean(),
    momentum: z.boolean(),
  }),
}).passthrough();

const orderStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  status: z.enum(['completed', 'in-progress', 'pending', 'cancelled']),
  estimatedTime: z.string().optional(),
  completedTime: z.string().optional(),
});

const orderTrackerComponentSchema = z.object({
  type: z.literal('order-tracker'),
  layout: z.object({
    variant: z.enum(['compact', 'detailed', 'fullscreen']),
    showMap: z.boolean(),
    showDriverInfo: z.boolean(),
    showItemSummary: z.boolean(),
  }),
  progressBar: z.object({
    style: z.enum(['linear', 'stepped', 'circular']),
    showPercentage: z.boolean(),
    showETA: z.boolean(),
    animateProgress: z.boolean(),
  }),
  steps: z.array(orderStepSchema),
  driverCard: z.object({
    showPhoto: z.boolean(),
    showName: z.boolean(),
    showRating: z.boolean(),
    showVehicleInfo: z.boolean(),
    showCallButton: z.boolean(),
    showChatButton: z.boolean(),
  }).optional(),
  realTimeUpdates: z.object({
    enabled: z.boolean(),
    updateInterval: z.number(),
    showNotifications: z.boolean(),
  }),
}).passthrough();

const bottomNavItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  activeIcon: z.string().optional(),
  route: z.string(),
  badgeCount: z.number().optional(),
});

const bottomNavComponentSchema = z.object({
  type: z.literal('bottom-nav'),
  layout: z.object({
    height: z.string(),
    backgroundColor: hexColorSchema,
    showLabels: z.boolean(),
    iconSize: z.enum(['sm', 'md', 'lg']),
  }),
  items: z.array(bottomNavItemSchema),
  activeIndicator: z.object({
    type: z.enum(['underline', 'background', 'color', 'scale']),
    color: hexColorSchema,
    animation: z.enum(['none', 'slide', 'fade', 'bounce']),
  }),
  badge: z.object({
    showOnItems: z.array(z.string()),
    backgroundColor: hexColorSchema,
    textColor: hexColorSchema,
    position: z.enum(['top-right', 'top-center']),
  }).optional(),
}).passthrough();

const filterChipSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  type: z.enum(['cuisine', 'price', 'rating', 'delivery-time', 'dietary', 'offers']),
  options: z.array(z.string()),
});

const searchBarComponentSchema = z.object({
  type: z.literal('search-bar'),
  layout: z.object({
    position: z.enum(['static', 'sticky', 'fixed']),
    height: z.string(),
    backgroundColor: hexColorSchema,
  }),
  input: z.object({
    placeholder: z.string(),
    showIcon: z.boolean(),
    showClearButton: z.boolean(),
    showVoiceButton: z.boolean(),
    autofocus: z.boolean(),
  }),
  filters: z.object({
    show: z.boolean(),
    style: z.enum(['chips', 'dropdown', 'modal']),
    options: z.array(filterChipSchema),
  }),
  suggestions: z.object({
    show: z.boolean(),
    showHistory: z.boolean(),
    showTrending: z.boolean(),
    maxItems: z.number(),
  }),
}).passthrough();

const voiceFABComponentSchema = z.object({
  type: z.literal('voice-fab'),
  size: z.enum(['sm', 'md', 'lg']),
  position: z.enum(['bottom-right', 'bottom-center', 'floating']),
  showLabel: z.boolean(),
  pulseIntensity: z.enum(['low', 'medium', 'high']),
  stateColors: z.object({
    idle: gradientConfigSchema,
    listening: gradientConfigSchema,
    thinking: gradientConfigSchema,
    speaking: gradientConfigSchema,
  }),
  glowEffect: z.object({
    intensity: z.enum(['low', 'medium', 'high']),
    blur: z.string(),
    spread: z.string(),
  }),
}).passthrough();

const cartPillComponentSchema = z.object({
  type: z.literal('cart-pill'),
  layout: z.object({
    position: z.enum(['bottom-left', 'bottom-right', 'top-right']),
    offset: z.object({
      bottom: z.number().optional(),
      right: z.number().optional(),
      left: z.number().optional(),
    }),
    display: z.enum(['auto', 'always']),
  }),
  content: z.object({
    showIcon: z.boolean(),
    showCount: z.boolean(),
    showTotal: z.boolean(),
    icon: z.string(),
  }),
  styling: z.object({
    backgroundColor: hexColorSchema,
    borderRadius: z.string(),
    padding: z.string(),
    shadow: z.string(),
    hoverShadow: z.string(),
  }),
  badge: z.object({
    backgroundColor: hexColorSchema,
    textColor: hexColorSchema,
    size: z.number(),
    fontSize: z.number(),
    fontWeight: z.number(),
  }),
  total: z.object({
    fontSize: z.number(),
    fontWeight: z.number(),
    color: hexColorSchema,
    prefix: z.string(),
  }),
  animation: z.object({
    enablePulse: z.boolean(),
    pulseDuration: z.string(),
    pulseScale: z.number(),
    enableSlideIn: z.boolean(),
    slideInDuration: z.string(),
  }),
  interactions: z.object({
    onClick: z.string(),
    hapticFeedback: z.boolean(),
  }),
  accessibility: z.object({
    ariaLabel: z.string(),
    role: z.string(),
    announceUpdates: z.boolean(),
  }),
}).passthrough();

const vegToggleOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().nullable(),
  filter: z.enum(['vegetarian', 'non-vegetarian']).nullable(),
  default: z.boolean(),
});

const vegToggleComponentSchema = z.object({
  type: z.literal('veg-toggle'),
  layout: z.object({
    position: z.enum(['category-header', 'top-header', 'search-bar']),
    alignment: z.enum(['left', 'right', 'center']),
  }),
  options: z.array(vegToggleOptionSchema),
  styling: z.object({
    container: z.object({
      backgroundColor: hexColorSchema,
      borderRadius: z.string(),
      padding: z.string(),
      gap: z.string(),
    }),
    option: z.object({
      padding: z.string(),
      borderRadius: z.string(),
      fontSize: z.number(),
      fontWeight: z.number(),
      color: hexColorSchema,
      transition: z.string(),
    }),
    active: z.object({
      backgroundColor: hexColorSchema,
      boxShadow: z.string(),
    }),
  }),
  behavior: z.object({
    filterMode: z.enum(['client-side', 'server-side']),
    animateTransition: z.boolean(),
    persistSelection: z.boolean(),
    localStorageKey: z.string().optional(),
  }),
  interactions: z.object({
    onClick: z.string(),
    hapticFeedback: z.boolean(),
  }),
  accessibility: z.object({
    role: z.string(),
    ariaLabel: z.string(),
    announceFilterChange: z.boolean(),
  }),
}).passthrough();

// ============================================================================
// Layout Schemas
// ============================================================================

const homeLayoutSchema = z.object({
  type: z.literal('home'),
  header: z.object({
    showLogo: z.boolean(),
    showLocation: z.boolean(),
    showNotifications: z.boolean(),
    sticky: z.boolean(),
    backgroundColor: hexColorSchema,
  }),
  searchBar: z.object({
    placeholder: z.string(),
    showVoiceButton: z.boolean(),
    showFilters: z.boolean(),
    sticky: z.boolean(),
  }),
  promoCarousel: z.object({
    show: z.boolean(),
    height: z.string(),
    autoPlay: z.boolean(),
  }),
  categoryPills: z.object({
    show: z.boolean(),
    style: z.enum(['pills', 'icons', 'cards']),
    scrollable: z.boolean(),
    sticky: z.boolean(),
  }),
  restaurantGrid: z.object({
    variant: z.enum(['grid', 'list']),
    columns: z.object({
      mobile: z.number(),
      tablet: z.number(),
      desktop: z.number(),
    }),
    gap: z.string(),
    infiniteScroll: z.boolean(),
    pullToRefresh: z.boolean(),
  }),
  bottomNav: z.object({
    show: z.boolean(),
    position: z.enum(['fixed', 'sticky']),
    showLabels: z.boolean(),
  }),
  voiceFAB: z.object({
    show: z.boolean(),
    position: z.enum(['bottom-right', 'bottom-center', 'floating']),
    size: z.enum(['sm', 'md', 'lg']),
  }),
});

const orderTrackingLayoutSchema = z.object({
  type: z.literal('order-tracking'),
  layout: z.enum(['fullscreen', 'overlay']),
  mapView: z.object({
    show: z.boolean(),
    height: z.string(),
    showRoute: z.boolean(),
    showDriverLocation: z.boolean(),
    showRestaurantLocation: z.boolean(),
    showDeliveryLocation: z.boolean(),
  }),
  orderProgress: z.object({
    position: z.enum(['top', 'bottom', 'overlay']),
    variant: z.enum(['compact', 'detailed']),
  }),
  driverCard: z.object({
    show: z.boolean(),
    position: z.enum(['bottom', 'floating']),
  }),
  orderSummary: z.object({
    show: z.boolean(),
    expandable: z.boolean(),
    showItems: z.boolean(),
    showPricing: z.boolean(),
  }),
  actions: z.object({
    showCallDriver: z.boolean(),
    showChatDriver: z.boolean(),
    showHelp: z.boolean(),
    showCancel: z.boolean(),
  }),
  realTimeUpdates: z.object({
    enabled: z.boolean(),
    pushNotifications: z.boolean(),
    soundAlerts: z.boolean(),
  }),
});

const restaurantDetailLayoutSchema = z.object({
  type: z.literal('restaurant-detail'),
  header: z.object({
    type: z.enum(['image', 'minimal']),
    height: z.string(),
    showBackButton: z.boolean(),
    showShareButton: z.boolean(),
    showFavoriteButton: z.boolean(),
    overlay: z.boolean(),
  }),
  restaurantInfo: z.object({
    showRating: z.boolean(),
    showReviewCount: z.boolean(),
    showCuisine: z.boolean(),
    showDeliveryInfo: z.boolean(),
    showPromo: z.boolean(),
  }),
  menuCategories: z.object({
    type: z.enum(['tabs', 'pills', 'sidebar']),
    sticky: z.boolean(),
    showIcons: z.boolean(),
    scrollable: z.boolean(),
  }),
  menuItems: z.object({
    layout: z.enum(['grid', 'list']),
    columns: z.object({
      mobile: z.number(),
      tablet: z.number(),
    }),
    showImages: z.boolean(),
    showDescription: z.boolean(),
    showPrice: z.boolean(),
    showCustomization: z.boolean(),
  }),
  cart: z.object({
    type: z.enum(['sheet', 'floating', 'fixed']),
    position: z.enum(['bottom', 'side']),
    showItemCount: z.boolean(),
    showTotal: z.boolean(),
    pulseOnAdd: z.boolean(),
  }),
});

// ============================================================================
// Main Theme Schema
// ============================================================================

export const grabFoodThemeSchema = z.object({
  version: z.string(),
  meta: z.object({
    name: z.string(),
    description: z.string().optional(),
    author: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    version: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  designTokens: z.object({
    colors: z.object({
      primary: colorScaleSchema,
      secondary: colorScaleSchema,
      accent: colorScaleSchema,
      info: colorScaleSchema,
      success: colorScaleSchema,
      warning: colorScaleSchema,
      error: colorScaleSchema,
      background: z.object({
        main: hexColorSchema,
        surface: hexColorSchema,
        elevated: hexColorSchema,
      }),
      text: z.object({
        primary: hexColorSchema,
        secondary: hexColorSchema,
        tertiary: hexColorSchema,
        disabled: hexColorSchema,
        inverse: hexColorSchema,
      }),
    }).passthrough(),
    typography: z.object({
      fontFamily: z.object({
        sans: z.string(),
        display: z.string(),
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
        normal: z.number(),
        medium: z.number(),
        semibold: z.number(),
        bold: z.number(),
        extrabold: z.number(),
      }),
      lineHeights: z.object({
        tight: z.string(),
        normal: z.string(),
        relaxed: z.string(),
      }),
      letterSpacing: z.object({
        tight: z.string(),
        normal: z.string(),
        wide: z.string(),
      }),
    }),
  }).passthrough(),
  layouts: z.object({
    home: homeLayoutSchema,
    orderTracking: orderTrackingLayoutSchema,
    restaurantDetail: restaurantDetailLayoutSchema,
  }),
  components: z.object({
    menuItemCard: menuItemCardComponentSchema,
    promoCarousel: promoCarouselComponentSchema,
    orderTracker: orderTrackerComponentSchema,
    bottomNav: bottomNavComponentSchema,
    searchBar: searchBarComponentSchema,
    voiceFAB: voiceFABComponentSchema,
    cartPill: cartPillComponentSchema.optional(),
    vegToggle: vegToggleComponentSchema.optional(),
    restaurantCard: restaurantCardComponentSchema.optional(),
  }).passthrough(),
  interactions: z.object({
    voiceCommands: z.object({
      browse: z.array(z.object({
        triggers: z.array(z.string()),
        action: z.string(),
        feedback: z.string(),
        visualIndicator: z.boolean(),
      })),
      order: z.array(z.object({
        triggers: z.array(z.string()),
        action: z.string(),
        feedback: z.string(),
        visualIndicator: z.boolean(),
      })),
      tracking: z.array(z.object({
        triggers: z.array(z.string()),
        action: z.string(),
        feedback: z.string(),
        visualIndicator: z.boolean(),
      })),
      navigation: z.array(z.object({
        triggers: z.array(z.string()),
        action: z.string(),
        feedback: z.string(),
        visualIndicator: z.boolean(),
      })),
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
    keyboard: z.record(z.string()),
  }),
  accessibility: z.object({
    wcagLevel: z.enum(['A', 'AA', 'AAA']),
    contrastRatios: z.object({
      normal: z.number(),
      large: z.number(),
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
  }),
  customCSS: z.string().optional(),
});

// ============================================================================
// Validation Functions
// ============================================================================

export function validateGrabFoodTheme(theme: unknown): {
  valid: boolean;
  data?: GrabFoodTheme;
  errors?: string[];
} {
  try {
    const result = grabFoodThemeSchema.safeParse(theme);

    if (result.success) {
      return {
        valid: true,
        data: result.data as GrabFoodTheme,
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

export function isGrabFoodTheme(theme: unknown): theme is GrabFoodTheme {
  return validateGrabFoodTheme(theme).valid;
}
