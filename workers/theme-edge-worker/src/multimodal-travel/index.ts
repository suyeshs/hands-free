/**
 * Multimodal Travel Theme
 * UI theme system for travel booking applications
 *
 * @version 1.0.0
 * @author Stonepot Platform
 * @license MIT
 *
 * @features
 * - Voice-first booking interface components
 * - Airbnb-inspired design system
 * - Flight, hotel, and package UI components
 * - Itinerary planning interface
 * - Multimodal interaction patterns (voice, touch, gestures, keyboard)
 * - WCAG AA accessibility
 * - Responsive design
 *
 * @note
 * This theme contains only UI components and styling.
 * API integration (e.g., Amadeus) should be implemented in your main application.
 */

// ===========================
// Type Exports
// ===========================

export type {
  // Core data types
  TravelCategory,
  FlightClass,
  Airport,
  Airline,
  FlightSegment,
  Flight,
  HotelAmenity,
  Hotel,
  Experience,
  Package,
  ItineraryItem,
  Itinerary,

  // Component types
  FlightCardConfig,
  FlightCardDisplayMode,
  HotelCardConfig,
  HotelCardDisplayMode,
  PackageCardConfig,
  VoiceOrbConfig,
  BookingIslandConfig,
  DestinationCarouselConfig,
  ItineraryBuilderConfig,
  TravelComponents,

  // Layout types
  LandingLayout,
  VoiceAssistedLayout,
  StandardBrowseLayout,
  TravelLayouts,

  // Voice command types
  TravelVoiceCommand,
  TravelVoiceCommands,

  // Main theme type
  MultimodalTravelTheme,

  // Search parameter types
  FlightSearchParams,
  HotelSearchParams,
  ExperienceSearchParams,
  PackageSearchParams,
} from './types';

// ===========================
// Design Token Exports
// ===========================

export {
  RauschPinkScale,
  CleanNeutralScale,
  SkyBlueScale,
  EmeraldScale,
  AmberScale,
  RoseScale,
  PurpleScale,
  TravelCategoryColors,
  AmenityBadgeColors,
  FlightClassColors,
  VoiceStateColors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Breakpoints,
  AnimationDuration,
  ZIndex,
  TravelDesignTokens,
} from './design-tokens';

export type { TravelDesignTokens as TravelDesignTokensType } from './design-tokens';

// ===========================
// Schema & Validation Exports
// ===========================

export {
  multimodalTravelThemeSchema,
  flightSchema,
  hotelSchema,
  experienceSchema,
  packageSchema,
  validateTravelTheme,
  isValidTravelTheme,
  validateFlight,
  validateHotel,
  validateExperience,
  validatePackage,
} from './schema';

export type {
  MultimodalTravelThemeInput,
  FlightInput,
  HotelInput,
  ExperienceInput,
  PackageInput,
} from './schema';

// ===========================
// Animation Exports
// ===========================

export {
  AirbnbEasing,
  transitionPresets,
  cardVariants,
  cardListVariants,
  modalVariants,
  backdropVariants,
  bottomSheetVariants,
  voiceOrbVariants,
  voiceVisualizerBarVariants,
  fadeInVariants,
  fadeInUpVariants,
  fadeInDownVariants,
  slideInLeftVariants,
  slideInRightVariants,
  scaleInVariants,
  scaleBounceVariants,
  spinnerVariants,
  pulseVariants,
  skeletonVariants,
  notificationVariants,
  accordionVariants,
  heroVariants,
  heroTextVariants,
  tabContentVariants,
  carouselItemVariants,
  bookingIslandVariants,
  filterPanelVariants,
  TravelAnimationPresets,
} from './animation-templates';

export type { TravelAnimationPresets as TravelAnimationPresetsType } from './animation-templates';

// ===========================
// Primitive Component Exports
// ===========================

export {
  createFlightCard,
  renderFlightCard,
  getFlightCardClasses,
} from './primitives/flight-card';

export {
  createHotelCard,
  renderHotelCard,
} from './primitives/hotel-card';

export {
  createPackageCard,
  renderPackageCard,
} from './primitives/package-card';

export {
  createVoiceOrb,
  renderVoiceOrb,
} from './primitives/voice-orb';

export {
  createBookingIsland,
  renderBookingIsland,
} from './primitives/booking-island';

export {
  createDestinationCarousel,
  renderDestinationCarousel,
} from './primitives/destination-carousel';

export {
  createItineraryBuilder,
  renderItineraryBuilder,
} from './primitives/itinerary-builder';

// ===========================
// Layout Exports
// ===========================

export {
  landingLayout,
  voiceAssistedLayout,
  standardBrowseLayout,
  getLayout,
  layouts,
} from './layouts';

export type { LayoutRegistry } from './layouts';

// ===========================
// Theme Preset Exports
// ===========================

export { AmadeusTravelTheme } from './presets/amadeus-travel';

// ===========================
// Preset Registry
// ===========================

import { AmadeusTravelTheme } from './presets/amadeus-travel';
import type { MultimodalTravelTheme } from './types';

/**
 * Available travel theme presets
 */
export const TravelThemePresets: Record<string, MultimodalTravelTheme> = {
  'amadeus-travel': AmadeusTravelTheme,
  'default': AmadeusTravelTheme, // Default preset
};

/**
 * Get a travel theme preset by name
 */
export function getTravelThemePreset(name: string): MultimodalTravelTheme | null {
  return TravelThemePresets[name] || null;
}

/**
 * Get all available travel theme preset names
 */
export function getTravelThemePresetNames(): string[] {
  return Object.keys(TravelThemePresets);
}

/**
 * Check if a theme preset exists
 */
export function hasTravelThemePreset(name: string): boolean {
  return name in TravelThemePresets;
}

// ===========================
// Module Metadata
// ===========================

export const MODULE_INFO = {
  name: 'multimodal-travel',
  version: '1.0.0',
  description: 'Multimodal travel booking UI theme with Airbnb-inspired design',
  author: 'Stonepot Platform',
  license: 'MIT',
  keywords: [
    'travel',
    'booking',
    'flights',
    'hotels',
    'packages',
    'ui-theme',
    'voice-interface',
    'multimodal',
    'airbnb-design',
    'accessibility',
  ],
  features: [
    'Voice-first booking interface components',
    'Flight, hotel, and package UI cards',
    'Itinerary planning interface',
    'Airbnb-inspired design system',
    'Multimodal interaction patterns',
    'WCAG AA accessibility',
    'Responsive design',
    'Neumorphic UI components',
    'Type-safe component configs',
  ],
  frameworks: ['React', 'React Native'],
  platforms: ['Web', 'Mobile', 'PWA'],
  accessibility: 'WCAG 2.1 Level AA',
  languages: ['en', 'hi'], // English and Hindi voice commands
};

/**
 * Default export - Amadeus Travel Theme
 */
export default AmadeusTravelTheme;
