/**
 * Customer Preference Inference Engine
 *
 * Automatically computes customer behavioral preferences from order history
 * to enable personalized recommendations, targeted promotions, and enhanced CX
 *
 * Features:
 * - Dietary preference detection (vegetarian, vegan, gluten-free, etc.)
 * - Spice level preference
 * - Price sensitivity analysis
 * - Order timing patterns
 * - Adventurousness scoring
 * - Favorite items tracking
 * - Special instruction pattern detection
 */

/**
 * Order item from database
 */
export interface OrderItem {
  id: string;
  name: string;
  category?: string;
  price: number;
  is_vegetarian?: number; // SQLite boolean (0 or 1)
  is_vegan?: number;
  spice_level?: string; // 'mild' | 'medium' | 'hot' | 'extra-hot'
  allergens?: string; // JSON array
  tags?: string; // JSON array
}

/**
 * Customer order from database
 */
export interface CustomerOrder {
  id: string;
  order_date: string;
  items: OrderItem[]; // Parsed from order_items JSON
  subtotal: number;
  tax: number;
  total: number;
  order_type?: string; // 'delivery' | 'pickup' | 'dine-in'
  special_instructions?: string;
}

/**
 * Computed customer preferences
 */
export interface CustomerPreferences {
  // Dietary preferences (inferred from order patterns)
  dietary_preferences: string[]; // ['vegetarian', 'vegan', 'gluten-free', 'dairy-free']

  // Favorite items (top 5-10 most ordered)
  favorite_items: string[]; // [item_id1, item_id2, ...]

  // Spice preference (most common spice level)
  spice_preference: string; // 'mild' | 'medium' | 'hot' | 'extra-hot' | null

  // Cuisine preferences (for multi-cuisine restaurants)
  cuisine_preferences: string[]; // ['North Indian', 'Chinese', 'Italian']

  // Price sensitivity based on average order value
  price_sensitivity: string; // 'budget' | 'mid-range' | 'premium'

  // Order size pattern
  order_size_pattern: string; // 'solo' | 'couple' | 'family' | 'party'

  // Order type preference
  order_type_preference: string; // 'delivery' | 'pickup' | 'dine-in'

  // Beverage ordering patterns
  beverage_preference: {
    frequency: string; // 'always' | 'often' | 'rare' | 'never'
    types: string[]; // ['soft-drinks', 'juice', 'lassi']
  };

  // Dessert ordering frequency
  dessert_frequency: string; // 'always' | 'often' | 'rare' | 'never'

  // Order timing distribution (percentage)
  order_timing_pattern: {
    breakfast: number; // 0-100
    lunch: number;
    dinner: number;
    late_night: number;
  };

  // Recurring special instructions
  special_instructions_patterns: string[];

  // How adventurous is the customer (0-1)
  adventurousness_score: number; // 0 = very loyal, 1 = very adventurous

  // How often do they reorder items (0-1)
  reorder_rate: number;
}

/**
 * Analyze order items to compute statistics
 */
function analyzeOrderedItems(orders: CustomerOrder[]): {
  vegetarianRate: number;
  veganRate: number;
  glutenFreeRequests: number;
  dairyFreeRequests: number;
  itemCounts: Map<string, number>;
  spiceLevels: string[];
  categories: Map<string, number>;
  pricePoints: number[];
} {
  let vegetarianCount = 0;
  let veganCount = 0;
  let glutenFreeRequests = 0;
  let dairyFreeRequests = 0;
  let totalItems = 0;

  const itemCounts = new Map<string, number>();
  const spiceLevels: string[] = [];
  const categories = new Map<string, number>();
  const pricePoints: number[] = [];

  for (const order of orders) {
    // Check special instructions for dietary restrictions
    const instructions = (order.special_instructions || '').toLowerCase();
    if (instructions.includes('gluten-free') || instructions.includes('no gluten')) {
      glutenFreeRequests++;
    }
    if (
      instructions.includes('no dairy') ||
      instructions.includes('dairy-free') ||
      instructions.includes('lactose')
    ) {
      dairyFreeRequests++;
    }

    for (const item of order.items) {
      totalItems++;

      // Track vegetarian/vegan items
      if (item.is_vegetarian) vegetarianCount++;
      if (item.is_vegan) veganCount++;

      // Track item frequency
      itemCounts.set(item.id, (itemCounts.get(item.id) || 0) + 1);

      // Track spice levels
      if (item.spice_level) {
        spiceLevels.push(item.spice_level);
      }

      // Track categories
      if (item.category) {
        categories.set(item.category, (categories.get(item.category) || 0) + 1);
      }

      // Track price points
      pricePoints.push(item.price);
    }
  }

  return {
    vegetarianRate: totalItems > 0 ? vegetarianCount / totalItems : 0,
    veganRate: totalItems > 0 ? veganCount / totalItems : 0,
    glutenFreeRequests,
    dairyFreeRequests,
    itemCounts,
    spiceLevels,
    categories,
    pricePoints,
  };
}

/**
 * Get the most frequent value in an array
 */
function getMostFrequent<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;

  const counts = new Map<T, number>();
  for (const val of arr) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }

  let maxCount = 0;
  let mostFrequent: T | null = null;
  for (const [val, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = val;
    }
  }

  return mostFrequent;
}

/**
 * Infer dietary preferences from order history
 */
function inferDietaryPreferences(orders: CustomerOrder[]): string[] {
  const preferences = new Set<string>();
  const stats = analyzeOrderedItems(orders);

  // If 80%+ of items are vegetarian
  if (stats.vegetarianRate >= 0.8) {
    preferences.add('vegetarian');
  }

  // If 80%+ are vegan
  if (stats.veganRate >= 0.8) {
    preferences.add('vegan');
  }

  // If customer explicitly requests gluten-free in 3+ orders
  if (stats.glutenFreeRequests >= 3) {
    preferences.add('gluten-free');
  }

  // If customer avoids dairy in 70%+ of orders
  if (stats.dairyFreeRequests >= Math.ceil(orders.length * 0.7)) {
    preferences.add('dairy-free');
  }

  return Array.from(preferences);
}

/**
 * Infer spice preference from order history
 */
function inferSpicePreference(orders: CustomerOrder[]): string {
  const stats = analyzeOrderedItems(orders);

  if (stats.spiceLevels.length === 0) {
    return 'medium'; // Default if no spice data
  }

  const mode = getMostFrequent(stats.spiceLevels);
  return mode || 'medium';
}

/**
 * Infer price sensitivity from average order value
 */
function inferPriceSensitivity(averageOrderValue: number): string {
  // Thresholds can be tenant-specific in production
  if (averageOrderValue < 300) return 'budget';
  if (averageOrderValue < 800) return 'mid-range';
  return 'premium';
}

/**
 * Infer order timing patterns
 */
function inferOrderTimingPattern(orders: CustomerOrder[]): {
  breakfast: number;
  lunch: number;
  dinner: number;
  late_night: number;
} {
  const timeCounts = { breakfast: 0, lunch: 0, dinner: 0, late_night: 0 };

  for (const order of orders) {
    const hour = new Date(order.order_date).getHours();

    if (hour >= 6 && hour < 11) {
      timeCounts.breakfast++;
    } else if (hour >= 11 && hour < 16) {
      timeCounts.lunch++;
    } else if (hour >= 16 && hour < 22) {
      timeCounts.dinner++;
    } else {
      timeCounts.late_night++;
    }
  }

  const total = orders.length;
  return {
    breakfast: Math.round((timeCounts.breakfast / total) * 100),
    lunch: Math.round((timeCounts.lunch / total) * 100),
    dinner: Math.round((timeCounts.dinner / total) * 100),
    late_night: Math.round((timeCounts.late_night / total) * 100),
  };
}

/**
 * Calculate adventurousness score (how often customer tries new items)
 */
function calculateAdventurousnessScore(orders: CustomerOrder[]): number {
  const stats = analyzeOrderedItems(orders);

  if (stats.itemCounts.size === 0) return 0;

  const allItems: string[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      allItems.push(item.id);
    }
  }

  // Ratio of unique items to total items ordered
  const score = stats.itemCounts.size / allItems.length;

  // Score interpretation:
  // 0.8-1.0: Very adventurous (tries many new items)
  // 0.5-0.79: Moderately adventurous
  // 0.2-0.49: Prefers familiar items
  // 0-0.19: Very loyal to favorites

  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate reorder rate (how often items are reordered)
 */
function calculateReorderRate(orders: CustomerOrder[]): number {
  const stats = analyzeOrderedItems(orders);

  if (stats.itemCounts.size === 0) return 0;

  // Count items that have been ordered more than once
  let reorderedItems = 0;
  for (const count of stats.itemCounts.values()) {
    if (count > 1) reorderedItems++;
  }

  const rate = reorderedItems / stats.itemCounts.size;
  return Math.round(rate * 100) / 100;
}

/**
 * Extract recurring special instructions patterns
 */
function extractSpecialInstructionsPatterns(orders: CustomerOrder[]): string[] {
  const instructions = orders
    .map((o) => o.special_instructions)
    .filter((i): i is string => !!i);

  if (instructions.length === 0) return [];

  // Use frequency analysis to find recurring patterns
  const patterns: Map<string, number> = new Map();

  for (const instruction of instructions) {
    const normalized = instruction.toLowerCase().trim();
    patterns.set(normalized, (patterns.get(normalized) || 0) + 1);
  }

  // Return instructions that appear in 20%+ of orders
  const threshold = orders.length * 0.2;
  return Array.from(patterns.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([instruction]) => instruction);
}

/**
 * Get top favorite items (most frequently ordered)
 */
function getFavoriteItems(orders: CustomerOrder[], topN: number = 10): string[] {
  const stats = analyzeOrderedItems(orders);

  // Sort items by frequency
  const sorted = Array.from(stats.itemCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Return top N item IDs
  return sorted.slice(0, topN).map(([itemId]) => itemId);
}

/**
 * Infer cuisine preferences from category distribution
 */
function inferCuisinePreferences(orders: CustomerOrder[]): string[] {
  const stats = analyzeOrderedItems(orders);

  // Sort categories by frequency
  const sorted = Array.from(stats.categories.entries()).sort((a, b) => b[1] - a[1]);

  // Return top 3 categories that account for at least 15% of orders each
  const total = orders.reduce((sum, o) => sum + o.items.length, 0);
  const threshold = total * 0.15;

  return sorted
    .filter(([_, count]) => count >= threshold)
    .slice(0, 3)
    .map(([category]) => category);
}

/**
 * Infer order size pattern from item quantities
 */
function inferOrderSizePattern(orders: CustomerOrder[]): string {
  const avgItemsPerOrder =
    orders.reduce((sum, o) => sum + o.items.length, 0) / orders.length;

  if (avgItemsPerOrder <= 2) return 'solo';
  if (avgItemsPerOrder <= 4) return 'couple';
  if (avgItemsPerOrder <= 8) return 'family';
  return 'party';
}

/**
 * Infer order type preference
 */
function inferOrderTypePreference(orders: CustomerOrder[]): string {
  const types = orders.map((o) => o.order_type).filter((t): t is string => !!t);

  if (types.length === 0) return 'delivery'; // Default

  const mode = getMostFrequent(types);
  return mode || 'delivery';
}

/**
 * Infer beverage preference
 */
function inferBeveragePreference(orders: CustomerOrder[]): {
  frequency: string;
  types: string[];
} {
  const beverageCategories = ['beverages', 'drinks', 'soft drinks', 'juice', 'lassi'];

  let beverageOrders = 0;
  const beverageTypes = new Set<string>();

  for (const order of orders) {
    let hasBeverage = false;

    for (const item of order.items) {
      const category = (item.category || '').toLowerCase();
      const name = item.name.toLowerCase();

      if (
        beverageCategories.some((bc) => category.includes(bc)) ||
        name.includes('juice') ||
        name.includes('lassi') ||
        name.includes('soda') ||
        name.includes('coffee') ||
        name.includes('tea')
      ) {
        hasBeverage = true;
        beverageTypes.add(item.category || 'beverage');
      }
    }

    if (hasBeverage) beverageOrders++;
  }

  const rate = beverageOrders / orders.length;

  let frequency: string;
  if (rate >= 0.8) frequency = 'always';
  else if (rate >= 0.5) frequency = 'often';
  else if (rate >= 0.2) frequency = 'rare';
  else frequency = 'never';

  return {
    frequency,
    types: Array.from(beverageTypes),
  };
}

/**
 * Infer dessert ordering frequency
 */
function inferDessertFrequency(orders: CustomerOrder[]): string {
  const dessertCategories = ['desserts', 'sweets', 'ice cream'];

  let dessertOrders = 0;

  for (const order of orders) {
    const hasDessert = order.items.some((item) => {
      const category = (item.category || '').toLowerCase();
      return dessertCategories.some((dc) => category.includes(dc));
    });

    if (hasDessert) dessertOrders++;
  }

  const rate = dessertOrders / orders.length;

  if (rate >= 0.8) return 'always';
  if (rate >= 0.5) return 'often';
  if (rate >= 0.2) return 'rare';
  return 'never';
}

/**
 * Compute all customer preferences from order history
 *
 * @param orders - Array of customer orders
 * @param totalSpent - Total amount spent by customer
 * @returns Complete preference profile
 */
export function inferCustomerPreferences(
  orders: CustomerOrder[],
  totalSpent: number
): CustomerPreferences {
  if (orders.length === 0) {
    // Return default preferences for new customers
    return {
      dietary_preferences: [],
      favorite_items: [],
      spice_preference: 'medium',
      cuisine_preferences: [],
      price_sensitivity: 'mid-range',
      order_size_pattern: 'couple',
      order_type_preference: 'delivery',
      beverage_preference: { frequency: 'often', types: [] },
      dessert_frequency: 'rare',
      order_timing_pattern: { breakfast: 0, lunch: 40, dinner: 50, late_night: 10 },
      special_instructions_patterns: [],
      adventurousness_score: 0.5,
      reorder_rate: 0.5,
    };
  }

  const averageOrderValue = totalSpent / orders.length;

  return {
    dietary_preferences: inferDietaryPreferences(orders),
    favorite_items: getFavoriteItems(orders),
    spice_preference: inferSpicePreference(orders),
    cuisine_preferences: inferCuisinePreferences(orders),
    price_sensitivity: inferPriceSensitivity(averageOrderValue),
    order_size_pattern: inferOrderSizePattern(orders),
    order_type_preference: inferOrderTypePreference(orders),
    beverage_preference: inferBeveragePreference(orders),
    dessert_frequency: inferDessertFrequency(orders),
    order_timing_pattern: inferOrderTimingPattern(orders),
    special_instructions_patterns: extractSpecialInstructionsPatterns(orders),
    adventurousness_score: calculateAdventurousnessScore(orders),
    reorder_rate: calculateReorderRate(orders),
  };
}

/**
 * Update preferences incrementally after a new order
 *
 * More efficient than recalculating from scratch
 *
 * @param currentPreferences - Current preference profile
 * @param newOrder - Newly completed order
 * @param totalOrders - Total number of orders (including new one)
 * @param totalSpent - Total amount spent (including new order)
 * @returns Updated preferences
 */
export function updatePreferencesIncremental(
  currentPreferences: CustomerPreferences,
  newOrder: CustomerOrder,
  totalOrders: number,
  totalSpent: number
): CustomerPreferences {
  // For incremental updates, we need to recalculate based on the new data
  // This is a simplified version - in production, you'd want to maintain
  // running statistics to avoid recalculating everything

  // For now, return current preferences
  // In practice, you'd update specific fields based on the new order
  // This would require maintaining more state in the database

  return currentPreferences;
}
