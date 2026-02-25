-- Migration: Add clock_in_method and clock_in_device_id to attendance_records
-- Date: 2026-02-18
-- Description: Adds columns for tracking how staff clocked in (manual vs WiFi auto) and which device was used

-- Add clock_in_method column (manual, wifi-auto, etc.)
ALTER TABLE attendance_records ADD COLUMN clock_in_method TEXT DEFAULT 'manual';

-- Add clock_in_device_id column (for tracking which device was used for clock-in)
ALTER TABLE attendance_records ADD COLUMN clock_in_device_id TEXT;

-- Create index for quick lookups by clock-in method
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in_method ON attendance_records(clock_in_method);
