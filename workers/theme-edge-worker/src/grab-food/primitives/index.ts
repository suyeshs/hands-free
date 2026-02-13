/**
 * Grab Food - Primitives Component Registry
 *
 * Centralized exports for all primitive components.
 */

// Menu Item Card (for single restaurant menu display)
export {
  createMenuItemCard,
  createCardMenuItem,
  createListMenuItem,
  createCompactMenuItem,
} from './menu-item-card';
export type { MenuItemCardOptions } from './menu-item-card';

// Restaurant Card (deprecated - use menu-item-card for single restaurant)
export {
  createRestaurantCard,
  createGridRestaurantCard,
  createListRestaurantCard,
} from './restaurant-card';
export type { RestaurantCardOptions } from './restaurant-card';

// Promo Carousel
export {
  createPromoCarousel,
} from './promo-carousel';
export type { PromoCarouselOptions } from './promo-carousel';

// Order Tracker
export {
  createOrderTracker,
  createCompactOrderTracker,
  createDetailedOrderTracker,
  createFullscreenOrderTracker,
} from './order-tracker';
export type { OrderTrackerOptions } from './order-tracker';

// Bottom Navigation
export {
  createBottomNav,
} from './bottom-nav';
export type { BottomNavOptions } from './bottom-nav';

// Search Bar
export {
  createSearchBar,
} from './search-bar';
export type { SearchBarOptions } from './search-bar';

// Voice FAB
export {
  createVoiceFAB,
  createSmallVoiceFAB,
  createMediumVoiceFAB,
  createLargeVoiceFAB,
} from './voice-orb';
export type { VoiceFABOptions } from './voice-orb';

// Cart Pill
export {
  createCartPill,
  createCompactCartPill,
  createFullCartPill,
} from './cart-pill';
export type { CartPillOptions } from './cart-pill';

// Veg Toggle
export {
  createVegToggle,
  createSimpleVegToggle,
  createFullDietaryToggle,
} from './veg-toggle';
export type { VegToggleOptions } from './veg-toggle';

// Category Accordion (for hierarchical menu)
export {
  createCategoryAccordion,
} from './category-accordion';
export type { CategoryAccordionConfig } from './category-accordion';
