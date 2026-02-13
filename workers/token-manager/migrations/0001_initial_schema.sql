-- Token Manager Audit Database Schema
-- Initial migration

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  event TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  token_key TEXT,
  ip TEXT,
  metadata TEXT,  -- JSON metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_worker ON audit_logs(worker_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_token ON audit_logs(token_key, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs(event, timestamp DESC);

-- Token rotation history
CREATE TABLE IF NOT EXISTS rotation_history (
  id TEXT PRIMARY KEY,
  token_key TEXT NOT NULL,
  old_token_id TEXT,
  new_token_id TEXT,
  rotated_at TEXT NOT NULL,
  rotated_by TEXT NOT NULL,
  reason TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rotation_token ON rotation_history(token_key, rotated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rotation_timestamp ON rotation_history(rotated_at DESC);

-- Access policy changes history
CREATE TABLE IF NOT EXISTS policy_changes (
  id TEXT PRIMARY KEY,
  worker_name TEXT NOT NULL,
  change_type TEXT NOT NULL,  -- 'created', 'updated', 'deleted'
  old_policy TEXT,  -- JSON
  new_policy TEXT,  -- JSON
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_policy_worker ON policy_changes(worker_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_timestamp ON policy_changes(changed_at DESC);
