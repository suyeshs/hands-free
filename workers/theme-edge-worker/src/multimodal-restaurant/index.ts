/**
 * Multimodal Restaurant Theme - Main Module
 *
 * Export all types, components, layouts, and presets
 */

// Types
export * from './types';

// Design Tokens
export * from './design-tokens';

// Validation
export * from './schema';

// Layouts
export * from './layouts';

// Primitive Components
export * from './primitives';

// Animation Templates
export * from './animation-templates';

// Preset Themes
export { CoorgFoodCompanyTheme } from './presets/coorg-food-company';
export { GenericRestaurantTheme } from './presets/generic-restaurant';
export { SubscriptionTheme } from './presets/coorg-subscription';

// Default exports
import { CoorgFoodCompanyTheme } from './presets/coorg-food-company';
import { GenericRestaurantTheme } from './presets/generic-restaurant';
import { SubscriptionTheme } from './presets/coorg-subscription';

export const RestaurantThemePresets = {
  'coorg-food-company': CoorgFoodCompanyTheme,
  'generic': GenericRestaurantTheme,
  'subscription': SubscriptionTheme,
} as const;

/**
 * Get a restaurant theme preset by name
 */
export function getRestaurantThemePreset(name: 'coorg-food-company' | 'generic' | 'subscription') {
  return RestaurantThemePresets[name];
}

/**
 * Get all available preset names
 */
export function getRestaurantThemePresetNames(): string[] {
  return Object.keys(RestaurantThemePresets);
}

/**
 * Module version
 */
export const MULTIMODAL_RESTAURANT_THEME_VERSION = '1.0.0';

/**
 * Module metadata
 */
export const MULTIMODAL_RESTAURANT_THEME_INFO = {
  name: 'Multimodal Restaurant Theme',
  version: MULTIMODAL_RESTAURANT_THEME_VERSION,
  description: 'Comprehensive theme system for restaurant ordering with voice and touch support',
  author: 'Stonepot Platform',
  features: [
    'Voice-assisted ordering',
    'Standard browse mode',
    'Neumorphic design system',
    'Tailwind CSS integration',
    'Multimodal interactions',
    'WCAG AA accessibility',
    'Responsive layouts',
    'Real-time audio visualization',
  ],
  platforms: ['web', 'mobile'],
  frameworks: ['react', 'react-native'],
};
