-- Migration 014: Add synced_at column for D1 cloud sync
-- Tracks when sales transactions are synced to Cloudflare D1

ALTER TABLE sales_transactions ADD COLUMN synced_at TEXT;

-- Index for efficiently finding unsynced transactions
CREATE INDEX IF NOT EXISTS idx_sales_transactions_unsynced ON sales_transactions(synced_at) WHERE synced_at IS NULL;

-- Index for sync queries by tenant
CREATE INDEX IF NOT EXISTS idx_sales_transactions_tenant_sync ON sales_transactions(tenant_id, synced_at);
