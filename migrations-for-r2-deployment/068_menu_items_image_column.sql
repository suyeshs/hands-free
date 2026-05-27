-- Add image column to menu_items
-- Migration 055 (menu_base_tables) created the table with image_url TEXT,
-- but database.ts queries reference the column as 'image'.
-- This migration adds the image column for compatibility.
-- Safe to re-run: the migration runner ignores "duplicate column name" errors.
ALTER TABLE menu_items ADD COLUMN image TEXT;
UPDATE menu_items SET image = image_url WHERE image IS NULL AND image_url IS NOT NULL;
