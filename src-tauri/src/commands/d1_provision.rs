use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;
use rusqlite::{Connection, Result as SqliteResult};
use reqwest;

#[derive(Debug, Serialize, Deserialize)]
pub struct D1ProvisionResult {
    pub success: bool,
    pub output: String,
    pub tables_created: Option<u32>,
    pub error: Option<String>,
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
/// Returns CREATE TABLE and CREATE INDEX statements for D1 provisioning
#[command]
pub async fn extract_sqlite_schema(db_path: String) -> Result<Vec<String>, String> {
    println!("[Schema Extract] Extracting schema from: {}", db_path);

    // Open SQLite connection
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Query sqlite_master for all tables and indexes
    let mut stmt = conn
        .prepare(
            "SELECT sql FROM sqlite_master
             WHERE type IN ('table', 'index')
             AND name NOT LIKE 'sqlite_%'
             AND sql IS NOT NULL
             ORDER BY type DESC, name ASC"
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

            schema_statements.push(sql);
        }
    }

    println!("[Schema Extract] Extracted {} statements", schema_statements.len());

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
    })
}
