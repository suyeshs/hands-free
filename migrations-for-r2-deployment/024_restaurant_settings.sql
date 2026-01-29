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
