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
