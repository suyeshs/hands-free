/**
 * Bar Management Worker Plugin
 *
 * Server-side WASM for Cloudflare Workers:
 * - Opening stock calculation (queries D1)
 * - Expected inventory calculation (complex queries)
 * - Usage summary reports (aggregations)
 * - Closing session finalization
 */

use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

// ============================================================================
// Host Bindings (provided by Cloudflare Worker)
// ============================================================================

extern "C" {
    fn log(level: *const u8, level_len: usize, message: *const u8, message_len: usize);
    fn db_query(sql: *const u8, sql_len: usize, params: *const u8, params_len: usize) -> *const c_char;
    fn db_execute(sql: *const u8, sql_len: usize, params: *const u8, params_len: usize) -> i32;
    fn now() -> f64;
}

// ============================================================================
// Helper Functions
// ============================================================================

fn plugin_log(level: &str, message: &str) {
    unsafe {
        log(
            level.as_ptr(),
            level.len(),
            message.as_ptr(),
            message.len(),
        );
    }
}

fn query_db(sql: &str, params_json: &str) -> Result<String, String> {
    unsafe {
        let result_ptr = db_query(
            sql.as_ptr(),
            sql.len(),
            params_json.as_ptr(),
            params_json.len(),
        );

        if result_ptr.is_null() {
            return Err("Database query failed".to_string());
        }

        let result_cstr = CStr::from_ptr(result_ptr);
        Ok(result_cstr.to_string_lossy().into_owned())
    }
}

fn execute_db(sql: &str, params_json: &str) -> Result<(), String> {
    unsafe {
        let result = db_execute(
            sql.as_ptr(),
            sql.len(),
            params_json.as_ptr(),
            params_json.len(),
        );

        if result < 0 {
            return Err("Database execute failed".to_string());
        }

        Ok(())
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpeningStockItem {
    item_id: String,
    full_bottles: i32,
    partial_ml: f64,
    total_ml: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Transaction {
    id: String,
    inventory_item_id: String,
    transaction_type: String,
    quantity_ml: f64,
    cost_per_ml: f64,
    total_cost: f64,
    created_at: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsageSummaryItem {
    item_id: String,
    item_name: String,
    category: String,
    total_usage_ml: f64,
    total_cost: f64,
    drinks_sold: i32,
    average_pour_ml: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClosingSessionSummary {
    session_id: String,
    total_variance_ml: f64,
    total_variance_cost: f64,
    total_waste_ml: f64,
    items_counted: i32,
}

// ============================================================================
// Plugin Entry Points
// ============================================================================

#[no_mangle]
pub extern "C" fn init() -> i32 {
    plugin_log("info", "[BarManagement Worker] Plugin initialized!");
    0 // Success
}

// ============================================================================
// API Handlers
// ============================================================================

#[no_mangle]
pub extern "C" fn handle_request(
    method_ptr: *const u8,
    method_len: usize,
    path_ptr: *const u8,
    path_len: usize,
    body_ptr: *const u8,
    body_len: usize,
) -> *const u8 {
    let method = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(method_ptr, method_len)) };
    let path = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(path_ptr, path_len)) };
    let body = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(body_ptr, body_len)) };

    plugin_log("info", &format!("[BarManagement Worker] {} {}", method, path));

    let response = match (method, path) {
        ("POST", path) if path.contains("/opening-stock") => handle_opening_stock(body),
        ("POST", path) if path.contains("/expected-inventory") => handle_expected_inventory(body),
        ("POST", path) if path.contains("/usage-summary") => handle_usage_summary(body),
        ("POST", path) if path.contains("/finalize-session") => handle_finalize_session(body),
        ("GET", path) if path.contains("/info") => handle_info(),
        _ => Err(format!("Unknown endpoint: {} {}", method, path)),
    };

    match response {
        Ok(data) => {
            let json = serde_json::json!({
                "success": true,
                "data": data
            });
            let json_string = serde_json::to_string(&json).unwrap();
            let c_string = CString::new(json_string).unwrap();
            c_string.into_raw() as *const u8
        }
        Err(error) => {
            plugin_log("error", &error);
            let json = serde_json::json!({
                "success": false,
                "error": error
            });
            let json_string = serde_json::to_string(&json).unwrap();
            let c_string = CString::new(json_string).unwrap();
            c_string.into_raw() as *const u8
        }
    }
}

// ============================================================================
// Opening Stock Calculation
// ============================================================================

fn handle_opening_stock(body: &str) -> Result<serde_json::Value, String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Request {
        tenant_id: String,
        session_date: String,
    }

    let request: Request = serde_json::from_str(body)
        .map_err(|e| format!("Failed to parse request: {}", e))?;

    // Query previous closing session
    let sql = r#"
        SELECT
            cc.inventory_item_id,
            cc.actual_full_bottles,
            cc.actual_partial_ml,
            bi.container_size_ml
        FROM bar_closing_counts cc
        INNER JOIN bar_closing_sessions cs ON cc.closing_session_id = cs.id
        INNER JOIN bar_inventory bi ON cc.inventory_item_id = bi.id
        WHERE cs.tenant_id = ?
          AND cs.session_date < ?
          AND cs.status = 'closed'
        ORDER BY cs.session_date DESC, cs.closed_at DESC
        LIMIT 100
    "#;

    let params = serde_json::json!([request.tenant_id, request.session_date]);
    let result = query_db(sql, &params.to_string())?;

    let rows: Vec<serde_json::Value> = serde_json::from_str(&result)
        .map_err(|e| format!("Failed to parse query result: {}", e))?;

    let mut opening_stock: Vec<OpeningStockItem> = Vec::new();

    for row in rows {
        let item_id = row["inventory_item_id"].as_str().unwrap_or("").to_string();
        let full_bottles = row["actual_full_bottles"].as_i64().unwrap_or(0) as i32;
        let partial_ml = row["actual_partial_ml"].as_f64().unwrap_or(0.0);
        let container_size_ml = row["container_size_ml"].as_f64().unwrap_or(750.0);

        let total_ml = (full_bottles as f64) * container_size_ml + partial_ml;

        opening_stock.push(OpeningStockItem {
            item_id,
            full_bottles,
            partial_ml,
            total_ml,
        });
    }

    // If no previous session, use current inventory
    if opening_stock.is_empty() {
        let sql = r#"
            SELECT
                id as item_id,
                full_containers,
                partial_container_ml,
                container_size_ml
            FROM bar_inventory
            WHERE tenant_id = ?
        "#;

        let params = serde_json::json!([request.tenant_id]);
        let result = query_db(sql, &params.to_string())?;

        let rows: Vec<serde_json::Value> = serde_json::from_str(&result)
            .map_err(|e| format!("Failed to parse inventory: {}", e))?;

        for row in rows {
            let item_id = row["item_id"].as_str().unwrap_or("").to_string();
            let full_bottles = row["full_containers"].as_i64().unwrap_or(0) as i32;
            let partial_ml = row["partial_container_ml"].as_f64().unwrap_or(0.0);
            let container_size_ml = row["container_size_ml"].as_f64().unwrap_or(750.0);

            let total_ml = (full_bottles as f64) * container_size_ml + partial_ml;

            opening_stock.push(OpeningStockItem {
                item_id,
                full_bottles,
                partial_ml,
                total_ml,
            });
        }
    }

    Ok(serde_json::to_value(opening_stock).unwrap())
}

// ============================================================================
// Expected Inventory Calculation
// ============================================================================

fn handle_expected_inventory(body: &str) -> Result<serde_json::Value, String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Request {
        tenant_id: String,
        session_id: String,
        item_id: String,
        opening_full_bottles: i32,
        opening_partial_ml: f64,
        container_size_ml: f64,
    }

    let request: Request = serde_json::from_str(body)
        .map_err(|e| format!("Failed to parse request: {}", e))?;

    // Get session start time
    let sql = r#"
        SELECT opened_at
        FROM bar_closing_sessions
        WHERE id = ? AND tenant_id = ?
    "#;

    let params = serde_json::json!([request.session_id, request.tenant_id]);
    let result = query_db(sql, &params.to_string())?;

    let rows: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();
    let start_time = rows.get(0)
        .and_then(|r| r["opened_at"].as_str())
        .unwrap_or("");

    // Get transactions during session
    let sql = r#"
        SELECT
            transaction_type,
            quantity_ml
        FROM bar_inventory_transactions
        WHERE tenant_id = ?
          AND inventory_item_id = ?
          AND created_at >= ?
        ORDER BY created_at
    "#;

    let params = serde_json::json!([request.tenant_id, request.item_id, start_time]);
    let result = query_db(sql, &params.to_string())?;

    let transactions: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();

    // Calculate net change
    let mut net_change_ml = 0.0;

    for txn in transactions {
        let txn_type = txn["transaction_type"].as_str().unwrap_or("");
        let quantity_ml = txn["quantity_ml"].as_f64().unwrap_or(0.0);

        match txn_type {
            "sale" | "waste" => {
                net_change_ml -= quantity_ml.abs();
            }
            "restock" | "adjustment" => {
                net_change_ml += quantity_ml;
            }
            _ => {}
        }
    }

    // Calculate expected
    let opening_total_ml = (request.opening_full_bottles as f64) * request.container_size_ml
                         + request.opening_partial_ml;
    let expected_total_ml = opening_total_ml + net_change_ml;
    let expected_full_bottles = (expected_total_ml / request.container_size_ml).floor() as i32;
    let expected_partial_ml = expected_total_ml % request.container_size_ml;

    let result = serde_json::json!({
        "expectedFullBottles": expected_full_bottles,
        "expectedPartialMl": expected_partial_ml,
        "expectedTotalMl": expected_total_ml,
        "netChangeMl": net_change_ml,
    });

    Ok(result)
}

// ============================================================================
// Usage Summary Report
// ============================================================================

fn handle_usage_summary(body: &str) -> Result<serde_json::Value, String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Request {
        tenant_id: String,
        start_date: String,
        end_date: String,
    }

    let request: Request = serde_json::from_str(body)
        .map_err(|e| format!("Failed to parse request: {}", e))?;

    let sql = r#"
        SELECT
            t.inventory_item_id,
            bi.name as item_name,
            bi.category,
            SUM(ABS(t.quantity_ml)) as total_usage_ml,
            SUM(t.total_cost) as total_cost,
            COUNT(DISTINCT t.bar_order_id) as drinks_sold
        FROM bar_inventory_transactions t
        INNER JOIN bar_inventory bi ON t.inventory_item_id = bi.id
        WHERE t.tenant_id = ?
          AND t.transaction_type = 'sale'
          AND t.created_at >= ?
          AND t.created_at <= ?
        GROUP BY t.inventory_item_id, bi.name, bi.category
        ORDER BY total_usage_ml DESC
    "#;

    let params = serde_json::json!([request.tenant_id, request.start_date, request.end_date]);
    let result = query_db(sql, &params.to_string())?;

    let rows: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();

    let mut summary: Vec<UsageSummaryItem> = Vec::new();

    for row in rows {
        let total_usage_ml = row["total_usage_ml"].as_f64().unwrap_or(0.0);
        let drinks_sold = row["drinks_sold"].as_i64().unwrap_or(0) as i32;
        let average_pour_ml = if drinks_sold > 0 {
            total_usage_ml / (drinks_sold as f64)
        } else {
            0.0
        };

        summary.push(UsageSummaryItem {
            item_id: row["inventory_item_id"].as_str().unwrap_or("").to_string(),
            item_name: row["item_name"].as_str().unwrap_or("").to_string(),
            category: row["category"].as_str().unwrap_or("").to_string(),
            total_usage_ml,
            total_cost: row["total_cost"].as_f64().unwrap_or(0.0),
            drinks_sold,
            average_pour_ml,
        });
    }

    Ok(serde_json::to_value(summary).unwrap())
}

// ============================================================================
// Finalize Closing Session
// ============================================================================

fn handle_finalize_session(body: &str) -> Result<serde_json::Value, String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Request {
        tenant_id: String,
        session_id: String,
    }

    let request: Request = serde_json::from_str(body)
        .map_err(|e| format!("Failed to parse request: {}", e))?;

    // Get session
    let sql = r#"
        SELECT * FROM bar_closing_sessions
        WHERE id = ? AND tenant_id = ?
    "#;

    let params = serde_json::json!([request.session_id, request.tenant_id]);
    let result = query_db(sql, &params.to_string())?;

    let rows: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();
    if rows.is_empty() {
        return Err("Session not found".to_string());
    }

    let session = &rows[0];
    let opened_at = session["opened_at"].as_str().unwrap_or("");

    // Calculate totals from counts
    let sql = r#"
        SELECT
            COUNT(*) as items_counted,
            SUM(variance_ml) as total_variance_ml,
            SUM(variance_cost) as total_variance_cost
        FROM bar_closing_counts
        WHERE closing_session_id = ?
    "#;

    let params = serde_json::json!([request.session_id]);
    let result = query_db(sql, &params.to_string())?;

    let rows: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();
    let totals = &rows[0];

    let items_counted = totals["items_counted"].as_i64().unwrap_or(0) as i32;
    let total_variance_ml = totals["total_variance_ml"].as_f64().unwrap_or(0.0);
    let total_variance_cost = totals["total_variance_cost"].as_f64().unwrap_or(0.0);

    // Calculate total waste
    let sql = r#"
        SELECT SUM(ABS(quantity_ml)) as total_waste_ml
        FROM bar_inventory_transactions
        WHERE tenant_id = ?
          AND transaction_type = 'waste'
          AND created_at >= ?
    "#;

    let params = serde_json::json!([request.tenant_id, opened_at]);
    let result = query_db(sql, &params.to_string())?;

    let rows: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();
    let total_waste_ml = rows.get(0)
        .and_then(|r| r["total_waste_ml"].as_f64())
        .unwrap_or(0.0);

    // Get current timestamp
    let closed_at = unsafe { now() };
    let closed_at_iso = format_timestamp(closed_at);

    // Update session
    let sql = r#"
        UPDATE bar_closing_sessions
        SET
            items_counted = ?,
            total_variance_ml = ?,
            total_waste_ml = ?,
            status = 'closed',
            closed_at = ?,
            updated_at = ?
        WHERE id = ? AND tenant_id = ?
    "#;

    let params = serde_json::json!([
        items_counted,
        total_variance_ml,
        total_waste_ml,
        closed_at_iso,
        closed_at_iso,
        request.session_id,
        request.tenant_id
    ]);

    execute_db(sql, &params.to_string())?;

    let summary = ClosingSessionSummary {
        session_id: request.session_id,
        total_variance_ml,
        total_variance_cost,
        total_waste_ml,
        items_counted,
    };

    Ok(serde_json::to_value(summary).unwrap())
}

// ============================================================================
// Info Handler
// ============================================================================

fn handle_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "name": "Bar Management Worker",
        "version": "1.0.0",
        "description": "Server-side bar management operations",
        "endpoints": [
            "POST /opening-stock",
            "POST /expected-inventory",
            "POST /usage-summary",
            "POST /finalize-session",
            "GET /info"
        ]
    }))
}

// ============================================================================
// Utilities
// ============================================================================

fn format_timestamp(timestamp: f64) -> String {
    // Convert milliseconds to ISO 8601 format
    // This is a simplified version - in production, use a proper date library
    let seconds = (timestamp / 1000.0) as i64;
    format!("{:019}", seconds) // Placeholder - would need proper formatting
}
