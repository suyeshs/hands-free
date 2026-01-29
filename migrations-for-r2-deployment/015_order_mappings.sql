-- Order mappings table for orchestration service persistence
-- Stores the mapping between aggregator orders and kitchen orders

CREATE TABLE IF NOT EXISTS order_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aggregator_order_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    kitchen_order_id TEXT,
    source TEXT NOT NULL, -- 'zomato', 'swiggy', 'pos', 'online'
    current_status TEXT NOT NULL,
    kds_status TEXT,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aggregator_order_id)
);

-- Index for faster lookups by kitchen order id
CREATE INDEX IF NOT EXISTS idx_order_mappings_kitchen_order_id ON order_mappings(kitchen_order_id);

-- Index for faster lookups by order number
CREATE INDEX IF NOT EXISTS idx_order_mappings_order_number ON order_mappings(order_number);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_order_mappings_status ON order_mappings(current_status);
