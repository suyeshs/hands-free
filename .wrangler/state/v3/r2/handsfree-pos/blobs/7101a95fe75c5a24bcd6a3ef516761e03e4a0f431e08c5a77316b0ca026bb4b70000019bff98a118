-- Inventory Enhanced Sync Migration
-- Adds enhanced supplier fields, barcode mapping, delivery verification, and sync tracking

-- ==================== ENHANCED SUPPLIER FIELDS ====================

-- Add missing enhanced fields to suppliers table
ALTER TABLE suppliers ADD COLUMN gstin TEXT;
ALTER TABLE suppliers ADD COLUMN tax_id TEXT;
ALTER TABLE suppliers ADD COLUMN payment_terms TEXT;
ALTER TABLE suppliers ADD COLUMN currency TEXT DEFAULT 'INR';
ALTER TABLE suppliers ADD COLUMN bank_name TEXT;
ALTER TABLE suppliers ADD COLUMN bank_account TEXT;
ALTER TABLE suppliers ADD COLUMN bank_ifsc TEXT;
ALTER TABLE suppliers ADD COLUMN upi_id TEXT;
ALTER TABLE suppliers ADD COLUMN website TEXT;
ALTER TABLE suppliers ADD COLUMN category TEXT;
ALTER TABLE suppliers ADD COLUMN is_verified INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN total_orders INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN total_spent REAL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN rating REAL;

-- Index for GSTIN lookups (for duplicate detection)
CREATE INDEX IF NOT EXISTS idx_suppliers_gstin ON suppliers(gstin);

-- ==================== INVENTORY ITEMS ENHANCEMENTS ====================

-- Add notes field to inventory_items if not exists
ALTER TABLE inventory_items ADD COLUMN notes TEXT;

-- ==================== BARCODE MAPPING TABLE ====================

-- For delivery verification: map barcodes to inventory items
CREATE TABLE IF NOT EXISTS inventory_barcode_mappings (
  barcode TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  default_unit TEXT,
  default_price REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_barcode_mapping_item
ON inventory_barcode_mappings(inventory_item_id);

-- ==================== DELIVERY VERIFICATION ====================

-- Track delivery verification sessions (for barcode scanning workflow)
CREATE TABLE IF NOT EXISTS delivery_verification_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_id TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  expected_items TEXT, -- JSON array
  scanned_items TEXT, -- JSON array
  verification_results TEXT, -- JSON array
  total_expected INTEGER DEFAULT 0,
  total_received INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  missing_count INTEGER DEFAULT 0,
  extra_count INTEGER DEFAULT 0,
  mismatch_count INTEGER DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_by TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_verification_tenant
ON delivery_verification_sessions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_delivery_verification_status
ON delivery_verification_sessions(status);

-- ==================== SYNC QUEUE ====================

-- Create sync_queue table if not exists (for offline change tracking)
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON string
  created_at TEXT NOT NULL,
  UNIQUE(table_name, record_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);

-- ==================== SYNC METADATA ====================

-- Track last sync timestamps for inventory data
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);

INSERT OR IGNORE INTO sync_metadata (key, value, updated_at)
VALUES ('inventory_last_sync', '1970-01-01T00:00:00Z', 0);

INSERT OR IGNORE INTO sync_metadata (key, value, updated_at)
VALUES ('suppliers_last_sync', '1970-01-01T00:00:00Z', 0);

INSERT OR IGNORE INTO sync_metadata (key, value, updated_at)
VALUES ('recipes_last_sync', '1970-01-01T00:00:00Z', 0);

INSERT OR IGNORE INTO sync_metadata (key, value, updated_at)
VALUES ('documents_last_sync', '1970-01-01T00:00:00Z', 0);
