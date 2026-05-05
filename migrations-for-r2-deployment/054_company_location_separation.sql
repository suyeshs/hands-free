-- Migration 054: Company and Location Separation
-- Adds company-level fields to restaurant_settings and tenant_config

-- Add company-level fields to restaurant_settings
ALTER TABLE restaurant_settings ADD COLUMN company_name TEXT;
ALTER TABLE restaurant_settings ADD COLUMN company_registration_number TEXT;
ALTER TABLE restaurant_settings ADD COLUMN owner_email TEXT;
ALTER TABLE restaurant_settings ADD COLUMN owner_phone TEXT;

-- Add company-level flag to tenant_config
ALTER TABLE tenant_config ADD COLUMN is_company_level INTEGER DEFAULT 0;

-- Migrate existing data: copy 'name' to 'company_name' for existing master tenants
UPDATE restaurant_settings
SET company_name = COALESCE(company_name, name)
WHERE company_name IS NULL
  AND name IS NOT NULL
  AND name != ''
  AND name != 'Restaurant Name';

-- Create index for faster company lookups
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_company ON restaurant_settings(company_name);
