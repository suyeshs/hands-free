-- Aggregator Orders (Swiggy, Zomato)
CREATE TABLE IF NOT EXISTS aggregator_orders (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    order_number TEXT NOT NULL,
    aggregator TEXT NOT NULL,
    aggregator_order_id TEXT NOT NULL,
    aggregator_status TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    order_type TEXT NOT NULL DEFAULT 'delivery',
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    items_json TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    delivery_fee REAL NOT NULL DEFAULT 0,
    platform_fee REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT,
    payment_status TEXT,
    is_prepaid BOOLEAN NOT NULL DEFAULT 1,
    special_instructions TEXT,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    delivered_at TEXT,
    updated_at TEXT NOT NULL,
    synced_at TEXT,
    raw_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_aggregator_orders_order_number ON aggregator_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_aggregator ON aggregator_orders(aggregator);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_status ON aggregator_orders(status);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_created_at ON aggregator_orders(created_at);
