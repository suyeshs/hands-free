/**
 * Offline Queue for Sync Operations
 * Queues failed sync operations for retry when connection is restored
 */

use rusqlite::{Connection, Result as SqliteResult, params};
use serde_json::Value;

use super::{get_current_timestamp_ms};

/// Queue item for offline sync
#[derive(Debug)]
pub struct QueueItem {
    pub id: i64,
    pub table_name: String,
    pub record_id: String,
    pub data: Value,
    pub created_at: u64,
    pub retry_count: u32,
    pub last_error: Option<String>,
}

/// Add record to offline queue
pub fn add_to_queue(
    db: &Connection,
    table_name: &str,
    record_id: &str,
    data: &Value,
) -> SqliteResult<()> {
    let data_str = serde_json::to_string(data).unwrap_or_default();
    let now = get_current_timestamp_ms();

    db.execute(
        "INSERT INTO sync_offline_queue (table_name, record_id, data, created_at, retry_count)
         VALUES (?1, ?2, ?3, ?4, 0)",
        params![table_name, record_id, data_str, now],
    )?;

    println!("[OfflineQueue] Added {} record to queue: {}", table_name, record_id);

    Ok(())
}

/// Get pending queue items for a table
pub fn get_pending_items(
    db: &Connection,
    table_name: &str,
    limit: usize,
) -> SqliteResult<Vec<QueueItem>> {
    let mut stmt = db.prepare(
        "SELECT id, table_name, record_id, data, created_at, retry_count, last_error
         FROM sync_offline_queue
         WHERE table_name = ?1 AND retry_count < 5
         ORDER BY created_at ASC
         LIMIT ?2"
    )?;

    let items_iter = stmt.query_map(params![table_name, limit], |row| {
        let data_str: String = row.get(3)?;
        let data: Value = serde_json::from_str(&data_str).unwrap_or(Value::Null);

        Ok(QueueItem {
            id: row.get(0)?,
            table_name: row.get(1)?,
            record_id: row.get(2)?,
            data,
            created_at: row.get(4)?,
            retry_count: row.get(5)?,
            last_error: row.get(6)?,
        })
    })?;

    let items: Vec<QueueItem> = items_iter.filter_map(Result::ok).collect();
    Ok(items)
}

/// Get all pending queue items (across all tables)
pub fn get_all_pending_items(db: &Connection, limit: usize) -> SqliteResult<Vec<QueueItem>> {
    let mut stmt = db.prepare(
        "SELECT id, table_name, record_id, data, created_at, retry_count, last_error
         FROM sync_offline_queue
         WHERE retry_count < 5
         ORDER BY created_at ASC
         LIMIT ?1"
    )?;

    let items_iter = stmt.query_map(params![limit], |row| {
        let data_str: String = row.get(3)?;
        let data: Value = serde_json::from_str(&data_str).unwrap_or(Value::Null);

        Ok(QueueItem {
            id: row.get(0)?,
            table_name: row.get(1)?,
            record_id: row.get(2)?,
            data,
            created_at: row.get(4)?,
            retry_count: row.get(5)?,
            last_error: row.get(6)?,
        })
    })?;

    let items: Vec<QueueItem> = items_iter.filter_map(Result::ok).collect();
    Ok(items)
}

/// Remove successfully synced item from queue
pub fn remove_from_queue(db: &Connection, id: i64) -> SqliteResult<()> {
    db.execute(
        "DELETE FROM sync_offline_queue WHERE id = ?1",
        params![id],
    )?;

    Ok(())
}

/// Increment retry count for failed sync
pub fn increment_retry_count(
    db: &Connection,
    id: i64,
    error_message: &str,
) -> SqliteResult<()> {
    db.execute(
        "UPDATE sync_offline_queue
         SET retry_count = retry_count + 1,
             last_error = ?2
         WHERE id = ?1",
        params![id, error_message],
    )?;

    Ok(())
}

/// Get queue count by table
pub fn get_queue_count(db: &Connection, table_name: Option<&str>) -> SqliteResult<usize> {
    let count: usize = if let Some(table) = table_name {
        db.query_row(
            "SELECT COUNT(*) FROM sync_offline_queue WHERE table_name = ?1 AND retry_count < 5",
            params![table],
            |row| row.get(0),
        )?
    } else {
        db.query_row(
            "SELECT COUNT(*) FROM sync_offline_queue WHERE retry_count < 5",
            [],
            |row| row.get(0),
        )?
    };

    Ok(count)
}

/// Clear old failed items (retry_count >= 5)
pub fn clear_failed_items(db: &Connection) -> SqliteResult<usize> {
    let count = db.execute(
        "DELETE FROM sync_offline_queue WHERE retry_count >= 5",
        [],
    )?;

    if count > 0 {
        println!("[OfflineQueue] Cleared {} permanently failed items", count);
    }

    Ok(count)
}

/// Clear all queue items (use with caution!)
pub fn clear_all_items(db: &Connection) -> SqliteResult<usize> {
    let count = db.execute(
        "DELETE FROM sync_offline_queue",
        [],
    )?;

    println!("[OfflineQueue] Cleared all {} queue items", count);

    Ok(count)
}

/// Get queue statistics
pub fn get_queue_stats(db: &Connection) -> SqliteResult<QueueStats> {
    let total: usize = db.query_row(
        "SELECT COUNT(*) FROM sync_offline_queue",
        [],
        |row| row.get(0),
    )?;

    let pending: usize = db.query_row(
        "SELECT COUNT(*) FROM sync_offline_queue WHERE retry_count < 5",
        [],
        |row| row.get(0),
    )?;

    let failed: usize = db.query_row(
        "SELECT COUNT(*) FROM sync_offline_queue WHERE retry_count >= 5",
        [],
        |row| row.get(0),
    )?;

    let oldest_timestamp: Option<u64> = db.query_row(
        "SELECT MIN(created_at) FROM sync_offline_queue WHERE retry_count < 5",
        [],
        |row| row.get(0),
    ).ok();

    Ok(QueueStats {
        total,
        pending,
        failed,
        oldest_timestamp,
    })
}

#[derive(Debug)]
pub struct QueueStats {
    pub total: usize,
    pub pending: usize,
    pub failed: usize,
    pub oldest_timestamp: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_queue_operations() {
        let conn = Connection::open_in_memory().unwrap();

        // Initialize table
        conn.execute(
            "CREATE TABLE sync_offline_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                retry_count INTEGER DEFAULT 0,
                last_error TEXT
            )",
            [],
        ).unwrap();

        // Add item
        let data = json!({"id": "test-1", "name": "Test Item"});
        add_to_queue(&conn, "test_table", "test-1", &data).unwrap();

        // Get count
        let count = get_queue_count(&conn, Some("test_table")).unwrap();
        assert_eq!(count, 1);

        // Get items
        let items = get_pending_items(&conn, "test_table", 10).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].record_id, "test-1");
    }
}
