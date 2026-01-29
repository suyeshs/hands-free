-- Guest Orders Table
-- Tracks orders submitted via QR code before they're completed
-- Once completed, they're moved to sales_transactions
-- Note: Using 'guest_orders' to avoid conflict with existing 'orders' table

CREATE TABLE IF NOT EXISTS guest_orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    table_number TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    special_instructions TEXT,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'qr-code',
    created_at TEXT NOT NULL,
    updated_at TEXT,
    completed_at TEXT,
    CHECK(status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS guest_order_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    notes TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES guest_orders(id) ON DELETE CASCADE,
    CHECK(quantity > 0),
    CHECK(price >= 0),
    CHECK(status IN ('pending', 'preparing', 'ready', 'served'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_orders_status ON guest_orders(status);
CREATE INDEX IF NOT EXISTS idx_guest_orders_table ON guest_orders(table_number);
CREATE INDEX IF NOT EXISTS idx_guest_orders_source ON guest_orders(source);
CREATE INDEX IF NOT EXISTS idx_guest_orders_created ON guest_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_guest_order_items_order ON guest_order_items(order_id);

-- Table Tokens for QR Code Security
CREATE TABLE IF NOT EXISTS table_tokens (
    table_id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    regenerate_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_table_tokens_expiry ON table_tokens(expires_at);
