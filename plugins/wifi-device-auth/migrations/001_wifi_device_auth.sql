-- ==================== WIFI-VERIFIED DEVICE AUTHENTICATION MIGRATION ====================
-- Migration to add WiFi-verified device registration without OTP/PIN
-- Compatible with existing POS staff_users table structure
--
-- **IMPORTANT**: This migration is ADDITIVE and safe to run on existing databases
-- It does NOT remove PIN columns (for gradual migration)
--
-- Date: 2026-02-06
-- Version: 1.0.0
-- ==================== END HEADER ====================

-- ==================== STEP 1: CREATE TENANT CONFIG TABLE ====================
-- Stores per-tenant WiFi and authentication configuration

CREATE TABLE IF NOT EXISTS tenant_config (
  tenant_id TEXT PRIMARY KEY,

  -- WiFi verification settings
  wifi_ssid TEXT,                              -- Restaurant WiFi SSID for staff registration
  wifi_verification_enabled INTEGER DEFAULT 1, -- 1 = enabled, 0 = disabled
  device_expiry_days INTEGER DEFAULT 90,       -- Device token expiry in days
  biometric_required INTEGER DEFAULT 1,        -- 1 = required, 0 = optional

  -- General settings
  timezone TEXT DEFAULT 'Asia/Kolkata',
  business_hours_start TEXT DEFAULT '09:00',
  business_hours_end TEXT DEFAULT '23:00',

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant ON tenant_config(tenant_id);

-- Trigger to update tenant_config timestamp
CREATE TRIGGER IF NOT EXISTS update_tenant_config_timestamp
AFTER UPDATE ON tenant_config
BEGIN
  UPDATE tenant_config SET updated_at = unixepoch() WHERE tenant_id = NEW.tenant_id;
END;

-- ==================== STEP 2: UPDATE STAFF_USERS TABLE ====================
-- Add registration tracking fields to existing staff_users table

-- Add phone column (for identification, not authentication)
ALTER TABLE staff_users ADD COLUMN phone TEXT;

-- Add registration token tracking
ALTER TABLE staff_users ADD COLUMN registration_token TEXT;
ALTER TABLE staff_users ADD COLUMN registration_token_expires_at INTEGER;

-- Add device registration status
ALTER TABLE staff_users ADD COLUMN device_registered INTEGER DEFAULT 0 CHECK (device_registered IN (0, 1));

-- Add invitation tracking
ALTER TABLE staff_users ADD COLUMN invited_at INTEGER;
ALTER TABLE staff_users ADD COLUMN registered_at INTEGER;

-- Add remote access control (1 for managers, 0 for staff)
ALTER TABLE staff_users ADD COLUMN allow_remote_access INTEGER DEFAULT 1 CHECK (allow_remote_access IN (0, 1));

-- Create index for registration token lookup
CREATE INDEX IF NOT EXISTS idx_staff_users_reg_token ON staff_users(registration_token) WHERE registration_token IS NOT NULL;

-- Create index for phone lookup
CREATE INDEX IF NOT EXISTS idx_staff_users_phone ON staff_users(phone) WHERE phone IS NOT NULL;

-- ==================== STEP 3: UPDATE REGISTRATION_TOKENS TABLE ====================
-- Add WiFi verification fields to existing registration_tokens table
-- (Table should already exist from device registration migration)

ALTER TABLE registration_tokens ADD COLUMN token_short_code TEXT;  -- 6-digit code for SMS
ALTER TABLE registration_tokens ADD COLUMN wifi_verification_required INTEGER DEFAULT 1 CHECK (wifi_verification_required IN (0, 1));
ALTER TABLE registration_tokens ADD COLUMN allowed_wifi_ssid TEXT;  -- Required SSID for registration
ALTER TABLE registration_tokens ADD COLUMN token_hash TEXT;  -- SHA256 of actual token

-- Create index for short code lookup
CREATE INDEX IF NOT EXISTS idx_tokens_short_code ON registration_tokens(token_short_code) WHERE token_short_code IS NOT NULL;

-- Create index for token hash lookup
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON registration_tokens(token_hash) WHERE token_hash IS NOT NULL;

-- Create index for WiFi verification lookup
CREATE INDEX IF NOT EXISTS idx_tokens_wifi_required ON registration_tokens(tenant_id, wifi_verification_required);

-- ==================== STEP 4: UPDATE REGISTERED_DEVICES TABLE ====================
-- Add biometric and WiFi tracking fields to existing registered_devices table
-- (Table should already exist from device registration migration)

ALTER TABLE registered_devices ADD COLUMN biometric_type TEXT;  -- 'faceID', 'touchID', 'fingerprint', 'none'
ALTER TABLE registered_devices ADD COLUMN biometric_reset_required INTEGER DEFAULT 0 CHECK (biometric_reset_required IN (0, 1));
ALTER TABLE registered_devices ADD COLUMN registered_via_wifi TEXT;  -- SSID used during registration
ALTER TABLE registered_devices ADD COLUMN registration_location TEXT;  -- GPS coordinates (optional)
ALTER TABLE registered_devices ADD COLUMN registration_token_used TEXT;  -- Which token was used
ALTER TABLE registered_devices ADD COLUMN last_ip_address TEXT;  -- Last known IP

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_devices_biometric ON registered_devices(tenant_id, biometric_type);
CREATE INDEX IF NOT EXISTS idx_devices_wifi ON registered_devices(registered_via_wifi) WHERE registered_via_wifi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_token_used ON registered_devices(registration_token_used) WHERE registration_token_used IS NOT NULL;

-- Create index to link devices with staff users
CREATE INDEX IF NOT EXISTS idx_devices_user_staff ON registered_devices(user_id);

-- ==================== STEP 5: DATA MIGRATION HELPERS ====================
-- Update allow_remote_access based on existing roles

UPDATE staff_users
SET allow_remote_access = CASE
  WHEN role = 'manager' THEN 1
  ELSE 0
END
WHERE allow_remote_access IS NULL;

-- ==================== VERIFICATION QUERIES ====================
-- Run these queries after migration to verify success:
--
-- 1. Check tenant_config table exists:
--    SELECT name FROM sqlite_master WHERE type='table' AND name='tenant_config';
--
-- 2. Check staff_users new columns:
--    PRAGMA table_info(staff_users);
--
-- 3. Check registration_tokens new columns:
--    PRAGMA table_info(registration_tokens);
--
-- 4. Check registered_devices new columns:
--    PRAGMA table_info(registered_devices);
--
-- 5. Check indexes were created:
--    SELECT name FROM sqlite_master WHERE type='index'
--    AND (name LIKE '%reg_token%' OR name LIKE '%wifi%' OR name LIKE '%biometric%');

-- ==================== USAGE NOTES ====================
--
-- After applying this migration:
--
-- 1. CONFIGURE TENANT WIFI:
--    For each tenant, insert WiFi configuration:
--
--    INSERT OR REPLACE INTO tenant_config (tenant_id, wifi_ssid, wifi_verification_enabled)
--    VALUES ('your-tenant-id', 'Restaurant_WiFi', 1);
--
-- 2. GENERATE REGISTRATION TOKENS:
--    When adding new staff via admin panel, create registration token:
--
--    INSERT INTO registration_tokens (
--      token_id, tenant_id, user_id, role, token_hash, token_short_code,
--      wifi_verification_required, allowed_wifi_ssid, created_by, expires_at, max_uses
--    ) VALUES (
--      'uuid', 'tenant-id', 'staff-user-id', 'cashier', 'sha256-hash', '123456',
--      1, 'Restaurant_WiFi', 'admin-id', unixepoch() + 604800, 1
--    );
--
-- 3. MIGRATE EXISTING STAFF:
--    For staff currently using PIN authentication:
--    a. Generate registration tokens for each staff member
--    b. Send invitations to their phones (SMS/WhatsApp/Email)
--    c. Have them register their devices on restaurant WiFi
--    d. Once all staff migrated, optionally remove pin_hash column
--
-- 4. DEVICE REGISTRATION FLOW:
--    - Staff receives invitation with 6-digit code or QR code
--    - Downloads app and enters code
--    - App verifies WiFi SSID (for non-managers)
--    - Device is registered with biometric setup
--    - Staff can now use app from anywhere (after initial WiFi registration)

-- ==================== PIN COLUMN REMOVAL (OPTIONAL) ====================
-- ⚠️ ONLY RUN THIS AFTER ALL STAFF HAVE MIGRATED TO DEVICE REGISTRATION
-- ⚠️ THIS IS IRREVERSIBLE - BACKUP YOUR DATABASE FIRST
--
-- To remove PIN-based authentication after full migration:
--
-- Step 1: Verify all staff have registered devices
-- SELECT s.id, s.name, s.device_registered, COUNT(d.device_id) as device_count
-- FROM staff_users s
-- LEFT JOIN registered_devices d ON d.user_id = s.id AND d.is_active = 1
-- WHERE s.is_active = 1
-- GROUP BY s.id, s.name, s.device_registered
-- HAVING device_count = 0;
--
-- If above query returns 0 rows, all staff have registered devices
--
-- Step 2: Remove pin_hash column (SQLite requires table recreation)
-- This is complex in SQLite and should be done carefully:
--
-- BEGIN TRANSACTION;
--
-- -- Create new table without pin_hash
-- CREATE TABLE staff_users_new (
--   id TEXT PRIMARY KEY,
--   tenant_id TEXT NOT NULL,
--   name TEXT NOT NULL,
--   role TEXT NOT NULL CHECK (role IN ('cashier', 'waiter', 'kitchen', 'manager')),
--   is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
--   permissions TEXT,
--   created_at INTEGER NOT NULL,
--   last_login_at INTEGER,
--   created_by TEXT,
--   phone TEXT,
--   registration_token TEXT,
--   registration_token_expires_at INTEGER,
--   device_registered INTEGER DEFAULT 0 CHECK (device_registered IN (0, 1)),
--   invited_at INTEGER,
--   registered_at INTEGER,
--   allow_remote_access INTEGER DEFAULT 1 CHECK (allow_remote_access IN (0, 1)),
--   UNIQUE(tenant_id, name)
-- );
--
-- -- Copy data from old table (excluding pin_hash)
-- INSERT INTO staff_users_new SELECT
--   id, tenant_id, name, role, is_active, permissions, created_at, last_login_at, created_by,
--   phone, registration_token, registration_token_expires_at, device_registered,
--   invited_at, registered_at, allow_remote_access
-- FROM staff_users;
--
-- -- Drop old table
-- DROP TABLE staff_users;
--
-- -- Rename new table
-- ALTER TABLE staff_users_new RENAME TO staff_users;
--
-- -- Recreate indexes
-- CREATE INDEX idx_staff_tenant ON staff_users(tenant_id);
-- CREATE INDEX idx_staff_active ON staff_users(is_active);
-- CREATE INDEX idx_staff_users_reg_token ON staff_users(registration_token) WHERE registration_token IS NOT NULL;
-- CREATE INDEX idx_staff_users_phone ON staff_users(phone) WHERE phone IS NOT NULL;
--
-- COMMIT;

-- ==================== ROLLBACK PROCEDURE ====================
--
-- If you need to rollback this migration (before removing PIN column):
--
-- DROP TABLE tenant_config;
-- DROP INDEX idx_staff_users_reg_token;
-- DROP INDEX idx_staff_users_phone;
-- DROP INDEX idx_tokens_short_code;
-- DROP INDEX idx_tokens_hash;
-- DROP INDEX idx_tokens_wifi_required;
-- DROP INDEX idx_devices_biometric;
-- DROP INDEX idx_devices_wifi;
-- DROP INDEX idx_devices_token_used;
-- DROP INDEX idx_devices_user_staff;
--
-- Note: ALTER TABLE DROP COLUMN is not supported in older SQLite versions
-- You would need to recreate the tables without the new columns

-- ==================== COMPATIBILITY NOTES ====================
--
-- This migration is designed to work with:
-- ✅ Existing POS staff_users table (from restaurant-pos-ai)
-- ✅ Handsfree platform tenant-schema.sql
-- ✅ Corporate chain schema (tenant-schema-corporate-chain.sql)
-- ✅ Existing device registration tables (registration_tokens, registered_devices)
--
-- The migration is ADDITIVE - it adds new fields without removing existing ones
-- This allows for gradual migration from PIN-based to device-based auth
--
-- Tested with:
-- - SQLite 3.35+ (Cloudflare D1)
-- - Restaurant POS AI database schema
-- - Handsfree platform database schema

-- ==================== END OF MIGRATION ====================
