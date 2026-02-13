/**
 * Menu Cache Layer (Hybrid D1 + KV)
 *
 * - D1: Source of truth for menu data
 * - KV: Edge cache for fast customer-facing reads
 *
 * Cache Strategy:
 * - Write-through: Update D1 then invalidate/update KV
 * - TTL: 24 hours (menu doesn't change frequently)
 * - Manual invalidation on menu updates
 */

import { getTenantDatabase } from './tenant-db-resolver';

/**
 * Environment bindings
 */
export interface Env {
  TENANT_METADATA: KVNamespace;
  [key: string]: any;
}

/**
 * Cached menu structure
 */
export interface CachedMenu {
  categories: MenuCategory[];
  items: MenuItem[];
  metadata: MenuMetadata;
  cachedAt: string;
  version: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  parentCategoryId?: string;
  imageUrl?: string;
  customFields?: any;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName?: string;  // Denormalized for easier access
  price: number;
  originalPrice?: number;
  currency: string;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  spiceLevel?: 'mild' | 'medium' | 'hot' | 'extra-hot';
  imageUrl?: string;
  thumbnailUrl?: string;
  images?: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  preparationTime?: number;
  modifiers?: any[];
  tags?: string[];
  calories?: number;
  allergens?: string[];
  customFields?: any;
  displayOrder: number;
}

export interface MenuMetadata {
  tenantId: string;
  cuisines?: string[];
  dietaryTags?: string[];
  spiceLevels?: string[];
  businessHours?: any;
  allowCustomization: boolean;
  showCalories: boolean;
  showAllergens: boolean;
  defaultPreparationTime: number;
  version: number;
}

/**
 * Get menu from cache (KV) or D1
 */
export async function getMenuCached(tenantId: string, env: Env): Promise<CachedMenu> {
  const cacheKey = `menu:${tenantId}:full`;

  // Try KV cache first
  const cached = await env.TENANT_METADATA.get<CachedMenu>(cacheKey, 'json');

  if (cached) {
    console.log(`[MenuCache] Cache HIT for tenant: ${tenantId}`);
    return cached;
  }

  console.log(`[MenuCache] Cache MISS for tenant: ${tenantId}, fetching from D1...`);

  // Fetch from D1
  const menu = await getMenuFromD1(tenantId, env);

  // Cache in KV (5 minute TTL - short TTL for price/availability freshness)
  const ttl = 5 * 60;  // 5 minutes (was 24 hours - too long for dynamic data)
  await env.TENANT_METADATA.put(cacheKey, JSON.stringify(menu), { expirationTtl: ttl });

  console.log(`[MenuCache] Cached menu for tenant: ${tenantId} (TTL: ${ttl}s)`);

  return menu;
}

/**
 * Fetch full menu from D1 database
 */
export async function getMenuFromD1(tenantId: string, env: Env): Promise<CachedMenu> {
  const db = getTenantDatabase(tenantId, env);

  // Fetch categories
  const categoriesResult = await db
    .prepare(
      'SELECT id, name, description, display_order, parent_category_id, image_url, custom_fields FROM menu_categories WHERE tenant_id = ? ORDER BY display_order ASC, name ASC'
    )
    .bind(tenantId)
    .all<any>();

  const categories: MenuCategory[] = categoriesResult.results.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    displayOrder: row.display_order,
    parentCategoryId: row.parent_category_id,
    imageUrl: row.image_url,
    customFields: row.custom_fields ? JSON.parse(row.custom_fields) : undefined,
  }));

  // Create category map for denormalization
  const categoryMap: { [id: string]: string } = {};
  categories.forEach((cat) => {
    categoryMap[cat.id] = cat.name;
  });

  // Fetch menu items
  const itemsResult = await db
    .prepare(
      `SELECT
        id, name, description, category_id, price, original_price, currency,
        is_vegetarian, is_vegan, is_gluten_free, is_dairy_free, spice_level,
        image_url, thumbnail_url, images,
        is_available, is_featured, preparation_time,
        modifiers, tags, calories, allergens,
        custom_fields, display_order
      FROM menu_items
      WHERE tenant_id = ?
      ORDER BY display_order ASC, name ASC`
    )
    .bind(tenantId)
    .all<any>();

  const items: MenuItem[] = itemsResult.results.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: categoryMap[row.category_id],  // Denormalized
    price: row.price,
    originalPrice: row.original_price,
    currency: row.currency,
    isVegetarian: row.is_vegetarian === 1,
    isVegan: row.is_vegan === 1,
    isGlutenFree: row.is_gluten_free === 1,
    isDairyFree: row.is_dairy_free === 1,
    spiceLevel: row.spice_level,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    images: row.images ? JSON.parse(row.images) : undefined,
    isAvailable: row.is_available === 1,
    isFeatured: row.is_featured === 1,
    preparationTime: row.preparation_time,
    modifiers: row.modifiers ? JSON.parse(row.modifiers) : undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    calories: row.calories,
    allergens: row.allergens ? JSON.parse(row.allergens) : undefined,
    customFields: row.custom_fields ? JSON.parse(row.custom_fields) : undefined,
    displayOrder: row.display_order,
  }));

  // Fetch metadata
  const metadataResult = await db
    .prepare(
      `SELECT
        cuisines, dietary_tags, spice_levels, business_hours,
        allow_customization, show_calories, show_allergens,
        default_preparation_time, version
      FROM menu_metadata
      WHERE tenant_id = ?
      LIMIT 1`
    )
    .bind(tenantId)
    .first<any>();

  const metadata: MenuMetadata = metadataResult
    ? {
        tenantId,
        cuisines: metadataResult.cuisines ? JSON.parse(metadataResult.cuisines) : undefined,
        dietaryTags: metadataResult.dietary_tags ? JSON.parse(metadataResult.dietary_tags) : undefined,
        spiceLevels: metadataResult.spice_levels ? JSON.parse(metadataResult.spice_levels) : undefined,
        businessHours: metadataResult.business_hours ? JSON.parse(metadataResult.business_hours) : undefined,
        allowCustomization: metadataResult.allow_customization === 1,
        showCalories: metadataResult.show_calories === 1,
        showAllergens: metadataResult.show_allergens === 1,
        defaultPreparationTime: metadataResult.default_preparation_time,
        version: metadataResult.version,
      }
    : {
        tenantId,
        allowCustomization: true,
        showCalories: false,
        showAllergens: true,
        defaultPreparationTime: 30,
        version: 1,
      };

  return {
    categories,
    items,
    metadata,
    cachedAt: new Date().toISOString(),
    version: metadata.version,
  };
}

/**
 * Invalidate menu cache after updates
 */
export async function invalidateMenuCache(tenantId: string, env: Env): Promise<void> {
  const cacheKey = `menu:${tenantId}:full`;
  await env.TENANT_METADATA.delete(cacheKey);
  console.log(`[MenuCache] Invalidated cache for tenant: ${tenantId}`);
}

/**
 * Refresh cache (fetch from D1 and update KV)
 */
export async function refreshMenuCache(tenantId: string, env: Env): Promise<CachedMenu> {
  console.log(`[MenuCache] Refreshing cache for tenant: ${tenantId}...`);

  // Fetch fresh data from D1
  const menu = await getMenuFromD1(tenantId, env);

  // Update KV cache
  const cacheKey = `menu:${tenantId}:full`;
  const ttl = 5 * 60;  // 5 minutes (short TTL for price/availability freshness)
  await env.TENANT_METADATA.put(cacheKey, JSON.stringify(menu), { expirationTtl: ttl });

  console.log(`[MenuCache] Cache refreshed for tenant: ${tenantId}`);

  return menu;
}

/**
 * Get menu with filters (no cache, direct D1 query for admin)
 */
export async function getMenuFiltered(
  tenantId: string,
  filters: {
    categoryId?: string;
    isAvailable?: boolean;
    isFeatured?: boolean;
    isVegetarian?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  },
  env: Env
): Promise<{ items: MenuItem[]; total: number }> {
  const db = getTenantDatabase(tenantId, env);

  const conditions: string[] = ['tenant_id = ?'];
  const values: any[] = [tenantId];

  if (filters.categoryId) {
    conditions.push('category_id = ?');
    values.push(filters.categoryId);
  }

  if (filters.isAvailable !== undefined) {
    conditions.push('is_available = ?');
    values.push(filters.isAvailable ? 1 : 0);
  }

  if (filters.isFeatured !== undefined) {
    conditions.push('is_featured = ?');
    values.push(filters.isFeatured ? 1 : 0);
  }

  if (filters.isVegetarian !== undefined) {
    conditions.push('is_vegetarian = ?');
    values.push(filters.isVegetarian ? 1 : 0);
  }

  if (filters.search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    values.push(searchTerm, searchTerm);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM menu_items WHERE ${whereClause}`)
    .bind(...values)
    .first<{ count: number }>();

  const total = countResult?.count || 0;

  // Get items with pagination
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const itemsResult = await db
    .prepare(
      `SELECT
        id, name, description, category_id, price, original_price, currency,
        is_vegetarian, is_vegan, is_gluten_free, is_dairy_free, spice_level,
        image_url, thumbnail_url, images,
        is_available, is_featured, preparation_time,
        modifiers, tags, calories, allergens,
        custom_fields, display_order
      FROM menu_items
      WHERE ${whereClause}
      ORDER BY display_order ASC, name ASC
      LIMIT ? OFFSET ?`
    )
    .bind(...values, limit, offset)
    .all<any>();

  const items: MenuItem[] = itemsResult.results.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    price: row.price,
    originalPrice: row.original_price,
    currency: row.currency,
    isVegetarian: row.is_vegetarian === 1,
    isVegan: row.is_vegan === 1,
    isGlutenFree: row.is_gluten_free === 1,
    isDairyFree: row.is_dairy_free === 1,
    spiceLevel: row.spice_level,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    images: row.images ? JSON.parse(row.images) : undefined,
    isAvailable: row.is_available === 1,
    isFeatured: row.is_featured === 1,
    preparationTime: row.preparation_time,
    modifiers: row.modifiers ? JSON.parse(row.modifiers) : undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    calories: row.calories,
    allergens: row.allergens ? JSON.parse(row.allergens) : undefined,
    customFields: row.custom_fields ? JSON.parse(row.custom_fields) : undefined,
    displayOrder: row.display_order,
  }));

  return { items, total };
}
