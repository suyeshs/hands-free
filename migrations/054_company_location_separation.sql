-- =========================================
-- Migration 054: Company-Location Separation
-- =========================================
-- Purpose: Separate company-level data from location-level data
-- This enables cleaner multi-location hierarchy where:
-- - Master tenant = Company/Chain (not tied to physical location)
-- - Location tenants = Individual restaurant locations
--
-- Date: 2026-02-13
-- Related: Multi-location workflow refactor
-- =========================================

-- Add company-level fields to restaurant_settings
ALTER TABLE restaurant_settings ADD COLUMN company_name TEXT;
ALTER TABLE restaurant_settings ADD COLUMN company_registration_number TEXT;
ALTER TABLE restaurant_settings ADD COLUMN owner_email TEXT;
ALTER TABLE restaurant_settings ADD COLUMN owner_phone TEXT;

-- Add company-level flag to tenant_config
ALTER TABLE tenant_config ADD COLUMN is_company_level INTEGER DEFAULT 0;

-- Migrate existing data for backward compatibility
-- For existing master tenants (is_location = 0 or NULL), copy name → company_name
UPDATE restaurant_settings
SET company_name = name
WHERE (is_location = 0 OR is_location IS NULL) AND company_name IS NULL;

-- Add index for company lookups
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_company ON restaurant_settings(company_name);

-- =========================================
-- NOTES FOR DEVELOPERS
-- =========================================
-- After this migration:
-- 1. Master tenants (is_location = 0): Use company_name for company/chain name
-- 2. Location tenants (is_location = 1): Use name for location name
-- 3. Backward compatibility: If company_name is NULL, fall back to name
-- 4. New installs: Set both company_name (company) and name (location) explicitly
-- =========================================
