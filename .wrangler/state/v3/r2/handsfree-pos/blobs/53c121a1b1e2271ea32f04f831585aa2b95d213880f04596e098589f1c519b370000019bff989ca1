-- Fix duplicate categories and add UNIQUE constraint
-- This migration removes duplicate categories and prevents future duplicates

-- Step 1: Disable foreign key constraints temporarily
PRAGMA foreign_keys = OFF;

-- Step 2: Create a mapping of old category IDs to new deduplicated IDs
CREATE TEMP TABLE category_mapping AS
SELECT
    mc.id as old_id,
    (SELECT MIN(id) FROM menu_categories mc2 WHERE mc2.name = mc.name) as new_id,
    mc.name
FROM menu_categories mc;

-- Step 3: Create a temporary table with the correct schema
CREATE TABLE menu_categories_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,  -- Add UNIQUE constraint
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT 1,
    icon TEXT,
    description TEXT DEFAULT '',
    created_at TEXT,
    updated_at TEXT,
    name_translations TEXT
);

-- Step 4: Copy unique categories to the new table
-- Keep only the first occurrence of each category name
INSERT INTO menu_categories_new (id, name, sort_order, active, icon, description, created_at, updated_at, name_translations)
SELECT
    MIN(id) as id,  -- Keep the first ID for each category name
    name,
    MIN(sort_order) as sort_order,
    MAX(active) as active,  -- Keep active if any version is active
    (SELECT icon FROM menu_categories mc2 WHERE mc2.name = mc1.name LIMIT 1) as icon,
    COALESCE((SELECT description FROM menu_categories mc2 WHERE mc2.name = mc1.name AND description IS NOT NULL AND description != '' LIMIT 1), '') as description,
    MIN(created_at) as created_at,
    MAX(updated_at) as updated_at,
    (SELECT name_translations FROM menu_categories mc2 WHERE mc2.name = mc1.name AND name_translations IS NOT NULL LIMIT 1) as name_translations
FROM menu_categories mc1
GROUP BY name;

-- Step 5: Create new menu_items table without foreign key constraint
CREATE TABLE menu_items_new (
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

-- Step 6: Copy menu items with updated category IDs
INSERT INTO menu_items_new
SELECT
    mi.id,
    COALESCE(cm.new_id, mi.category_id) as category_id,
    mi.name,
    mi.description,
    mi.price,
    mi.image,
    mi.active,
    mi.preparation_time,
    mi.allergens,
    mi.dietary_tags,
    mi.name_translations,
    mi.description_translations
FROM menu_items mi
LEFT JOIN category_mapping cm ON mi.category_id = cm.old_id;

-- Step 7: Drop the old tables and rename the new ones
DROP TABLE menu_items;
DROP TABLE menu_categories;
ALTER TABLE menu_items_new RENAME TO menu_items;
ALTER TABLE menu_categories_new RENAME TO menu_categories;

-- Step 8: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_menu_categories_name ON menu_categories(name);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON menu_categories(active);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(active);

-- Step 9: Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
