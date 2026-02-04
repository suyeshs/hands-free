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
