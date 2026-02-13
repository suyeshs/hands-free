/**
 * Chain Sales Sync Handler
 *
 * Handles syncing sales from location tenants to the master tenant's D1 database
 * for consolidated chain-wide reporting.
 *
 * This file is designed to be integrated into the tenant-worker at:
 * handsfree-restaurant-new/platform/workers/tenant-router/tenant-worker/src/handlers/chain-sync.ts
 */

interface Env {
  DB: D1Database;
  TENANTS_DB?: D1Database;
}

interface ChainSalesTransaction {
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
};

/**
 * Ensure chain sales aggregation table exists
 */
async function ensureChainSalesTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS chain_sales_aggregated (
      id TEXT PRIMARY KEY,
      location_group_id TEXT NOT NULL,
      location_tenant_id TEXT NOT NULL,
      location_name TEXT,
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
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sync_batch_id TEXT,
      UNIQUE(location_tenant_id, invoice_number)
    )
  `).run();

  // Create indexes
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_chain_sales_group_date
      ON chain_sales_aggregated(location_group_id, completed_at)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_chain_sales_location_date
      ON chain_sales_aggregated(location_tenant_id, completed_at)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_chain_sales_group_source
      ON chain_sales_aggregated(location_group_id, source)
  `).run();
}

/**
 * POST /chain/:locationGroupId/location/:locationTenantId/sync-sales
 *
 * Sync sales from a location tenant to the master tenant's chain aggregation table
 */
export async function handleChainSalesSync(
  request: Request,
  env: Env,
  locationGroupId: string,
  locationTenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      transactions: ChainSalesTransaction[];
      batchId?: string;
      locationName?: string;
    };

    const transactions = body.transactions || [];
    const batchId = body.batchId || crypto.randomUUID();
    const locationName = body.locationName || locationTenantId;

    if (transactions.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        message: 'No transactions to sync',
      }, { headers: CORS_HEADERS });
    }

    // Verify location group exists
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Chain management not configured',
      }, { status: 503, headers: CORS_HEADERS });
    }

    const locationGroup = await env.TENANTS_DB.prepare(`
      SELECT id FROM location_groups WHERE location_group_id = ?
    `).bind(locationGroupId).first();

    if (!locationGroup) {
      return Response.json({
        success: false,
        error: 'Location group not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Verify location belongs to this group
    const location = await env.TENANTS_DB.prepare(`
      SELECT id FROM location_group_locations
      WHERE location_group_id = ? AND tenant_id = ?
    `).bind(locationGroup.id, locationTenantId).first();

    if (!location) {
      return Response.json({
        success: false,
        error: 'Location not found in this location group',
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Ensure chain sales table exists
    await ensureChainSalesTable(env.DB);

    // Insert transactions
    let synced = 0;
    const errors: string[] = [];

    for (const txn of transactions) {
      try {
        await env.DB.prepare(`
          INSERT INTO chain_sales_aggregated (
            id, location_group_id, location_tenant_id, location_name,
            invoice_number, order_number, order_type, table_number, source,
            subtotal, service_charge, cgst, sgst, discount, round_off, grand_total,
            payment_method, payment_status, items_json,
            cashier_name, staff_id, created_at, completed_at, synced_at, sync_batch_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
          ON CONFLICT(location_tenant_id, invoice_number) DO UPDATE SET
            grand_total = excluded.grand_total,
            payment_status = excluded.payment_status,
            synced_at = CURRENT_TIMESTAMP
        `).bind(
          txn.id,
          locationGroupId,
          locationTenantId,
          locationName,
          txn.invoiceNumber,
          txn.orderNumber || null,
          txn.orderType,
          txn.tableNumber || null,
          txn.source,
          txn.subtotal,
          txn.serviceCharge || 0,
          txn.cgst || 0,
          txn.sgst || 0,
          txn.discount || 0,
          txn.roundOff || 0,
          txn.grandTotal,
          txn.paymentMethod,
          txn.paymentStatus,
          JSON.stringify(txn.items),
          txn.cashierName || null,
          txn.staffId || null,
          txn.createdAt,
          txn.completedAt,
          batchId
        ).run();

        synced++;
      } catch (error: any) {
        console.error(`[ChainSync] Failed to sync transaction ${txn.invoiceNumber}:`, error);
        errors.push(`${txn.invoiceNumber}: ${error.message}`);
      }
    }

    console.log(`[ChainSync] Synced ${synced}/${transactions.length} sales from location ${locationTenantId} to chain ${locationGroupId}`);

    return Response.json({
      success: true,
      synced,
      totalRecords: transactions.length,
      batchId,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainSync] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync chain sales',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /chain/:locationGroupId/sales
 *
 * Get aggregated sales for the entire chain
 */
export async function handleGetChainSales(
  request: Request,
  env: Env,
  locationGroupId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = url.searchParams.get('to') || new Date().toISOString().split('T')[0];
    const locationTenantId = url.searchParams.get('locationTenantId'); // Optional filter

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    await ensureChainSalesTable(env.DB);

    // Build query based on filters
    let query = `
      SELECT
        id, location_tenant_id, location_name, invoice_number, order_number,
        order_type, table_number, source, grand_total, payment_method, payment_status,
        items_json, cashier_name, staff_id, created_at, completed_at
      FROM chain_sales_aggregated
      WHERE location_group_id = ? AND completed_at >= ? AND completed_at <= ?
    `;

    const params: any[] = [locationGroupId, startDate, endDate];

    if (locationTenantId) {
      query += ` AND location_tenant_id = ?`;
      params.push(locationTenantId);
    }

    query += ` ORDER BY completed_at DESC LIMIT 1000`;

    const result = await env.DB.prepare(query).bind(...params).all();

    const sales = result.results.map((row: any) => ({
      id: row.id,
      locationTenantId: row.location_tenant_id,
      locationName: row.location_name,
      invoiceNumber: row.invoice_number,
      orderNumber: row.order_number,
      orderType: row.order_type,
      tableNumber: row.table_number,
      source: row.source,
      grandTotal: row.grand_total,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      items: JSON.parse(row.items_json || '[]'),
      cashierName: row.cashier_name,
      staffId: row.staff_id,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));

    return Response.json({
      success: true,
      sales,
      totalRecords: sales.length,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainSync] Get sales error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get chain sales',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /chain/:locationGroupId/sales/summary
 *
 * Get aggregated sales summary for the chain
 */
export async function handleGetChainSalesSummary(
  request: Request,
  env: Env,
  locationGroupId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = url.searchParams.get('to') || new Date().toISOString().split('T')[0];

    const startDate = `${from}T00:00:00.000Z`;
    const endDate = `${to}T23:59:59.999Z`;

    await ensureChainSalesTable(env.DB);

    // Overall summary
    const summaryResult = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(grand_total), 0) as total_sales,
        COUNT(*) as total_orders,
        COALESCE(SUM(cgst + sgst), 0) as total_tax,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(service_charge), 0) as total_service_charge,
        COUNT(DISTINCT location_tenant_id) as active_locations
      FROM chain_sales_aggregated
      WHERE location_group_id = ? AND completed_at >= ? AND completed_at <= ?
    `).bind(locationGroupId, startDate, endDate).first();

    // Breakdown by location
    const locationResult = await env.DB.prepare(`
      SELECT
        location_tenant_id,
        location_name,
        COUNT(*) as orders,
        COALESCE(SUM(grand_total), 0) as sales,
        COALESCE(AVG(grand_total), 0) as avg_order_value
      FROM chain_sales_aggregated
      WHERE location_group_id = ? AND completed_at >= ? AND completed_at <= ?
      GROUP BY location_tenant_id, location_name
      ORDER BY sales DESC
    `).bind(locationGroupId, startDate, endDate).all();

    // Breakdown by source
    const sourceResult = await env.DB.prepare(`
      SELECT
        source,
        COUNT(*) as orders,
        COALESCE(SUM(grand_total), 0) as sales
      FROM chain_sales_aggregated
      WHERE location_group_id = ? AND completed_at >= ? AND completed_at <= ?
      GROUP BY source
      ORDER BY sales DESC
    `).bind(locationGroupId, startDate, endDate).all();

    const totalSales = (summaryResult?.total_sales as number) || 0;
    const totalOrders = (summaryResult?.total_orders as number) || 0;

    return Response.json({
      success: true,
      summary: {
        totalSales,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
        totalTax: (summaryResult?.total_tax as number) || 0,
        totalDiscount: (summaryResult?.total_discount as number) || 0,
        totalServiceCharge: (summaryResult?.total_service_charge as number) || 0,
        activeLocations: (summaryResult?.active_locations as number) || 0,
      },
      byLocation: locationResult.results.map((row: any) => ({
        locationTenantId: row.location_tenant_id,
        locationName: row.location_name,
        orders: row.orders,
        sales: row.sales,
        averageOrderValue: row.avg_order_value,
      })),
      bySource: sourceResult.results.reduce((acc: any, row: any) => {
        acc[row.source] = {
          orders: row.orders,
          sales: row.sales,
        };
        return acc;
      }, {}),
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainSync] Summary error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get chain sales summary',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
