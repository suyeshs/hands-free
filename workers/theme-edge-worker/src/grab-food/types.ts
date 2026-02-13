/**
 * Grab Food Theme - Type Definitions
 *
 * TypeScript interfaces and types for the Grab Food delivery theme.
 * Follows the multimodal-restaurant pattern but adapted for delivery.
 */

// ============================================================================
// Base Types
// ============================================================================

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;  // Base color
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface GradientConfig {
  from: string;
  to: string;
  direction: 'to-t' | 'to-tr' | 'to-r' | 'to-br' | 'to-b' | 'to-bl' | 'to-l' | 'to-tl';
}

export interface ThemeMeta {
  name: string;
  description?: string;
  author: string;
  category?: string;  // Theme category for layout selection (e.g., 'grab-food', 'multimodal-restaurant')
  createdAt: string;
  updatedAt: string;
  version: string;
  tags?: string[];
}

// ============================================================================
// Design Tokens
// ============================================================================

export interface GrabFoodDesignTokens {
  colors: {
    primary: ColorScale;
    secondary: ColorScale;
    accent: ColorScale;
    info: ColorScale;
    success: ColorScale;
    warning: ColorScale;
    error: ColorScale;
    background: {
      main: string;
      surface: string;
      elevated: string;
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      disabled: string;
      inverse: string;
    };
    delivery: {
      preparing: DeliveryStatusColor;
      pickedUp: DeliveryStatusColor;
      onTheWay: DeliveryStatusColor;
      nearby: DeliveryStatusColor;
      delivered: DeliveryStatusColor;
      cancelled: DeliveryStatusColor;
    };
  };
  typography: {
    fontFamily: {
      sans: string;
      display: string;
    };
    scale: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
    };
    weights: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
      extrabold: number;
    };
    lineHeights: {
      tight: string;
      normal: string;
      relaxed: string;
    };
    letterSpacing: {
      tight: string;
      normal: string;
      wide: string;
    };
  };
  spacing: {
    unit: 'px' | 'rem';
    scale: Record<string, string>;
  };
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  animations: {
    durations: {
      fast: number;
      normal: number;
      slow: number;
    };
    easings: Record<string, string>;
  };
  breakpoints: Record<string, string>;
  gradients: Record<string, GradientConfig>;
}

export interface DeliveryStatusColor {
  color: string;
  label: string;
  icon: string;
}

// ============================================================================
// Component Base Types
// ============================================================================

export interface ComponentDimensions {
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
}

export interface ComponentPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ComponentMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ComponentTypography {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: string;
  letterSpacing?: string;
}

export interface ComponentStateColors {
  background: string;
  text: string;
  border: string;
}

export interface ComponentStateShadows {
  outer: string;
  inner: string;
}

export interface ComponentStateBorder {
  width: string;
  style: 'solid' | 'dashed' | 'dotted' | 'none';
  radius: string;
}

export interface ComponentState {
  colors: ComponentStateColors;
  shadows: ComponentStateShadows;
  border: ComponentStateBorder;
  transform?: string;
}

export interface ComponentTransition {
  from: string;
  to: string;
  animation: {
    duration: number;
    easing: string;
  };
  haptic?: boolean;
}

export interface TouchInteraction {
  minTouchSize: {
    width: number;
    height: number;
  };
  haptic?: 'light' | 'medium' | 'heavy';
}

export interface VoiceCommand {
  triggers: string[];
  action?: string;
  feedback: string;
  visualIndicator: boolean;
}

export interface KeyboardShortcut {
  key: string;
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[];
}

export interface GestureCommand {
  type: 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'long-press' | 'double-tap';
  action: string;
}

export interface ComponentInteraction {
  primary: 'touch' | 'mouse' | 'voice' | 'keyboard';
  alternatives: ('touch' | 'mouse' | 'voice' | 'keyboard')[];
  touch?: TouchInteraction;
  voice?: VoiceCommand[];
  keyboard?: KeyboardShortcut[];
  gesture?: GestureCommand[];
}

export interface AccessibilityConfig {
  role: string;
  ariaLabel: string;
  focusable: boolean;
  keyboardNavigable: boolean;
  screenReaderText: string;
}

export interface BaseComponent {
  id: string;
  name: string;
  type: string;
  description: string;
  category: 'navigation' | 'content' | 'input' | 'feedback' | 'marketing';
  dimensions: ComponentDimensions;
  padding: ComponentPadding;
  margin: ComponentMargin;
  typography: ComponentTypography;
  states: Record<string, ComponentState>;
  transitions: ComponentTransition[];
  defaultState: string;
  interaction: ComponentInteraction;
  accessibility: AccessibilityConfig;
  platform: 'web' | 'mobile' | 'both';
  frameworks: string[];
  createdAt: string;
  updatedAt: string;
  version: string;
  tags?: string[];
}

// ============================================================================
// Specific Component Types
// ============================================================================

export interface RestaurantCardComponent extends BaseComponent {
  type: 'restaurant-card';
  layout: {
    variant: 'grid' | 'list';
    imageHeight: string;
    showImage: boolean;
    showRating: boolean;
    showDeliveryInfo: boolean;
    showPromoBadge: boolean;
  };
  image: {
    aspectRatio: string;
    objectFit: 'cover' | 'contain';
    overlayGradient: boolean;
    lazyLoad: boolean;
  };
  metadata: {
    showCuisine: boolean;
    showDistance: boolean;
    showDeliveryTime: boolean;
    showDeliveryFee: boolean;
    showMinOrder: boolean;
  };
  promoBadge?: {
    backgroundColor: string;
    textColor: string;
    position: 'top-left' | 'top-right';
  };
  hoverEffect: 'lift' | 'scale' | 'none';
}

export interface MenuItemCardComponent extends BaseComponent {
  type: 'menu-item-card';
  layout: {
    variant: 'card' | 'list' | 'compact';
    imagePosition: 'top' | 'left' | 'right';
    imageSize: 'sm' | 'md' | 'lg';
    showImage: boolean;
    showDescription: boolean;
    showAddButton: boolean;
  };
  image: {
    aspectRatio: string;
    objectFit: 'cover' | 'contain';
    lazyLoad: boolean;
    fallbackIcon: string;
  };
  metadata: {
    showPrice: boolean;
    showCalories: boolean;
    showPreparationTime: boolean;
    showCustomization: boolean;
    showPopularity: boolean;
  };
  dietary: {
    showIndicators: boolean;
    indicators: {
      vegetarian: { show: boolean; icon: string; color: string };
      vegan: { show: boolean; icon: string; color: string };
      glutenFree: { show: boolean; icon: string; color: string };
      spicy: { show: boolean; icon: string; color: string };
    };
  };
  addButton: {
    style: 'icon' | 'text' | 'both';
    position: 'bottom-right' | 'bottom-center' | 'right';
    size: 'sm' | 'md' | 'lg';
  };
  hoverEffect: 'lift' | 'scale' | 'border' | 'none';
}

export interface PromoCarouselComponent extends BaseComponent {
  type: 'promo-carousel';
  layout: {
    height: string;
    aspectRatio: string;
    gap: string;
    snap: boolean;
    autoPlay: boolean;
    autoPlayInterval: number;
  };
  indicators: {
    show: boolean;
    position: 'bottom-center' | 'bottom-right' | 'bottom-left';
    style: 'dots' | 'bars' | 'thumbnails';
  };
  navigation: {
    showArrows: boolean;
    showOnHover: boolean;
  };
  gestures: {
    swipe: boolean;
    momentum: boolean;
  };
}

export interface OrderStep {
  id: string;
  label: string;
  icon: string;
  status: 'completed' | 'in-progress' | 'pending' | 'cancelled';
  estimatedTime?: string;
  completedTime?: string;
}

export interface OrderTrackerComponent extends BaseComponent {
  type: 'order-tracker';
  layout: {
    variant: 'compact' | 'detailed' | 'fullscreen';
    showMap: boolean;
    showDriverInfo: boolean;
    showItemSummary: boolean;
  };
  progressBar: {
    style: 'linear' | 'stepped' | 'circular';
    showPercentage: boolean;
    showETA: boolean;
    animateProgress: boolean;
  };
  steps: OrderStep[];
  driverCard?: {
    showPhoto: boolean;
    showName: boolean;
    showRating: boolean;
    showVehicleInfo: boolean;
    showCallButton: boolean;
    showChatButton: boolean;
  };
  realTimeUpdates: {
    enabled: boolean;
    updateInterval: number;
    showNotifications: boolean;
  };
}

export interface BottomNavItem {
  id: string;
  label: string;
  icon: string;
  activeIcon?: string;
  route: string;
  badgeCount?: number;
}

export interface BottomNavComponent extends BaseComponent {
  type: 'bottom-nav';
  layout: {
    height: string;
    backgroundColor: string;
    showLabels: boolean;
    iconSize: 'sm' | 'md' | 'lg';
  };
  items: BottomNavItem[];
  activeIndicator: {
    type: 'underline' | 'background' | 'color' | 'scale';
    color: string;
    animation: 'none' | 'slide' | 'fade' | 'bounce';
  };
  badge?: {
    showOnItems: string[];
    backgroundColor: string;
    textColor: string;
    position: 'top-right' | 'top-center';
  };
}

export interface FilterChip {
  id: string;
  label: string;
  icon?: string;
  type: 'cuisine' | 'price' | 'rating' | 'delivery-time' | 'dietary' | 'offers';
  options: string[];
}

export interface SearchBarComponent extends BaseComponent {
  type: 'search-bar';
  layout: {
    position: 'static' | 'sticky' | 'fixed';
    height: string;
    backgroundColor: string;
  };
  input: {
    placeholder: string;
    showIcon: boolean;
    showClearButton: boolean;
    showVoiceButton: boolean;
    autofocus: boolean;
  };
  filters: {
    show: boolean;
    style: 'chips' | 'dropdown' | 'modal';
    options: FilterChip[];
  };
  suggestions: {
    show: boolean;
    showHistory: boolean;
    showTrending: boolean;
    maxItems: number;
  };
}

export interface VoiceFABComponent extends BaseComponent {
  type: 'voice-fab';
  size: 'sm' | 'md' | 'lg';
  position: 'bottom-right' | 'bottom-center' | 'floating';
  showLabel: boolean;
  pulseIntensity: 'low' | 'medium' | 'high';
  stateColors: {
    idle: GradientConfig;
    listening: GradientConfig;
    thinking: GradientConfig;
    speaking: GradientConfig;
  };
  glowEffect: {
    intensity: 'low' | 'medium' | 'high';
    blur: string;
    spread: string;
  };
}

export interface CartPillComponent extends BaseComponent {
  type: 'cart-pill';
  layout: {
    position: 'bottom-left' | 'bottom-right' | 'top-right';
    offset: { bottom?: number; right?: number; left?: number };
    display: 'auto' | 'always'; // 'auto' hides when empty
  };
  content: {
    showIcon: boolean;
    showCount: boolean;
    showTotal: boolean;
    icon: string;
  };
  styling: {
    backgroundColor: string;
    borderRadius: string;
    padding: string;
    shadow: string;
    hoverShadow: string;
  };
  badge: {
    backgroundColor: string;
    textColor: string;
    size: number;
    fontSize: number;
    fontWeight: number;
  };
  total: {
    fontSize: number;
    fontWeight: number;
    color: string;
  };
  animation: {
    enablePulse: boolean;
    pulseScale: number;
    pulseDuration: number;
    transition: string;
  };
  interactions: {
    onClick: string;
    hover: string;
    active: string;
  };
  accessibility: AccessibilityConfig;
}

export interface VegToggleOption {
  id: string;
  label: string;
  icon: string | null;
  filter: string | null;
  default: boolean;
}

export interface VegToggleComponent extends BaseComponent {
  type: 'veg-toggle';
  layout: {
    position: 'category-header' | 'top-header' | 'search-bar';
    alignment: 'left' | 'right' | 'center';
  };
  options: VegToggleOption[];
  styling: {
    container: {
      backgroundColor: string;
      borderRadius: string;
      padding: string;
      gap: string;
    };
    option: {
      padding: string;
      borderRadius: string;
      fontSize: number;
      fontWeight: number;
      color: string;
      transition: string;
    };
    active: {
      backgroundColor: string;
      boxShadow: string;
    };
    hover: {
      backgroundColor: string;
    };
  };
  behavior: {
    filterMode: 'client-side' | 'server-side';
    animateTransition: boolean;
    persistSelection: boolean;
    localStorageKey: string;
  };
  interactions: {
    onClick: string;
    keyboardShortcut: string;
  };
  accessibility: AccessibilityConfig;
}

// ============================================================================
// Layout Types
// ============================================================================

export interface HomeLayoutConfig {
  type: 'home';
  header: {
    showLogo: boolean;
    showLocation: boolean;
    showNotifications: boolean;
    sticky: boolean;
    backgroundColor: string;
  };
  searchBar: {
    placeholder: string;
    showVoiceButton: boolean;
    showFilters: boolean;
    sticky: boolean;
  };
  promoCarousel: {
    show: boolean;
    height: string;
    autoPlay: boolean;
  };
  categoryPills: {
    show: boolean;
    style: 'pills' | 'icons' | 'cards';
    scrollable: boolean;
    sticky: boolean;
  };
  restaurantGrid: {
    variant: 'grid' | 'list';
    columns: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
    gap: string;
    infiniteScroll: boolean;
    pullToRefresh: boolean;
  };
  bottomNav: {
    show: boolean;
    position: 'fixed' | 'sticky';
    showLabels: boolean;
  };
  voiceFAB: {
    show: boolean;
    position: 'bottom-right' | 'bottom-center' | 'floating';
    size: 'sm' | 'md' | 'lg';
  };
}

export interface OrderTrackingLayoutConfig {
  type: 'order-tracking';
  layout: 'fullscreen' | 'overlay';
  mapView: {
    show: boolean;
    height: string;
    showRoute: boolean;
    showDriverLocation: boolean;
    showRestaurantLocation: boolean;
    showDeliveryLocation: boolean;
  };
  orderProgress: {
    position: 'top' | 'bottom' | 'overlay';
    variant: 'compact' | 'detailed';
  };
  driverCard: {
    show: boolean;
    position: 'bottom' | 'floating';
  };
  orderSummary: {
    show: boolean;
    expandable: boolean;
    showItems: boolean;
    showPricing: boolean;
  };
  actions: {
    showCallDriver: boolean;
    showChatDriver: boolean;
    showHelp: boolean;
    showCancel: boolean;
  };
  realTimeUpdates: {
    enabled: boolean;
    pushNotifications: boolean;
    soundAlerts: boolean;
  };
}

export interface RestaurantDetailLayoutConfig {
  type: 'restaurant-detail';
  header: {
    type: 'image' | 'minimal';
    height: string;
    showBackButton: boolean;
    showShareButton: boolean;
    showFavoriteButton: boolean;
    overlay: boolean;
  };
  restaurantInfo: {
    showRating: boolean;
    showReviewCount: boolean;
    showCuisine: boolean;
    showDeliveryInfo: boolean;
    showPromo: boolean;
  };
  menuCategories: {
    type: 'tabs' | 'pills' | 'sidebar';
    sticky: boolean;
    showIcons: boolean;
    scrollable: boolean;
  };
  menuItems: {
    layout: 'grid' | 'list';
    columns: {
      mobile: number;
      tablet: number;
    };
    showImages: boolean;
    showDescription: boolean;
    showPrice: boolean;
    showCustomization: boolean;
  };
  cart: {
    type: 'sheet' | 'floating' | 'fixed';
    position: 'bottom' | 'side';
    showItemCount: boolean;
    showTotal: boolean;
    pulseOnAdd: boolean;
  };
}

// ============================================================================
// Interaction Types
// ============================================================================

export interface VoiceCommandGroup {
  triggers: string[];
  action: string;
  feedback: string;
  visualIndicator: boolean;
}

export interface GrabFoodInteractions {
  voiceCommands: {
    browse: VoiceCommandGroup[];
    order: VoiceCommandGroup[];
    tracking: VoiceCommandGroup[];
    navigation: VoiceCommandGroup[];
  };
  gestures: {
    swipeToRemove: boolean;
    pullToRefresh: boolean;
    pinchToZoom: boolean;
    longPressForDetails: boolean;
  };
  haptics: {
    enabled: boolean;
    intensity: 'light' | 'medium' | 'heavy';
    events: {
      addToCart: boolean;
      removeFromCart: boolean;
      voiceActivation: boolean;
      error: boolean;
    };
  };
  keyboard: Record<string, string>;
}

// ============================================================================
// Accessibility Types
// ============================================================================

export interface ThemeAccessibilityConfig {
  wcagLevel: 'A' | 'AA' | 'AAA';
  contrastRatios: {
    normal: number;
    large: number;
  };
  keyboardNav: {
    enabled: boolean;
    showFocusIndicators: boolean;
    skipLinks: boolean;
  };
  screenReader: {
    announceChanges: boolean;
    liveRegions: boolean;
    ariaLabels: boolean;
  };
  voiceAccessibility: {
    alternativeInputMethods: boolean;
    visualFeedback: boolean;
    errorRecovery: boolean;
  };
}

// ============================================================================
// Main Theme Type
// ============================================================================

export interface GrabFoodComponents {
  menuItemCard: MenuItemCardComponent; // Primary component for single restaurant
  promoCarousel: PromoCarouselComponent;
  orderTracker: OrderTrackerComponent;
  bottomNav: BottomNavComponent;
  searchBar: SearchBarComponent;
  voiceFAB: VoiceFABComponent;
  cartPill?: CartPillComponent; // Floating cart widget
  vegToggle?: VegToggleComponent; // Dietary filter toggle
  restaurantCard?: RestaurantCardComponent; // Optional: deprecated, for multi-restaurant scenarios
  [key: string]: BaseComponent | undefined;
}

export interface GrabFoodTheme {
  version: string;
  meta: ThemeMeta;
  designTokens: GrabFoodDesignTokens;
  layouts: {
    home: HomeLayoutConfig;
    orderTracking: OrderTrackingLayoutConfig;
    restaurantDetail: RestaurantDetailLayoutConfig;
  };
  components: GrabFoodComponents;
  interactions: GrabFoodInteractions;
  accessibility: ThemeAccessibilityConfig;
  customCSS?: string;
}
