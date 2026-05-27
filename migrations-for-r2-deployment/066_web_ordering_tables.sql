-- Migration 066: Fix web ordering tables schema
-- Adds missing columns to the existing orders and order_items tables
-- so the tenant worker can create orders from the web checkout flow.
-- Safe to run multiple times — uses ALTER TABLE ... ADD COLUMN (no-op if column exists not supported
-- in SQLite, so each statement is guarded by the migration tracking system).

-- orders: add missing columns
ALTER TABLE orders ADD COLUMN customer_id TEXT;
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN delivery_address_line1 TEXT;
ALTER TABLE orders ADD COLUMN delivery_instructions TEXT;
ALTER TABLE orders ADD COLUMN created_by TEXT;

-- Index on customer_id (now that the column exists)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_066 ON orders(customer_id);

-- order_items: add missing columns used by the web ordering flow
ALTER TABLE order_items ADD COLUMN modifiers TEXT;
ALTER TABLE order_items ADD COLUMN special_instructions TEXT;
ALTER TABLE order_items ADD COLUMN category TEXT;
ALTER TABLE order_items ADD COLUMN spice_level TEXT;
ALTER TABLE order_items ADD COLUMN is_vegetarian INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN is_vegan INTEGER DEFAULT 0;
