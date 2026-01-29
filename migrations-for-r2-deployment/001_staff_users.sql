-- Staff users table for PIN-based authentication
CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('cashier', 'waiter', 'kitchen', 'manager')),
    pin_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    permissions TEXT,  -- JSON array of permissions
    created_at INTEGER NOT NULL,
    last_login_at INTEGER,
    created_by TEXT,  -- Manager user ID who created this staff
    UNIQUE(tenant_id, name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff_users(is_active);

-- Login history table (optional, for audit trail)
CREATE TABLE IF NOT EXISTS staff_login_history (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    login_at INTEGER NOT NULL,
    device_id TEXT,
    success INTEGER NOT NULL CHECK (success IN (0, 1)),
    FOREIGN KEY(staff_id) REFERENCES staff_users(id)
);

CREATE INDEX IF NOT EXISTS idx_login_history_staff ON staff_login_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time ON staff_login_history(login_at);
