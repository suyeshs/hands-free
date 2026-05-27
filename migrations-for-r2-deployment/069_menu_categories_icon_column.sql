-- Add icon column to menu_categories
-- Migration 055 created menu_categories without icon, but syncMenuFromBackend inserts icon.
-- Safe to re-run: migration runner ignores "duplicate column name" errors.
ALTER TABLE menu_categories ADD COLUMN icon TEXT;
