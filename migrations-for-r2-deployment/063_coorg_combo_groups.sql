-- Migration 063: Coorg Food Company Combo Groups
-- Adds the selectable base choices for all Coorg combo meal items.
-- Each combo meal has one required group: "Choose Your Base"
-- with 6 options (Paputtu, Kadambuttu, Noolputtu, Akki Otti, Ney Kulu, Steamed Rice).

-- Mark all coorg combo meals as is_combo
UPDATE menu_items SET is_combo = 1
WHERE id IN ('cfc-tcfc-72','cfc-tcfc-76','cfc-tcfc-78','cfc-tcfc-77','cfc-tcfc-75','cfc-tcfc-71','cfc-tcfc-73','cfc-tcfc-74');

-- Create combo groups (one per combo meal)
INSERT OR IGNORE INTO menu_combo_groups (id, menu_item_id, name, required, min_selections, max_selections, sort_order) VALUES
  ('cg-cfc-72', 'cfc-tcfc-72', 'Choose Your Base', 1, 1, 1, 0),
  ('cg-cfc-76', 'cfc-tcfc-76', 'Choose Your Base', 1, 1, 1, 0),
  ('cg-cfc-78', 'cfc-tcfc-78', 'Choose Your Base', 1, 1, 1, 0),
  ('cg-cfc-77', 'cfc-tcfc-77', 'Choose Your Base', 1, 1, 1, 0),
  ('cg-cfc-75', 'cfc-tcfc-75', 'Choose Your Base', 1, 1, 1, 0),
  ('cg-cfc-71', 'cfc-tcfc-71', 'Choose Your Base', 1, 1, 1, 0),
  ('cg-cfc-73', 'cfc-tcfc-73', 'Choose Your Base', 1, 1, 1, 0),
  ('cg-cfc-74', 'cfc-tcfc-74', 'Choose Your Base', 1, 1, 1, 0);

-- Insert the 6 choices for each group
INSERT OR IGNORE INTO menu_combo_group_items (id, combo_group_id, name, price_adjustment, available, sort_order) VALUES
  -- cfc-tcfc-72 (Baimbale)
  ('cgi-72-1','cg-cfc-72','Paputtu',     0, 1, 0),
  ('cgi-72-2','cg-cfc-72','Kadambuttu',  0, 1, 1),
  ('cgi-72-3','cg-cfc-72','Noolputtu',   0, 1, 2),
  ('cgi-72-4','cg-cfc-72','Akki Otti',   0, 1, 3),
  ('cgi-72-5','cg-cfc-72','Ney Kulu',    0, 1, 4),
  ('cgi-72-6','cg-cfc-72','Steamed Rice',0, 1, 5),
  -- cfc-tcfc-76 (Erachi Mutton)
  ('cgi-76-1','cg-cfc-76','Paputtu',     0, 1, 0),
  ('cgi-76-2','cg-cfc-76','Kadambuttu',  0, 1, 1),
  ('cgi-76-3','cg-cfc-76','Noolputtu',   0, 1, 2),
  ('cgi-76-4','cg-cfc-76','Akki Otti',   0, 1, 3),
  ('cgi-76-5','cg-cfc-76','Ney Kulu',    0, 1, 4),
  ('cgi-76-6','cg-cfc-76','Steamed Rice',0, 1, 5),
  -- cfc-tcfc-78 (Kadle)
  ('cgi-78-1','cg-cfc-78','Paputtu',     0, 1, 0),
  ('cgi-78-2','cg-cfc-78','Kadambuttu',  0, 1, 1),
  ('cgi-78-3','cg-cfc-78','Noolputtu',   0, 1, 2),
  ('cgi-78-4','cg-cfc-78','Akki Otti',   0, 1, 3),
  ('cgi-78-5','cg-cfc-78','Ney Kulu',    0, 1, 4),
  ('cgi-78-6','cg-cfc-78','Steamed Rice',0, 1, 5),
  -- cfc-tcfc-77 (Kaima)
  ('cgi-77-1','cg-cfc-77','Paputtu',     0, 1, 0),
  ('cgi-77-2','cg-cfc-77','Kadambuttu',  0, 1, 1),
  ('cgi-77-3','cg-cfc-77','Noolputtu',   0, 1, 2),
  ('cgi-77-4','cg-cfc-77','Akki Otti',   0, 1, 3),
  ('cgi-77-5','cg-cfc-77','Ney Kulu',    0, 1, 4),
  ('cgi-77-6','cg-cfc-77','Steamed Rice',0, 1, 5),
  -- cfc-tcfc-75 (Koli Chicken)
  ('cgi-75-1','cg-cfc-75','Paputtu',     0, 1, 0),
  ('cgi-75-2','cg-cfc-75','Kadambuttu',  0, 1, 1),
  ('cgi-75-3','cg-cfc-75','Noolputtu',   0, 1, 2),
  ('cgi-75-4','cg-cfc-75','Akki Otti',   0, 1, 3),
  ('cgi-75-5','cg-cfc-75','Ney Kulu',    0, 1, 4),
  ('cgi-75-6','cg-cfc-75','Steamed Rice',0, 1, 5),
  -- cfc-tcfc-71 (Kutu)
  ('cgi-71-1','cg-cfc-71','Paputtu',     0, 1, 0),
  ('cgi-71-2','cg-cfc-71','Kadambuttu',  0, 1, 1),
  ('cgi-71-3','cg-cfc-71','Noolputtu',   0, 1, 2),
  ('cgi-71-4','cg-cfc-71','Akki Otti',   0, 1, 3),
  ('cgi-71-5','cg-cfc-71','Ney Kulu',    0, 1, 4),
  ('cgi-71-6','cg-cfc-71','Steamed Rice',0, 1, 5),
  -- cfc-tcfc-73 (Mutte)
  ('cgi-73-1','cg-cfc-73','Paputtu',     0, 1, 0),
  ('cgi-73-2','cg-cfc-73','Kadambuttu',  0, 1, 1),
  ('cgi-73-3','cg-cfc-73','Noolputtu',   0, 1, 2),
  ('cgi-73-4','cg-cfc-73','Akki Otti',   0, 1, 3),
  ('cgi-73-5','cg-cfc-73','Ney Kulu',    0, 1, 4),
  ('cgi-73-6','cg-cfc-73','Steamed Rice',0, 1, 5),
  -- cfc-tcfc-74 (Pandi)
  ('cgi-74-1','cg-cfc-74','Paputtu',     0, 1, 0),
  ('cgi-74-2','cg-cfc-74','Kadambuttu',  0, 1, 1),
  ('cgi-74-3','cg-cfc-74','Noolputtu',   0, 1, 2),
  ('cgi-74-4','cg-cfc-74','Akki Otti',   0, 1, 3),
  ('cgi-74-5','cg-cfc-74','Ney Kulu',    0, 1, 4),
  ('cgi-74-6','cg-cfc-74','Steamed Rice',0, 1, 5);
