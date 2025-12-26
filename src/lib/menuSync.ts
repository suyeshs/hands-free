import Database from "@tauri-apps/plugin-sql";
import backendApi from "./backendApi";

/**
 * HOTFIX: Activate all menu items in database
 * Fixes items that were synced with active = 0
 */
export async function activateAllMenuItems(): Promise<void> {
  try {
    const db = await Database.load("sqlite:pos.db");
    await db.execute("UPDATE menu_items SET active = 1");
    console.log('[Menu Sync] Activated all menu items in database');
    return;
  } catch (error) {
    console.error('[Menu Sync] Failed to activate menu items:', error);
  }
}

/**
 * Sync menu from backend API to local SQLite database
 * This ensures the POS has an offline copy of the menu
 */
export async function syncMenuFromBackend(tenantId: string): Promise<{
  synced: number;
  categoriesCreated: number;
  itemsCreated: number;
}> {
  console.log(`[Menu Sync] Starting sync for tenant: ${tenantId}`);

  try {
    // 1. Fetch menu from backend API
    const { items, count } = await backendApi.getMenu(tenantId);
    console.log(`[Menu Sync] Fetched ${count} items from backend`);

    if (count === 0) {
      console.log('[Menu Sync] No menu items found in backend');
      return { synced: 0, categoriesCreated: 0, itemsCreated: 0 };
    }

    // 2. Get database connection
    const db = await Database.load("sqlite:pos.db");

    // 2.5. HOTFIX: Update any existing inactive items to active
    // (fixes items synced before the active=1 default was added)
    await db.execute("UPDATE menu_items SET active = 1 WHERE active = 0");
    console.log('[Menu Sync] Updated inactive items to active');

    // 3. Extract unique categories from menu items
    const categorySet = new Set<string>();
    items.forEach(item => {
      if (item.category) {
        categorySet.add(item.category);
      }
    });

    const categories = Array.from(categorySet);
    console.log(`[Menu Sync] Found ${categories.length} categories`);

    // 4. Clear existing menu data for this tenant
    // Note: In a multi-tenant setup, you'd want to scope this by tenant_id
    // For now, we'll clear all and insert fresh data
    await db.execute("DELETE FROM menu_items");
    await db.execute("DELETE FROM menu_categories");
    console.log('[Menu Sync] Cleared existing menu data');

    // 5. Insert categories
    let categoriesCreated = 0;
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const categoryId = `cat-${category.toLowerCase().replace(/\s+/g, '-')}`;

      await db.execute(
        `INSERT INTO menu_categories (id, name, sort_order, active, icon) VALUES (?, ?, ?, 1, ?)`,
        [categoryId, category, i + 1, getCategoryIcon(category)]
      );
      categoriesCreated++;
    }
    console.log(`[Menu Sync] Created ${categoriesCreated} categories`);

    // 6. Insert menu items
    let itemsCreated = 0;
    for (const item of items) {
      const categoryId = `cat-${item.category.toLowerCase().replace(/\s+/g, '-')}`;
      const itemId = item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Map backend MenuItem to local database schema
      await db.execute(
        `INSERT INTO menu_items (
          id, category_id, name, description, price, image, active,
          preparation_time, allergens, dietary_tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          categoryId,
          item.name,
          item.description || '',
          item.price,
          (item as any).photoUrl || item.imageUrl || null,
          // Default to active (1) if available field is not explicitly false
          item.available === false ? 0 : 1,
          parseInt(item.preparationTime) || 15,
          JSON.stringify(item.allergens || []),
          JSON.stringify(getDietaryTags(item))
        ]
      );
      itemsCreated++;
    }
    console.log(`[Menu Sync] Created ${itemsCreated} menu items`);

    const result = {
      synced: count,
      categoriesCreated,
      itemsCreated
    };

    console.log('[Menu Sync] Sync complete:', result);
    return result;

  } catch (error) {
    console.error('[Menu Sync] Sync failed:', error);
    throw error;
  }
}

/**
 * Extract dietary tags from HandsFree API item format
 * HandsFree API may return tags as object {popular, featured, etc} or array
 */
function getDietaryTags(item: any): string[] {
  const tags: string[] = [];

  // Extract from item.dietaryTags array (if present)
  if (Array.isArray(item.dietaryTags)) {
    tags.push(...item.dietaryTags);
  }

  // Extract from item.tags object (HandsFree format)
  if (item.tags && typeof item.tags === 'object') {
    if (item.tags.popular) tags.push('popular');
    if (item.tags.featured) tags.push('featured');
    if (item.tags.seasonal) tags.push('seasonal');
    if (item.tags.chefSpecial) tags.push('chef-special');
  }

  // Extract from boolean flags
  if (item.isVegetarian || item.isVeg) tags.push('vegetarian');
  if (item.isVegan) tags.push('vegan');
  if (item.isHalal) tags.push('halal');
  if (item.isKosher) tags.push('kosher');
  if (item.isGlutenFree || (item.containsGluten === false)) tags.push('gluten-free');
  if (item.containsDairy === false) tags.push('dairy-free');
  if (item.containsNuts === false) tags.push('nut-free');

  // Add special markers
  if (item.isPopular) tags.push('popular');
  if (item.isChefSpecial) tags.push('chef-special');

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Get a default icon for a category based on its name
 */
function getCategoryIcon(categoryName: string): string {
  const name = categoryName.toLowerCase();

  if (name.includes('appetizer') || name.includes('starter')) return '🥗';
  if (name.includes('main') || name.includes('entree')) return '🍽️';
  if (name.includes('dessert') || name.includes('sweet')) return '🍰';
  if (name.includes('beverage') || name.includes('drink')) return '🥤';
  if (name.includes('bread') || name.includes('naan')) return '🍞';
  if (name.includes('rice') || name.includes('biryani')) return '🍚';
  if (name.includes('curry')) return '🍛';
  if (name.includes('tandoor') || name.includes('grill')) return '🔥';
  if (name.includes('salad')) return '🥗';
  if (name.includes('soup')) return '🍲';
  if (name.includes('snack')) return '🍿';

  return '🍽️'; // Default
}

/**
 * Check if menu sync is needed
 * Returns true if local database is empty or stale
 */
export async function needsMenuSync(): Promise<boolean> {
  try {
    const db = await Database.load("sqlite:pos.db");
    const result = await db.select<Array<{ count: number }>>(
      "SELECT COUNT(*) as count FROM menu_items"
    );

    const count = result[0]?.count || 0;
    console.log(`[Menu Sync] Local database has ${count} items`);

    // Sync if we have no items
    return count === 0;
  } catch (error) {
    console.error('[Menu Sync] Failed to check sync status:', error);
    return true; // Assume we need sync if check fails
  }
}

/**
 * Auto-sync menu after login
 * Call this after successful authentication
 * Always syncs to ensure POS has latest menu from cloud
 */
export async function autoSyncMenu(tenantId: string, forceSync: boolean = false): Promise<void> {
  try {
    const shouldSync = forceSync || await needsMenuSync();

    if (shouldSync) {
      console.log('[Menu Sync] Auto-sync triggered');
      await syncMenuFromBackend(tenantId);
    } else {
      console.log('[Menu Sync] Skipping auto-sync (menu already present, use forceSync to override)');
    }
  } catch (error) {
    console.error('[Menu Sync] Auto-sync failed:', error);
    // Don't throw - allow app to continue even if sync fails
  }
}

/**
 * Force sync menu - always syncs regardless of local state
 * Use this when you know changes were made in the admin panel
 */
export async function forceSyncMenu(tenantId: string): Promise<{
  synced: number;
  categoriesCreated: number;
  itemsCreated: number;
}> {
  console.log('[Menu Sync] Force sync triggered');
  return await syncMenuFromBackend(tenantId);
}
