/**
 * Multimodal Restaurant Theme - Primitive Components
 *
 * Factory functions for creating restaurant-specific UI components
 */

export * from './menu-card';
export * from './voice-orb';
export * from './cart-island';
export * from './category-carousel';
export * from './promo-carousel';

/**
 * Component registry for discovery
 */
export const RestaurantPrimitives = {
  'menu-card': 'Menu Card - Display menu items with images, ratings, and quick actions',
  'combo-card': 'Combo Card - Menu card with choice selection for combo meals',
  'voice-orb': 'Voice Orb - Pulsating AI assistant orb with audio visualizer',
  'cart-island': 'Cart Island - Floating cart indicator with item count and total',
  'category-carousel': 'Category Carousel - Horizontal scrolling category navigation',
  'order-progress': 'Order Progress - Circular progress indicator for ordering steps',
  'dish-modal': 'Dish Modal - Detailed dish information modal with voice support',
  'cart': 'Cart - Full cart view with item list and checkout',
  'promo-carousel': 'Promo Carousel - Promotional slider for voice ordering and specials',
} as const;

/**
 * Get all primitive component types
 */
export function getAllPrimitiveTypes(): string[] {
  return Object.keys(RestaurantPrimitives);
}

/**
 * Get primitive description
 */
export function getPrimitiveDescription(type: string): string | undefined {
  return RestaurantPrimitives[type as keyof typeof RestaurantPrimitives];
}
