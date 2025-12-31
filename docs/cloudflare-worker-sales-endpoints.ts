/**
 * Cloudflare Worker Sales Endpoints Reference
 *
 * This file contains the endpoint implementations needed in the handsfree-orders worker
 * to support POS sales transaction sync to D1.
 *
 * Add these endpoints to the existing worker alongside the aggregator-orders endpoints.
 */

// ==================== D1 SCHEMA ====================
/*
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
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales_transactions(tenant_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_source ON sales_transactions(tenant_id, source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tenant_invoice ON sales_transactions(tenant_id, invoice_number);
*/

// ==================== TYPE DEFINITIONS ====================

interface SalesTransactionSyncPayload {
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
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    modifiers?: string[];
  }>;
  cashierName?: string;
  staffId?: string;
  createdAt: string;
  completedAt: string;
}

interface Env {
  DB: D1Database;
}

// ==================== ENDPOINT IMPLEMENTATIONS ====================

/**
 * POST /api/sales/:tenantId/sync
 * Sync sales transactions from POS to D1
 */
async function handleSalesSync(request: Request, env: Env, tenantId: string): Promise<Response> {
  try {
    const { transactions } = await request.json() as { transactions: SalesTransactionSyncPayload[] };

    if (!transactions || !Array.isArray(transactions)) {
      return Response.json({ success: false, error: 'Missing transactions array' }, { status: 400 });
    }

    let synced = 0;
    const errors: string[] = [];

    for (const tx of transactions) {
      try {
        // Use INSERT OR REPLACE to handle duplicates (idempotent sync)
        await env.DB.prepare(`
          INSERT OR REPLACE INTO sales_transactions (
            id, tenant_id, invoice_number, order_number, order_type, table_number,
            source, subtotal, service_charge, cgst, sgst, discount, round_off,
            grand_total, payment_method, payment_status, items_json,
            cashier_name, staff_id, created_at, completed_at, synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          tx.id,
          tenantId,
          tx.invoiceNumber,
          tx.orderNumber || null,
          tx.orderType,
          tx.tableNumber || null,
          tx.source,
          tx.subtotal,
          tx.serviceCharge,
          tx.cgst,
          tx.sgst,
          tx.discount,
          tx.roundOff,
          tx.grandTotal,
          tx.paymentMethod,
          tx.paymentStatus,
          JSON.stringify(tx.items),
          tx.cashierName || null,
          tx.staffId || null,
          tx.createdAt,
          tx.completedAt
        ).run();

        synced++;
      } catch (err) {
        errors.push(`Failed to sync ${tx.invoiceNumber}: ${err}`);
      }
    }

    return Response.json({ success: true, synced, errors });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/sales/:tenantId/summary
 * Get sales summary for date range
 */
async function handleSalesSummary(request: Request, env: Env, tenantId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;

    // Convert dates to ISO format for comparison
    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

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
    for (const row of sourceResult.results) {
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
    });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/sales/:tenantId/breakdown
 * Get detailed sales breakdown
 */
async function handleSalesBreakdown(request: Request, env: Env, tenantId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    // Payment method breakdown
    const paymentResult = await env.DB.prepare(`
      SELECT payment_method, COALESCE(SUM(grand_total), 0) as total
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ?
      GROUP BY payment_method
    `).bind(tenantId, startDate, endDate).all();

    // Order type breakdown
    const orderTypeResult = await env.DB.prepare(`
      SELECT order_type, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as sales
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ?
      GROUP BY order_type
    `).bind(tenantId, startDate, endDate).all();

    // Hourly breakdown
    const hourlyResult = await env.DB.prepare(`
      SELECT
        CAST(strftime('%H', completed_at) AS INTEGER) as hour,
        COALESCE(SUM(grand_total), 0) as sales,
        COUNT(*) as orders
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ?
      GROUP BY hour
      ORDER BY hour
    `).bind(tenantId, startDate, endDate).all();

    const byPaymentMethod: Record<string, number> = {};
    for (const row of paymentResult.results) {
      byPaymentMethod[row.payment_method as string] = row.total as number;
    }

    const byOrderType: Record<string, { count: number; sales: number }> = {};
    for (const row of orderTypeResult.results) {
      byOrderType[row.order_type as string] = {
        count: row.count as number,
        sales: row.sales as number,
      };
    }

    // Fill in all hours with zeros
    const byHour: Array<{ hour: number; sales: number; orders: number }> = [];
    const hourMap = new Map(hourlyResult.results.map(r => [r.hour as number, r]));
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
    });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/sales/:tenantId/items
 * Get top selling items
 */
async function handleTopItems(request: Request, env: Env, tenantId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    // Get all transactions and aggregate items in memory
    // (D1 doesn't support JSON array functions well)
    const result = await env.DB.prepare(`
      SELECT items_json
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ?
    `).bind(tenantId, startDate, endDate).all();

    const itemMap = new Map<string, { quantity: number; revenue: number }>();

    for (const row of result.results) {
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

    return Response.json({ success: true, items });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/sales/:tenantId/combined
 * Get combined POS + Aggregator sales
 */
async function handleCombinedSales(request: Request, env: Env, tenantId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    // Get POS sales summary
    const posResult = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(grand_total), 0) as total_sales,
        COUNT(*) as total_orders,
        COALESCE(SUM(cgst + sgst), 0) as total_tax,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(service_charge), 0) as total_service_charge
      FROM sales_transactions
      WHERE tenant_id = ? AND completed_at >= ? AND completed_at <= ?
    `).bind(tenantId, startDate, endDate).first();

    // Get aggregator sales summary
    const aggResult = await env.DB.prepare(`
      SELECT
        aggregator,
        COUNT(*) as order_count,
        COALESCE(SUM(total), 0) as total_sales
      FROM aggregator_orders
      WHERE tenant_id = ?
        AND status IN ('ready', 'pending_pickup', 'picked_up', 'out_for_delivery', 'completed', 'delivered')
        AND created_at >= ? AND created_at <= ?
      GROUP BY aggregator
    `).bind(tenantId, startDate, endDate).all();

    const posTotalSales = (posResult?.total_sales as number) || 0;
    const posTotalOrders = (posResult?.total_orders as number) || 0;

    let aggTotalSales = 0;
    let aggTotalOrders = 0;
    const byAggregator: Record<string, { orders: number; sales: number }> = {};

    for (const row of aggResult.results) {
      const orders = row.order_count as number;
      const sales = row.total_sales as number;
      byAggregator[row.aggregator as string] = { orders, sales };
      aggTotalSales += sales;
      aggTotalOrders += orders;
    }

    const totalSales = posTotalSales + aggTotalSales;
    const totalOrders = posTotalOrders + aggTotalOrders;

    return Response.json({
      success: true,
      pos: {
        totalSales: posTotalSales,
        totalOrders: posTotalOrders,
        averageOrderValue: posTotalOrders > 0 ? posTotalSales / posTotalOrders : 0,
        totalTax: (posResult?.total_tax as number) || 0,
        totalDiscount: (posResult?.total_discount as number) || 0,
        totalServiceCharge: (posResult?.total_service_charge as number) || 0,
        bySource: { pos: { orders: posTotalOrders, sales: posTotalSales } },
      },
      aggregator: {
        totalSales: aggTotalSales,
        totalOrders: aggTotalOrders,
        byAggregator,
      },
      total: {
        totalSales,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ==================== ROUTER INTEGRATION ====================
/*
Add these routes to your worker's fetch handler:

// Sales sync endpoints
if (path.match(/^\/api\/sales\/([^/]+)\/sync$/) && request.method === 'POST') {
  const tenantId = path.split('/')[3];
  return handleSalesSync(request, env, tenantId);
}

if (path.match(/^\/api\/sales\/([^/]+)\/summary$/) && request.method === 'GET') {
  const tenantId = path.split('/')[3];
  return handleSalesSummary(request, env, tenantId);
}

if (path.match(/^\/api\/sales\/([^/]+)\/breakdown$/) && request.method === 'GET') {
  const tenantId = path.split('/')[3];
  return handleSalesBreakdown(request, env, tenantId);
}

if (path.match(/^\/api\/sales\/([^/]+)\/items$/) && request.method === 'GET') {
  const tenantId = path.split('/')[3];
  return handleTopItems(request, env, tenantId);
}

if (path.match(/^\/api\/sales\/([^/]+)\/combined$/) && request.method === 'GET') {
  const tenantId = path.split('/')[3];
  return handleCombinedSales(request, env, tenantId);
}
*/

export {
  handleSalesSync,
  handleSalesSummary,
  handleSalesBreakdown,
  handleTopItems,
  handleCombinedSales,
};
