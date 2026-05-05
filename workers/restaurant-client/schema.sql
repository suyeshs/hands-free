-- D1 Database Schema for Multi-Tenant Menu Management
-- Optimized for Cloudflare Edge performance

-- Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_hindi TEXT,
  name_local TEXT,
  category TEXT NOT NULL DEFAULT 'Uncategorized',
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  photo_url TEXT,
  cloudflare_image_id TEXT,
  available INTEGER NOT NULL DEFAULT 1,
  is_vegetarian INTEGER NOT NULL DEFAULT 0,
  is_vegan INTEGER NOT NULL DEFAULT 0,
  spice_level TEXT,
  allergens TEXT,
  tags TEXT, -- JSON array stored as text
  display_order INTEGER DEFAULT 0,
  is_bestseller INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  last_bestseller_update TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_from_filesearch INTEGER DEFAULT 1,
  filesearch_sync_at TEXT
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_tenant_available ON menu_items(tenant_id, available);
CREATE INDEX IF NOT EXISTS idx_tenant_category ON menu_items(tenant_id, category, display_order);
CREATE INDEX IF NOT EXISTS idx_tenant_name ON menu_items(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_updated_at ON menu_items(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_bestseller ON menu_items(tenant_id, is_bestseller DESC, order_count DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary ON menu_items(tenant_id, is_vegetarian, is_vegan, available);

-- File Search Sync Metadata
CREATE TABLE IF NOT EXISTS filesearch_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  sync_started_at TEXT NOT NULL,
  sync_completed_at TEXT,
  items_processed INTEGER DEFAULT 0,
  items_added INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_unchanged INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, error
  error_message TEXT,
  filesearch_store_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_tenant ON filesearch_sync_log(tenant_id, sync_completed_at DESC);

-- Menu Categories (for ordering and display with hierarchy support)
CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  depth INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  icon TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES menu_categories(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_category_name ON menu_categories(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_category_order ON menu_categories(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_category_parent ON menu_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_category_depth ON menu_categories(tenant_id, depth, display_order);

-- Customer Orders Table (for order history and returning customer recognition)
CREATE TABLE IF NOT EXISTS customer_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  tenant_id TEXT NOT NULL,
  order_items TEXT NOT NULL, -- JSON array: [{name, qty, customization, price}]
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  order_type TEXT, -- delivery, pickup, dine-in
  delivery_address TEXT,
  status TEXT DEFAULT 'pending', -- pending, confirmed, preparing, out_for_delivery, delivered, cancelled
  order_date TEXT NOT NULL DEFAULT (datetime('now')),
  estimated_delivery_time INTEGER, -- minutes
  payment_method TEXT, -- online, cash, card
  payment_status TEXT DEFAULT 'pending', -- pending, paid, failed
  notes TEXT
);

-- Indexes for customer orders
CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer_orders(customer_phone, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_session_id ON customer_orders(session_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_orders ON customer_orders(tenant_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_status ON customer_orders(tenant_id, status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_date ON customer_orders(order_date DESC);

-- View for customer order history with analytics
CREATE VIEW IF NOT EXISTS customer_order_history AS
SELECT
  co.id,
  co.session_id,
  co.customer_name,
  co.customer_phone,
  co.tenant_id,
  co.order_items,
  co.total,
  co.order_type,
  co.status,
  co.order_date,
  COUNT(*) OVER (PARTITION BY co.customer_phone) as total_orders_by_phone,
  SUM(co.total) OVER (PARTITION BY co.customer_phone) as lifetime_value
FROM customer_orders co
WHERE co.customer_phone IS NOT NULL
ORDER BY co.order_date DESC;
