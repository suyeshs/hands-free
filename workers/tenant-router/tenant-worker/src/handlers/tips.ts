/**
 * Tips Management Handler
 *
 * Handles syncing and querying tips data from POS to D1 cloud database.
 * Tips are tracked separately from sales transactions for staff reporting.
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

interface TipPayload {
  id: string;
  invoiceNumber: string;
  orderNumber?: string;
  tableNumber?: number;
  orderType: string;
  tipAmount: number;
  staffId?: string;
  serverName?: string;
  enteredByStaffId?: string;
  enteredByName?: string;
  entryMethod: string;
  createdAt: string;
  tipDate: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Ensure the tips table exists
 */
async function ensureTipsTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tips (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,

      -- Order/Invoice linkage
      invoice_number TEXT NOT NULL,
      order_number TEXT,
      table_number INTEGER,
      order_type TEXT NOT NULL,

      -- Tip details
      tip_amount REAL NOT NULL,

      -- Staff attribution (dual tracking: staff_id preferred, server_name fallback)
      staff_id TEXT,
      server_name TEXT,

      -- Entry metadata
      entered_by_staff_id TEXT,
      entered_by_name TEXT,
      entry_method TEXT NOT NULL DEFAULT 'manual',

      -- Timestamps
      created_at TEXT NOT NULL,
      tip_date TEXT NOT NULL,

      -- Cloud sync tracking
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // Create indexes
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_tips_tenant_date ON tips(tenant_id, tip_date)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_tips_invoice ON tips(invoice_number)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_tips_staff ON tips(staff_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_tips_server_name ON tips(server_name)').run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_tips_tenant_invoice ON tips(tenant_id, invoice_number)').run();
}

// Sync configuration for tips table
const tipsSyncConfig: SyncTableConfig = {
  tableName: 'tips',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['tenant_id', 'invoice_number'],
  timestampColumn: 'created_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'tenant_id', target: 'tenant_id', type: 'TEXT', required: true },
    { source: 'invoice_number', target: 'invoice_number', type: 'TEXT', required: true },
    { source: 'order_number', target: 'order_number', type: 'TEXT' },
    { source: 'table_number', target: 'table_number', type: 'INTEGER' },
    { source: 'order_type', target: 'order_type', type: 'TEXT', required: true },
    {
      source: 'tip_amount',
      target: 'tip_amount',
      type: 'REAL',
      required: true,
      transform: (val) => Math.round(val * 100) / 100 // Round to 2 decimals
    },
    { source: 'staff_id', target: 'staff_id', type: 'TEXT' },
    { source: 'server_name', target: 'server_name', type: 'TEXT' },
    { source: 'entered_by_staff_id', target: 'entered_by_staff_id', type: 'TEXT' },
    { source: 'entered_by_name', target: 'entered_by_name', type: 'TEXT' },
    { source: 'entry_method', target: 'entry_method', type: 'TEXT', required: true },
    { source: 'created_at', target: 'created_at', type: 'TEXT', required: true },
    { source: 'tip_date', target: 'tip_date', type: 'TEXT', required: true },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[Tips] Synced ${result.synced}/${result.totalRecords} tips in ${result.duration}ms`);
    }
  }
};

/**
 * POST /tips/sync - Sync tips from POS to D1 using SyncEngine
 */
export async function handleTipsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { tips: TipPayload[] };
    const tips = body.tips || [];

    if (tips.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Ensure table exists
    await ensureTipsTable(env.DB);

    // Create sync engine instance
    const syncEngine = createSyncEngine(env.DB, tenantId);

    // Inject tenant_id into each record
    const enriched = tips.map((t: any) => ({ ...t, tenant_id: tenantId }));

    // Sync using the unified engine
    const result = await syncEngine.sync(tipsSyncConfig, enriched);

    // Convert SyncResult to response format
    return Response.json({
      success: result.success,
      synced: result.synced,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Tips] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync tips',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /tips/summary - Get tips summary for date range
 */
export async function handleTipsSummary(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;

    await ensureTipsTable(env.DB);

    // Get overall summary
    const summaryResult = await env.DB.prepare(`
      SELECT
        COUNT(*) as tip_count,
        COALESCE(SUM(tip_amount), 0) as total_tips,
        COALESCE(AVG(tip_amount), 0) as average_tip,
        COALESCE(MIN(tip_amount), 0) as min_tip,
        COALESCE(MAX(tip_amount), 0) as max_tip
      FROM tips
      WHERE tenant_id = ? AND tip_date BETWEEN ? AND ?
    `).bind(tenantId, from, to).first();

    // Get breakdown by staff
    const staffResult = await env.DB.prepare(`
      SELECT
        COALESCE(staff_id, server_name) as staff,
        server_name,
        staff_id,
        COUNT(*) as tip_count,
        COALESCE(SUM(tip_amount), 0) as total_tips,
        COALESCE(AVG(tip_amount), 0) as average_tip
      FROM tips
      WHERE tenant_id = ? AND tip_date BETWEEN ? AND ?
      GROUP BY COALESCE(staff_id, server_name)
      ORDER BY total_tips DESC
    `).bind(tenantId, from, to).all();

    const byStaff: Array<{
      staff: string;
      serverName: string | null;
      staffId: string | null;
      tipCount: number;
      totalTips: number;
      averageTip: number;
    }> = [];

    for (const row of staffResult.results || []) {
      byStaff.push({
        staff: (row.staff as string) || 'Unassigned',
        serverName: row.server_name as string | null,
        staffId: row.staff_id as string | null,
        tipCount: row.tip_count as number,
        totalTips: row.total_tips as number,
        averageTip: row.average_tip as number,
      });
    }

    return Response.json({
      success: true,
      summary: {
        tipCount: (summaryResult?.tip_count as number) || 0,
        totalTips: (summaryResult?.total_tips as number) || 0,
        averageTip: (summaryResult?.average_tip as number) || 0,
        minTip: (summaryResult?.min_tip as number) || 0,
        maxTip: (summaryResult?.max_tip as number) || 0,
        byStaff,
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Tips] Summary error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get tips summary',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /tips/list - Get tips list for date range
 */
export async function handleTipsList(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    await ensureTipsTable(env.DB);

    const result = await env.DB.prepare(`
      SELECT
        id,
        invoice_number,
        order_number,
        table_number,
        order_type,
        tip_amount,
        staff_id,
        server_name,
        entered_by_staff_id,
        entered_by_name,
        entry_method,
        created_at,
        tip_date
      FROM tips
      WHERE tenant_id = ? AND tip_date BETWEEN ? AND ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(tenantId, from, to, limit, offset).all();

    // Get total count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM tips
      WHERE tenant_id = ? AND tip_date BETWEEN ? AND ?
    `).bind(tenantId, from, to).first();

    return Response.json({
      success: true,
      tips: result.results || [],
      total: (countResult?.total as number) || 0,
      limit,
      offset,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Tips] List error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get tips list',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /tips/by-staff/:staffId - Get tips for specific staff member
 */
export async function handleTipsByStaff(
  request: Request,
  env: Env,
  tenantId: string,
  staffId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || from;

    await ensureTipsTable(env.DB);

    // Get tips for this staff member (by staff_id or server_name)
    const result = await env.DB.prepare(`
      SELECT
        id,
        invoice_number,
        order_number,
        table_number,
        order_type,
        tip_amount,
        created_at,
        tip_date
      FROM tips
      WHERE tenant_id = ?
        AND tip_date BETWEEN ? AND ?
        AND (staff_id = ? OR server_name = ?)
      ORDER BY created_at DESC
    `).bind(tenantId, from, to, staffId, staffId).all();

    // Get summary
    const summaryResult = await env.DB.prepare(`
      SELECT
        COUNT(*) as tip_count,
        COALESCE(SUM(tip_amount), 0) as total_tips,
        COALESCE(AVG(tip_amount), 0) as average_tip
      FROM tips
      WHERE tenant_id = ?
        AND tip_date BETWEEN ? AND ?
        AND (staff_id = ? OR server_name = ?)
    `).bind(tenantId, from, to, staffId, staffId).first();

    return Response.json({
      success: true,
      staffId,
      tips: result.results || [],
      summary: {
        tipCount: (summaryResult?.tip_count as number) || 0,
        totalTips: (summaryResult?.total_tips as number) || 0,
        averageTip: (summaryResult?.average_tip as number) || 0,
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Tips] By staff error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get tips by staff',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * DELETE /tips/:tipId - Delete a tip (admin only)
 */
export async function handleTipDelete(
  request: Request,
  env: Env,
  tenantId: string,
  tipId: string
): Promise<Response> {
  try {
    await ensureTipsTable(env.DB);

    const result = await env.DB.prepare(`
      DELETE FROM tips
      WHERE tenant_id = ? AND id = ?
    `).bind(tenantId, tipId).run();

    if (result.meta.changes === 0) {
      return Response.json({
        success: false,
        error: 'Tip not found',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    return Response.json({
      success: true,
      deleted: tipId,
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Tips] Delete error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to delete tip',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}
