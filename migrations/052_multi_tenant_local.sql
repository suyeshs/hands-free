-- Migration 052: Multi-Tenant Local Support
-- Adds tables and columns for local tenant access and switching

-- Create tenant_context table for tracking current tenant
CREATE TABLE IF NOT EXISTS tenant_context (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_tenant_id TEXT NOT NULL,
  current_tenant_type TEXT NOT NULL, -- 'master' or 'location'
  switched_at TEXT DEFAULT CURRENT_TIMESTAMP,
  CHECK (id = 1) -- Ensure only one row exists
);

-- Add local database tracking to location_tenants
ALTER TABLE location_tenants ADD COLUMN local_db_path TEXT;
ALTER TABLE location_tenants ADD COLUMN is_accessible INTEGER DEFAULT 1;
ALTER TABLE location_tenants ADD COLUMN last_accessed_at TEXT;

-- Create index for quick tenant lookups
CREATE INDEX IF NOT EXISTS idx_location_tenants_accessible
ON location_tenants(is_accessible)
WHERE is_accessible = 1;

-- Create index for tenant context queries
CREATE INDEX IF NOT EXISTS idx_tenant_context_type
ON tenant_context(current_tenant_type);
