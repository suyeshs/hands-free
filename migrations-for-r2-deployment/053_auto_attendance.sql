-- Migration: Auto-Attendance on WiFi Connection
-- Adds support for automatic attendance marking when staff connect to restaurant WiFi

-- Add auto-attendance tracking columns to attendance_records table
ALTER TABLE attendance_records
ADD COLUMN clock_in_method TEXT DEFAULT 'manual'; -- 'manual', 'wifi-auto', 'scheduled'

ALTER TABLE attendance_records
ADD COLUMN clock_in_device_id TEXT;

-- Add auto-attendance settings to restaurant_settings table
ALTER TABLE restaurant_settings
ADD COLUMN auto_attendance_enabled INTEGER DEFAULT 0; -- 0 = disabled, 1 = enabled

-- Create or update device_settings table for device-staff assignment
CREATE TABLE IF NOT EXISTS device_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    tenant_id TEXT NOT NULL,
    assigned_staff_id TEXT, -- Staff member assigned to this device for auto-attendance
    device_mode TEXT DEFAULT 'owner', -- 'owner' or 'staff'
    locked_mode INTEGER DEFAULT 0,
    lan_server_enabled INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

-- Add assigned_staff_id column if device_settings table already exists
-- This will fail silently if the column already exists (SQLite doesn't support IF NOT EXISTS for ALTER COLUMN)
-- ALTER TABLE device_settings
-- ADD COLUMN assigned_staff_id TEXT;

-- Create index for faster device settings queries
CREATE INDEX IF NOT EXISTS idx_device_settings_tenant ON device_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_settings_staff ON device_settings(assigned_staff_id);

-- Create index for faster attendance queries by clock-in method
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in_method ON attendance_records(clock_in_method);
