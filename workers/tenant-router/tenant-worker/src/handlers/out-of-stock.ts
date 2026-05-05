/**
 * Out-of-Stock Handler
 * Manages out-of-stock items storage in D1
 */

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Ensure out-of-stock table exists
 */
async function ensureOutOfStockTable(env: Env): Promise<void> {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS out_of_stock_items (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      portions_out INTEGER,
      staff_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_oos_tenant ON out_of_stock_items(tenant_id)`);
  await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_oos_active ON out_of_stock_items(tenant_id, is_active)`);
}

/**
 * GET /out-of-stock - Get all out-of-stock items
 */
export async function handleGetOutOfStock(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureOutOfStockTable(env);

    const result = await env.DB.prepare(
      `SELECT id, item_id, item_name, portions_out, staff_name, is_active, created_at FROM out_of_stock_items WHERE tenant_id = ? ORDER BY created_at DESC`
    )
      .bind(tenantId)
      .all();

    const items = (result.results || []).map((row: any) => ({
      id: row.id,
      itemId: row.item_id,
      itemName: row.item_name,
      portionsOut: row.portions_out,
      staffName: row.staff_name || undefined,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
    }));

    if (items.length === 0) {
      return Response.json(
        { success: false, error: 'No out-of-stock items found' },
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return Response.json(
      { success: true, items },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Get out-of-stock error:', error);
    return Response.json(
      { success: false, error: 'Failed to get out-of-stock items', message: error.message },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /out-of-stock - Save all out-of-stock items (replace all)
 */
export async function handleSaveOutOfStock(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureOutOfStockTable(env);

    const body = (await request.json()) as {
      items: Array<{
        id: string;
        itemId: string;
        itemName: string;
        portionsOut?: number;
        staffName?: string;
        isActive: boolean;
        createdAt: string;
      }>;
    };

    // Clear existing items for this tenant
    await env.DB.prepare(`DELETE FROM out_of_stock_items WHERE tenant_id = ?`).bind(tenantId).run();

    // Insert all items
    for (const item of body.items || []) {
      await env.DB.prepare(
        `INSERT INTO out_of_stock_items (id, tenant_id, item_id, item_name, portions_out, staff_name, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          item.id,
          tenantId,
          item.itemId,
          item.itemName,
          item.portionsOut || null,
          item.staffName || null,
          item.isActive ? 1 : 0,
          item.createdAt
        )
        .run();
    }

    console.log(`[TenantWorker] Saved ${body.items?.length || 0} out-of-stock items for tenant ${tenantId}`);

    return Response.json(
      { success: true, message: 'Out-of-stock items saved', savedAt: new Date().toISOString() },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Save out-of-stock error:', error);
    return Response.json(
      { success: false, error: 'Failed to save out-of-stock items', message: error.message },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
