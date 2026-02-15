-- Migration 054: Company and Location Separation
-- Adds company-level fields to restaurant_settings and tenant_config
-- NOTE: This migration is idempotent - safe to run multiple times
-- If columns already exist, they won't be re-added

-- Migrate existing data: For existing installations, copy 'name' to 'company_name' if not yet set
UPDATE restaurant_settings
SET company_name = COALESCE(company_name, name)
WHERE company_name IS NULL
  AND name IS NOT NULL
  AND name != ''
  AND name != 'Restaurant Name';

-- Create index for faster company lookups (IF NOT EXISTS is supported for indexes)
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_company ON restaurant_settings(company_name);

-- Note: Column additions have been moved to a separate migration to avoid duplicate column errors
-- This migration only handles data migration and index creation
