-- Attendance Sync Log - Track cloud sync status
CREATE TABLE IF NOT EXISTS attendance_sync_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    record_type TEXT NOT NULL,               -- attendance, roster, leave
    record_id TEXT NOT NULL,

    -- Sync status
    sync_status TEXT NOT NULL DEFAULT 'pending', -- pending, synced, failed
    last_sync_attempt INTEGER,
    sync_error TEXT,

    -- Tracking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_record ON attendance_sync_log(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON attendance_sync_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_log_tenant ON attendance_sync_log(tenant_id);
