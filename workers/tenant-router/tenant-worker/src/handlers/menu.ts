/**
 * Menu Handlers for Tenant Worker
 *
 * Provides menu CRUD operations with D1 database access
 *
 * Schema Compatibility:
 * - Supports both OLD POS schema (no tenant_id column) and NEW schema (with tenant_id)
 * - Each tenant worker has its own D1 database binding, so tenant isolation is guaranteed
 * - tenant_id column is optional - when missing, queries work without it
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Schema detection cache (per worker instance)
let schemaCache: { hasTenantId: boolean | null } = { hasTenantId: null };

/**
 * Detect if menu_items table has tenant_id column
 * Cached per worker instance for performance
 */
async function hasTenantIdColumn(db: D1Database): Promise<boolean> {
  if (schemaCache.hasTenantId !== null) {
    return schemaCache.hasTenantId;
  }

  try {
    // Try a simple query with tenant_id - if it fails, column doesn't exist
    await db.prepare('SELECT tenant_id FROM menu_items LIMIT 1').all();
    schemaCache.hasTenantId = true;
    console.log('[Menu] Schema detection: NEW schema (has tenant_id column)');
    return true;
  } catch (error: any) {
    if (error.message?.includes('no such column: tenant_id')) {
      schemaCache.hasTenantId = false;
      console.log('[Menu] Schema detection: OLD POS schema (no tenant_id column)');
      return false;
    }
    // Other errors - assume new schema
    console.warn('[Menu] Schema detection error, assuming new schema:', error.message);
    schemaCache.hasTenantId = true;
    return true;
  }
}

/**
 * Build WHERE clause with optional tenant_id filter
 */
function buildWhereClause(hasTenantId: boolean, additionalConditions?: string): string {
  const tenantFilter = hasTenantId ? 'tenant_id = ?' : '1=1';
  return additionalConditions
    ? `WHERE ${tenantFilter} ${additionalConditions}`
    : `WHERE ${tenantFilter}`;
}

/**
 * Build query parameters with optional tenant_id
 */
function buildParams(hasTenantId: boolean, tenantId: string, additionalParams: any[] = []): any[] {
  return hasTenantId ? [tenantId, ...additionalParams] : additionalParams;
}

// Sync configuration for menu_items table
const menuItemsSyncConfig: SyncTableConfig = {
  tableName: 'menu_items',
  direction: 'bidirectional', // Menu can sync both ways (Cloud ↔ POS)
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'], // Just ID - tenant isolation via separate DB per tenant
  // Note: No timestampColumn - menu_items table doesn't have updated_at in D1 schema
  columns: [
    // D1 Schema: id, category_id, name, description, price, image, active, preparation_time, allergens, dietary_tags, name_translations, description_translations
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    {
      source: 'category_id',
      target: 'category_id',
      type: 'TEXT',
      required: false,
      transform: (val) => val || 'uncategorized' // Default to 'uncategorized' if NULL
    },
    {
      source: 'categoryId',
      target: 'category_id',
      type: 'TEXT',
      required: false,
      transform: (val) => val || 'uncategorized'
    },
    { source: 'name', target: 'name', type: 'TEXT', required: true },
    {
      source: 'description',
      target: 'description',
      type: 'TEXT',
      required: false,
      transform: (val) => val || '' // Default to empty string if NULL
    },
    { source: 'price', target: 'price', type: 'REAL', required: true },
    { source: 'image', target: 'image', type: 'TEXT' },
    { source: 'photoUrl', target: 'image', type: 'TEXT' },
    { source: 'photo_url', target: 'image', type: 'TEXT' },
    { source: 'image_url', target: 'image', type: 'TEXT' },
    {
      source: 'active',
      target: 'active',
      type: 'INTEGER',
      required: false,
      transform: (val) => val ? 1 : 0
    },
    {
      source: 'available',
      target: 'active',
      type: 'INTEGER',
      required: false,
      transform: (val) => val ? 1 : 0
    },
    {
      source: 'preparation_time',
      target: 'preparation_time',
      type: 'INTEGER',
      transform: (val) => val !== null && val !== undefined ? val : 15 // Default to 15 minutes if NULL
    },
    {
      source: 'preparationTime',
      target: 'preparation_time',
      type: 'INTEGER',
      transform: (val) => val !== null && val !== undefined ? val : 15
    },
    { source: 'allergens', target: 'allergens', type: 'TEXT' },
    { source: 'dietary_tags', target: 'dietary_tags', type: 'TEXT' },
    {
      source: 'tags',
      target: 'dietary_tags',
      type: 'TEXT',
      transform: (val) => Array.isArray(val) ? JSON.stringify(val) : val
    },
    { source: 'name_translations', target: 'name_translations', type: 'TEXT' },
    { source: 'description_translations', target: 'description_translations', type: 'TEXT' },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[Menu] Synced ${result.synced}/${result.totalRecords} menu items in ${result.duration}ms`);
    }
  }
};

// Sync configuration for menu_categories table
const menuCategoriesSyncConfig: SyncTableConfig = {
  tableName: 'menu_categories',
  direction: 'bidirectional', // Categories can sync both ways
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'], // Just ID - tenant isolation via separate DB per tenant
  timestampColumn: 'updated_at',
  columns: [
    // D1 Schema: id, name, sort_order, active, icon, description, created_at, updated_at, name_translations
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'name', target: 'name', type: 'TEXT', required: true },
    {
      source: 'sort_order',
      target: 'sort_order',
      type: 'INTEGER',
      transform: (val) => val !== null && val !== undefined ? val : 0 // Default to 0 if null
    },
    {
      source: 'sortOrder',
      target: 'sort_order',
      type: 'INTEGER',
      transform: (val) => val !== null && val !== undefined ? val : 0
    },
    {
      source: 'display_order',
      target: 'sort_order',
      type: 'INTEGER',
      transform: (val) => val !== null && val !== undefined ? val : 0
    },
    {
      source: 'displayOrder',
      target: 'sort_order',
      type: 'INTEGER',
      transform: (val) => val !== null && val !== undefined ? val : 0
    },
    {
      source: 'active',
      target: 'active',
      type: 'INTEGER',
      required: false,
      transform: (val) => val ? 1 : 0
    },
    { source: 'icon', target: 'icon', type: 'TEXT' },
    { source: 'description', target: 'description', type: 'TEXT' },
    { source: 'created_at', target: 'created_at', type: 'TEXT', required: false },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: false },
    { source: 'updated_at', target: 'updated_at', type: 'TEXT', required: false },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: false },
    { source: 'name_translations', target: 'name_translations', type: 'TEXT' },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[Menu] Synced ${result.synced}/${result.totalRecords} categories in ${result.duration}ms`);
    }
  }
};

/**
 * GET /menu - List all menu items
 * Schema-adaptive: works with both old POS schema (no tenant_id) and new schema (with tenant_id)
 */
export async function handleListMenu(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const available = url.searchParams.get('available');
    const search = url.searchParams.get('search');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Detect schema
    const hasColumns = await hasTenantIdColumn(env.DB);

    // Build query with JOIN to get category name
    // OLD schema: no tenant_id column, no display_order, no is_available
    // NEW schema: has tenant_id, display_order, is_available
    const tenantFilter = hasColumns ? 'm.tenant_id = ?' : '1=1';
    let query = `
      SELECT
        m.*,
        c.name as category
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      WHERE ${tenantFilter}
    `;
    const params: any[] = hasColumns ? [tenantId] : [];

    if (category && category !== 'all') {
      query += ` AND c.name = ?`;
      params.push(category);
    }

    // Handle availability - old schema uses 'active', new schema uses 'is_available'
    if (available !== null && available !== undefined && available !== 'all') {
      const availableValue = available === 'true' || available === '1' ? 1 : 0;
      // Try to detect which column exists by checking if active field is present
      query += ` AND (m.is_available = ? OR m.active = ?)`;
      params.push(availableValue, availableValue);
    }

    if (search) {
      query += ` AND (m.name LIKE ? OR m.description LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // Order by - display_order may not exist in old schema
    query += ` ORDER BY c.name, m.name LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();
    const rows = result.results || [];

    // Get total count
    const countTenantFilter = hasColumns ? 'm.tenant_id = ?' : '1=1';
    let countQuery = `
      SELECT COUNT(*) as total
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      WHERE ${countTenantFilter}
    `;
    const countParams: any[] = hasColumns ? [tenantId] : [];

    if (category && category !== 'all') {
      countQuery += ` AND c.name = ?`;
      countParams.push(category);
    }
    if (available !== null && available !== undefined && available !== 'all') {
      const availableValue = available === 'true' || available === '1' ? 1 : 0;
      countQuery += ` AND (m.is_available = ? OR m.active = ?)`;
      countParams.push(availableValue, availableValue);
    }
    if (search) {
      countQuery += ` AND (m.name LIKE ? OR m.description LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first() as { total: number } | null;
    const totalItems = countResult?.total || 0;

    // Normalize items - handle both old and new schema fields
    const items = rows.map((item: any) => {
      const imageUrl = item.image_url || item.photo_url || item.image;
      const isAvailable = item.is_available !== undefined ? item.is_available === 1 : item.active === 1;

      return {
        ...item,
        available: isAvailable,
        isVegetarian: item.is_vegetarian === 1,
        isVegan: item.is_vegan === 1,
        photoUrl: imageUrl,
        tags: item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags) :
              item.dietary_tags ? (typeof item.dietary_tags === 'string' ? JSON.parse(item.dietary_tags) : item.dietary_tags) : [],
      };
    });

    return Response.json({
      success: true,
      tenantId,
      items,
      pagination: {
        limit,
        offset,
        totalItems,
        hasMore: offset + items.length < totalItems,
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Menu] List error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list menu items',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * POST /menu - Create new menu item
 */
export async function handleCreateMenuItem(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;

    // Validate required fields
    if (!body.name) {
      return Response.json({
        success: false,
        error: 'Name is required',
      }, { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    if (!body.category && !body.categoryId) {
      return Response.json({
        success: false,
        error: 'Category is required',
      }, { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Generate ID
    const itemId = body.id || `${tenantId}-item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Find or create category
    let categoryId = body.categoryId;
    if (!categoryId && body.category) {
      // Look up category by name
      const catResult = await env.DB.prepare(
        `SELECT id FROM menu_categories WHERE tenant_id = ? AND name = ?`
      ).bind(tenantId, body.category).first() as { id: string } | null;

      if (catResult) {
        categoryId = catResult.id;
      } else {
        // Create new category
        categoryId = `${tenantId}-cat-${Date.now()}`;
        await env.DB.prepare(`
          INSERT INTO menu_categories (id, tenant_id, name, display_order, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 0, 1, datetime('now'), datetime('now'))
        `).bind(categoryId, tenantId, body.category).run();
      }
    }

    // Insert menu item
    await env.DB.prepare(`
      INSERT INTO menu_items (
        id,
        tenant_id,
        category_id,
        name,
        description,
        price,
        original_price,
        currency,
        is_vegetarian,
        is_vegan,
        is_gluten_free,
        is_dairy_free,
        spice_level,
        image_url,
        is_available,
        is_featured,
        preparation_time,
        calories,
        display_order,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      itemId,
      tenantId,
      categoryId,
      body.name,
      body.description || null,
      body.price || 0,
      body.originalPrice || null,
      body.currency || 'INR',
      body.isVegetarian ? 1 : 0,
      body.isVegan ? 1 : 0,
      body.isGlutenFree ? 1 : 0,
      body.isDairyFree ? 1 : 0,
      body.spiceLevel || null,
      body.photoUrl || body.imageUrl || null,
      body.available !== false ? 1 : 0,
      body.isFeatured ? 1 : 0,
      body.preparationTime || null,
      body.calories || null,
      body.displayOrder || 0
    ).run();

    return Response.json({
      success: true,
      id: itemId,
      itemId: itemId,
      message: 'Menu item created successfully',
    }, { status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Menu] Create item error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to create menu item',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /menu/:itemId - Get single menu item
 * Schema-adaptive: works with both old POS schema (no tenant_id) and new schema (with tenant_id)
 */
export async function handleGetMenuItem(
  request: Request,
  env: Env,
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    // Detect schema
    const hasColumns = await hasTenantIdColumn(env.DB);
    const tenantFilter = hasColumns ? 'AND m.tenant_id = ?' : '';

    const result = await env.DB.prepare(`
      SELECT m.*, c.name as category
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      WHERE m.id = ? ${tenantFilter}
    `).bind(...(hasColumns ? [itemId, tenantId] : [itemId])).first();

    if (!result) {
      return Response.json({
        success: false,
        error: 'Menu item not found',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const item = result as any;
    const imageUrl = item.image_url || item.photo_url || item.image;
    const isAvailable = item.is_available !== undefined ? item.is_available === 1 : item.active === 1;

    return Response.json({
      success: true,
      item: {
        ...item,
        available: isAvailable,
        isVegetarian: item.is_vegetarian === 1,
        isVegan: item.is_vegan === 1,
        photoUrl: imageUrl,
        tags: item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags) :
              item.dietary_tags ? (typeof item.dietary_tags === 'string' ? JSON.parse(item.dietary_tags) : item.dietary_tags) : [],
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Menu] Get item error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get menu item',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * PATCH /menu/:itemId - Update menu item
 * Schema-adaptive: works with both old POS schema (no tenant_id) and new schema (with tenant_id)
 */
export async function handleUpdateMenuItem(
  request: Request,
  env: Env,
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;

    // Detect schema
    const hasColumns = await hasTenantIdColumn(env.DB);
    const tenantFilter = hasColumns ? 'AND tenant_id = ?' : '';

    // Check if item exists
    const existing = await env.DB.prepare(
      `SELECT id FROM menu_items WHERE id = ? ${tenantFilter}`
    ).bind(...(hasColumns ? [itemId, tenantId] : [itemId])).first();

    if (!existing) {
      return Response.json({
        success: false,
        error: 'Menu item not found',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.nameHindi !== undefined) {
      updates.push('name_hindi = ?');
      values.push(body.nameHindi);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.price !== undefined) {
      updates.push('price = ?');
      values.push(body.price);
    }
    if (body.available !== undefined) {
      // Old schema uses 'active', new uses 'is_available'
      updates.push(hasColumns ? 'is_available = ?' : 'active = ?');
      values.push(body.available ? 1 : 0);
    }
    if (body.isVegetarian !== undefined) {
      updates.push('is_vegetarian = ?');
      values.push(body.isVegetarian ? 1 : 0);
    }
    if (body.isVegan !== undefined) {
      updates.push('is_vegan = ?');
      values.push(body.isVegan ? 1 : 0);
    }
    if (body.spiceLevel !== undefined) {
      updates.push('spice_level = ?');
      values.push(body.spiceLevel);
    }
    if (body.photoUrl !== undefined) {
      // Old schema uses 'image', new uses 'image_url'
      updates.push(hasColumns ? 'image_url = ?' : 'image = ?');
      values.push(body.photoUrl);
    }
    if (body.category !== undefined) {
      // Look up category by name
      const categoryTenantFilter = hasColumns ? 'tenant_id = ? AND' : '';
      const catResult = await env.DB.prepare(
        `SELECT id FROM menu_categories WHERE ${categoryTenantFilter} name = ?`
      ).bind(...(hasColumns ? [tenantId, body.category] : [body.category])).first() as { id: string } | null;

      if (catResult) {
        updates.push('category_id = ?');
        values.push(catResult.id);
      }
    }

    if (updates.length === 0) {
      return Response.json({
        success: false,
        error: 'No fields to update',
      }, { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Only add updated_at if the column exists (old schema has it)
    updates.push("updated_at = datetime('now')");

    // Add WHERE parameters
    values.push(itemId);
    if (hasColumns) values.push(tenantId);

    await env.DB.prepare(
      `UPDATE menu_items SET ${updates.join(', ')} WHERE id = ? ${tenantFilter}`
    ).bind(...values).run();

    return Response.json({
      success: true,
      message: 'Menu item updated successfully',
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Menu] Update item error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to update menu item',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * DELETE /menu/:itemId - Delete menu item
 * Schema-adaptive: works with both old POS schema (no tenant_id) and new schema (with tenant_id)
 */
export async function handleDeleteMenuItem(
  request: Request,
  env: Env,
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    // Detect schema
    const hasColumns = await hasTenantIdColumn(env.DB);
    const tenantFilter = hasColumns ? 'AND tenant_id = ?' : '';

    const result = await env.DB.prepare(
      `DELETE FROM menu_items WHERE id = ? ${tenantFilter}`
    ).bind(...(hasColumns ? [itemId, tenantId] : [itemId])).run();

    if (result.meta?.changes === 0) {
      return Response.json({
        success: false,
        error: 'Menu item not found',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    return Response.json({
      success: true,
      message: 'Menu item deleted successfully',
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Menu] Delete item error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to delete menu item',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /categories - List all categories
 * Schema-adaptive: works with both old POS schema (no tenant_id) and new schema (with tenant_id)
 */
export async function handleListCategories(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    // Detect schema
    const hasColumns = await hasTenantIdColumn(env.DB);
    const tenantFilter = hasColumns ? 'tenant_id = ?' : '1=1';

    // Fetch all categories
    // OLD schema: id, name, sort_order, active, icon, description, created_at, updated_at, name_translations
    // NEW schema: adds tenant_id, parent_category_id, changes sort_order to display_order, active to is_active
    const categories = await env.DB.prepare(`
      SELECT
        id,
        name,
        description,
        created_at,
        updated_at
      FROM menu_categories
      WHERE ${tenantFilter}
      ORDER BY name ASC
    `).bind(...(hasColumns ? [tenantId] : [])).all();

    const rows = categories.results || [];

    // Get item counts for each category
    const counts = await env.DB.prepare(`
      SELECT category_id, COUNT(*) as count
      FROM menu_items
      WHERE ${tenantFilter}
      GROUP BY category_id
    `).bind(...(hasColumns ? [tenantId] : [])).all();

    const countMap = new Map((counts.results || []).map((c: any) => [c.category_id, c.count]));

    // Build hierarchy with icons
    const categoryList = rows.map((cat: any) => ({
      ...cat,
      item_count: countMap.get(cat.id) || 0,
      icon: getCategoryIcon(cat.name),
    }));

    return Response.json({
      success: true,
      categories: categoryList,
      totalCategories: rows.length,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Categories] List error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list categories',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * POST /categories - Create a new category
 */
export async function handleCreateCategory(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;

    if (!body.name || !body.name.trim()) {
      return Response.json({
        success: false,
        error: 'Category name is required',
      }, { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Generate category ID
    const categoryId = `${tenantId}-cat-${Date.now()}`;

    // Insert category
    await env.DB.prepare(`
      INSERT INTO menu_categories (
        id, tenant_id, name, description, parent_category_id,
        display_order, is_active, image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
    `).bind(
      categoryId,
      tenantId,
      body.name.trim(),
      body.description || null,
      body.parent_id || null,
      body.display_order || 0,
      body.image_url || null
    ).run();

    // Fetch the created category
    const category = await env.DB.prepare(`
      SELECT * FROM menu_categories WHERE id = ?
    `).bind(categoryId).first();

    return Response.json({
      success: true,
      category: {
        ...category,
        icon: getCategoryIcon(category.name as string),
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Categories] Create error:', error);
    return Response.json({
      success: false,
      error: 'Failed to create category',
      details: error.message,
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /categories/{categoryId} - Get a specific category
 */
export async function handleGetCategory(
  request: Request,
  env: Env,
  tenantId: string,
  categoryId: string
): Promise<Response> {
  try {
    const category = await env.DB.prepare(`
      SELECT * FROM menu_categories WHERE id = ? AND tenant_id = ?
    `).bind(categoryId, tenantId).first();

    if (!category) {
      return Response.json({
        success: false,
        error: 'Category not found',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Get item count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM menu_items WHERE category_id = ? AND tenant_id = ?
    `).bind(categoryId, tenantId).first() as { count: number } | null;

    return Response.json({
      success: true,
      category: {
        ...category,
        item_count: countResult?.count || 0,
        icon: getCategoryIcon(category.name as string),
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Categories] Get error:', error);
    return Response.json({
      success: false,
      error: 'Failed to get category',
      details: error.message,
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * PATCH /categories/{categoryId} - Update a category
 */
export async function handleUpdateCategory(
  request: Request,
  env: Env,
  tenantId: string,
  categoryId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;

    // Check if category exists
    const existing = await env.DB.prepare(`
      SELECT id FROM menu_categories WHERE id = ? AND tenant_id = ?
    `).bind(categoryId, tenantId).first();

    if (!existing) {
      return Response.json({
        success: false,
        error: 'Category not found',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      params.push(body.name.trim());
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      params.push(body.description || null);
    }
    if (body.parent_id !== undefined) {
      updates.push('parent_category_id = ?');
      params.push(body.parent_id || null);
    }
    if (body.display_order !== undefined) {
      updates.push('display_order = ?');
      params.push(body.display_order);
    }
    if (body.image_url !== undefined) {
      updates.push('image_url = ?');
      params.push(body.image_url || null);
    }
    // Note: icon is auto-generated from category name, not stored in DB

    if (updates.length === 0) {
      return Response.json({
        success: false,
        error: 'No fields to update',
      }, { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    updates.push('updated_at = datetime(\'now\')');
    params.push(categoryId, tenantId);

    await env.DB.prepare(`
      UPDATE menu_categories
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `).bind(...params).run();

    // Fetch updated category
    const category = await env.DB.prepare(`
      SELECT * FROM menu_categories WHERE id = ?
    `).bind(categoryId).first();

    return Response.json({
      success: true,
      category: {
        ...category,
        icon: getCategoryIcon(category.name as string),
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Categories] Update error:', error);
    return Response.json({
      success: false,
      error: 'Failed to update category',
      details: error.message,
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * DELETE /categories/{categoryId} - Delete a category
 */
export async function handleDeleteCategory(
  request: Request,
  env: Env,
  tenantId: string,
  categoryId: string
): Promise<Response> {
  try {
    // Check if category exists
    const existing = await env.DB.prepare(`
      SELECT id FROM menu_categories WHERE id = ? AND tenant_id = ?
    `).bind(categoryId, tenantId).first();

    if (!existing) {
      return Response.json({
        success: false,
        error: 'Category not found',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Check if category has items
    const itemCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM menu_items WHERE category_id = ? AND tenant_id = ?
    `).bind(categoryId, tenantId).first() as { count: number } | null;

    if (itemCount && itemCount.count > 0) {
      // Reassign items to null category
      await env.DB.prepare(`
        UPDATE menu_items SET category_id = NULL WHERE category_id = ? AND tenant_id = ?
      `).bind(categoryId, tenantId).run();
    }

    // Delete the category
    await env.DB.prepare(`
      DELETE FROM menu_categories WHERE id = ? AND tenant_id = ?
    `).bind(categoryId, tenantId).run();

    return Response.json({
      success: true,
      message: 'Category deleted successfully',
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Categories] Delete error:', error);
    return Response.json({
      success: false,
      error: 'Failed to delete category',
      details: error.message,
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * Get emoji icon for category based on name
 */
function getCategoryIcon(name: string): string {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('appetizer') || nameLower.includes('starter')) return '🥗';
  if (nameLower.includes('main') || nameLower.includes('entree') || nameLower.includes('curry')) return '🍛';
  if (nameLower.includes('dessert') || nameLower.includes('sweet')) return '🍰';
  if (nameLower.includes('beverage') || nameLower.includes('drink') || nameLower.includes('juice')) return '🥤';
  if (nameLower.includes('bread') || nameLower.includes('naan') || nameLower.includes('roti')) return '🍞';
  if (nameLower.includes('rice') || nameLower.includes('biryani') || nameLower.includes('pulao')) return '🍚';
  if (nameLower.includes('soup')) return '🍲';
  if (nameLower.includes('salad')) return '🥗';
  if (nameLower.includes('seafood') || nameLower.includes('fish')) return '🐟';
  if (nameLower.includes('chicken') || nameLower.includes('tandoori')) return '🍗';
  if (nameLower.includes('mutton') || nameLower.includes('lamb')) return '🥩';
  if (nameLower.includes('paneer') || nameLower.includes('veg')) return '🥬';
  if (nameLower.includes('south indian') || nameLower.includes('dosa') || nameLower.includes('idli')) return '🥞';
  if (nameLower.includes('chinese') || nameLower.includes('noodle')) return '🍜';
  if (nameLower.includes('pizza')) return '🍕';
  if (nameLower.includes('burger')) return '🍔';
  if (nameLower.includes('combo') || nameLower.includes('thali') || nameLower.includes('meal')) return '🍱';
  if (nameLower.includes('special') || nameLower.includes('today')) return '⭐';
  if (nameLower.includes('popular') || nameLower.includes('best')) return '🔥';

  return '🍽️'; // Default
}

/**
 * POST /menu/sync - Sync menu items from POS to D1 using SyncEngine
 */
export async function handleMenuItemsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { menuItems: any[] };
    const menuItems = body.menuItems || [];

    if (menuItems.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(menuItemsSyncConfig, menuItems);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Menu] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync menu items',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /categories/sync - Sync menu categories from POS to D1 using SyncEngine
 */
export async function handleMenuCategoriesSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { categories: any[] };
    const categories = body.categories || [];

    if (categories.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(menuCategoriesSyncConfig, categories);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Categories] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync categories',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /menu/upload-photos - Match uploaded photos to menu items using fuzzy logic
 *
 * Request body: { photos: [{cloudflareId, filename}] }
 *
 * Algorithm:
 * - Cleans filenames (remove extensions, normalize separators)
 * - Compares against menu item names using Levenshtein distance
 * - 70% similarity threshold for auto-assignment
 * - 80% similarity threshold for duplicate detection
 * - Updates menu_items.image with matched photos
 * - Saves unmatched photos to unassigned_images table
 */
export async function handleUploadPhotos(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { photos: Array<{ cloudflareId: string; filename: string }> };
    const photos = body.photos || [];

    if (photos.length === 0) {
      return Response.json({
        success: false,
        error: 'No photos provided',
      }, { status: 400, headers: CORS_HEADERS });
    }

    console.log(`[Photo Matching] Processing ${photos.length} photos for tenant: ${tenantId}`);

    // Check if schema has tenant_id column
    const hasSchema = await hasTenantIdColumn(env.DB);

    // Fetch all menu items for this tenant
    const whereClause = buildWhereClause(hasSchema);
    const params = buildParams(hasSchema, tenantId);

    const menuItemsResult = await env.DB
      .prepare(`SELECT id, name, category_id, image FROM menu_items ${whereClause}`)
      .bind(...params)
      .all();

    const menuItems = menuItemsResult.results || [];

    if (menuItems.length === 0) {
      console.error(`[Photo Matching] No menu items found for tenant: ${tenantId}`);
      return Response.json({
        success: false,
        error: 'No menu items found for tenant',
        tenantId,
      }, { status: 404, headers: CORS_HEADERS });
    }

    console.log(`[Photo Matching] Found ${menuItems.length} menu items for tenant ${tenantId}`);

    // Match photos to menu items
    const matched: any[] = [];
    const unmatched: any[] = [];

    for (const photo of photos) {
      const { cloudflareId, filename } = photo;
      const imageUrl = getCloudflareImageUrl(cloudflareId);

      // Clean filename for matching (remove extension, replace separators)
      const cleanedFilename = cleanFilename(filename);

      // Find best match
      const bestMatch = findBestMatch(cleanedFilename, menuItems as any[]);

      if (bestMatch && bestMatch.score >= 0.7) {
        // Update menu item with matched image
        try {
          const updateParams = hasSchema
            ? [imageUrl, tenantId, bestMatch.item.id]
            : [imageUrl, bestMatch.item.id];

          const updateQuery = hasSchema
            ? 'UPDATE menu_items SET image = ? WHERE tenant_id = ? AND id = ?'
            : 'UPDATE menu_items SET image = ? WHERE id = ?';

          await env.DB
            .prepare(updateQuery)
            .bind(...updateParams)
            .run();

          matched.push({
            filename,
            imageUrl,
            imageId: cloudflareId,
            matched: true,
            matchedItem: {
              id: bestMatch.item.id,
              name: bestMatch.item.name,
              category: bestMatch.item.category_id,
            },
            similarityScore: bestMatch.score,
          });

          console.log(
            `[Photo Matching] ✓ Matched: ${filename} → ${bestMatch.item.name} (${(bestMatch.score * 100).toFixed(1)}%)`
          );
        } catch (updateError: any) {
          console.error(`[Photo Matching] Failed to update for ${filename}:`, updateError);
          unmatched.push({
            filename,
            imageUrl,
            imageId: cloudflareId,
            matched: false,
            error: 'Database update failed',
          });
        }
      } else {
        // No match found - check for duplicates before saving to unassigned_images
        let isDuplicate = false;
        let duplicateInfo: string | null = null;

        try {
          // Check for duplicate filenames in unassigned_images using fuzzy logic
          const existingUnassigned = await env.DB
            .prepare('SELECT filename, cloudflare_image_id FROM unassigned_images WHERE tenant_id = ?')
            .bind(tenantId)
            .all();

          const cleanedNewFilename = cleanFilename(filename);

          for (const existing of existingUnassigned.results || []) {
            const cleanedExisting = cleanFilename(existing.filename as string);
            const similarity = calculateSimilarity(cleanedNewFilename, cleanedExisting);

            // If similarity > 80%, consider it a potential duplicate
            if (similarity > 0.8) {
              isDuplicate = true;
              duplicateInfo = `Similar to existing unassigned image: ${existing.filename} (${(similarity * 100).toFixed(0)}% similar)`;
              console.log(`[Photo Matching] Potential duplicate detected: ${filename} ≈ ${existing.filename} (${(similarity * 100).toFixed(0)}%)`);
              break;
            }
          }

          // Also check against assigned images in menu_items
          if (!isDuplicate) {
            const assignedImages = await env.DB
              .prepare(`SELECT name, image FROM menu_items ${buildWhereClause(hasSchema, 'AND image IS NOT NULL')}`)
              .bind(...buildParams(hasSchema, tenantId))
              .all();

            for (const assigned of assignedImages.results || []) {
              // Extract filename from image URL
              const existingFilename = (assigned.image as string)?.split('/').pop() || '';
              const cleanedExisting = cleanFilename(existingFilename);
              const similarity = calculateSimilarity(cleanedNewFilename, cleanedExisting);

              if (similarity > 0.8) {
                isDuplicate = true;
                duplicateInfo = `Already assigned to menu item: ${assigned.name}`;
                console.log(`[Photo Matching] Image already assigned: ${filename} to ${assigned.name}`);
                break;
              }
            }
          }
        } catch (dupError: any) {
          console.error(`[Photo Matching] Duplicate check error:`, dupError);
        }

        // Save to unassigned_images table (even if duplicate, but flag it)
        try {
          const unassignedId = `unassigned_${tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
          const notes = isDuplicate ? `POTENTIAL DUPLICATE: ${duplicateInfo}` : null;

          await env.DB
            .prepare(`
              INSERT OR REPLACE INTO unassigned_images (id, tenant_id, cloudflare_image_id, filename, image_url, notes)
              VALUES (?, ?, ?, ?, ?, ?)
            `)
            .bind(unassignedId, tenantId, cloudflareId, filename, imageUrl, notes)
            .run();

          console.log(`[Photo Matching] Saved to unassigned_images: ${filename}${isDuplicate ? ' (flagged as duplicate)' : ''}`);
        } catch (saveError: any) {
          console.error(`[Photo Matching] Failed to save unassigned image ${filename}:`, saveError);
        }

        unmatched.push({
          filename,
          imageUrl,
          imageId: cloudflareId,
          matched: false,
          error: isDuplicate
            ? `⚠️ DUPLICATE: ${duplicateInfo}`
            : bestMatch
            ? `Low similarity (${(bestMatch.score * 100).toFixed(1)}% < 70%)`
            : 'No matching menu item found',
          similarityScore: bestMatch?.score,
        });

        console.log(
          `[Photo Matching] ✗ Unmatched: ${filename}${bestMatch ? ` (best: ${bestMatch.item.name} at ${(bestMatch.score * 100).toFixed(1)}%)` : ''}`
        );
      }
    }

    console.log(
      `[Photo Matching] Complete: ${matched.length} matched, ${unmatched.length} unmatched`
    );

    return Response.json({
      success: true,
      tenantId,
      results: {
        matched,
        unmatched,
      },
      total: photos.length,
      matched: matched.length,
      unmatched: unmatched.length,
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Photo Matching] Error:', error);
    return Response.json({
      success: false,
      error: 'Photo matching failed',
      message: error.message || 'Unknown error',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * Generate Cloudflare Image URL from image ID
 */
function getCloudflareImageUrl(cloudflareId: string): string {
  // Use your Cloudflare account hash
  return `https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/${cloudflareId}/public`;
}

/**
 * Clean filename for fuzzy matching
 * Example: "butter-chicken.jpg" → "butter chicken"
 */
function cleanFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '') // Remove extension
    .replace(/[-_]/g, ' ') // Replace separators with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Find best matching menu item using fuzzy string matching
 */
function findBestMatch(
  cleanedFilename: string,
  menuItems: Array<{ id: string; name: string; category_id?: string; image?: string }>
): { item: typeof menuItems[0]; score: number } | null {
  let bestMatch: { item: typeof menuItems[0]; score: number } | null = null;

  for (const item of menuItems) {
    const cleanedName = item.name.toLowerCase().trim();
    const score = calculateSimilarity(cleanedFilename, cleanedName);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { item, score };
    }
  }

  return bestMatch;
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 (no match) and 1 (perfect match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Exact match
  if (str1 === str2) return 1.0;

  // Check if one string contains the other (high confidence)
  if (str1.includes(str2) || str2.includes(str1)) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    return 0.8 + (shorter.length / longer.length) * 0.2;
  }

  // Use Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  // Convert distance to similarity score (0-1)
  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of single-character edits required to change one string into the other)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}
