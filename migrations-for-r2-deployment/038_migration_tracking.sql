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
