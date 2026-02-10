/**
 * Floor Plan Handler
 * Manages floor plan storage (sections, tables, staff assignments) in D1
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
 * Ensure floor plan tables exist
 */
async function ensureFloorPlanTables(env: Env): Promise<void> {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS floor_sections (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS floor_tables (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      table_number TEXT NOT NULL,
      capacity INTEGER DEFAULT 4,
      qr_code_url TEXT,
      status TEXT DEFAULT 'available',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS floor_staff_assignments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      section_ids TEXT,
      table_ids TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_floor_sections_tenant ON floor_sections(tenant_id)`);
  await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_floor_tables_tenant ON floor_tables(tenant_id)`);
  await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_floor_assignments_tenant ON floor_staff_assignments(tenant_id)`);
}

/**
 * GET /floor-plan - Get floor plan (sections, tables, assignments)
 */
export async function handleGetFloorPlan(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    // Parallel fetch all data
    const [sectionsResult, tablesResult, assignmentsResult] = await Promise.all([
      env.DB.prepare(
        'SELECT id, name, is_active FROM floor_sections WHERE tenant_id = ? ORDER BY created_at'
      ).bind(tenantId).all(),

      env.DB.prepare(
        'SELECT id, section_id, table_number, capacity, qr_code_url, status FROM floor_tables WHERE tenant_id = ? ORDER BY table_number'
      ).bind(tenantId).all(),

      env.DB.prepare(
        'SELECT user_id, user_name, section_ids, table_ids FROM floor_staff_assignments WHERE tenant_id = ?'
      ).bind(tenantId).all(),
    ]);

    const sections = (sectionsResult.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      isActive: row.is_active === 1,
    }));

    const tables = (tablesResult.results || []).map((row: any) => ({
      id: row.id,
      sectionId: row.section_id,
      tableNumber: row.table_number,
      capacity: row.capacity,
      qrCodeUrl: row.qr_code_url,
      status: row.status,
    }));

    const assignments = (assignmentsResult.results || []).map((row: any) => ({
      userId: row.user_id,
      userName: row.user_name,
      sectionIds: row.section_ids ? JSON.parse(row.section_ids) : [],
      tableIds: row.table_ids ? JSON.parse(row.table_ids) : [],
    }));

    if (sections.length === 0 && tables.length === 0) {
      return Response.json(
        { success: false, error: 'Floor plan not found' },
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return Response.json(
      {
        success: true,
        sections,
        tables,
        assignments,
      },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Get floor plan error:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to get floor plan',
        message: error.message,
      },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /floor-plan - Save floor plan (sections, tables, assignments)
 */
export async function handleSaveFloorPlan(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureFloorPlanTables(env);

    const body = (await request.json()) as {
      sections: any[];
      tables: any[];
      assignments: any[];
    };

    const now = new Date().toISOString();

    // Build atomic batch transaction
    const statements: D1PreparedStatement[] = [
      // Clear existing data
      env.DB.prepare('DELETE FROM floor_sections WHERE tenant_id = ?').bind(tenantId),
      env.DB.prepare('DELETE FROM floor_tables WHERE tenant_id = ?').bind(tenantId),
      env.DB.prepare('DELETE FROM floor_staff_assignments WHERE tenant_id = ?').bind(tenantId),

      // Insert sections
      ...(body.sections || []).map(section =>
        env.DB.prepare(
          'INSERT INTO floor_sections (id, tenant_id, name, is_active, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(section.id, tenantId, section.name, section.isActive ? 1 : 0, now)
      ),

      // Insert tables
      ...(body.tables || []).map(table =>
        env.DB.prepare(
          'INSERT INTO floor_tables (id, tenant_id, section_id, table_number, capacity, qr_code_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          table.id,
          tenantId,
          table.sectionId,
          table.tableNumber,
          table.capacity || 4,
          table.qrCodeUrl || '',
          table.status || 'available',
          now
        )
      ),

      // Insert staff assignments
      ...(body.assignments || []).map(assignment =>
        env.DB.prepare(
          'INSERT INTO floor_staff_assignments (id, tenant_id, user_id, user_name, section_ids, table_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          `assign-${assignment.userId}`,
          tenantId,
          assignment.userId,
          assignment.userName,
          JSON.stringify(assignment.sectionIds || []),
          JSON.stringify(assignment.tableIds || []),
          now
        )
      ),
    ];

    // Execute as atomic transaction
    await env.DB.batch(statements);

    console.log(
      `[TenantWorker] Saved floor plan for tenant ${tenantId}: ${body.sections?.length || 0} sections, ${body.tables?.length || 0} tables`
    );

    return Response.json(
      {
        success: true,
        message: 'Floor plan saved',
        savedAt: now,
      },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Save floor plan error:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to save floor plan',
        message: error.message,
      },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
