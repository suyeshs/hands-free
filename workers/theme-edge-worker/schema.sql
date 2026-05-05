-- D1 Database Schema for Theme System
-- Execute with: wrangler d1 execute facemash-themes --file=./schema.sql

-- Tenant themes table (main storage)
CREATE TABLE IF NOT EXISTS tenant_themes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL UNIQUE,
  theme_json TEXT NOT NULL, -- JSON stored as TEXT in D1
  version TEXT NOT NULL DEFAULT '2.0.0',
  signature TEXT, -- WebCrypto HMAC signature
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tenant_themes_tenant_id ON tenant_themes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_themes_active ON tenant_themes(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_themes_updated ON tenant_themes(updated_at);

-- Theme history for versioning and rollback
CREATE TABLE IF NOT EXISTS tenant_theme_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  theme_json TEXT NOT NULL,
  version TEXT NOT NULL,
  signature TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  created_by TEXT,
  change_description TEXT
);

CREATE INDEX IF NOT EXISTS idx_theme_history_tenant ON tenant_theme_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_theme_history_created ON tenant_theme_history(created_at);

-- Theme templates for marketplace
CREATE TABLE IF NOT EXISTS theme_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'ecommerce', 'luxury', 'minimal', 'vibrant', etc.
  theme_json TEXT NOT NULL,
  preview_url TEXT,
  is_public INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  rating REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  author TEXT
);

CREATE INDEX IF NOT EXISTS idx_templates_public ON theme_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_category ON theme_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_downloads ON theme_templates(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_templates_rating ON theme_templates(rating DESC);

-- Cache statistics (optional, for monitoring)
CREATE TABLE IF NOT EXISTS cache_stats (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  last_access INTEGER DEFAULT (unixepoch()),
  avg_latency_ms REAL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cache_stats_tenant ON cache_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_stats_access ON cache_stats(last_access);

-- ShipTrack themes table (Android app themes)
CREATE TABLE IF NOT EXISTS shiptrack_themes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL UNIQUE,
  theme_json TEXT NOT NULL, -- ShipTrack theme JSON with icons, colors, components
  version TEXT NOT NULL DEFAULT '1.0.0',
  signature TEXT, -- WebCrypto HMAC signature
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_shiptrack_themes_org ON shiptrack_themes(organization_id);
CREATE INDEX IF NOT EXISTS idx_shiptrack_themes_updated ON shiptrack_themes(updated_at);

