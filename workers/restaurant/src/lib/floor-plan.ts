/**
 * Floor Plan Manager
 * Handles floor plan storage (sections, tables, staff assignments) in D1
 */

export interface Section {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Table {
  id: string;
  sectionId: string;
  tableNumber: string;
  capacity: number;
  qrCodeUrl?: string;
  status: string;
}

export interface StaffAssignment {
  userId: string;
  userName: string;
  sectionIds: string[];
  tableIds: string[];
}

export interface FloorPlan {
  sections: Section[];
  tables: Table[];
  assignments: StaffAssignment[];
}

/**
 * Ensure floor plan tables exist in D1
 */
export async function ensureFloorPlanTables(db: D1Database): Promise<void> {
  // Create tables using batch for better performance
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS floor_sections (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
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
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS floor_staff_assignments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        section_ids TEXT,
        table_ids TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_floor_sections_tenant ON floor_sections(tenant_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_floor_tables_tenant ON floor_tables(tenant_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_floor_assignments_tenant ON floor_staff_assignments(tenant_id)`),
  ]);
}

/**
 * Get floor plan for a tenant
 */
export async function getFloorPlan(db: D1Database, tenantId: string): Promise<FloorPlan | null> {
  await ensureFloorPlanTables(db);

  // Get sections
  const sectionsResult = await db.prepare(
    `SELECT id, name, is_active FROM floor_sections WHERE tenant_id = ? ORDER BY created_at`
  )
    .bind(tenantId)
    .all();

  const sections: Section[] = (sectionsResult.results || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active === 1,
  }));

  // Get tables
  const tablesResult = await db.prepare(
    `SELECT id, section_id, table_number, capacity, qr_code_url, status FROM floor_tables WHERE tenant_id = ? ORDER BY table_number`
  )
    .bind(tenantId)
    .all();

  const tables: Table[] = (tablesResult.results || []).map((row: any) => ({
    id: row.id,
    sectionId: row.section_id,
    tableNumber: row.table_number,
    capacity: row.capacity,
    qrCodeUrl: row.qr_code_url,
    status: row.status,
  }));

  // Get staff assignments
  const assignmentsResult = await db.prepare(
    `SELECT user_id, user_name, section_ids, table_ids FROM floor_staff_assignments WHERE tenant_id = ?`
  )
    .bind(tenantId)
    .all();

  const assignments: StaffAssignment[] = (assignmentsResult.results || []).map((row: any) => ({
    userId: row.user_id,
    userName: row.user_name,
    sectionIds: row.section_ids ? JSON.parse(row.section_ids) : [],
    tableIds: row.table_ids ? JSON.parse(row.table_ids) : [],
  }));

  if (sections.length === 0 && tables.length === 0) {
    return null;
  }

  return { sections, tables, assignments };
}

/**
 * Save floor plan for a tenant (replaces all existing data)
 */
export async function saveFloorPlan(
  db: D1Database,
  tenantId: string,
  floorPlan: FloorPlan
): Promise<void> {
  await ensureFloorPlanTables(db);

  const now = new Date().toISOString();

  // Clear existing data for this tenant
  await db.prepare(`DELETE FROM floor_sections WHERE tenant_id = ?`).bind(tenantId).run();
  await db.prepare(`DELETE FROM floor_tables WHERE tenant_id = ?`).bind(tenantId).run();
  await db.prepare(`DELETE FROM floor_staff_assignments WHERE tenant_id = ?`).bind(tenantId).run();

  // Insert sections
  for (const section of floorPlan.sections || []) {
    await db.prepare(
      `INSERT INTO floor_sections (id, tenant_id, name, is_active, created_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(section.id, tenantId, section.name, section.isActive ? 1 : 0, now)
      .run();
  }

  // Insert tables
  for (const table of floorPlan.tables || []) {
    await db.prepare(
      `INSERT INTO floor_tables (id, tenant_id, section_id, table_number, capacity, qr_code_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        table.id,
        tenantId,
        table.sectionId,
        table.tableNumber,
        table.capacity || 4,
        table.qrCodeUrl || '',
        table.status || 'available',
        now
      )
      .run();
  }

  // Insert staff assignments
  for (const assignment of floorPlan.assignments || []) {
    await db.prepare(
      `INSERT INTO floor_staff_assignments (id, tenant_id, user_id, user_name, section_ids, table_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        `assign-${assignment.userId}`,
        tenantId,
        assignment.userId,
        assignment.userName,
        JSON.stringify(assignment.sectionIds || []),
        JSON.stringify(assignment.tableIds || []),
        now
      )
      .run();
  }

  console.log(
    `[FloorPlan] Saved floor plan for tenant ${tenantId}: ${floorPlan.sections?.length || 0} sections, ${floorPlan.tables?.length || 0} tables`
  );
}
