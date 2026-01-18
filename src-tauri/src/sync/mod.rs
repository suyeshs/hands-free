// Sync module for Tauri backend
// Handles all sync operations between local SQLite and cloud D1

pub mod incremental_sync;
pub mod tiered_scheduler;
pub mod offline_queue;
pub mod commands;

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub tenant_id: String,
    pub api_base_url: String,
    pub enable_auto_sync: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub success: bool,
    pub synced: usize,
    pub failed: usize,
    pub errors: Vec<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_syncing: bool,
    pub last_sync: Option<u64>,
    pub pending_count: usize,
    pub is_online: bool,
}

pub type DbConnection = Arc<Mutex<Connection>>;

/// Get current timestamp in ISO 8601 format
pub fn get_current_timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    chrono::DateTime::from_timestamp(now as i64, 0)
        .unwrap()
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string()
}

/// Get UNIX timestamp in milliseconds
pub fn get_current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Initialize sync system
pub fn init_sync_system(db: &Connection) -> SqliteResult<()> {
    // Create sync metadata table
    db.execute(
        "CREATE TABLE IF NOT EXISTS sync_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Create offline queue table
    db.execute(
        "CREATE TABLE IF NOT EXISTS sync_offline_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            retry_count INTEGER DEFAULT 0,
            last_error TEXT
        )",
        [],
    )?;

    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_offline_queue_table
         ON sync_offline_queue(table_name, created_at)",
        [],
    )?;

    Ok(())
}

/// Get last sync timestamp for a table
pub fn get_last_sync_timestamp(db: &Connection, table_name: &str) -> SqliteResult<String> {
    let key = format!("sync:{}:last_timestamp", table_name);

    let result: Result<String, rusqlite::Error> = db.query_row(
        "SELECT value FROM sync_metadata WHERE key = ?1",
        [&key],
        |row| row.get(0),
    );

    match result {
        Ok(timestamp) => Ok(timestamp),
        Err(_) => Ok("1970-01-01T00:00:00Z".to_string()), // Default to epoch
    }
}

/// Update last sync timestamp for a table
pub fn update_last_sync_timestamp(
    db: &Connection,
    table_name: &str,
    timestamp: Option<String>,
) -> SqliteResult<()> {
    let key = format!("sync:{}:last_timestamp", table_name);
    let value = timestamp.unwrap_or_else(get_current_timestamp);
    let now = get_current_timestamp_ms();

    db.execute(
        "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?1, ?2, ?3)",
        [&key, &value, &now.to_string()],
    )?;

    Ok(())
}

/// Check if online
pub fn is_online() -> bool {
    // Simple check - try to resolve DNS
    match std::net::UdpSocket::bind("0.0.0.0:0") {
        Ok(socket) => {
            socket.connect("8.8.8.8:53").is_ok()
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_current_timestamp() {
        let timestamp = get_current_timestamp();
        assert!(timestamp.contains("T"));
        assert!(timestamp.ends_with("Z"));
    }

    #[test]
    fn test_get_current_timestamp_ms() {
        let ts = get_current_timestamp_ms();
        assert!(ts > 0);
    }
}
