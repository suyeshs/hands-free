/**
 * Order Manager
 *
 * Core CRUD operations for order management with customer linkage
 *
 * Features:
 * - Create orders with automatic customer lookup/creation
 * - Order status tracking and updates
 * - Sequential order number generation (per day)
 * - Order history and statistics
 * - Integration with customer metrics updates
 */

import { type RestaurantEnv, getTenantDatabase } from './tenant-db-resolver';
import { upsertCustomer, updateCustomerMetrics, getCustomerByPhone } from './customer-manager';
import { autoAssignTags } from './customer-tags';

/**
 * Order types
 */
export type OrderType = 'dine-in' | 'takeout' | 'delivery';

/**
 * Order status
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

/**
 * Payment method
 */
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'online';

/**
 * Payment status
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * Order source
 */
export type OrderSource = 'pos' | 'web' | 'zomato' | 'swiggy' | 'voice' | 'mobile';

/**
 * Order item modifier
 */
export interface OrderItemModifier {
  name: string;
  value: string;
  priceAdjustment: number;
}

/**
 * Order item input
 */
export interface OrderItemInput {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: OrderItemModifier[];
  specialInstructions?: string;
  category?: string;
  spiceLevel?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  itemTotal: number;
}

/**
 * Order item (database record)
 */
export interface OrderItem extends OrderItemInput {
  id: string;
  orderId: string;
  createdAt: string;
}

/**
 * Customer info for order creation
 */
export interface OrderCustomerInput {
  phone: string;
  name?: string;
  email?: string;
}

/**
 * Delivery address for orders
 */
export interface OrderDeliveryAddress {
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  instructions?: string;
}

/**
 * Order input
 */
export interface OrderInput {
  tenantId: string;
  orderType: OrderType;
  tableNumber?: number;

  // Customer information
  customer: OrderCustomerInput;

  // Order items
  items: OrderItemInput[];

  // Pricing
  subtotal: number;
  tax: number;
  total: number;

  // Payment
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;

  // Delivery (for delivery orders)
  deliveryAddress?: OrderDeliveryAddress;

  // Metadata
  notes?: string;
  source: OrderSource;
  createdBy?: string; // User ID who created the order
}

/**
 * Order (complete record)
 */
export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  tableNumber?: number;

  // Customer
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerTags?: string[];

  // Items
  items: OrderItem[];

  // Pricing
  subtotal: number;
  tax: number;
  total: number;

  // Payment
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;

  // Delivery
  deliveryAddress?: OrderDeliveryAddress;

  // Metadata
  notes?: string;
  source: OrderSource;
  createdBy?: string;
  assignedTo?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
}

/**
 * Order list filters
 */
export interface OrderFilters {
  status?: OrderStatus;
  orderType?: OrderType;
  source?: OrderSource;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

/**
 * Today's order statistics
 */
export interface TodayStats {
  totalOrders: number;
  totalRevenue: number;
  ordersByType: Record<OrderType, number>;
  ordersByStatus: Record<OrderStatus, number>;
  averageOrderValue: number;
  lastOrderNumber: string;
}

/**
 * Generate sequential order number for today
 *
 * Format: ORD-001, ORD-002, etc. (resets daily)
 *
 * @param tenantId - Tenant ID
 * @param env - Worker environment
 * @returns Order number string
 */
export async function generateOrderNumber(
  tenantId: string,
  env: RestaurantEnv
): Promise<string> {
  const db = getTenantDatabase(tenantId, env);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Get last order number for today
  const result = await db
    .prepare(
      `SELECT order_number FROM orders
       WHERE tenant_id = ? AND date(created_at) = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(tenantId, today)
    .first<{ order_number: string }>();

  if (!result) {
    return 'ORD-001';
  }

  // Extract number from ORD-XXX and increment
  const lastNumber = parseInt(result.order_number.split('-')[1] || '0', 10);
  const nextNumber = lastNumber + 1;

  return `ORD-${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * Create a new order
 *
 * @param input - Order input data
 * @param env - Worker environment
 * @returns Created order
 */
export async function createOrder(
  input: OrderInput,
  env: RestaurantEnv
): Promise<Order> {
  const db = getTenantDatabase(input.tenantId, env);

  // 1. Lookup or create customer
  let customer = await getCustomerByPhone(input.customer.phone, input.tenantId, env);

  if (!customer) {
    customer = await upsertCustomer(
      input.tenantId,
      {
        phone: input.customer.phone,
        name: input.customer.name,
        email: input.customer.email,
      },
      env
    );
  }

  // 2. Generate order number
  const orderNumber = await generateOrderNumber(input.tenantId, env);
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 3. Create order record
  await db
    .prepare(
      `INSERT INTO orders (
        id, tenant_id, order_number, order_type, status, table_number,
        customer_id, subtotal, tax, total, payment_method, payment_status,
        delivery_address_line1, delivery_address_line2, delivery_city,
        delivery_postal_code, delivery_instructions,
        notes, source, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      orderId,
      input.tenantId,
      orderNumber,
      input.orderType,
      'pending',
      input.tableNumber || null,
      customer.id,
      input.subtotal,
      input.tax,
      input.total,
      input.paymentMethod || null,
      input.paymentStatus || 'pending',
      input.deliveryAddress?.addressLine1 || null,
      input.deliveryAddress?.addressLine2 || null,
      input.deliveryAddress?.city || null,
      input.deliveryAddress?.postalCode || null,
      input.deliveryAddress?.instructions || null,
      input.notes || null,
      input.source,
      input.createdBy || null,
      now,
      now
    )
    .run();

  // 4. Create order items
  for (const item of input.items) {
    const itemId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO order_items (
          id, order_id, menu_item_id, name, quantity, price,
          modifiers, special_instructions, category, spice_level,
          is_vegetarian, is_vegan, item_total, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        itemId,
        orderId,
        item.menuItemId,
        item.name,
        item.quantity,
        item.price,
        item.modifiers ? JSON.stringify(item.modifiers) : null,
        item.specialInstructions || null,
        item.category || null,
        item.spiceLevel || null,
        item.isVegetarian ? 1 : 0,
        item.isVegan ? 1 : 0,
        item.itemTotal,
        now
      )
      .run();
  }

  // 5. Update customer metrics
  await updateCustomerMetrics(customer.id, input.tenantId, input.total, now, env);

  // 6. Auto-assign customer tags
  await autoAssignTags(customer.id, input.tenantId, db);

  // 7. Trigger inventory deduction (async, non-blocking)
  if (env.INVENTORY_API_URL) {
    triggerInventoryDeduction(orderId, input.tenantId, input.items, env).catch((err) => {
      console.error('[Order] Inventory deduction failed:', err);
    });
  }

  // 8. Fetch and return complete order
  return getOrder(orderId, input.tenantId, env);
}

/**
 * Get order by ID
 *
 * @param orderId - Order ID
 * @param tenantId - Tenant ID
 * @param env - Worker environment
 * @returns Order or null if not found
 */
export async function getOrder(
  orderId: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<Order> {
  const db = getTenantDatabase(tenantId, env);

  // Fetch order
  const orderRecord = await db
    .prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?')
    .bind(orderId, tenantId)
    .first<any>();

  if (!orderRecord) {
    throw new Error('Order not found');
  }

  // Fetch order items
  const itemsResult = await db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at')
    .bind(orderId)
    .all<any>();

  const items: OrderItem[] = itemsResult.results.map((item) => ({
    id: item.id,
    orderId: item.order_id,
    menuItemId: item.menu_item_id,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    modifiers: item.modifiers ? JSON.parse(item.modifiers) : undefined,
    specialInstructions: item.special_instructions,
    category: item.category,
    spiceLevel: item.spice_level,
    isVegetarian: item.is_vegetarian === 1,
    isVegan: item.is_vegan === 1,
    itemTotal: item.item_total,
    createdAt: item.created_at,
  }));

  // Fetch customer info
  const customer = await db
    .prepare('SELECT id, phone_hash FROM customers WHERE id = ?')
    .bind(orderRecord.customer_id)
    .first<any>();

  // Construct order
  const order: Order = {
    id: orderRecord.id,
    tenantId: orderRecord.tenant_id,
    orderNumber: orderRecord.order_number,
    orderType: orderRecord.order_type,
    status: orderRecord.status,
    tableNumber: orderRecord.table_number,
    customerId: orderRecord.customer_id,
    items,
    subtotal: orderRecord.subtotal,
    tax: orderRecord.tax,
    total: orderRecord.total,
    paymentMethod: orderRecord.payment_method,
    paymentStatus: orderRecord.payment_status || 'pending',
    deliveryAddress: orderRecord.delivery_address_line1
      ? {
          addressLine1: orderRecord.delivery_address_line1,
          addressLine2: orderRecord.delivery_address_line2,
          city: orderRecord.delivery_city,
          postalCode: orderRecord.delivery_postal_code,
          instructions: orderRecord.delivery_instructions,
        }
      : undefined,
    notes: orderRecord.notes,
    source: orderRecord.source,
    createdBy: orderRecord.created_by,
    assignedTo: orderRecord.assigned_to,
    createdAt: orderRecord.created_at,
    updatedAt: orderRecord.updated_at,
    completedAt: orderRecord.completed_at,
    cancelledAt: orderRecord.cancelled_at,
  };

  return order;
}

/**
 * List orders with filtering and pagination
 *
 * @param tenantId - Tenant ID
 * @param filters - Filter options
 * @param env - Worker environment
 * @returns Orders and pagination info
 */
export async function listOrders(
  tenantId: string,
  filters: OrderFilters,
  env: RestaurantEnv
): Promise<{ orders: Order[]; total: number; hasMore: boolean }> {
  const db = getTenantDatabase(tenantId, env);

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;

  // Build query
  const conditions: string[] = ['tenant_id = ?'];
  const params: any[] = [tenantId];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (filters.orderType) {
    conditions.push('order_type = ?');
    params.push(filters.orderType);
  }

  if (filters.source) {
    conditions.push('source = ?');
    params.push(filters.source);
  }

  if (filters.customerId) {
    conditions.push('customer_id = ?');
    params.push(filters.customerId);
  }

  if (filters.startDate) {
    conditions.push('created_at >= ?');
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('created_at <= ?');
    params.push(filters.endDate);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM orders WHERE ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  const total = countResult?.count || 0;

  // Get orders
  const ordersResult = await db
    .prepare(
      `SELECT * FROM orders WHERE ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all<any>();

  // Fetch items for each order
  const orders: Order[] = [];
  for (const orderRecord of ordersResult.results) {
    const order = await getOrder(orderRecord.id, tenantId, env);
    orders.push(order);
  }

  return {
    orders,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Update order status
 *
 * @param orderId - Order ID
 * @param tenantId - Tenant ID
 * @param newStatus - New status
 * @param env - Worker environment
 * @returns Updated order
 */
export async function updateOrderStatus(
  orderId: string,
  tenantId: string,
  newStatus: OrderStatus,
  env: RestaurantEnv
): Promise<Order> {
  const db = getTenantDatabase(tenantId, env);

  await db
    .prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
    .bind(newStatus, new Date().toISOString(), orderId, tenantId)
    .run();

  return getOrder(orderId, tenantId, env);
}

/**
 * Trigger inventory deduction via the vision-inventory API
 *
 * This is called asynchronously after order creation.
 * It looks up recipes for each menu item and deducts ingredients from inventory.
 *
 * @param orderId - Order ID
 * @param tenantId - Tenant ID
 * @param items - Order items
 * @param env - Worker environment
 */
async function triggerInventoryDeduction(
  orderId: string,
  tenantId: string,
  items: OrderItemInput[],
  env: RestaurantEnv
): Promise<void> {
  if (!env.INVENTORY_API_URL) {
    console.log('[Inventory] INVENTORY_API_URL not configured, skipping deduction');
    return;
  }

  try {
    const response = await fetch(`${env.INVENTORY_API_URL}/api/orders/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        ...(env.INVENTORY_API_KEY && { Authorization: `Bearer ${env.INVENTORY_API_KEY}` }),
      },
      body: JSON.stringify({
        order_id: orderId,
        items: items.map((item) => ({
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
        })),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Inventory] Deduction API error:', response.status, errorData);
      return;
    }

    const result = await response.json();
    console.log('[Inventory] Deduction result:', {
      orderId,
      deductionsCount: result.data?.deductions?.length || 0,
      lowStockAlerts: result.data?.low_stock_alerts?.length || 0,
    });

    // Log low stock alerts
    if (result.data?.low_stock_alerts?.length > 0) {
      console.warn('[Inventory] Low stock alerts:', result.data.low_stock_alerts);
    }
  } catch (error) {
    console.error('[Inventory] Failed to call deduction API:', error);
  }
}

/**
 * Get today's order statistics
 *
 * @param tenantId - Tenant ID
 * @param env - Worker environment
 * @returns Today's stats
 */
export async function getTodayStats(
  tenantId: string,
  env: RestaurantEnv
): Promise<TodayStats> {
  const db = getTenantDatabase(tenantId, env);
  const today = new Date().toISOString().split('T')[0];

  // Get all orders for today
  const ordersResult = await db
    .prepare(
      `SELECT order_type, status, total, order_number
       FROM orders
       WHERE tenant_id = ? AND date(created_at) = ?`
    )
    .bind(tenantId, today)
    .all<any>();

  const orders = ordersResult.results;

  // Calculate stats
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const ordersByType: Record<OrderType, number> = {
    'dine-in': 0,
    takeout: 0,
    delivery: 0,
  };

  const ordersByStatus: Record<OrderStatus, number> = {
    pending: 0,
    confirmed: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
  };

  let lastOrderNumber = 'ORD-000';

  for (const order of orders) {
    ordersByType[order.order_type as OrderType]++;
    ordersByStatus[order.status as OrderStatus]++;
    if (order.order_number > lastOrderNumber) {
      lastOrderNumber = order.order_number;
    }
  }

  return {
    totalOrders,
    totalRevenue,
    ordersByType,
    ordersByStatus,
    averageOrderValue,
    lastOrderNumber,
  };
}
