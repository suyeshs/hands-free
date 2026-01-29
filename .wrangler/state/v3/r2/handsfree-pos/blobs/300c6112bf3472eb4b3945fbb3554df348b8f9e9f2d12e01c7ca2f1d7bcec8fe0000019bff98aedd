-- Migration: Add is_restaurant_owner flag to setup wizard state
-- Tracks whether the user created the restaurant (vs activating existing one)
-- This replaces is_restaurant_owner in localStorage

-- Add is_restaurant_owner column
ALTER TABLE setup_wizard_state
ADD COLUMN is_restaurant_owner BOOLEAN NOT NULL DEFAULT 0;
