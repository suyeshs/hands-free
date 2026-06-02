/**
 * Remote Report Endpoints
 *
 * Serves sales/analytics reports straight from the local SQLite over the
 * cloudflared tunnel, so remote devices read from the POS (the single source of
 * truth) instead of Cloudflare D1. Mirrors the read methods of the frontend
 * `salesTransactionService.ts`.
 *
 * Access control: every endpoint requires the static report key (created in
 * Settings, stored in `report_access_keys`) presented via the `X-Report-Key`
 * header or `key` query param. No key row configured => all requests denied.
 */

use actix_web::{web, HttpRequest, HttpResponse};
use chrono::{Datelike, Duration, Local, NaiveDate, SecondsFormat, TimeZone, Utc};
use rusqlite::Connection;
use serde::Deserialize;

use crate::webserver::AppState;

#[derive(Debug, Deserialize)]
pub struct DateQuery {
    pub date: Option<String>,
    pub key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RangeQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    pub key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LimitQuery {
    pub date: Option<String>,
    pub limit: Option<i64>,
    pub key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InvoiceQuery {
    pub invoice: Option<String>,
    pub key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub order_type: Option<String>,
    pub key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecentQuery {
    pub limit: Option<i64>,
    pub key: Option<String>,
}

/// Register all report routes under /api/reports.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/reports")
            .route("/daily", web::get().to(daily_bundle))
            .route("/summary", web::get().to(summary))
            .route("/payment-breakdown", web::get().to(payment_breakdown))
            .route("/hourly", web::get().to(hourly))
            .route("/top-items", web::get().to(top_items))
            .route("/order-type-breakdown", web::get().to(order_type_breakdown))
            .route("/sales-by-date", web::get().to(sales_by_date))
            .route("/date-range", web::get().to(date_range))
            .route("/transaction", web::get().to(transaction_by_invoice))
            .route("/sale-exists", web::get().to(sale_exists))
            .route("/recent-dine-in", web::get().to(recent_dine_in))
            .route("/search", web::get().to(search))
            .route("/aggregator-summary", web::get().to(aggregator_summary))
            .route("/aggregator-transactions", web::get().to(aggregator_transactions))
            // Owner-app analytics (analyticsStore shapes; POS sales + aggregator combined)
            .route("/analytics/sales-metrics", web::get().to(analytics_sales_metrics))
            .route("/analytics/order-metrics", web::get().to(analytics_order_metrics))
            .route("/analytics/performance", web::get().to(analytics_performance))
            .route("/analytics/popular-items", web::get().to(analytics_popular_items))
            .route("/analytics/aggregator-performance", web::get().to(analytics_aggregator_performance))
            .route("/analytics/daily-sales", web::get().to(analytics_daily_sales)),
    );
}

// ----------------------------------------------------------------------------
// Auth + shared helpers
// ----------------------------------------------------------------------------

/// Validate the request's report key against the stored static key.
/// Returns an error response to short-circuit the handler when unauthorized.
fn authorize(req: &HttpRequest, query_key: &Option<String>, conn: &Connection) -> Result<(), HttpResponse> {
    let provided = req
        .headers()
        .get("X-Report-Key")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .or_else(|| query_key.clone());

    let provided = match provided {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Err(HttpResponse::Unauthorized().json(serde_json::json!({
                "success": false,
                "error": "Report access key required"
            })))
        }
    };

    let stored: Option<String> = conn
        .query_row(
            "SELECT access_key FROM report_access_keys WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .ok();

    match stored {
        Some(key) if constant_time_eq(key.as_bytes(), provided.as_bytes()) => Ok(()),
        Some(_) => Err(HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Invalid report access key"
        }))),
        None => Err(HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Remote reports are not enabled on this POS"
        }))),
    }
}

/// Constant-time byte comparison (avoids leaking key length/content via timing).
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn open_db(data: &web::Data<AppState>) -> Result<Connection, HttpResponse> {
    Connection::open(&data.db_path).map_err(|e| {
        eprintln!("[Reports] Failed to open database: {}", e);
        HttpResponse::InternalServerError().json(serde_json::json!({
            "success": false,
            "error": "Database connection failed"
        }))
    })
}

/// Resolve the active tenant id from tenant_config (single-tenant install).
/// Returns None when not activated yet, in which case queries skip the filter.
fn resolve_tenant(conn: &Connection) -> Option<String> {
    conn.query_row("SELECT tenant_id FROM tenant_config WHERE id = 1", [], |row| {
        row.get::<_, String>(0)
    })
    .ok()
}

/// Default date = today in local time (YYYY-MM-DD).
fn today_local() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

/// Mirror of `getLocalDateRange`: a local calendar day -> [startUTC, endUTC] as
/// millisecond ISO strings (e.g. 2026-06-02T00:00:00.000Z), matching how
/// `completed_at` is stored (`new Date().toISOString()`).
fn local_day_range(date: &str) -> Option<(String, String)> {
    let d = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    let start_naive = d.and_hms_milli_opt(0, 0, 0, 0)?;
    let end_naive = d.and_hms_milli_opt(23, 59, 59, 999)?;
    let start = Local.from_local_datetime(&start_naive).single()?;
    let end = Local.from_local_datetime(&end_naive).single()?;
    Some((
        start.with_timezone(&Utc).to_rfc3339_opts(SecondsFormat::Millis, true),
        end.with_timezone(&Utc).to_rfc3339_opts(SecondsFormat::Millis, true),
    ))
}

fn range_from_dates(from: &str, to: &str) -> Option<(String, String)> {
    let (start, _) = local_day_range(from)?;
    let (_, end) = local_day_range(to)?;
    Some((start, end))
}

/// Build the standard tenant filter clause + the bound parameter, if a tenant is set.
fn tenant_filter(conn: &Connection) -> (String, Option<String>) {
    match resolve_tenant(conn) {
        Some(t) => (" AND tenant_id = ?3".to_string(), Some(t)),
        None => (String::new(), None),
    }
}

/// Map a sales_transactions row (selected with the canonical column order below)
/// into the camelCase SalesTransaction JSON the frontend expects.
const SALES_COLUMNS: &str = "id, tenant_id, invoice_number, order_number, order_type, table_number, \
     source, subtotal, service_charge, cgst, sgst, discount, round_off, grand_total, \
     payment_method, payment_status, items_json, cashier_name, staff_id, created_at, completed_at";

fn row_to_transaction(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
    let items_json: String = row.get(16)?;
    let items = serde_json::from_str::<serde_json::Value>(&items_json)
        .unwrap_or(serde_json::Value::Array(vec![]));
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "tenantId": row.get::<_, String>(1)?,
        "invoiceNumber": row.get::<_, String>(2)?,
        "orderNumber": row.get::<_, Option<String>>(3)?,
        "orderType": row.get::<_, String>(4)?,
        "tableNumber": row.get::<_, Option<i64>>(5)?,
        "source": row.get::<_, String>(6)?,
        "subtotal": row.get::<_, f64>(7)?,
        "serviceCharge": row.get::<_, f64>(8)?,
        "cgst": row.get::<_, f64>(9)?,
        "sgst": row.get::<_, f64>(10)?,
        "discount": row.get::<_, f64>(11)?,
        "roundOff": row.get::<_, f64>(12)?,
        "grandTotal": row.get::<_, f64>(13)?,
        "paymentMethod": row.get::<_, String>(14)?,
        "paymentStatus": row.get::<_, String>(15)?,
        "items": items,
        "cashierName": row.get::<_, Option<String>>(17)?,
        "staffId": row.get::<_, Option<String>>(18)?,
        "createdAt": row.get::<_, String>(19)?,
        "completedAt": row.get::<_, String>(20)?,
    }))
}

/// Fetch transactions for a UTC range, optionally tenant-filtered.
fn fetch_transactions(conn: &Connection, start: &str, end: &str) -> rusqlite::Result<Vec<serde_json::Value>> {
    let (filter, tenant) = tenant_filter(conn);
    let sql = format!(
        "SELECT {cols} FROM sales_transactions
         WHERE completed_at >= ?1 AND completed_at <= ?2{filter}
         ORDER BY completed_at DESC",
        cols = SALES_COLUMNS,
        filter = filter
    );
    let mut stmt = conn.prepare(&sql)?;
    let mapper = |row: &rusqlite::Row| row_to_transaction(row);
    let rows = if let Some(t) = tenant {
        stmt.query_map(rusqlite::params![start, end, t], mapper)?
            .collect::<rusqlite::Result<Vec<_>>>()?
    } else {
        stmt.query_map(rusqlite::params![start, end], mapper)?
            .collect::<rusqlite::Result<Vec<_>>>()?
    };
    Ok(rows)
}

/// Aggregate top items from a set of transaction JSON values.
fn aggregate_top_items(transactions: &[serde_json::Value], limit: usize) -> Vec<serde_json::Value> {
    use std::collections::HashMap;
    let mut map: HashMap<String, (f64, f64)> = HashMap::new(); // name -> (quantity, revenue)
    for txn in transactions {
        if let Some(items) = txn.get("items").and_then(|v| v.as_array()) {
            for item in items {
                let name = item
                    .get("menuItem")
                    .and_then(|m| m.get("name"))
                    .and_then(|n| n.as_str())
                    .or_else(|| item.get("name").and_then(|n| n.as_str()))
                    .unwrap_or("Unknown")
                    .to_string();
                let qty = item.get("quantity").and_then(|q| q.as_f64()).unwrap_or(0.0);
                let revenue = item.get("subtotal").and_then(|s| s.as_f64()).unwrap_or(0.0);
                let entry = map.entry(name).or_insert((0.0, 0.0));
                entry.0 += qty;
                entry.1 += revenue;
            }
        }
    }
    let mut items: Vec<serde_json::Value> = map
        .into_iter()
        .map(|(name, (quantity, revenue))| {
            serde_json::json!({ "name": name, "quantity": quantity, "revenue": revenue })
        })
        .collect();
    items.sort_by(|a, b| {
        let qa = a.get("quantity").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let qb = b.get("quantity").and_then(|v| v.as_f64()).unwrap_or(0.0);
        qb.partial_cmp(&qa).unwrap_or(std::cmp::Ordering::Equal)
    });
    items.truncate(limit);
    items
}

// ----------------------------------------------------------------------------
// Aggregate computations (shared by /daily and the individual endpoints)
// ----------------------------------------------------------------------------

fn compute_summary(conn: &Connection, start: &str, end: &str) -> rusqlite::Result<serde_json::Value> {
    let (filter, tenant) = tenant_filter(conn);
    let sql = format!(
        "SELECT COALESCE(SUM(grand_total), 0), COUNT(*), COALESCE(SUM(cgst + sgst), 0),
                COALESCE(SUM(discount), 0), COALESCE(SUM(service_charge), 0)
         FROM sales_transactions
         WHERE completed_at >= ?1 AND completed_at <= ?2{}",
        filter
    );
    let mapper = |row: &rusqlite::Row| {
        let total_sales: f64 = row.get(0)?;
        let total_orders: i64 = row.get(1)?;
        Ok(serde_json::json!({
            "totalSales": total_sales,
            "totalOrders": total_orders,
            "averageOrderValue": if total_orders > 0 { total_sales / total_orders as f64 } else { 0.0 },
            "totalTax": row.get::<_, f64>(2)?,
            "totalDiscount": row.get::<_, f64>(3)?,
            "totalServiceCharge": row.get::<_, f64>(4)?,
        }))
    };
    if let Some(t) = tenant {
        conn.query_row(&sql, rusqlite::params![start, end, t], mapper)
    } else {
        conn.query_row(&sql, rusqlite::params![start, end], mapper)
    }
}

fn compute_payment_breakdown(conn: &Connection, start: &str, end: &str) -> rusqlite::Result<serde_json::Value> {
    let (filter, tenant) = tenant_filter(conn);
    let sql = format!(
        "SELECT payment_method, COALESCE(SUM(grand_total), 0)
         FROM sales_transactions
         WHERE completed_at >= ?1 AND completed_at <= ?2{}
         GROUP BY payment_method",
        filter
    );
    let mut stmt = conn.prepare(&sql)?;
    let mapper = |row: &rusqlite::Row| Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?));
    let rows: Vec<(String, f64)> = if let Some(t) = tenant {
        stmt.query_map(rusqlite::params![start, end, t], mapper)?.collect::<rusqlite::Result<_>>()?
    } else {
        stmt.query_map(rusqlite::params![start, end], mapper)?.collect::<rusqlite::Result<_>>()?
    };
    let mut breakdown = serde_json::json!({ "cash": 0.0, "card": 0.0, "upi": 0.0, "wallet": 0.0, "pending": 0.0 });
    for (method, total) in rows {
        if breakdown.get(&method).is_some() {
            breakdown[method] = serde_json::json!(total);
        }
    }
    Ok(breakdown)
}

fn compute_order_type_breakdown(conn: &Connection, start: &str, end: &str) -> rusqlite::Result<serde_json::Value> {
    let (filter, tenant) = tenant_filter(conn);
    let sql = format!(
        "SELECT order_type, COUNT(*), COALESCE(SUM(grand_total), 0)
         FROM sales_transactions
         WHERE completed_at >= ?1 AND completed_at <= ?2{}
         GROUP BY order_type",
        filter
    );
    let mut stmt = conn.prepare(&sql)?;
    let mapper = |row: &rusqlite::Row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, f64>(2)?));
    let rows: Vec<(String, i64, f64)> = if let Some(t) = tenant {
        stmt.query_map(rusqlite::params![start, end, t], mapper)?.collect::<rusqlite::Result<_>>()?
    } else {
        stmt.query_map(rusqlite::params![start, end], mapper)?.collect::<rusqlite::Result<_>>()?
    };
    let mut breakdown = serde_json::json!({
        "dine-in": { "count": 0, "sales": 0.0 },
        "takeout": { "count": 0, "sales": 0.0 },
        "delivery": { "count": 0, "sales": 0.0 },
    });
    for (otype, count, sales) in rows {
        if breakdown.get(&otype).is_some() {
            breakdown[otype] = serde_json::json!({ "count": count, "sales": sales });
        }
    }
    Ok(breakdown)
}

fn compute_hourly(conn: &Connection, start: &str, end: &str) -> rusqlite::Result<serde_json::Value> {
    let (filter, tenant) = tenant_filter(conn);
    let sql = format!(
        "SELECT CAST(strftime('%H', completed_at) AS INTEGER), COALESCE(SUM(grand_total), 0), COUNT(*)
         FROM sales_transactions
         WHERE completed_at >= ?1 AND completed_at <= ?2{}
         GROUP BY 1 ORDER BY 1",
        filter
    );
    let mut stmt = conn.prepare(&sql)?;
    let mapper = |row: &rusqlite::Row| Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?, row.get::<_, i64>(2)?));
    let rows: Vec<(i64, f64, i64)> = if let Some(t) = tenant {
        stmt.query_map(rusqlite::params![start, end, t], mapper)?.collect::<rusqlite::Result<_>>()?
    } else {
        stmt.query_map(rusqlite::params![start, end], mapper)?.collect::<rusqlite::Result<_>>()?
    };
    let mut by_hour = std::collections::HashMap::new();
    for (hour, sales, orders) in rows {
        by_hour.insert(hour, (sales, orders));
    }
    let result: Vec<serde_json::Value> = (0..24)
        .map(|hour| {
            let (sales, orders) = by_hour.get(&hour).copied().unwrap_or((0.0, 0));
            serde_json::json!({ "hour": hour, "sales": sales, "orders": orders })
        })
        .collect();
    Ok(serde_json::Value::Array(result))
}

// ----------------------------------------------------------------------------
// Handlers
// ----------------------------------------------------------------------------

macro_rules! guard {
    ($req:expr, $key:expr, $conn:expr) => {
        if let Err(resp) = authorize($req, $key, &$conn) {
            return resp;
        }
    };
}

async fn daily_bundle(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    let transactions = fetch_transactions(&conn, &start, &end).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "date": date,
        "summary": compute_summary(&conn, &start, &end).unwrap_or(serde_json::Value::Null),
        "paymentBreakdown": compute_payment_breakdown(&conn, &start, &end).unwrap_or(serde_json::Value::Null),
        "orderTypeBreakdown": compute_order_type_breakdown(&conn, &start, &end).unwrap_or(serde_json::Value::Null),
        "hourly": compute_hourly(&conn, &start, &end).unwrap_or(serde_json::Value::Null),
        "topItems": aggregate_top_items(&transactions, 10),
    }))
}

async fn summary(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    match compute_summary(&conn, &start, &end) {
        Ok(s) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "summary": s })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn payment_breakdown(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    match compute_payment_breakdown(&conn, &start, &end) {
        Ok(b) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "paymentBreakdown": b })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn hourly(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    match compute_hourly(&conn, &start, &end) {
        Ok(h) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "hourly": h })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn order_type_breakdown(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    match compute_order_type_breakdown(&conn, &start, &end) {
        Ok(b) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "orderTypeBreakdown": b })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn top_items(req: HttpRequest, q: web::Query<LimitQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let limit = q.limit.unwrap_or(10).max(1) as usize;
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    let transactions = fetch_transactions(&conn, &start, &end).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({ "success": true, "topItems": aggregate_top_items(&transactions, limit) }))
}

async fn sales_by_date(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    match fetch_transactions(&conn, &start, &end) {
        Ok(t) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "transactions": t })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn date_range(req: HttpRequest, q: web::Query<RangeQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let (from, to) = match (&q.from, &q.to) {
        (Some(f), Some(t)) => (f.clone(), t.clone()),
        _ => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "from and to are required" })),
    };
    let (start, end) = match range_from_dates(&from, &to) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date range" })),
    };
    match fetch_transactions(&conn, &start, &end) {
        Ok(t) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "transactions": t })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn transaction_by_invoice(req: HttpRequest, q: web::Query<InvoiceQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let invoice = match &q.invoice {
        Some(i) if !i.is_empty() => i.clone(),
        _ => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "invoice is required" })),
    };
    let sql = format!(
        "SELECT {} FROM sales_transactions WHERE invoice_number = ?1 LIMIT 1",
        SALES_COLUMNS
    );
    match conn.query_row(&sql, rusqlite::params![invoice], |row| row_to_transaction(row)) {
        Ok(t) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "transaction": t })),
        Err(_) => HttpResponse::NotFound().json(serde_json::json!({ "success": false, "error": "Transaction not found" })),
    }
}

async fn sale_exists(req: HttpRequest, q: web::Query<InvoiceQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let invoice = match &q.invoice {
        Some(i) if !i.is_empty() => i.clone(),
        _ => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "invoice is required" })),
    };
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sales_transactions WHERE invoice_number = ?1",
            rusqlite::params![invoice],
            |row| row.get(0),
        )
        .unwrap_or(0);
    HttpResponse::Ok().json(serde_json::json!({ "success": true, "exists": count > 0 }))
}

async fn recent_dine_in(req: HttpRequest, q: web::Query<RecentQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let limit = q.limit.unwrap_or(20).clamp(1, 200);
    let (filter, tenant) = tenant_filter(&conn);
    // tenant filter uses ?3 here too, but with a different leading param set; rebuild explicitly.
    let (sql, has_tenant) = if tenant.is_some() {
        (
            format!(
                "SELECT {} FROM sales_transactions WHERE order_type = 'dine-in' AND tenant_id = ?1 ORDER BY completed_at DESC LIMIT ?2",
                SALES_COLUMNS
            ),
            true,
        )
    } else {
        let _ = filter;
        (
            format!(
                "SELECT {} FROM sales_transactions WHERE order_type = 'dine-in' ORDER BY completed_at DESC LIMIT ?1",
                SALES_COLUMNS
            ),
            false,
        )
    };
    let result = (|| -> rusqlite::Result<Vec<serde_json::Value>> {
        let mut stmt = conn.prepare(&sql)?;
        if has_tenant {
            stmt.query_map(rusqlite::params![tenant.unwrap(), limit], |row| row_to_transaction(row))?
                .collect()
        } else {
            stmt.query_map(rusqlite::params![limit], |row| row_to_transaction(row))?
                .collect()
        }
    })();
    match result {
        Ok(t) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "transactions": t })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn search(req: HttpRequest, q: web::Query<SearchQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let query = q.q.clone().unwrap_or_default();
    let like = format!("%{}%", query);
    let tenant = resolve_tenant(&conn);
    // Build dynamically: optional tenant + optional order_type filters.
    let mut clauses: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(t) = &tenant {
        clauses.push("tenant_id = ?".to_string());
        params.push(Box::new(t.clone()));
    }
    if let Some(ot) = &q.order_type {
        if !ot.is_empty() {
            clauses.push("order_type = ?".to_string());
            params.push(Box::new(ot.clone()));
        }
    }
    clauses.push("(invoice_number LIKE ? OR CAST(table_number AS TEXT) LIKE ?)".to_string());
    params.push(Box::new(like.clone()));
    params.push(Box::new(like));

    let sql = format!(
        "SELECT {} FROM sales_transactions WHERE {} ORDER BY completed_at DESC LIMIT 50",
        SALES_COLUMNS,
        clauses.join(" AND ")
    );
    let result = (|| -> rusqlite::Result<Vec<serde_json::Value>> {
        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt
            .query_map(param_refs.as_slice(), |row| row_to_transaction(row))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })();
    match result {
        Ok(t) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "transactions": t })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn aggregator_summary(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    let result = (|| -> rusqlite::Result<serde_json::Value> {
        let mut stmt = conn.prepare(
            "SELECT aggregator, COALESCE(SUM(total), 0), COALESCE(SUM(tax), 0),
                    COALESCE(SUM(discount), 0), COUNT(*)
             FROM aggregator_orders
             WHERE status NOT IN ('cancelled') AND created_at >= ?1 AND created_at <= ?2
             GROUP BY aggregator",
        )?;
        let rows = stmt
            .query_map(rusqlite::params![start, end], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut by_aggregator = serde_json::Map::new();
        let (mut total_sales, mut total_orders, mut total_tax, mut total_discount) = (0.0, 0i64, 0.0, 0.0);
        for (agg, total, tax, discount, count) in rows {
            by_aggregator.insert(agg, serde_json::json!({ "orders": count, "sales": total }));
            total_sales += total;
            total_orders += count;
            total_tax += tax;
            total_discount += discount;
        }
        Ok(serde_json::json!({
            "totalSales": total_sales,
            "totalOrders": total_orders,
            "totalTax": total_tax,
            "totalDiscount": total_discount,
            "byAggregator": by_aggregator,
        }))
    })();
    match result {
        Ok(s) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "summary": s })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn aggregator_transactions(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let date = q.date.clone().unwrap_or_else(today_local);
    let (start, end) = match local_day_range(&date) {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({ "success": false, "error": "Invalid date" })),
    };
    let result = (|| -> rusqlite::Result<Vec<serde_json::Value>> {
        let mut stmt = conn.prepare(
            "SELECT id, order_number, aggregator, status, order_type, customer_name, items_json,
                    subtotal, tax, discount, total, payment_method, payment_status, created_at, delivered_at
             FROM aggregator_orders
             WHERE status NOT IN ('cancelled') AND created_at >= ?1 AND created_at <= ?2
             ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![start, end], |row| {
            let items_json: String = row.get::<_, Option<String>>(6)?.unwrap_or_else(|| "[]".to_string());
            let items = serde_json::from_str::<serde_json::Value>(&items_json)
                .unwrap_or(serde_json::Value::Array(vec![]));
            let tax: f64 = row.get(8)?;
            let aggregator: String = row.get(2)?;
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "invoiceNumber": row.get::<_, String>(1)?,
                "orderNumber": row.get::<_, String>(1)?,
                "orderType": "delivery",
                "source": aggregator,
                "status": row.get::<_, String>(3)?,
                "customerName": row.get::<_, Option<String>>(5)?,
                "subtotal": row.get::<_, f64>(7)?,
                "tax": tax,
                "cgst": tax / 2.0,
                "sgst": tax / 2.0,
                "discount": row.get::<_, f64>(9)?,
                "grandTotal": row.get::<_, f64>(10)?,
                "paymentMethod": row.get::<_, Option<String>>(11)?.unwrap_or_else(|| "online".to_string()),
                "paymentStatus": row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "paid".to_string()),
                "items": items,
                "createdAt": row.get::<_, String>(13)?,
                "completedAt": row.get::<_, Option<String>>(14)?.unwrap_or_else(|| row.get::<_, String>(13).unwrap_or_default()),
            }))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })();
    match result {
        Ok(t) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "transactions": t })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

// ----------------------------------------------------------------------------
// Owner-app analytics (mirrors src/lib/analyticsDb.ts shapes, but combines
// POS sales_transactions + aggregator_orders so the owner sees true totals).
// ----------------------------------------------------------------------------

fn to_utc_iso(naive: chrono::NaiveDateTime) -> String {
    Local
        .from_local_datetime(&naive)
        .single()
        .map(|dt| dt.with_timezone(&Utc).to_rfc3339_opts(SecondsFormat::Millis, true))
        .unwrap_or_default()
}

fn start_of_today_utc() -> String {
    to_utc_iso(Local::now().date_naive().and_hms_milli_opt(0, 0, 0, 0).unwrap())
}

/// Start of week = Monday (matches analyticsDb).
fn start_of_week_utc() -> String {
    let now = Local::now();
    let days_since_monday = now.weekday().num_days_from_monday() as i64;
    let monday = now.date_naive() - Duration::days(days_since_monday);
    to_utc_iso(monday.and_hms_milli_opt(0, 0, 0, 0).unwrap())
}

fn start_of_month_utc() -> String {
    let first = Local::now().date_naive().with_day(1).unwrap();
    to_utc_iso(first.and_hms_milli_opt(0, 0, 0, 0).unwrap())
}

fn n_days_ago_utc(days: i64) -> String {
    let d = Local::now().date_naive() - Duration::days(days);
    to_utc_iso(d.and_hms_milli_opt(0, 0, 0, 0).unwrap())
}

/// Combined (revenue, orders) since a UTC instant: POS sales + non-cancelled aggregator.
fn combined_revenue_since(conn: &Connection, since: &str) -> (f64, i64) {
    let tenant = resolve_tenant(conn);
    let (pos_rev, pos_ord): (f64, i64) = if let Some(t) = &tenant {
        conn.query_row(
            "SELECT COALESCE(SUM(grand_total), 0), COUNT(*) FROM sales_transactions
             WHERE completed_at >= ?1 AND tenant_id = ?2",
            rusqlite::params![since, t],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0))
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(grand_total), 0), COUNT(*) FROM sales_transactions WHERE completed_at >= ?1",
            rusqlite::params![since],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0))
    };
    let (agg_rev, agg_ord): (f64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM aggregator_orders
             WHERE created_at >= ?1 AND status NOT IN ('cancelled')",
            rusqlite::params![since],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0));
    (pos_rev + agg_rev, pos_ord + agg_ord)
}

fn metric_obj(revenue: f64, orders: i64) -> serde_json::Value {
    serde_json::json!({
        "revenue": revenue,
        "orders": orders,
        "averageOrderValue": if orders > 0 { revenue / orders as f64 } else { 0.0 },
    })
}

async fn analytics_sales_metrics(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let (today_rev, today_ord) = combined_revenue_since(&conn, &start_of_today_utc());
    let (week_rev, week_ord) = combined_revenue_since(&conn, &start_of_week_utc());
    let (month_rev, month_ord) = combined_revenue_since(&conn, &start_of_month_utc());
    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "salesMetrics": {
            "today": metric_obj(today_rev, today_ord),
            "week": metric_obj(week_rev, week_ord),
            "month": metric_obj(month_rev, month_ord),
        }
    }))
}

async fn analytics_order_metrics(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    // Aggregator lifecycle counts (matches analyticsDb), plus POS completed sales.
    let mut counts = std::collections::HashMap::new();
    if let Ok(mut stmt) = conn.prepare("SELECT status, COUNT(*) FROM aggregator_orders GROUP BY status") {
        if let Ok(rows) = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))) {
            for row in rows.flatten() {
                counts.insert(row.0, row.1);
            }
        }
    }
    let get = |k: &str| *counts.get(k).unwrap_or(&0);
    let pending = get("pending");
    let in_progress = get("confirmed") + get("preparing") + get("ready") + get("out_for_delivery");
    let cancelled = get("cancelled");
    let agg_completed = get("delivered") + get("completed");

    let pos_completed: i64 = conn
        .query_row("SELECT COUNT(*) FROM sales_transactions", [], |r| r.get(0))
        .unwrap_or(0);
    let completed = agg_completed + pos_completed;
    let total = pending + in_progress + completed + cancelled;
    let completion_rate = if total - cancelled > 0 {
        (completed as f64 / (total - cancelled) as f64) * 100.0
    } else {
        0.0
    };
    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "orderMetrics": {
            "total": total,
            "pending": pending,
            "inProgress": in_progress,
            "completed": completed,
            "cancelled": cancelled,
            "completionRate": (completion_rate * 10.0).round() / 10.0,
        }
    }))
}

async fn analytics_performance(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let month = start_of_month_utc();
    // Prep-time metrics come from aggregator timestamps (POS has no accept->ready gap).
    let avg_prep: f64 = conn
        .query_row(
            "SELECT COALESCE(AVG((julianday(ready_at) - julianday(accepted_at)) * 24 * 60), 0)
             FROM aggregator_orders
             WHERE accepted_at IS NOT NULL AND ready_at IS NOT NULL AND created_at >= ?1",
            rusqlite::params![month],
            |r| r.get(0),
        )
        .unwrap_or(0.0);
    let (on_time, total): (i64, i64) = conn
        .query_row(
            "SELECT
               COALESCE(SUM(CASE WHEN (julianday(ready_at) - julianday(accepted_at)) * 24 * 60 <= 30 THEN 1 ELSE 0 END), 0),
               COUNT(*)
             FROM aggregator_orders
             WHERE accepted_at IS NOT NULL AND ready_at IS NOT NULL AND created_at >= ?1",
            rusqlite::params![month],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0));
    let on_time_rate = if total > 0 { (on_time as f64 / total as f64) * 100.0 } else { 100.0 };
    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "performanceMetrics": {
            "averagePrepTime": (avg_prep * 10.0).round() / 10.0,
            "orderAccuracy": 98.0,
            "onTimeDelivery": (on_time_rate * 10.0).round() / 10.0,
            "customerSatisfaction": 4.5,
        }
    }))
}

async fn analytics_popular_items(req: HttpRequest, q: web::Query<LimitQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let limit = q.limit.unwrap_or(10).max(1) as usize;
    let month = start_of_month_utc();

    // Wrap each source's items_json into { items: [...] } so aggregate_top_items can reuse.
    let mut transactions: Vec<serde_json::Value> = Vec::new();
    let tenant = resolve_tenant(&conn);
    let pos_sql = if tenant.is_some() {
        "SELECT items_json FROM sales_transactions WHERE completed_at >= ?1 AND tenant_id = ?2".to_string()
    } else {
        "SELECT items_json FROM sales_transactions WHERE completed_at >= ?1".to_string()
    };
    if let Ok(mut stmt) = conn.prepare(&pos_sql) {
        let map_items = |r: &rusqlite::Row| {
            let items_json: String = r.get(0)?;
            Ok(serde_json::json!({
                "items": serde_json::from_str::<serde_json::Value>(&items_json).unwrap_or(serde_json::Value::Array(vec![]))
            }))
        };
        let rows: Vec<serde_json::Value> = if let Some(t) = &tenant {
            stmt.query_map(rusqlite::params![month, t], map_items).map(|r| r.flatten().collect()).unwrap_or_default()
        } else {
            stmt.query_map(rusqlite::params![month], map_items).map(|r| r.flatten().collect()).unwrap_or_default()
        };
        transactions.extend(rows);
    }
    if let Ok(mut stmt) = conn.prepare(
        "SELECT items_json FROM aggregator_orders WHERE created_at >= ?1 AND status NOT IN ('cancelled')",
    ) {
        let rows: Vec<serde_json::Value> = stmt
            .query_map(rusqlite::params![month], |r| {
                let items_json: Option<String> = r.get(0)?;
                let parsed = serde_json::from_str::<serde_json::Value>(&items_json.unwrap_or_else(|| "[]".to_string()))
                    .unwrap_or(serde_json::Value::Array(vec![]));
                Ok(serde_json::json!({ "items": parsed }))
            })
            .map(|r| r.flatten().collect())
            .unwrap_or_default();
        transactions.extend(rows);
    }

    let items = aggregate_top_items(&transactions, limit);
    // analyticsStore PopularItem requires an id.
    let popular: Vec<serde_json::Value> = items
        .into_iter()
        .enumerate()
        .map(|(i, it)| {
            serde_json::json!({
                "id": format!("item-{}", i),
                "name": it.get("name").cloned().unwrap_or(serde_json::Value::Null),
                "quantity": it.get("quantity").cloned().unwrap_or(serde_json::json!(0)),
                "revenue": it.get("revenue").cloned().unwrap_or(serde_json::json!(0)),
            })
        })
        .collect();
    HttpResponse::Ok().json(serde_json::json!({ "success": true, "popularItems": popular }))
}

async fn analytics_aggregator_performance(req: HttpRequest, q: web::Query<DateQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let month = start_of_month_utc();
    let result = (|| -> rusqlite::Result<Vec<serde_json::Value>> {
        let mut stmt = conn.prepare(
            "SELECT aggregator, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue,
                    SUM(CASE WHEN status NOT IN ('cancelled', 'pending') THEN 1 ELSE 0 END) as accepted
             FROM aggregator_orders
             WHERE created_at >= ?1
             GROUP BY aggregator",
        )?;
        let rows = stmt
            .query_map(rusqlite::params![month], |row| {
                let aggregator: String = row.get(0)?;
                let orders: i64 = row.get(1)?;
                let revenue: f64 = row.get(2)?;
                let accepted: i64 = row.get(3)?;
                Ok(serde_json::json!({
                    "aggregator": aggregator,
                    "orders": orders,
                    "revenue": revenue,
                    "averageOrderValue": if orders > 0 { revenue / orders as f64 } else { 0.0 },
                    "acceptanceRate": if orders > 0 { (accepted as f64 / orders as f64) * 100.0 } else { 100.0 },
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows
            .into_iter()
            .filter(|r| {
                let a = r.get("aggregator").and_then(|v| v.as_str()).unwrap_or("");
                a == "swiggy" || a == "zomato"
            })
            .collect())
    })();
    match result {
        Ok(p) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "aggregatorPerformance": p })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

async fn analytics_daily_sales(req: HttpRequest, q: web::Query<LimitQuery>, data: web::Data<AppState>) -> HttpResponse {
    let conn = match open_db(&data) { Ok(c) => c, Err(e) => return e };
    guard!(&req, &q.key, conn);
    let days = q.limit.unwrap_or(30).clamp(1, 365);
    let since = n_days_ago_utc(days - 1);

    // Aggregate per local day from both sources, keyed by YYYY-MM-DD.
    let mut by_date: std::collections::HashMap<String, (f64, i64)> = std::collections::HashMap::new();
    let tenant = resolve_tenant(&conn);

    let pos_sql = if tenant.is_some() {
        "SELECT DATE(completed_at), COALESCE(SUM(grand_total), 0), COUNT(*) FROM sales_transactions
         WHERE completed_at >= ?1 AND tenant_id = ?2 GROUP BY DATE(completed_at)".to_string()
    } else {
        "SELECT DATE(completed_at), COALESCE(SUM(grand_total), 0), COUNT(*) FROM sales_transactions
         WHERE completed_at >= ?1 GROUP BY DATE(completed_at)".to_string()
    };
    if let Ok(mut stmt) = conn.prepare(&pos_sql) {
        let mapper = |r: &rusqlite::Row| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, i64>(2)?));
        let rows: Vec<(String, f64, i64)> = if let Some(t) = &tenant {
            stmt.query_map(rusqlite::params![since, t], mapper).map(|r| r.flatten().collect()).unwrap_or_default()
        } else {
            stmt.query_map(rusqlite::params![since], mapper).map(|r| r.flatten().collect()).unwrap_or_default()
        };
        for (date, rev, ord) in rows {
            let e = by_date.entry(date).or_insert((0.0, 0));
            e.0 += rev;
            e.1 += ord;
        }
    }
    if let Ok(mut stmt) = conn.prepare(
        "SELECT DATE(created_at), COALESCE(SUM(total), 0), COUNT(*) FROM aggregator_orders
         WHERE created_at >= ?1 AND status NOT IN ('cancelled') GROUP BY DATE(created_at)",
    ) {
        let rows: Vec<(String, f64, i64)> = stmt
            .query_map(rusqlite::params![since], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, i64>(2)?)))
            .map(|r| r.flatten().collect())
            .unwrap_or_default();
        for (date, rev, ord) in rows {
            let e = by_date.entry(date).or_insert((0.0, 0));
            e.0 += rev;
            e.1 += ord;
        }
    }

    // Fill all N days (oldest first), zero-filling gaps.
    let today = Local::now().date_naive();
    let mut result = Vec::new();
    for i in (0..days).rev() {
        let d = today - Duration::days(i);
        let key = d.format("%Y-%m-%d").to_string();
        let (revenue, orders) = by_date.get(&key).copied().unwrap_or((0.0, 0));
        result.push(serde_json::json!({ "date": key, "revenue": revenue, "orders": orders }));
    }
    HttpResponse::Ok().json(serde_json::json!({ "success": true, "dailySales": result }))
}
