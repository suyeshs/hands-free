/**
 * Grab Food - Layout Configurations
 *
 * Pre-defined layout configurations for Home, Order Tracking, and Restaurant Detail screens.
 */

import type {
  HomeLayoutConfig,
  OrderTrackingLayoutConfig,
  RestaurantDetailLayoutConfig,
} from '../types';

/**
 * Default Home Layout (Single Restaurant Menu)
 * Search + Promo Carousel + Menu Categories + Menu Items + Bottom Nav
 */
export const DefaultHomeLayout: HomeLayoutConfig = {
  type: 'home',

  header: {
    showLogo: true,
    showLocation: true,
    showNotifications: true,
    sticky: true,
    backgroundColor: '#ffffff',
  },

  searchBar: {
    placeholder: 'Search for dishes',
    showVoiceButton: true,
    showFilters: true,
    sticky: true,
  },

  promoCarousel: {
    show: true,
    height: '160px',
    autoPlay: true,
  },

  categoryPills: {
    show: true,
    style: 'pills',
    scrollable: true,
    sticky: true,
  },

  restaurantGrid: {
    variant: 'grid',
    columns: {
      mobile: 2,
      tablet: 3,
      desktop: 4,
    },
    gap: '16px',
    infiniteScroll: true,
    pullToRefresh: true,
  },

  bottomNav: {
    show: true,
    position: 'fixed',
    showLabels: true,
  },

  voiceFAB: {
    show: true,
    position: 'bottom-right',
    size: 'md',
  },
};

/**
 * List View Home Layout
 * Menu items in list format instead of grid
 */
export const ListViewHomeLayout: HomeLayoutConfig = {
  ...DefaultHomeLayout,
  restaurantGrid: {
    variant: 'list',
    columns: {
      mobile: 1,
      tablet: 1,
      desktop: 1,
    },
    gap: '12px',
    infiniteScroll: true,
    pullToRefresh: true,
  },
};

/**
 * Default Order Tracking Layout
 * Map + Progress + Driver Card + Order Summary
 */
export const DefaultOrderTrackingLayout: OrderTrackingLayoutConfig = {
  type: 'order-tracking',
  layout: 'fullscreen',

  mapView: {
    show: true,
    height: '300px',
    showRoute: true,
    showDriverLocation: true,
    showRestaurantLocation: true,
    showDeliveryLocation: true,
  },

  orderProgress: {
    position: 'bottom',
    variant: 'detailed',
  },

  driverCard: {
    show: true,
    position: 'floating',
  },

  orderSummary: {
    show: true,
    expandable: true,
    showItems: true,
    showPricing: true,
  },

  actions: {
    showCallDriver: true,
    showChatDriver: true,
    showHelp: true,
    showCancel: true,
  },

  realTimeUpdates: {
    enabled: true,
    pushNotifications: true,
    soundAlerts: true,
  },
};

/**
 * Compact Order Tracking Layout
 * For inline display in orders list
 */
export const CompactOrderTrackingLayout: OrderTrackingLayoutConfig = {
  type: 'order-tracking',
  layout: 'overlay',

  mapView: {
    show: false,
    height: '0',
    showRoute: false,
    showDriverLocation: false,
    showRestaurantLocation: false,
    showDeliveryLocation: false,
  },

  orderProgress: {
    position: 'top',
    variant: 'compact',
  },

  driverCard: {
    show: false,
    position: 'bottom',
  },

  orderSummary: {
    show: true,
    expandable: false,
    showItems: false,
    showPricing: true,
  },

  actions: {
    showCallDriver: false,
    showChatDriver: false,
    showHelp: false,
    showCancel: false,
  },

  realTimeUpdates: {
    enabled: true,
    pushNotifications: false,
    soundAlerts: false,
  },
};

/**
 * Default Restaurant Detail Layout
 * Image Header + Restaurant Info + Menu Categories + Menu Items + Cart
 */
export const DefaultRestaurantDetailLayout: RestaurantDetailLayoutConfig = {
  type: 'restaurant-detail',

  header: {
    type: 'image',
    height: '200px',
    showBackButton: true,
    showShareButton: true,
    showFavoriteButton: true,
    overlay: true,
  },

  restaurantInfo: {
    showRating: true,
    showReviewCount: true,
    showCuisine: true,
    showDeliveryInfo: true,
    showPromo: true,
  },

  menuCategories: {
    type: 'pills',
    sticky: true,
    showIcons: true,
    scrollable: true,
  },

  menuItems: {
    layout: 'list',
    columns: {
      mobile: 1,
      tablet: 1,
    },
    showImages: true,
    showDescription: true,
    showPrice: true,
    showCustomization: true,
  },

  cart: {
    type: 'floating',
    position: 'bottom',
    showItemCount: true,
    showTotal: true,
    pulseOnAdd: true,
  },
};

/**
 * Minimal Restaurant Detail Layout
 * No header image, simple menu display
 */
export const MinimalRestaurantDetailLayout: RestaurantDetailLayoutConfig = {
  ...DefaultRestaurantDetailLayout,
  header: {
    type: 'minimal',
    height: '64px',
    showBackButton: true,
    showShareButton: false,
    showFavoriteButton: false,
    overlay: false,
  },
};

/**
 * Grid Menu Restaurant Detail Layout
 * Menu items in grid layout
 */
export const GridMenuRestaurantDetailLayout: RestaurantDetailLayoutConfig = {
  ...DefaultRestaurantDetailLayout,
  menuItems: {
    layout: 'grid',
    columns: {
      mobile: 2,
      tablet: 3,
    },
    showImages: true,
    showDescription: false,
    showPrice: true,
    showCustomization: false,
  },
};

/**
 * All default layouts
 */
export const DefaultGrabFoodLayouts = {
  home: DefaultHomeLayout,
  homeList: ListViewHomeLayout,
  orderTracking: DefaultOrderTrackingLayout,
  orderTrackingCompact: CompactOrderTrackingLayout,
  restaurantDetail: DefaultRestaurantDetailLayout,
  restaurantDetailMinimal: MinimalRestaurantDetailLayout,
  restaurantDetailGrid: GridMenuRestaurantDetailLayout,
};

/**
 * Get a layout by type and variant
 */
export function getLayout(
  type: 'home' | 'order-tracking' | 'restaurant-detail',
  variant?: string
): HomeLayoutConfig | OrderTrackingLayoutConfig | RestaurantDetailLayoutConfig {
  const key = variant ? `${type}-${variant}` : type;

  switch (type) {
    case 'home':
      return variant === 'list' ? ListViewHomeLayout : DefaultHomeLayout;
    case 'order-tracking':
      return variant === 'compact' ? CompactOrderTrackingLayout : DefaultOrderTrackingLayout;
    case 'restaurant-detail':
      if (variant === 'minimal') return MinimalRestaurantDetailLayout;
      if (variant === 'grid') return GridMenuRestaurantDetailLayout;
      return DefaultRestaurantDetailLayout;
    default:
      return DefaultHomeLayout;
  }
}
