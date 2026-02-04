-- Add D1 Database ID to Tenant Config
-- Stores the Cloudflare D1 database ID for cloud sync

-- This migration is now redundant as d1_database_id was added in migration 030
-- But we keep it for backwards compatibility with existing deployments
-- The index creation is idempotent so it's safe to run

-- No ALTER TABLE needed - column already exists from migration 030

-- Add index for faster lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_tenant_config_d1_database_id ON tenant_config(d1_database_id);
