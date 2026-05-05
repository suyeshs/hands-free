-- Migration 050: Chain Sales Aggregation
-- Enables aggregation of sales from all locations in a chain for consolidated reporting

-- Chain-wide aggregated sales table
-- Stores sales from all locations in a location group (chain)
-- Lives in the master tenant's D1 database
CREATE TABLE IF NOT EXISTS chain_sales_aggregated (
  id TEXT PRIMARY KEY,
  location_group_id TEXT NOT NULL,
  location_tenant_id TEXT NOT NULL,
  location_name TEXT,

  -- Original transaction data
  invoice_number TEXT NOT NULL,
  order_number TEXT,
  order_type TEXT NOT NULL,
  table_number INTEGER,
  source TEXT NOT NULL DEFAULT 'pos',

  -- Financial data
  subtotal REAL NOT NULL,
  service_charge REAL DEFAULT 0,
  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  round_off REAL DEFAULT 0,
  grand_total REAL NOT NULL,

  -- Payment details
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'completed',

  -- Items (JSON serialized)
  items_json TEXT NOT NULL,

  -- Staff info
  cashier_name TEXT,
  staff_id TEXT,

  -- Timestamps
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sync_batch_id TEXT,

  -- Ensure uniqueness per location
  UNIQUE(location_tenant_id, invoice_number)
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_chain_sales_group_date
  ON chain_sales_aggregated(location_group_id, completed_at);

CREATE INDEX IF NOT EXISTS idx_chain_sales_location_date
  ON chain_sales_aggregated(location_tenant_id, completed_at);

CREATE INDEX IF NOT EXISTS idx_chain_sales_group_source
  ON chain_sales_aggregated(location_group_id, source);

CREATE INDEX IF NOT EXISTS idx_chain_sales_payment_method
  ON chain_sales_aggregated(location_group_id, payment_method);

CREATE INDEX IF NOT EXISTS idx_chain_sales_sync_batch
  ON chain_sales_aggregated(sync_batch_id);

-- Sync tracking table for locations
-- Tracks which sales have been synced to master
CREATE TABLE IF NOT EXISTS chain_sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Track last successful sync timestamp
INSERT OR REPLACE INTO chain_sync_metadata (key, value, updated_at)
VALUES ('last_chain_sales_sync', '1970-01-01T00:00:00.000Z', CURRENT_TIMESTAMP);
