use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;
use rusqlite::{Connection, Result as SqliteResult, params};
use reqwest;
use sha2::{Sha256, Digest};

#[derive(Debug, Serialize, Deserialize)]
pub struct D1ProvisionResult {
    pub success: bool,
    pub output: String,
    pub tables_created: Option<u32>,
    pub error: Option<String>,
    #[serde(rename = "databaseId")]
    pub database_id: Option<String>,
}

/// Provision D1 database schema using wrangler CLI
#[command]
pub async fn provision_d1_schema(
    database_id: String,
    schema_path: String,
) -> Result<D1ProvisionResult, String> {
    println!("[D1 Provision] Starting provisioning for database: {}", database_id);
    println!("[D1 Provision] Schema file: {}", schema_path);

    // Check if wrangler is installed
    let wrangler_check = Command::new("wrangler")
        .arg("--version")
        .output();

    if wrangler_check.is_err() {
        return Ok(D1ProvisionResult {
            success: false,
            output: String::new(),
            tables_created: None,
            error: Some("Wrangler CLI not found. Please install it with: npm install -g wrangler".to_string()),
            database_id: None,
        });
    }

    // Execute wrangler d1 execute command
    let output = Command::new("wrangler")
        .args(&[
            "d1",
            "execute",
            &database_id,
            "--remote",
            &format!("--file={}", schema_path),
        ])
        .output()
        .map_err(|e| format!("Failed to execute wrangler: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined_output = format!("{}\n{}", stdout, stderr);

    println!("[D1 Provision] Wrangler output:\n{}", combined_output);

    let success = output.status.success();

    // Try to extract table count from output
    let tables_created = if success {
        // Count "CREATE TABLE" occurrences in the schema file
        std::fs::read_to_string(&schema_path)
            .ok()
            .and_then(|content| {
                let count = content.matches("CREATE TABLE").count();
                Some(count as u32)
            })
    } else {
        None
    };

    Ok(D1ProvisionResult {
        success,
        output: combined_output,
        tables_created,
        error: if success {
            None
        } else {
            Some("Schema provisioning failed. Check output for details.".to_string())
        },
        database_id: Some(database_id),
    })
}

/// Check if wrangler CLI is installed
#[command]
pub async fn check_wrangler_installed() -> Result<bool, String> {
    let output = Command::new("wrangler")
        .arg("--version")
        .output();

    Ok(output.is_ok())
}

/// Get wrangler version
#[command]
pub async fn get_wrangler_version() -> Result<String, String> {
    let output = Command::new("wrangler")
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to check wrangler version: {}", e))?;

    let version = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(version.trim().to_string())
}

/// Extract SQLite schema from local database
/// Returns CREATE TABLE, CREATE INDEX, CREATE TRIGGER, and CREATE VIEW statements for D1 provisioning
#[command]
pub async fn extract_sqlite_schema(db_path: String) -> Result<Vec<String>, String> {
    println!("[Schema Extract] Extracting schema from: {}", db_path);

    // Open SQLite connection
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Query sqlite_master for all tables, indexes, triggers, and views
    // Order by type to ensure proper dependency order: tables → indexes → views → triggers
    // Exclude internal metadata tables (sync-specific, not business data)
    let mut stmt = conn
        .prepare(
            "SELECT sql FROM sqlite_master
             WHERE type IN ('table', 'index', 'trigger', 'view')
             AND name NOT LIKE 'sqlite_%'
             AND name NOT IN ('schema_migrations', 'plugin_migrations', 'sync_metadata', 'sync_offline_queue')
             AND sql IS NOT NULL
             ORDER BY CASE type
                 WHEN 'table' THEN 1
                 WHEN 'index' THEN 2
                 WHEN 'view' THEN 3
                 WHEN 'trigger' THEN 4
             END, name ASC"
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut schema_statements: Vec<String> = Vec::new();

    let rows = stmt
        .query_map([], |row| {
            let sql: String = row.get(0)?;
            Ok(sql)
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    for sql_result in rows {
        if let Ok(mut sql) = sql_result {
            // Add IF NOT EXISTS to CREATE TABLE statements (D1 requirement)
            if sql.to_uppercase().starts_with("CREATE TABLE") {
                sql = sql.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS");
            }
            // Add IF NOT EXISTS to CREATE INDEX statements
            if sql.to_uppercase().starts_with("CREATE INDEX") {
                sql = sql.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS");
            }
            // Add IF NOT EXISTS to CREATE UNIQUE INDEX statements
            if sql.to_uppercase().starts_with("CREATE UNIQUE INDEX") {
                sql = sql.replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS");
            }
            // Add IF NOT EXISTS to CREATE TRIGGER statements
            if sql.to_uppercase().starts_with("CREATE TRIGGER") {
                sql = sql.replace("CREATE TRIGGER", "CREATE TRIGGER IF NOT EXISTS");
            }
            // Add IF NOT EXISTS to CREATE VIEW statements
            if sql.to_uppercase().starts_with("CREATE VIEW") {
                sql = sql.replace("CREATE VIEW", "CREATE VIEW IF NOT EXISTS");
            }

            schema_statements.push(sql);
        }
    }

    // Always include migration tracking tables for D1 state sync
    // These were excluded from extraction above but need to exist in D1
    schema_statements.push(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            source TEXT NOT NULL CHECK(source IN ('built-in', 'cloud')),
            checksum TEXT NOT NULL,
            applied_at INTEGER NOT NULL,
            app_version TEXT NOT NULL
        )".to_string()
    );

    schema_statements.push(
        "CREATE TABLE IF NOT EXISTS plugin_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plugin_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            checksum TEXT NOT NULL,
            applied_at INTEGER NOT NULL,
            UNIQUE(plugin_id, version)
        )".to_string()
    );

    schema_statements.push(
        "CREATE INDEX IF NOT EXISTS idx_plugin_migrations_plugin_id
         ON plugin_migrations(plugin_id)".to_string()
    );

    println!("[Schema Extract] Extracted {} statements (including {} migration tracking tables)",
             schema_statements.len(), 3);

    Ok(schema_statements)
}

/// Check if a table exists in SQLite database
#[command]
pub async fn table_exists(db_path: String, table_name: String) -> Result<bool, String> {
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let exists = stmt
        .exists([&table_name])
        .map_err(|e| format!("Failed to check table existence: {}", e))?;

    Ok(exists)
}

/// Query SQLite database with parameters
#[command]
pub async fn query_sqlite(
    db_path: String,
    query: String,
    params: Vec<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    // Convert params to dynamic types
    let params_refs: Vec<&dyn rusqlite::ToSql> = params
        .iter()
        .map(|p| p as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt
        .query_map(params_refs.as_slice(), |row| {
            // Convert row to JSON object
            let column_count = row.as_ref().column_count();
            let mut map = serde_json::Map::new();

            for i in 0..column_count {
                let column_name = row.as_ref().column_name(i).unwrap_or("unknown").to_string();

                // Try to get value as different types
                let value: serde_json::Value = if let Ok(v) = row.get::<_, String>(i) {
                    serde_json::Value::String(v)
                } else if let Ok(v) = row.get::<_, i64>(i) {
                    serde_json::Value::Number(serde_json::Number::from(v))
                } else if let Ok(v) = row.get::<_, f64>(i) {
                    serde_json::Number::from_f64(v)
                        .map(serde_json::Value::Number)
                        .unwrap_or(serde_json::Value::Null)
                } else if let Ok(v) = row.get::<_, bool>(i) {
                    serde_json::Value::Bool(v)
                } else {
                    serde_json::Value::Null
                };

                map.insert(column_name, value);
            }

            Ok(serde_json::Value::Object(map))
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut results = Vec::new();
    for row_result in rows {
        if let Ok(row) = row_result {
            results.push(row);
        }
    }

    Ok(results)
}

/// Provision D1 database via worker API with custom schema
#[command]
pub async fn provision_d1_via_worker(
    tenant_id: String,
    worker_url: String,
    database_name: String,
    schema: Vec<String>,
) -> Result<D1ProvisionResult, String> {
    println!("[D1 Provision] Provisioning D1 for tenant: {}", tenant_id);
    println!("[D1 Provision] Worker URL: {}", worker_url);
    println!("[D1 Provision] Database name: {}", database_name);
    println!("[D1 Provision] Schema statements: {}", schema.len());

    let client = reqwest::Client::new();

    // Build request body
    let request_body = serde_json::json!({
        "databaseName": database_name,
        "schema": schema,
    });

    // Call worker endpoint
    let endpoint = format!("{}/{}", worker_url, tenant_id);
    println!("[D1 Provision] Calling endpoint: {}", endpoint);

    let response = client
        .post(&endpoint)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to call worker API: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    println!("[D1 Provision] Response status: {}", status);
    println!("[D1 Provision] Response body: {}", response_text);

    if !status.is_success() {
        return Ok(D1ProvisionResult {
            success: false,
            output: response_text.clone(),
            tables_created: None,
            error: Some(format!("Worker API returned error: {}", response_text)),
            database_id: None,
        });
    }

    // Parse response
    let response_json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;

    let success = response_json["success"].as_bool().unwrap_or(false);
    let table_count = response_json["tableCount"].as_u64().map(|n| n as u32);
    let database_id = response_json["databaseId"].as_str().unwrap_or("").to_string();

    println!("[D1 Provision] Success: {}, Tables: {:?}, DB ID: {}", success, table_count, database_id);

    Ok(D1ProvisionResult {
        success,
        output: format!("Database ID: {}\n{}", database_id, response_text),
        tables_created: table_count,
        error: if success { None } else { Some("Provisioning failed".to_string()) },
        database_id: if database_id.is_empty() { None } else { Some(database_id) },
    })
}

/// Schema sync result
#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaSyncResult {
    pub updated: bool,
    pub statements_applied: usize,
    pub old_checksum: String,
    pub new_checksum: String,
}

/// Sync current schema to D1 (incremental update)
/// This updates an existing D1 database with new schema elements (triggers, views, plugin tables)
#[command]
pub async fn sync_schema_to_d1(
    tenant_id: String,
    database_id: String,
    db_path: String,
) -> Result<SchemaSyncResult, String> {
    println!("[D1 Schema Sync] Starting schema sync for tenant: {}", tenant_id);

    // 1. Extract current schema (now includes triggers, views, plugin tables)
    let current_schema = extract_sqlite_schema(db_path.clone()).await?;
    println!("[D1 Schema Sync] Extracted {} statements", current_schema.len());

    // 2. Compute checksum of current schema
    let new_checksum = compute_schema_checksum(&current_schema);

    // 3. Get last synced checksum from SQLite metadata
    let old_checksum = get_d1_schema_checksum(&db_path, &tenant_id)?;

    // 4. Compare checksums - skip if unchanged
    if new_checksum == old_checksum {
        println!("[D1 Schema Sync] Schema unchanged (checksum: {})", new_checksum);
        return Ok(SchemaSyncResult {
            updated: false,
            statements_applied: 0,
            old_checksum,
            new_checksum,
        });
    }

    println!("[D1 Schema Sync] Schema changed:");
    println!("  Old checksum: {}", old_checksum);
    println!("  New checksum: {}", new_checksum);

    // 5. Write schema to temp file
    let temp_dir = std::env::temp_dir();
    let schema_file = temp_dir.join(format!("d1_schema_sync_{}.sql", tenant_id));
    std::fs::write(&schema_file, current_schema.join(";\n\n"))
        .map_err(|e| format!("Failed to write schema file: {}", e))?;

    println!("[D1 Schema Sync] Schema file: {:?}", schema_file);

    // 6. Apply schema to D1 using wrangler (idempotent - all CREATE IF NOT EXISTS)
    let provision_result = provision_d1_schema(
        database_id.clone(),
        schema_file.to_str().unwrap().to_string()
    ).await?;

    // Clean up temp file
    let _ = std::fs::remove_file(&schema_file);

    if !provision_result.success {
        return Err(format!("Schema sync failed: {}",
            provision_result.error.unwrap_or_else(|| "Unknown error".to_string())));
    }

    // 7. Store new checksum in SQLite metadata
    store_d1_schema_checksum(&db_path, &tenant_id, &new_checksum)?;

    println!("[D1 Schema Sync] ✅ Schema synced successfully");
    println!("  Statements applied: {}", current_schema.len());
    println!("  New checksum: {}", new_checksum);

    Ok(SchemaSyncResult {
        updated: true,
        statements_applied: current_schema.len(),
        old_checksum,
        new_checksum,
    })
}

/// Compute SHA256 checksum of schema statements
fn compute_schema_checksum(schema: &[String]) -> String {
    let combined = schema.join("\n");
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Get last D1 schema checksum from SQLite metadata
fn get_d1_schema_checksum(db_path: &str, tenant_id: &str) -> Result<String, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let key = format!("d1:{}:schema_checksum", tenant_id);

    let checksum: String = conn.query_row(
        "SELECT value FROM sync_metadata WHERE key = ?",
        params![key],
        |row| row.get(0)
    ).unwrap_or_else(|_| String::from("none"));

    Ok(checksum)
}

/// Store D1 schema checksum in SQLite metadata
fn store_d1_schema_checksum(db_path: &str, tenant_id: &str, checksum: &str) -> Result<(), String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let key = format!("d1:{}:schema_checksum", tenant_id);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)",
        params![key, checksum, now],
    ).map_err(|e| format!("Failed to store checksum: {}", e))?;

    Ok(())
}

/// Execute SQLite command (INSERT, UPDATE, DELETE)
#[command]
pub async fn execute_sqlite(
    db_path: String,
    query: String,
    params: Vec<String>,
) -> Result<usize, String> {
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Convert params to dynamic types
    let params_refs: Vec<&dyn rusqlite::ToSql> = params
        .iter()
        .map(|p| p as &dyn rusqlite::ToSql)
        .collect();

    let affected_rows = conn
        .execute(&query, params_refs.as_slice())
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    Ok(affected_rows)
}
