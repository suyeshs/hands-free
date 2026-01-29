-- Floor Plan Tables with Sync Support
-- Created for proper incremental sync integration

-- Floor Sections
CREATE TABLE IF NOT EXISTS floor_sections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_floor_sections_tenant ON floor_sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_floor_sections_updated ON floor_sections(updated_at);
CREATE INDEX IF NOT EXISTS idx_floor_sections_synced ON floor_sections(synced_at);

-- Floor Tables
CREATE TABLE IF NOT EXISTS floor_tables (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    table_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    qr_code_url TEXT,
    status TEXT DEFAULT 'available',
    assigned_staff_id TEXT,
    current_order_id TEXT,
    last_active_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT DEFAULT NULL,
    FOREIGN KEY (section_id) REFERENCES floor_sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_floor_tables_tenant ON floor_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_floor_tables_section ON floor_tables(section_id);
CREATE INDEX IF NOT EXISTS idx_floor_tables_updated ON floor_tables(updated_at);
CREATE INDEX IF NOT EXISTS idx_floor_tables_synced ON floor_tables(synced_at);

-- Staff Assignments
CREATE TABLE IF NOT EXISTS floor_staff_assignments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    section_ids TEXT, -- JSON array
    table_ids TEXT, -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_floor_assignments_tenant ON floor_staff_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_floor_assignments_user ON floor_staff_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_floor_assignments_updated ON floor_staff_assignments(updated_at);
CREATE INDEX IF NOT EXISTS idx_floor_assignments_synced ON floor_staff_assignments(synced_at);

-- Triggers to update updated_at on changes
CREATE TRIGGER IF NOT EXISTS update_floor_sections_timestamp
AFTER UPDATE ON floor_sections
BEGIN
    UPDATE floor_sections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_floor_tables_timestamp
AFTER UPDATE ON floor_tables
BEGIN
    UPDATE floor_tables SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_floor_assignments_timestamp
AFTER UPDATE ON floor_staff_assignments
BEGIN
    UPDATE floor_staff_assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
