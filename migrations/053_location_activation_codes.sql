-- Migration 053: Location Activation Codes
-- Adds activation code functionality for instant location tenant setup

-- Add activation code columns to location_tenants
ALTER TABLE location_tenants ADD COLUMN activation_code TEXT UNIQUE;
ALTER TABLE location_tenants ADD COLUMN activation_code_generated_at TEXT;
ALTER TABLE location_tenants ADD COLUMN activation_code_used_at TEXT;
ALTER TABLE location_tenants ADD COLUMN activated_by_device_id TEXT;

-- Index for fast activation code lookups
CREATE INDEX IF NOT EXISTS idx_location_activation_code
ON location_tenants(activation_code)
WHERE activation_code IS NOT NULL;

-- Index for finding unused codes
CREATE INDEX IF NOT EXISTS idx_location_activation_unused
ON location_tenants(activation_code_used_at)
WHERE activation_code_used_at IS NULL;
