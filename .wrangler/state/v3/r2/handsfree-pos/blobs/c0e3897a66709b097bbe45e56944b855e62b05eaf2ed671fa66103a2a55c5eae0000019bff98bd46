-- Add missing columns to restaurant_settings table
-- These columns were being saved from frontend but not persisting

-- NOTE: owner_name was already added in migration 042
-- NOTE: activate_online and enable_inventory_sync were already added in migration 031
-- Only adding restaurant_type and operational_scale which are genuinely new

-- Restaurant type and scale (used by frontend but never stored in DB)
ALTER TABLE restaurant_settings ADD COLUMN restaurant_type TEXT NOT NULL DEFAULT 'full-service';
ALTER TABLE restaurant_settings ADD COLUMN operational_scale TEXT NOT NULL DEFAULT 'single-location';
