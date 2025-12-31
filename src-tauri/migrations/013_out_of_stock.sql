-- Out of Stock (86) Items Table
-- Tracks items marked as out of stock by kitchen staff

CREATE TABLE IF NOT EXISTS out_of_stock_items (
    id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    menu_item_id TEXT,
    portions_out INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    created_by_device_id TEXT,
    created_by_staff_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    tenant_id TEXT NOT NULL
);

-- Index for efficient queries by tenant and active status
CREATE INDEX IF NOT EXISTS idx_out_of_stock_tenant_active
    ON out_of_stock_items(tenant_id, is_active);

-- Index for searching by item name
CREATE INDEX IF NOT EXISTS idx_out_of_stock_item_name
    ON out_of_stock_items(item_name, tenant_id);
