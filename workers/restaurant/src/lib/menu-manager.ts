/**
 * Menu Manager Library
 *
 * Provides CRUD operations for menu categories, items, images, and metadata
 * All operations use tenant-specific D1 databases for data isolation
 */

import { getTenantDatabase } from './tenant-db-resolver';

/**
 * Menu Category
 */
export interface MenuCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  displayOrder: number;
  parentCategoryId?: string;
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Menu Item
 */
export interface MenuItem {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  categoryId: string;
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
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Menu Image
 */
export interface MenuImage {
  id: string;
  tenantId: string;
  menuItemId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  storageType: 'r2' | 'cloudflare_images';
  storagePath: string;
  publicUrl: string;
  thumbnailUrl?: string;
  variants?: any;
  altText?: string;
  uploadedBy?: string;
  createdAt: string;
}

/**
 * Menu Metadata
 */
export interface MenuMetadata {
  id: string;
  tenantId: string;
  cuisines?: string[];
  dietaryTags?: string[];
  spiceLevels?: string[];
  businessHours?: any;
  allowCustomization: boolean;
  showCalories: boolean;
  showAllergens: boolean;
  defaultPreparationTime: number;
  lastUpdated: string;
  version: number;
}

/**
 * Input types for creating/updating entities
 */
export interface CreateCategoryInput {
  name: string;
  description?: string;
  displayOrder?: number;
  parentCategoryId?: string;
  imageUrl?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  displayOrder?: number;
  parentCategoryId?: string;
  isActive?: boolean;
  imageUrl?: string;
}

export interface CreateMenuItemInput {
  name: string;
  description?: string;
  categoryId: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  spiceLevel?: 'mild' | 'medium' | 'hot' | 'extra-hot';
  imageUrl?: string;
  thumbnailUrl?: string;
  images?: string[];
  isAvailable?: boolean;
  isFeatured?: boolean;
  preparationTime?: number;
  modifiers?: any[];
  tags?: string[];
  calories?: number;
  allergens?: string[];
  displayOrder?: number;
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  categoryId?: string;
  price?: number;
  originalPrice?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  spiceLevel?: 'mild' | 'medium' | 'hot' | 'extra-hot';
  imageUrl?: string;
  thumbnailUrl?: string;
  images?: string[];
  isAvailable?: boolean;
  isFeatured?: boolean;
  preparationTime?: number;
  modifiers?: any[];
  tags?: string[];
  calories?: number;
  allergens?: string[];
  displayOrder?: number;
}

export interface MenuItemFilters {
  categoryId?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  spiceLevel?: 'mild' | 'medium' | 'hot' | 'extra-hot';
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Environment bindings
 */
export interface Env {
  TENANT_METADATA: KVNamespace;
  [key: string]: any;
}

// ==================== Category Operations ====================

/**
 * Create a new menu category
 */
export async function createCategory(
  tenantId: string,
  input: CreateCategoryInput,
  env: Env
): Promise<MenuCategory> {
  const db = getTenantDatabase(tenantId, env);

  const categoryId = crypto.randomUUID();
  const now = new Date().toISOString();

  const result = await db
    .prepare(
      `INSERT INTO menu_categories (
        id, tenant_id, name, description, display_order,
        parent_category_id, image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      categoryId,
      tenantId,
      input.name,
      input.description || null,
      input.displayOrder || 0,
      input.parentCategoryId || null,
      input.imageUrl || null,
      now,
      now
    )
    .run();

  if (!result.success) {
    throw new Error(`Failed to create category: ${result.error}`);
  }

  return {
    id: categoryId,
    tenantId,
    name: input.name,
    description: input.description,
    displayOrder: input.displayOrder || 0,
    parentCategoryId: input.parentCategoryId,
    isActive: true,
    imageUrl: input.imageUrl,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update an existing category
 */
export async function updateCategory(
  categoryId: string,
  tenantId: string,
  input: UpdateCategoryInput,
  env: Env
): Promise<MenuCategory> {
  const db = getTenantDatabase(tenantId, env);

  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.displayOrder !== undefined) {
    updates.push('display_order = ?');
    values.push(input.displayOrder);
  }
  if (input.parentCategoryId !== undefined) {
    updates.push('parent_category_id = ?');
    values.push(input.parentCategoryId);
  }
  if (input.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(input.isActive ? 1 : 0);
  }
  if (input.imageUrl !== undefined) {
    updates.push('image_url = ?');
    values.push(input.imageUrl);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(categoryId);
  values.push(tenantId);

  const result = await db
    .prepare(
      `UPDATE menu_categories SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
    )
    .bind(...values)
    .run();

  if (!result.success) {
    throw new Error(`Failed to update category: ${result.error}`);
  }

  return getCategory(categoryId, tenantId, env);
}

/**
 * Delete a category
 */
export async function deleteCategory(
  categoryId: string,
  tenantId: string,
  env: Env
): Promise<void> {
  const db = getTenantDatabase(tenantId, env);

  // Check if category has items
  const itemCount = await db
    .prepare('SELECT COUNT(*) as count FROM menu_items WHERE category_id = ? AND tenant_id = ?')
    .bind(categoryId, tenantId)
    .first<{ count: number }>();

  if (itemCount && itemCount.count > 0) {
    throw new Error(
      `Cannot delete category with ${itemCount.count} items. Move or delete items first.`
    );
  }

  const result = await db
    .prepare('DELETE FROM menu_categories WHERE id = ? AND tenant_id = ?')
    .bind(categoryId, tenantId)
    .run();

  if (!result.success) {
    throw new Error(`Failed to delete category: ${result.error}`);
  }
}

/**
 * Get a single category
 */
export async function getCategory(
  categoryId: string,
  tenantId: string,
  env: Env
): Promise<MenuCategory> {
  const db = getTenantDatabase(tenantId, env);

  const category = await db
    .prepare('SELECT * FROM menu_categories WHERE id = ? AND tenant_id = ?')
    .bind(categoryId, tenantId)
    .first<any>();

  if (!category) {
    throw new Error('Category not found');
  }

  return mapCategory(category);
}

/**
 * List all categories for a tenant
 */
export async function listCategories(tenantId: string, env: Env): Promise<MenuCategory[]> {
  const db = getTenantDatabase(tenantId, env);

  const result = await db
    .prepare(
      'SELECT * FROM menu_categories WHERE tenant_id = ? ORDER BY display_order ASC, name ASC'
    )
    .bind(tenantId)
    .all<any>();

  return result.results.map(mapCategory);
}

// ==================== Menu Item Operations ====================

/**
 * Create a new menu item
 */
export async function createMenuItem(
  tenantId: string,
  input: CreateMenuItemInput,
  env: Env
): Promise<MenuItem> {
  const db = getTenantDatabase(tenantId, env);

  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();

  const result = await db
    .prepare(
      `INSERT INTO menu_items (
        id, tenant_id, name, description, category_id,
        price, original_price, currency,
        is_vegetarian, is_vegan, is_gluten_free, is_dairy_free,
        spice_level, image_url, thumbnail_url, images,
        is_available, is_featured, preparation_time,
        modifiers, tags, calories, allergens, display_order,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      itemId,
      tenantId,
      input.name,
      input.description || null,
      input.categoryId,
      input.price,
      input.originalPrice || null,
      input.currency || 'INR',
      input.isVegetarian ? 1 : 0,
      input.isVegan ? 1 : 0,
      input.isGlutenFree ? 1 : 0,
      input.isDairyFree ? 1 : 0,
      input.spiceLevel || null,
      input.imageUrl || null,
      input.thumbnailUrl || null,
      input.images ? JSON.stringify(input.images) : null,
      input.isAvailable !== false ? 1 : 0,
      input.isFeatured ? 1 : 0,
      input.preparationTime || null,
      input.modifiers ? JSON.stringify(input.modifiers) : null,
      input.tags ? JSON.stringify(input.tags) : null,
      input.calories || null,
      input.allergens ? JSON.stringify(input.allergens) : null,
      input.displayOrder || 0,
      now,
      now
    )
    .run();

  if (!result.success) {
    throw new Error(`Failed to create menu item: ${result.error}`);
  }

  return getMenuItem(itemId, tenantId, env);
}

/**
 * Update an existing menu item
 */
export async function updateMenuItem(
  itemId: string,
  tenantId: string,
  input: UpdateMenuItemInput,
  env: Env
): Promise<MenuItem> {
  const db = getTenantDatabase(tenantId, env);

  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.categoryId !== undefined) {
    updates.push('category_id = ?');
    values.push(input.categoryId);
  }
  if (input.price !== undefined) {
    updates.push('price = ?');
    values.push(input.price);
  }
  if (input.originalPrice !== undefined) {
    updates.push('original_price = ?');
    values.push(input.originalPrice);
  }
  if (input.isVegetarian !== undefined) {
    updates.push('is_vegetarian = ?');
    values.push(input.isVegetarian ? 1 : 0);
  }
  if (input.isVegan !== undefined) {
    updates.push('is_vegan = ?');
    values.push(input.isVegan ? 1 : 0);
  }
  if (input.isGlutenFree !== undefined) {
    updates.push('is_gluten_free = ?');
    values.push(input.isGlutenFree ? 1 : 0);
  }
  if (input.isDairyFree !== undefined) {
    updates.push('is_dairy_free = ?');
    values.push(input.isDairyFree ? 1 : 0);
  }
  if (input.spiceLevel !== undefined) {
    updates.push('spice_level = ?');
    values.push(input.spiceLevel);
  }
  if (input.imageUrl !== undefined) {
    updates.push('image_url = ?');
    values.push(input.imageUrl);
  }
  if (input.thumbnailUrl !== undefined) {
    updates.push('thumbnail_url = ?');
    values.push(input.thumbnailUrl);
  }
  if (input.images !== undefined) {
    updates.push('images = ?');
    values.push(JSON.stringify(input.images));
  }
  if (input.isAvailable !== undefined) {
    updates.push('is_available = ?');
    values.push(input.isAvailable ? 1 : 0);
  }
  if (input.isFeatured !== undefined) {
    updates.push('is_featured = ?');
    values.push(input.isFeatured ? 1 : 0);
  }
  if (input.preparationTime !== undefined) {
    updates.push('preparation_time = ?');
    values.push(input.preparationTime);
  }
  if (input.modifiers !== undefined) {
    updates.push('modifiers = ?');
    values.push(JSON.stringify(input.modifiers));
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }
  if (input.calories !== undefined) {
    updates.push('calories = ?');
    values.push(input.calories);
  }
  if (input.allergens !== undefined) {
    updates.push('allergens = ?');
    values.push(JSON.stringify(input.allergens));
  }
  if (input.displayOrder !== undefined) {
    updates.push('display_order = ?');
    values.push(input.displayOrder);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(itemId);
  values.push(tenantId);

  const result = await db
    .prepare(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...values)
    .run();

  if (!result.success) {
    throw new Error(`Failed to update menu item: ${result.error}`);
  }

  return getMenuItem(itemId, tenantId, env);
}

/**
 * Delete a menu item
 */
export async function deleteMenuItem(itemId: string, tenantId: string, env: Env): Promise<void> {
  const db = getTenantDatabase(tenantId, env);

  const result = await db
    .prepare('DELETE FROM menu_items WHERE id = ? AND tenant_id = ?')
    .bind(itemId, tenantId)
    .run();

  if (!result.success) {
    throw new Error(`Failed to delete menu item: ${result.error}`);
  }
}

/**
 * Get a single menu item
 */
export async function getMenuItem(itemId: string, tenantId: string, env: Env): Promise<MenuItem> {
  const db = getTenantDatabase(tenantId, env);

  const item = await db
    .prepare(`
      SELECT
        mi.*,
        mc.name as category_name
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.id = ? AND mi.tenant_id = ?
    `)
    .bind(itemId, tenantId)
    .first<any>();

  if (!item) {
    throw new Error('Menu item not found');
  }

  return mapMenuItem(item);
}

/**
 * List menu items with filters
 */
export async function listMenuItems(
  tenantId: string,
  filters: MenuItemFilters,
  env: Env
): Promise<{ items: MenuItem[]; total: number }> {
  const db = getTenantDatabase(tenantId, env);

  const conditions: string[] = ['mi.tenant_id = ?'];
  const values: any[] = [tenantId];

  if (filters.categoryId) {
    conditions.push('mi.category_id = ?');
    values.push(filters.categoryId);
  }
  if (filters.isAvailable !== undefined) {
    conditions.push('mi.is_available = ?');
    values.push(filters.isAvailable ? 1 : 0);
  }
  if (filters.isFeatured !== undefined) {
    conditions.push('mi.is_featured = ?');
    values.push(filters.isFeatured ? 1 : 0);
  }
  if (filters.isVegetarian !== undefined) {
    conditions.push('mi.is_vegetarian = ?');
    values.push(filters.isVegetarian ? 1 : 0);
  }
  if (filters.isVegan !== undefined) {
    conditions.push('mi.is_vegan = ?');
    values.push(filters.isVegan ? 1 : 0);
  }
  if (filters.isGlutenFree !== undefined) {
    conditions.push('mi.is_gluten_free = ?');
    values.push(filters.isGlutenFree ? 1 : 0);
  }
  if (filters.isDairyFree !== undefined) {
    conditions.push('mi.is_dairy_free = ?');
    values.push(filters.isDairyFree ? 1 : 0);
  }
  if (filters.spiceLevel) {
    conditions.push('mi.spice_level = ?');
    values.push(filters.spiceLevel);
  }
  if (filters.search) {
    conditions.push('(mi.name LIKE ? OR mi.description LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    values.push(searchTerm, searchTerm);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count (using JOIN to match the main query)
  const countResult = await db
    .prepare(`
      SELECT COUNT(*) as count
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE ${whereClause}
    `)
    .bind(...values)
    .first<{ count: number }>();

  const total = countResult?.count || 0;

  // Get items with pagination
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const result = await db
    .prepare(
      `SELECT
        mi.*,
        mc.name as category_name
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE ${whereClause}
      ORDER BY mi.display_order ASC, mi.name ASC
      LIMIT ? OFFSET ?`
    )
    .bind(...values, limit, offset)
    .all<any>();

  return {
    items: result.results.map(mapMenuItem),
    total,
  };
}

// ==================== Menu Metadata Operations ====================

/**
 * Get menu metadata for a tenant
 */
export async function getMenuMetadata(tenantId: string, env: Env): Promise<MenuMetadata> {
  const db = getTenantDatabase(tenantId, env);

  const metadata = await db
    .prepare('SELECT * FROM menu_metadata WHERE tenant_id = ? LIMIT 1')
    .bind(tenantId)
    .first<any>();

  if (!metadata) {
    // Return default metadata
    return {
      id: crypto.randomUUID(),
      tenantId,
      allowCustomization: true,
      showCalories: false,
      showAllergens: true,
      defaultPreparationTime: 30,
      lastUpdated: new Date().toISOString(),
      version: 1,
    };
  }

  return mapMenuMetadata(metadata);
}

/**
 * Update menu metadata
 */
export async function updateMenuMetadata(
  tenantId: string,
  input: Partial<MenuMetadata>,
  env: Env
): Promise<MenuMetadata> {
  const db = getTenantDatabase(tenantId, env);

  // Check if metadata exists
  const existing = await db
    .prepare('SELECT id FROM menu_metadata WHERE tenant_id = ? LIMIT 1')
    .bind(tenantId)
    .first<{ id: string }>();

  const now = new Date().toISOString();

  if (!existing) {
    // Create new metadata
    const metadataId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO menu_metadata (
          id, tenant_id, cuisines, dietary_tags, spice_levels,
          business_hours, allow_customization, show_calories,
          show_allergens, default_preparation_time, last_updated, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        metadataId,
        tenantId,
        input.cuisines ? JSON.stringify(input.cuisines) : null,
        input.dietaryTags ? JSON.stringify(input.dietaryTags) : null,
        input.spiceLevels ? JSON.stringify(input.spiceLevels) : null,
        input.businessHours ? JSON.stringify(input.businessHours) : null,
        input.allowCustomization !== false ? 1 : 0,
        input.showCalories ? 1 : 0,
        input.showAllergens !== false ? 1 : 0,
        input.defaultPreparationTime || 30,
        now,
        1
      )
      .run();
  } else {
    // Update existing metadata
    const updates: string[] = [];
    const values: any[] = [];

    if (input.cuisines !== undefined) {
      updates.push('cuisines = ?');
      values.push(JSON.stringify(input.cuisines));
    }
    if (input.dietaryTags !== undefined) {
      updates.push('dietary_tags = ?');
      values.push(JSON.stringify(input.dietaryTags));
    }
    if (input.spiceLevels !== undefined) {
      updates.push('spice_levels = ?');
      values.push(JSON.stringify(input.spiceLevels));
    }
    if (input.businessHours !== undefined) {
      updates.push('business_hours = ?');
      values.push(JSON.stringify(input.businessHours));
    }
    if (input.allowCustomization !== undefined) {
      updates.push('allow_customization = ?');
      values.push(input.allowCustomization ? 1 : 0);
    }
    if (input.showCalories !== undefined) {
      updates.push('show_calories = ?');
      values.push(input.showCalories ? 1 : 0);
    }
    if (input.showAllergens !== undefined) {
      updates.push('show_allergens = ?');
      values.push(input.showAllergens ? 1 : 0);
    }
    if (input.defaultPreparationTime !== undefined) {
      updates.push('default_preparation_time = ?');
      values.push(input.defaultPreparationTime);
    }

    updates.push('last_updated = ?');
    values.push(now);

    updates.push('version = version + 1');

    values.push(tenantId);

    await db
      .prepare(`UPDATE menu_metadata SET ${updates.join(', ')} WHERE tenant_id = ?`)
      .bind(...values)
      .run();
  }

  return getMenuMetadata(tenantId, env);
}

// ==================== Helper Functions ====================

function mapCategory(row: any): MenuCategory {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    displayOrder: row.display_order,
    parentCategoryId: row.parent_category_id,
    isActive: row.is_active === 1,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMenuItem(row: any): MenuItem & { category?: string } {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    category: row.category_name || row.category_id, // Include category name for frontend compatibility
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
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMenuMetadata(row: any): MenuMetadata {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    cuisines: row.cuisines ? JSON.parse(row.cuisines) : undefined,
    dietaryTags: row.dietary_tags ? JSON.parse(row.dietary_tags) : undefined,
    spiceLevels: row.spice_levels ? JSON.parse(row.spice_levels) : undefined,
    businessHours: row.business_hours ? JSON.parse(row.business_hours) : undefined,
    allowCustomization: row.allow_customization === 1,
    showCalories: row.show_calories === 1,
    showAllergens: row.show_allergens === 1,
    defaultPreparationTime: row.default_preparation_time,
    lastUpdated: row.last_updated,
    version: row.version,
  };
}
