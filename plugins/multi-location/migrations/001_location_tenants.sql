-- Multi-Location Tenant Management
-- This migration adds tables for managing restaurant chains and location tenants
-- Each location is a separate tenant with isolated Cloudflare infrastructure

-- Restaurant chains table
CREATE TABLE IF NOT EXISTS restaurant_chains (
  id TEXT PRIMARY KEY,
  chain_name TEXT NOT NULL,
  master_tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Location tenants table
-- Stores metadata for each location tenant (separate D1, KV, R2, DNS)
CREATE TABLE IF NOT EXISTS location_tenants (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  location_tenant_id TEXT NOT NULL UNIQUE,
  location_name TEXT NOT NULL,

  -- Full address breakdown
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',

  -- Contact info
  phone TEXT,
  email TEXT,

  -- Tenant metadata
  activation_code TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  restaurant_type TEXT NOT NULL,

  -- Provisioning status
  provisioning_status TEXT NOT NULL DEFAULT 'completed' CHECK(provisioning_status IN ('pending', 'provisioning', 'completed', 'failed')),

  -- Cloudflare resources
  d1_database_id TEXT,
  kv_namespace_id TEXT,
  r2_bucket_name TEXT,
  worker_url TEXT,

  -- Google Maps metadata (optional, for reference)
  google_place_id TEXT,
  google_maps_url TEXT,
  google_rating REAL CHECK(google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5)),
  google_total_reviews INTEGER CHECK(google_total_reviews IS NULL OR google_total_reviews >= 0),
  latitude REAL CHECK(latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude REAL CHECK(longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),

  FOREIGN KEY (chain_id) REFERENCES restaurant_chains(id) ON DELETE CASCADE
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_location_tenants_chain_id ON location_tenants(chain_id);
CREATE INDEX IF NOT EXISTS idx_location_tenants_status ON location_tenants(status);
CREATE INDEX IF NOT EXISTS idx_location_tenants_tenant_id ON location_tenants(location_tenant_id);
CREATE INDEX IF NOT EXISTS idx_location_tenants_subdomain ON location_tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_restaurant_chains_master_tenant ON restaurant_chains(master_tenant_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_location_tenants_timestamp
AFTER UPDATE ON location_tenants
FOR EACH ROW
BEGIN
  UPDATE location_tenants SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_restaurant_chains_timestamp
AFTER UPDATE ON restaurant_chains
FOR EACH ROW
BEGIN
  UPDATE restaurant_chains SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;
