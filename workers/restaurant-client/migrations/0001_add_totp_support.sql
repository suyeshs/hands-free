-- Migration: Add TOTP (Time-based One-Time Password) support to admin_users
-- This enables authenticator app-based 2FA (Google Authenticator, Authy, etc.)

-- Add TOTP fields to admin_users table
ALTER TABLE admin_users ADD COLUMN totp_secret TEXT;
ALTER TABLE admin_users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN totp_backup_codes TEXT; -- JSON array of backup codes
ALTER TABLE admin_users ADD COLUMN totp_created_at TEXT;
ALTER TABLE admin_users ADD COLUMN totp_verified_at TEXT; -- When user first successfully verified TOTP

-- Create index on totp_enabled for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_totp_enabled ON admin_users(totp_enabled);

-- Optional: Create audit log table for TOTP events
CREATE TABLE IF NOT EXISTS admin_totp_audit (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  admin_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'setup', 'verify_success', 'verify_failure', 'backup_code_used', 'disabled'
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_totp_audit_user ON admin_totp_audit(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_totp_audit_created ON admin_totp_audit(created_at);
