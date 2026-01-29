-- Sync metadata table for tracking last sync timestamps
CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Offline queue for failed syncs
CREATE TABLE IF NOT EXISTS sync_offline_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT
);

-- Index for faster offline queue queries
CREATE INDEX IF NOT EXISTS idx_offline_queue_table
ON sync_offline_queue(table_name, created_at);

-- Index for filtering by retry count
CREATE INDEX IF NOT EXISTS idx_offline_queue_retry
ON sync_offline_queue(retry_count);
