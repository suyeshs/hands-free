-- Add missing activate_online and enable_inventory_sync columns to restaurant_settings
-- These columns control online features and cloud sync

-- Check if columns exist, add if missing
ALTER TABLE restaurant_settings ADD COLUMN activate_online BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN enable_inventory_sync BOOLEAN NOT NULL DEFAULT 0;
