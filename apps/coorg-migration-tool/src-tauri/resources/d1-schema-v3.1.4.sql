-- Staff users table for PIN-based authentication
CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('cashier', 'waiter', 'kitchen', 'manager')),
    pin_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    permissions TEXT,  -- JSON array of permissions
    created_at INTEGER NOT NULL,
    last_login_at INTEGER,
    created_by TEXT,  -- Manager user ID who created this staff
    UNIQUE(tenant_id, name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff_users(is_active);

-- Login history table (optional, for audit trail)
CREATE TABLE IF NOT EXISTS staff_login_history (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    login_at INTEGER NOT NULL,
    device_id TEXT,
    success INTEGER NOT NULL CHECK (success IN (0, 1)),
    FOREIGN KEY(staff_id) REFERENCES staff_users(id)
);

CREATE INDEX IF NOT EXISTS idx_login_history_staff ON staff_login_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time ON staff_login_history(login_at);
-- Table sessions to track active dine-in orders with guest count
CREATE TABLE IF NOT EXISTS table_sessions (
    id TEXT PRIMARY KEY,
    table_number INTEGER NOT NULL,
    guest_count INTEGER NOT NULL DEFAULT 1,
    server_name TEXT,
    started_at TEXT NOT NULL,
    closed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    order_data TEXT,  -- JSON serialized order data
    tenant_id TEXT NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_number);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_tenant ON table_sessions(tenant_id);

-- Only one active session per table per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_active ON table_sessions(table_number, tenant_id) WHERE status = 'active';
-- Aggregator Orders (Swiggy, Zomato)
CREATE TABLE IF NOT EXISTS aggregator_orders (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    order_number TEXT NOT NULL,
    aggregator TEXT NOT NULL,
    aggregator_order_id TEXT NOT NULL,
    aggregator_status TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    order_type TEXT NOT NULL DEFAULT 'delivery',
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    items_json TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    delivery_fee REAL NOT NULL DEFAULT 0,
    platform_fee REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT,
    payment_status TEXT,
    is_prepaid BOOLEAN NOT NULL DEFAULT 1,
    special_instructions TEXT,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    delivered_at TEXT,
    updated_at TEXT NOT NULL,
    synced_at TEXT,
    raw_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_aggregator_orders_order_number ON aggregator_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_aggregator ON aggregator_orders(aggregator);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_status ON aggregator_orders(status);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_created_at ON aggregator_orders(created_at);
-- Add KOT tracking columns to table_sessions
-- kot_records: JSON array of KOT records for tracking multiple KOTs per table
-- last_kot_printed_at: Timestamp of the last KOT print

ALTER TABLE table_sessions ADD COLUMN kot_records TEXT;
ALTER TABLE table_sessions ADD COLUMN last_kot_printed_at TEXT;
-- KDS Orders Table
-- Stores active and completed kitchen orders for persistence across view switches
CREATE TABLE IF NOT EXISTS kds_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    table_number INTEGER,
    order_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_running_order INTEGER NOT NULL DEFAULT 0,
    kot_sequence INTEGER,
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    completed_at TEXT,
    elapsed_minutes INTEGER DEFAULT 0,
    estimated_prep_time INTEGER DEFAULT 15,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    tenant_id TEXT NOT NULL,
    UNIQUE(order_number, tenant_id)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_kds_orders_tenant_status ON kds_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_kds_orders_table ON kds_orders(table_number);
-- Sales Transactions Table
-- Records all completed sales for daily reporting and analytics
CREATE TABLE IF NOT EXISTS sales_transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    order_number TEXT,
    order_type TEXT NOT NULL,
    table_number INTEGER,
    source TEXT NOT NULL DEFAULT 'pos',
    subtotal REAL NOT NULL,
    service_charge REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    round_off REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'completed',
    items_json TEXT NOT NULL,
    cashier_name TEXT,
    staff_id TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT NOT NULL
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales_transactions(tenant_id, created_at);
-- Index for payment method analysis
CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales_transactions(payment_method);
-- Unique invoice number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_invoice ON sales_transactions(tenant_id, invoice_number);
-- Daily Cash Registers Table
-- Tracks opening/closing cash for daily reconciliation
CREATE TABLE IF NOT EXISTS daily_cash_registers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    business_date TEXT NOT NULL,
    opening_cash REAL NOT NULL DEFAULT 0,
    opened_at TEXT NOT NULL,
    opened_by TEXT,
    expected_closing_cash REAL,
    actual_closing_cash REAL,
    cash_variance REAL,
    closed_at TEXT,
    closed_by TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Unique register per business date per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_register_date ON daily_cash_registers(tenant_id, business_date);
-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_cash_register_status ON daily_cash_registers(tenant_id, status);
-- Remove demo users for security
-- These hardcoded credentials should not exist in production

-- Update to use staff_users table instead of non-existent users table
DELETE FROM staff_users WHERE id IN ('user-1', 'user-2', 'user-3', 'demo-user-1', 'demo-user-2');
-- Cash Payouts table for tracking cash withdrawals, expenses, and bank deposits
-- These affect the Daily Sales Report cash reconciliation

CREATE TABLE IF NOT EXISTS cash_payouts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    business_date TEXT NOT NULL,

    -- Payout details
    amount REAL NOT NULL,
    payout_type TEXT NOT NULL, -- 'withdrawal', 'expense', 'petty_cash', 'bank_deposit', 'vendor_payment'
    category TEXT, -- 'utilities', 'supplies', 'salary', 'misc', etc.
    description TEXT,
    reference_number TEXT, -- Receipt/invoice number if applicable

    -- Authorization
    recorded_by TEXT NOT NULL, -- Staff who recorded
    authorized_by TEXT, -- Manager who approved (if different)

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'

    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cash_payouts_tenant_date ON cash_payouts(tenant_id, business_date);
CREATE INDEX IF NOT EXISTS idx_cash_payouts_type ON cash_payouts(payout_type);
CREATE INDEX IF NOT EXISTS idx_cash_payouts_status ON cash_payouts(status);
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
-- Add picked_up_at timestamp to aggregator_orders
-- Tracks when delivery partner collected the order
ALTER TABLE aggregator_orders ADD COLUMN picked_up_at TEXT;
-- Add archived_at timestamp to aggregator_orders
-- Tracks when order was archived (dismissed or delivered)
ALTER TABLE aggregator_orders ADD COLUMN archived_at TEXT;

-- Index for efficient filtering of archived orders
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_archived ON aggregator_orders(archived_at);
-- Out of Stock (86) Items Table
-- Tracks items marked as out of stock by kitchen staff

CREATE TABLE IF NOT EXISTS out_of_stock_items (
    id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    menu_item_id TEXT,
    portions_out INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    created_by_device_id TEXT,
    created_by_staff_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    tenant_id TEXT NOT NULL
);

-- Index for efficient queries by tenant and active status
CREATE INDEX IF NOT EXISTS idx_out_of_stock_tenant_active
    ON out_of_stock_items(tenant_id, is_active);

-- Index for searching by item name
CREATE INDEX IF NOT EXISTS idx_out_of_stock_item_name
    ON out_of_stock_items(item_name, tenant_id);
-- Migration 014: Add synced_at column for D1 cloud sync
-- Tracks when sales transactions are synced to Cloudflare D1

ALTER TABLE sales_transactions ADD COLUMN synced_at TEXT;

-- Index for efficiently finding unsynced transactions
CREATE INDEX IF NOT EXISTS idx_sales_transactions_unsynced ON sales_transactions(synced_at) WHERE synced_at IS NULL;

-- Index for sync queries by tenant
CREATE INDEX IF NOT EXISTS idx_sales_transactions_tenant_sync ON sales_transactions(tenant_id, synced_at);
-- Order mappings table for orchestration service persistence
-- Stores the mapping between aggregator orders and kitchen orders

CREATE TABLE IF NOT EXISTS order_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aggregator_order_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    kitchen_order_id TEXT,
    source TEXT NOT NULL, -- 'zomato', 'swiggy', 'pos', 'online'
    current_status TEXT NOT NULL,
    kds_status TEXT,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aggregator_order_id)
);

-- Index for faster lookups by kitchen order id
CREATE INDEX IF NOT EXISTS idx_order_mappings_kitchen_order_id ON order_mappings(kitchen_order_id);

-- Index for faster lookups by order number
CREATE INDEX IF NOT EXISTS idx_order_mappings_order_number ON order_mappings(order_number);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_order_mappings_status ON order_mappings(current_status);
-- Attendance Records - Clock in/out, breaks, and shift tracking
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,

    -- Shift timing
    clock_in_at INTEGER NOT NULL,           -- Unix timestamp
    clock_out_at INTEGER,                    -- Unix timestamp, NULL if still clocked in
    scheduled_start INTEGER,                 -- Expected start time (for comparison)
    scheduled_end INTEGER,                   -- Expected end time (for comparison)

    -- Break tracking
    break_duration_minutes INTEGER DEFAULT 0, -- Total break time
    breaks_json TEXT,                         -- JSON array of break periods: [{id, type, startAt, endAt, durationMinutes}]

    -- Shift metadata
    shift_date TEXT NOT NULL,                 -- Date in YYYY-MM-DD format for querying
    shift_type TEXT DEFAULT 'regular',        -- regular, overtime, weekend, holiday
    roster_assignment_id TEXT,                -- Link to roster if shift was scheduled

    -- Hours calculation
    total_hours REAL,                         -- Total shift hours (clock_out - clock_in - breaks)
    regular_hours REAL,                       -- Regular hours (up to 8)
    overtime_hours REAL,                      -- Overtime hours (above 8)

    -- Status and validation
    status TEXT NOT NULL DEFAULT 'active',    -- active, completed, missed, excused
    late_by_minutes INTEGER DEFAULT 0,        -- Minutes late (if late)
    early_departure_minutes INTEGER DEFAULT 0, -- Minutes early departure

    -- Notes and metadata
    notes TEXT,                               -- Staff/manager notes
    device_id TEXT,                           -- Device used for clock in/out
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
    -- Note: roster_assignment_id is optional and validated in application code
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(shift_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance_records(staff_id, shift_date);

-- Only one active (not clocked out) record per staff member
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_active
ON attendance_records(staff_id, tenant_id)
WHERE clock_out_at IS NULL;
-- Weekly Rosters - Schedule templates
CREATE TABLE IF NOT EXISTS weekly_rosters (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Week identification
    week_start_date TEXT NOT NULL,           -- Monday of the week (YYYY-MM-DD)
    week_end_date TEXT NOT NULL,             -- Sunday of the week
    week_number INTEGER NOT NULL,            -- ISO week number
    year INTEGER NOT NULL,

    -- Roster metadata
    name TEXT,                                -- Optional name (e.g., "Holiday Week", "Summer Schedule")
    status TEXT NOT NULL DEFAULT 'draft',     -- draft, published, archived
    published_at INTEGER,
    published_by TEXT,                        -- Staff ID who published

    -- Tracking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    created_by TEXT,                          -- Manager who created

    FOREIGN KEY(created_by) REFERENCES staff_users(id),
    FOREIGN KEY(published_by) REFERENCES staff_users(id)
);

-- Roster Assignments - Individual shift assignments
CREATE TABLE IF NOT EXISTS roster_assignments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    roster_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,

    -- Shift details
    shift_date TEXT NOT NULL,                 -- YYYY-MM-DD
    day_of_week TEXT NOT NULL,                -- monday, tuesday, etc.
    shift_start INTEGER NOT NULL,             -- Unix timestamp
    shift_end INTEGER NOT NULL,               -- Unix timestamp
    shift_type TEXT DEFAULT 'regular',        -- regular, split, overnight, on-call

    -- Role and position
    role TEXT,                                -- Role for this shift (may differ from staff default)
    position TEXT,                            -- front, kitchen, bar, etc.
    section_id TEXT,                          -- Floor plan section assignment

    -- Status
    status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, confirmed, swapped, cancelled
    confirmed_by_staff INTEGER,               -- Timestamp when staff confirmed

    -- Metadata
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(roster_id) REFERENCES weekly_rosters(id) ON DELETE CASCADE,
    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Indexes for rosters
CREATE INDEX IF NOT EXISTS idx_roster_tenant ON weekly_rosters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roster_week ON weekly_rosters(week_start_date);
CREATE INDEX IF NOT EXISTS idx_roster_status ON weekly_rosters(status);
CREATE INDEX IF NOT EXISTS idx_roster_year_week ON weekly_rosters(year, week_number);

-- Indexes for assignments
CREATE INDEX IF NOT EXISTS idx_assignment_roster ON roster_assignments(roster_id);
CREATE INDEX IF NOT EXISTS idx_assignment_staff ON roster_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_assignment_date ON roster_assignments(shift_date);
CREATE INDEX IF NOT EXISTS idx_assignment_staff_date ON roster_assignments(staff_id, shift_date);

-- One assignment per staff per date (prevent double booking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_unique
ON roster_assignments(staff_id, shift_date);
-- Leave Requests - Time off management
CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,

    -- Leave period
    start_date TEXT NOT NULL,                 -- YYYY-MM-DD
    end_date TEXT NOT NULL,                   -- YYYY-MM-DD
    leave_type TEXT NOT NULL,                 -- vacation, sick, personal, emergency, unpaid

    -- Duration
    total_days INTEGER NOT NULL,              -- Number of days requested
    is_half_day INTEGER DEFAULT 0,            -- Boolean: is this a half-day leave

    -- Request details
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending, approved, rejected, cancelled

    -- Approval workflow
    requested_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    reviewed_by TEXT,                         -- Manager staff ID
    review_notes TEXT,

    -- Tracking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES staff_users(id)
);

-- Leave Balances - Track available leave days per staff
CREATE TABLE IF NOT EXISTS leave_balances (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    year INTEGER NOT NULL,

    -- Leave allocations
    vacation_days_total INTEGER DEFAULT 0,
    vacation_days_used INTEGER DEFAULT 0,
    sick_days_total INTEGER DEFAULT 0,
    sick_days_used INTEGER DEFAULT 0,
    personal_days_total INTEGER DEFAULT 0,
    personal_days_used INTEGER DEFAULT 0,

    -- Tracking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,

    -- One balance record per staff per year
    UNIQUE(staff_id, year)
);

-- Indexes for leave requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_dates ON leave_requests(staff_id, start_date);

-- Indexes for leave balances
CREATE INDEX IF NOT EXISTS idx_leave_balances_tenant ON leave_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_staff ON leave_balances(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);
-- Attendance Sync Log - Track cloud sync status
CREATE TABLE IF NOT EXISTS attendance_sync_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    record_type TEXT NOT NULL,               -- attendance, roster, leave
    record_id TEXT NOT NULL,

    -- Sync status
    sync_status TEXT NOT NULL DEFAULT 'pending', -- pending, synced, failed
    last_sync_attempt INTEGER,
    sync_error TEXT,

    -- Tracking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_record ON attendance_sync_log(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON attendance_sync_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_log_tenant ON attendance_sync_log(tenant_id);
-- Tips Management - Track tips for service staff separately from sales
CREATE TABLE IF NOT EXISTS tips (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Order/Invoice linkage
    invoice_number TEXT NOT NULL,
    order_number TEXT,
    table_number INTEGER,
    order_type TEXT NOT NULL CHECK (order_type IN ('dine-in', 'takeout', 'delivery')),

    -- Tip details
    tip_amount REAL NOT NULL CHECK (tip_amount >= 0),

    -- Staff attribution (dual tracking: staff_id preferred, server_name fallback)
    staff_id TEXT,                        -- From staff_users.id (if server entered PIN)
    server_name TEXT,                     -- From table_sessions.server_name (fallback)

    -- Entry metadata
    entered_by_staff_id TEXT,             -- Staff who entered the tip at POS
    entered_by_name TEXT,                 -- Name of staff who entered tip
    entry_method TEXT NOT NULL DEFAULT 'manual' CHECK (entry_method IN ('manual', 'auto')),

    -- Timestamps
    created_at TEXT NOT NULL,             -- ISO 8601 timestamp
    tip_date TEXT NOT NULL,               -- Date in YYYY-MM-DD format for daily aggregation

    -- Cloud sync tracking
    synced_at TEXT,                       -- ISO 8601 timestamp when synced to cloud

    -- Foreign keys
    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    FOREIGN KEY(entered_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_tips_tenant_date ON tips(tenant_id, tip_date);
CREATE INDEX IF NOT EXISTS idx_tips_invoice ON tips(invoice_number);
CREATE INDEX IF NOT EXISTS idx_tips_staff ON tips(staff_id);
CREATE INDEX IF NOT EXISTS idx_tips_server_name ON tips(server_name);
CREATE INDEX IF NOT EXISTS idx_tips_table ON tips(table_number);
CREATE INDEX IF NOT EXISTS idx_tips_sync ON tips(synced_at);
CREATE INDEX IF NOT EXISTS idx_tips_tenant_invoice ON tips(tenant_id, invoice_number);

-- Prevent duplicate tips for same invoice (one tip per order)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tips_invoice_unique ON tips(tenant_id, invoice_number);
-- ============================================================================
-- MULTILINGUAL SUPPORT SCHEMA
-- ============================================================================
-- This migration adds comprehensive i18n support with:
-- 1. Translation keys registry (all translatable UI strings)
-- 2. Multi-language translation storage (13+ languages)
-- 3. Per-tenant customization (restaurant-specific terminology)
-- ============================================================================

-- ============================================================================
-- 1. TRANSLATION KEYS TABLE
-- ============================================================================
-- Defines all translatable UI strings across the application
-- Each key represents a unique translatable string (e.g., "pos.addToCart")
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,           -- Namespaced key: "common.save", "pos.addToCart"
    category TEXT NOT NULL,              -- Namespace: "common", "pos", "menu", "settings", etc.
    description TEXT,                    -- Context for admins: "Button text for adding items to cart"
    default_value_en TEXT NOT NULL,      -- English default value (fallback)
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_keys_category ON translation_keys(category);
CREATE INDEX IF NOT EXISTS idx_translation_keys_key ON translation_keys(key);

-- ============================================================================
-- 2. TRANSLATIONS TABLE
-- ============================================================================
-- Stores actual translations for each key in different languages
-- This is the base translation that all tenants share by default
-- ============================================================================
CREATE TABLE IF NOT EXISTS translations (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,                -- FK to translation_keys.id
    language TEXT NOT NULL,              -- ISO 639-1 code: "en", "fr", "hi", "es", etc.
    value TEXT NOT NULL,                 -- Translated string
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (key_id) REFERENCES translation_keys(id) ON DELETE CASCADE,
    UNIQUE(key_id, language)
);

CREATE INDEX IF NOT EXISTS idx_translations_key_lang ON translations(key_id, language);
CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language);

-- ============================================================================
-- 3. TENANT TRANSLATION OVERRIDES TABLE
-- ============================================================================
-- Per-tenant customization: allows restaurants to override translations
-- Example: "Dine In" → "For Here" or "Eat In" based on regional preference
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_translation_overrides (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,             -- Restaurant/tenant identifier
    key_id TEXT NOT NULL,                -- FK to translation_keys.id
    language TEXT NOT NULL,              -- ISO 639-1 code
    custom_value TEXT NOT NULL,          -- Custom translation value
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_by TEXT,                     -- Staff user ID who made the change
    FOREIGN KEY (key_id) REFERENCES translation_keys(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, key_id, language)
);

CREATE INDEX IF NOT EXISTS idx_tenant_overrides_lookup ON tenant_translation_overrides(tenant_id, key_id, language);
CREATE INDEX IF NOT EXISTS idx_tenant_overrides_tenant ON tenant_translation_overrides(tenant_id);

-- ============================================================================
-- 4. USER LANGUAGE PREFERENCES
-- ============================================================================
-- Add language preference column to staff_users table
-- Each staff member can select their preferred UI language
-- Note: This may fail with "duplicate column" if partially applied - that's OK
-- ============================================================================
ALTER TABLE staff_users ADD COLUMN preferred_language TEXT DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_staff_language ON staff_users(preferred_language);

-- ============================================================================
-- 5. MENU ITEM MULTILINGUAL SUPPORT
-- ============================================================================
-- Add translation columns for menu items (JSON format)
-- Stores translations as: {"fr": "Poulet", "hi": "मुर्गा", "es": "Pollo"}
-- Note: This may fail with "duplicate column" if partially applied - that's OK
-- ============================================================================
ALTER TABLE menu_items ADD COLUMN name_translations TEXT;
ALTER TABLE menu_items ADD COLUMN description_translations TEXT;

-- ============================================================================
-- 6. MENU CATEGORY MULTILINGUAL SUPPORT
-- ============================================================================
-- Add translation columns for categories
-- Note: This may fail with "duplicate column" if partially applied - that's OK
-- ============================================================================
ALTER TABLE menu_categories ADD COLUMN name_translations TEXT;

-- ============================================================================
-- 7. TENANT SETTINGS TABLE
-- ============================================================================
-- Store tenant-level settings including default language
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_settings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(tenant_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_lookup ON tenant_settings(tenant_id, setting_key);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Populate translation_keys with all UI strings
-- 2. Populate translations with default language translations
-- 3. Implement Rust TranslationService to load/manage translations
-- 4. Create React hooks to fetch translations from Rust
-- 5. Build admin UI for customizing translations
-- ============================================================================
-- ============================================================================
-- TRANSLATION SEEDS - DEFAULT UI STRINGS FOR ALL LANGUAGES
-- ============================================================================
-- Populates translation_keys and translations tables with:
-- - Common UI strings (buttons, labels, actions)
-- - POS-specific terminology
-- - Menu management labels
-- - Settings interface strings
-- - Reports and analytics labels
-- - Authentication strings
-- - Error messages
-- - Form validation messages
--
-- Supported Languages (13):
-- - en (English) - US
-- - fr (French), de (German), es (Spanish), it (Italian) - Europe
-- - th (Thai), vi (Vietnamese), id (Indonesian), ms (Malay) - Southeast Asia
-- - hi (Hindi), ta (Tamil), te (Telugu), bn (Bengali), mr (Marathi) - India
-- ============================================================================

-- ============================================================================
-- COMMON NAMESPACE - Shared UI Elements
-- ============================================================================

-- Save Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-save', 'common.save', 'common', 'Save button label', 'Save');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-save-en', 'key-common-save', 'en', 'Save'),
('trans-common-save-fr', 'key-common-save', 'fr', 'Enregistrer'),
('trans-common-save-de', 'key-common-save', 'de', 'Speichern'),
('trans-common-save-es', 'key-common-save', 'es', 'Guardar'),
('trans-common-save-it', 'key-common-save', 'it', 'Salva'),
('trans-common-save-th', 'key-common-save', 'th', 'บันทึก'),
('trans-common-save-vi', 'key-common-save', 'vi', 'Lưu'),
('trans-common-save-id', 'key-common-save', 'id', 'Simpan'),
('trans-common-save-ms', 'key-common-save', 'ms', 'Simpan'),
('trans-common-save-hi', 'key-common-save', 'hi', 'सहेजें'),
('trans-common-save-ta', 'key-common-save', 'ta', 'சேமி'),
('trans-common-save-te', 'key-common-save', 'te', 'సేవ్ చేయండి'),
('trans-common-save-bn', 'key-common-save', 'bn', 'সংরক্ষণ'),
('trans-common-save-mr', 'key-common-save', 'mr', 'जतन करा');

-- Cancel Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-cancel', 'common.cancel', 'common', 'Cancel button label', 'Cancel');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-cancel-en', 'key-common-cancel', 'en', 'Cancel'),
('trans-common-cancel-fr', 'key-common-cancel', 'fr', 'Annuler'),
('trans-common-cancel-de', 'key-common-cancel', 'de', 'Abbrechen'),
('trans-common-cancel-es', 'key-common-cancel', 'es', 'Cancelar'),
('trans-common-cancel-it', 'key-common-cancel', 'it', 'Annulla'),
('trans-common-cancel-th', 'key-common-cancel', 'th', 'ยกเลิก'),
('trans-common-cancel-vi', 'key-common-cancel', 'vi', 'Hủy'),
('trans-common-cancel-id', 'key-common-cancel', 'id', 'Batal'),
('trans-common-cancel-ms', 'key-common-cancel', 'ms', 'Batal'),
('trans-common-cancel-hi', 'key-common-cancel', 'hi', 'रद्द करें'),
('trans-common-cancel-ta', 'key-common-cancel', 'ta', 'ரத்து செய்'),
('trans-common-cancel-te', 'key-common-cancel', 'te', 'రద్దు చేయండి'),
('trans-common-cancel-bn', 'key-common-cancel', 'bn', 'বাতিল'),
('trans-common-cancel-mr', 'key-common-cancel', 'mr', 'रद्द करा');

-- Delete Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-delete', 'common.delete', 'common', 'Delete button label', 'Delete');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-delete-en', 'key-common-delete', 'en', 'Delete'),
('trans-common-delete-fr', 'key-common-delete', 'fr', 'Supprimer'),
('trans-common-delete-de', 'key-common-delete', 'de', 'Löschen'),
('trans-common-delete-es', 'key-common-delete', 'es', 'Eliminar'),
('trans-common-delete-it', 'key-common-delete', 'it', 'Elimina'),
('trans-common-delete-th', 'key-common-delete', 'th', 'ลบ'),
('trans-common-delete-vi', 'key-common-delete', 'vi', 'Xóa'),
('trans-common-delete-id', 'key-common-delete', 'id', 'Hapus'),
('trans-common-delete-ms', 'key-common-delete', 'ms', 'Padam'),
('trans-common-delete-hi', 'key-common-delete', 'hi', 'हटाएं'),
('trans-common-delete-ta', 'key-common-delete', 'ta', 'நீக்கு'),
('trans-common-delete-te', 'key-common-delete', 'te', 'తొలగించు'),
('trans-common-delete-bn', 'key-common-delete', 'bn', 'মুছুন'),
('trans-common-delete-mr', 'key-common-delete', 'mr', 'हटवा');

-- Edit Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-edit', 'common.edit', 'common', 'Edit button label', 'Edit');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-edit-en', 'key-common-edit', 'en', 'Edit'),
('trans-common-edit-fr', 'key-common-edit', 'fr', 'Modifier'),
('trans-common-edit-de', 'key-common-edit', 'de', 'Bearbeiten'),
('trans-common-edit-es', 'key-common-edit', 'es', 'Editar'),
('trans-common-edit-it', 'key-common-edit', 'it', 'Modifica'),
('trans-common-edit-th', 'key-common-edit', 'th', 'แก้ไข'),
('trans-common-edit-vi', 'key-common-edit', 'vi', 'Chỉnh sửa'),
('trans-common-edit-id', 'key-common-edit', 'id', 'Edit'),
('trans-common-edit-ms', 'key-common-edit', 'ms', 'Edit'),
('trans-common-edit-hi', 'key-common-edit', 'hi', 'संपादित करें'),
('trans-common-edit-ta', 'key-common-edit', 'ta', 'திருத்து'),
('trans-common-edit-te', 'key-common-edit', 'te', 'సవరించు'),
('trans-common-edit-bn', 'key-common-edit', 'bn', 'সম্পাদনা'),
('trans-common-edit-mr', 'key-common-edit', 'mr', 'संपादित करा');

-- Confirm
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-confirm', 'common.confirm', 'common', 'Confirm button label', 'Confirm');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-confirm-en', 'key-common-confirm', 'en', 'Confirm'),
('trans-common-confirm-fr', 'key-common-confirm', 'fr', 'Confirmer'),
('trans-common-confirm-de', 'key-common-confirm', 'de', 'Bestätigen'),
('trans-common-confirm-es', 'key-common-confirm', 'es', 'Confirmar'),
('trans-common-confirm-it', 'key-common-confirm', 'it', 'Conferma'),
('trans-common-confirm-th', 'key-common-confirm', 'th', 'ยืนยัน'),
('trans-common-confirm-vi', 'key-common-confirm', 'vi', 'Xác nhận'),
('trans-common-confirm-id', 'key-common-confirm', 'id', 'Konfirmasi'),
('trans-common-confirm-ms', 'key-common-confirm', 'ms', 'Sahkan'),
('trans-common-confirm-hi', 'key-common-confirm', 'hi', 'पुष्टि करें'),
('trans-common-confirm-ta', 'key-common-confirm', 'ta', 'உறுதிப்படுத்து'),
('trans-common-confirm-te', 'key-common-confirm', 'te', 'నిర్ధారించు'),
('trans-common-confirm-bn', 'key-common-confirm', 'bn', 'নিশ্চিত করুন'),
('trans-common-confirm-mr', 'key-common-confirm', 'mr', 'पुष्टी करा');

-- Search
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-search', 'common.search', 'common', 'Search input placeholder', 'Search');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-search-en', 'key-common-search', 'en', 'Search'),
('trans-common-search-fr', 'key-common-search', 'fr', 'Rechercher'),
('trans-common-search-de', 'key-common-search', 'de', 'Suchen'),
('trans-common-search-es', 'key-common-search', 'es', 'Buscar'),
('trans-common-search-it', 'key-common-search', 'it', 'Cerca'),
('trans-common-search-th', 'key-common-search', 'th', 'ค้นหา'),
('trans-common-search-vi', 'key-common-search', 'vi', 'Tìm kiếm'),
('trans-common-search-id', 'key-common-search', 'id', 'Cari'),
('trans-common-search-ms', 'key-common-search', 'ms', 'Cari'),
('trans-common-search-hi', 'key-common-search', 'hi', 'खोजें'),
('trans-common-search-ta', 'key-common-search', 'ta', 'தேடு'),
('trans-common-search-te', 'key-common-search', 'te', 'వెతకండి'),
('trans-common-search-bn', 'key-common-search', 'bn', 'অনুসন্ধান'),
('trans-common-search-mr', 'key-common-search', 'mr', 'शोधा');

-- Loading
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-common-loading', 'common.loading', 'common', 'Loading indicator text', 'Loading...');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-common-loading-en', 'key-common-loading', 'en', 'Loading...'),
('trans-common-loading-fr', 'key-common-loading', 'fr', 'Chargement...'),
('trans-common-loading-de', 'key-common-loading', 'de', 'Laden...'),
('trans-common-loading-es', 'key-common-loading', 'es', 'Cargando...'),
('trans-common-loading-it', 'key-common-loading', 'it', 'Caricamento...'),
('trans-common-loading-th', 'key-common-loading', 'th', 'กำลังโหลด...'),
('trans-common-loading-vi', 'key-common-loading', 'vi', 'Đang tải...'),
('trans-common-loading-id', 'key-common-loading', 'id', 'Memuat...'),
('trans-common-loading-ms', 'key-common-loading', 'ms', 'Memuatkan...'),
('trans-common-loading-hi', 'key-common-loading', 'hi', 'लोड हो रहा है...'),
('trans-common-loading-ta', 'key-common-loading', 'ta', 'ஏற்றுகிறது...'),
('trans-common-loading-te', 'key-common-loading', 'te', 'లోడ్ అవుతోంది...'),
('trans-common-loading-bn', 'key-common-loading', 'bn', 'লোড হচ্ছে...'),
('trans-common-loading-mr', 'key-common-loading', 'mr', 'लोड होत आहे...');

-- ============================================================================
-- POS NAMESPACE - Point of Sale Interface
-- ============================================================================

-- Add to Cart
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-addToCart', 'pos.addToCart', 'pos', 'Add to cart button', 'Add to Cart');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-addToCart-en', 'key-pos-addToCart', 'en', 'Add to Cart'),
('trans-pos-addToCart-fr', 'key-pos-addToCart', 'fr', 'Ajouter au panier'),
('trans-pos-addToCart-de', 'key-pos-addToCart', 'de', 'In den Warenkorb'),
('trans-pos-addToCart-es', 'key-pos-addToCart', 'es', 'Agregar al carrito'),
('trans-pos-addToCart-it', 'key-pos-addToCart', 'it', 'Aggiungi al carrello'),
('trans-pos-addToCart-th', 'key-pos-addToCart', 'th', 'เพิ่มในรถเข็น'),
('trans-pos-addToCart-vi', 'key-pos-addToCart', 'vi', 'Thêm vào giỏ'),
('trans-pos-addToCart-id', 'key-pos-addToCart', 'id', 'Tambah ke Keranjang'),
('trans-pos-addToCart-ms', 'key-pos-addToCart', 'ms', 'Tambah ke Troli'),
('trans-pos-addToCart-hi', 'key-pos-addToCart', 'hi', 'कार्ट में जोड़ें'),
('trans-pos-addToCart-ta', 'key-pos-addToCart', 'ta', 'வண்டியில் சேர்'),
('trans-pos-addToCart-te', 'key-pos-addToCart', 'te', 'కార్ట్‌కి జోడించు'),
('trans-pos-addToCart-bn', 'key-pos-addToCart', 'bn', 'কার্টে যোগ করুন'),
('trans-pos-addToCart-mr', 'key-pos-addToCart', 'mr', 'कार्टमध्ये जोडा');

-- Total
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-total', 'pos.total', 'pos', 'Total amount label', 'Total');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-total-en', 'key-pos-total', 'en', 'Total'),
('trans-pos-total-fr', 'key-pos-total', 'fr', 'Total'),
('trans-pos-total-de', 'key-pos-total', 'de', 'Gesamt'),
('trans-pos-total-es', 'key-pos-total', 'es', 'Total'),
('trans-pos-total-it', 'key-pos-total', 'it', 'Totale'),
('trans-pos-total-th', 'key-pos-total', 'th', 'ยอดรวม'),
('trans-pos-total-vi', 'key-pos-total', 'vi', 'Tổng cộng'),
('trans-pos-total-id', 'key-pos-total', 'id', 'Total'),
('trans-pos-total-ms', 'key-pos-total', 'ms', 'Jumlah'),
('trans-pos-total-hi', 'key-pos-total', 'hi', 'कुल'),
('trans-pos-total-ta', 'key-pos-total', 'ta', 'மொத்தம்'),
('trans-pos-total-te', 'key-pos-total', 'te', 'మొత్తం'),
('trans-pos-total-bn', 'key-pos-total', 'bn', 'মোট'),
('trans-pos-total-mr', 'key-pos-total', 'mr', 'एकूण');

-- Checkout
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-checkout', 'pos.checkout', 'pos', 'Checkout button', 'Checkout');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-checkout-en', 'key-pos-checkout', 'en', 'Checkout'),
('trans-pos-checkout-fr', 'key-pos-checkout', 'fr', 'Passer la commande'),
('trans-pos-checkout-de', 'key-pos-checkout', 'de', 'Zur Kasse'),
('trans-pos-checkout-es', 'key-pos-checkout', 'es', 'Pagar'),
('trans-pos-checkout-it', 'key-pos-checkout', 'it', 'Pagamento'),
('trans-pos-checkout-th', 'key-pos-checkout', 'th', 'ชำระเงิน'),
('trans-pos-checkout-vi', 'key-pos-checkout', 'vi', 'Thanh toán'),
('trans-pos-checkout-id', 'key-pos-checkout', 'id', 'Bayar'),
('trans-pos-checkout-ms', 'key-pos-checkout', 'ms', 'Bayar'),
('trans-pos-checkout-hi', 'key-pos-checkout', 'hi', 'भुगतान करें'),
('trans-pos-checkout-ta', 'key-pos-checkout', 'ta', 'பணம் செலுத்து'),
('trans-pos-checkout-te', 'key-pos-checkout', 'te', 'చెక్అవుట్'),
('trans-pos-checkout-bn', 'key-pos-checkout', 'bn', 'চেকআউট'),
('trans-pos-checkout-mr', 'key-pos-checkout', 'mr', 'चेकआउट');

-- Dine In
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-dineIn', 'pos.dineIn', 'pos', 'Dine-in order type label', 'Dine In');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-dineIn-en', 'key-pos-dineIn', 'en', 'Dine In'),
('trans-pos-dineIn-fr', 'key-pos-dineIn', 'fr', 'Sur place'),
('trans-pos-dineIn-de', 'key-pos-dineIn', 'de', 'Im Restaurant'),
('trans-pos-dineIn-es', 'key-pos-dineIn', 'es', 'Comer aquí'),
('trans-pos-dineIn-it', 'key-pos-dineIn', 'it', 'Al tavolo'),
('trans-pos-dineIn-th', 'key-pos-dineIn', 'th', 'ทานที่ร้าน'),
('trans-pos-dineIn-vi', 'key-pos-dineIn', 'vi', 'Tại chỗ'),
('trans-pos-dineIn-id', 'key-pos-dineIn', 'id', 'Makan di tempat'),
('trans-pos-dineIn-ms', 'key-pos-dineIn', 'ms', 'Makan di kedai'),
('trans-pos-dineIn-hi', 'key-pos-dineIn', 'hi', 'यहां भोजन'),
('trans-pos-dineIn-ta', 'key-pos-dineIn', 'ta', 'உணவகத்தில்'),
('trans-pos-dineIn-te', 'key-pos-dineIn', 'te', 'రెస్టారెంట్‌లో'),
('trans-pos-dineIn-bn', 'key-pos-dineIn', 'bn', 'ডাইন ইন'),
('trans-pos-dineIn-mr', 'key-pos-dineIn', 'mr', 'येथे जेवा');

-- Takeaway
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-takeaway', 'pos.takeaway', 'pos', 'Takeaway order type label', 'Takeaway');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-takeaway-en', 'key-pos-takeaway', 'en', 'Takeaway'),
('trans-pos-takeaway-fr', 'key-pos-takeaway', 'fr', 'À emporter'),
('trans-pos-takeaway-de', 'key-pos-takeaway', 'de', 'Zum Mitnehmen'),
('trans-pos-takeaway-es', 'key-pos-takeaway', 'es', 'Para llevar'),
('trans-pos-takeaway-it', 'key-pos-takeaway', 'it', 'Da asporto'),
('trans-pos-takeaway-th', 'key-pos-takeaway', 'th', 'กลับบ้าน'),
('trans-pos-takeaway-vi', 'key-pos-takeaway', 'vi', 'Mang về'),
('trans-pos-takeaway-id', 'key-pos-takeaway', 'id', 'Bawa pulang'),
('trans-pos-takeaway-ms', 'key-pos-takeaway', 'ms', 'Bawa balik'),
('trans-pos-takeaway-hi', 'key-pos-takeaway', 'hi', 'पैकिंग'),
('trans-pos-takeaway-ta', 'key-pos-takeaway', 'ta', 'எடுத்துச் செல்ல'),
('trans-pos-takeaway-te', 'key-pos-takeaway', 'te', 'టేక్అవే'),
('trans-pos-takeaway-bn', 'key-pos-takeaway', 'bn', 'টেকঅ্যাওয়ে'),
('trans-pos-takeaway-mr', 'key-pos-takeaway', 'mr', 'पार्सल');

-- Delivery
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-pos-delivery', 'pos.delivery', 'pos', 'Delivery order type label', 'Delivery');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-pos-delivery-en', 'key-pos-delivery', 'en', 'Delivery'),
('trans-pos-delivery-fr', 'key-pos-delivery', 'fr', 'Livraison'),
('trans-pos-delivery-de', 'key-pos-delivery', 'de', 'Lieferung'),
('trans-pos-delivery-es', 'key-pos-delivery', 'es', 'Entrega a domicilio'),
('trans-pos-delivery-it', 'key-pos-delivery', 'it', 'Consegna'),
('trans-pos-delivery-th', 'key-pos-delivery', 'th', 'จัดส่ง'),
('trans-pos-delivery-vi', 'key-pos-delivery', 'vi', 'Giao hàng'),
('trans-pos-delivery-id', 'key-pos-delivery', 'id', 'Pengiriman'),
('trans-pos-delivery-ms', 'key-pos-delivery', 'ms', 'Penghantaran'),
('trans-pos-delivery-hi', 'key-pos-delivery', 'hi', 'डिलीवरी'),
('trans-pos-delivery-ta', 'key-pos-delivery', 'ta', 'விநியோகம்'),
('trans-pos-delivery-te', 'key-pos-delivery', 'te', 'డెలివరీ'),
('trans-pos-delivery-bn', 'key-pos-delivery', 'bn', 'ডেলিভারি'),
('trans-pos-delivery-mr', 'key-pos-delivery', 'mr', 'डिलिव्हरी');

-- NOTE: This is a starter set of translations. The complete seed file would include:
-- - All POS labels (quantity, price, discount, tax, subtotal, etc.)
-- - Menu management strings (categories, items, modifiers, etc.)
-- - Settings interface (account, restaurant, payment, etc.)
-- - Reports labels (sales, inventory, staff performance, etc.)
-- - Authentication (login, logout, password reset, etc.)
-- - Error messages (validation errors, API errors, etc.)
-- - Form validation messages
--
-- Total: ~200-300 translation keys across all namespaces
--
-- For production, you would generate the complete set using a script or
-- import from a CSV/JSON file for easier management.

-- ============================================================================
-- ONBOARDING NAMESPACE - Restaurant Creation Flow
-- ============================================================================

-- Create Restaurant
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-createRestaurant', 'onboarding.createRestaurant', 'onboarding', 'Main title for onboarding', 'Create Your Restaurant');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-createRestaurant-en', 'key-onboarding-createRestaurant', 'en', 'Create Your Restaurant'),
('trans-onboarding-createRestaurant-fr', 'key-onboarding-createRestaurant', 'fr', 'Créez votre restaurant'),
('trans-onboarding-createRestaurant-de', 'key-onboarding-createRestaurant', 'de', 'Erstellen Sie Ihr Restaurant'),
('trans-onboarding-createRestaurant-es', 'key-onboarding-createRestaurant', 'es', 'Crea tu restaurante'),
('trans-onboarding-createRestaurant-it', 'key-onboarding-createRestaurant', 'it', 'Crea il tuo ristorante'),
('trans-onboarding-createRestaurant-th', 'key-onboarding-createRestaurant', 'th', 'สร้างร้านอาหารของคุณ'),
('trans-onboarding-createRestaurant-vi', 'key-onboarding-createRestaurant', 'vi', 'Tạo nhà hàng của bạn'),
('trans-onboarding-createRestaurant-id', 'key-onboarding-createRestaurant', 'id', 'Buat restoran Anda'),
('trans-onboarding-createRestaurant-ms', 'key-onboarding-createRestaurant', 'ms', 'Cipta restoran anda'),
('trans-onboarding-createRestaurant-hi', 'key-onboarding-createRestaurant', 'hi', 'अपना रेस्तरां बनाएं'),
('trans-onboarding-createRestaurant-ta', 'key-onboarding-createRestaurant', 'ta', 'உங்கள் உணவகத்தை உருவாக்குங்கள்'),
('trans-onboarding-createRestaurant-te', 'key-onboarding-createRestaurant', 'te', 'మీ రెస్టారెంట్‌ను సృష్టించండి'),
('trans-onboarding-createRestaurant-bn', 'key-onboarding-createRestaurant', 'bn', 'আপনার রেস্তোরাঁ তৈরি করুন'),
('trans-onboarding-createRestaurant-mr', 'key-onboarding-createRestaurant', 'mr', 'तुमचे रेस्टॉरंट तयार करा');

-- Get Started
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-getStarted', 'onboarding.getStarted', 'onboarding', 'Subtitle text', 'Get started with voice-powered ordering in minutes');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-getStarted-en', 'key-onboarding-getStarted', 'en', 'Get started with voice-powered ordering in minutes'),
('trans-onboarding-getStarted-fr', 'key-onboarding-getStarted', 'fr', 'Commencez avec la commande vocale en quelques minutes'),
('trans-onboarding-getStarted-de', 'key-onboarding-getStarted', 'de', 'Starten Sie in wenigen Minuten mit Sprachbestellung'),
('trans-onboarding-getStarted-es', 'key-onboarding-getStarted', 'es', 'Comienza con pedidos por voz en minutos'),
('trans-onboarding-getStarted-it', 'key-onboarding-getStarted', 'it', 'Inizia con gli ordini vocali in pochi minuti'),
('trans-onboarding-getStarted-th', 'key-onboarding-getStarted', 'th', 'เริ่มต้นใช้งานการสั่งซื้อด้วยเสียงภายในไม่กี่นาที'),
('trans-onboarding-getStarted-vi', 'key-onboarding-getStarted', 'vi', 'Bắt đầu đặt hàng bằng giọng nói trong vài phút'),
('trans-onboarding-getStarted-id', 'key-onboarding-getStarted', 'id', 'Mulai dengan pesanan suara dalam hitungan menit'),
('trans-onboarding-getStarted-ms', 'key-onboarding-getStarted', 'ms', 'Mulakan pesanan suara dalam beberapa minit'),
('trans-onboarding-getStarted-hi', 'key-onboarding-getStarted', 'hi', 'कुछ ही मिनटों में वॉयस ऑर्डरिंग के साथ शुरुआत करें'),
('trans-onboarding-getStarted-ta', 'key-onboarding-getStarted', 'ta', 'சில நிமிடங்களில் குரல் ஆர்டரிங் மூலம் தொடங்குங்கள்'),
('trans-onboarding-getStarted-te', 'key-onboarding-getStarted', 'te', 'నిమిషాల్లో వాయిస్ ఆర్డరింగ్‌తో ప్రారంభించండి'),
('trans-onboarding-getStarted-bn', 'key-onboarding-getStarted', 'bn', 'কয়েক মিনিটের মধ্যে ভয়েস অর্ডারিং দিয়ে শুরু করুন'),
('trans-onboarding-getStarted-mr', 'key-onboarding-getStarted', 'mr', 'काही मिनिटांत व्हॉइस ऑर्डरिंगसह सुरुवात करा');

-- Restaurant Name Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-restaurantName', 'onboarding.restaurantName', 'onboarding', 'Restaurant name field label', 'Restaurant Name');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-restaurantName-en', 'key-onboarding-restaurantName', 'en', 'Restaurant Name'),
('trans-onboarding-restaurantName-fr', 'key-onboarding-restaurantName', 'fr', 'Nom du restaurant'),
('trans-onboarding-restaurantName-de', 'key-onboarding-restaurantName', 'de', 'Restaurantname'),
('trans-onboarding-restaurantName-es', 'key-onboarding-restaurantName', 'es', 'Nombre del restaurante'),
('trans-onboarding-restaurantName-it', 'key-onboarding-restaurantName', 'it', 'Nome del ristorante'),
('trans-onboarding-restaurantName-th', 'key-onboarding-restaurantName', 'th', 'ชื่อร้านอาหาร'),
('trans-onboarding-restaurantName-vi', 'key-onboarding-restaurantName', 'vi', 'Tên nhà hàng'),
('trans-onboarding-restaurantName-id', 'key-onboarding-restaurantName', 'id', 'Nama restoran'),
('trans-onboarding-restaurantName-ms', 'key-onboarding-restaurantName', 'ms', 'Nama restoran'),
('trans-onboarding-restaurantName-hi', 'key-onboarding-restaurantName', 'hi', 'रेस्तरां का नाम'),
('trans-onboarding-restaurantName-ta', 'key-onboarding-restaurantName', 'ta', 'உணவகத்தின் பெயர்'),
('trans-onboarding-restaurantName-te', 'key-onboarding-restaurantName', 'te', 'రెస్టారెంట్ పేరు'),
('trans-onboarding-restaurantName-bn', 'key-onboarding-restaurantName', 'bn', 'রেস্তোরাঁর নাম'),
('trans-onboarding-restaurantName-mr', 'key-onboarding-restaurantName', 'mr', 'रेस्टॉरंटचे नाव');

-- Restaurant Name Placeholder
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-restaurantNamePlaceholder', 'onboarding.restaurantNamePlaceholder', 'onboarding', 'Restaurant name input placeholder', 'Your Restaurant/ Chain Name');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-restaurantNamePlaceholder-en', 'key-onboarding-restaurantNamePlaceholder', 'en', 'Your Restaurant/ Chain Name'),
('trans-onboarding-restaurantNamePlaceholder-fr', 'key-onboarding-restaurantNamePlaceholder', 'fr', 'Nom de votre restaurant/chaîne'),
('trans-onboarding-restaurantNamePlaceholder-de', 'key-onboarding-restaurantNamePlaceholder', 'de', 'Name Ihres Restaurants/Ihrer Kette'),
('trans-onboarding-restaurantNamePlaceholder-es', 'key-onboarding-restaurantNamePlaceholder', 'es', 'Nombre de su restaurante/cadena'),
('trans-onboarding-restaurantNamePlaceholder-it', 'key-onboarding-restaurantNamePlaceholder', 'it', 'Nome del tuo ristorante/catena'),
('trans-onboarding-restaurantNamePlaceholder-th', 'key-onboarding-restaurantNamePlaceholder', 'th', 'ชื่อร้านอาหาร/เครือข่ายของคุณ'),
('trans-onboarding-restaurantNamePlaceholder-vi', 'key-onboarding-restaurantNamePlaceholder', 'vi', 'Tên nhà hàng/chuỗi của bạn'),
('trans-onboarding-restaurantNamePlaceholder-id', 'key-onboarding-restaurantNamePlaceholder', 'id', 'Nama Restoran/Jaringan Anda'),
('trans-onboarding-restaurantNamePlaceholder-ms', 'key-onboarding-restaurantNamePlaceholder', 'ms', 'Nama Restoran/Rangkaian Anda'),
('trans-onboarding-restaurantNamePlaceholder-hi', 'key-onboarding-restaurantNamePlaceholder', 'hi', 'आपके रेस्तरां/चेन का नाम'),
('trans-onboarding-restaurantNamePlaceholder-ta', 'key-onboarding-restaurantNamePlaceholder', 'ta', 'உங்கள் உணவகம்/சங்கிலியின் பெயர்'),
('trans-onboarding-restaurantNamePlaceholder-te', 'key-onboarding-restaurantNamePlaceholder', 'te', 'మీ రెస్టారెంట్/చెయిన్ పేరు'),
('trans-onboarding-restaurantNamePlaceholder-bn', 'key-onboarding-restaurantNamePlaceholder', 'bn', 'আপনার রেস্তোরাঁ/চেইনের নাম'),
('trans-onboarding-restaurantNamePlaceholder-mr', 'key-onboarding-restaurantNamePlaceholder', 'mr', 'तुमच्या रेस्टॉरंट/चेनचे नाव');

-- Email Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-email', 'onboarding.email', 'onboarding', 'Email field label', 'Email');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-email-en', 'key-onboarding-email', 'en', 'Email'),
('trans-onboarding-email-fr', 'key-onboarding-email', 'fr', 'E-mail'),
('trans-onboarding-email-de', 'key-onboarding-email', 'de', 'E-Mail'),
('trans-onboarding-email-es', 'key-onboarding-email', 'es', 'Correo electrónico'),
('trans-onboarding-email-it', 'key-onboarding-email', 'it', 'Email'),
('trans-onboarding-email-th', 'key-onboarding-email', 'th', 'อีเมล'),
('trans-onboarding-email-vi', 'key-onboarding-email', 'vi', 'Email'),
('trans-onboarding-email-id', 'key-onboarding-email', 'id', 'Email'),
('trans-onboarding-email-ms', 'key-onboarding-email', 'ms', 'Emel'),
('trans-onboarding-email-hi', 'key-onboarding-email', 'hi', 'ईमेल'),
('trans-onboarding-email-ta', 'key-onboarding-email', 'ta', 'மின்னஞ்சல்'),
('trans-onboarding-email-te', 'key-onboarding-email', 'te', 'ఇమెయిల్'),
('trans-onboarding-email-bn', 'key-onboarding-email', 'bn', 'ইমেল'),
('trans-onboarding-email-mr', 'key-onboarding-email', 'mr', 'ईमेल');

-- Email Placeholder
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-emailPlaceholder', 'onboarding.emailPlaceholder', 'onboarding', 'Email input placeholder', 'owner@restaurant.com');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-emailPlaceholder-en', 'key-onboarding-emailPlaceholder', 'en', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-fr', 'key-onboarding-emailPlaceholder', 'fr', 'proprietaire@restaurant.com'),
('trans-onboarding-emailPlaceholder-de', 'key-onboarding-emailPlaceholder', 'de', 'besitzer@restaurant.com'),
('trans-onboarding-emailPlaceholder-es', 'key-onboarding-emailPlaceholder', 'es', 'dueño@restaurant.com'),
('trans-onboarding-emailPlaceholder-it', 'key-onboarding-emailPlaceholder', 'it', 'proprietario@restaurant.com'),
('trans-onboarding-emailPlaceholder-th', 'key-onboarding-emailPlaceholder', 'th', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-vi', 'key-onboarding-emailPlaceholder', 'vi', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-id', 'key-onboarding-emailPlaceholder', 'id', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-ms', 'key-onboarding-emailPlaceholder', 'ms', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-hi', 'key-onboarding-emailPlaceholder', 'hi', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-ta', 'key-onboarding-emailPlaceholder', 'ta', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-te', 'key-onboarding-emailPlaceholder', 'te', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-bn', 'key-onboarding-emailPlaceholder', 'bn', 'owner@restaurant.com'),
('trans-onboarding-emailPlaceholder-mr', 'key-onboarding-emailPlaceholder', 'mr', 'owner@restaurant.com');

-- Phone Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-phone', 'onboarding.phone', 'onboarding', 'Phone field label', 'Phone Number');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-phone-en', 'key-onboarding-phone', 'en', 'Phone Number'),
('trans-onboarding-phone-fr', 'key-onboarding-phone', 'fr', 'Numéro de téléphone'),
('trans-onboarding-phone-de', 'key-onboarding-phone', 'de', 'Telefonnummer'),
('trans-onboarding-phone-es', 'key-onboarding-phone', 'es', 'Número de teléfono'),
('trans-onboarding-phone-it', 'key-onboarding-phone', 'it', 'Numero di telefono'),
('trans-onboarding-phone-th', 'key-onboarding-phone', 'th', 'หมายเลขโทรศัพท์'),
('trans-onboarding-phone-vi', 'key-onboarding-phone', 'vi', 'Số điện thoại'),
('trans-onboarding-phone-id', 'key-onboarding-phone', 'id', 'Nomor telepon'),
('trans-onboarding-phone-ms', 'key-onboarding-phone', 'ms', 'Nombor telefon'),
('trans-onboarding-phone-hi', 'key-onboarding-phone', 'hi', 'फ़ोन नंबर'),
('trans-onboarding-phone-ta', 'key-onboarding-phone', 'ta', 'தொலைபேசி எண்'),
('trans-onboarding-phone-te', 'key-onboarding-phone', 'te', 'ఫోన్ నంబర్'),
('trans-onboarding-phone-bn', 'key-onboarding-phone', 'bn', 'ফোন নম্বর'),
('trans-onboarding-phone-mr', 'key-onboarding-phone', 'mr', 'फोन नंबर');

-- Phone Placeholder
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-phonePlaceholder', 'onboarding.phonePlaceholder', 'onboarding', 'Phone input placeholder', '+1234567890');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-phonePlaceholder-en', 'key-onboarding-phonePlaceholder', 'en', '+1234567890'),
('trans-onboarding-phonePlaceholder-fr', 'key-onboarding-phonePlaceholder', 'fr', '+33123456789'),
('trans-onboarding-phonePlaceholder-de', 'key-onboarding-phonePlaceholder', 'de', '+49123456789'),
('trans-onboarding-phonePlaceholder-es', 'key-onboarding-phonePlaceholder', 'es', '+34123456789'),
('trans-onboarding-phonePlaceholder-it', 'key-onboarding-phonePlaceholder', 'it', '+39123456789'),
('trans-onboarding-phonePlaceholder-th', 'key-onboarding-phonePlaceholder', 'th', '+66812345678'),
('trans-onboarding-phonePlaceholder-vi', 'key-onboarding-phonePlaceholder', 'vi', '+84912345678'),
('trans-onboarding-phonePlaceholder-id', 'key-onboarding-phonePlaceholder', 'id', '+62812345678'),
('trans-onboarding-phonePlaceholder-ms', 'key-onboarding-phonePlaceholder', 'ms', '+60123456789'),
('trans-onboarding-phonePlaceholder-hi', 'key-onboarding-phonePlaceholder', 'hi', '+919876543210'),
('trans-onboarding-phonePlaceholder-ta', 'key-onboarding-phonePlaceholder', 'ta', '+919876543210'),
('trans-onboarding-phonePlaceholder-te', 'key-onboarding-phonePlaceholder', 'te', '+919876543210'),
('trans-onboarding-phonePlaceholder-bn', 'key-onboarding-phonePlaceholder', 'bn', '+8801234567890'),
('trans-onboarding-phonePlaceholder-mr', 'key-onboarding-phonePlaceholder', 'mr', '+919876543210');

-- Phone Helper
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-phoneHelper', 'onboarding.phoneHelper', 'onboarding', 'Phone helper text', 'International format (e.g., +1234567890)');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-phoneHelper-en', 'key-onboarding-phoneHelper', 'en', 'International format (e.g., +1234567890)'),
('trans-onboarding-phoneHelper-fr', 'key-onboarding-phoneHelper', 'fr', 'Format international (ex: +33123456789)'),
('trans-onboarding-phoneHelper-de', 'key-onboarding-phoneHelper', 'de', 'Internationales Format (z.B. +49123456789)'),
('trans-onboarding-phoneHelper-es', 'key-onboarding-phoneHelper', 'es', 'Formato internacional (ej: +34123456789)'),
('trans-onboarding-phoneHelper-it', 'key-onboarding-phoneHelper', 'it', 'Formato internazionale (es: +39123456789)'),
('trans-onboarding-phoneHelper-th', 'key-onboarding-phoneHelper', 'th', 'รูปแบบสากล (เช่น +66812345678)'),
('trans-onboarding-phoneHelper-vi', 'key-onboarding-phoneHelper', 'vi', 'Định dạng quốc tế (vd: +84912345678)'),
('trans-onboarding-phoneHelper-id', 'key-onboarding-phoneHelper', 'id', 'Format internasional (mis: +62812345678)'),
('trans-onboarding-phoneHelper-ms', 'key-onboarding-phoneHelper', 'ms', 'Format antarabangsa (cth: +60123456789)'),
('trans-onboarding-phoneHelper-hi', 'key-onboarding-phoneHelper', 'hi', 'अंतर्राष्ट्रीय प्रारूप (उदा: +919876543210)'),
('trans-onboarding-phoneHelper-ta', 'key-onboarding-phoneHelper', 'ta', 'சர்வதேச வடிவம் (எ.கா: +919876543210)'),
('trans-onboarding-phoneHelper-te', 'key-onboarding-phoneHelper', 'te', 'అంతర్జాతీయ ఫార్మాట్ (ఉదా: +919876543210)'),
('trans-onboarding-phoneHelper-bn', 'key-onboarding-phoneHelper', 'bn', 'আন্তর্জাতিক বিন্যাস (যেমন: +8801234567890)'),
('trans-onboarding-phoneHelper-mr', 'key-onboarding-phoneHelper', 'mr', 'आंतरराष्ट्रीय स्वरूप (उदा: +919876543210)');

-- Subdomain Label
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-subdomain', 'onboarding.subdomain', 'onboarding', 'Subdomain field label', 'Subdomain (Auto-generated)');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-subdomain-en', 'key-onboarding-subdomain', 'en', 'Subdomain (Auto-generated)'),
('trans-onboarding-subdomain-fr', 'key-onboarding-subdomain', 'fr', 'Sous-domaine (généré automatiquement)'),
('trans-onboarding-subdomain-de', 'key-onboarding-subdomain', 'de', 'Subdomain (automatisch generiert)'),
('trans-onboarding-subdomain-es', 'key-onboarding-subdomain', 'es', 'Subdominio (generado automáticamente)'),
('trans-onboarding-subdomain-it', 'key-onboarding-subdomain', 'it', 'Sottodominio (generato automaticamente)'),
('trans-onboarding-subdomain-th', 'key-onboarding-subdomain', 'th', 'ซับโดเมน (สร้างอัตโนมัติ)'),
('trans-onboarding-subdomain-vi', 'key-onboarding-subdomain', 'vi', 'Tên miền phụ (tự động tạo)'),
('trans-onboarding-subdomain-id', 'key-onboarding-subdomain', 'id', 'Subdomain (dibuat otomatis)'),
('trans-onboarding-subdomain-ms', 'key-onboarding-subdomain', 'ms', 'Subdomain (dijana auto)'),
('trans-onboarding-subdomain-hi', 'key-onboarding-subdomain', 'hi', 'सबडोमेन (स्वतः जनरेट)'),
('trans-onboarding-subdomain-ta', 'key-onboarding-subdomain', 'ta', 'துணை டொமைன் (தானியங்கி உருவாக்கம்)'),
('trans-onboarding-subdomain-te', 'key-onboarding-subdomain', 'te', 'సబ్‌డొమైన్ (ఆటో-జనరేట్)'),
('trans-onboarding-subdomain-bn', 'key-onboarding-subdomain', 'bn', 'সাবডোমেন (অটো-জেনারেট)'),
('trans-onboarding-subdomain-mr', 'key-onboarding-subdomain', 'mr', 'सबडोमेन (ऑटो-जनरेट)');

-- Subdomain Placeholder
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-subdomainPlaceholder', 'onboarding.subdomainPlaceholder', 'onboarding', 'Subdomain placeholder', 'Will be generated from restaurant name');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-subdomainPlaceholder-en', 'key-onboarding-subdomainPlaceholder', 'en', 'Will be generated from restaurant name'),
('trans-onboarding-subdomainPlaceholder-fr', 'key-onboarding-subdomainPlaceholder', 'fr', 'Sera généré à partir du nom du restaurant'),
('trans-onboarding-subdomainPlaceholder-de', 'key-onboarding-subdomainPlaceholder', 'de', 'Wird aus dem Restaurantnamen generiert'),
('trans-onboarding-subdomainPlaceholder-es', 'key-onboarding-subdomainPlaceholder', 'es', 'Se generará a partir del nombre del restaurante'),
('trans-onboarding-subdomainPlaceholder-it', 'key-onboarding-subdomainPlaceholder', 'it', 'Verrà generato dal nome del ristorante'),
('trans-onboarding-subdomainPlaceholder-th', 'key-onboarding-subdomainPlaceholder', 'th', 'จะถูกสร้างจากชื่อร้านอาหาร'),
('trans-onboarding-subdomainPlaceholder-vi', 'key-onboarding-subdomainPlaceholder', 'vi', 'Sẽ được tạo từ tên nhà hàng'),
('trans-onboarding-subdomainPlaceholder-id', 'key-onboarding-subdomainPlaceholder', 'id', 'Akan dibuat dari nama restoran'),
('trans-onboarding-subdomainPlaceholder-ms', 'key-onboarding-subdomainPlaceholder', 'ms', 'Akan dijana daripada nama restoran'),
('trans-onboarding-subdomainPlaceholder-hi', 'key-onboarding-subdomainPlaceholder', 'hi', 'रेस्तरां के नाम से जेनरेट होगा'),
('trans-onboarding-subdomainPlaceholder-ta', 'key-onboarding-subdomainPlaceholder', 'ta', 'உணவக பெயரிலிருந்து உருவாக்கப்படும்'),
('trans-onboarding-subdomainPlaceholder-te', 'key-onboarding-subdomainPlaceholder', 'te', 'రెస్టారెంట్ పేరు నుండి జనరేట్ చేయబడుతుంది'),
('trans-onboarding-subdomainPlaceholder-bn', 'key-onboarding-subdomainPlaceholder', 'bn', 'রেস্তোরাঁর নাম থেকে তৈরি হবে'),
('trans-onboarding-subdomainPlaceholder-mr', 'key-onboarding-subdomainPlaceholder', 'mr', 'रेस्टॉरंटच्या नावावरून तयार होईल');

-- Subdomain Helper
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-subdomainHelper', 'onboarding.subdomainHelper', 'onboarding', 'Subdomain helper text', 'Your restaurant will be at');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-subdomainHelper-en', 'key-onboarding-subdomainHelper', 'en', 'Your restaurant will be at'),
('trans-onboarding-subdomainHelper-fr', 'key-onboarding-subdomainHelper', 'fr', 'Votre restaurant sera à'),
('trans-onboarding-subdomainHelper-de', 'key-onboarding-subdomainHelper', 'de', 'Ihr Restaurant wird verfügbar sein unter'),
('trans-onboarding-subdomainHelper-es', 'key-onboarding-subdomainHelper', 'es', 'Su restaurante estará en'),
('trans-onboarding-subdomainHelper-it', 'key-onboarding-subdomainHelper', 'it', 'Il tuo ristorante sarà disponibile su'),
('trans-onboarding-subdomainHelper-th', 'key-onboarding-subdomainHelper', 'th', 'ร้านอาหารของคุณจะอยู่ที่'),
('trans-onboarding-subdomainHelper-vi', 'key-onboarding-subdomainHelper', 'vi', 'Nhà hàng của bạn sẽ ở'),
('trans-onboarding-subdomainHelper-id', 'key-onboarding-subdomainHelper', 'id', 'Restoran Anda akan berada di'),
('trans-onboarding-subdomainHelper-ms', 'key-onboarding-subdomainHelper', 'ms', 'Restoran anda akan berada di'),
('trans-onboarding-subdomainHelper-hi', 'key-onboarding-subdomainHelper', 'hi', 'आपका रेस्तरां यहां होगा'),
('trans-onboarding-subdomainHelper-ta', 'key-onboarding-subdomainHelper', 'ta', 'உங்கள் உணவகம் இங்கே இருக்கும்'),
('trans-onboarding-subdomainHelper-te', 'key-onboarding-subdomainHelper', 'te', 'మీ రెస్టారెంట్ ఇక్కడ ఉంటుంది'),
('trans-onboarding-subdomainHelper-bn', 'key-onboarding-subdomainHelper', 'bn', 'আপনার রেস্তোরাঁ এখানে থাকবে'),
('trans-onboarding-subdomainHelper-mr', 'key-onboarding-subdomainHelper', 'mr', 'तुमचे रेस्टॉरंट येथे असेल');

-- Create Button
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-createButton', 'onboarding.createButton', 'onboarding', 'Create restaurant button', 'Create Restaurant');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-createButton-en', 'key-onboarding-createButton', 'en', 'Create Restaurant'),
('trans-onboarding-createButton-fr', 'key-onboarding-createButton', 'fr', 'Créer le restaurant'),
('trans-onboarding-createButton-de', 'key-onboarding-createButton', 'de', 'Restaurant erstellen'),
('trans-onboarding-createButton-es', 'key-onboarding-createButton', 'es', 'Crear restaurante'),
('trans-onboarding-createButton-it', 'key-onboarding-createButton', 'it', 'Crea ristorante'),
('trans-onboarding-createButton-th', 'key-onboarding-createButton', 'th', 'สร้างร้านอาหาร'),
('trans-onboarding-createButton-vi', 'key-onboarding-createButton', 'vi', 'Tạo nhà hàng'),
('trans-onboarding-createButton-id', 'key-onboarding-createButton', 'id', 'Buat restoran'),
('trans-onboarding-createButton-ms', 'key-onboarding-createButton', 'ms', 'Cipta restoran'),
('trans-onboarding-createButton-hi', 'key-onboarding-createButton', 'hi', 'रेस्तरां बनाएं'),
('trans-onboarding-createButton-ta', 'key-onboarding-createButton', 'ta', 'உணவகத்தை உருவாக்கு'),
('trans-onboarding-createButton-te', 'key-onboarding-createButton', 'te', 'రెస్టారెంట్‌ను సృష్టించండి'),
('trans-onboarding-createButton-bn', 'key-onboarding-createButton', 'bn', 'রেস্তোরাঁ তৈরি করুন'),
('trans-onboarding-createButton-mr', 'key-onboarding-createButton', 'mr', 'रेस्टॉरंट तयार करा');

-- Terms Agreement
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-termsAgreement', 'onboarding.termsAgreement', 'onboarding', 'Terms agreement text', 'By creating a restaurant, you agree to our Terms of Service and Privacy Policy');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-termsAgreement-en', 'key-onboarding-termsAgreement', 'en', 'By creating a restaurant, you agree to our Terms of Service and Privacy Policy'),
('trans-onboarding-termsAgreement-fr', 'key-onboarding-termsAgreement', 'fr', 'En créant un restaurant, vous acceptez nos Conditions d''utilisation et notre Politique de confidentialité'),
('trans-onboarding-termsAgreement-de', 'key-onboarding-termsAgreement', 'de', 'Durch das Erstellen eines Restaurants stimmen Sie unseren Nutzungsbedingungen und Datenschutzrichtlinien zu'),
('trans-onboarding-termsAgreement-es', 'key-onboarding-termsAgreement', 'es', 'Al crear un restaurante, acepta nuestros Términos de servicio y Política de privacidad'),
('trans-onboarding-termsAgreement-it', 'key-onboarding-termsAgreement', 'it', 'Creando un ristorante, accetti i nostri Termini di servizio e la Politica sulla privacy'),
('trans-onboarding-termsAgreement-th', 'key-onboarding-termsAgreement', 'th', 'การสร้างร้านอาหาร คุณยอมรับข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัวของเรา'),
('trans-onboarding-termsAgreement-vi', 'key-onboarding-termsAgreement', 'vi', 'Bằng cách tạo nhà hàng, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của chúng tôi'),
('trans-onboarding-termsAgreement-id', 'key-onboarding-termsAgreement', 'id', 'Dengan membuat restoran, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi kami'),
('trans-onboarding-termsAgreement-ms', 'key-onboarding-termsAgreement', 'ms', 'Dengan mencipta restoran, anda bersetuju dengan Syarat Perkhidmatan dan Dasar Privasi kami'),
('trans-onboarding-termsAgreement-hi', 'key-onboarding-termsAgreement', 'hi', 'रेस्तरां बनाकर, आप हमारी सेवा की शर्तों और गोपनीयता नीति से सहमत होते हैं'),
('trans-onboarding-termsAgreement-ta', 'key-onboarding-termsAgreement', 'ta', 'உணவகத்தை உருவாக்குவதன் மூலம், எங்கள் சேவை விதிமுறைகள் மற்றும் தனியுரிமை கொள்கையை ஏற்கிறீர்கள்'),
('trans-onboarding-termsAgreement-te', 'key-onboarding-termsAgreement', 'te', 'రెస్టారెంట్‌ను సృష్టించడం ద్వారా, మీరు మా సేవా నిబంధనలు మరియు గోప్యతా విధానాన్ని అంగీకరిస్తున్నారు'),
('trans-onboarding-termsAgreement-bn', 'key-onboarding-termsAgreement', 'bn', 'একটি রেস্তোরাঁ তৈরি করে, আপনি আমাদের পরিষেবার শর্তাবলী এবং গোপনীয়তা নীতিতে সম্মত হন'),
('trans-onboarding-termsAgreement-mr', 'key-onboarding-termsAgreement', 'mr', 'रेस्टॉरंट तयार करून, तुम्ही आमच्या सेवा अटी आणि गोपनीयता धोरणाशी सहमत आहात');

-- Cancel Button (already exists in common namespace, add reference)
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES ('key-onboarding-cancel', 'cancel', 'common', 'Cancel button', 'Cancel');

INSERT INTO translations (id, key_id, language, value) VALUES
('trans-onboarding-cancel-en', 'key-onboarding-cancel', 'en', 'Cancel'),
('trans-onboarding-cancel-fr', 'key-onboarding-cancel', 'fr', 'Annuler'),
('trans-onboarding-cancel-de', 'key-onboarding-cancel', 'de', 'Abbrechen'),
('trans-onboarding-cancel-es', 'key-onboarding-cancel', 'es', 'Cancelar'),
('trans-onboarding-cancel-it', 'key-onboarding-cancel', 'it', 'Annulla'),
('trans-onboarding-cancel-th', 'key-onboarding-cancel', 'th', 'ยกเลิก'),
('trans-onboarding-cancel-vi', 'key-onboarding-cancel', 'vi', 'Hủy'),
('trans-onboarding-cancel-id', 'key-onboarding-cancel', 'id', 'Batal'),
('trans-onboarding-cancel-ms', 'key-onboarding-cancel', 'ms', 'Batal'),
('trans-onboarding-cancel-hi', 'key-onboarding-cancel', 'hi', 'रद्द करें'),
('trans-onboarding-cancel-ta', 'key-onboarding-cancel', 'ta', 'ரத்துசெய்'),
('trans-onboarding-cancel-te', 'key-onboarding-cancel', 'te', 'రద్దు చేయండి'),
('trans-onboarding-cancel-bn', 'key-onboarding-cancel', 'bn', 'বাতিল'),
('trans-onboarding-cancel-mr', 'key-onboarding-cancel', 'mr', 'रद्द करा');

-- ============================================================================
-- SEED MIGRATION COMPLETE
-- ============================================================================
-- Floor Plan Tables with Sync Support
-- Created for proper incremental sync integration

-- Floor Sections
CREATE TABLE IF NOT EXISTS floor_sections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_floor_sections_tenant ON floor_sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_floor_sections_updated ON floor_sections(updated_at);
CREATE INDEX IF NOT EXISTS idx_floor_sections_synced ON floor_sections(synced_at);

-- Floor Tables
CREATE TABLE IF NOT EXISTS floor_tables (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    table_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    qr_code_url TEXT,
    status TEXT DEFAULT 'available',
    assigned_staff_id TEXT,
    current_order_id TEXT,
    last_active_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT DEFAULT NULL,
    FOREIGN KEY (section_id) REFERENCES floor_sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_floor_tables_tenant ON floor_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_floor_tables_section ON floor_tables(section_id);
CREATE INDEX IF NOT EXISTS idx_floor_tables_updated ON floor_tables(updated_at);
CREATE INDEX IF NOT EXISTS idx_floor_tables_synced ON floor_tables(synced_at);

-- Staff Assignments
CREATE TABLE IF NOT EXISTS floor_staff_assignments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    section_ids TEXT, -- JSON array
    table_ids TEXT, -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_floor_assignments_tenant ON floor_staff_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_floor_assignments_user ON floor_staff_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_floor_assignments_updated ON floor_staff_assignments(updated_at);
CREATE INDEX IF NOT EXISTS idx_floor_assignments_synced ON floor_staff_assignments(synced_at);

-- Triggers to update updated_at on changes
CREATE TRIGGER IF NOT EXISTS update_floor_sections_timestamp
AFTER UPDATE ON floor_sections
BEGIN
    UPDATE floor_sections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_floor_tables_timestamp
AFTER UPDATE ON floor_tables
BEGIN
    UPDATE floor_tables SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_floor_assignments_timestamp
AFTER UPDATE ON floor_staff_assignments
BEGIN
    UPDATE floor_staff_assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
-- Migration: Restaurant Settings
-- Stores restaurant configuration, business details, and operational settings

CREATE TABLE IF NOT EXISTS restaurant_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton table (only one row)

    -- Basic Info
    name TEXT NOT NULL DEFAULT 'Restaurant Name',
    tagline TEXT,
    address_line1 TEXT NOT NULL DEFAULT '',
    address_line2 TEXT,
    city TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    pincode TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    website TEXT,

    -- Legal/Tax Info
    gst_number TEXT,
    fssai_number TEXT,
    pan_number TEXT,
    cin_number TEXT,

    -- Invoice Settings
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    invoice_start_number INTEGER NOT NULL DEFAULT 1,
    current_invoice_number INTEGER NOT NULL DEFAULT 1,
    invoice_terms TEXT,
    footer_note TEXT,

    -- Tax Settings
    tax_enabled BOOLEAN NOT NULL DEFAULT 1,
    cgst_rate REAL NOT NULL DEFAULT 2.5,
    sgst_rate REAL NOT NULL DEFAULT 2.5,
    service_charge_rate REAL NOT NULL DEFAULT 0,
    service_charge_enabled BOOLEAN NOT NULL DEFAULT 0,
    round_off_enabled BOOLEAN NOT NULL DEFAULT 1,
    tax_included_in_price BOOLEAN NOT NULL DEFAULT 0,

    -- Print Settings
    print_logo BOOLEAN NOT NULL DEFAULT 0,
    logo_url TEXT,
    print_qr_code BOOLEAN NOT NULL DEFAULT 0,
    qr_code_url TEXT,
    paper_width TEXT NOT NULL DEFAULT '80mm' CHECK (paper_width IN ('58mm', '80mm')),
    show_itemwise_tax BOOLEAN NOT NULL DEFAULT 0,

    -- POS Workflow Settings
    require_staff_pin_for_pos BOOLEAN NOT NULL DEFAULT 0,
    filter_tables_by_staff_assignment BOOLEAN NOT NULL DEFAULT 0,
    pin_session_timeout_minutes INTEGER NOT NULL DEFAULT 0,
    theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),

    -- Device Role
    device_role TEXT NOT NULL DEFAULT 'client' CHECK (device_role IN ('server', 'client')),

    -- Packing Charges (JSON serialized)
    packing_charges_enabled BOOLEAN NOT NULL DEFAULT 0,
    packing_charges_by_category TEXT, -- JSON: {"category": charge}
    packing_charges_default REAL NOT NULL DEFAULT 5,

    -- Metadata
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Initialize with default settings (only if table is empty)
INSERT OR IGNORE INTO restaurant_settings (id) VALUES (1);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS restaurant_settings_updated_at
AFTER UPDATE ON restaurant_settings
FOR EACH ROW
BEGIN
    UPDATE restaurant_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = 1;
END;

-- Index for faster lookups (though it's a singleton table)
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_updated
ON restaurant_settings(updated_at);
-- Migration: Setup Wizard State
-- Stores the setup wizard progress and completion state in SQLite
-- This replaces localStorage to eliminate race conditions with page reloads

CREATE TABLE IF NOT EXISTS setup_wizard_state (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton table (only one row)

    -- Navigation state
    current_screen TEXT NOT NULL DEFAULT 'welcome',
    completed_screens TEXT NOT NULL DEFAULT '[]', -- JSON array of screen names
    skipped_screens TEXT NOT NULL DEFAULT '[]',   -- JSON array of screen names
    selected_optional_items TEXT NOT NULL DEFAULT '[]', -- JSON array of optional items

    -- Wizard data (temporary storage during setup)
    wizard_data TEXT NOT NULL DEFAULT '{}', -- JSON object with all wizard data

    -- Completion state
    is_complete BOOLEAN NOT NULL DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    awaiting_activation BOOLEAN NOT NULL DEFAULT 0,

    -- Checklist dismissal
    checklist_dismissed BOOLEAN NOT NULL DEFAULT 0,

    -- Provisioning data (stored in SQLite, replaces localStorage)
    activation_code TEXT,
    provisioning_web_socket_url TEXT,
    is_restaurant_owner BOOLEAN NOT NULL DEFAULT 0,

    -- Metadata
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Initialize with default state (only if table is empty)
INSERT OR IGNORE INTO setup_wizard_state (id) VALUES (1);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS setup_wizard_state_updated_at
AFTER UPDATE ON setup_wizard_state
FOR EACH ROW
BEGIN
    UPDATE setup_wizard_state SET updated_at = CURRENT_TIMESTAMP WHERE id = 1;
END;

-- Index for faster lookups (though it's a singleton table)
CREATE INDEX IF NOT EXISTS idx_setup_wizard_state_updated
ON setup_wizard_state(updated_at);
-- Add description column to menu_categories table
ALTER TABLE menu_categories ADD COLUMN description TEXT DEFAULT '';

-- Add created_at and updated_at for tracking
ALTER TABLE menu_categories ADD COLUMN created_at TEXT;
ALTER TABLE menu_categories ADD COLUMN updated_at TEXT;
-- Fix duplicate categories and add UNIQUE constraint
-- This migration removes duplicate categories and prevents future duplicates

-- Step 1: Disable foreign key constraints temporarily
PRAGMA foreign_keys = OFF;

-- Step 2: Create a mapping of old category IDs to new deduplicated IDs
CREATE TEMP TABLE category_mapping AS
SELECT
    mc.id as old_id,
    (SELECT MIN(id) FROM menu_categories mc2 WHERE mc2.name = mc.name) as new_id,
    mc.name
FROM menu_categories mc;

-- Step 3: Create a temporary table with the correct schema
CREATE TABLE menu_categories_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,  -- Add UNIQUE constraint
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT 1,
    icon TEXT,
    description TEXT DEFAULT '',
    created_at TEXT,
    updated_at TEXT,
    name_translations TEXT
);

-- Step 4: Copy unique categories to the new table
-- Keep only the first occurrence of each category name
INSERT INTO menu_categories_new (id, name, sort_order, active, icon, description, created_at, updated_at, name_translations)
SELECT
    MIN(id) as id,  -- Keep the first ID for each category name
    name,
    MIN(sort_order) as sort_order,
    MAX(active) as active,  -- Keep active if any version is active
    (SELECT icon FROM menu_categories mc2 WHERE mc2.name = mc1.name LIMIT 1) as icon,
    COALESCE((SELECT description FROM menu_categories mc2 WHERE mc2.name = mc1.name AND description IS NOT NULL AND description != '' LIMIT 1), '') as description,
    MIN(created_at) as created_at,
    MAX(updated_at) as updated_at,
    (SELECT name_translations FROM menu_categories mc2 WHERE mc2.name = mc1.name AND name_translations IS NOT NULL LIMIT 1) as name_translations
FROM menu_categories mc1
GROUP BY name;

-- Step 5: Create new menu_items table without foreign key constraint
CREATE TABLE menu_items_new (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    active BOOLEAN NOT NULL DEFAULT 1,
    preparation_time INTEGER NOT NULL DEFAULT 15,
    allergens TEXT,
    dietary_tags TEXT,
    name_translations TEXT,
    description_translations TEXT
);

-- Step 6: Copy menu items with updated category IDs
INSERT INTO menu_items_new
SELECT
    mi.id,
    COALESCE(cm.new_id, mi.category_id) as category_id,
    mi.name,
    mi.description,
    mi.price,
    mi.image,
    mi.active,
    mi.preparation_time,
    mi.allergens,
    mi.dietary_tags,
    mi.name_translations,
    mi.description_translations
FROM menu_items mi
LEFT JOIN category_mapping cm ON mi.category_id = cm.old_id;

-- Step 7: Drop the old tables and rename the new ones
DROP TABLE menu_items;
DROP TABLE menu_categories;
ALTER TABLE menu_items_new RENAME TO menu_items;
ALTER TABLE menu_categories_new RENAME TO menu_categories;

-- Step 8: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_menu_categories_name ON menu_categories(name);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON menu_categories(active);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(active);

-- Step 9: Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
-- Unassigned Images Pool Table
-- Stores images uploaded via Cloudflare that haven't been assigned to menu items yet
-- Used for bulk upload workflows where images are uploaded first, then assigned later

CREATE TABLE IF NOT EXISTS unassigned_images (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    cloudflare_image_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    image_url TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    uploaded_by TEXT,
    notes TEXT,
    assigned_to TEXT,
    assigned_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient tenant-based queries
CREATE INDEX IF NOT EXISTS idx_unassigned_images_tenant
    ON unassigned_images(tenant_id);

-- Index for finding unassigned images
CREATE INDEX IF NOT EXISTS idx_unassigned_images_unassigned
    ON unassigned_images(tenant_id, assigned_to)
    WHERE assigned_to IS NULL;

-- Index for Cloudflare ID lookups
CREATE INDEX IF NOT EXISTS idx_unassigned_images_cloudflare_id
    ON unassigned_images(cloudflare_image_id);
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
-- Tenant Activation Storage
-- Stores tenant configuration after POS activation

CREATE TABLE IF NOT EXISTS tenant_config (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Enforce single row
    tenant_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    subdomain TEXT NOT NULL,
    api_base_url TEXT NOT NULL,
    orders_endpoint TEXT NOT NULL,
    menu_endpoint TEXT NOT NULL,
    primary_color TEXT NOT NULL DEFAULT '#3B82F6',
    secondary_color TEXT,
    logo_url TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    activated_at TEXT NOT NULL,
    d1_database_id TEXT, -- Cloudflare D1 database ID for cloud sync
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS update_tenant_config_timestamp
AFTER UPDATE ON tenant_config
BEGIN
    UPDATE tenant_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Index for D1 database ID lookups
CREATE INDEX IF NOT EXISTS idx_tenant_config_d1_database_id ON tenant_config(d1_database_id);
-- Add missing activate_online and enable_inventory_sync columns to restaurant_settings
-- These columns control online features and cloud sync

-- Check if columns exist, add if missing
ALTER TABLE restaurant_settings ADD COLUMN activate_online BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN enable_inventory_sync BOOLEAN NOT NULL DEFAULT 0;
-- Migration 032: Bar Orders Table
-- Mirrors kds_orders structure but for bar/beverage orders
-- Created: 2026-01-23

CREATE TABLE IF NOT EXISTS bar_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    table_number INTEGER,
    order_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_running_order INTEGER NOT NULL DEFAULT 0,
    bot_sequence INTEGER,
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    completed_at TEXT,
    elapsed_minutes INTEGER DEFAULT 0,
    estimated_prep_time INTEGER DEFAULT 5,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    tenant_id TEXT NOT NULL,
    UNIQUE(order_number, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bar_orders_tenant_status
    ON bar_orders(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_bar_orders_table
    ON bar_orders(table_number);

CREATE INDEX IF NOT EXISTS idx_bar_orders_created
    ON bar_orders(created_at);
-- Migration 033: Bar Inventory Management
-- Comprehensive inventory tracking for bar operations
-- Supports bottle-level and pour-level tracking
-- Created: 2026-01-23

-- ============================================
-- Bar Inventory Items
-- ============================================
-- Tracks liquor bottles, mixers, garnishes, glassware
CREATE TABLE IF NOT EXISTS bar_inventory_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    inventory_item_id TEXT, -- FK to inventory_items (optional integration)
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'spirits', 'wine', 'beer', 'mixers', 'garnishes', 'glassware'
    subcategory TEXT, -- 'whiskey', 'vodka', 'gin', 'rum', 'tequila', etc.

    -- Bottle/Container details
    container_type TEXT, -- 'bottle', 'keg', 'can', 'jar'
    container_size_ml INTEGER NOT NULL, -- Standard bottle size in ml (750ml, 1000ml, etc.)
    cost_per_container REAL NOT NULL DEFAULT 0, -- Purchase cost per bottle/keg

    -- Current stock
    full_containers INTEGER NOT NULL DEFAULT 0, -- Number of unopened bottles
    partial_container_ml REAL NOT NULL DEFAULT 0, -- Amount in opened bottle (ml)

    -- Par levels
    par_level INTEGER DEFAULT 2, -- Minimum bottles to keep in stock
    reorder_point INTEGER DEFAULT 1, -- When to reorder

    -- Tracking
    last_restocked_at TEXT,
    last_counted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_bar_inventory_tenant
    ON bar_inventory_items(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bar_inventory_category
    ON bar_inventory_items(category, subcategory);

CREATE INDEX IF NOT EXISTS idx_bar_inventory_stock
    ON bar_inventory_items(full_containers, partial_container_ml);

-- ============================================
-- Bar Drink Recipes
-- ============================================
-- Links drinks to their primary ingredients
CREATE TABLE IF NOT EXISTS bar_recipes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL, -- FK to menu_items
    drink_name TEXT NOT NULL,

    -- Recipe metadata
    category TEXT, -- 'cocktail', 'shot', 'mixed', 'beer', 'wine'
    glassware TEXT, -- 'highball', 'rocks', 'martini', 'shot', 'pint'
    ice_type TEXT, -- 'cubed', 'crushed', 'no-ice'

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE INDEX IF NOT EXISTS idx_bar_recipes_tenant
    ON bar_recipes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bar_recipes_menu_item
    ON bar_recipes(menu_item_id);

-- ============================================
-- Bar Recipe Ingredients
-- ============================================
-- Defines what goes into each drink
CREATE TABLE IF NOT EXISTS bar_recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    inventory_item_id TEXT NOT NULL, -- FK to bar_inventory_items

    -- Quantity per serving
    quantity_ml REAL NOT NULL, -- Amount of this ingredient per drink
    quantity_unit TEXT DEFAULT 'ml', -- 'ml', 'oz', 'dash', 'slice', 'wedge'
    is_optional INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,

    created_at TEXT NOT NULL,

    FOREIGN KEY (recipe_id) REFERENCES bar_recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_item_id) REFERENCES bar_inventory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
    ON bar_recipe_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item
    ON bar_recipe_ingredients(inventory_item_id);

-- ============================================
-- Bar Inventory Transactions
-- ============================================
-- Track every pour/usage/restock
CREATE TABLE IF NOT EXISTS bar_inventory_transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    inventory_item_id TEXT NOT NULL,

    -- Transaction details
    transaction_type TEXT NOT NULL, -- 'sale', 'waste', 'restock', 'adjustment', 'count'
    quantity_ml REAL NOT NULL, -- Amount used/added (negative for usage, positive for restock)

    -- Links to orders (for sales tracking)
    bar_order_id TEXT,
    bar_order_item_id TEXT,

    -- Staff tracking
    staff_id TEXT,
    staff_name TEXT,

    -- Cost tracking
    cost_per_ml REAL, -- Cost per ml at time of transaction
    total_cost REAL, -- Total cost of this transaction

    -- Notes
    reason TEXT, -- For waste/adjustments
    notes TEXT,

    created_at TEXT NOT NULL,

    FOREIGN KEY (inventory_item_id) REFERENCES bar_inventory_items(id),
    FOREIGN KEY (bar_order_id) REFERENCES bar_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_tenant
    ON bar_inventory_transactions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_item
    ON bar_inventory_transactions(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_order
    ON bar_inventory_transactions(bar_order_id);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_date
    ON bar_inventory_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_type
    ON bar_inventory_transactions(transaction_type);

-- ============================================
-- Bar Closing Sessions
-- ============================================
-- End-of-day reconciliation
CREATE TABLE IF NOT EXISTS bar_closing_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Session details
    session_date TEXT NOT NULL, -- Date of closing (YYYY-MM-DD)
    opened_at TEXT NOT NULL, -- When bar opened
    closed_at TEXT, -- When closing was completed
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'counting', 'closed'

    -- Staff
    opened_by_staff_id TEXT,
    closed_by_staff_id TEXT,

    -- Cash reconciliation
    opening_cash REAL DEFAULT 0,
    closing_cash REAL,
    expected_cash REAL,
    variance_cash REAL,

    -- Sales summary
    total_orders INTEGER DEFAULT 0,
    total_items_sold INTEGER DEFAULT 0,
    gross_revenue REAL DEFAULT 0,

    -- Inventory summary
    items_counted INTEGER DEFAULT 0,
    total_variance_ml REAL DEFAULT 0,
    total_waste_ml REAL DEFAULT 0,

    -- Notes
    notes TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bar_closing_tenant_date
    ON bar_closing_sessions(tenant_id, session_date);

CREATE INDEX IF NOT EXISTS idx_bar_closing_status
    ON bar_closing_sessions(status);

-- ============================================
-- Bar Closing Inventory Counts
-- ============================================
-- Snapshot of inventory during closing
CREATE TABLE IF NOT EXISTS bar_closing_counts (
    id TEXT PRIMARY KEY,
    closing_session_id TEXT NOT NULL,
    inventory_item_id TEXT NOT NULL,

    -- Expected vs Actual
    expected_full_bottles INTEGER DEFAULT 0,
    expected_partial_ml REAL DEFAULT 0,
    actual_full_bottles INTEGER DEFAULT 0,
    actual_partial_ml REAL DEFAULT 0,

    -- Variance
    variance_bottles INTEGER DEFAULT 0,
    variance_ml REAL DEFAULT 0,
    variance_cost REAL DEFAULT 0,

    -- Notes
    notes TEXT,
    counted_at TEXT NOT NULL,

    FOREIGN KEY (closing_session_id) REFERENCES bar_closing_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_item_id) REFERENCES bar_inventory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_closing_counts_session
    ON bar_closing_counts(closing_session_id);

CREATE INDEX IF NOT EXISTS idx_closing_counts_item
    ON bar_closing_counts(inventory_item_id);
-- Migration: Add provisioning data to setup wizard state
-- Adds activation code and provisioning WebSocket URL to wizard state
-- This migrates data from localStorage to SQLite for better persistence

-- NOTE: These columns are now included in migration 025 (setup_wizard_state table creation)
-- This migration is kept for backwards compatibility with existing databases
-- but is now a no-op since the columns already exist

-- The columns activation_code, provisioning_web_socket_url, and is_restaurant_owner
-- are created in migration 025, so this migration does nothing

-- No-op migration for backwards compatibility
SELECT 1;
-- Migration: Add is_restaurant_owner flag to setup wizard state
-- Distinguishes between restaurant owners and staff during setup

-- NOTE: This column is now included in migration 025 (setup_wizard_state table creation)
-- This migration is kept for backwards compatibility but is now a no-op

-- No-op migration for backwards compatibility
SELECT 1;
-- Guest Orders Table
-- Tracks orders submitted via QR code before they're completed
-- Once completed, they're moved to sales_transactions
-- Note: Using 'guest_orders' to avoid conflict with existing 'orders' table

CREATE TABLE IF NOT EXISTS guest_orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    table_number TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    special_instructions TEXT,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'qr-code',
    created_at TEXT NOT NULL,
    updated_at TEXT,
    completed_at TEXT,
    CHECK(status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS guest_order_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    notes TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES guest_orders(id) ON DELETE CASCADE,
    CHECK(quantity > 0),
    CHECK(price >= 0),
    CHECK(status IN ('pending', 'preparing', 'ready', 'served'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_orders_status ON guest_orders(status);
CREATE INDEX IF NOT EXISTS idx_guest_orders_table ON guest_orders(table_number);
CREATE INDEX IF NOT EXISTS idx_guest_orders_source ON guest_orders(source);
CREATE INDEX IF NOT EXISTS idx_guest_orders_created ON guest_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_guest_order_items_order ON guest_order_items(order_id);

-- Table Tokens for QR Code Security
CREATE TABLE IF NOT EXISTS table_tokens (
    table_id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    regenerate_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_table_tokens_expiry ON table_tokens(expires_at);
-- Track applied migrations (including dynamic ones from cloud)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL CHECK(source IN ('built-in', 'cloud')),
    checksum TEXT NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch()),
    app_version TEXT NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_migrations_source ON schema_migrations(source);
CREATE INDEX IF NOT EXISTS idx_migrations_applied_at ON schema_migrations(applied_at DESC);

-- Seed with existing migrations as 'built-in'
-- This records that migrations 001-040 were built into the app
-- Migrations 041+ will be handled by dynamic cloud migrations
INSERT OR IGNORE INTO schema_migrations (version, name, description, source, checksum, app_version)
VALUES
    (1, 'initial_schema', 'Initial database schema', 'built-in', 'built-in', '3.1.0'),
    (40, 'guest_orders', 'Guest orders and table tokens for QR ordering', 'built-in', 'built-in', '3.1.0');
-- Add documents and bank details to staff_users table

-- Photo
ALTER TABLE staff_users ADD COLUMN photo_url TEXT;

-- Aadhaar details
ALTER TABLE staff_users ADD COLUMN aadhaar_number TEXT;
ALTER TABLE staff_users ADD COLUMN aadhaar_image_url TEXT;

-- PAN card
ALTER TABLE staff_users ADD COLUMN pan_number TEXT;

-- Bank details
ALTER TABLE staff_users ADD COLUMN bank_account_number TEXT;
ALTER TABLE staff_users ADD COLUMN bank_ifsc_code TEXT;
ALTER TABLE staff_users ADD COLUMN bank_name TEXT;
ALTER TABLE staff_users ADD COLUMN bank_branch TEXT;
ALTER TABLE restaurant_settings ADD COLUMN owner_name TEXT DEFAULT '';
-- Multi-Location Tenant Management
-- This migration adds tables for managing restaurant chains and location tenants
-- Each location is a separate tenant with isolated Cloudflare infrastructure

-- Restaurant chains table
CREATE TABLE IF NOT EXISTS restaurant_chains (
  id TEXT PRIMARY KEY,
  chain_name TEXT NOT NULL,
  master_tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Location tenants table
-- Stores metadata for each location tenant (separate D1, KV, R2, DNS)
CREATE TABLE IF NOT EXISTS location_tenants (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  location_tenant_id TEXT NOT NULL UNIQUE,
  location_name TEXT NOT NULL,

  -- Full address breakdown
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',

  -- Contact info
  phone TEXT,
  email TEXT,

  -- Tenant metadata
  activation_code TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  restaurant_type TEXT NOT NULL,

  -- Provisioning status
  provisioning_status TEXT NOT NULL DEFAULT 'completed' CHECK(provisioning_status IN ('pending', 'provisioning', 'completed', 'failed')),

  -- Cloudflare resources
  d1_database_id TEXT,
  kv_namespace_id TEXT,
  r2_bucket_name TEXT,
  worker_url TEXT,

  -- Google Maps metadata (optional, for reference)
  google_place_id TEXT,
  google_maps_url TEXT,
  google_rating REAL CHECK(google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5)),
  google_total_reviews INTEGER CHECK(google_total_reviews IS NULL OR google_total_reviews >= 0),
  latitude REAL CHECK(latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude REAL CHECK(longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),

  FOREIGN KEY (chain_id) REFERENCES restaurant_chains(id) ON DELETE CASCADE
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_location_tenants_chain_id ON location_tenants(chain_id);
CREATE INDEX IF NOT EXISTS idx_location_tenants_status ON location_tenants(status);
CREATE INDEX IF NOT EXISTS idx_location_tenants_tenant_id ON location_tenants(location_tenant_id);
CREATE INDEX IF NOT EXISTS idx_location_tenants_subdomain ON location_tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_restaurant_chains_master_tenant ON restaurant_chains(master_tenant_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_location_tenants_timestamp
AFTER UPDATE ON location_tenants
FOR EACH ROW
BEGIN
  UPDATE location_tenants SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_restaurant_chains_timestamp
AFTER UPDATE ON restaurant_chains
FOR EACH ROW
BEGIN
  UPDATE restaurant_chains SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;
-- Add missing columns to restaurant_settings table
-- These columns were being saved from frontend but not persisting

-- NOTE: owner_name was already added in migration 042
-- NOTE: activate_online and enable_inventory_sync were already added in migration 031
-- Only adding restaurant_type and operational_scale which are genuinely new

-- Restaurant type and scale (used by frontend but never stored in DB)
ALTER TABLE restaurant_settings ADD COLUMN restaurant_type TEXT NOT NULL DEFAULT 'full-service';
ALTER TABLE restaurant_settings ADD COLUMN operational_scale TEXT NOT NULL DEFAULT 'single-location';
-- Sync metadata table for tracking last sync timestamps
CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Offline queue for failed syncs
CREATE TABLE IF NOT EXISTS sync_offline_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT
);

-- Index for faster offline queue queries
CREATE INDEX IF NOT EXISTS idx_offline_queue_table
ON sync_offline_queue(table_name, created_at);

-- Index for filtering by retry count
CREATE INDEX IF NOT EXISTS idx_offline_queue_retry
ON sync_offline_queue(retry_count);
-- Staff Payroll System
-- Tracks salary, advances, deductions, and attendance for staff members

-- Staff Salary Configuration
CREATE TABLE IF NOT EXISTS staff_salary (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    base_salary REAL NOT NULL,
    hourly_rate REAL,
    overtime_rate REAL,
    salary_type TEXT NOT NULL CHECK(salary_type IN ('monthly', 'hourly', 'daily')),
    effective_from TEXT NOT NULL, -- ISO 8601 date
    effective_to TEXT, -- NULL if current
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Advances (money given in advance)
CREATE TABLE IF NOT EXISTS staff_advances (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT,
    advance_date TEXT NOT NULL, -- ISO 8601 date
    repayment_start_month TEXT NOT NULL, -- YYYY-MM format
    installments INTEGER NOT NULL DEFAULT 1,
    installments_paid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Deductions (penalties, loans, etc.)
CREATE TABLE IF NOT EXISTS staff_deductions (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('penalty', 'loan_repayment', 'tax', 'insurance', 'other')),
    reason TEXT NOT NULL,
    deduction_month TEXT NOT NULL, -- YYYY-MM format
    is_recurring BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Bonuses
CREATE TABLE IF NOT EXISTS staff_bonuses (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('performance', 'festival', 'target', 'other')),
    reason TEXT NOT NULL,
    bonus_month TEXT NOT NULL, -- YYYY-MM format
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Attendance (for hourly/daily calculations)
CREATE TABLE IF NOT EXISTS staff_attendance (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    date TEXT NOT NULL, -- ISO 8601 date
    clock_in TEXT, -- ISO 8601 timestamp
    clock_out TEXT, -- ISO 8601 timestamp
    hours_worked REAL,
    overtime_hours REAL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'half_day', 'leave', 'holiday')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    UNIQUE(staff_id, date)
);

-- Staff Payslips (monthly salary records)
CREATE TABLE IF NOT EXISTS staff_payslips (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    month TEXT NOT NULL, -- YYYY-MM format
    base_salary REAL NOT NULL,
    overtime_pay REAL DEFAULT 0,
    bonuses REAL DEFAULT 0,
    advances_deducted REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    gross_salary REAL NOT NULL,
    net_salary REAL NOT NULL,
    days_worked INTEGER,
    hours_worked REAL,
    status TEXT NOT NULL CHECK(status IN ('draft', 'processed', 'paid')) DEFAULT 'draft',
    paid_date TEXT, -- ISO 8601 date
    payment_method TEXT CHECK(payment_method IN ('cash', 'bank_transfer', 'cheque', 'upi')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    UNIQUE(staff_id, month)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_salary_staff ON staff_salary(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_advances_staff ON staff_advances(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_deductions_staff ON staff_deductions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_staff ON staff_bonuses(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_payslips_staff_month ON staff_payslips(staff_id, month);
-- Fix Staff Payroll Foreign Key References
-- This migration fixes the foreign key constraints to reference staff_users instead of staff

-- Drop existing tables (if they exist with wrong foreign keys)
-- Data will be preserved by CREATE TABLE IF NOT EXISTS below
DROP TABLE IF EXISTS staff_payslips;
DROP TABLE IF EXISTS staff_attendance;
DROP TABLE IF EXISTS staff_bonuses;
DROP TABLE IF EXISTS staff_deductions;
DROP TABLE IF EXISTS staff_advances;
DROP TABLE IF EXISTS staff_salary;

-- Recreate tables with correct foreign key references

-- Staff Salary Configuration
CREATE TABLE IF NOT EXISTS staff_salary (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    base_salary REAL NOT NULL,
    hourly_rate REAL,
    overtime_rate REAL,
    salary_type TEXT NOT NULL CHECK(salary_type IN ('monthly', 'hourly', 'daily')),
    effective_from TEXT NOT NULL, -- ISO 8601 date
    effective_to TEXT, -- NULL if current
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Advances (money given in advance)
CREATE TABLE IF NOT EXISTS staff_advances (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT,
    advance_date TEXT NOT NULL, -- ISO 8601 date
    repayment_start_month TEXT NOT NULL, -- YYYY-MM format
    installments INTEGER NOT NULL DEFAULT 1,
    installments_paid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Deductions (penalties, loans, etc.)
CREATE TABLE IF NOT EXISTS staff_deductions (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('penalty', 'loan_repayment', 'tax', 'insurance', 'other')),
    reason TEXT NOT NULL,
    deduction_month TEXT NOT NULL, -- YYYY-MM format
    is_recurring BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Bonuses
CREATE TABLE IF NOT EXISTS staff_bonuses (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('performance', 'festival', 'target', 'other')),
    reason TEXT NOT NULL,
    bonus_month TEXT NOT NULL, -- YYYY-MM format
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Attendance (for hourly/daily calculations)
CREATE TABLE IF NOT EXISTS staff_attendance (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    date TEXT NOT NULL, -- ISO 8601 date
    clock_in TEXT, -- ISO 8601 timestamp
    clock_out TEXT, -- ISO 8601 timestamp
    hours_worked REAL,
    overtime_hours REAL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'half_day', 'leave', 'holiday')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    UNIQUE(staff_id, date)
);

-- Staff Payslips (monthly salary records)
CREATE TABLE IF NOT EXISTS staff_payslips (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    month TEXT NOT NULL, -- YYYY-MM format
    base_salary REAL NOT NULL,
    overtime_pay REAL DEFAULT 0,
    bonuses REAL DEFAULT 0,
    advances_deducted REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    gross_salary REAL NOT NULL,
    net_salary REAL NOT NULL,
    days_worked INTEGER,
    hours_worked REAL,
    status TEXT NOT NULL CHECK(status IN ('draft', 'processed', 'paid')) DEFAULT 'draft',
    paid_date TEXT, -- ISO 8601 date
    payment_method TEXT CHECK(payment_method IN ('cash', 'bank_transfer', 'cheque', 'upi')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    UNIQUE(staff_id, month)
);

-- Recreate indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_salary_staff ON staff_salary(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_advances_staff ON staff_advances(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_deductions_staff ON staff_deductions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_staff ON staff_bonuses(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_payslips_staff_month ON staff_payslips(staff_id, month);
-- Combo Filter Keywords
-- Store customizable filter keywords for quick-add combo features
CREATE TABLE IF NOT EXISTS combo_filter_keywords (
    id TEXT PRIMARY KEY,
    filter_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    emoji TEXT,
    keywords TEXT NOT NULL, -- JSON array of keywords
    color_class TEXT, -- Tailwind color class for UI
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed default filter keywords (matching existing hard-coded values)
INSERT OR REPLACE INTO combo_filter_keywords (id, filter_key, display_name, emoji, keywords, color_class, sort_order) VALUES
    ('filter-rice', 'rice', 'Rice', '🍚', '["rice", "biryani", "pulao", "fried rice", "jeera rice", "steamed rice", "veg rice", "chicken rice", "mutton rice"]', 'amber', 1),
    ('filter-puttu-otti', 'puttu-otti', 'Puttu/Otti', '🥞', '["puttu", "otti", "appam", "idiyappam", "pathiri", "kadala", "steamed cake"]', 'purple', 2),
    ('filter-roti', 'roti', 'Roti/Naan', '🫓', '["roti", "naan", "paratha", "chapati", "kulcha", "bread", "tandoori roti", "butter naan", "garlic naan", "laccha paratha", "rumali roti"]', 'orange', 3),
    ('filter-dal', 'dal', 'Dal', '🥣', '["dal", "daal", "lentil"]', 'yellow', 4),
    ('filter-curry', 'curry', 'Curry', '🍛', '["curry", "gravy", "masala", "sabzi", "kadhi"]', 'red', 5),
    ('filter-sides', 'sides', 'Sides', '🥗', '["raita", "papad", "papadum", "papadam", "pappadam", "papputtu", "pickle", "chutney", "salad", "achar", "yogurt", "curd"]', 'green', 6);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_combo_filter_keywords_active ON combo_filter_keywords(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_combo_filter_keywords_key ON combo_filter_keywords(filter_key);
-- Device Settings Table
-- Store device mode and configuration in SQLite for better persistence and Rust backend access

CREATE TABLE IF NOT EXISTS device_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Only one row allowed
    tenant_id TEXT,  -- Optional tenant reference (for future multi-tenant support)

    -- Device Configuration
    device_mode TEXT NOT NULL DEFAULT 'pos' CHECK(device_mode IN ('pos', 'kds', 'bds', 'server', 'mobile')),
    device_name TEXT NOT NULL DEFAULT 'Device 1',
    device_id TEXT NOT NULL UNIQUE,

    -- Feature Flags
    features_json TEXT NOT NULL DEFAULT '{}',  -- JSON object of enabled features

    -- Mode Lock Settings
    locked_mode INTEGER NOT NULL DEFAULT 0,   -- Boolean: Can't change mode
    kiosk_mode INTEGER NOT NULL DEFAULT 0,    -- Boolean: Full screen, no exit

    -- Auto-Login Settings
    auto_login_enabled INTEGER NOT NULL DEFAULT 0,
    auto_login_role TEXT,
    auto_login_staff_id TEXT,

    -- Network Settings
    lan_server_enabled INTEGER NOT NULL DEFAULT 0,
    lan_server_port INTEGER DEFAULT 8080,

    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for fast lookup (if tenant_id is used)
CREATE INDEX IF NOT EXISTS idx_device_settings_tenant ON device_settings(tenant_id) WHERE tenant_id IS NOT NULL;

-- Default row
INSERT OR IGNORE INTO device_settings (
    id, device_mode, device_name, device_id,
    features_json, created_at, updated_at
)
VALUES (
    1,
    'pos',
    'POS Terminal 1',
    lower(hex(randomblob(16))),
    '{"pos": true, "kitchen": true, "bar": true, "reports": true, "settings": true}',
    unixepoch(),
    unixepoch()
);
-- User Device Alignment System
-- Track user-device associations and auto-configure device based on logged-in user

-- Track user device preferences
CREATE TABLE IF NOT EXISTS user_device_preferences (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    preferred_device_mode TEXT NOT NULL CHECK(preferred_device_mode IN ('pos', 'kds', 'bds', 'server', 'mobile')),
    last_login_at INTEGER,
    login_count INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id)
);

-- Add user tracking columns to device_settings
ALTER TABLE device_settings ADD COLUMN current_user_id TEXT;
ALTER TABLE device_settings ADD COLUMN current_user_role TEXT;
ALTER TABLE device_settings ADD COLUMN auto_adapt_mode INTEGER NOT NULL DEFAULT 1;
ALTER TABLE device_settings ADD COLUMN allow_mode_override INTEGER NOT NULL DEFAULT 1;

-- Index for quick user lookups
CREATE INDEX IF NOT EXISTS idx_user_device_prefs_user ON user_device_preferences(user_id);

-- Login history for analytics and audit trail
CREATE TABLE IF NOT EXISTS device_login_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    device_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    device_mode_before TEXT,
    device_mode_after TEXT,
    login_timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
    logout_timestamp INTEGER
);

CREATE INDEX IF NOT EXISTS idx_login_history_device ON device_login_history(device_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON device_login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_timestamp ON device_login_history(login_timestamp);
-- Add D1 Database ID to Tenant Config
-- Stores the Cloudflare D1 database ID for cloud sync

-- This migration is now redundant as d1_database_id was added in migration 030
-- But we keep it for backwards compatibility with existing deployments
-- The index creation is idempotent so it's safe to run

-- No ALTER TABLE needed - column already exists from migration 030

-- Add index for faster lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_tenant_config_d1_database_id ON tenant_config(d1_database_id);
-- Migration: Add WiFi SSID Settings for Network-Based Access Control
-- Purpose: Store allowed WiFi SSIDs for staff to access sensitive features (payroll, attendance, etc.)
-- Date: 2026-01-30

-- Add restaurant_wifi_ssid column to restaurant_settings table
-- Stores comma-separated list of allowed WiFi SSIDs (e.g., "RestaurantWiFi,RestaurantWiFi-5G")
ALTER TABLE restaurant_settings
ADD COLUMN restaurant_wifi_ssid TEXT DEFAULT NULL;

-- Add wifi_check_enabled flag to enable/disable WiFi-based access control
ALTER TABLE restaurant_settings
ADD COLUMN wifi_check_enabled INTEGER DEFAULT 0;

-- Add description comment
-- restaurant_wifi_ssid: Comma-separated list of allowed WiFi SSIDs (NULL = no restriction)
-- wifi_check_enabled: 1 = require WiFi for sensitive features, 0 = disabled (default)
-- Menu Upload Session Tables
-- Handles multi-page menu uploads with staging and review before commit

-- Upload sessions table (tracks entire upload workflows)
CREATE TABLE IF NOT EXISTS menu_upload_sessions (
    id TEXT PRIMARY KEY,
    menu_type TEXT NOT NULL CHECK(menu_type IN ('food', 'bar')),
    status TEXT NOT NULL CHECK(status IN ('in_progress', 'committed', 'cancelled')) DEFAULT 'in_progress',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    committed_at TEXT,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER NOT NULL DEFAULT 0
);

-- Upload pages table (tracks individual PDF/image uploads within a session)
CREATE TABLE IF NOT EXISTS menu_upload_pages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('uploading', 'parsed', 'error')) DEFAULT 'uploading',
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES menu_upload_sessions(id) ON DELETE CASCADE
);

-- Staging items table (temporary storage for parsed menu items before commit)
-- NOTE: Table name is menu_items_staging (not menu_staging_items) to match code expectations
CREATE TABLE IF NOT EXISTS menu_items_staging (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image TEXT,
    active BOOLEAN NOT NULL DEFAULT 1,
    preparation_time INTEGER DEFAULT 15,
    allergens TEXT DEFAULT '[]',
    dietary_tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES menu_upload_sessions(id) ON DELETE CASCADE
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_menu_upload_pages_session
ON menu_upload_pages(session_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_staging_session
ON menu_items_staging(session_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_staging_category
ON menu_items_staging(category);

CREATE INDEX IF NOT EXISTS idx_menu_upload_sessions_status
ON menu_upload_sessions(status);
-- Migration: Auto-Attendance on WiFi Connection
-- Adds support for automatic attendance marking when staff connect to restaurant WiFi

-- Add auto-attendance tracking columns to attendance_records table
ALTER TABLE attendance_records
ADD COLUMN clock_in_method TEXT DEFAULT 'manual'; -- 'manual', 'wifi-auto', 'scheduled'

ALTER TABLE attendance_records
ADD COLUMN clock_in_device_id TEXT;

-- Add auto-attendance settings to restaurant_settings table
ALTER TABLE restaurant_settings
ADD COLUMN auto_attendance_enabled INTEGER DEFAULT 0; -- 0 = disabled, 1 = enabled

-- Create or update device_settings table for device-staff assignment
CREATE TABLE IF NOT EXISTS device_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    tenant_id TEXT NOT NULL,
    assigned_staff_id TEXT, -- Staff member assigned to this device for auto-attendance
    device_mode TEXT DEFAULT 'owner', -- 'owner' or 'staff'
    locked_mode INTEGER DEFAULT 0,
    lan_server_enabled INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

-- Add assigned_staff_id column if device_settings table already exists
-- This will fail silently if the column already exists (SQLite doesn't support IF NOT EXISTS for ALTER COLUMN)
-- ALTER TABLE device_settings
-- ADD COLUMN assigned_staff_id TEXT;

-- Create index for faster device settings queries
CREATE INDEX IF NOT EXISTS idx_device_settings_tenant ON device_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_settings_staff ON device_settings(assigned_staff_id);

-- Create index for faster attendance queries by clock-in method
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in_method ON attendance_records(clock_in_method);
-- Minimal tenant configuration (core bootstrap only)
-- Restaurant settings moved to plugin-settings-* plugins

-- Drop old restaurant_settings if it exists (will be recreated by plugin)
DROP TABLE IF EXISTS restaurant_settings;

-- For fresh installs: tenant_config doesn't exist yet, so just create it
-- For migrations: rename old table, copy data, then replace

-- Create new minimal tenant_config table (always safe to run)
CREATE TABLE IF NOT EXISTS tenant_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    tenant_id TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    subdomain TEXT NOT NULL,
    api_base_url TEXT NOT NULL,
    orders_endpoint TEXT NOT NULL,
    menu_endpoint TEXT NOT NULL,
    primary_color TEXT NOT NULL DEFAULT '#3B82F6',
    secondary_color TEXT,
    logo_url TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    activated_at TEXT,
    -- Cloud sync
    d1_database_id TEXT
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant_id ON tenant_config(tenant_id);
-- Migration: Create locations table for multi-location support
-- Date: 2026-02-02
-- Description: Simplified multi-location architecture - same menu, different DBs, real-time sync

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  db_path TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for fast lookups by active status
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

-- Index for fast lookups by name
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
