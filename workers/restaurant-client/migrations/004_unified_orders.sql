-- Unified Orders Schema for POS + Web + Aggregators
-- Supports both customer_id (registered) and inline customer_name/phone (guest)

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL, -- 'dine-in', 'takeaway', 'delivery'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'
  table_number INTEGER,

  -- Customer: either ID reference OR inline (for guest/POS orders)
  customer_id TEXT,         -- NULL for walk-in/guest
  customer_name TEXT,       -- For quick POS orders
  customer_phone TEXT,      -- For quick POS orders

  -- Financials
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT,      -- 'cash', 'card', 'upi', 'online'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'

  -- Delivery (optional)
  delivery_address TEXT,    -- JSON or formatted address
  delivery_instructions TEXT,

  -- Metadata
  notes TEXT,
  source TEXT DEFAULT 'pos', -- 'pos', 'web', 'zomato', 'swiggy', 'voice'
  created_by TEXT,
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  item_total REAL NOT NULL,

  -- Customization
  modifiers TEXT,           -- JSON: [{"name": "Extra Cheese", "price": 20}]
  special_instructions TEXT,

  -- Item metadata (for KDS display)
  category TEXT,
  spice_level TEXT,
  is_vegetarian INTEGER DEFAULT 0,
  is_vegan INTEGER DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
