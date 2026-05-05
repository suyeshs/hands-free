/**
 * Sales Transactions Handler
 *
 * Handles syncing and querying POS sales transactions from the POS app to the D1 cloud database.
 * Enables multi-restaurant aggregation and cloud-based reporting.
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

interface SalesTransactionItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  modifiers?: string[];
}

interface SalesTransactionPayload {
  id: string;
  invoiceNumber: string;
  orderNumber?: string;
  orderType: string;
  tableNumber?: number;
  source: string;
  subtotal: number;
  serviceCharge: number;
  cgst: number;
  sgst: number;
  discount: number;
  roundOff: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  items: SalesTransactionItem[];
  cashierName?: string;
  staffId?: string;
  createdAt: string;
  completedAt: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Ensure the sales_transactions table exists
 */
async function ensureSalesTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sales_transactions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      order_number TEXT,
      order_type TEXT NOT NULL,
      table_number INTEGER,
      source TEXT NOT NULL DEFAULT 'pos',
      subtotal REAL NOT NULL,
      service_charge REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      round_off REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'completed',
      items_json TEXT NOT NULL,
      cashier_name TEXT,
      staff_id TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Create indexes
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales_transactions(tenant_id, completed_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_sales_tenant_source ON sales_transactions(tenant_id, source)').run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tenant_invoice ON sales_transactions(tenant_id, invoice_number)').run();
}

// Sync configuration for sales_transactions table
const salesSyncConfig: SyncTableConfig = {
  tableName: 'sales_transactions',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['tenant_id', 'invoice_number'],
  timestampColumn: 'completed_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'tenant_id', target: 'tenant_id', type: 'TEXT', required: true },
    { source: 'invoice_number', target: 'invoice_number', type: 'TEXT', required: true },
    { source: 'order_number', target: 'order_number', type: 'TEXT' },
    { source: 'order_type', target: 'order_type', type: 'TEXT', required: true },
    { source: 'table_number', target: 'table_number', type: 'INTEGER' },
    { source: 'source', target: 'source', type: 'TEXT', required: true },
    { source: 'subtotal', target: 'subtotal', type: 'REAL', required: true },
    { source: 'service_charge', target: 'service_charge', type: 'REAL' },
    { source: 'cgst', target: 'cgst', type: 'REAL' },
    { source: 'sgst', target: 'sgst', type: 'REAL' },
    { source: 'discount', target: 'discount', type: 'REAL' },
    { source: 'round_off', target: 'round_off', type: 'REAL' },
    { source: 'grand_total', target: 'grand_total', type: 'REAL', required: true },
    { source: 'payment_method', target: 'payment_method', type: 'TEXT', required: true },
    { source: 'payment_status', target: 'payment_status', type: 'TEXT', required: true },
    { source: 'items_json', target: 'items_json', type: 'TEXT', required: true },
    { source: 'cashier_name', target: 'cashier_name', type: 'TEXT' },
    { source: 'staff_id', target: 'staff_id', type: 'TEXT' },
    { source: 'created_at', target: 'created_at', type: 'TEXT', required: true },
    { source: 'completed_at', target: 'completed_at', type: 'TEXT', required: true },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[Sales] Synced ${result.synced}/${result.totalRecords} sales transactions in ${result.duration}ms`);
    }
  }
};

/**
 * POST /sales/sync - Sync sales transactions from POS to D1 using SyncEngine
 */
export async function handleSalesSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { transactions: SalesTransactionPayload[] };
    const transactions = body.transactions || [];

    if (transactions.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Ensure table exists
    await ensureSalesTable(env.DB);

    // Create sync engine instance
    const syncEngine = createSyncEngine(env.DB, tenantId);

    // Inject tenant_id into each record (source records may have a different tenant_id)
    const enriched = transactions.map((t: any) => ({ ...t, tenant_id: tenantId }));

    // Sync using the unified engine
    const result = await syncEngine.sync(salesSyncConfig, enriched);

    // Convert SyncResult to response format
    return Response.json({
      success: result.success,
      synced: result.synced,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Sales] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync sales transactions',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /sales/summary - Get sales summary for date range
 */
export async function handleSalesSummary(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    await ensureSalesTable(env.DB);

    // Get overall summary
    const summaryResult = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(grand_total), 0) as total_sales,
        COUNT(*) as total_orders,
        COALESCE(SUM(cgst + sgst), 0) as total_tax,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(service_charge), 0) as total_service_charge
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ?
    `).bind(tenantId, startDate, endDate).first();

    // Get breakdown by source
    const sourceResult = await env.DB.prepare(`
      SELECT source, COUNT(*) as orders, COALESCE(SUM(grand_total), 0) as sales
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ?
      GROUP BY source
    `).bind(tenantId, startDate, endDate).all();

    const totalSales = (summaryResult?.total_sales as number) || 0;
    const totalOrders = (summaryResult?.total_orders as number) || 0;

    const bySource: Record<string, { orders: number; sales: number }> = {};
    for (const row of sourceResult.results || []) {
      bySource[row.source as string] = {
        orders: row.orders as number,
        sales: row.sales as number,
      };
    }

    return Response.json({
      success: true,
      summary: {
        totalSales,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
        totalTax: (summaryResult?.total_tax as number) || 0,
        totalDiscount: (summaryResult?.total_discount as number) || 0,
        totalServiceCharge: (summaryResult?.total_service_charge as number) || 0,
        bySource,
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Sales] Summary error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get sales summary',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /sales/breakdown - Get detailed sales breakdown
 */
export async function handleSalesBreakdown(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    await ensureSalesTable(env.DB);

    // Payment method breakdown (POS transactions only - aggregator tracked separately)
    const paymentResult = await env.DB.prepare(`
      SELECT payment_method, COALESCE(SUM(grand_total), 0) as total
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ? AND source = 'pos'
      GROUP BY payment_method
    `).bind(tenantId, startDate, endDate).all();

    // Order type breakdown (POS transactions only)
    const orderTypeResult = await env.DB.prepare(`
      SELECT order_type, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as sales
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ? AND source = 'pos'
      GROUP BY order_type
    `).bind(tenantId, startDate, endDate).all();

    // Hourly breakdown (POS transactions only)
    const hourlyResult = await env.DB.prepare(`
      SELECT
        CAST(strftime('%H', completed_at) AS INTEGER) as hour,
        COALESCE(SUM(grand_total), 0) as sales,
        COUNT(*) as orders
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ? AND source = 'pos'
      GROUP BY hour
      ORDER BY hour
    `).bind(tenantId, startDate, endDate).all();

    const byPaymentMethod: Record<string, number> = {};
    for (const row of paymentResult.results || []) {
      byPaymentMethod[row.payment_method as string] = row.total as number;
    }

    const byOrderType: Record<string, { count: number; sales: number }> = {};
    for (const row of orderTypeResult.results || []) {
      byOrderType[row.order_type as string] = {
        count: row.count as number,
        sales: row.sales as number,
      };
    }

    // Fill in all hours with zeros
    const byHour: Array<{ hour: number; sales: number; orders: number }> = [];
    const hourMap = new Map((hourlyResult.results || []).map(r => [r.hour as number, r]));
    for (let hour = 0; hour < 24; hour++) {
      const data = hourMap.get(hour);
      byHour.push({
        hour,
        sales: (data?.sales as number) || 0,
        orders: (data?.orders as number) || 0,
      });
    }

    return Response.json({
      success: true,
      breakdown: {
        byPaymentMethod,
        byOrderType,
        byHour,
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Sales] Breakdown error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get sales breakdown',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /sales/items - Get top selling items
 */
export async function handleTopItems(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    await ensureSalesTable(env.DB);

    // Get all POS transactions and aggregate items in memory
    // (D1 doesn't support JSON array functions well)
    // Note: Only POS transactions - aggregator orders tracked separately
    const result = await env.DB.prepare(`
      SELECT items_json
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ? AND source = 'pos'
    `).bind(tenantId, startDate, endDate).all();

    const itemMap = new Map<string, { quantity: number; revenue: number }>();

    for (const row of result.results || []) {
      try {
        const items = JSON.parse(row.items_json as string);
        for (const item of items) {
          const existing = itemMap.get(item.name) || { quantity: 0, revenue: 0 };
          itemMap.set(item.name, {
            quantity: existing.quantity + (item.quantity || 1),
            revenue: existing.revenue + (item.subtotal || item.price * (item.quantity || 1)),
          });
        }
      } catch {
        // Skip malformed JSON
      }
    }

    const items = Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    return Response.json({
      success: true,
      items,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Sales] Top items error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get top items',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /sales/combined - Get combined POS + Aggregator sales
 * POS sales are in sales_transactions table (source = 'pos')
 * Aggregator orders are in aggregator_orders table (swiggy, zomato, etc.)
 */
export async function handleCombinedSales(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    await ensureSalesTable(env.DB);

    // Get POS sales summary from sales_transactions (source = 'pos')
    const posResult = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(grand_total), 0) as total_sales,
        COUNT(*) as total_orders,
        COALESCE(SUM(cgst + sgst), 0) as total_tax,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(service_charge), 0) as total_service_charge
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ? AND source = 'pos'
    `).bind(tenantId, startDate, endDate).first();

    // Get aggregator sales from TWO sources:
    // 1. aggregator_orders table (orders synced from scraper)
    // 2. sales_transactions with source IN ('zomato', 'swiggy') (orders recorded when bumped on KDS)
    // We merge both to ensure complete aggregator data

    const byAggregator: Record<string, { orders: number; sales: number }> = {};
    let aggTotalSales = 0;
    let aggTotalOrders = 0;
    let aggTotalTax = 0;

    // Source 1: aggregator_orders table
    try {
      const aggOrdersResult = await env.DB.prepare(`
        SELECT
          aggregator,
          COUNT(*) as order_count,
          COALESCE(SUM(total), 0) as total_sales,
          COALESCE(SUM(tax), 0) as total_tax
        FROM aggregator_orders
        WHERE tenant_id = ?
          AND created_at >= ? AND created_at <= ?
          AND status NOT IN ('cancelled', 'rejected')
        GROUP BY aggregator
      `).bind(tenantId, startDate, endDate).all();

      for (const row of aggOrdersResult.results || []) {
        const orders = row.order_count as number;
        const sales = row.total_sales as number;
        const tax = (row.total_tax as number) || 0;
        const aggregator = (row.aggregator as string).toLowerCase();
        byAggregator[aggregator] = { orders, sales };
        aggTotalSales += sales;
        aggTotalOrders += orders;
        aggTotalTax += tax;
      }
    } catch (aggError) {
      // aggregator_orders table might not exist yet
      console.warn('[Sales] Could not query aggregator_orders:', aggError);
    }

    // Source 2: sales_transactions with aggregator sources (fallback/supplement)
    // This catches orders that were bumped on KDS and recorded directly to sales_transactions
    try {
      const salesAggResult = await env.DB.prepare(`
        SELECT
          source as aggregator,
          COUNT(*) as order_count,
          COALESCE(SUM(grand_total), 0) as total_sales,
          COALESCE(SUM(cgst + sgst), 0) as total_tax
        FROM sales_transactions
        WHERE tenant_id = ?
          AND completed_at >= ? AND completed_at <= ?
          AND source IN ('zomato', 'swiggy', 'direct')
        GROUP BY source
      `).bind(tenantId, startDate, endDate).all();

      for (const row of salesAggResult.results || []) {
        const orders = row.order_count as number;
        const sales = row.total_sales as number;
        const tax = (row.total_tax as number) || 0;
        const aggregator = (row.aggregator as string).toLowerCase();

        // Merge with existing data (prefer sales_transactions data if both exist as it's more accurate)
        const existing = byAggregator[aggregator];
        if (existing) {
          // If we have data from both sources, use the higher values
          // (sales_transactions is more reliable since it's recorded on completion)
          if (sales > existing.sales) {
            aggTotalSales = aggTotalSales - existing.sales + sales;
            aggTotalOrders = aggTotalOrders - existing.orders + orders;
            aggTotalTax = aggTotalTax + tax;
            byAggregator[aggregator] = { orders, sales };
          }
        } else {
          byAggregator[aggregator] = { orders, sales };
          aggTotalSales += sales;
          aggTotalOrders += orders;
          aggTotalTax += tax;
        }
      }
    } catch (salesAggError) {
      console.warn('[Sales] Could not query sales_transactions for aggregators:', salesAggError);
    }

    const posTotalSales = (posResult?.total_sales as number) || 0;
    const posTotalOrders = (posResult?.total_orders as number) || 0;

    const totalSales = posTotalSales + aggTotalSales;
    const totalOrders = posTotalOrders + aggTotalOrders;
    const totalTax = ((posResult?.total_tax as number) || 0) + aggTotalTax;

    return Response.json({
      success: true,
      pos: {
        totalSales: posTotalSales,
        totalOrders: posTotalOrders,
        averageOrderValue: posTotalOrders > 0 ? posTotalSales / posTotalOrders : 0,
        totalTax: (posResult?.total_tax as number) || 0,
        totalDiscount: (posResult?.total_discount as number) || 0,
        totalServiceCharge: (posResult?.total_service_charge as number) || 0,
      },
      aggregator: {
        totalSales: aggTotalSales,
        totalOrders: aggTotalOrders,
        totalTax: aggTotalTax,
        byAggregator,
      },
      total: {
        totalSales,
        totalOrders,
        totalTax,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Sales] Combined sales error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get combined sales',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /sales/transactions - List paginated sales transactions
 */
export async function handleTransactionsList(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureSalesTable(env.DB);

    const url = new URL(request.url);
    const today = new Date().toISOString().split('T')[0];
    const from = url.searchParams.get('from') || today;
    const to = url.searchParams.get('to') || today;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const orderType = url.searchParams.get('order_type') || null;
    const paymentMethod = url.searchParams.get('payment_method') || null;

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = 'tenant_id = ? AND completed_at >= ? AND completed_at <= ?';
    const baseBindings: any[] = [tenantId, startDate, endDate];

    if (orderType) {
      whereClause += ' AND order_type = ?';
      baseBindings.push(orderType);
    }
    if (paymentMethod) {
      whereClause += ' AND payment_method = ?';
      baseBindings.push(paymentMethod);
    }

    // Count query
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM sales_transactions WHERE ${whereClause}`
    ).bind(...baseBindings).first();

    const total = (countResult?.total as number) || 0;
    const pages = Math.ceil(total / limit);

    // Data query
    const dataResult = await env.DB.prepare(
      `SELECT id, invoice_number, order_number, order_type, table_number, source,
              subtotal, service_charge, cgst, sgst, discount, round_off, grand_total,
              payment_method, payment_status, items_json, cashier_name, created_at, completed_at
       FROM sales_transactions
       WHERE ${whereClause}
       ORDER BY completed_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...baseBindings, limit, offset).all();

    const transactions = (dataResult.results || []).map((row: any) => {
      let items: any[] = [];
      try {
        items = JSON.parse(row.items_json as string);
      } catch {
        items = [];
      }
      return { ...row, items_json: undefined, items };
    });

    return Response.json({
      success: true,
      transactions,
      total,
      page,
      limit,
      pages,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Sales] Transactions list error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get transactions',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}
