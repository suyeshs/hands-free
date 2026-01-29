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
