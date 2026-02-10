/**
 * Staff Handler
 * Manages staff members storage in D1
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Sync configuration for staff_users table
const staffUsersSyncConfig: SyncTableConfig = {
  tableName: 'staff_users',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'created_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'tenant_id', target: 'tenant_id', type: 'TEXT', required: true },
    { source: 'name', target: 'name', type: 'TEXT', required: true },
    { source: 'role', target: 'role', type: 'TEXT', required: true },
    { source: 'pinHash', target: 'pin_hash', type: 'TEXT', required: true },
    {
      source: 'isActive',
      target: 'is_active',
      type: 'INTEGER',
      transform: (val) => val ? 1 : 0
    },
    { source: 'permissions', target: 'permissions', type: 'TEXT' },
    {
      source: 'createdAt',
      target: 'created_at',
      type: 'INTEGER',
      required: true,
      transform: (val) => {
        // Handle both Unix timestamp (number) and ISO string
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return Math.floor(new Date(val).getTime() / 1000);
        return Math.floor(Date.now() / 1000);
      }
    },
    { source: 'lastLoginAt', target: 'last_login_at', type: 'INTEGER' },
    { source: 'createdBy', target: 'created_by', type: 'TEXT' },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[Staff] Synced ${result.synced}/${result.totalRecords} staff users in ${result.duration}ms`);
    }
  }
};

/**
 * Ensure staff table exists
 */
async function ensureStaffTable(env: Env): Promise<void> {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS staff_members (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      joined_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff_members(tenant_id)`);
}

/**
 * GET /staff - Get all staff members
 */
export async function handleGetStaff(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureStaffTable(env);

    const result = await env.DB.prepare(
      `SELECT id, name, role, pin_hash, email, phone, is_active, joined_at FROM staff_members WHERE tenant_id = ? ORDER BY name`
    )
      .bind(tenantId)
      .all();

    const staff = (result.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      pinHash: row.pin_hash,
      email: row.email || undefined,
      phone: row.phone || undefined,
      isActive: row.is_active === 1,
      joinedAt: row.joined_at,
    }));

    if (staff.length === 0) {
      return Response.json(
        { success: false, error: 'No staff found' },
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return Response.json(
      { success: true, staff },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Get staff error:', error);
    return Response.json(
      { success: false, error: 'Failed to get staff', message: error.message },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /staff - Save all staff members (replace all)
 */
export async function handleSaveStaff(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureStaffTable(env);

    const body = (await request.json()) as {
      staff: Array<{
        id: string;
        name: string;
        role: string;
        pinHash: string;
        email?: string;
        phone?: string;
        isActive: boolean;
        joinedAt: string;
      }>;
    };

    const now = new Date().toISOString();

    // Clear existing staff for this tenant
    await env.DB.prepare(`DELETE FROM staff_members WHERE tenant_id = ?`).bind(tenantId).run();

    // Insert all staff
    for (const member of body.staff || []) {
      await env.DB.prepare(
        `INSERT INTO staff_members (id, tenant_id, name, role, pin_hash, email, phone, is_active, joined_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          member.id,
          tenantId,
          member.name,
          member.role,
          member.pinHash,
          member.email || null,
          member.phone || null,
          member.isActive ? 1 : 0,
          member.joinedAt,
          now
        )
        .run();
    }

    console.log(`[TenantWorker] Saved ${body.staff?.length || 0} staff members for tenant ${tenantId}`);

    return Response.json(
      { success: true, message: 'Staff saved', savedAt: now },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Save staff error:', error);
    return Response.json(
      { success: false, error: 'Failed to save staff', message: error.message },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /staff/sync - Sync staff users from POS to D1 using SyncEngine
 */
export async function handleStaffUsersSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { staff: any[] };
    const staff = body.staff || [];

    if (staff.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    // Inject tenant_id into each staff record (required by D1 schema)
    const staffWithTenantId = staff.map(s => ({ ...s, tenant_id: tenantId }));

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(staffUsersSyncConfig, staffWithTenantId);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Staff] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync staff users',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
