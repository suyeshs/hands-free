-- Add archived_at timestamp to aggregator_orders
-- Tracks when order was archived (dismissed or delivered)
ALTER TABLE aggregator_orders ADD COLUMN archived_at TEXT;

-- Index for efficient filtering of archived orders
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_archived ON aggregator_orders(archived_at);
