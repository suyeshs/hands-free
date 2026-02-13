/**
 * Multimodal Restaurant Theme - Type Definitions
 *
 * Comprehensive type system for restaurant ordering interfaces with
 * support for both voice-assisted and standard browsing workflows.
 * Built on neumorphic design principles with Tailwind CSS.
 */

import type { NeumorphicComponent, MultimodalInteraction } from '../neumorphic/types';

/**
 * Main theme structure for multimodal restaurant interfaces
 */
export interface MultimodalRestaurantTheme {
  version: string;
  meta: ThemeMeta;

  /** Design tokens and visual system */
  designTokens: RestaurantDesignTokens;

  /** Layout configurations for different workflows */
  layouts: {
    landing: LandingLayoutConfig;
    voiceAssisted: VoiceAssistedLayoutConfig;
    standardBrowse: StandardBrowseLayoutConfig;
  };

  /** Restaurant-specific component definitions */
  components: RestaurantComponents;

  /** Interaction patterns and behaviors */
  interactions: RestaurantInteractions;

  /** Accessibility configuration */
  accessibility: AccessibilityConfig;

  /** Optional custom CSS overrides */
  customCSS?: string;
}

/**
 * Theme metadata
 */
export interface ThemeMeta {
  name: string;
  /** Display name for voice greetings (e.g., "Coorg Food Company" without "The") */
  displayName?: string;
  description?: string;
  restaurantId?: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  tags?: string[];
  /** Logo URL for branding */
  logo?: string;
  /** Favicon URL */
  favicon?: string;
}

/**
 * Restaurant-specific design tokens
 */
export interface RestaurantDesignTokens {
  colors: RestaurantColorPalette;
  typography: RestaurantTypography;
  spacing: SpacingScale;
  borderRadius: BorderRadiusScale;
  shadows: ShadowScale;
  animations: AnimationConfig;
  breakpoints: BreakpointScale;
}

/**
 * Color palette optimized for food and restaurant experiences
 */
export interface RestaurantColorPalette {
  /** Primary brand color (typically warm/appetizing) */
  primary: ColorScale;

  /** Secondary accent color */
  secondary?: ColorScale;

  /** Accent color for CTAs */
  accent: ColorScale;

  /** Background colors */
  background: {
    main: string;
    surface: string;
    elevated: string;
    gradient?: GradientConfig;
  };

  /** Text colors */
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
  };

  /** Semantic colors for dietary indicators */
  dietary: {
    veg: ColorScale;      // Green for vegetarian
    nonVeg: ColorScale;   // Red/brown for non-vegetarian
    vegan?: ColorScale;   // Dark green for vegan
    glutenFree?: ColorScale;
  };

  /** Order status colors */
  status: {
    success: ColorScale;
    warning: ColorScale;
    error: ColorScale;
    info: ColorScale;
  };

  /** Voice interaction states */
  voiceStates: {
    idle: string;
    listening: string;
    thinking: string;
    speaking: string;
  };
}

/**
 * Color scale with 11 shades (50-950)
 */
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

/**
 * Gradient configuration
 */
export interface GradientConfig {
  from: string;
  to: string;
  via?: string;
  direction: 'to-r' | 'to-l' | 'to-t' | 'to-b' | 'to-tr' | 'to-tl' | 'to-br' | 'to-bl';
}

/**
 * Typography system optimized for menu readability
 */
export interface RestaurantTypography {
  fontFamily: {
    sans: string[];
    serif?: string[];
    heading?: string[];
  };

  /** Font sizes with Tailwind scale */
  scale: {
    xs: string;      // 12px - Tags, badges
    sm: string;      // 14px - Captions, metadata
    base: string;    // 16px - Body text, descriptions
    lg: string;      // 18px - Item names
    xl: string;      // 20px - Section headers
    '2xl': string;   // 24px - Category headers
    '3xl': string;   // 30px - Hero text
    '4xl': string;   // 36px - Display text
  };

  /** Font weights */
  weights: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };

  /** Line heights */
  lineHeights: {
    tight: string;
    normal: string;
    relaxed: string;
    loose: string;
  };

  /** Letter spacing */
  letterSpacing?: {
    tight: string;
    normal: string;
    wide: string;
  };
}

/**
 * Spacing scale (8px base unit)
 */
export interface SpacingScale {
  unit: 'px' | 'rem';
  scale: {
    0: string;
    1: string;   // 4px
    2: string;   // 8px
    3: string;   // 12px
    4: string;   // 16px
    5: string;   // 20px
    6: string;   // 24px
    8: string;   // 32px
    10: string;  // 40px
    12: string;  // 48px
    16: string;  // 64px
    20: string;  // 80px
    24: string;  // 96px
  };
}

/**
 * Border radius scale
 */
export interface BorderRadiusScale {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  full: string;
}

/**
 * Shadow scale for neumorphic depth
 */
export interface ShadowScale {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
  duration: {
    fast: string;    // 150ms
    normal: string;  // 300ms
    slow: string;    // 500ms
  };
  easing: {
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    spring: string;
  };
  /** Framer Motion variants */
  motion?: MotionVariants;
}

/**
 * Framer Motion animation variants
 */
export interface MotionVariants {
  fadeIn?: MotionVariant;
  fadeOut?: MotionVariant;
  slideUp?: MotionVariant;
  slideDown?: MotionVariant;
  slideLeft?: MotionVariant;
  slideRight?: MotionVariant;
  scaleIn?: MotionVariant;
  scaleOut?: MotionVariant;
  bounce?: MotionVariant;
  pulse?: MotionVariant;
  shake?: MotionVariant;
  /** Custom variants */
  [key: string]: MotionVariant | undefined;
}

/**
 * Individual Framer Motion variant
 */
export interface MotionVariant {
  initial?: MotionState;
  animate?: MotionState;
  exit?: MotionState;
  transition?: MotionTransition;
  whileHover?: MotionState;
  whileTap?: MotionState;
  whileFocus?: MotionState;
}

/**
 * Framer Motion state (initial, animate, exit, etc.)
 */
export interface MotionState {
  opacity?: number | number[];
  scale?: number | number[];
  x?: number | string | (number | string)[];
  y?: number | string | (number | string)[];
  rotate?: number | number[];
  translateX?: number | string | (number | string)[];
  translateY?: number | string | (number | string)[];
  skewX?: number | number[];
  skewY?: number | number[];
  originX?: number | string;
  originY?: number | string;
  filter?: string | string[];
  backdropFilter?: string | string[];
  boxShadow?: string | string[];
  [key: string]: any;
}

/**
 * Framer Motion transition configuration
 */
export interface MotionTransition {
  duration?: number;
  delay?: number;
  ease?: string | number[];
  type?: 'tween' | 'spring' | 'inertia';
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocity?: number;
  restDelta?: number;
  restSpeed?: number;
  repeat?: number;
  repeatType?: 'loop' | 'reverse' | 'mirror';
  repeatDelay?: number;
  when?: 'beforeChildren' | 'afterChildren';
  delayChildren?: number;
  staggerChildren?: number;
  staggerDirection?: 1 | -1;
}

/**
 * Responsive breakpoints
 */
export interface BreakpointScale {
  sm: string;   // 640px - Mobile
  md: string;   // 768px - Tablet
  lg: string;   // 1024px - Desktop
  xl: string;   // 1280px - Large desktop
  '2xl': string; // 1536px - XL desktop
}

/**
 * Landing page layout configuration
 */
export interface LandingLayoutConfig {
  type: 'two-path' | 'menu-first' | 'hero';

  /** Two-path choice cards */
  choiceCards?: {
    voice: ChoiceCardConfig;
    standard: ChoiceCardConfig;
  };

  /** Hero section configuration */
  hero?: {
    showLogo: boolean;
    showTagline: boolean;
    backgroundImage?: string;
    height: 'sm' | 'md' | 'lg' | 'full';
  };

  /** Quick stats/features */
  features?: {
    show: boolean;
    items: FeatureItem[];
  };
}

/**
 * Choice card configuration for landing page
 */
export interface ChoiceCardConfig {
  label: string;
  description: string;
  icon?: string;
  gradient: GradientConfig;
  benefits: string[];
}

/**
 * Feature item for landing page
 */
export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

/**
 * Voice-assisted layout configuration
 */
export interface VoiceAssistedLayoutConfig {
  type: 'split-view' | 'overlay' | 'immersive';

  /** Voice panel configuration (for split-view) */
  voicePanel?: {
    width: 'narrow' | 'medium' | 'wide';  // 30%, 40%, 50%
    position: 'left' | 'right';
    showTranscript: boolean;
    showCartSummary: boolean;
  };

  /** Voice orb configuration */
  voiceOrb: VoiceOrbConfig;

  /** Visual feed configuration */
  visualFeed: {
    showCategories: boolean;
    highlightMentioned: boolean;
    autoScroll: boolean;
    gridColumns: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
  };

  /** Display modal for dish details */
  dishModal: {
    position: 'center' | 'bottom' | 'side';
    size: 'sm' | 'md' | 'lg';
    backdrop: 'blur' | 'dark' | 'light';
  };
}

/**
 * Voice orb configuration
 */
export interface VoiceOrbConfig {
  size: 'sm' | 'md' | 'lg';  // 64px, 80px, 96px
  position: 'bottom-center' | 'bottom-right' | 'floating';
  showLabel: boolean;
  showVisualizer: boolean;
  pulseAnimation: 'subtle' | 'medium' | 'strong';
}

/**
 * Standard browse layout configuration
 */
export interface StandardBrowseLayoutConfig {
  type: 'grid' | 'magazine' | 'tabbed';

  /** Category navigation */
  categoryNav: {
    type: 'tabs' | 'carousel' | 'sidebar' | 'dropdown';
    position: 'top' | 'left' | 'sticky';
    showIcons: boolean;
    showCount: boolean;
  };

  /** Menu grid configuration */
  menuGrid: {
    columns: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
    gap: string;
    cardSize: 'compact' | 'comfortable' | 'spacious';
  };

  /** Filters configuration */
  filters: {
    show: boolean;
    position: 'sidebar' | 'top' | 'modal';
    options: FilterOption[];
  };

  /** Search configuration */
  search: {
    show: boolean;
    position: 'header' | 'top' | 'floating';
    placeholder: string;
  };
}

/**
 * Filter option for menu browsing
 */
export interface FilterOption {
  type: 'dietary' | 'price' | 'rating' | 'spice' | 'category';
  label: string;
  enabled: boolean;
}

/**
 * Restaurant-specific component definitions
 */
export interface RestaurantComponents {
  menuCard: MenuCardComponent;
  comboCard: ComboCardComponent;
  cartIsland: CartIslandComponent;
  voiceOrb: VoiceOrbComponent;
  categoryCarousel: CategoryCarouselComponent;
  orderProgress: OrderProgressComponent;
  dishModal: DishModalComponent;
  cart: CartComponent;
  /** Hero section promo carousel (top of page) */
  promoCarousel?: PromoCarouselComponent;
  /** Inline promo carousel (below category pills) */
  inlinePromoCarousel?: PromoCarouselComponent;
  /** Marketing carousel for offers, deals, and communications */
  marketingCarousel?: PromoCarouselComponent;
}

/**
 * Menu card component configuration
 */
export interface MenuCardComponent extends Omit<NeumorphicComponent, 'type'> {
  type: 'menu-card';

  /** Card layout */
  layout: {
    imageHeight: string;
    showImage: boolean;
    showRating: boolean;
    showBadges: boolean;
    showDescription: boolean;
    showPrice: boolean;
  };

  /** Image configuration */
  image?: {
    aspectRatio: string;
    objectFit: 'cover' | 'contain';
    placeholder: string;
    lazyLoad: boolean;
  };

  /** Badge configuration */
  badges?: {
    bestseller: BadgeStyle;
    new: BadgeStyle;
    spicy: BadgeStyle;
    dietary: BadgeStyle;
  };

  /** Price display */
  priceDisplay: {
    position: 'header' | 'footer';
    size: 'sm' | 'md' | 'lg';
    showCurrency: boolean;
  };

  /** Action button */
  actionButton: {
    type: 'add' | 'quick-add' | 'quantity';
    style: 'primary' | 'secondary' | 'ghost';
  };
}

/**
 * Badge style configuration
 */
export interface BadgeStyle {
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  icon?: string;
}

/**
 * Combo card component configuration
 */
export interface ComboCardComponent extends MenuCardComponent {
  type: 'combo-card';

  /** Choice selection */
  choiceSelection: {
    display: 'inline' | 'expandable' | 'modal';
    style: 'radio' | 'dropdown' | 'cards';
    showImages: boolean;
  };
}

/**
 * Cart island component configuration
 */
export interface CartIslandComponent extends Omit<NeumorphicComponent, 'type'> {
  type: 'cart-island';

  position: 'bottom-left' | 'bottom-right' | 'top-right';
  size: 'sm' | 'md' | 'lg';
  showItemCount: boolean;
  showTotal: boolean;
  pulseOnAdd: boolean;
  expandBehavior: 'click' | 'hover';
}

/**
 * Voice orb component configuration
 */
export interface VoiceOrbComponent extends Omit<NeumorphicComponent, 'type'> {
  type: 'voice-orb';

  size: number;  // Diameter in px
  visualizer: {
    type: 'circular' | 'waveform' | 'spectrum';
    bars: number;
    sensitivity: number;
  };

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

/**
 * Category carousel component configuration
 */
export interface CategoryCarouselComponent extends Omit<NeumorphicComponent, 'type'> {
  type: 'category-carousel';

  layout: 'horizontal' | 'vertical';
  itemStyle: 'pills' | 'cards' | 'tabs';
  showIcons: boolean;
  showCount: boolean;
  scrollBehavior: 'snap' | 'smooth' | 'momentum';
  activeIndicator: 'underline' | 'background' | 'border';
}

/**
 * Order progress component configuration
 */
export interface OrderProgressComponent extends Omit<NeumorphicComponent, 'type'> {
  type: 'order-progress';

  position: 'top-right' | 'top-left' | 'bottom-right';
  size: number;  // Diameter in px
  steps: ProgressStep[];
  showLabel: boolean;
  showPercentage: boolean;
}

/**
 * Progress step configuration
 */
export interface ProgressStep {
  id: string;
  label: string;
  icon?: string;
}

/**
 * Dish modal component configuration
 */
export interface DishModalComponent extends Omit<NeumorphicComponent, 'type'> {
  type: 'dish-modal';

  layout: 'detailed' | 'quick-view' | 'voice-card';
  showNutritionInfo: boolean;
  showIngredients: boolean;
  showAllergens: boolean;
  showCustomization: boolean;
  imageSize: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Cart component configuration
 */
export interface CartComponent extends Omit<NeumorphicComponent, 'type'> {
  type: 'cart';

  layout: 'list' | 'grid';
  itemDisplay: {
    showImage: boolean;
    showPrice: boolean;
    showCustomization: boolean;
    allowEdit: boolean;
  };

  summary: {
    showSubtotal: boolean;
    showTax: boolean;
    showDelivery: boolean;
    showDiscount: boolean;
  };

  emptyState: {
    icon: string;
    message: string;
    ctaText: string;
  };
}

/**
 * Promotional carousel component configuration
 */
export interface PromoCarouselComponent extends Omit<NeumorphicComponent, 'type'> {
  type: 'promo-carousel';

  /** Carousel layout configuration */
  layout: {
    height: string;
    aspectRatio?: string;
    gap: string;
    position: 'top' | 'bottom' | 'hero' | 'inline';
  };

  /** Auto-play configuration */
  autoPlay: {
    enabled: boolean;
    interval: number;  // milliseconds
    pauseOnHover: boolean;
  };

  /** Navigation indicators */
  indicators: {
    show: boolean;
    position: 'bottom-center' | 'bottom-left' | 'bottom-right';
    style: 'dots' | 'lines' | 'numbers';
    activeColor: string;
    inactiveColor: string;
  };

  /** Navigation arrows */
  navigation: {
    showArrows: boolean;
    showOnHover: boolean;
    arrowStyle: 'circle' | 'square' | 'minimal';
  };

  /** Gesture support */
  gestures: {
    swipe: boolean;
    momentum: boolean;
  };

  /** Promotional items */
  items: PromoItem[];
}

/**
 * Individual promotional item
 */
export interface PromoItem {
  id: string;
  type: 'voice-promo' | 'special' | 'announcement' | 'offer';
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  image?: string;
  backgroundColor: string;
  textColor: string;
  accentColor?: string;
  gradient?: GradientConfig;
  action?: {
    type: 'link' | 'action' | 'modal';
    target: string;
    label?: string;
  };
  badge?: {
    text: string;
    color: string;
  };
}

/**
 * Restaurant-specific interactions
 */
export interface RestaurantInteractions {
  /** Voice commands for common actions */
  voiceCommands: VoiceCommandSet;

  /** Gesture interactions */
  gestures: GestureSet;

  /** Haptic feedback configuration */
  haptics: HapticConfig;

  /** Keyboard shortcuts */
  keyboard: KeyboardShortcutSet;
}

/**
 * Voice command set for restaurant ordering
 */
export interface VoiceCommandSet {
  /** Browse commands */
  browse: VoiceCommand[];

  /** Order commands */
  order: VoiceCommand[];

  /** Cart commands */
  cart: VoiceCommand[];

  /** Navigation commands */
  navigation: VoiceCommand[];
}

/**
 * Voice command definition
 */
export interface VoiceCommand {
  triggers: string[];
  action: string;
  feedback: string;
  visualIndicator?: boolean;
}

/**
 * Gesture set
 */
export interface GestureSet {
  swipeToRemove: boolean;
  pullToRefresh: boolean;
  pinchToZoom: boolean;
  longPressForDetails: boolean;
}

/**
 * Haptic feedback configuration
 */
export interface HapticConfig {
  enabled: boolean;
  intensity: 'light' | 'medium' | 'heavy';
  events: {
    addToCart: boolean;
    removeFromCart: boolean;
    voiceActivation: boolean;
    error: boolean;
  };
}

/**
 * Keyboard shortcut set
 */
export interface KeyboardShortcutSet {
  search: string;
  cart: string;
  voiceActivate: string;
  prevCategory: string;
  nextCategory: string;
}

/**
 * Accessibility configuration
 */
export interface AccessibilityConfig {
  /** WCAG compliance level */
  wcagLevel: 'A' | 'AA' | 'AAA';

  /** Minimum contrast ratios */
  contrastRatios: {
    normal: number;    // 4.5:1 for AA
    large: number;     // 3:1 for AA
  };

  /** Keyboard navigation */
  keyboardNav: {
    enabled: boolean;
    showFocusIndicators: boolean;
    skipLinks: boolean;
  };

  /** Screen reader support */
  screenReader: {
    announceChanges: boolean;
    liveRegions: boolean;
    ariaLabels: boolean;
  };

  /** Voice accessibility */
  voiceAccessibility: {
    alternativeInputMethods: boolean;
    visualFeedback: boolean;
    errorRecovery: boolean;
  };
}

/**
 * Export helper types
 */
export type LayoutMode = 'landing' | 'voice-assisted' | 'standard-browse';
export type ThemeVariant = 'light' | 'dark';
export type RestaurantCategory = 'combos' | 'appetizers' | 'mains' | 'sides' | 'desserts' | 'beverages';
