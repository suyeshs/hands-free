/**
 * Aggregator Order Database Service
 * Handles persistence of Swiggy/Zomato orders to local SQLite
 */

import Database from "@tauri-apps/plugin-sql";
import { AggregatorOrder, AggregatorOrderStatus } from "../types/aggregator";

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:pos.db");
  }
  return db;
}

/**
 * Database row type for aggregator_orders table
 */
interface AggregatorOrderRow {
  id: string;
  order_id: string;
  order_number: string;
  aggregator: string;
  aggregator_order_id: string;
  aggregator_status: string | null;
  status: string;
  order_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  items_json: string;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  platform_fee: number;
  discount: number;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  is_prepaid: number;
  special_instructions: string | null;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  archived_at: string | null;
  updated_at: string;
  synced_at: string | null;
  raw_data: string | null;
}

/**
 * Convert AggregatorOrder to database row format
 */
function orderToRow(order: AggregatorOrder): Omit<AggregatorOrderRow, 'id'> {
  return {
    order_id: order.orderId,
    order_number: order.orderNumber,
    aggregator: order.aggregator,
    aggregator_order_id: order.aggregatorOrderId,
    aggregator_status: order.aggregatorStatus || null,
    status: order.status,
    order_type: order.orderType,
    customer_name: order.customer?.name || null,
    customer_phone: order.customer?.phone || null,
    customer_address: order.customer?.address || null,
    items_json: JSON.stringify(order.cart?.items || []),
    subtotal: order.cart?.subtotal || 0,
    tax: order.cart?.tax || 0,
    delivery_fee: order.cart?.deliveryFee || 0,
    platform_fee: order.cart?.platformFee || 0,
    discount: order.cart?.discount || 0,
    total: order.cart?.total || 0,
    payment_method: order.payment?.method || null,
    payment_status: order.payment?.status || null,
    is_prepaid: order.payment?.isPrepaid ? 1 : 0,
    special_instructions: order.specialInstructions || null,
    created_at: order.createdAt,
    accepted_at: order.acceptedAt || null,
    ready_at: order.readyAt || null,
    picked_up_at: order.pickedUpAt || null,
    delivered_at: order.deliveredAt || null,
    archived_at: order.archivedAt || null,
    updated_at: new Date().toISOString(),
    synced_at: null,
    raw_data: order.rawData ? JSON.stringify(order.rawData) : null,
  };
}

/**
 * Convert database row to AggregatorOrder
 */
function rowToOrder(row: AggregatorOrderRow): AggregatorOrder {
  const items = JSON.parse(row.items_json || '[]');

  return {
    aggregator: row.aggregator as AggregatorOrder['aggregator'],
    aggregatorOrderId: row.aggregator_order_id,
    aggregatorStatus: row.aggregator_status || '',
    orderId: row.order_id,
    orderNumber: row.order_number,
    status: row.status as AggregatorOrderStatus,
    orderType: row.order_type as 'delivery' | 'pickup',
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    readyAt: row.ready_at,
    pickedUpAt: row.picked_up_at,
    deliveredAt: row.delivered_at,
    archivedAt: row.archived_at,
    customer: {
      name: row.customer_name || 'Customer',
      phone: row.customer_phone,
      address: row.customer_address,
    },
    cart: {
      items,
      subtotal: row.subtotal,
      tax: row.tax,
      deliveryFee: row.delivery_fee,
      platformFee: row.platform_fee,
      discount: row.discount,
      total: row.total,
    },
    payment: {
      method: row.payment_method || 'online',
      status: row.payment_status || 'paid',
      isPrepaid: row.is_prepaid === 1,
    },
    specialInstructions: row.special_instructions,
    rawData: row.raw_data ? JSON.parse(row.raw_data) : undefined,
  };
}

/**
 * Save or update an aggregator order
 */
export async function saveAggregatorOrder(order: AggregatorOrder): Promise<void> {
  const database = await getDatabase();
  const row = orderToRow(order);
  const id = `agg_${order.orderId}`;
  const now = new Date().toISOString();

  // Use INSERT OR REPLACE for upsert behavior
  await database.execute(
    `INSERT OR REPLACE INTO aggregator_orders (
      id, order_id, order_number, aggregator, aggregator_order_id,
      aggregator_status, status, order_type, customer_name, customer_phone,
      customer_address, items_json, subtotal, tax, delivery_fee,
      platform_fee, discount, total, payment_method, payment_status,
      is_prepaid, special_instructions, created_at, accepted_at, ready_at,
      delivered_at, updated_at, synced_at, raw_data
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25,
      $26, $27, $28, $29
    )`,
    [
      id, row.order_id, row.order_number, row.aggregator, row.aggregator_order_id,
      row.aggregator_status, row.status, row.order_type, row.customer_name, row.customer_phone,
      row.customer_address, row.items_json, row.subtotal, row.tax, row.delivery_fee,
      row.platform_fee, row.discount, row.total, row.payment_method, row.payment_status,
      row.is_prepaid, row.special_instructions, row.created_at, row.accepted_at, row.ready_at,
      row.delivered_at, now, row.synced_at, row.raw_data,
    ]
  );

  console.log('[AggregatorOrderDb] Saved order:', order.orderNumber);
}

/**
 * Update aggregator order status
 */
export async function updateAggregatorOrderStatus(
  orderId: string,
  status: AggregatorOrderStatus,
  timestamps?: {
    acceptedAt?: string;
    readyAt?: string;
    pickedUpAt?: string;
    deliveredAt?: string;
  }
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  let sql = 'UPDATE aggregator_orders SET status = $1, updated_at = $2';
  const params: any[] = [status, now];
  let paramIndex = 3;

  if (timestamps?.acceptedAt) {
    sql += `, accepted_at = $${paramIndex}`;
    params.push(timestamps.acceptedAt);
    paramIndex++;
  }
  if (timestamps?.readyAt) {
    sql += `, ready_at = $${paramIndex}`;
    params.push(timestamps.readyAt);
    paramIndex++;
  }
  if (timestamps?.pickedUpAt) {
    sql += `, picked_up_at = $${paramIndex}`;
    params.push(timestamps.pickedUpAt);
    paramIndex++;
  }
  if (timestamps?.deliveredAt) {
    sql += `, delivered_at = $${paramIndex}`;
    params.push(timestamps.deliveredAt);
    paramIndex++;
  }

  sql += ` WHERE order_id = $${paramIndex}`;
  params.push(orderId);

  await database.execute(sql, params);
  console.log('[AggregatorOrderDb] Updated order status:', orderId, '->', status);
}

/**
 * Get aggregator order by order ID
 */
export async function getAggregatorOrder(orderId: string): Promise<AggregatorOrder | null> {
  const database = await getDatabase();
  const rows = await database.select<AggregatorOrderRow[]>(
    'SELECT * FROM aggregator_orders WHERE order_id = $1',
    [orderId]
  );

  if (rows.length === 0) return null;
  return rowToOrder(rows[0]);
}

/**
 * Get aggregator order by order number
 */
export async function getAggregatorOrderByNumber(orderNumber: string): Promise<AggregatorOrder | null> {
  const database = await getDatabase();
  const rows = await database.select<AggregatorOrderRow[]>(
    'SELECT * FROM aggregator_orders WHERE order_number = $1',
    [orderNumber]
  );

  if (rows.length === 0) return null;
  return rowToOrder(rows[0]);
}

/**
 * Get all aggregator orders with optional filters
 */
export async function getAggregatorOrders(options?: {
  status?: AggregatorOrderStatus | AggregatorOrderStatus[];
  aggregator?: string;
  limit?: number;
  offset?: number;
  since?: string; // ISO date string
}): Promise<AggregatorOrder[]> {
  const database = await getDatabase();

  let sql = 'SELECT * FROM aggregator_orders WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (options?.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    const placeholders = statuses.map(() => `$${paramIndex++}`).join(', ');
    sql += ` AND status IN (${placeholders})`;
    params.push(...statuses);
  }

  if (options?.aggregator) {
    sql += ` AND aggregator = $${paramIndex++}`;
    params.push(options.aggregator);
  }

  if (options?.since) {
    sql += ` AND created_at >= $${paramIndex++}`;
    params.push(options.since);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(options.offset);
  }

  const rows = await database.select<AggregatorOrderRow[]>(sql, params);
  return rows.map(rowToOrder);
}

/**
 * Get active aggregator orders (not completed/cancelled/delivered and not archived)
 */
export async function getActiveAggregatorOrders(): Promise<AggregatorOrder[]> {
  const database = await getDatabase();
  const rows = await database.select<AggregatorOrderRow[]>(
    `SELECT * FROM aggregator_orders
     WHERE status IN ('pending', 'confirmed', 'preparing', 'ready', 'pending_pickup', 'picked_up', 'out_for_delivery')
     AND archived_at IS NULL
     ORDER BY created_at DESC`
  );
  return rows.map(rowToOrder);
}

/**
 * Get today's aggregator orders
 */
export async function getTodaysAggregatorOrders(): Promise<AggregatorOrder[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getAggregatorOrders({ since: today.toISOString() });
}

/**
 * Get unsynced orders for D1 sync
 */
export async function getUnsyncedOrders(): Promise<AggregatorOrder[]> {
  const database = await getDatabase();
  const rows = await database.select<AggregatorOrderRow[]>(
    'SELECT * FROM aggregator_orders WHERE synced_at IS NULL ORDER BY created_at ASC'
  );
  return rows.map(rowToOrder);
}

/**
 * Mark orders as synced
 */
export async function markOrdersSynced(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;

  const database = await getDatabase();
  const now = new Date().toISOString();
  const placeholders = orderIds.map((_, i) => `$${i + 2}`).join(', ');

  await database.execute(
    `UPDATE aggregator_orders SET synced_at = $1 WHERE order_id IN (${placeholders})`,
    [now, ...orderIds]
  );

  console.log('[AggregatorOrderDb] Marked orders as synced:', orderIds.length);
}

/**
 * Delete old completed orders (cleanup)
 */
export async function cleanupOldOrders(daysToKeep: number = 30): Promise<number> {
  const database = await getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await database.execute(
    `DELETE FROM aggregator_orders
     WHERE status IN ('completed', 'cancelled', 'delivered')
     AND created_at < $1
     AND synced_at IS NOT NULL`,
    [cutoffDate.toISOString()]
  );

  console.log('[AggregatorOrderDb] Cleaned up old orders:', result.rowsAffected);
  return result.rowsAffected;
}

/**
 * Check if order exists
 */
export async function orderExists(orderId: string): Promise<boolean> {
  const database = await getDatabase();
  const rows = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM aggregator_orders WHERE order_id = $1',
    [orderId]
  );
  return rows[0]?.count > 0;
}

/**
 * Delete an order (for dismissing stale orders)
 */
export async function deleteOrder(orderId: string): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    'DELETE FROM aggregator_orders WHERE order_id = $1',
    [orderId]
  );
  console.log('[AggregatorOrderDb] Deleted order:', orderId);
}

/**
 * Archive an order (sets archived_at timestamp)
 */
export async function archiveOrder(orderId: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.execute(
    'UPDATE aggregator_orders SET archived_at = $1, updated_at = $2 WHERE order_id = $3',
    [now, now, orderId]
  );
  console.log('[AggregatorOrderDb] Archived order:', orderId);
}

/**
 * Get archived orders with optional filters
 */
export async function getArchivedOrders(options?: {
  aggregator?: string;
  since?: string;
  limit?: number;
}): Promise<AggregatorOrder[]> {
  const database = await getDatabase();

  let sql = 'SELECT * FROM aggregator_orders WHERE archived_at IS NOT NULL';
  const params: any[] = [];
  let paramIndex = 1;

  if (options?.aggregator) {
    sql += ` AND aggregator = $${paramIndex++}`;
    params.push(options.aggregator);
  }

  if (options?.since) {
    sql += ` AND archived_at >= $${paramIndex++}`;
    params.push(options.since);
  }

  sql += ' ORDER BY archived_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  const rows = await database.select<AggregatorOrderRow[]>(sql, params);
  return rows.map(rowToOrder);
}

export const aggregatorOrderDb = {
  save: saveAggregatorOrder,
  updateStatus: updateAggregatorOrderStatus,
  get: getAggregatorOrder,
  getByNumber: getAggregatorOrderByNumber,
  getAll: getAggregatorOrders,
  getActive: getActiveAggregatorOrders,
  getTodays: getTodaysAggregatorOrders,
  getUnsynced: getUnsyncedOrders,
  markSynced: markOrdersSynced,
  cleanup: cleanupOldOrders,
  exists: orderExists,
  deleteOrder: deleteOrder,
  archive: archiveOrder,
  getArchived: getArchivedOrders,
};

export default aggregatorOrderDb;
