/**
 * Hierarchical Menu Structure
 *
 * Utilities for parsing, organizing, and displaying menu data in a 3-level hierarchy:
 * Categories → Sub-Categories → Items
 *
 * This structure minimizes load times through lazy-loading and provides efficient
 * browsing for large menus (1000+ items).
 */

/**
 * Hierarchical Menu Types
 */
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  image?: string;
  category: string;
  subCategory?: string;

  // Dietary information
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isSpicy?: boolean;
  spiceLevel?: 1 | 2 | 3 | 4 | 5;

  // Additional metadata
  cuisine?: string;
  course?: 'starter' | 'main' | 'dessert' | 'beverage' | 'snack';
  preparationTime?: number; // minutes
  calories?: number;

  // Choices/Customization
  hasChoices?: boolean;
  choices?: Array<{
    type: string; // e.g., "flavor", "sauce", "pasta type"
    options: string[]; // e.g., ["peach", "lemon mint", "strawberry"]
    required?: boolean;
  }>;

  // Availability
  available?: boolean;
  seasonal?: boolean;

  // Popularity
  isBestseller?: boolean;
  isFeatured?: boolean;
  orderCount?: number;
  rating?: number;

  // Time-based tags
  tags?: string[]; // e.g., ["breakfast", "lunch", "evening_snacks", "bestseller"]
}

export interface SubCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
  icon?: string;
  itemCount?: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  subCategories: SubCategory[];
  icon?: string;
  featured?: boolean;
  totalItems?: number;
}

export interface HierarchicalMenu {
  categories: Category[];
  metadata: {
    totalItems: number;
    totalCategories: number;
    totalSubCategories: number;
    lastUpdated: string;
  };
}

/**
 * Menu Parser Options
 */
export interface MenuParserOptions {
  // Grouping strategy
  groupByCategory?: boolean;
  groupBySubCategory?: boolean;

  // Filters
  dietaryFilter?: 'all' | 'veg' | 'non-veg' | 'vegan';
  courseFilter?: 'starter' | 'main' | 'dessert' | 'beverage' | 'snack' | 'all';
  cuisineFilter?: string | 'all';

  // Sorting
  sortBy?: 'name' | 'price' | 'popularity' | 'rating';
  sortOrder?: 'asc' | 'desc';

  // Performance
  lazyLoad?: boolean;
  chunkSize?: number;
}

/**
 * Parse flat menu array into hierarchical structure
 *
 * @param items - Flat array of menu items
 * @param options - Parsing options
 * @returns Hierarchical menu structure
 */
export function parseMenuToHierarchy(
  items: MenuItem[],
  options: MenuParserOptions = {}
): HierarchicalMenu {
  const {
    groupByCategory = true,
    groupBySubCategory = true,
    dietaryFilter = 'all',
    courseFilter = 'all',
    cuisineFilter = 'all',
    sortBy = 'name',
    sortOrder = 'asc',
  } = options;

  // Filter items based on dietary/course/cuisine preferences
  let filteredItems = items.filter(item => {
    // Dietary filter
    if (dietaryFilter === 'veg' && !item.isVegetarian) return false;
    if (dietaryFilter === 'non-veg' && item.isVegetarian) return false;
    if (dietaryFilter === 'vegan' && !item.isVegan) return false;

    // Course filter
    if (courseFilter !== 'all' && item.course !== courseFilter) return false;

    // Cuisine filter
    if (cuisineFilter !== 'all' && item.cuisine !== cuisineFilter) return false;

    // Only available items
    if (item.available === false) return false;

    return true;
  });

  // Sort items
  filteredItems = sortItems(filteredItems, sortBy, sortOrder);

  // Group by category
  const categoryMap = new Map<string, Category>();

  filteredItems.forEach(item => {
    const categoryKey = item.category;
    const subCategoryKey = item.subCategory || 'General';

    // Get or create category
    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, {
        id: slugify(categoryKey),
        name: categoryKey,
        subCategories: [],
        totalItems: 0,
      });
    }

    const category = categoryMap.get(categoryKey)!;
    category.totalItems = (category.totalItems || 0) + 1;

    // Get or create sub-category
    let subCategory = category.subCategories.find(sc => sc.name === subCategoryKey);
    if (!subCategory) {
      subCategory = {
        id: slugify(`${categoryKey}-${subCategoryKey}`),
        name: subCategoryKey,
        items: [],
        itemCount: 0,
      };
      category.subCategories.push(subCategory);
    }

    // Add item to sub-category
    subCategory.items.push(item);
    subCategory.itemCount = subCategory.items.length;
  });

  // Convert map to array
  const categories = Array.from(categoryMap.values());

  return {
    categories,
    metadata: {
      totalItems: filteredItems.length,
      totalCategories: categories.length,
      totalSubCategories: categories.reduce((sum, cat) => sum + cat.subCategories.length, 0),
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Sort menu items by specified criteria
 */
function sortItems(
  items: MenuItem[],
  sortBy: MenuParserOptions['sortBy'],
  sortOrder: MenuParserOptions['sortOrder']
): MenuItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'price':
        comparison = a.price - b.price;
        break;
      case 'popularity':
        comparison = (b.orderCount || 0) - (a.orderCount || 0);
        break;
      case 'rating':
        comparison = (b.rating || 0) - (a.rating || 0);
        break;
      default:
        comparison = 0;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Convert string to URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Search menu items with fuzzy matching
 *
 * @param items - Menu items to search
 * @param query - Search query
 * @param options - Search options
 * @returns Matching items
 */
export interface SearchOptions {
  minQueryLength?: number;
  maxResults?: number;
  fuzzyMatch?: boolean;
  searchFields?: Array<keyof MenuItem>;
  highlightMatches?: boolean;
}

export function searchMenuItems(
  items: MenuItem[],
  query: string,
  options: SearchOptions = {}
): MenuItem[] {
  const {
    minQueryLength = 2,
    maxResults = 20,
    fuzzyMatch = true,
    searchFields = ['name', 'description', 'category', 'subCategory', 'cuisine'],
  } = options;

  // Validate query length
  if (query.length < minQueryLength) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const results: Array<{ item: MenuItem; score: number }> = [];

  items.forEach(item => {
    let score = 0;

    searchFields.forEach(field => {
      const value = item[field];
      if (typeof value === 'string') {
        const valueLower = value.toLowerCase();

        // Exact match (highest score)
        if (valueLower === queryLower) {
          score += 100;
        }
        // Starts with query (high score)
        else if (valueLower.startsWith(queryLower)) {
          score += 50;
        }
        // Contains query (medium score)
        else if (valueLower.includes(queryLower)) {
          score += 25;
        }
        // Fuzzy match (low score)
        else if (fuzzyMatch && fuzzyMatchScore(queryLower, valueLower) > 0.6) {
          score += 10;
        }
      }
    });

    if (score > 0) {
      results.push({ item, score });
    }
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Return top results
  return results.slice(0, maxResults).map(r => r.item);
}

/**
 * Simple fuzzy matching score (0-1)
 */
function fuzzyMatchScore(query: string, target: string): number {
  if (query.length === 0) return 0;
  if (query === target) return 1;

  let score = 0;
  let queryIndex = 0;

  for (let i = 0; i < target.length && queryIndex < query.length; i++) {
    if (target[i] === query[queryIndex]) {
      score++;
      queryIndex++;
    }
  }

  return score / query.length;
}

/**
 * Get time-based recommendations
 *
 * @param items - All menu items
 * @param currentTime - Current time (defaults to now)
 * @param limit - Maximum number of recommendations
 * @returns Recommended items for current time
 */
export function getTimeBasedRecommendations(
  items: MenuItem[],
  currentTime: Date = new Date(),
  limit: number = 4
): MenuItem[] {
  const hour = currentTime.getHours();

  // Determine time category
  let timeTag: string;
  if (hour >= 6 && hour < 11) {
    timeTag = 'breakfast';
  } else if (hour >= 11 && hour < 16) {
    timeTag = 'lunch';
  } else if (hour >= 16 && hour < 21) {
    timeTag = 'evening_snacks';
  } else {
    timeTag = 'light_dinner';
  }

  // Filter items with matching time tag
  const timeFilteredItems = items.filter(item =>
    item.tags?.includes(timeTag) || item.tags?.includes('bestseller')
  );

  // Sort by bestseller status and order count
  const sorted = timeFilteredItems.sort((a, b) => {
    if (a.isBestseller && !b.isBestseller) return -1;
    if (!a.isBestseller && b.isBestseller) return 1;
    return (b.orderCount || 0) - (a.orderCount || 0);
  });

  return sorted.slice(0, limit);
}

/**
 * Get category-filtered recommendations
 *
 * @param items - All menu items
 * @param category - Category to filter by
 * @param dietaryFilter - Optional dietary filter
 * @param limit - Maximum number of recommendations
 * @returns Top items in category
 */
export function getCategoryRecommendations(
  items: MenuItem[],
  category: string,
  dietaryFilter?: 'all' | 'veg' | 'non-veg' | 'vegan',
  limit: number = 4
): MenuItem[] {
  let filtered = items.filter(item =>
    item.category === category && item.available !== false
  );

  // Apply dietary filter
  if (dietaryFilter && dietaryFilter !== 'all') {
    filtered = filtered.filter(item => {
      if (dietaryFilter === 'veg') return item.isVegetarian;
      if (dietaryFilter === 'non-veg') return !item.isVegetarian;
      if (dietaryFilter === 'vegan') return item.isVegan;
      return true;
    });
  }

  // Sort by popularity
  const sorted = filtered.sort((a, b) => {
    if (a.isBestseller && !b.isBestseller) return -1;
    if (!a.isBestseller && b.isBestseller) return 1;
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return (b.orderCount || 0) - (a.orderCount || 0);
  });

  return sorted.slice(0, limit);
}

/**
 * Flatten hierarchical menu back to array
 *
 * @param menu - Hierarchical menu
 * @returns Flat array of menu items
 */
export function flattenMenu(menu: HierarchicalMenu): MenuItem[] {
  const items: MenuItem[] = [];

  menu.categories.forEach(category => {
    category.subCategories.forEach(subCategory => {
      items.push(...subCategory.items);
    });
  });

  return items;
}

/**
 * Export for use in React/UI components
 */
export default {
  parseMenuToHierarchy,
  searchMenuItems,
  getTimeBasedRecommendations,
  getCategoryRecommendations,
  flattenMenu,
};
