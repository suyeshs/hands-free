-- Table sessions to track active dine-in orders with guest count
CREATE TABLE IF NOT EXISTS table_sessions (
    id TEXT PRIMARY KEY,
    table_number INTEGER NOT NULL,
    guest_count INTEGER NOT NULL DEFAULT 1,
    server_name TEXT,
    started_at TEXT NOT NULL,
    closed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    order_data TEXT,  -- JSON serialized order data
    tenant_id TEXT NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_number);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_tenant ON table_sessions(tenant_id);

-- Only one active session per table per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_active ON table_sessions(table_number, tenant_id) WHERE status = 'active';
