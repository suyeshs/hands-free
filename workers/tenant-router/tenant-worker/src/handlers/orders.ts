/**
 * Order Handlers for Tenant Worker
 *
 * All order CRUD operations with direct D1 access and atomic transactions.
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  itemTotal: number;
  modifiers?: string | null;
  customization?: string | null;
  specialInstructions?: string | null;
  category?: string | null;
  spiceLevel?: string | null;
  isVegetarian?: boolean;
  isVegan?: boolean;
}

interface OrderPayload {
  tenantId?: string;
  orderType: 'dine_in' | 'dine-in' | 'takeaway' | 'takeout' | 'delivery';
  tableNumber?: number | null;
  items: OrderItem[];
  subtotal: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  // Nested customer object (web client shape)
  customer?: { phone?: string; name?: string; email?: string } | null;
  // Either a string or a nested object (web client sends nested)
  deliveryAddress?: string | { addressLine1?: string; city?: string; postalCode?: string; instructions?: string } | null;
  deliveryInstructions?: string | null;
  notes?: string;
  status?: string;
  source?: string;
  createdBy?: string | null;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Sync configuration for orders table
const ordersSyncConfig: SyncTableConfig = {
  tableName: 'orders',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'orderNumber', target: 'order_number', type: 'TEXT', required: true },
    {
      source: 'orderType',
      target: 'order_type',
      type: 'TEXT',
      required: true,
      transform: (val) => {
        // Normalize: dine_in → dine-in, takeaway → takeout
        if (val === 'dine_in') return 'dine-in';
        if (val === 'takeaway') return 'takeout';
        return val;
      }
    },
    { source: 'status', target: 'status', type: 'TEXT', required: true },
    { source: 'subtotal', target: 'subtotal', type: 'REAL', required: true },
    { source: 'tax', target: 'tax', type: 'REAL' },
    { source: 'total', target: 'total', type: 'REAL', required: true },
    { source: 'paymentMethod', target: 'payment_method', type: 'TEXT' },
    { source: 'tableNumber', target: 'table_number', type: 'INTEGER' },
    { source: 'customerName', target: 'customer_name', type: 'TEXT' },
    { source: 'customerPhone', target: 'customer_phone', type: 'TEXT' },
    { source: 'notes', target: 'notes', type: 'TEXT' },
    { source: 'source', target: 'source', type: 'TEXT' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
    { source: 'completedAt', target: 'completed_at', type: 'TEXT' },
  ],
  batchSize: 50, // Smaller batches since we'll also sync order_items
  hooks: {
    afterSync: async (result) => {
      console.log(`[Orders] Synced ${result.synced}/${result.totalRecords} orders in ${result.duration}ms`);
    }
  }
};

// Sync configuration for order_items table
const orderItemsSyncConfig: SyncTableConfig = {
  tableName: 'order_items',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'orderId', target: 'order_id', type: 'TEXT', required: true },
    { source: 'menuItemId', target: 'menu_item_id', type: 'TEXT', required: true },
    { source: 'name', target: 'name', type: 'TEXT', required: true },
    { source: 'quantity', target: 'quantity', type: 'INTEGER', required: true },
    { source: 'price', target: 'price', type: 'REAL', required: true },
    {
      source: 'customization',
      target: 'customization',
      type: 'TEXT',
      transform: (val) => val || null
    },
    { source: 'itemTotal', target: 'item_total', type: 'REAL', required: true },
  ],
  batchSize: 100,
};

// NOTE: Workers for Platforms dispatch workers cannot make outbound fetch calls.
// DO notifications are handled by the router worker (handsfree-orders) directly
// after it receives the success response from this tenant worker.

/**
 * POST /orders - Create a new order with atomic transaction
 */
export async function handleCreateOrder(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as OrderPayload;

    // Validation
    if (!body.items || body.items.length === 0) {
      return Response.json({
        success: false,
        error: 'Order must contain at least one item',
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (!body.total || body.total <= 0) {
      return Response.json({
        success: false,
        error: 'Order total must be greater than 0',
      }, { status: 400, headers: CORS_HEADERS });
    }

    // Generate order ID and order number
    const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const orderNumber = `#${Math.floor(1000 + Math.random() * 9000)}`;
    const createdAt = new Date().toISOString();

    // Normalize order_type to match schema CHECK constraint: 'dine_in', 'takeaway', 'delivery'
    let orderType: string = body.orderType;
    if (orderType === 'dine-in') orderType = 'dine_in';
    if (orderType === 'takeout' || orderType === 'pickup') orderType = 'takeaway';

    // Support both flat fields (POS shape) and nested customer object (web client shape)
    const customerName = body.customerName || body.customer?.name || null;
    const customerPhone = body.customerPhone || body.customer?.phone || null;
    let customerId = body.customerId || null;

    // Auto-link customer by phone if no customerId provided
    if (!customerId && customerPhone) {
      const phoneDigits = customerPhone.replace(/\D/g, '');
      // Match stored phone in either 10-digit or +91 format
      const phone10 = phoneDigits.startsWith('91') && phoneDigits.length === 12
        ? phoneDigits.slice(2)
        : phoneDigits.startsWith('0') && phoneDigits.length === 11
          ? phoneDigits.slice(1)
          : phoneDigits;
      const linked = await env.DB.prepare(
        `SELECT id FROM customers WHERE tenant_id = ?
         AND (phone_number_encrypted = ? OR phone_number_encrypted = ?)`
      ).bind(tenantId, phone10, `+91${phone10}`).first<{ id: string }>();
      if (linked) customerId = linked.id;
    }

    customerId = customerId || 'guest';

    // Support both string and nested object for deliveryAddress (web client sends nested)
    let deliveryAddressLine1: string | null = null;
    let deliveryInstructions: string | null = body.deliveryInstructions || null;
    if (typeof body.deliveryAddress === 'string') {
      deliveryAddressLine1 = body.deliveryAddress || null;
    } else if (body.deliveryAddress && typeof body.deliveryAddress === 'object') {
      deliveryAddressLine1 = body.deliveryAddress.addressLine1 || null;
      deliveryInstructions = deliveryInstructions || body.deliveryAddress.instructions || null;
    }

    console.log(`[TenantWorker] Creating order ${orderId} for tenant ${tenantId} customer=${customerId}`);

    // Build atomic batch transaction
    // Actual D1 schema: id, tenant_id, order_number, order_type, status, table_number, customer_id,
    //   subtotal, tax, total, payment_method, payment_status,
    //   delivery_address_line1, delivery_address_line2, delivery_city, delivery_postal_code, delivery_instructions,
    //   notes, source, created_by, assigned_to, created_at, updated_at, completed_at, cancelled_at
    const statements: D1PreparedStatement[] = [
      // Insert order
      env.DB.prepare(`
        INSERT INTO orders (
          id, tenant_id, order_number, order_type, status, table_number,
          customer_id, customer_name, customer_phone,
          subtotal, tax, total, payment_method, payment_status,
          delivery_address_line1, delivery_instructions,
          notes, source, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        tenantId,
        orderNumber,
        orderType,
        body.status || 'pending',
        body.tableNumber || null,
        customerId,
        customerName,
        customerPhone,
        body.subtotal,
        body.tax || 0,
        body.total,
        body.paymentMethod || 'cash',
        body.paymentStatus || 'pending',
        deliveryAddressLine1,
        deliveryInstructions,
        body.notes || null,
        body.source || 'pos',
        body.createdBy || null,
        createdAt,
        createdAt
      ),
      // Insert order items
      // Actual schema: id, order_id, menu_item_id, name, quantity, price, modifiers, special_instructions,
      //                category, spice_level, is_vegetarian, is_vegan, item_total, created_at
      ...body.items.map((item, index) =>
        env.DB.prepare(`
          INSERT INTO order_items (
            id, order_id, menu_item_id, name, quantity, price, modifiers, special_instructions,
            category, spice_level, is_vegetarian, is_vegan, item_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          `item-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 11)}`,
          orderId,
          item.menuItemId || `manual-item-${index}`,
          item.name || 'Unknown Item',
          item.quantity || 1,
          item.price || 0,
          item.modifiers || item.customization || null,
          item.specialInstructions || null,
          item.category || null,
          item.spiceLevel || null,
          item.isVegetarian ? 1 : 0,
          item.isVegan ? 1 : 0,
          item.itemTotal || (item.price || 0) * (item.quantity || 1)
        )
      ),
    ];

    // Update customer metrics if this is a real customer (not guest)
    if (customerId && customerId !== 'guest') {
      statements.push(
        env.DB.prepare(`
          UPDATE customers
          SET total_orders = total_orders + 1,
              total_spent = total_spent + ?,
              average_order_value = (total_spent + ?) / (total_orders + 1),
              last_order_date = ?,
              first_order_date = COALESCE(first_order_date, ?),
              updated_at = ?
          WHERE id = ? AND tenant_id = ?
        `).bind(
          body.total, body.total,
          createdAt, createdAt, createdAt,
          customerId, tenantId
        )
      );
    }

    // Execute as atomic batch transaction
    await env.DB.batch(statements);

    console.log(`[TenantWorker] Order ${orderId} created successfully`);

    // NOTE: DO notification is handled by the router worker after receiving this response.
    // Workers for Platforms dispatch workers cannot make outbound fetch calls.

    return Response.json({
      success: true,
      orderId,
      orderNumber,
      tenantId,
      createdAt,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[TenantWorker] Error creating order:', error);
    return Response.json({
      success: false,
      error: 'Failed to create order',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /orders - List orders with pagination and filtering
 */
export async function handleListOrders(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query
    let query = `SELECT * FROM orders WHERE tenant_id = ?`;
    let countQuery = `SELECT COUNT(*) as total FROM orders WHERE tenant_id = ?`;
    const params: any[] = [tenantId];
    const countParams: any[] = [tenantId];

    if (status && status !== 'all') {
      query += ` AND status = ?`;
      countQuery += ` AND status = ?`;
      params.push(status);
      countParams.push(status);
    }

    // Get total count
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();
    const totalOrders = countResult?.total || 0;

    // Add ordering and pagination
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute query
    const ordersResult = await env.DB.prepare(query).bind(...params).all();
    const orders = ordersResult.results || [];

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        const itemsResult = await env.DB.prepare(
          `SELECT * FROM order_items WHERE order_id = ?`
        ).bind(order.id).all();

        return {
          ...order,
          items: itemsResult.results || [],
        };
      })
    );

    return Response.json({
      success: true,
      tenantId,
      orders: ordersWithItems,
      pagination: {
        total: totalOrders,
        limit,
        offset,
        hasMore: offset + limit < totalOrders,
      },
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[TenantWorker] Error listing orders:', error);
    return Response.json({
      success: false,
      error: 'Failed to list orders',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /orders/:orderId - Get a single order by ID
 */
export async function handleGetOrder(
  request: Request,
  env: Env,
  tenantId: string,
  orderId: string
): Promise<Response> {
  try {
    // Get order
    const order = await env.DB.prepare(
      `SELECT * FROM orders WHERE id = ? AND tenant_id = ?`
    ).bind(orderId, tenantId).first();

    if (!order) {
      return Response.json({
        success: false,
        error: 'Order not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Get order items
    const itemsResult = await env.DB.prepare(
      `SELECT * FROM order_items WHERE order_id = ?`
    ).bind(orderId).all();

    return Response.json({
      success: true,
      order: {
        ...order,
        items: itemsResult.results || [],
      },
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[TenantWorker] Error getting order:', error);
    return Response.json({
      success: false,
      error: 'Failed to get order',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * PATCH /orders/:orderId/status - Update order status
 */
export async function handleUpdateOrderStatus(
  request: Request,
  env: Env,
  tenantId: string,
  orderId: string
): Promise<Response> {
  try {
    const body = await request.json() as { status: string };

    if (!body.status) {
      return Response.json({
        success: false,
        error: 'Status is required',
      }, { status: 400, headers: CORS_HEADERS });
    }

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(body.status)) {
      return Response.json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      }, { status: 400, headers: CORS_HEADERS });
    }

    const updatedAt = new Date().toISOString();
    const completedAt = body.status === 'completed' ? updatedAt : null;

    // Schema only has completed_at, not cancelled_at
    const result = await env.DB.prepare(`
      UPDATE orders
      SET status = ?, updated_at = ?, completed_at = COALESCE(?, completed_at)
      WHERE id = ? AND tenant_id = ?
    `).bind(body.status, updatedAt, completedAt, orderId, tenantId).run();

    if (result.meta.changes === 0) {
      return Response.json({
        success: false,
        error: 'Order not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    // NOTE: Status update notification should be handled by router worker.
    // For now, status updates are not broadcast in real-time.
    // TODO: Add status update notification in router worker if needed.

    return Response.json({
      success: true,
      orderId,
      status: body.status,
      updatedAt,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[TenantWorker] Error updating order status:', error);
    return Response.json({
      success: false,
      error: 'Failed to update order status',
      message: error.message,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * PATCH /orders/:orderId/payment-status - Mark order payment as paid (called after Razorpay verification)
 */
export async function handleUpdatePaymentStatus(
  request: Request,
  env: Env,
  tenantId: string,
  orderId: string
): Promise<Response> {
  try {
    const body = await request.json() as { paymentStatus: string; razorpayPaymentId?: string };

    const paymentStatus = body.paymentStatus || 'paid';
    const updatedAt = new Date().toISOString();

    const result = await env.DB.prepare(`
      UPDATE orders
      SET payment_status = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `).bind(paymentStatus, updatedAt, orderId, tenantId).run();

    if (result.meta.changes === 0) {
      return Response.json({ success: false, error: 'Order not found' }, { status: 404, headers: CORS_HEADERS });
    }

    return Response.json({ success: true, orderId, paymentStatus }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[TenantWorker] Error updating payment status:', error);
    return Response.json({ success: false, error: 'Failed to update payment status', message: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /orders/sync - Sync orders from POS to D1 using SyncEngine
 * Syncs both orders and order_items in a coordinated manner
 */
export async function handleOrdersSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { orders: Array<OrderPayload & { id: string; createdAt: string; updatedAt: string }> };
    const orders = body.orders || [];

    if (orders.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);

    // Step 1: Sync orders (parent records)
    const ordersResult = await syncEngine.sync(ordersSyncConfig, orders);

    if (!ordersResult.success) {
      return Response.json({
        success: false,
        synced: ordersResult.synced,
        errors: ordersResult.errors.map(e => `Order ${e.recordId || 'unknown'}: ${e.error}`),
      }, { headers: CORS_HEADERS });
    }

    // Step 2: Sync order_items (child records)
    // Flatten all items from all orders
    const allItems: any[] = [];
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          allItems.push({
            ...item,
            orderId: order.id, // Link to parent order
            // Generate item ID if not provided
            id: (item as any).id || `item-${order.id}-${item.menuItemId}-${Date.now()}`,
          });
        });
      }
    });

    let itemsResult = { synced: 0, failed: 0, errors: [] as any[] };
    if (allItems.length > 0) {
      itemsResult = await syncEngine.sync(orderItemsSyncConfig, allItems);
    }

    // Combine results
    return Response.json({
      success: ordersResult.success && (allItems.length === 0 || itemsResult.synced > 0),
      orders: {
        synced: ordersResult.synced,
        failed: ordersResult.failed,
      },
      items: {
        synced: itemsResult.synced,
        failed: itemsResult.failed,
      },
      errors: [
        ...ordersResult.errors.map(e => `Order ${e.recordId || 'unknown'}: ${e.error}`),
        ...itemsResult.errors.map(e => `Item ${e.recordId || 'unknown'}: ${e.error}`),
      ],
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Orders] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync orders',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
