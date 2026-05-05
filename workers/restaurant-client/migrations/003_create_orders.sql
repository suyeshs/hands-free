-- Orders table schema
-- Stores restaurant orders from POS, web app, and aggregators

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash', -- 'cash', 'card', 'upi', 'wallet', 'online'
  table_number INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  source TEXT DEFAULT 'pos', -- 'pos', 'web', 'zomato', 'swiggy', 'manual'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  customization TEXT, -- JSON or comma-separated list of modifiers/special instructions
  item_total REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- Sample test data (optional - remove in production)
-- INSERT INTO orders (id, tenant_id, order_number, order_type, status, subtotal, tax, total, payment_method, table_number, customer_name, source, created_at, updated_at)
-- VALUES ('order-test-1', 'coorg-food-company-6163', '#1001', 'dine_in', 'pending', 450.00, 45.00, 495.00, 'cash', 5, 'Table 5', 'pos', datetime('now'), datetime('now'));
