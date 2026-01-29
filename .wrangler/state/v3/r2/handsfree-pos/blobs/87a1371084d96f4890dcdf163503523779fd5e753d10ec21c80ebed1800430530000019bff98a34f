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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS update_tenant_config_timestamp
AFTER UPDATE ON tenant_config
BEGIN
    UPDATE tenant_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
