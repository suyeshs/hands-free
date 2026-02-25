/**
 * Recommendation Service for Voice Ordering
 * Provides time-based, category-filtered, and bestseller recommendations
 */

export interface MenuItem {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  photo_url?: string;
  available: number;
  is_vegetarian: number;
  is_vegan: number;
  spice_level?: string;
  allergens?: string;
  tags?: string; // JSON array
  is_bestseller?: number;
  order_count?: number;
}

export type DietaryFilter = 'vegetarian' | 'non-veg' | 'vegan' | 'all';

export type TimeOfDay = 'morning' | 'lunch' | 'evening' | 'night';

export class RecommendationService {
  private db: any; // D1 Database binding

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Get time category based on current hour
   */
  private getTimeCategory(currentTime?: Date): {
    category: string;
    timeOfDay: TimeOfDay;
  } {
    const hour = (currentTime || new Date()).getHours();

    if (hour >= 6 && hour < 11) {
      return { category: 'breakfast', timeOfDay: 'morning' };
    } else if (hour >= 11 && hour < 16) {
      return { category: 'lunch', timeOfDay: 'lunch' };
    } else if (hour >= 16 && hour < 21) {
      return { category: 'evening_snacks', timeOfDay: 'evening' };
    } else {
      return { category: 'light_dinner', timeOfDay: 'night' };
    }
  }

  /**
   * Get smart suggestions based on time + bestsellers + dietary filter
   */
  async getSmartSuggestions(params: {
    tenantId: string;
    dietaryFilter?: DietaryFilter;
    currentTime?: Date;
    limit?: number;
  }): Promise<MenuItem[]> {
    const { tenantId, dietaryFilter = 'all', currentTime, limit = 4 } = params;
    const { category: timeCategory } = this.getTimeCategory(currentTime);

    // Build WHERE clause for dietary filter
    let dietaryClause = '';
    if (dietaryFilter === 'vegetarian') {
      dietaryClause = 'AND is_vegetarian = 1';
    } else if (dietaryFilter === 'vegan') {
      dietaryClause = 'AND is_vegan = 1';
    } else if (dietaryFilter === 'non-veg') {
      dietaryClause = 'AND is_vegetarian = 0';
    }

    // Query menu with time-based tags and bestseller priority
    const query = `
      SELECT *
      FROM menu_items
      WHERE tenant_id = ?
        AND available = 1
        ${dietaryClause}
        AND (
          tags LIKE ?
          OR is_bestseller = 1
        )
      ORDER BY is_bestseller DESC, order_count DESC, display_order ASC
      LIMIT ?
    `;

    const result = await this.db
      .prepare(query)
      .bind(tenantId, `%${timeCategory}%`, limit)
      .all();

    return result.results as MenuItem[];
  }

  /**
   * Get category-filtered items with bestsellers first
   */
  async getCategoryRecommendations(params: {
    tenantId: string;
    category: string;
    dietaryFilter?: DietaryFilter;
    limit?: number;
  }): Promise<MenuItem[]> {
    const { tenantId, category, dietaryFilter = 'all', limit = 4 } = params;

    // Build WHERE clause for dietary filter
    let dietaryClause = '';
    if (dietaryFilter === 'vegetarian') {
      dietaryClause = 'AND is_vegetarian = 1';
    } else if (dietaryFilter === 'vegan') {
      dietaryClause = 'AND is_vegan = 1';
    } else if (dietaryFilter === 'non-veg') {
      dietaryClause = 'AND is_vegetarian = 0';
    }

    const query = `
      SELECT *
      FROM menu_items
      WHERE tenant_id = ?
        AND category = ?
        AND available = 1
        ${dietaryClause}
      ORDER BY is_bestseller DESC, order_count DESC, display_order ASC
      LIMIT ?
    `;

    const result = await this.db
      .prepare(query)
      .bind(tenantId, category, limit)
      .all();

    return result.results as MenuItem[];
  }

  /**
   * Mark items as bestsellers based on order volume
   * Automatic: Items with >100 orders in last 30 days
   */
  async updateBestsellerStatus(
    tenantId: string,
    threshold: number = 100
  ): Promise<{ updated: number; bestsellers: number }> {
    // Mark items with order_count > threshold as bestsellers
    const markBestsellers = await this.db
      .prepare(
        `
        UPDATE menu_items
        SET is_bestseller = 1, last_bestseller_update = datetime('now')
        WHERE tenant_id = ?
          AND order_count > ?
          AND is_bestseller = 0
      `
      )
      .bind(tenantId, threshold)
      .run();

    // Unmark items below threshold
    const unmarkBestsellers = await this.db
      .prepare(
        `
        UPDATE menu_items
        SET is_bestseller = 0, last_bestseller_update = datetime('now')
        WHERE tenant_id = ?
          AND order_count <= ?
          AND is_bestseller = 1
      `
      )
      .bind(tenantId, threshold)
      .run();

    // Count current bestsellers
    const count = await this.db
      .prepare(
        `
        SELECT COUNT(*) as total
        FROM menu_items
        WHERE tenant_id = ? AND is_bestseller = 1
      `
      )
      .bind(tenantId)
      .first();

    return {
      updated: (markBestsellers.meta?.changes || 0) + (unmarkBestsellers.meta?.changes || 0),
      bestsellers: count?.total || 0,
    };
  }

  /**
   * Manually mark item as bestseller
   */
  async markAsBestseller(itemId: string, isBestseller: boolean): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE menu_items
        SET is_bestseller = ?, last_bestseller_update = datetime('now')
        WHERE id = ?
      `
      )
      .bind(isBestseller ? 1 : 0, itemId)
      .run();
  }

  /**
   * Increment order count for an item
   */
  async incrementOrderCount(itemId: string): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE menu_items
        SET order_count = order_count + 1
        WHERE id = ?
      `
      )
      .bind(itemId)
      .run();
  }

  /**
   * Get all available categories for a tenant with item counts
   */
  async getCategories(
    tenantId: string,
    dietaryFilter?: DietaryFilter
  ): Promise<Array<{ category: string; count: number }>> {
    let dietaryClause = '';
    if (dietaryFilter === 'vegetarian') {
      dietaryClause = 'AND is_vegetarian = 1';
    } else if (dietaryFilter === 'vegan') {
      dietaryClause = 'AND is_vegan = 1';
    } else if (dietaryFilter === 'non-veg') {
      dietaryClause = 'AND is_vegetarian = 0';
    }

    const query = `
      SELECT category, COUNT(*) as count
      FROM menu_items
      WHERE tenant_id = ?
        AND available = 1
        ${dietaryClause}
      GROUP BY category
      ORDER BY count DESC
    `;

    const result = await this.db.prepare(query).bind(tenantId).all();

    return result.results as Array<{ category: string; count: number }>;
  }

  /**
   * Search menu items by keyword (for voice queries)
   */
  async searchMenu(params: {
    tenantId: string;
    keyword: string;
    dietaryFilter?: DietaryFilter;
    limit?: number;
  }): Promise<MenuItem[]> {
    const { tenantId, keyword, dietaryFilter = 'all', limit = 10 } = params;

    let dietaryClause = '';
    if (dietaryFilter === 'vegetarian') {
      dietaryClause = 'AND is_vegetarian = 1';
    } else if (dietaryFilter === 'vegan') {
      dietaryClause = 'AND is_vegan = 1';
    } else if (dietaryFilter === 'non-veg') {
      dietaryClause = 'AND is_vegetarian = 0';
    }

    const searchTerm = `%${keyword.toLowerCase()}%`;

    const query = `
      SELECT *
      FROM menu_items
      WHERE tenant_id = ?
        AND available = 1
        ${dietaryClause}
        AND (
          LOWER(name) LIKE ?
          OR LOWER(description) LIKE ?
          OR LOWER(category) LIKE ?
          OR LOWER(tags) LIKE ?
        )
      ORDER BY is_bestseller DESC, order_count DESC
      LIMIT ?
    `;

    const result = await this.db
      .prepare(query)
      .bind(tenantId, searchTerm, searchTerm, searchTerm, searchTerm, limit)
      .all();

    return result.results as MenuItem[];
  }
}

/**
 * Helper function to parse tags from JSON string
 */
export function parseTags(tagsJson?: string): string[] {
  if (!tagsJson) return [];
  try {
    return JSON.parse(tagsJson);
  } catch {
    return [];
  }
}

/**
 * Helper function to check if item has a specific tag
 */
export function hasTag(item: MenuItem, tag: string): boolean {
  const tags = parseTags(item.tags);
  return tags.includes(tag);
}
