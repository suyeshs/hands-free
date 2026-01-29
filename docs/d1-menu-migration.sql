-- D1 Database Migration - Menu Management
-- This migration creates menu_categories and menu_items tables in D1
-- Schema MUST match local SQLite exactly for sync to work

-- Menu Categories Table
CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT 1,
  icon TEXT,
  description TEXT DEFAULT '',
  created_at TEXT,
  updated_at TEXT,
  name_translations TEXT
);

-- Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  image TEXT,
  active BOOLEAN NOT NULL DEFAULT 1,
  preparation_time INTEGER NOT NULL DEFAULT 15,
  allergens TEXT,
  dietary_tags TEXT,
  name_translations TEXT,
  description_translations TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON menu_categories(active);
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON menu_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(active);
CREATE INDEX IF NOT EXISTS idx_menu_items_price ON menu_items(price);
