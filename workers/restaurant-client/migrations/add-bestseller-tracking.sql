-- Migration: Add Bestseller Tracking to Menu Items
-- Date: 2025-12-13
-- Purpose: Track bestseller status and order counts for time-based recommendations

-- Add bestseller tracking columns to menu_items
ALTER TABLE menu_items ADD COLUMN is_bestseller INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN order_count INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN last_bestseller_update TEXT;

-- Add indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_menu_items_bestseller ON menu_items(tenant_id, is_bestseller DESC, order_count DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary ON menu_items(tenant_id, is_vegetarian, is_vegan, available);

-- Mark items with >100 orders as bestsellers (example - adjust threshold as needed)
UPDATE menu_items
SET is_bestseller = 1, last_bestseller_update = datetime('now')
WHERE order_count > 100;
