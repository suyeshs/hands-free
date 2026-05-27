-- Expand orders.status CHECK constraint to include delivery tracking statuses.
-- SQLite cannot ALTER a CHECK constraint directly, so we recreate the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE orders_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  status TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  table_number INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  source TEXT DEFAULT 'pos',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  customer_id TEXT,
  payment_status TEXT DEFAULT 'pending',
  delivery_address_line1 TEXT,
  delivery_instructions TEXT,
  created_by TEXT
);

INSERT INTO orders_new
  SELECT id, tenant_id, order_number, order_type, status, subtotal, tax, total,
         payment_method, table_number, customer_name, customer_phone, notes, source,
         created_at, updated_at, completed_at, customer_id, payment_status,
         delivery_address_line1, delivery_instructions, created_by
  FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

PRAGMA foreign_keys = ON;
