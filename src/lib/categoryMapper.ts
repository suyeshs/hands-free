/**
 * Category Mapper Utility
 * Maps item names to menu categories using keyword matching
 * Primary use: Categorizing aggregator order items for auto-accept rules
 */

import { MenuCategory } from '../types/pos';
import { MenuItem } from '../types/pos';

/**
 * Category keyword database
 * Keywords are lowercase for case-insensitive matching
 */
const CATEGORY_KEYWORDS: Record<MenuCategory, string[]> = {
  beverages: [
    'coffee',
    'tea',
    'juice',
    'smoothie',
    'shake',
    'lassi',
    'soda',
    'water',
    'beer',
    'wine',
    'cocktail',
    'mocktail',
    'lemonade',
    'cola',
    'pepsi',
    'sprite',
    'fanta',
    'drink',
    'cold coffee',
    'iced tea',
    'milkshake',
    'frappe',
    'cappuccino',
    'latte',
    'espresso',
    'mojito',
  ],
  appetizers: [
    'appetizer',
    'starter',
    'samosa',
    'pakora',
    'tikka',
    'kebab',
    'spring roll',
    'wings',
    'fries',
    'nachos',
    'soup',
    'salad',
    'bruschetta',
    'paneer tikka',
    'chicken tikka',
    'tandoori',
    'chaat',
    'pani puri',
    'bhel puri',
    'papdi',
  ],
  mains: [
    'curry',
    'biryani',
    'rice',
    'noodles',
    'pasta',
    'pizza',
    'burger',
    'sandwich',
    'wrap',
    'dal',
    'paneer',
    'chicken',
    'mutton',
    'fish',
    'prawn',
    'roti',
    'naan',
    'paratha',
    'kulcha',
    'thali',
    'fried rice',
    'pulao',
    'khichdi',
    'dosa',
    'idli',
    'vada',
    'uttapam',
    'masala',
  ],
  sides: [
    'side',
    'raita',
    'papad',
    'pickle',
    'chutney',
    'onion',
    'lemon',
    'green salad',
    'coleslaw',
    'fries',
    'bread',
    'bun',
    'garlic bread',
  ],
  desserts: [
    'dessert',
    'ice cream',
    'cake',
    'pastry',
    'pudding',
    'kheer',
    'gulab jamun',
    'rasgulla',
    'jalebi',
    'ladoo',
    'barfi',
    'halwa',
    'brownie',
    'cookie',
    'donut',
    'waffle',
    'pancake',
    'sweet',
  ],
  specials: [
    'special',
    'chef special',
    'house special',
    'combo',
    'meal',
    'platter',
    'deluxe',
    'premium',
  ],
};

/**
 * Maps an item name to a menu category using keyword matching
 * @param itemName - Name of the item to categorize
 * @param menuItems - Optional array of menu items for exact matching
 * @returns MenuCategory - The matched category, defaults to 'mains' if no match
 */
export function mapItemNameToCategory(
  itemName: string,
  menuItems?: MenuItem[]
): MenuCategory {
  const lowerName = itemName.toLowerCase().trim();

  // Strategy 1: Exact menu item lookup (if menu provided)
  if (menuItems && menuItems.length > 0) {
    const exactMatch = menuItems.find(
      (item) => item.name.toLowerCase().trim() === lowerName
    );
    if (exactMatch) {
      return exactMatch.category;
    }

    // Try fuzzy match with menu items (contains)
    const fuzzyMatch = menuItems.find((item) =>
      item.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(item.name.toLowerCase())
    );
    if (fuzzyMatch) {
      return fuzzyMatch.category;
    }
  }

  // Strategy 2: Keyword matching
  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return category as MenuCategory;
      }
    }
  }

  // Strategy 3: Default fallback
  // Default to 'mains' if no match found
  console.warn(
    `[CategoryMapper] No category match found for "${itemName}", defaulting to "mains"`
  );
  return 'mains';
}

/**
 * Maps multiple item names to categories in batch
 * @param itemNames - Array of item names
 * @param menuItems - Optional array of menu items for exact matching
 * @returns Record mapping item names to categories
 */
export function mapItemNamesToCategories(
  itemNames: string[],
  menuItems?: MenuItem[]
): Record<string, MenuCategory> {
  const result: Record<string, MenuCategory> = {};

  for (const itemName of itemNames) {
    result[itemName] = mapItemNameToCategory(itemName, menuItems);
  }

  return result;
}

/**
 * Gets the confidence score for a category match (0-1)
 * Higher score = more confident match
 * @param itemName - Name of the item
 * @param category - The suggested category
 * @returns Confidence score between 0 and 1
 */
export function getCategoryMatchConfidence(
  itemName: string,
  category: MenuCategory
): number {
  const lowerName = itemName.toLowerCase().trim();
  const keywords = CATEGORY_KEYWORDS[category];

  // Check for exact keyword match
  for (const keyword of keywords) {
    if (lowerName === keyword) {
      return 1.0; // Perfect match
    }
    if (lowerName.includes(keyword) || keyword.includes(lowerName)) {
      // Partial match - score based on length ratio
      const ratio = Math.min(keyword.length, lowerName.length) /
                    Math.max(keyword.length, lowerName.length);
      return ratio * 0.8; // Max 0.8 for partial matches
    }
  }

  return 0.0; // No match
}

/**
 * Suggests possible categories for an item with confidence scores
 * Useful for manual category mapping UI
 * @param itemName - Name of the item
 * @returns Array of {category, confidence} sorted by confidence
 */
export function suggestCategories(
  itemName: string
): Array<{ category: MenuCategory; confidence: number }> {
  const categories: MenuCategory[] = [
    'beverages',
    'appetizers',
    'mains',
    'sides',
    'desserts',
    'specials',
  ];

  const suggestions = categories
    .map((category) => ({
      category,
      confidence: getCategoryMatchConfidence(itemName, category),
    }))
    .filter((s) => s.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  // If no matches found, suggest 'mains' with low confidence
  if (suggestions.length === 0) {
    suggestions.push({ category: 'mains', confidence: 0.1 });
  }

  return suggestions;
}

/**
 * Validates if a category assignment makes sense
 * Returns true if the category seems appropriate for the item name
 */
export function validateCategoryAssignment(
  itemName: string,
  category: MenuCategory
): boolean {
  const confidence = getCategoryMatchConfidence(itemName, category);
  return confidence > 0.3; // Threshold: at least 30% confidence
}
