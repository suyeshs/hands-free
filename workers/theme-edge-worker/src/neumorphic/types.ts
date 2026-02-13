/**
 * Neumorphic Component Type System
 * Complete type definitions for neumorphic multimodal components
 * Based on LDSG (LINE Design System Guidelines) principles
 */

// ============================================================================
// Core Neumorphic Primitives
// ============================================================================

/**
 * Light source direction for shadow casting
 */
export type LightSource = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Shadow configuration for neumorphic effects
 */
export interface NeumorphicShadow {
  /** Light source direction */
  lightSource: LightSource;
  /** Shadow depth (1-10, 5 is medium) */
  depth: number;
  /** Whether shadow is inset (pressed) or outset (raised) */
  inset: boolean;
  /** Base color for shadow */
  color: string;
  /** Blur radius in pixels */
  blurRadius: number;
  /** Spread radius in pixels */
  spreadRadius: number;
  /** Opacity (0-1) */
  opacity: number;
}

/**
 * Complete dual-shadow system for neumorphic depth
 */
export interface NeumorphicShadows {
  /** Light highlight shadow */
  light: NeumorphicShadow;
  /** Dark depth shadow */
  dark: NeumorphicShadow;
}

/**
 * Surface configuration for neumorphic elements
 */
export interface NeumorphicSurface {
  /** Base background color */
  backgroundColor: string;
  /** Border configuration */
  border?: {
    width: number;
    color: string;
    style: 'solid' | 'dashed' | 'dotted';
  };
  /** Border radius */
  borderRadius: number | { topLeft: number; topRight: number; bottomLeft: number; bottomRight: number };
  /** Shadow system */
  shadows: NeumorphicShadows;
  /** Optional gradient overlay */
  gradient?: {
    type: 'linear' | 'radial';
    from: string;
    to: string;
    angle?: number; // for linear
  };
}

// ============================================================================
// Multimodal Interaction Types
// ============================================================================

/**
 * Supported interaction modalities
 */
export type ModalityType = 'touch' | 'voice' | 'gesture' | 'keyboard';

/**
 * Voice command configuration
 */
export interface VoiceCommand {
  /** Trigger phrases (e.g., ["open", "activate"]) */
  triggers: string[];
  /** Voice feedback message */
  feedback: string;
  /** Whether to show visual indicator during voice input */
  visualIndicator: boolean;
}

/**
 * Gesture configuration
 */
export interface GestureConfig {
  /** Gesture type */
  type: 'tap' | 'long-press' | 'swipe' | 'pinch' | 'rotate' | 'drag' | 'wave' | 'custom';
  /** Direction (for swipe) */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Minimum threshold */
  threshold?: number;
  /** Custom gesture description (for camera-based) */
  description?: string;
}

/**
 * Touch interaction configuration
 */
export interface TouchConfig {
  /** Touch area padding for accessibility */
  minTouchSize: { width: number; height: number };
  /** Haptic feedback type */
  haptic?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
  /** Touch delay (for preventing accidental touches) */
  delay?: number;
}

/**
 * Complete multimodal interaction definition
 */
export interface MultimodalInteraction {
  /** Primary modality */
  primary: ModalityType;
  /** Additional supported modalities */
  alternatives: ModalityType[];
  /** Touch configuration */
  touch?: TouchConfig;
  /** Voice commands */
  voice?: VoiceCommand[];
  /** Gesture configuration */
  gesture?: GestureConfig[];
  /** Keyboard shortcuts */
  keyboard?: {
    key: string;
    modifiers?: Array<'ctrl' | 'alt' | 'shift' | 'meta'>;
  }[];
}

// ============================================================================
// Component State System
// ============================================================================

/**
 * Visual state of a component
 */
export type ComponentState = 'default' | 'hover' | 'active' | 'pressed' | 'focused' | 'disabled' | 'loading' | 'error' | 'success';

/**
 * State-specific styling
 */
export interface StateStyle {
  /** Surface configuration for this state (neumorphic style) */
  surface?: NeumorphicSurface;
  /** Text color */
  textColor?: string;
  /** Icon color */
  iconColor?: string;
  /** Opacity */
  opacity?: number;
  /** Scale transformation */
  scale?: number;
  /** Translation */
  translate?: { x: number; y: number };
  /** Rotation (degrees) */
  rotate?: number;
  /** Transform CSS */
  transform?: string;
  /** Custom CSS properties */
  custom?: Record<string, string | number>;

  /** Alternative simplified color structure (for multimodal-restaurant) */
  colors?: {
    background: string;
    text: string;
    border?: string;
  };
  /** Alternative simplified shadow structure */
  shadows?: {
    outer: string;
    inner: string;
  };
  /** Alternative simplified border structure */
  border?: {
    width: string;
    style: string;
    radius?: string;
  };
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
  /** Animation duration in milliseconds */
  duration: number;
  /** Timing function */
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | 'bounce';
  /** Delay before animation starts */
  delay?: number;
  /** Spring configuration (if easing is 'spring') */
  spring?: {
    stiffness: number;
    damping: number;
    mass: number;
  };
}

/**
 * State transition definition
 */
export interface StateTransition {
  /** Source state */
  from: ComponentState;
  /** Target state */
  to: ComponentState;
  /** Animation configuration */
  animation: AnimationConfig;
  /** Whether this transition triggers haptic feedback */
  haptic?: boolean;
  /** Whether this transition triggers audio feedback */
  audio?: {
    file: string;
    volume: number;
  };
}

// ============================================================================
// Typography & Content
// ============================================================================

/**
 * Typography configuration
 */
export interface NeumorphicTypography {
  /** Font family */
  fontFamily: string;
  /** Font size */
  fontSize: number | string;
  /** Font weight */
  fontWeight: 300 | 400 | 500 | 600 | 700 | 800 | 900;
  /** Line height */
  lineHeight: number | string;
  /** Letter spacing */
  letterSpacing?: number | string;
  /** Text transform */
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  /** Text shadow for depth */
  textShadow?: string;
}

/**
 * Icon configuration
 */
export interface IconConfig {
  /** Icon name/identifier */
  name: string;
  /** Icon size */
  size: number;
  /** Icon color (can override component color) */
  color?: string;
  /** Icon position relative to text */
  position?: 'left' | 'right' | 'top' | 'bottom';
  /** Spacing from text */
  spacing?: number;
}

// ============================================================================
// Layout & Spacing
// ============================================================================

/**
 * Spacing configuration
 */
export interface Spacing {
  /** Top padding/margin */
  top: number;
  /** Right padding/margin */
  right: number;
  /** Bottom padding/margin */
  bottom: number;
  /** Left padding/margin */
  left: number;
}

/**
 * Dimension configuration
 */
export interface Dimensions {
  /** Width (number for pixels, string for %, auto, etc.) */
  width: number | string;
  /** Height (number for pixels, string for %, auto, etc.) */
  height: number | string;
  /** Min width */
  minWidth?: number | string;
  /** Min height */
  minHeight?: number | string;
  /** Max width */
  maxWidth?: number | string;
  /** Max height */
  maxHeight?: number | string;
}

/**
 * Flex/Grid layout configuration
 */
export interface LayoutConfig {
  /** Display type */
  display: 'flex' | 'grid' | 'block' | 'inline-block';
  /** Flex direction (if display is flex) */
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  /** Align items */
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  /** Justify content */
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  /** Gap between children */
  gap?: number;
  /** Grid template columns (if display is grid) */
  gridTemplateColumns?: string;
  /** Grid template rows (if display is grid) */
  gridTemplateRows?: string;
}

// ============================================================================
// Accessibility
// ============================================================================

/**
 * Accessibility configuration
 */
export interface AccessibilityConfig {
  /** ARIA label (neumorphic style) */
  label?: string;
  /** ARIA label (alternative style) */
  ariaLabel?: string;
  /** ARIA role */
  role: string;
  /** ARIA description */
  description?: string;
  /** Focusable via keyboard */
  focusable?: boolean;
  /** Tab index */
  tabIndex?: number;
  /** Live region announcements */
  liveRegion?: 'polite' | 'assertive' | 'off';
  /** Minimum color contrast ratio (4.5:1 for AA, 7:1 for AAA) */
  minContrast?: number;
  /** Alternative text for screen readers */
  altText?: string;
  /** Keyboard navigable (multimodal-restaurant style) */
  keyboardNavigable?: boolean;
  /** Screen reader text (multimodal-restaurant style) */
  screenReaderText?: string;
}

// ============================================================================
// Complete Component Definition
// ============================================================================

/**
 * Base component type
 */
export type ComponentType =
  | 'button'
  | 'input'
  | 'card'
  | 'modal'
  | 'navigation-bar'
  | 'fab'
  | 'toggle'
  | 'slider'
  | 'list'
  | 'list-item'
  | 'toast'
  | 'tooltip'
  | 'text-field'
  | 'header'
  | 'footer'
  | 'panel'
  | 'drawer'
  | 'tab'
  | 'custom';

/**
 * Complete neumorphic component configuration
 */
export interface NeumorphicComponent {
  /** Unique component ID */
  id: string;
  /** Component name */
  name: string;
  /** Component type */
  type: ComponentType;
  /** Human-readable description */
  description: string;
  /** Component category (for organization) */
  category: 'input' | 'navigation' | 'content' | 'feedback' | 'layout' | 'action';

  // Visual
  /** Dimensions */
  dimensions: Dimensions;
  /** Padding */
  padding: Spacing;
  /** Margin */
  margin: Spacing;
  /** Typography */
  typography: NeumorphicTypography;
  /** Icon configuration */
  icon?: IconConfig;

  // States
  /** All available states with their styling */
  states: Record<ComponentState, StateStyle>;
  /** State transitions */
  transitions: StateTransition[];
  /** Default state */
  defaultState: ComponentState;

  // Interaction
  /** Multimodal interaction configuration */
  interaction: MultimodalInteraction;
  /** Whether component is interactive */
  interactive?: boolean;

  // Layout
  /** Layout configuration (if container) */
  layout?: LayoutConfig;
  /** Child components */
  children?: NeumorphicComponent[];

  // Accessibility
  /** Accessibility configuration */
  accessibility: AccessibilityConfig;

  // Metadata
  /** Platform (web, mobile, both) */
  platform: 'web' | 'mobile' | 'both';
  /** Framework compatibility */
  frameworks: Array<'react' | 'react-native' | 'flutter' | 'swift' | 'kotlin'>;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Version */
  version: string;
  /** Tags for search/filter */
  tags: string[];
}

// ============================================================================
// Component Library
// ============================================================================

/**
 * Complete component library
 */
export interface ComponentLibrary {
  /** Library ID */
  id: string;
  /** Library name */
  name: string;
  /** Description */
  description: string;
  /** Brand/app info */
  brand?: {
    name: string;
    industry: string;
    values: string[];
    targetAudience: string;
  };
  /** All components in library */
  components: NeumorphicComponent[];
  /** Theme reference (links to theme system) */
  themeId?: string;
  /** Global design tokens */
  tokens: {
    colors: Record<string, string>;
    spacing: Record<string, number>;
    borderRadius: Record<string, number>;
    shadows: Record<string, NeumorphicShadows>;
    typography: Record<string, NeumorphicTypography>;
  };
  /** Metadata */
  meta: {
    author: string;
    createdAt: string;
    updatedAt: string;
    version: string;
    license?: string;
  };
}

// ============================================================================
// Layout System
// ============================================================================

/**
 * Screen layout definition
 */
export interface ScreenLayout {
  /** Layout ID */
  id: string;
  /** Layout name */
  name: string;
  /** Screen description */
  description: string;
  /** Platform */
  platform: 'web' | 'mobile';
  /** Viewport dimensions */
  viewport: {
    width: number;
    height: number;
    orientation: 'portrait' | 'landscape';
  };
  /** Layout structure */
  structure: {
    /** Header component */
    header?: NeumorphicComponent;
    /** Main content area */
    content: NeumorphicComponent[];
    /** Footer component */
    footer?: NeumorphicComponent;
    /** Floating action button */
    fab?: NeumorphicComponent;
    /** Navigation bar */
    navigation?: NeumorphicComponent;
  };
  /** Responsive breakpoints */
  breakpoints?: Array<{
    minWidth: number;
    maxWidth?: number;
    changes: Partial<ScreenLayout>;
  }>;
  /** Metadata */
  meta: {
    createdAt: string;
    updatedAt: string;
  };
}

// ============================================================================
// Generation Requests
// ============================================================================

/**
 * Component generation request
 */
export interface ComponentGenerationRequest {
  /** Natural language description */
  prompt: string;
  /** Component type hint */
  type?: ComponentType;
  /** Platform target */
  platform: 'web' | 'mobile' | 'both';
  /** Style preferences */
  style?: {
    depth?: number; // 1-10
    lightSource?: LightSource;
    primaryColor?: string;
    textColor?: string;
  };
  /** Multimodal requirements */
  modalities?: ModalityType[];
  /** Accessibility target */
  accessibility?: 'wcag-aa' | 'wcag-aaa';
  /** Existing theme context */
  themeId?: string;
}

/**
 * Library generation request
 */
export interface LibraryGenerationRequest {
  /** App/brand description */
  prompt: string;
  /** Brand information */
  brand?: {
    name: string;
    industry: string;
    values?: string[];
    targetAudience?: string;
  };
  /** Platform */
  platform: 'web' | 'mobile' | 'both';
  /** Number of components to generate */
  componentCount?: number;
  /** Component types to include */
  componentTypes?: ComponentType[];
  /** Style preferences */
  style?: {
    depth?: number;
    lightSource?: LightSource;
    colorScheme?: 'light' | 'dark' | 'auto';
  };
}

/**
 * Layout generation request
 */
export interface LayoutGenerationRequest {
  /** Screen description */
  prompt: string;
  /** Platform */
  platform: 'web' | 'mobile';
  /** Viewport size */
  viewport?: {
    width: number;
    height: number;
  };
  /** Required sections */
  sections?: Array<'header' | 'footer' | 'navigation' | 'fab'>;
  /** Component library to use */
  libraryId?: string;
}

// ============================================================================
// Export System
// ============================================================================

/**
 * Code export configuration
 */
export interface ExportConfig {
  /** Target framework */
  framework: 'react' | 'react-native' | 'flutter' | 'swift' | 'kotlin';
  /** Include TypeScript types */
  typescript: boolean;
  /** Include component tests */
  includeTests: boolean;
  /** Include documentation */
  includeDocs: boolean;
  /** Include storybook stories */
  includeStories: boolean;
  /** CSS approach */
  cssApproach: 'styled-components' | 'emotion' | 'tailwind' | 'css-modules' | 'inline';
  /** Package format */
  packageFormat: 'npm' | 'yarn' | 'single-file';
}

/**
 * Exported component code
 */
export interface ExportedCode {
  /** Component file code */
  component: string;
  /** Type definitions */
  types?: string;
  /** Styles file */
  styles?: string;
  /** Test file */
  tests?: string;
  /** Documentation */
  docs?: string;
  /** Storybook stories */
  stories?: string;
  /** Dependencies */
  dependencies: Record<string, string>;
  /** Dev dependencies */
  devDependencies: Record<string, string>;
}
