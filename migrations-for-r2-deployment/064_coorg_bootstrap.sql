-- Migration 064: Coorg Food Company Bootstrap
-- Ensures the full coorg-food-company-1413 schema and seed data are present.
-- Safe to run on any database state — uses IF NOT EXISTS / INSERT OR IGNORE throughout.
-- Repairs installs where earlier migrations (054, 061, 062) failed silently.

-- ── Menu tables (created here in case 055_menu_base_tables ran before 054 fixed the chain) ──

CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  active INTEGER DEFAULT 1,
  preparation_time INTEGER DEFAULT 15,
  allergens TEXT DEFAULT '[]',
  dietary_tags TEXT DEFAULT '[]',
  is_combo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_064 ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active_064 ON menu_items(active);

-- Add is_combo to menu_items if it was created without it (e.g. from d1-schema.sql)
ALTER TABLE menu_items ADD COLUMN is_combo INTEGER DEFAULT 0;

-- ── Combo group tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS menu_combo_groups (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  required INTEGER DEFAULT 1,
  min_selections INTEGER DEFAULT 1,
  max_selections INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_combo_group_items (
  id TEXT PRIMARY KEY,
  combo_group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  price_adjustment REAL DEFAULT 0,
  available INTEGER DEFAULT 1,
  tags TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Coorg categories ─────────────────────────────────────────────────────────

INSERT OR IGNORE INTO menu_categories (id, name, sort_order, active) VALUES
  ('cat-appetizers',            'APPETIZERS',              1, 1),
  ('cat-combo-meals',           'COMBO MEALS',             2, 1),
  ('cat-coolers',               'COOLERS',                 3, 1),
  ('cat-curries',               'CURRIES',                 4, 1),
  ('cat-desserts',              'DESSERTS',                5, 1),
  ('cat-ottis,-puttus-and-rice','OTTIS, PUTTUS AND RICE',  6, 1),
  ('cat-pickles',               'PICKLES',                 7, 1),
  ('cat-platters',              'PLATTERS',                8, 1),
  ('cat-pulavs',                'PULAVS',                  9, 1),
  ('cat-soups',                 'SOUPS',                  10, 1);

-- ── Coorg menu items (from 062_coorg_seed.sql) ───────────────────────────────
-- Combo items get is_combo=1 directly

INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags, is_combo) VALUES
  -- COMBO MEALS (8 items)
  ('cfc-tcfc-71','Kutu Curry Combo',     'cat-combo-meals',330,'Coorg-style Kutu curry with choice of base', 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/kutu-combo/public',1,'[]',1),
  ('cfc-tcfc-72','Baimbale Curry Combo', 'cat-combo-meals',330,'Coorg-style Baimbale curry with choice of base','https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/baimbale-combo/public',1,'[]',1),
  ('cfc-tcfc-73','Mutte Curry Combo',    'cat-combo-meals',330,'Coorg-style Mutte curry with choice of base', 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/mutte-combo/public',1,'[]',1),
  ('cfc-tcfc-74','Pandi Curry Combo',    'cat-combo-meals',380,'Coorg Pandi (pork) curry with choice of base', 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/pandi-combo/public',1,'[]',1),
  ('cfc-tcfc-75','Koli Curry Combo',     'cat-combo-meals',350,'Coorg Koli (chicken) curry with choice of base','https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/koli-combo/public',1,'[]',1),
  ('cfc-tcfc-76','Erachi Curry Combo',   'cat-combo-meals',400,'Coorg Erachi (mutton) curry with choice of base','https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/erachi-combo/public',1,'[]',1),
  ('cfc-tcfc-77','Kaima Curry Combo',    'cat-combo-meals',350,'Coorg Kaima curry with choice of base',       'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/kaima-combo/public',1,'[]',1),
  ('cfc-tcfc-78','Kadle Curry Combo',    'cat-combo-meals',330,'Coorg Kadle (chickpea) curry with choice of base','https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/kadle-combo/public',1,'["vegetarian"]',1);

-- Update is_combo flag on any combo items that were inserted before this migration
UPDATE menu_items SET is_combo = 1
WHERE id IN ('cfc-tcfc-71','cfc-tcfc-72','cfc-tcfc-73','cfc-tcfc-74','cfc-tcfc-75','cfc-tcfc-76','cfc-tcfc-77','cfc-tcfc-78');

-- ── Combo groups (one per combo meal) ────────────────────────────────────────

INSERT OR IGNORE INTO menu_combo_groups (id, menu_item_id, name, required, min_selections, max_selections, sort_order) VALUES
  ('cg-cfc-71','cfc-tcfc-71','Choose Your Base',1,1,1,0),
  ('cg-cfc-72','cfc-tcfc-72','Choose Your Base',1,1,1,0),
  ('cg-cfc-73','cfc-tcfc-73','Choose Your Base',1,1,1,0),
  ('cg-cfc-74','cfc-tcfc-74','Choose Your Base',1,1,1,0),
  ('cg-cfc-75','cfc-tcfc-75','Choose Your Base',1,1,1,0),
  ('cg-cfc-76','cfc-tcfc-76','Choose Your Base',1,1,1,0),
  ('cg-cfc-77','cfc-tcfc-77','Choose Your Base',1,1,1,0),
  ('cg-cfc-78','cfc-tcfc-78','Choose Your Base',1,1,1,0);

-- ── Combo group items (6 base choices × 8 groups = 48 rows) ─────────────────

INSERT OR IGNORE INTO menu_combo_group_items (id, combo_group_id, name, price_adjustment, available, sort_order) VALUES
  ('cgi-71-1','cg-cfc-71','Paputtu',    0,1,0),('cgi-71-2','cg-cfc-71','Kadambuttu', 0,1,1),
  ('cgi-71-3','cg-cfc-71','Noolputtu',  0,1,2),('cgi-71-4','cg-cfc-71','Akki Otti',  0,1,3),
  ('cgi-71-5','cg-cfc-71','Ney Kulu',   0,1,4),('cgi-71-6','cg-cfc-71','Steamed Rice',0,1,5),
  ('cgi-72-1','cg-cfc-72','Paputtu',    0,1,0),('cgi-72-2','cg-cfc-72','Kadambuttu', 0,1,1),
  ('cgi-72-3','cg-cfc-72','Noolputtu',  0,1,2),('cgi-72-4','cg-cfc-72','Akki Otti',  0,1,3),
  ('cgi-72-5','cg-cfc-72','Ney Kulu',   0,1,4),('cgi-72-6','cg-cfc-72','Steamed Rice',0,1,5),
  ('cgi-73-1','cg-cfc-73','Paputtu',    0,1,0),('cgi-73-2','cg-cfc-73','Kadambuttu', 0,1,1),
  ('cgi-73-3','cg-cfc-73','Noolputtu',  0,1,2),('cgi-73-4','cg-cfc-73','Akki Otti',  0,1,3),
  ('cgi-73-5','cg-cfc-73','Ney Kulu',   0,1,4),('cgi-73-6','cg-cfc-73','Steamed Rice',0,1,5),
  ('cgi-74-1','cg-cfc-74','Paputtu',    0,1,0),('cgi-74-2','cg-cfc-74','Kadambuttu', 0,1,1),
  ('cgi-74-3','cg-cfc-74','Noolputtu',  0,1,2),('cgi-74-4','cg-cfc-74','Akki Otti',  0,1,3),
  ('cgi-74-5','cg-cfc-74','Ney Kulu',   0,1,4),('cgi-74-6','cg-cfc-74','Steamed Rice',0,1,5),
  ('cgi-75-1','cg-cfc-75','Paputtu',    0,1,0),('cgi-75-2','cg-cfc-75','Kadambuttu', 0,1,1),
  ('cgi-75-3','cg-cfc-75','Noolputtu',  0,1,2),('cgi-75-4','cg-cfc-75','Akki Otti',  0,1,3),
  ('cgi-75-5','cg-cfc-75','Ney Kulu',   0,1,4),('cgi-75-6','cg-cfc-75','Steamed Rice',0,1,5),
  ('cgi-76-1','cg-cfc-76','Paputtu',    0,1,0),('cgi-76-2','cg-cfc-76','Kadambuttu', 0,1,1),
  ('cgi-76-3','cg-cfc-76','Noolputtu',  0,1,2),('cgi-76-4','cg-cfc-76','Akki Otti',  0,1,3),
  ('cgi-76-5','cg-cfc-76','Ney Kulu',   0,1,4),('cgi-76-6','cg-cfc-76','Steamed Rice',0,1,5),
  ('cgi-77-1','cg-cfc-77','Paputtu',    0,1,0),('cgi-77-2','cg-cfc-77','Kadambuttu', 0,1,1),
  ('cgi-77-3','cg-cfc-77','Noolputtu',  0,1,2),('cgi-77-4','cg-cfc-77','Akki Otti',  0,1,3),
  ('cgi-77-5','cg-cfc-77','Ney Kulu',   0,1,4),('cgi-77-6','cg-cfc-77','Steamed Rice',0,1,5),
  ('cgi-78-1','cg-cfc-78','Paputtu',    0,1,0),('cgi-78-2','cg-cfc-78','Kadambuttu', 0,1,1),
  ('cgi-78-3','cg-cfc-78','Noolputtu',  0,1,2),('cgi-78-4','cg-cfc-78','Akki Otti',  0,1,3),
  ('cgi-78-5','cg-cfc-78','Ney Kulu',   0,1,4),('cgi-78-6','cg-cfc-78','Steamed Rice',0,1,5);
