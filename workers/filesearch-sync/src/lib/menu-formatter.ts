/**
 * Menu Formatter - Formats menu data for AI consumption
 */

import type { MenuData, MenuItem, MenuCategory } from '../types';

/**
 * Format menu as AI-friendly markdown document
 */
export function formatMenuForAI(
  tenantId: string,
  menuData: MenuData
): string {
  const lines: string[] = [];
  const { items, categories } = menuData;

  // Header
  lines.push('# Restaurant Menu');
  lines.push(`Tenant ID: ${tenantId}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Items: ${items.length}`);
  lines.push(`Total Categories: ${categories.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group items by category
  const itemsByCategory = groupItemsByCategory(items);

  // Sort categories by display order
  const sortedCategories = [...categories].sort(
    (a, b) => (a.display_order || 0) - (b.display_order || 0)
  );

  // Format each category
  sortedCategories.forEach(category => {
    const categoryItems = itemsByCategory.get(category.name) || [];

    // Skip empty categories
    if (categoryItems.length === 0) return;

    lines.push(`## ${category.name}`);
    if (category.description) {
      lines.push(category.description);
    }
    lines.push('');

    // Sort items by display order and name
    const sortedItems = categoryItems.sort((a, b) => {
      const orderA = a.display_order || 0;
      const orderB = b.display_order || 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });

    // Format each item
    sortedItems.forEach(item => {
      lines.push(`### ${item.name}`);

      // Price
      lines.push(`- **Price**: ${item.currency || '₹'}${item.price}`);

      // Description
      if (item.description) {
        lines.push(`- **Description**: ${item.description}`);
      }

      // Dietary information
      const dietary = getDietaryTags(item);
      if (dietary.length > 0) {
        lines.push(`- **Dietary**: ${dietary.join(', ')}`);
      }

      // Spice level
      if (item.spice_level && item.spice_level !== 'none') {
        const spiceLevel = item.spice_level.replace(/_/g, ' ');
        lines.push(`- **Spice Level**: ${capitalizeFirst(spiceLevel)}`);
      }

      // Allergens
      const allergens = parseJsonField(item.allergens);
      if (allergens.length > 0) {
        lines.push(`- **Allergens**: ${allergens.join(', ')}`);
      }

      // Tags
      const tags = parseJsonField(item.tags);
      if (tags.length > 0) {
        lines.push(`- **Tags**: ${tags.join(', ')}`);
      }

      // Preparation time
      if (item.preparation_time && item.preparation_time > 0) {
        lines.push(`- **Preparation Time**: ${item.preparation_time} minutes`);
      }

      // Availability
      const isAvailable = item.available !== 0;
      lines.push(`- **Available**: ${isAvailable ? 'Yes' : 'No'}`);

      lines.push('');
    });

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Group items by category name
 */
function groupItemsByCategory(items: MenuItem[]): Map<string, MenuItem[]> {
  const grouped = new Map<string, MenuItem[]>();

  items.forEach(item => {
    const category = item.category || 'Other';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(item);
  });

  return grouped;
}

/**
 * Extract dietary tags from item
 */
function getDietaryTags(item: MenuItem): string[] {
  const tags: string[] = [];

  if (item.is_vegetarian) tags.push('Vegetarian');
  if (item.is_vegan) tags.push('Vegan');
  if (item.is_gluten_free) tags.push('Gluten-Free');
  if (item.is_dairy_free) tags.push('Dairy-Free');

  return tags;
}

/**
 * Parse JSON field (handles both string and array)
 */
function parseJsonField(field: string | undefined): string[] {
  if (!field) return [];

  try {
    if (typeof field === 'string') {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    }
    return Array.isArray(field) ? field : [];
  } catch {
    return [];
  }
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a summary of the menu for logging
 */
export function generateMenuSummary(menuData: MenuData): string {
  const { items, categories } = menuData;
  const availableItems = items.filter(item => item.available !== 0);

  const itemsByCategory = groupItemsByCategory(availableItems);
  const categoryBreakdown = categories
    .map(cat => {
      const count = itemsByCategory.get(cat.name)?.length || 0;
      return `${cat.name}: ${count}`;
    })
    .join(', ');

  return `${availableItems.length} items across ${categories.length} categories (${categoryBreakdown})`;
}
