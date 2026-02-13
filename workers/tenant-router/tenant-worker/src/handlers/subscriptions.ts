/**
 * Subscription Handlers for Tenant Worker
 *
 * All subscription CRUD operations with direct D1 access and atomic transactions.
 * Supports weekly meal subscription service with customer preferences and delivery tracking.
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// ==================== SYNC CONFIGURATIONS ====================

// Sync configuration for subscription_plans table
const subscriptionPlansSyncConfig: SyncTableConfig = {
  tableName: 'subscription_plans',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'tenantId', target: 'tenant_id', type: 'TEXT', required: true },
    { source: 'name', target: 'name', type: 'TEXT', required: true },
    { source: 'description', target: 'description', type: 'TEXT' },
    { source: 'pricePerWeek', target: 'price_per_week', type: 'REAL', required: true },
    { source: 'mealsPerWeek', target: 'meals_per_week', type: 'INTEGER', required: true },
    { source: 'deliveryDays', target: 'delivery_days', type: 'TEXT', required: true },
    { source: 'active', target: 'active', type: 'INTEGER' },
    { source: 'cuisineTypes', target: 'cuisine_types', type: 'TEXT' },
    { source: 'mealSelectionLimit', target: 'meal_selection_limit', type: 'INTEGER', required: true },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
  ],
  batchSize: 50,
};

// Sync configuration for subscription_cuisine_types table
const cuisineTypesSyncConfig: SyncTableConfig = {
  tableName: 'subscription_cuisine_types',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'tenantId', target: 'tenant_id', type: 'TEXT', required: true },
    { source: 'name', target: 'name', type: 'TEXT', required: true },
    { source: 'description', target: 'description', type: 'TEXT' },
    { source: 'icon', target: 'icon', type: 'TEXT' },
    { source: 'active', target: 'active', type: 'INTEGER' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
  ],
  batchSize: 50,
};

// Sync configuration for subscription_menu_weeks table
const menuWeeksSyncConfig: SyncTableConfig = {
  tableName: 'subscription_menu_weeks',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'tenantId', target: 'tenant_id', type: 'TEXT', required: true },
    { source: 'weekNumber', target: 'week_number', type: 'INTEGER', required: true },
    { source: 'year', target: 'year', type: 'INTEGER', required: true },
    { source: 'cuisineType', target: 'cuisine_type', type: 'TEXT', required: true },
    { source: 'startDate', target: 'start_date', type: 'TEXT', required: true },
    { source: 'endDate', target: 'end_date', type: 'TEXT', required: true },
    { source: 'active', target: 'active', type: 'INTEGER' },
    { source: 'published', target: 'published', type: 'INTEGER' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
  ],
  batchSize: 50,
};

// Sync configuration for subscription_menu_items table
const menuItemsSyncConfig: SyncTableConfig = {
  tableName: 'subscription_menu_items',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'menuWeekId', target: 'menu_week_id', type: 'TEXT', required: true },
    { source: 'menuItemId', target: 'menu_item_id', type: 'TEXT', required: true },
    { source: 'available', target: 'available', type: 'INTEGER' },
    { source: 'maxOrdersPerWeek', target: 'max_orders_per_week', type: 'INTEGER' },
    { source: 'sortOrder', target: 'sort_order', type: 'INTEGER' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
  ],
  batchSize: 100,
};

// Sync configuration for subscription_deliveries table
const deliveriesSyncConfig: SyncTableConfig = {
  tableName: 'subscription_deliveries',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'tenantId', target: 'tenant_id', type: 'TEXT', required: true },
    { source: 'subscriptionId', target: 'subscription_id', type: 'TEXT', required: true },
    { source: 'preferenceId', target: 'preference_id', type: 'TEXT', required: true },
    { source: 'scheduledDate', target: 'scheduled_date', type: 'TEXT', required: true },
    { source: 'scheduledTimeSlot', target: 'scheduled_time_slot', type: 'TEXT', required: true },
    { source: 'status', target: 'status', type: 'TEXT', required: true },
    { source: 'towerNumber', target: 'tower_number', type: 'TEXT', required: true },
    { source: 'apartmentNumber', target: 'apartment_number', type: 'TEXT', required: true },
    { source: 'distanceFromKitchen', target: 'distance_from_kitchen', type: 'INTEGER' },
    { source: 'deliveryNotes', target: 'delivery_notes', type: 'TEXT' },
    { source: 'assignedDriver', target: 'assigned_driver', type: 'TEXT' },
    { source: 'deliveredAt', target: 'delivered_at', type: 'TEXT' },
    { source: 'deliveryProof', target: 'delivery_proof', type: 'TEXT' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
  ],
  batchSize: 50,
};

// ==================== API HANDLERS ====================

/**
 * GET /subscriptions/plans - List active subscription plans
 */
export async function handleListSubscriptionPlans(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') !== 'false';

    let query = `SELECT * FROM subscription_plans WHERE tenant_id = ?`;
    const params: any[] = [tenantId];

    if (activeOnly) {
      query += ` AND active = 1`;
    }

    query += ` ORDER BY meals_per_week ASC`;

    const result = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      tenantId,
      plans: result.results || [],
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error listing plans:', error);
    return Response.json({
      success: false,
      error: 'Failed to list subscription plans',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /subscriptions/cuisine-types - List cuisine types
 */
export async function handleListCuisineTypes(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') !== 'false';

    let query = `SELECT * FROM subscription_cuisine_types WHERE tenant_id = ?`;
    const params: any[] = [tenantId];

    if (activeOnly) {
      query += ` AND active = 1`;
    }

    query += ` ORDER BY name ASC`;

    const result = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      tenantId,
      cuisineTypes: result.results || [],
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error listing cuisine types:', error);
    return Response.json({
      success: false,
      error: 'Failed to list cuisine types',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /subscriptions/weeks - List weekly menus (published only by default)
 */
export async function handleListWeeklyMenus(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const cuisineType = url.searchParams.get('cuisine_type');
    const publishedOnly = url.searchParams.get('published') !== 'false';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `SELECT * FROM subscription_menu_weeks WHERE tenant_id = ?`;
    const params: any[] = [tenantId];

    if (publishedOnly) {
      query += ` AND published = 1`;
    }

    if (cuisineType) {
      query += ` AND cuisine_type = ?`;
      params.push(cuisineType);
    }

    // Order by most recent first
    query += ` ORDER BY year DESC, week_number DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      tenantId,
      weeks: result.results || [],
      pagination: {
        limit,
        offset,
      },
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error listing weekly menus:', error);
    return Response.json({
      success: false,
      error: 'Failed to list weekly menus',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /subscriptions/weeks/:weekId - Get a specific weekly menu
 */
export async function handleGetWeeklyMenu(
  request: Request,
  env: Env,
  tenantId: string,
  weekId: string
): Promise<Response> {
  try {
    const week = await env.DB.prepare(
      `SELECT * FROM subscription_menu_weeks WHERE id = ? AND tenant_id = ?`
    ).bind(weekId, tenantId).first();

    if (!week) {
      return Response.json({
        success: false,
        error: 'Weekly menu not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    return Response.json({
      success: true,
      week,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error getting weekly menu:', error);
    return Response.json({
      success: false,
      error: 'Failed to get weekly menu',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /subscriptions/weeks/:weekId/items - Get menu items for a specific week
 */
export async function handleGetWeekItems(
  request: Request,
  env: Env,
  tenantId: string,
  weekId: string
): Promise<Response> {
  try {
    // Verify week exists and belongs to tenant
    const week = await env.DB.prepare(
      `SELECT * FROM subscription_menu_weeks WHERE id = ? AND tenant_id = ?`
    ).bind(weekId, tenantId).first();

    if (!week) {
      return Response.json({
        success: false,
        error: 'Weekly menu not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Get menu items with full details from menu_items table
    const result = await env.DB.prepare(`
      SELECT
        smi.*,
        mi.name,
        mi.category_id as category,
        mi.price,
        mi.dietary_tags,
        mi.description,
        mi.active as item_active
      FROM subscription_menu_items smi
      JOIN menu_items mi ON smi.menu_item_id = mi.id
      WHERE smi.menu_week_id = ?
      ORDER BY smi.sort_order ASC, mi.name ASC
    `).bind(weekId).all();

    return Response.json({
      success: true,
      weekId,
      items: result.results || [],
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error getting week items:', error);
    return Response.json({
      success: false,
      error: 'Failed to get week items',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /subscriptions/customers - Create a new subscription for a customer
 */
export async function handleCreateSubscription(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      customerPhone: string;
      customerName: string;
      customerEmail?: string;
      subscriptionPlanId: string;
      towerNumber: string;
      apartmentNumber: string;
      floorNumber?: string;
      distanceFromKitchen?: number;
      deliveryNotes?: string;
      preferredCuisineType?: string;
    };

    // Validation
    if (!body.customerPhone || !body.customerName) {
      return Response.json({
        success: false,
        error: 'Customer phone and name are required',
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (!body.subscriptionPlanId) {
      return Response.json({
        success: false,
        error: 'Subscription plan ID is required',
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (!body.towerNumber || !body.apartmentNumber) {
      return Response.json({
        success: false,
        error: 'Tower number and apartment number are required',
      }, { status: 400, headers: CORS_HEADERS });
    }

    // Verify plan exists
    const plan = await env.DB.prepare(
      `SELECT * FROM subscription_plans WHERE id = ? AND tenant_id = ? AND active = 1`
    ).bind(body.subscriptionPlanId, tenantId).first();

    if (!plan) {
      return Response.json({
        success: false,
        error: 'Subscription plan not found or inactive',
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Generate subscription ID
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const createdAt = new Date().toISOString();
    const startDate = new Date().toISOString().split('T')[0]; // Today's date

    // Calculate next billing date (1 week from start)
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 7);
    const nextBillingDateStr = nextBillingDate.toISOString().split('T')[0];

    // Insert subscription
    await env.DB.prepare(`
      INSERT INTO subscription_customers (
        id, tenant_id, customer_phone, customer_name, customer_email,
        subscription_plan_id, status, start_date, next_billing_date,
        tower_number, apartment_number, floor_number, distance_from_kitchen,
        delivery_notes, preferred_cuisine_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      subscriptionId,
      tenantId,
      body.customerPhone,
      body.customerName,
      body.customerEmail || null,
      body.subscriptionPlanId,
      'active',
      startDate,
      nextBillingDateStr,
      body.towerNumber,
      body.apartmentNumber,
      body.floorNumber || null,
      body.distanceFromKitchen || null,
      body.deliveryNotes || null,
      body.preferredCuisineType || null,
      createdAt,
      createdAt
    ).run();

    console.log(`[Subscriptions] Created subscription ${subscriptionId} for ${body.customerName}`);

    return Response.json({
      success: true,
      subscriptionId,
      tenantId,
      startDate,
      nextBillingDate: nextBillingDateStr,
      createdAt,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error creating subscription:', error);
    return Response.json({
      success: false,
      error: 'Failed to create subscription',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /subscriptions/customers/:customerId - Get customer subscription details
 */
export async function handleGetCustomerSubscription(
  request: Request,
  env: Env,
  tenantId: string,
  customerId: string
): Promise<Response> {
  try {
    // Get subscription with plan details
    const result = await env.DB.prepare(`
      SELECT
        sc.*,
        sp.name as plan_name,
        sp.description as plan_description,
        sp.price_per_week,
        sp.meals_per_week,
        sp.delivery_days,
        sp.meal_selection_limit
      FROM subscription_customers sc
      JOIN subscription_plans sp ON sc.subscription_plan_id = sp.id
      WHERE sc.id = ? AND sc.tenant_id = ?
    `).bind(customerId, tenantId).first();

    if (!result) {
      return Response.json({
        success: false,
        error: 'Subscription not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    return Response.json({
      success: true,
      subscription: result,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error getting customer subscription:', error);
    return Response.json({
      success: false,
      error: 'Failed to get customer subscription',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /subscriptions/preferences - Save customer meal preferences for a week
 */
export async function handleSavePreferences(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      subscriptionId: string;
      menuWeekId: string;
      selectedItems: string[]; // Array of menu_item_id
      deliveryDay: string;
      deliveryTimeSlot: string;
      specialInstructions?: string;
    };

    // Validation
    if (!body.subscriptionId || !body.menuWeekId) {
      return Response.json({
        success: false,
        error: 'Subscription ID and menu week ID are required',
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (!body.selectedItems || body.selectedItems.length === 0) {
      return Response.json({
        success: false,
        error: 'At least one item must be selected',
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (!body.deliveryDay || !body.deliveryTimeSlot) {
      return Response.json({
        success: false,
        error: 'Delivery day and time slot are required',
      }, { status: 400, headers: CORS_HEADERS });
    }

    // Verify subscription exists
    const subscription = await env.DB.prepare(
      `SELECT * FROM subscription_customers WHERE id = ? AND tenant_id = ?`
    ).bind(body.subscriptionId, tenantId).first();

    if (!subscription) {
      return Response.json({
        success: false,
        error: 'Subscription not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Verify week exists
    const week = await env.DB.prepare(
      `SELECT * FROM subscription_menu_weeks WHERE id = ? AND tenant_id = ?`
    ).bind(body.menuWeekId, tenantId).first();

    if (!week) {
      return Response.json({
        success: false,
        error: 'Menu week not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    const preferenceId = `pref-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const createdAt = new Date().toISOString();
    const selectedItemsJson = JSON.stringify(body.selectedItems);

    // Insert or replace preference
    await env.DB.prepare(`
      INSERT OR REPLACE INTO subscription_preferences (
        id, subscription_id, menu_week_id, selected_items,
        delivery_day, delivery_time_slot, special_instructions,
        order_cutoff_passed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      preferenceId,
      body.subscriptionId,
      body.menuWeekId,
      selectedItemsJson,
      body.deliveryDay,
      body.deliveryTimeSlot,
      body.specialInstructions || null,
      createdAt,
      createdAt
    ).run();

    console.log(`[Subscriptions] Saved preferences ${preferenceId} for subscription ${body.subscriptionId}`);

    return Response.json({
      success: true,
      preferenceId,
      subscriptionId: body.subscriptionId,
      menuWeekId: body.menuWeekId,
      createdAt,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error saving preferences:', error);
    return Response.json({
      success: false,
      error: 'Failed to save preferences',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /subscriptions/deliveries - List deliveries with filters
 */
export async function handleListDeliveries(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const scheduledDate = url.searchParams.get('date');
    const towerNumber = url.searchParams.get('tower');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `
      SELECT
        sd.*,
        sc.customer_name,
        sc.customer_phone
      FROM subscription_deliveries sd
      JOIN subscription_customers sc ON sd.subscription_id = sc.id
      WHERE sd.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (status && status !== 'all') {
      query += ` AND sd.status = ?`;
      params.push(status);
    }

    if (scheduledDate) {
      query += ` AND sd.scheduled_date = ?`;
      params.push(scheduledDate);
    }

    if (towerNumber) {
      query += ` AND sd.tower_number = ?`;
      params.push(towerNumber);
    }

    query += ` ORDER BY sd.scheduled_date ASC, sd.scheduled_time_slot ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      tenantId,
      deliveries: result.results || [],
      pagination: {
        limit,
        offset,
      },
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Error listing deliveries:', error);
    return Response.json({
      success: false,
      error: 'Failed to list deliveries',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

// ==================== SYNC HANDLERS ====================

/**
 * POST /subscriptions/plans/sync - Sync subscription plans from POS
 */
export async function handlePlansSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { plans: any[] };
    const plans = body.plans || [];

    if (plans.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(subscriptionPlansSyncConfig, plans);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `Plan ${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Plans sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync plans',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /subscriptions/cuisine-types/sync - Sync cuisine types from POS
 */
export async function handleCuisineTypesSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { cuisineTypes: any[] };
    const cuisineTypes = body.cuisineTypes || [];

    if (cuisineTypes.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(cuisineTypesSyncConfig, cuisineTypes);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `Cuisine type ${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Cuisine types sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync cuisine types',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /subscriptions/weeks/sync - Sync weekly menus from POS
 */
export async function handleWeeksSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { weeks: any[] };
    const weeks = body.weeks || [];

    if (weeks.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(menuWeeksSyncConfig, weeks);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `Week ${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Weeks sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync weeks',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /subscriptions/menu-items/sync - Sync subscription menu items from POS
 */
export async function handleMenuItemsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { items: any[] };
    const items = body.items || [];

    if (items.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(menuItemsSyncConfig, items);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `Menu item ${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Menu items sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync menu items',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /subscriptions/deliveries/sync - Sync deliveries from POS
 */
export async function handleDeliveriesSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { deliveries: any[] };
    const deliveries = body.deliveries || [];

    if (deliveries.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(deliveriesSyncConfig, deliveries);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `Delivery ${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Subscriptions] Deliveries sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync deliveries',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
