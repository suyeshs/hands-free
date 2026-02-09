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
