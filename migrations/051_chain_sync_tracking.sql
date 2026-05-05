-- Migration 051: Chain Sync Tracking
-- Adds columns to track which sales have been synced to the chain master

-- Add chain sync columns to sales_transactions
ALTER TABLE sales_transactions ADD COLUMN synced_to_chain INTEGER DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN chain_sync_at TEXT;
ALTER TABLE sales_transactions ADD COLUMN chain_sync_batch_id TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_chain_sync ON sales_transactions(synced_to_chain);

-- Add chain configuration to restaurant_settings
ALTER TABLE restaurant_settings ADD COLUMN location_group_id TEXT;
ALTER TABLE restaurant_settings ADD COLUMN master_tenant_id TEXT;
ALTER TABLE restaurant_settings ADD COLUMN current_location_name TEXT;
ALTER TABLE restaurant_settings ADD COLUMN chain_sync_enabled INTEGER DEFAULT 1;
ALTER TABLE restaurant_settings ADD COLUMN is_location INTEGER DEFAULT 0;
