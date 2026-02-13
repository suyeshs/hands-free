/**
 * Grab Food Theme - Main Module Exports
 *
 * Entry point for the Grab Food delivery theme.
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

// Hierarchical Menu Utilities (NEW)
export * from './hierarchical-menu';

// Animation Templates (export as renamed to avoid conflict with design-tokens)
export { GrabFoodAnimations as GrabFoodAnimationTemplates } from './animation-templates';

// API Handlers
export { handleGrabFoodAPI } from './api-handlers';

// Preset Themes
export { GrabFoodDefaultTheme } from './presets/grab-food-default';
export { KhaoPiyoTheme } from './presets/khao-piyo-preset';

// Default exports
import { GrabFoodDefaultTheme } from './presets/grab-food-default';
import { KhaoPiyoTheme } from './presets/khao-piyo-preset';

export const GrabFoodThemePresets = {
  'grab-food-default': GrabFoodDefaultTheme,
  'khao-piyo-custom': KhaoPiyoTheme,
} as const;

export function getGrabFoodThemePreset(name: 'grab-food-default' | 'khao-piyo-custom') {
  return GrabFoodThemePresets[name];
}

export function getGrabFoodThemePresetNames(): string[] {
  return Object.keys(GrabFoodThemePresets);
}

export const GRAB_FOOD_THEME_VERSION = '1.0.0';

export const GRAB_FOOD_THEME_INFO = {
  name: 'Grab Food Delivery Theme',
  version: GRAB_FOOD_THEME_VERSION,
  description: 'Mobile-first single restaurant menu theme with Grab-inspired design',
  author: 'Stonepot Platform',
  features: [
    'Mobile-first design',
    'App-like interface with bottom navigation',
    'Single restaurant menu display',
    'Real-time order tracking',
    'Voice search and commands',
    'Promo carousel',
    'Menu category filters',
    'Dietary indicators (vegetarian, vegan, gluten-free, spicy)',
    'Flat design with subtle shadows',
    'Grab green branding (#00B14F)',
    'WCAG AA accessibility',
    'Gesture support (swipe, pull-to-refresh)',
    'Touch-optimized (44px minimum targets)',
  ],
  platforms: ['web', 'mobile'],
  frameworks: ['react', 'react-native'],
  components: [
    'MenuItemCard (card/list/compact variants)',
    'PromoCarousel (auto-play)',
    'OrderTracker (real-time)',
    'BottomNav (fixed)',
    'SearchBar (voice + filters)',
    'VoiceFAB (floating action button)',
    'CartPill (floating cart with count and total)',
    'VegToggle (dietary filter for vegetarian/all)',
  ],
  layouts: [
    'Home (search + promo + menu items)',
    'OrderTracking (map + progress)',
    'RestaurantDetail (menu + cart)',
  ],
};
