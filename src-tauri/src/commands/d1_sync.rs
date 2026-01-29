/**
 * D1 Sync Commands
 * Handles provisioning and syncing local SQLite to Cloudflare D1 via worker
 */

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use reqwest::Client;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct D1SyncResult {
    pub success: bool,
    pub synced: usize,
    pub failed: usize,
    pub errors: Vec<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct D1ProvisionStatus {
    pub provisioned: bool,
    pub database_id: Option<String>,
    pub database_name: Option<String>,
    pub table_count: Option<u32>,
}

/// Provision D1 database with schema and initial data
#[command]
pub async fn provision_d1_full(
    tenant_id: String,
    db_path: String,
    worker_url: String,
) -> Result<D1SyncResult, String> {
    println!("[D1 Sync] Starting full provisioning for tenant: {}", tenant_id);

    let start = std::time::Instant::now();
    let mut total_synced = 0;
    let mut total_failed = 0;
    let mut all_errors = Vec::new();

    // Step 1: Extract schema from local SQLite
    println!("[D1 Sync] Extracting schema...");
    let schema = extract_schema(&db_path)?;
    println!("[D1 Sync] Extracted {} schema statements", schema.len());

    // Step 2: Provision D1 database via worker
    println!("[D1 Sync] Provisioning D1 database...");
    let database_name = format!("{}_db", tenant_id.replace("-", "_"));

    let client = Client::new();
    let provision_url = format!("{}/api/provision/{}", worker_url, tenant_id);

    let provision_response = client
        .post(&provision_url)
        .json(&json!({
            "databaseName": database_name,
            "schema": schema,
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to call provision endpoint: {}", e))?;

    if !provision_response.status().is_success() {
        return Err(format!(
            "Provisioning failed: HTTP {}",
            provision_response.status()
        ));
    }

    let provision_result: Value = provision_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse provision response: {}", e))?;

    if !provision_result["success"].as_bool().unwrap_or(false) {
        return Err(format!(
            "Provisioning failed: {}",
            provision_result["error"].as_str().unwrap_or("Unknown error")
        ));
    }

    println!("[D1 Sync] Database provisioned successfully");

    // Step 3: Sync all data
    println!("[D1 Sync] Starting initial data sync...");

    let data_types = vec![
        "sales",
        "tips",
        "menu",
        "staff",
        "settings",
        "floor-plan",
        "inventory",
    ];

    for data_type in data_types {
        match sync_data_type(&tenant_id, &db_path, &worker_url, data_type).await {
            Ok(result) => {
                total_synced += result.synced;
                total_failed += result.failed;
                all_errors.extend(result.errors);
                println!(
                    "[D1 Sync] {} sync: {} synced, {} failed",
                    data_type, result.synced, result.failed
                );
            }
            Err(e) => {
                all_errors.push(format!("{} sync failed: {}", data_type, e));
            }
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(D1SyncResult {
        success: all_errors.is_empty(),
        synced: total_synced,
        failed: total_failed,
        errors: all_errors,
        duration_ms,
    })
}

/// Sync specific data type incrementally
#[command]
pub async fn sync_to_d1(
    tenant_id: String,
    db_path: String,
    worker_url: String,
    data_type: String,
) -> Result<D1SyncResult, String> {
    let start = std::time::Instant::now();

    let result = sync_data_type(&tenant_id, &db_path, &worker_url, &data_type).await?;

    Ok(D1SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Check D1 provisioning status
#[command]
pub async fn check_d1_status(
    tenant_id: String,
    worker_url: String,
) -> Result<D1ProvisionStatus, String> {
    let client = Client::new();
    let status_url = format!("{}/api/provision/{}/status", worker_url, tenant_id);

    let response = client
        .get(&status_url)
        .send()
        .await
        .map_err(|e| format!("Failed to check status: {}", e))?;

    let status: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse status response: {}", e))?;

    Ok(D1ProvisionStatus {
        provisioned: status["provisioned"].as_bool().unwrap_or(false),
        database_id: status["databaseId"].as_str().map(String::from),
        database_name: status["databaseName"].as_str().map(String::from),
        table_count: status["tableCount"].as_u64().map(|n| n as u32),
    })
}

// Helper: Extract schema from SQLite
fn extract_schema(db_path: &str) -> Result<Vec<String>, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT sql FROM sqlite_master
             WHERE type IN ('table', 'index')
             AND name NOT LIKE 'sqlite_%'
             AND sql IS NOT NULL
             ORDER BY type DESC, name ASC"
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let mut sql: String = row.get(0)?;

            // Add IF NOT EXISTS for D1 compatibility
            if sql.to_uppercase().starts_with("CREATE TABLE") {
                sql = sql.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS");
            }
            if sql.to_uppercase().starts_with("CREATE INDEX") {
                sql = sql.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS");
            }
            if sql.to_uppercase().starts_with("CREATE UNIQUE INDEX") {
                sql = sql.replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS");
            }

            Ok(sql)
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut schema_statements = Vec::new();
    for row in rows {
        if let Ok(sql) = row {
            schema_statements.push(sql);
        }
    }

    Ok(schema_statements)
}

// Helper: Sync specific data type
async fn sync_data_type(
    tenant_id: &str,
    db_path: &str,
    worker_url: &str,
    data_type: &str,
) -> Result<D1SyncResult, String> {
    let records = extract_records_for_type(db_path, data_type)?;

    if records.is_empty() {
        return Ok(D1SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: 0,
        });
    }

    println!("[D1 Sync] Syncing {} {} records", records.len(), data_type);

    let client = Client::new();
    let sync_url = format!("{}/api/sync/{}", worker_url, tenant_id);

    let response = client
        .post(&sync_url)
        .json(&json!({
            "dataType": data_type,
            "records": records,
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to sync {}: {}", data_type, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Sync failed: HTTP {}",
            response.status()
        ));
    }

    let result: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse sync response: {}", e))?;

    Ok(D1SyncResult {
        success: true,
        synced: result["synced"].as_u64().unwrap_or(0) as usize,
        failed: result["failed"].as_u64().unwrap_or(0) as usize,
        errors: result["errors"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default(),
        duration_ms: 0,
    })
}

// Helper: Extract records for a specific data type
fn extract_records_for_type(db_path: &str, data_type: &str) -> Result<Vec<Value>, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let records = match data_type {
        "sales" => extract_sales(&conn)?,
        "tips" => extract_tips(&conn)?,
        "menu" => extract_menu(&conn)?,
        "staff" => extract_staff(&conn)?,
        "settings" => extract_settings(&conn)?,
        "floor-plan" => extract_floor_plan(&conn)?,
        "inventory" => extract_inventory(&conn)?,
        _ => return Err(format!("Unknown data type: {}", data_type)),
    };

    Ok(records)
}

// Extract functions for each data type

fn extract_sales(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, tenant_id, order_id, total_amount, payment_method,
                completed_at, created_at, updated_at
         FROM sales_transactions
         ORDER BY completed_at DESC
         LIMIT 1000"
    ).map_err(|e| format!("Failed to prepare sales query: {}", e))?;

    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "tenant_id": row.get::<_, String>(1)?,
            "order_id": row.get::<_, String>(2)?,
            "total_amount": row.get::<_, f64>(3)?,
            "payment_method": row.get::<_, String>(4)?,
            "completed_at": row.get::<_, String>(5)?,
            "created_at": row.get::<_, String>(6)?,
            "updated_at": row.get::<_, String>(7)?,
        }))
    }).map_err(|e| format!("Failed to query sales: {}", e))?;

    Ok(rows.filter_map(Result::ok).collect::<Vec<_>>())
}

fn extract_tips(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, tenant_id, sale_id, staff_id, amount, tip_type, created_at
         FROM tips
         ORDER BY created_at DESC
         LIMIT 1000"
    ).map_err(|e| format!("Failed to prepare tips query: {}", e))?;

    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "tenant_id": row.get::<_, String>(1)?,
            "sale_id": row.get::<_, Option<String>>(2)?,
            "staff_id": row.get::<_, Option<String>>(3)?,
            "amount": row.get::<_, f64>(4)?,
            "tip_type": row.get::<_, String>(5)?,
            "created_at": row.get::<_, String>(6)?,
        }))
    }).map_err(|e| format!("Failed to query tips: {}", e))?;

    Ok(rows.filter_map(Result::ok).collect::<Vec<_>>())
}

fn extract_menu(conn: &Connection) -> Result<Vec<Value>, String> {
    // Extract both categories and items
    let mut categories_stmt = conn.prepare(
        "SELECT id, tenant_id, name, display_order, created_at, updated_at
         FROM menu_categories
         ORDER BY display_order"
    ).map_err(|e| format!("Failed to prepare menu categories query: {}", e))?;

    let categories: Vec<Value> = categories_stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "tenant_id": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "display_order": row.get::<_, i32>(3)?,
                "created_at": row.get::<_, String>(4)?,
                "updated_at": row.get::<_, String>(5)?,
            }))
        })
        .map_err(|e| format!("Failed to query menu categories: {}", e))?
        .filter_map(Result::ok)
        .collect();

    let mut items_stmt = conn.prepare(
        "SELECT id, tenant_id, category_id, name, price, description,
                available, created_at, updated_at
         FROM menu_items
         ORDER BY category_id, name"
    ).map_err(|e| format!("Failed to prepare menu items query: {}", e))?;

    let items: Vec<Value> = items_stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "tenant_id": row.get::<_, String>(1)?,
                "category_id": row.get::<_, String>(2)?,
                "name": row.get::<_, String>(3)?,
                "price": row.get::<_, f64>(4)?,
                "description": row.get::<_, Option<String>>(5)?,
                "available": row.get::<_, i32>(6)? == 1,
                "created_at": row.get::<_, String>(7)?,
                "updated_at": row.get::<_, String>(8)?,
            }))
        })
        .map_err(|e| format!("Failed to query menu items: {}", e))?
        .filter_map(Result::ok)
        .collect();

    // Return as single batch with categories and items
    Ok(vec![json!({
        "categories": categories,
        "items": items,
    })])
}

fn extract_staff(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, tenant_id, name, role, pin_hash, created_at, updated_at
         FROM staff_users
         ORDER BY created_at"
    ).map_err(|e| format!("Failed to prepare staff query: {}", e))?;

    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "tenant_id": row.get::<_, String>(1)?,
            "name": row.get::<_, String>(2)?,
            "role": row.get::<_, String>(3)?,
            "pin": row.get::<_, String>(4)?,
            "created_at": row.get::<_, String>(5)?,
            "updated_at": row.get::<_, String>(6)?,
        }))
    }).map_err(|e| format!("Failed to query staff: {}", e))?;

    Ok(rows.filter_map(Result::ok).collect::<Vec<_>>())
}

fn extract_settings(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, tenant_id, restaurant_name, address, phone, email,
                timezone, currency, tax_rate, updated_at
         FROM restaurant_settings
         LIMIT 1"
    ).map_err(|e| format!("Failed to prepare settings query: {}", e))?;

    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "tenant_id": row.get::<_, String>(1)?,
            "restaurant_name": row.get::<_, String>(2)?,
            "address": row.get::<_, Option<String>>(3)?,
            "phone": row.get::<_, Option<String>>(4)?,
            "email": row.get::<_, Option<String>>(5)?,
            "timezone": row.get::<_, Option<String>>(6)?,
            "currency": row.get::<_, Option<String>>(7)?,
            "tax_rate": row.get::<_, Option<f64>>(8)?,
            "updated_at": row.get::<_, String>(9)?,
        }))
    }).map_err(|e| format!("Failed to query settings: {}", e))?;

    Ok(rows.filter_map(Result::ok).collect::<Vec<_>>())
}

fn extract_floor_plan(conn: &Connection) -> Result<Vec<Value>, String> {
    // Extract sections and tables
    let mut sections_stmt = conn.prepare(
        "SELECT id, tenant_id, name, color, created_at, updated_at
         FROM floor_plan_sections
         ORDER BY name"
    ).map_err(|e| format!("Failed to prepare floor plan sections query: {}", e))?;

    let sections: Vec<Value> = sections_stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "tenant_id": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "color": row.get::<_, Option<String>>(3)?,
                "created_at": row.get::<_, String>(4)?,
                "updated_at": row.get::<_, String>(5)?,
            }))
        })
        .map_err(|e| format!("Failed to query floor plan sections: {}", e))?
        .filter_map(Result::ok)
        .collect();

    let mut tables_stmt = conn.prepare(
        "SELECT id, tenant_id, section_id, table_number, capacity,
                x, y, created_at, updated_at
         FROM floor_plan_tables
         ORDER BY section_id, table_number"
    ).map_err(|e| format!("Failed to prepare floor plan tables query: {}", e))?;

    let tables: Vec<Value> = tables_stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "tenant_id": row.get::<_, String>(1)?,
                "section_id": row.get::<_, String>(2)?,
                "table_number": row.get::<_, i32>(3)?,
                "capacity": row.get::<_, i32>(4)?,
                "x": row.get::<_, Option<f64>>(5)?,
                "y": row.get::<_, Option<f64>>(6)?,
                "created_at": row.get::<_, String>(7)?,
                "updated_at": row.get::<_, String>(8)?,
            }))
        })
        .map_err(|e| format!("Failed to query floor plan tables: {}", e))?
        .filter_map(Result::ok)
        .collect();

    Ok(vec![json!({
        "sections": sections,
        "tables": tables,
    })])
}

fn extract_inventory(conn: &Connection) -> Result<Vec<Value>, String> {
    // Extract inventory items and recipes
    let mut items_stmt = conn.prepare(
        "SELECT id, tenant_id, name, category, unit, quantity, cost,
                created_at, updated_at
         FROM bar_inventory_items
         ORDER BY category, name"
    ).map_err(|e| format!("Failed to prepare bar inventory items query: {}", e))?;

    let items: Vec<Value> = items_stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "tenant_id": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "category": row.get::<_, String>(3)?,
                "unit": row.get::<_, String>(4)?,
                "quantity": row.get::<_, f64>(5)?,
                "cost": row.get::<_, Option<f64>>(6)?,
                "created_at": row.get::<_, String>(7)?,
                "updated_at": row.get::<_, String>(8)?,
            }))
        })
        .map_err(|e| format!("Failed to query bar inventory items: {}", e))?
        .filter_map(Result::ok)
        .collect();

    let mut recipes_stmt = conn.prepare(
        "SELECT id, tenant_id, drink_name, ingredients, instructions,
                created_at, updated_at
         FROM bar_recipes
         ORDER BY drink_name"
    ).map_err(|e| format!("Failed to prepare bar recipes query: {}", e))?;

    let recipes: Vec<Value> = recipes_stmt
        .query_map([], |row| {
            let ingredients_str: String = row.get(3)?;
            let ingredients: Value = serde_json::from_str(&ingredients_str)
                .unwrap_or(json!([]));

            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "tenant_id": row.get::<_, String>(1)?,
                "drink_name": row.get::<_, String>(2)?,
                "ingredients": ingredients,
                "instructions": row.get::<_, Option<String>>(4)?,
                "created_at": row.get::<_, String>(5)?,
                "updated_at": row.get::<_, String>(6)?,
            }))
        })
        .map_err(|e| format!("Failed to query bar recipes: {}", e))?
        .filter_map(Result::ok)
        .collect();

    Ok(vec![json!({
        "items": items,
        "recipes": recipes,
    })])
}
