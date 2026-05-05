-- Add combo_choices column to menu_items for storing selectable options on combo meals
ALTER TABLE menu_items ADD COLUMN combo_choices TEXT;

-- Seed combo choices for coorg-food-company-1413 combo meals
UPDATE menu_items
SET combo_choices = '["Paputtu","Kadambuttu","Noolputtu","Akki Otti","Ney Kulu","Steamed Rice"]'
WHERE category_id = 'cat-combo-meals';
