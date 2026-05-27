-- Add tenant_id column to aggregator_orders (was missing from original schema)
ALTER TABLE aggregator_orders ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_aggregator_orders_tenant ON aggregator_orders(tenant_id);
