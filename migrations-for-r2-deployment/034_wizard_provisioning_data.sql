-- Migration: Add provisioning data to setup wizard state
-- Adds activation code and provisioning WebSocket URL to wizard state
-- This migrates data from localStorage to SQLite for better persistence

-- Add activation code column
ALTER TABLE setup_wizard_state
ADD COLUMN activation_code TEXT NULL;

-- Add provisioning WebSocket URL column
ALTER TABLE setup_wizard_state
ADD COLUMN provisioning_web_socket_url TEXT NULL;
