-- Inventory Management System
-- Supports: suppliers, inventory items, recipe linking, document scanning, transactions

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Inventory Items (raw ingredients/supplies)
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT NOT NULL, -- produce, meat, seafood, dairy, dry_goods, beverages, supplies, other
  current_stock REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL, -- kg, g, l, ml, pcs, box, dozen, etc.
  price_per_unit REAL,
  reorder_level REAL DEFAULT 0,
  supplier_id TEXT,
  storage_location TEXT,
  expiry_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Recipe Links (menu item to ingredients)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  quantity_required REAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

-- Scanned Documents (bills/invoices)
CREATE TABLE IF NOT EXISTS inventory_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  document_type TEXT NOT NULL, -- invoice, bill, receipt, handwritten_note, camera_capture
  supplier_id TEXT,
  file_path TEXT, -- local path or R2 storage key
  ocr_status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  ocr_provider TEXT, -- gemini, deepseek, cloudflare-ai
  extracted_data TEXT, -- JSON of extracted items
  total_amount REAL,
  tax_amount REAL,
  document_date TEXT,
  invoice_number TEXT,
  processing_time_ms INTEGER,
  confidence_score REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Inventory Transactions (audit trail)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  document_id TEXT,
  transaction_type TEXT NOT NULL, -- purchase, sale, adjustment, waste, transfer, return
  quantity_change REAL NOT NULL,
  previous_quantity REAL NOT NULL,
  new_quantity REAL NOT NULL,
  unit_price REAL,
  reason TEXT,
  recorded_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (document_id) REFERENCES inventory_documents(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier ON inventory_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiry ON inventory_items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stock ON inventory_items(current_stock, reorder_level);
CREATE INDEX IF NOT EXISTS idx_inventory_documents_tenant ON inventory_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_documents_status ON inventory_documents(ocr_status);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_document ON inventory_transactions(document_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_menu ON recipe_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON recipe_ingredients(inventory_item_id);
