/**
 * Chain Sales Sync Commands
 *
 * Handles syncing sales from location tenant to master tenant's chain aggregation.
 * These commands are called by the TypeScript chainSalesSyncService.
 */

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncSummary {
    pub synced: usize,
    pub total_records: usize,
    pub errors: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChainSyncStatus {
    pub is_enabled: bool,
    pub location_group_id: Option<String>,
    pub master_tenant_id: Option<String>,
    pub last_sync_at: Option<String>,
    pub last_sync_status: String,  // "success" | "failed" | "never"
    pub pending_transactions: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChainSalesTransaction {
    id: String,
    invoice_number: String,
    order_number: Option<String>,
    order_type: String,
    table_number: Option<i32>,
    source: String,
    subtotal: f64,
    service_charge: f64,
    cgst: f64,
    sgst: f64,
    discount: f64,
    round_off: f64,
    grand_total: f64,
    payment_method: String,
    payment_status: String,
    items: String,  // JSON string
    cashier_name: Option<String>,
    staff_id: Option<String>,
    created_at: String,
    completed_at: String,
}

/// Get chain sync configuration from restaurant_settings
fn get_chain_config(conn: &Connection) -> Result<(String, String, String), String> {
    let result: Result<(String, String, String), rusqlite::Error> = conn.query_row(
        "SELECT location_group_id, master_tenant_id, current_location_name
         FROM restaurant_settings
         WHERE id = 1",
        [],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        },
    );

    result.map_err(|e| format!("Failed to get chain config: {}", e))
}

/// Get master worker URL based on master tenant ID
async fn get_master_worker_url(master_tenant_id: &str) -> Result<String, String> {
    // For now, use the default worker URL
    // In production, this should look up the specific worker URL for the master tenant
    Ok(format!("https://handsfree-tenant-router.stonepot.workers.dev"))
}

/// Get unsynced sales transactions from local database
fn get_unsynced_sales(conn: &Connection, limit: i64) -> Result<Vec<ChainSalesTransaction>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT
                id, invoice_number, order_number, order_type, table_number, source,
                subtotal, service_charge, cgst, sgst, discount, round_off, grand_total,
                payment_method, payment_status, items_json, cashier_name, staff_id,
                created_at, completed_at
             FROM sales_transactions
             WHERE synced_to_chain = 0 OR synced_to_chain IS NULL
             ORDER BY completed_at ASC
             LIMIT ?",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let sales = stmt
        .query_map(params![limit], |row| {
            Ok(ChainSalesTransaction {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                order_number: row.get(2)?,
                order_type: row.get(3)?,
                table_number: row.get(4)?,
                source: row.get(5)?,
                subtotal: row.get(6)?,
                service_charge: row.get(7)?,
                cgst: row.get(8)?,
                sgst: row.get(9)?,
                discount: row.get(10)?,
                round_off: row.get(11)?,
                grand_total: row.get(12)?,
                payment_method: row.get(13)?,
                payment_status: row.get(14)?,
                items: row.get(15)?,
                cashier_name: row.get(16)?,
                staff_id: row.get(17)?,
                created_at: row.get(18)?,
                completed_at: row.get(19)?,
            })
        })
        .map_err(|e| format!("Failed to query sales: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect sales: {}", e))?;

    Ok(sales)
}

/// Mark sales as synced to chain
fn mark_sales_synced(conn: &Connection, invoice_numbers: &[String], batch_id: &str) -> Result<(), String> {
    let placeholders = invoice_numbers
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");

    let query = format!(
        "UPDATE sales_transactions
         SET synced_to_chain = 1,
             chain_sync_at = datetime('now'),
             chain_sync_batch_id = ?
         WHERE invoice_number IN ({})",
        placeholders
    );

    let mut params_vec: Vec<&dyn rusqlite::ToSql> = vec![&batch_id];
    for inv in invoice_numbers {
        params_vec.push(inv);
    }

    conn.execute(&query, params_vec.as_slice())
        .map_err(|e| format!("Failed to mark sales as synced: {}", e))?;

    Ok(())
}

/// Sync chain sales to master tenant
#[tauri::command]
pub async fn sync_chain_sales(app: AppHandle) -> Result<SyncSummary, String> {
    // Get database path
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Get chain configuration
    let (location_group_id, master_tenant_id, location_name) = get_chain_config(&conn)?;

    // Get unsynced sales (batch of 100)
    let sales = get_unsynced_sales(&conn, 100)?;

    if sales.is_empty() {
        return Ok(SyncSummary {
            synced: 0,
            total_records: 0,
            errors: None,
        });
    }

    println!("[ChainSync] Syncing {} sales to chain {}", sales.len(), location_group_id);

    // Get master worker URL
    let worker_url = get_master_worker_url(&master_tenant_id).await?;

    // Generate batch ID
    let batch_id = uuid::Uuid::new_v4().to_string();

    // Transform sales to chain sync format
    let transactions: Vec<serde_json::Value> = sales
        .iter()
        .map(|sale| {
            serde_json::json!({
                "id": sale.id,
                "invoiceNumber": sale.invoice_number,
                "orderNumber": sale.order_number,
                "orderType": sale.order_type,
                "tableNumber": sale.table_number,
                "source": sale.source,
                "subtotal": sale.subtotal,
                "serviceCharge": sale.service_charge,
                "cgst": sale.cgst,
                "sgst": sale.sgst,
                "discount": sale.discount,
                "roundOff": sale.round_off,
                "grandTotal": sale.grand_total,
                "paymentMethod": sale.payment_method,
                "paymentStatus": sale.payment_status,
                "items": serde_json::from_str::<serde_json::Value>(&sale.items).unwrap_or(serde_json::json!([])),
                "cashierName": sale.cashier_name,
                "staffId": sale.staff_id,
                "createdAt": sale.created_at,
                "completedAt": sale.completed_at,
            })
        })
        .collect();

    let payload = serde_json::json!({
        "transactions": transactions,
        "batchId": batch_id,
        "locationName": location_name,
    });

    // POST to master worker
    let client = reqwest::Client::new();
    let url = format!(
        "{}/chain/{}/location/{}/sync-sales",
        worker_url, location_group_id, master_tenant_id
    );

    println!("[ChainSync] Posting to: {}", url);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Tenant-Id", &master_tenant_id)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send sync request: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Sync failed: HTTP {} - {}", status, error_text));
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let synced = result["synced"].as_u64().unwrap_or(0) as usize;

    // Mark sales as synced
    let invoice_numbers: Vec<String> = sales.iter().map(|s| s.invoice_number.clone()).collect();
    mark_sales_synced(&conn, &invoice_numbers, &batch_id)?;

    // Update last sync timestamp
    conn.execute(
        "INSERT OR REPLACE INTO chain_sync_metadata (key, value, updated_at)
         VALUES ('last_chain_sales_sync', datetime('now'), datetime('now'))",
        [],
    )
    .map_err(|e| format!("Failed to update sync metadata: {}", e))?;

    println!("[ChainSync] ✅ Successfully synced {} sales", synced);

    Ok(SyncSummary {
        synced,
        total_records: sales.len(),
        errors: None,
    })
}

/// Get chain sync status
#[tauri::command]
pub fn get_chain_sync_status(app: AppHandle) -> Result<ChainSyncStatus, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Check if chain sync is configured
    let config = conn.query_row(
        "SELECT location_group_id, master_tenant_id FROM restaurant_settings WHERE id = 1",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        },
    );

    let (location_group_id, master_tenant_id) = match config {
        Ok((Some(loc_id), Some(master_id))) => (Some(loc_id), Some(master_id)),
        _ => {
            return Ok(ChainSyncStatus {
                is_enabled: false,
                location_group_id: None,
                master_tenant_id: None,
                last_sync_at: None,
                last_sync_status: "never".to_string(),
                pending_transactions: 0,
            });
        }
    };

    // Get last sync timestamp
    let last_sync: Option<String> = conn
        .query_row(
            "SELECT value FROM chain_sync_metadata WHERE key = 'last_chain_sales_sync'",
            [],
            |row| row.get(0),
        )
        .ok();

    // Get pending transaction count
    let pending: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sales_transactions WHERE synced_to_chain = 0 OR synced_to_chain IS NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(ChainSyncStatus {
        is_enabled: true,
        location_group_id,
        master_tenant_id,
        last_sync_at: last_sync,
        last_sync_status: if last_sync.is_some() { "success".to_string() } else { "never".to_string() },
        pending_transactions: pending,
    })
}

/// Enable or disable chain sync
#[tauri::command]
pub fn set_chain_sync_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE restaurant_settings SET chain_sync_enabled = ? WHERE id = 1",
        params![if enabled { 1 } else { 0 }],
    )
    .map_err(|e| format!("Failed to update chain sync setting: {}", e))?;

    Ok(())
}
