/**
 * Handsfree Tech Theme - Type Definitions
 *
 * Tech-oriented theme for modern SaaS, AI tools, and developer products
 */

import type { HandsfreeDesignTokens } from './design-tokens';

// ===========================
// Core Theme Structure
// ===========================

export interface HandsfreeTheme {
  id: string;
  name: string;
  version: string;
  description?: string;

  designTokens: typeof HandsfreeDesignTokens;
  components: HandsfreeComponents;
  layouts: HandsfreeLayouts;
  interactions: HandsfreeInteractions;
  animations: AnimationConfig;
  accessibility: AccessibilityConfig;
}

// ===========================
// Component Types
// ===========================

export interface HandsfreeComponents {
  productCard: ProductCardConfig;
  featureCard: FeatureCardConfig;
  codeBlock: CodeBlockConfig;
  terminalWindow: TerminalWindowConfig;
  voiceOrb: VoiceOrbConfig;
  gestureZone: GestureZoneConfig;
  pricingCard: PricingCardConfig;
  apiDocCard: ApiDocCardConfig;
  techSpecs: TechSpecsConfig;
  statusBadge: StatusBadgeConfig;
}

/**
 * Product Card - Showcase tech products/features
 */
export interface ProductCardConfig {
  id: string;
  name: string;
  showImage: boolean;
  imageHeight: string;
  showGradient: boolean;
  gradientType: 'holographic' | 'glass' | 'solid';
  showCTA: boolean;
  ctaStyle: 'primary' | 'secondary' | 'ghost';
  hoverEffect: 'lift' | 'glow' | 'scale' | 'none';
  borderStyle: 'solid' | 'gradient' | 'glass';
}

/**
 * Feature Card - Display product features
 */
export interface FeatureCardConfig {
  id: string;
  name: string;
  layout: 'vertical' | 'horizontal';
  iconPosition: 'top' | 'left' | 'center';
  iconSize: 'sm' | 'md' | 'lg';
  iconStyle: 'gradient' | 'solid' | 'outline';
  showAnimation: boolean;
  animationType: 'fade' | 'slide' | 'scale' | 'reveal';
}

/**
 * Code Block - Syntax highlighted code display
 */
export interface CodeBlockConfig {
  id: string;
  name: string;
  language: string;
  theme: 'dark' | 'darker' | 'light';
  showLineNumbers: boolean;
  showCopyButton: boolean;
  highlightLines?: number[];
  maxHeight?: string;
  wrapLines: boolean;
}

/**
 * Terminal Window - Command line interface display
 */
export interface TerminalWindowConfig {
  id: string;
  name: string;
  showHeader: boolean;
  showPrompt: boolean;
  promptSymbol: string;
  promptColor: string;
  typewriterEffect: boolean;
  typewriterSpeed: number;
  showCursor: boolean;
  cursorStyle: 'block' | 'line' | 'underline';
}

/**
 * Voice Orb - Voice activation UI
 */
export interface VoiceOrbConfig {
  id: string;
  name: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center';
  showWaveform: boolean;
  waveformStyle: 'circular' | 'linear' | 'radial';
  waveformBars: number;
  glowIntensity: 'low' | 'medium' | 'high';
  pulseOnActive: boolean;
  showTranscript: boolean;
  showStatus: boolean;
}

/**
 * Gesture Zone - Touch/gesture interaction areas
 */
export interface GestureZoneConfig {
  id: string;
  name: string;
  gestures: GestureType[];
  feedbackType: 'visual' | 'haptic' | 'audio' | 'all';
  sensitivity: 'low' | 'medium' | 'high';
  showHints: boolean;
  hintDuration: number;
}

export type GestureType =
  | 'swipe-left'
  | 'swipe-right'
  | 'swipe-up'
  | 'swipe-down'
  | 'pinch-zoom'
  | 'two-finger-tap'
  | 'long-press'
  | 'double-tap';

/**
 * Pricing Card - Product pricing display
 */
export interface PricingCardConfig {
  id: string;
  name: string;
  layout: 'standard' | 'compact' | 'featured';
  showBadge: boolean;
  badgeText?: string;
  badgeColor?: string;
  highlightFeatures: boolean;
  showComparison: boolean;
  ctaStyle: 'primary' | 'secondary' | 'gradient';
}

/**
 * API Documentation Card
 */
export interface ApiDocCardConfig {
  id: string;
  name: string;
  showEndpoint: boolean;
  showMethod: boolean;
  showParameters: boolean;
  showResponse: boolean;
  showExample: boolean;
  collapsible: boolean;
  syntaxHighlight: boolean;
}

/**
 * Tech Specs Display
 */
export interface TechSpecsConfig {
  id: string;
  name: string;
  layout: 'grid' | 'list' | 'table';
  showIcons: boolean;
  groupByCategory: boolean;
  highlightKey: boolean;
  comparisonMode: boolean;
}

/**
 * Status Badge
 */
export interface StatusBadgeConfig {
  id: string;
  name: string;
  style: 'dot' | 'pill' | 'outlined';
  showPulse: boolean;
  size: 'xs' | 'sm' | 'md';
  position?: 'top-left' | 'top-right' | 'inline';
}

// ===========================
// Layout Types
// ===========================

export interface HandsfreeLayouts {
  landing: LandingLayout;
  productShowcase: ProductShowcaseLayout;
  documentation: DocumentationLayout;
  voiceControl: VoiceControlLayout;
}

/**
 * Landing Layout
 */
export interface LandingLayout {
  type: 'fullscreen' | 'scroll' | 'split';
  hero: HeroConfig;
  features: FeaturesSection;
  cta: CTASection;
  scrollEffect: 'parallax' | 'fade' | 'reveal' | 'none';
}

export interface HeroConfig {
  type: 'gradient' | 'video' | 'animation' | 'static';
  height: 'viewport' | 'auto' | string;
  showParticles: boolean;
  particleCount: number;
  showGradientAnimation: boolean;
  textAnimation: 'typewriter' | 'fade' | 'slide' | 'none';
}

export interface FeaturesSection {
  layout: 'grid' | 'masonry' | 'carousel';
  columns: { mobile: number; tablet: number; desktop: number };
  gap: string;
  animateOnScroll: boolean;
  staggerDelay: number;
}

export interface CTASection {
  position: 'top' | 'middle' | 'bottom' | 'sticky';
  style: 'gradient' | 'glass' | 'solid';
  showMultiple: boolean;
}

/**
 * Product Showcase Layout
 */
export interface ProductShowcaseLayout {
  type: 'carousel' | 'grid' | 'masonry';
  filterBar: FilterBarConfig;
  sorting: SortingConfig;
  viewOptions: ('grid' | 'list' | 'compact')[];
  defaultView: 'grid' | 'list' | 'compact';
}

export interface FilterBarConfig {
  show: boolean;
  position: 'top' | 'sidebar';
  filters: string[];
  style: 'pills' | 'dropdown' | 'sidebar';
}

export interface SortingConfig {
  show: boolean;
  options: string[];
  defaultSort: string;
}

/**
 * Documentation Layout
 */
export interface DocumentationLayout {
  sidebar: SidebarConfig;
  content: ContentConfig;
  tableOfContents: TOCConfig;
  search: SearchConfig;
}

export interface SidebarConfig {
  position: 'left' | 'right';
  width: string;
  collapsible: boolean;
  sticky: boolean;
  showIcons: boolean;
}

export interface ContentConfig {
  maxWidth: string;
  showBreadcrumbs: boolean;
  showNavigation: boolean;
  codeBlockTheme: 'dark' | 'light';
}

export interface TOCConfig {
  show: boolean;
  position: 'right' | 'inline';
  levels: number;
  sticky: boolean;
}

export interface SearchConfig {
  show: boolean;
  position: 'header' | 'sidebar';
  placeholder: string;
  showShortcut: boolean;
  shortcut: string;
}

/**
 * Voice Control Layout
 */
export interface VoiceControlLayout {
  orbPosition: VoiceOrbConfig['position'];
  showTranscript: boolean;
  transcriptPosition: 'bottom' | 'top' | 'side';
  showCommands: boolean;
  commandsStyle: 'list' | 'grid' | 'carousel';
  feedbackStyle: 'minimal' | 'detailed';
}

// ===========================
// Interaction Types
// ===========================

export interface HandsfreeInteractions {
  voice: VoiceInteractions;
  gestures: GestureInteractions;
  keyboard: KeyboardShortcuts;
  scroll: ScrollInteractions;
}

export interface VoiceInteractions {
  enabled: boolean;
  wakeWord?: string;
  languages: string[];
  commands: VoiceCommand[];
  feedback: 'visual' | 'audio' | 'both';
}

export interface VoiceCommand {
  id: string;
  phrase: string[];
  action: string;
  category: 'navigation' | 'control' | 'search' | 'custom';
  confirmation: boolean;
}

export interface GestureInteractions {
  enabled: boolean;
  types: GestureType[];
  sensitivity: 'low' | 'medium' | 'high';
  feedback: 'visual' | 'haptic' | 'both';
}

export interface KeyboardShortcuts {
  [key: string]: {
    keys: string;
    action: string;
    description: string;
  };
}

export interface ScrollInteractions {
  smoothScroll: boolean;
  parallaxLayers: number;
  revealAnimations: boolean;
  progressIndicator: boolean;
  snapPoints: boolean;
}

// ===========================
// Animation Configuration
// ===========================

export interface AnimationConfig {
  enabled: boolean;
  reducedMotion: boolean;
  presets: AnimationPresets;
}

export interface AnimationPresets {
  fadeIn: AnimationKeyframes;
  fadeInUp: AnimationKeyframes;
  fadeInDown: AnimationKeyframes;
  slideInLeft: AnimationKeyframes;
  slideInRight: AnimationKeyframes;
  scaleIn: AnimationKeyframes;
  rotateIn: AnimationKeyframes;
  glowPulse: AnimationKeyframes;
  typewriter: AnimationKeyframes;
  wave: AnimationKeyframes;
  [key: string]: AnimationKeyframes;
}

export interface AnimationKeyframes {
  name: string;
  duration: string;
  easing: string;
  delay?: string;
  iterations?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate';
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

// ===========================
// Accessibility Configuration
// ===========================

export interface AccessibilityConfig {
  wcagLevel: 'A' | 'AA' | 'AAA';
  keyboardNavigation: boolean;
  screenReaderOptimized: boolean;
  focusIndicators: boolean;
  skipLinks: boolean;
  ariaLabels: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  minimumTouchTarget: string;
  contrastRatios: {
    normal: number;
    large: number;
  };
}

// ===========================
// Data Types
// ===========================

export interface TechProduct {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  image?: string;
  video?: string;
  demo?: string;
  pricing?: PricingInfo;
  features: Feature[];
  techStack: TechStack[];
  status: 'beta' | 'stable' | 'deprecated' | 'coming-soon';
  url?: string;
  github?: string;
  docs?: string;
}

export interface PricingInfo {
  model: 'free' | 'freemium' | 'subscription' | 'one-time' | 'usage-based';
  tiers: PricingTier[];
  currency: string;
}

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  period: 'month' | 'year' | 'one-time' | 'usage';
  features: string[];
  limits?: Record<string, number | string>;
  highlighted?: boolean;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon?: string;
  category?: string;
  status?: 'new' | 'beta' | 'stable';
}

export interface TechStack {
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'ai' | 'other';
  icon?: string;
  version?: string;
}

export interface CodeSnippet {
  id: string;
  language: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
  description?: string;
}

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  parameters?: ApiParameter[];
  requestBody?: object;
  responses: ApiResponse[];
  examples: CodeSnippet[];
  authentication: 'none' | 'api-key' | 'oauth' | 'bearer';
}

export interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: any;
  example?: any;
}

export interface ApiResponse {
  statusCode: number;
  description: string;
  schema?: object;
  example?: object;
}
