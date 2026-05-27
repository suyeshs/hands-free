-- Migration: Update table_sessions schema for QR code ordering
-- Adds columns needed for cryptographically secure table sessions
-- Maintains backward compatibility with existing sessions

-- Add new columns for QR code ordering (IF NOT EXISTS for safety)
ALTER TABLE table_sessions ADD COLUMN table_id TEXT;
ALTER TABLE table_sessions ADD COLUMN session_token TEXT;
ALTER TABLE table_sessions ADD COLUMN signature TEXT;
ALTER TABLE table_sessions ADD COLUMN activated_at TEXT;
ALTER TABLE table_sessions ADD COLUMN expires_at TEXT;
ALTER TABLE table_sessions ADD COLUMN activated_by TEXT;
ALTER TABLE table_sessions ADD COLUMN device_fingerprint TEXT;
ALTER TABLE table_sessions ADD COLUMN closed_by TEXT;

-- Migrate existing data: Copy table_number to table_id
UPDATE table_sessions SET table_id = CAST(table_number AS TEXT) WHERE table_id IS NULL;

-- Migrate existing data: Copy started_at to activated_at
UPDATE table_sessions SET activated_at = started_at WHERE activated_at IS NULL;

-- Migrate existing data: Set expires_at to 4 hours after activated_at
UPDATE table_sessions
SET expires_at = datetime(started_at, '+4 hours')
WHERE expires_at IS NULL;

-- Update status values: 'active' -> 'occupied', keep 'closed' as 'available'
UPDATE table_sessions SET status = 'occupied' WHERE status = 'active';
UPDATE table_sessions SET status = 'available' WHERE status = 'closed';

-- Create index on table_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);

-- Create index on session_token for validation lookups
CREATE INDEX IF NOT EXISTS idx_table_sessions_token ON table_sessions(session_token);

-- Create unique index for one occupied session per table
DROP INDEX IF EXISTS idx_table_sessions_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_occupied
ON table_sessions(table_id, tenant_id)
WHERE status = 'occupied';

-- Note: We keep the old columns (table_number, started_at, server_name, guest_count, order_data)
-- for backward compatibility. New code should use table_id and activated_at.
