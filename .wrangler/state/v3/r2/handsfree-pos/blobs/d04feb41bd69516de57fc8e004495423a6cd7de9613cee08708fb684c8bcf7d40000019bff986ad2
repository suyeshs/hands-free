-- KDS Orders Table
-- Stores active and completed kitchen orders for persistence across view switches
CREATE TABLE IF NOT EXISTS kds_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    table_number INTEGER,
    order_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_running_order INTEGER NOT NULL DEFAULT 0,
    kot_sequence INTEGER,
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    completed_at TEXT,
    elapsed_minutes INTEGER DEFAULT 0,
    estimated_prep_time INTEGER DEFAULT 15,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    tenant_id TEXT NOT NULL,
    UNIQUE(order_number, tenant_id)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_kds_orders_tenant_status ON kds_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_kds_orders_table ON kds_orders(table_number);
