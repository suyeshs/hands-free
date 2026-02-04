-- Migration: Add is_restaurant_owner flag to setup wizard state
-- Distinguishes between restaurant owners and staff during setup

-- NOTE: This column is now included in migration 025 (setup_wizard_state table creation)
-- This migration is kept for backwards compatibility but is now a no-op

-- No-op migration for backwards compatibility
SELECT 1;
