-- Tips Management - Track tips for service staff separately from sales
CREATE TABLE IF NOT EXISTS tips (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Order/Invoice linkage
    invoice_number TEXT NOT NULL,
    order_number TEXT,
    table_number INTEGER,
    order_type TEXT NOT NULL CHECK (order_type IN ('dine-in', 'takeout', 'delivery')),

    -- Tip details
    tip_amount REAL NOT NULL CHECK (tip_amount >= 0),

    -- Staff attribution (dual tracking: staff_id preferred, server_name fallback)
    staff_id TEXT,                        -- From staff_users.id (if server entered PIN)
    server_name TEXT,                     -- From table_sessions.server_name (fallback)

    -- Entry metadata
    entered_by_staff_id TEXT,             -- Staff who entered the tip at POS
    entered_by_name TEXT,                 -- Name of staff who entered tip
    entry_method TEXT NOT NULL DEFAULT 'manual' CHECK (entry_method IN ('manual', 'auto')),

    -- Timestamps
    created_at TEXT NOT NULL,             -- ISO 8601 timestamp
    tip_date TEXT NOT NULL,               -- Date in YYYY-MM-DD format for daily aggregation

    -- Cloud sync tracking
    synced_at TEXT,                       -- ISO 8601 timestamp when synced to cloud

    -- Foreign keys
    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    FOREIGN KEY(entered_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_tips_tenant_date ON tips(tenant_id, tip_date);
CREATE INDEX IF NOT EXISTS idx_tips_invoice ON tips(invoice_number);
CREATE INDEX IF NOT EXISTS idx_tips_staff ON tips(staff_id);
CREATE INDEX IF NOT EXISTS idx_tips_server_name ON tips(server_name);
CREATE INDEX IF NOT EXISTS idx_tips_table ON tips(table_number);
CREATE INDEX IF NOT EXISTS idx_tips_sync ON tips(synced_at);
CREATE INDEX IF NOT EXISTS idx_tips_tenant_invoice ON tips(tenant_id, invoice_number);

-- Prevent duplicate tips for same invoice (one tip per order)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tips_invoice_unique ON tips(tenant_id, invoice_number);
