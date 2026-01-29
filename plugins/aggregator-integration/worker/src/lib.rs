/**
 * Aggregator Integration Worker Plugin
 *
 * Server-side WASM for Cloudflare Workers:
 * - Order sync to D1
 * - Sales recording
 * - Analytics and reports
 * - Selector management (DOM extraction configs)
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
    fn kv_get(key: *const u8, key_len: usize) -> *const c_char;
    fn kv_put(key: *const u8, key_len: usize, value: *const u8, value_len: usize) -> i32;
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

fn kv_get_value(key: &str) -> Result<String, String> {
    unsafe {
        let result_ptr = kv_get(key.as_ptr(), key.len());

        if result_ptr.is_null() {
            return Err("KV get failed".to_string());
        }

        let result_cstr = CStr::from_ptr(result_ptr);
        Ok(result_cstr.to_string_lossy().into_owned())
    }
}

fn kv_put_value(key: &str, value: &str) -> Result<(), String> {
    unsafe {
        let result = kv_put(key.as_ptr(), key.len(), value.as_ptr(), value.len());

        if result < 0 {
            return Err("KV put failed".to_string());
        }

        Ok(())
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AggregatorOrderSync {
    order_id: String,
    order_number: String,
    aggregator: String,
    status: String,
    total: f64,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SalesRecord {
    id: String,
    tenant_id: String,
    invoice_number: String,
    order_number: String,
    aggregator: String,
    subtotal: f64,
    tax: f64,
    delivery_fee: f64,
    discount: f64,
    total: f64,
    payment_method: String,
    items_count: i32,
    created_at: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SalesReportItem {
    aggregator: String,
    order_count: i32,
    total_sales: f64,
    avg_order_value: f64,
    total_tax: f64,
    total_delivery_fee: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrendData {
    date: String,
    order_count: i32,
    total_sales: f64,
    swiggy_orders: i32,
    zomato_orders: i32,
}

// ============================================================================
// Plugin Entry Points
// ============================================================================

#[no_mangle]
pub extern "C" fn init() -> i32 {
    plugin_log("info", "[AggregatorIntegration Worker] Plugin initialized!");
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

    plugin_log("info", &format!("[AggregatorIntegration Worker] {} {}", method, path));

    let response = match (method, path) {
        ("POST", path) if path.contains("/orders/sync") => handle_orders_sync(body),
        ("POST", path) if path.contains("/sales/record") => handle_sales_record(body),
        ("POST", path) if path.contains("/reports/sales") => handle_sales_report(body),
        ("GET", path) if path.contains("/analytics/trends") => handle_trends(path),
        ("POST", path) if path.contains("/extraction/update-selectors") => handle_update_selectors(body),
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
// Order Sync
// ============================================================================

fn handle_orders_sync(body: &str) -> Result<serde_json::Value, String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Request {
        tenant_id: String,
        orders: Vec<serde_json::Value>,
    }

    let request: Request = serde_json::from_str(body)
        .map_err(|e| format!("Failed to parse request: {}", e))?;

    let mut synced = 0;
    let mut errors = Vec::new();

    for order in &request.orders {
        let order_id = order["orderId"].as_str().unwrap_or("");
        let order_number = order["orderNumber"].as_str().unwrap_or("");
        let aggregator = order["aggregator"].as_str().unwrap_or("");
        let status = order["status"].as_str().unwrap_or("");
        let total = order["total"].as_f64().unwrap_or(0.0);
        let created_at = order["createdAt"].as_str().unwrap_or("");

        let now = unsafe { now() };
        let updated_at = format_timestamp(now);

        // Check if order exists
        let sql = r#"
            SELECT COUNT(*) as count
            FROM aggregator_orders
            WHERE order_id = ? AND tenant_id = ?
        "#;

        let params = serde_json::json!([order_id, request.tenant_id]);
        let result = query_db(sql, &params.to_string())?;
        let rows: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();
        let exists = rows.get(0)
            .and_then(|r| r["count"].as_i64())
            .unwrap_or(0) > 0;

        if exists {
            // Update existing order
            let sql = r#"
                UPDATE aggregator_orders
                SET
                    status = ?,
                    updated_at = ?,
                    synced_at = ?
                WHERE order_id = ? AND tenant_id = ?
            "#;

            let params = serde_json::json!([status, updated_at, updated_at, order_id, request.tenant_id]);

            match execute_db(sql, &params.to_string()) {
                Ok(_) => synced += 1,
                Err(e) => errors.push(format!("Failed to update order {}: {}", order_number, e)),
            }
        } else {
            // Insert new order
            let sql = r#"
                INSERT INTO aggregator_orders (
                    order_id, tenant_id, order_number, aggregator,
                    status, total, created_at, updated_at, synced_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#;

            let params = serde_json::json!([
                order_id, request.tenant_id, order_number, aggregator,
                status, total, created_at, updated_at, updated_at
            ]);

            match execute_db(sql, &params.to_string()) {
                Ok(_) => synced += 1,
                Err(e) => errors.push(format!("Failed to insert order {}: {}", order_number, e)),
            }
        }
    }

    Ok(serde_json::json!({
        "synced": synced,
        "errors": errors,
        "total": request.orders.len(),
    }))
}

// ============================================================================
// Sales Recording
// ============================================================================

fn handle_sales_record(body: &str) -> Result<serde_json::Value, String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Request {
        tenant_id: String,
        order_id: String,
        invoice_number: String,
        order_number: String,
        aggregator: String,
        subtotal: f64,
        tax: f64,
        delivery_fee: f64,
        discount: f64,
        total: f64,
        payment_method: String,
        items_count: i32,
        created_at: String,
    }

    let request: Request = serde_json::from_str(body)
        .map_err(|e| format!("Failed to parse request: {}", e))?;

    let now = unsafe { now() };
    let id = format!("agg-sale-{}-{}", (now as u64), generate_random_id());

    let sql = r#"
        INSERT INTO sales_transactions (
            id, tenant_id, invoice_number, order_number, order_type,
            source, subtotal, cgst, sgst, delivery_fee, discount,
            grand_total, payment_method, payment_status,
            items_count, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    "#;

    let cgst = request.tax / 2.0;
    let sgst = request.tax / 2.0;

    let params = serde_json::json!([
        id,
        request.tenant_id,
        request.invoice_number,
        request.order_number,
        "delivery",
        request.aggregator,
        request.subtotal,
        cgst,
        sgst,
        request.delivery_fee,
        request.discount,
        request.total,
        request.payment_method,
        "completed",
        request.items_count,
        request.created_at,
        format_timestamp(now),
    ]);

    execute_db(sql, &params.to_string())?;

    let record = SalesRecord {
        id: id.clone(),
        tenant_id: request.tenant_id,
        invoice_number: request.invoice_number,
        order_number: request.order_number,
        aggregator: request.aggregator,
        subtotal: request.subtotal,
        tax: request.tax,
        delivery_fee: request.delivery_fee,
        discount: request.discount,
        total: request.total,
        payment_method: request.payment_method,
        items_count: request.items_count,
        created_at: request.created_at,
    };

    Ok(serde_json::to_value(record).unwrap())
}

// ============================================================================
// Sales Report
// ============================================================================

fn handle_sales_report(body: &str) -> Result<serde_json::Value, String> {
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
            source as aggregator,
            COUNT(*) as order_count,
            SUM(grand_total) as total_sales,
            AVG(grand_total) as avg_order_value,
            SUM(cgst + sgst) as total_tax,
            SUM(COALESCE(delivery_fee, 0)) as total_delivery_fee
        FROM sales_transactions
        WHERE tenant_id = ?
          AND order_type = 'delivery'
          AND created_at >= ?
          AND created_at <= ?
          AND source IN ('swiggy', 'zomato')
        GROUP BY source
        ORDER BY total_sales DESC
    "#;

    let params = serde_json::json!([request.tenant_id, request.start_date, request.end_date]);
    let result = query_db(sql, &params.to_string())?;

    let rows: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();

    let mut report: Vec<SalesReportItem> = Vec::new();

    for row in rows {
        report.push(SalesReportItem {
            aggregator: row["aggregator"].as_str().unwrap_or("").to_string(),
            order_count: row["order_count"].as_i64().unwrap_or(0) as i32,
            total_sales: row["total_sales"].as_f64().unwrap_or(0.0),
            avg_order_value: row["avg_order_value"].as_f64().unwrap_or(0.0),
            total_tax: row["total_tax"].as_f64().unwrap_or(0.0),
            total_delivery_fee: row["total_delivery_fee"].as_f64().unwrap_or(0.0),
        });
    }

    Ok(serde_json::to_value(report).unwrap())
}

// ============================================================================
// Trends Analytics
// ============================================================================

fn handle_trends(path: &str) -> Result<serde_json::Value, String> {
    // Extract tenant_id from path
    let parts: Vec<&str> = path.split('/').collect();
    let tenant_id = parts.get(parts.len() - 2).unwrap_or(&"");

    let sql = r#"
        SELECT
            DATE(created_at) as date,
            COUNT(*) as order_count,
            SUM(grand_total) as total_sales,
            SUM(CASE WHEN source = 'swiggy' THEN 1 ELSE 0 END) as swiggy_orders,
            SUM(CASE WHEN source = 'zomato' THEN 1 ELSE 0 END) as zomato_orders
        FROM sales_transactions
        WHERE tenant_id = ?
          AND order_type = 'delivery'
          AND created_at >= DATE('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
    "#;

    let params = serde_json::json!([tenant_id]);
    let result = query_db(sql, &params.to_string())?;

    let rows: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap_or_default();

    let mut trends: Vec<TrendData> = Vec::new();

    for row in rows {
        trends.push(TrendData {
            date: row["date"].as_str().unwrap_or("").to_string(),
            order_count: row["order_count"].as_i64().unwrap_or(0) as i32,
            total_sales: row["total_sales"].as_f64().unwrap_or(0.0),
            swiggy_orders: row["swiggy_orders"].as_i64().unwrap_or(0) as i32,
            zomato_orders: row["zomato_orders"].as_i64().unwrap_or(0) as i32,
        });
    }

    Ok(serde_json::to_value(trends).unwrap())
}

// ============================================================================
// Selector Management
// ============================================================================

fn handle_update_selectors(body: &str) -> Result<serde_json::Value, String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Request {
        platform: String, // "swiggy" or "zomato"
        selectors: serde_json::Value,
        version: String,
    }

    let request: Request = serde_json::from_str(body)
        .map_err(|e| format!("Failed to parse request: {}", e))?;

    // Store selectors in KV
    let key = format!("selectors:{}:{}", request.platform, request.version);
    let value = serde_json::to_string(&request.selectors)
        .map_err(|e| format!("Failed to serialize selectors: {}", e))?;

    kv_put_value(&key, &value)?;

    // Also update "latest" pointer
    let latest_key = format!("selectors:{}:latest", request.platform);
    kv_put_value(&latest_key, &request.version)?;

    Ok(serde_json::json!({
        "platform": request.platform,
        "version": request.version,
        "selectorsCount": request.selectors.as_object().map(|o| o.len()).unwrap_or(0),
        "updated": true
    }))
}

// ============================================================================
// Info Handler
// ============================================================================

fn handle_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "name": "Aggregator Integration Worker",
        "version": "1.0.0",
        "description": "Server-side aggregator order processing",
        "supportedPlatforms": ["swiggy", "zomato"],
        "endpoints": [
            "POST /orders/sync",
            "POST /sales/record",
            "POST /reports/sales",
            "GET /analytics/trends",
            "POST /extraction/update-selectors",
            "GET /info"
        ]
    }))
}

// ============================================================================
// Utilities
// ============================================================================

fn format_timestamp(timestamp: f64) -> String {
    // Convert milliseconds to ISO 8601 format
    // This is a simplified version
    let seconds = (timestamp / 1000.0) as i64;
    format!("{:019}", seconds) // Placeholder
}

fn generate_random_id() -> String {
    let timestamp = unsafe { now() } as u64;
    format!("{:x}", timestamp % 1000000)
}
