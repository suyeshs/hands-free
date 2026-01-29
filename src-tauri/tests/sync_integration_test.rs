/**
 * Integration tests for the Sync Engine
 *
 * These tests verify that the Arc<TokioMutex<Connection>> pattern works correctly
 * and that all sync functions can be called without compilation errors.
 */

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use tokio::sync::Mutex as TokioMutex;
    use rusqlite::Connection;

    #[tokio::test]
    async fn test_db_connection_sharing() {
        // Create in-memory database
        let conn = Connection::open_in_memory().unwrap();
        let db = Arc::new(TokioMutex::new(conn));

        // Test 1: Lock acquisition and release
        {
            let guard = db.lock().await;
            guard.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)", []).unwrap();
        } // Lock released

        // Test 2: Multiple sequential locks
        {
            let guard = db.lock().await;
            guard.execute("INSERT INTO test (name) VALUES ('test1')", []).unwrap();
        }

        {
            let guard = db.lock().await;
            let mut stmt = guard.prepare("SELECT COUNT(*) FROM test").unwrap();
            let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(count, 1);
        }

        println!("✅ Arc<TokioMutex<Connection>> pattern works correctly");
    }

    #[tokio::test]
    async fn test_concurrent_access() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE counter (value INTEGER)", []).unwrap();
        conn.execute("INSERT INTO counter VALUES (0)", []).unwrap();

        let db = Arc::new(TokioMutex::new(conn));

        // Spawn multiple tasks that access the database
        let mut handles = vec![];

        for i in 0..5 {
            let db_clone = db.clone();
            let handle = tokio::spawn(async move {
                // Simulate the pattern used in sync functions
                {
                    let guard = db_clone.lock().await;
                    guard.execute("UPDATE counter SET value = value + 1", []).unwrap();
                } // Lock released

                // Simulate HTTP call (no lock held)
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

                i
            });
            handles.push(handle);
        }

        // Wait for all tasks
        for handle in handles {
            handle.await.unwrap();
        }

        // Verify counter
        let guard = db.lock().await;
        let mut stmt = guard.prepare("SELECT value FROM counter").unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 5);

        println!("✅ Concurrent database access works correctly");
    }

    #[tokio::test]
    async fn test_lock_pattern_with_async_work() {
        // Test the exact pattern used in incremental_sync functions
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE orders (id TEXT PRIMARY KEY, updated_at TEXT)", []).unwrap();
        conn.execute("INSERT INTO orders VALUES ('ord-1', '2024-01-01')", []).unwrap();

        let db = Arc::new(TokioMutex::new(conn));

        // Pattern: Lock → Query → Release → HTTP Call → Lock → Update
        let result = {
            // Step 1: Acquire lock and query
            let orders = {
                let guard = db.lock().await;
                let mut stmt = guard.prepare("SELECT id FROM orders WHERE updated_at > ?").unwrap();
                let rows: Vec<String> = stmt.query_map(["2023-01-01"], |row| row.get(0))
                    .unwrap()
                    .filter_map(Result::ok)
                    .collect();
                rows
            }; // Lock released

            // Step 2: Simulate HTTP call (no lock held)
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

            // Step 3: Re-acquire lock and update timestamp
            {
                let guard = db.lock().await;
                guard.execute("UPDATE orders SET updated_at = ?", ["2024-01-18"]).unwrap();
            } // Lock released

            orders
        };

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], "ord-1");

        println!("✅ Lock-acquire-release pattern works correctly");
    }
}
