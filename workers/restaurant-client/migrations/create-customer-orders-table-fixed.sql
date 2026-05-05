-- Migration: Create Customer Orders Table
-- Date: 2025-12-13
-- Purpose: Track order history for returning customer recognition and analytics

-- Customer Orders Table
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

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer_orders(customer_phone, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_session_id ON customer_orders(session_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_orders ON customer_orders(tenant_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_status ON customer_orders(tenant_id, status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_date ON customer_orders(order_date DESC);

-- View for customer order history with item details
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
