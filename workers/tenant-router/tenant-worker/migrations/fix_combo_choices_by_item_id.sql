-- Reseed combo_choices for Coorg combo meals by item ID.
-- The previous migration (add_combo_choices.sql) seeded by category_id = 'cat-combo-meals'
-- which doesn't match the actual category_id in D1 after POS sync.
-- Production item IDs use the tenant prefix 'coorg-food-company-1413-'.
UPDATE menu_items
SET combo_choices = '["Paputtu","Kadambuttu","Noolputtu","Akki Otti","Ney Kulu","Steamed Rice"]'
WHERE id IN (
  'coorg-food-company-1413-tcfc-71','coorg-food-company-1413-tcfc-72',
  'coorg-food-company-1413-tcfc-73','coorg-food-company-1413-tcfc-74',
  'coorg-food-company-1413-tcfc-75','coorg-food-company-1413-tcfc-76',
  'coorg-food-company-1413-tcfc-77','coorg-food-company-1413-tcfc-78'
);
