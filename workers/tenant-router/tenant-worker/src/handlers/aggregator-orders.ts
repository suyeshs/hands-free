/**
 * Aggregator Orders Handler
 *
 * Handles syncing and fetching aggregator orders (Swiggy, Zomato, etc.)
 * from the POS app to the D1 cloud database.
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

interface AggregatorOrderItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  specialInstructions?: string;
}

interface AggregatorOrderPayload {
  orderId: string;
  orderNumber: string;
  aggregator: string;
  aggregatorOrderId: string;
  aggregatorStatus?: string;
  status: string;
  orderType: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: AggregatorOrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  isPrepaid: boolean;
  specialInstructions?: string;
  createdAt: string;
  acceptedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Ensure the aggregator_orders table exists
 */
async function ensureTable(db: D1Database): Promise<void> {
  // Create table - using prepare() instead of exec() for better compatibility
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS aggregator_orders (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      order_number TEXT NOT NULL,
      aggregator TEXT NOT NULL,
      aggregator_order_id TEXT NOT NULL,
      aggregator_status TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      order_type TEXT NOT NULL DEFAULT 'delivery',
      customer_name TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL DEFAULT 0,
      delivery_fee REAL DEFAULT 0,
      platform_fee REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT,
      payment_status TEXT,
      is_prepaid INTEGER DEFAULT 0,
      special_instructions TEXT,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      ready_at TEXT,
      delivered_at TEXT,
      archived_at TEXT,
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(aggregator, aggregator_order_id)
    )
  `).run();

  // Create indexes separately
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_aggregator_orders_tenant ON aggregator_orders(tenant_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_aggregator_orders_status ON aggregator_orders(status)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_aggregator_orders_created ON aggregator_orders(created_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_aggregator_orders_archived ON aggregator_orders(archived_at)').run();

  // Add archived_at column if it doesn't exist (for existing tables)
  try {
    await db.prepare('ALTER TABLE aggregator_orders ADD COLUMN archived_at TEXT').run();
  } catch {
    // Column already exists, ignore error
  }
}

// Sync configuration for aggregator_orders table
const aggregatorOrdersSyncConfig: SyncTableConfig = {
  tableName: 'aggregator_orders',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['aggregator', 'aggregator_order_id'], // Matches UNIQUE(aggregator, aggregator_order_id)
  timestampColumn: 'created_at',
  columns: [
    { source: 'orderId', target: 'id', type: 'TEXT', required: true },
    { source: 'orderNumber', target: 'order_number', type: 'TEXT', required: true },
    { source: 'aggregator', target: 'aggregator', type: 'TEXT', required: true },
    { source: 'aggregatorOrderId', target: 'aggregator_order_id', type: 'TEXT', required: true },
    { source: 'aggregatorStatus', target: 'aggregator_status', type: 'TEXT' },
    { source: 'status', target: 'status', type: 'TEXT', required: true },
    { source: 'orderType', target: 'order_type', type: 'TEXT', required: true },
    { source: 'customerName', target: 'customer_name', type: 'TEXT' },
    { source: 'customerPhone', target: 'customer_phone', type: 'TEXT' },
    { source: 'customerAddress', target: 'customer_address', type: 'TEXT' },
    {
      source: 'items',
      target: 'items',
      type: 'TEXT',
      required: true,
      transform: (items) => JSON.stringify(items)
    },
    { source: 'subtotal', target: 'subtotal', type: 'REAL', required: true },
    { source: 'tax', target: 'tax', type: 'REAL' },
    { source: 'deliveryFee', target: 'delivery_fee', type: 'REAL' },
    { source: 'platformFee', target: 'platform_fee', type: 'REAL' },
    { source: 'discount', target: 'discount', type: 'REAL' },
    { source: 'total', target: 'total', type: 'REAL', required: true },
    { source: 'paymentMethod', target: 'payment_method', type: 'TEXT' },
    { source: 'paymentStatus', target: 'payment_status', type: 'TEXT' },
    {
      source: 'isPrepaid',
      target: 'is_prepaid',
      type: 'INTEGER',
      transform: (val) => val ? 1 : 0
    },
    { source: 'specialInstructions', target: 'special_instructions', type: 'TEXT' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'acceptedAt', target: 'accepted_at', type: 'TEXT' },
    { source: 'readyAt', target: 'ready_at', type: 'TEXT' },
    { source: 'deliveredAt', target: 'delivered_at', type: 'TEXT' },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[AggregatorOrders] Synced ${result.synced}/${result.totalRecords} orders in ${result.duration}ms`);
    }
  }
};

/**
 * POST /aggregator-orders/sync - Sync orders from POS to D1 using SyncEngine
 */
export async function handleAggregatorOrdersSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { orders: AggregatorOrderPayload[] };
    const orders = body.orders || [];

    if (orders.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Ensure table exists
    await ensureTable(env.DB);

    // Create sync engine instance
    const syncEngine = createSyncEngine(env.DB, tenantId);

    // Sync using the unified engine
    const result = await syncEngine.sync(aggregatorOrdersSyncConfig, orders);

    // Convert SyncResult to response format
    return Response.json({
      success: result.success,
      synced: result.synced,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[AggregatorOrders] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync orders',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /aggregator-orders - Fetch orders from D1
 * By default excludes archived orders. Pass include_archived=true to include them.
 */
export async function handleAggregatorOrdersFetch(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const since = url.searchParams.get('since');
    const status = url.searchParams.get('status');
    const includeArchived = url.searchParams.get('include_archived') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    // Ensure table exists
    await ensureTable(env.DB);

    let query = 'SELECT * FROM aggregator_orders WHERE tenant_id = ?';
    const params: (string | number)[] = [tenantId];

    // Exclude archived orders by default
    if (!includeArchived) {
      query += ' AND archived_at IS NULL';
    }

    if (since) {
      query += ' AND created_at >= ?';
      params.push(since);
    }

    if (status) {
      const statuses = status.split(',');
      query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(query).bind(...params).all();

    const orders = (result.results || []).map((row: any) => ({
      orderId: row.id,
      orderNumber: row.order_number,
      aggregator: row.aggregator,
      aggregatorOrderId: row.aggregator_order_id,
      aggregatorStatus: row.aggregator_status,
      status: row.status,
      orderType: row.order_type,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerAddress: row.customer_address,
      items: JSON.parse(row.items || '[]'),
      subtotal: row.subtotal,
      tax: row.tax,
      deliveryFee: row.delivery_fee,
      platformFee: row.platform_fee,
      discount: row.discount,
      total: row.total,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      isPrepaid: row.is_prepaid === 1,
      specialInstructions: row.special_instructions,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
      readyAt: row.ready_at,
      deliveredAt: row.delivered_at,
      archivedAt: row.archived_at,
    }));

    return Response.json({
      success: true,
      orders,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[AggregatorOrders] Fetch error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch orders',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * PATCH /aggregator-orders/:orderId/archive - Archive an order
 * Used when user dismisses an order or order is delivered
 */
export async function handleAggregatorOrderArchive(
  _request: Request,
  env: Env,
  tenantId: string,
  orderId: string
): Promise<Response> {
  try {
    await ensureTable(env.DB);

    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      'UPDATE aggregator_orders SET archived_at = ? WHERE tenant_id = ? AND id = ?'
    ).bind(now, tenantId, orderId).run();

    console.log(`[AggregatorOrders] Archived order ${orderId} for tenant ${tenantId}, rows affected: ${result.meta?.changes || 0}`);

    return Response.json({
      success: true,
      archived: (result.meta?.changes || 0) > 0,
      archivedAt: now,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[AggregatorOrders] Archive error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to archive order',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /aggregator-orders/archived - Fetch archived orders by channel
 * Query params: aggregator (optional), since (optional), limit (optional)
 */
export async function handleAggregatorOrdersArchivedFetch(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const aggregator = url.searchParams.get('aggregator');
    const since = url.searchParams.get('since');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    await ensureTable(env.DB);

    let query = 'SELECT * FROM aggregator_orders WHERE tenant_id = ? AND archived_at IS NOT NULL';
    const params: (string | number)[] = [tenantId];

    if (aggregator) {
      query += ' AND aggregator = ?';
      params.push(aggregator);
    }

    if (since) {
      query += ' AND archived_at >= ?';
      params.push(since);
    }

    query += ' ORDER BY archived_at DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(query).bind(...params).all();

    const orders = (result.results || []).map((row: any) => ({
      orderId: row.id,
      orderNumber: row.order_number,
      aggregator: row.aggregator,
      aggregatorOrderId: row.aggregator_order_id,
      aggregatorStatus: row.aggregator_status,
      status: row.status,
      orderType: row.order_type,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerAddress: row.customer_address,
      items: JSON.parse(row.items || '[]'),
      subtotal: row.subtotal,
      tax: row.tax,
      deliveryFee: row.delivery_fee,
      platformFee: row.platform_fee,
      discount: row.discount,
      total: row.total,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      isPrepaid: row.is_prepaid === 1,
      specialInstructions: row.special_instructions,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
      readyAt: row.ready_at,
      deliveredAt: row.delivered_at,
      archivedAt: row.archived_at,
    }));

    return Response.json({
      success: true,
      orders,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[AggregatorOrders] Archived fetch error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch archived orders',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * POST /aggregator-orders/archive-all - Archive all non-archived orders
 * Used for bulk cleanup of old/test orders
 */
export async function handleAggregatorOrderArchiveAll(
  _request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureTable(env.DB);

    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      'UPDATE aggregator_orders SET archived_at = ? WHERE tenant_id = ? AND archived_at IS NULL'
    ).bind(now, tenantId).run();

    const archived = result.meta?.changes || 0;
    console.log(`[AggregatorOrders] Archived all orders for tenant ${tenantId}, count: ${archived}`);

    return Response.json({
      success: true,
      archived,
      archivedAt: now,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[AggregatorOrders] Archive all error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to archive all orders',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}
