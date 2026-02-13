-- Restaurant Settings for India (Full Service)
-- Pre-configured with GST, FSSAI compliance, and Indian defaults

CREATE TABLE IF NOT EXISTS restaurant_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,

    -- Basic Information
    restaurant_type TEXT DEFAULT 'full-service' CHECK (restaurant_type IN ('full-service', 'qsr-fast-food', 'cafe-bakery', 'dark-kitchen', 'bar-lounge', 'food-truck', 'multi-brand', 'large-chain')),
    operational_scale TEXT DEFAULT 'single-location' CHECK (operational_scale IN ('single-location', 'multi-location', 'franchise', 'chain')),
    name TEXT NOT NULL DEFAULT 'My Restaurant',
    owner_name TEXT,
    tagline TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,

    -- Indian Compliance (GST, FSSAI, PAN)
    gst_number TEXT,
    fssai_number TEXT,
    pan_number TEXT,
    cin_number TEXT,

    -- Invoice Configuration (India defaults)
    invoice_prefix TEXT DEFAULT 'INV-',
    invoice_start_number INTEGER DEFAULT 1001,
    current_invoice_number INTEGER DEFAULT 1001,
    invoice_terms TEXT DEFAULT 'Thank you for your business!',
    footer_note TEXT DEFAULT 'This is a computer generated invoice',

    -- Tax Settings (GST - India)
    tax_enabled INTEGER DEFAULT 1,
    cgst_rate REAL DEFAULT 2.5,
    sgst_rate REAL DEFAULT 2.5,
    service_charge_rate REAL DEFAULT 10.0,
    service_charge_enabled INTEGER DEFAULT 1,
    round_off_enabled INTEGER DEFAULT 1,
    tax_included_in_price INTEGER DEFAULT 0,

    -- Printing Settings (80mm thermal - common in India)
    print_logo INTEGER DEFAULT 1,
    logo_url TEXT,
    print_qr_code INTEGER DEFAULT 1,
    qr_code_url TEXT,
    paper_width INTEGER DEFAULT 80,
    show_itemwise_tax INTEGER DEFAULT 1,

    -- Security
    require_staff_pin_for_pos INTEGER DEFAULT 1,
    filter_tables_by_staff_assignment INTEGER DEFAULT 0,
    pin_session_timeout_minutes INTEGER DEFAULT 30,

    -- Theme
    theme TEXT DEFAULT 'default',

    -- Cloud Features
    activate_online INTEGER DEFAULT 0,
    enable_inventory_sync INTEGER DEFAULT 0,
    device_role TEXT DEFAULT 'standalone' CHECK (device_role IN ('standalone', 'primary', 'secondary')),

    -- Packaging Charges (common in delivery)
    packing_charges_enabled INTEGER DEFAULT 0,
    packing_charges_by_category TEXT DEFAULT '{}',
    packing_charges_default REAL DEFAULT 0,

    -- Online Presence
    online_presence_json TEXT DEFAULT '{
      "themePreset": "universal-restaurant",
      "themeFamily": "multimodal-restaurant",
      "subdomain": "",
      "enabled": false,
      "themeConfig": {
        "primaryColor": "#2563EB",
        "secondaryColor": "#64748B",
        "accentColor": "#3B82F6",
        "backgroundColor": "#FFFFFF",
        "textPrimaryColor": "#1F2937",
        "textSecondaryColor": "#6B7280"
      }
    }',

    -- Region-specific metadata
    region TEXT DEFAULT 'india',
    currency TEXT DEFAULT 'INR',
    currency_symbol TEXT DEFAULT '₹',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    time_format TEXT DEFAULT '12h',

    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Insert default settings if table is empty
INSERT OR IGNORE INTO restaurant_settings (id, name) VALUES (1, 'My Restaurant');

-- Create index
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_region ON restaurant_settings(region);
