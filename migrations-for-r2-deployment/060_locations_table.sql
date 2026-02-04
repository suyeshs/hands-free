-- Migration: Create locations table for multi-location support
-- Date: 2026-02-02
-- Description: Simplified multi-location architecture - same menu, different DBs, real-time sync

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  db_path TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for fast lookups by active status
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

-- Index for fast lookups by name
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
