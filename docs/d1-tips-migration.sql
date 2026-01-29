-- D1 Database Migration: Tips Management Feature
-- Run this file with: wrangler d1 execute <YOUR_DATABASE_NAME> --file=./docs/d1-tips-migration.sql

-- Tips Management Table
-- Tracks tips for service staff separately from sales transactions
CREATE TABLE IF NOT EXISTS tips (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,

  -- Order/Invoice linkage
  invoice_number TEXT NOT NULL,
  order_number TEXT,
  table_number INTEGER,
  order_type TEXT NOT NULL,

  -- Tip details
  tip_amount REAL NOT NULL,

  -- Staff attribution (dual tracking: staff_id preferred, server_name fallback)
  staff_id TEXT,
  server_name TEXT,

  -- Entry metadata
  entered_by_staff_id TEXT,
  entered_by_name TEXT,
  entry_method TEXT NOT NULL DEFAULT 'manual',

  -- Timestamps
  created_at TEXT NOT NULL,
  tip_date TEXT NOT NULL,

  -- Cloud sync tracking
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_tips_tenant_date ON tips(tenant_id, tip_date);
CREATE INDEX IF NOT EXISTS idx_tips_invoice ON tips(invoice_number);
CREATE INDEX IF NOT EXISTS idx_tips_staff ON tips(staff_id);
CREATE INDEX IF NOT EXISTS idx_tips_server_name ON tips(server_name);

-- Unique constraint to prevent duplicate tips for same invoice
CREATE UNIQUE INDEX IF NOT EXISTS idx_tips_tenant_invoice ON tips(tenant_id, invoice_number);
