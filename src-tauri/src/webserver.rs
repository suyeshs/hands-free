/**
 * Local Web Server for QR Code Ordering
 *
 * Runs on localhost:3000 and handles:
 * - GET /api/menu - Return menu items
 * - POST /api/order - Accept guest orders
 * - GET /api/order/:id/status - Get order status
 * - WebSocket /ws/order/:id - Real-time order status updates
 * - GET /health - Health check
 * - GET /order?table=X - Serve ordering UI
 * - GET /track?order=ID - Serve order tracking UI
 */

use actix_web::{web, App, HttpServer, HttpResponse, middleware, Error, HttpRequest};
use actix_web_actors::ws;
use actix_cors::Cors;
use actix::prelude::*;
use actix_governor::{Governor, GovernorConfigBuilder, KeyExtractor, SimpleKeyExtractionError};
use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use chrono::Utc;
use std::time::{Duration, Instant};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MenuItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub category: String,
    pub image_url: Option<String>,
    pub is_available: bool,
    pub is_vegetarian: bool,
    pub is_spicy: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuCategory {
    pub name: String,
    pub items: Vec<MenuItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuResponse {
    pub success: bool,
    pub categories: Vec<MenuCategory>,
    pub restaurant_name: String,
    pub restaurant_tagline: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct OrderItem {
    pub item_id: String,
    pub name: String,
    pub quantity: u32,
    pub price: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GuestOrder {
    pub table_number: String,
    pub items: Vec<OrderItem>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub special_instructions: Option<String>,
    pub token: Option<String>, // Security token for QR code orders
}

#[derive(Debug, Serialize)]
pub struct OrderResponse {
    pub success: bool,
    pub order_id: String,
    pub message: String,
    pub estimated_time: Option<u32>, // minutes
}

#[derive(Debug, Deserialize)]
pub struct StaffCallRequest {
    pub table_number: String,
    pub requests: Vec<String>,
    pub custom_request: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StaffCallResponse {
    pub success: bool,
    pub message: String,
}

// Shared app state
pub struct AppState {
    pub app_handle: Arc<Mutex<AppHandle>>,
    pub db_path: String,
}

// Custom key extractor for rate limiting based on IP address
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IpKeyExtractor;

impl KeyExtractor for IpKeyExtractor {
    type Key = String;
    type KeyExtractionError = SimpleKeyExtractionError<&'static str>;

    fn extract(&self, req: &actix_web::dev::ServiceRequest) -> Result<Self::Key, Self::KeyExtractionError> {
        let connection_info = req.connection_info();
        let ip = connection_info
            .peer_addr()
            .ok_or(SimpleKeyExtractionError::new("Could not extract IP address"))?;
        Ok(ip.to_string())
    }
}

/// Get menu from SQLite database
async fn get_menu(data: web::Data<AppState>) -> HttpResponse {
    let db_path = data.db_path.clone();

    // Open database connection
    let conn = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("[WebServer] Failed to open database: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Database connection failed"
            }));
        }
    };

    // Get restaurant settings
    let restaurant_name = conn
        .query_row("SELECT name FROM restaurant_settings LIMIT 1", [], |row| {
            row.get::<_, String>(0)
        })
        .unwrap_or_else(|_| "Restaurant".to_string());

    let restaurant_tagline = conn
        .query_row("SELECT tagline FROM restaurant_settings LIMIT 1", [], |row| {
            row.get::<_, String>(0)
        })
        .ok();

    // Get menu items grouped by category
    let mut stmt = match conn.prepare(
        "SELECT mi.id, mi.name, mi.description, mi.price, mc.name as category,
                mi.image_url, mi.is_available, mi.is_vegetarian, mi.is_spicy
         FROM menu_items mi
         LEFT JOIN menu_categories mc ON mi.category_id = mc.id
         WHERE mi.is_available = 1
         ORDER BY mc.display_order, mi.display_order"
    ) {
        Ok(stmt) => stmt,
        Err(e) => {
            eprintln!("[WebServer] Failed to prepare menu query: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Failed to fetch menu"
            }));
        }
    };

    let menu_items = match stmt.query_map([], |row| {
        Ok(MenuItem {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            price: row.get(3)?,
            category: row.get::<_, Option<String>>(4)?.unwrap_or_else(|| "Other".to_string()),
            image_url: row.get(5)?,
            is_available: row.get(6)?,
            is_vegetarian: row.get(7)?,
            is_spicy: row.get(8)?,
        })
    }) {
        Ok(items) => items,
        Err(e) => {
            eprintln!("[WebServer] Failed to fetch menu items: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Failed to fetch menu items"
            }));
        }
    };

    // Group items by category
    let mut categories: std::collections::HashMap<String, Vec<MenuItem>> = std::collections::HashMap::new();
    for item in menu_items {
        match item {
            Ok(menu_item) => {
                categories
                    .entry(menu_item.category.clone())
                    .or_insert_with(Vec::new)
                    .push(menu_item);
            }
            Err(e) => eprintln!("[WebServer] Error processing menu item: {}", e),
        }
    }

    // Convert to MenuCategory array
    let category_list: Vec<MenuCategory> = categories
        .into_iter()
        .map(|(name, items)| MenuCategory { name, items })
        .collect();

    HttpResponse::Ok().json(MenuResponse {
        success: true,
        categories: category_list,
        restaurant_name,
        restaurant_tagline,
    })
}

/// Submit guest order
async fn submit_order(
    order: web::Json<GuestOrder>,
    data: web::Data<AppState>,
) -> HttpResponse {
    let db_path = data.db_path.clone();

    // Open database connection
    let conn = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("[WebServer] Failed to open database: {}", e);
            return HttpResponse::InternalServerError().json(OrderResponse {
                success: false,
                order_id: String::new(),
                message: "Failed to connect to database".to_string(),
                estimated_time: None,
            });
        }
    };

    // Validate table token if provided (for enhanced security)
    if let Some(token) = &order.token {
        let now = Utc::now().timestamp();
        let is_valid = conn
            .query_row(
                "SELECT 1 FROM table_tokens
                 WHERE table_id = ?1 AND token = ?2 AND expires_at > ?3",
                rusqlite::params![&order.table_number, token, now],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !is_valid {
            println!("[WebServer] Invalid or expired token for table: {}", order.table_number);
            return HttpResponse::Unauthorized().json(OrderResponse {
                success: false,
                order_id: String::new(),
                message: "Invalid or expired table code. Please scan the QR code again.".to_string(),
                estimated_time: None,
            });
        }

        println!("[WebServer] Valid token for table: {}", order.table_number);
    } else {
        // Optional: Warn about missing token but still allow order
        println!("[WebServer] Warning: Order submitted without token for table: {}", order.table_number);
    }

    // Generate order ID
    let order_id = format!("QR-{}", Utc::now().timestamp());

    // Validate items and calculate total
    let mut total_amount = 0.0;
    for item in &order.items {
        // Verify item exists and price matches
        let db_price: Result<f64, _> = conn.query_row(
            "SELECT price FROM menu_items WHERE id = ? AND is_available = 1",
            [&item.item_id],
            |row| row.get(0),
        );

        match db_price {
            Ok(price) => {
                if (price - item.price).abs() > 0.01 {
                    return HttpResponse::BadRequest().json(OrderResponse {
                        success: false,
                        order_id: String::new(),
                        message: format!("Price mismatch for item: {}", item.name),
                        estimated_time: None,
                    });
                }
                total_amount += price * item.quantity as f64;
            }
            Err(_) => {
                return HttpResponse::BadRequest().json(OrderResponse {
                    success: false,
                    order_id: String::new(),
                    message: format!("Item not available: {}", item.name),
                    estimated_time: None,
                });
            }
        }
    }

    // Insert order into database
    let timestamp = Utc::now().to_rfc3339();
    if let Err(e) = conn.execute(
        "INSERT INTO guest_orders (id, table_number, customer_name, customer_phone,
                            special_instructions, total_amount, status, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            &order_id,
            &order.table_number,
            &order.customer_name,
            &order.customer_phone,
            &order.special_instructions,
            total_amount,
            "pending",
            "qr-code",
            &timestamp,
        ],
    ) {
        eprintln!("[WebServer] Failed to insert order: {}", e);
        return HttpResponse::InternalServerError().json(OrderResponse {
            success: false,
            order_id: String::new(),
            message: "Failed to create order".to_string(),
            estimated_time: None,
        });
    }

    // Insert order items
    for (index, item) in order.items.iter().enumerate() {
        if let Err(e) = conn.execute(
            "INSERT INTO guest_order_items (order_id, item_id, name, quantity, price, notes, position)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                &order_id,
                &item.item_id,
                &item.name,
                item.quantity,
                item.price,
                &item.notes,
                index as i32,
            ],
        ) {
            eprintln!("[WebServer] Failed to insert order item: {}", e);
        }
    }

    println!("[WebServer] ✅ Order {} created for table {}", order_id, order.table_number);

    // Emit Tauri event to notify frontend
    if let Ok(app_handle) = data.app_handle.lock() {
        let order_data = serde_json::json!({
            "order_id": order_id,
            "table_number": order.table_number,
            "items": order.items,
            "customer_name": order.customer_name,
            "total_amount": total_amount,
        });

        if let Err(e) = app_handle.emit("new-guest-order", &order_data) {
            eprintln!("[WebServer] Failed to emit event: {}", e);
        }
    }

    HttpResponse::Ok().json(OrderResponse {
        success: true,
        order_id: order_id.clone(),
        message: "Order received! We'll have it ready soon.".to_string(),
        estimated_time: Some(20), // 20 minutes default
    })
}

/// Handle staff call request
async fn call_staff(
    request: web::Json<StaffCallRequest>,
    data: web::Data<AppState>,
) -> HttpResponse {
    let call = request.into_inner();
    println!("[WebServer] 📞 Staff call from table {}", call.table_number);
    println!("[WebServer] Requests: {:?}", call.requests);
    if let Some(ref custom) = call.custom_request {
        println!("[WebServer] Custom request: {}", custom);
    }

    // Build request message
    let mut message_parts = Vec::new();
    if !call.requests.is_empty() {
        message_parts.push(call.requests.join(", "));
    }
    if let Some(custom) = call.custom_request.as_ref() {
        if !custom.is_empty() {
            message_parts.push(custom.clone());
        }
    }
    let request_message = message_parts.join(" • ");

    // Emit Tauri event to notify frontend
    if let Ok(app_handle) = data.app_handle.lock() {
        let call_data = serde_json::json!({
            "table_number": call.table_number,
            "requests": call.requests,
            "custom_request": call.custom_request,
            "request_message": request_message,
            "timestamp": Utc::now().to_rfc3339(),
        });

        if let Err(e) = app_handle.emit("staff-call-request", &call_data) {
            eprintln!("[WebServer] Failed to emit staff call event: {}", e);
        }
    }

    HttpResponse::Ok().json(StaffCallResponse {
        success: true,
        message: "Staff has been notified. They'll be with you shortly!".to_string(),
    })
}

/// Get order status
async fn get_order_status(
    order_id: web::Path<String>,
    data: web::Data<AppState>,
) -> HttpResponse {
    let db_path = data.db_path.clone();

    let conn = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("[WebServer] Failed to open database: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Database connection failed"
            }));
        }
    };

    // Get order details
    let order_result = conn.query_row(
        "SELECT status, total_amount, created_at, table_number FROM guest_orders WHERE id = ?",
        [order_id.as_str()],
        |row| {
            Ok(serde_json::json!({
                "order_id": order_id.as_str(),
                "status": row.get::<_, String>(0)?,
                "total_amount": row.get::<_, f64>(1)?,
                "created_at": row.get::<_, String>(2)?,
                "table_number": row.get::<_, String>(3)?,
            }))
        },
    );

    match order_result {
        Ok(order_data) => HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "order": order_data
        })),
        Err(_) => HttpResponse::NotFound().json(serde_json::json!({
            "success": false,
            "error": "Order not found"
        })),
    }
}

#[derive(Debug, Deserialize)]
pub struct BillQuery {
    pub token: Option<String>,
}

/// Normalize a CartItem[] array (as stored in table_sessions.order_data or
/// sales_transactions.items_json) into flat bill lines the customer client renders.
fn normalize_items(items: &serde_json::Value) -> Vec<serde_json::Value> {
    items
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|it| {
                    let name = it
                        .get("menuItem")
                        .and_then(|m| m.get("name"))
                        .and_then(|n| n.as_str())
                        .or_else(|| it.get("name").and_then(|n| n.as_str()))
                        .unwrap_or("Item");
                    let quantity = it.get("quantity").and_then(|q| q.as_u64()).unwrap_or(1);
                    let amount = it
                        .get("subtotal")
                        .and_then(|s| s.as_f64())
                        .or_else(|| it.get("price").and_then(|p| p.as_f64()))
                        .unwrap_or(0.0);
                    serde_json::json!({
                        "name": name,
                        "quantity": quantity,
                        "amount": amount,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Get the live bill for a table.
///
/// Reads straight from the local SQLite — the same authoritative rows the POS
/// writes — so the customer's phone sees the current total with zero sync lag.
/// Prefers the open table session; falls back to the most recent finalized sale.
async fn get_bill(
    table_id: web::Path<String>,
    query: web::Query<BillQuery>,
    data: web::Data<AppState>,
) -> HttpResponse {
    let db_path = data.db_path.clone();
    let table_id = table_id.into_inner();

    let conn = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("[WebServer] Failed to open database: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Database connection failed"
            }));
        }
    };

    // Validate the table token if provided (same scheme as order submission)
    if let Some(token) = &query.token {
        let now = Utc::now().timestamp();
        let is_valid = conn
            .query_row(
                "SELECT 1 FROM table_tokens
                 WHERE table_id = ?1 AND token = ?2 AND expires_at > ?3",
                rusqlite::params![&table_id, token, now],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !is_valid {
            println!("[WebServer] Invalid or expired token for bill, table: {}", table_id);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "success": false,
                "error": "Invalid or expired table code. Please scan the QR code again."
            }));
        }
    }

    // table_number is an INTEGER column in table_sessions / sales_transactions
    let table_number: i64 = match table_id.parse() {
        Ok(n) => n,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "error": "Invalid table id"
            }));
        }
    };

    // 1) Prefer the live, open session — this is the authoritative current bill.
    let active: Option<String> = conn
        .query_row(
            "SELECT order_data FROM table_sessions
             WHERE table_number = ?1 AND status = 'active'
             ORDER BY started_at DESC LIMIT 1",
            rusqlite::params![table_number],
            |row| row.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten();

    if let Some(order_json) = active {
        if let Ok(order) = serde_json::from_str::<serde_json::Value>(&order_json) {
            let items = order.get("items").map(normalize_items).unwrap_or_default();
            let bill = serde_json::json!({
                "table_number": table_number,
                "status": "open",
                "invoice_number": serde_json::Value::Null,
                "items": items,
                "subtotal": order.get("subtotal").and_then(|v| v.as_f64()).unwrap_or(0.0),
                "tax": order.get("tax").and_then(|v| v.as_f64()).unwrap_or(0.0),
                "service_charge": 0.0,
                "discount": order.get("discount").and_then(|v| v.as_f64()).unwrap_or(0.0),
                "grand_total": order.get("total").and_then(|v| v.as_f64()).unwrap_or(0.0),
                "payment_status": "unpaid",
                "payment_method": serde_json::Value::Null,
                "generated_at": order.get("createdAt").cloned().unwrap_or(serde_json::Value::Null),
            });
            return HttpResponse::Ok().json(serde_json::json!({ "success": true, "bill": bill }));
        }
    }

    // 2) Otherwise return the most recent finalized sale for this table.
    let closed = conn.query_row(
        "SELECT invoice_number, subtotal, service_charge, cgst, sgst, discount,
                round_off, grand_total, payment_method, payment_status, items_json, completed_at
         FROM sales_transactions
         WHERE table_number = ?1
         ORDER BY completed_at DESC LIMIT 1",
        rusqlite::params![table_number],
        |row| {
            let items_json: String = row.get(10)?;
            let items = serde_json::from_str::<serde_json::Value>(&items_json)
                .ok()
                .map(|v| normalize_items(&v))
                .unwrap_or_default();
            let cgst: f64 = row.get(3)?;
            let sgst: f64 = row.get(4)?;
            Ok(serde_json::json!({
                "table_number": table_number,
                "status": "closed",
                "invoice_number": row.get::<_, String>(0)?,
                "items": items,
                "subtotal": row.get::<_, f64>(1)?,
                "service_charge": row.get::<_, f64>(2)?,
                "tax": cgst + sgst,
                "cgst": cgst,
                "sgst": sgst,
                "discount": row.get::<_, f64>(5)?,
                "round_off": row.get::<_, f64>(6)?,
                "grand_total": row.get::<_, f64>(7)?,
                "payment_method": row.get::<_, String>(8)?,
                "payment_status": row.get::<_, String>(9)?,
                "generated_at": row.get::<_, String>(11)?,
            }))
        },
    );

    match closed {
        Ok(bill) => HttpResponse::Ok().json(serde_json::json!({ "success": true, "bill": bill })),
        Err(_) => HttpResponse::NotFound().json(serde_json::json!({
            "success": false,
            "error": "No bill found for this table"
        })),
    }
}

// WebSocket actor for real-time order updates
struct OrderWebSocket {
    order_id: String,
    hb: Instant,
    db_path: String,
}

impl OrderWebSocket {
    fn new(order_id: String, db_path: String) -> Self {
        Self {
            order_id,
            hb: Instant::now(),
            db_path,
        }
    }

    // Send heartbeat ping
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(Duration::from_secs(5), |act, ctx| {
            if Instant::now().duration_since(act.hb) > Duration::from_secs(10) {
                println!("[WebSocket] Client timeout, disconnecting");
                ctx.stop();
                return;
            }

            ctx.ping(b"");
        });
    }

    // Check for order status updates
    fn check_status(&self, ctx: &mut ws::WebsocketContext<Self>) {
        let order_id = self.order_id.clone();
        let db_path = self.db_path.clone();

        ctx.run_interval(Duration::from_secs(2), move |_act, ctx| {
            // Query database for current status
            if let Ok(conn) = Connection::open(&db_path) {
                if let Ok(status) = conn.query_row(
                    "SELECT status FROM guest_orders WHERE id = ?",
                    [&order_id],
                    |row| row.get::<_, String>(0),
                ) {
                    // Send status update to client
                    let update = serde_json::json!({
                        "type": "status_update",
                        "order_id": order_id,
                        "status": status,
                        "timestamp": Utc::now().to_rfc3339()
                    });

                    ctx.text(serde_json::to_string(&update).unwrap());
                }
            }
        });
    }
}

impl Actor for OrderWebSocket {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        println!("[WebSocket] Client connected for order: {}", self.order_id);
        self.hb(ctx);
        self.check_status(ctx);

        // Send initial status
        if let Ok(conn) = Connection::open(&self.db_path) {
            if let Ok(status) = conn.query_row(
                "SELECT status FROM guest_orders WHERE id = ?",
                [&self.order_id],
                |row| row.get::<_, String>(0),
            ) {
                let update = serde_json::json!({
                    "type": "connected",
                    "order_id": self.order_id,
                    "status": status,
                    "message": "Connected to real-time updates"
                });

                ctx.text(serde_json::to_string(&update).unwrap());
            }
        }
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        println!("[WebSocket] Client disconnected for order: {}", self.order_id);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for OrderWebSocket {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                println!("[WebSocket] Received: {}", text);
                // Echo back for now
                ctx.text(text);
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

/// WebSocket endpoint for order tracking
async fn order_websocket(
    req: actix_web::HttpRequest,
    stream: web::Payload,
    order_id: web::Path<String>,
    data: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let db_path = data.db_path.clone();
    let ws = OrderWebSocket::new(order_id.into_inner(), db_path);
    ws::start(ws, &req, stream)
}

/// Serve the ordering UI (HTML page)
async fn serve_ordering_page() -> HttpResponse {
    // HTML is embedded directly to avoid file path issues
    let html = include_str!("../static/order.html");
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html)
}

/// Health check endpoint
async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "handsfree-pos-ordering",
        "timestamp": Utc::now().to_rfc3339()
    }))
}

/// Start the local web server
pub async fn start_ordering_server(
    app_handle: AppHandle,
    db_path: String,
    port: u16,
) -> std::io::Result<()> {
    println!("[WebServer] Starting ordering server on http://localhost:{}", port);
    println!("[WebServer] Database path: {}", db_path);

    let app_state = web::Data::new(AppState {
        app_handle: Arc::new(Mutex::new(app_handle)),
        db_path,
    });

    // Rate limiting configuration
    // Order submission: 5 orders per minute per IP (burst of 2)
    let order_rate_limit = GovernorConfigBuilder::default()
        .per_second(5)
        .burst_size(2)
        .key_extractor(IpKeyExtractor)
        .finish()
        .unwrap();

    // Staff call: 2 calls per minute per IP (burst of 1)
    let staff_call_rate_limit = GovernorConfigBuilder::default()
        .per_second(2)
        .burst_size(1)
        .key_extractor(IpKeyExtractor)
        .finish()
        .unwrap();

    // Bill reads: lightweight read endpoint, allow polling (10/sec, burst of 5) per IP
    let bill_read_rate_limit = GovernorConfigBuilder::default()
        .per_second(10)
        .burst_size(5)
        .key_extractor(IpKeyExtractor)
        .finish()
        .unwrap();

    HttpServer::new(move || {
        // CORS configuration - restrict to tunnel domains and localhost
        let cors = Cors::default()
            .allowed_origin_fn(|origin, _req_head| {
                let origin_str = origin.as_bytes();
                // Allow cloudflared Quick Tunnel domains
                origin_str.ends_with(b"trycloudflare.com") ||
                // Allow the named-tunnel hostname (persistent restaurant URL)
                origin_str.ends_with(b".menu.handsfree.com") ||
                // Allow localhost for development
                origin_str.starts_with(b"http://localhost") ||
                origin_str.starts_with(b"http://127.0.0.1") ||
                // Allow LAN devices (RFC1918 private ranges)
                origin_str.starts_with(b"http://192.168.") ||
                origin_str.starts_with(b"http://10.") ||
                origin_str.starts_with(b"http://172.")
            })
            .allowed_methods(vec!["GET", "POST"])
            .allowed_headers(vec![
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ACCEPT,
            ])
            .max_age(3600);

        App::new()
            .app_data(app_state.clone())
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .route("/health", web::get().to(health_check))
            .route("/order", web::get().to(serve_ordering_page))
            .route("/api/menu", web::get().to(get_menu))
            .service(
                web::resource("/api/order")
                    .route(web::post().to(submit_order))
                    .wrap(Governor::new(&order_rate_limit))
            )
            .service(
                web::resource("/api/call-staff")
                    .route(web::post().to(call_staff))
                    .wrap(Governor::new(&staff_call_rate_limit))
            )
            .route("/api/order/{order_id}/status", web::get().to(get_order_status))
            .service(
                web::resource("/api/bill/{table_id}")
                    .route(web::get().to(get_bill))
                    .wrap(Governor::new(&bill_read_rate_limit))
            )
            // Remote sales/analytics reports (read from local SQLite, key-gated)
            .configure(crate::report_endpoints::configure)
            .route("/ws/order/{order_id}", web::get().to(order_websocket))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
