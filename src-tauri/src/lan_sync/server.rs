//! LAN WebSocket Server for POS
//!
//! The POS device runs this server to broadcast orders to KDS/BDS devices.
//! - Listens on port 3847
//! - Registers mDNS service for discovery
//! - Broadcasts order events to all connected clients

use crate::lan_sync::types::*;
use futures_util::{SinkExt, StreamExt};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use rusqlite::Connection;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, Mutex, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use uuid::Uuid;

/// Global server state
static LAN_SERVER: once_cell::sync::Lazy<Arc<RwLock<Option<LanServer>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(None)));

/// Connected client session
struct ClientSession {
    client_id: String,
    device_type: DeviceType,
    connected_at: chrono::DateTime<chrono::Utc>,
    ip_address: String,
    tx: broadcast::Sender<String>,
}

/// LAN WebSocket Server
pub struct LanServer {
    port: u16,
    tenant_id: String,
    server_id: String,
    clients: Arc<Mutex<HashMap<String, ClientSession>>>,
    broadcast_tx: broadcast::Sender<String>,
    is_running: Arc<std::sync::atomic::AtomicBool>,
    started_at: chrono::DateTime<chrono::Utc>,
    local_ip: Option<String>,
    mdns_daemon: Option<ServiceDaemon>,
    db_path: String,
}

impl LanServer {
    /// Create a new LAN server
    pub fn new(tenant_id: String) -> Self {
        let (broadcast_tx, _) = broadcast::channel(1000);
        let local_ip = local_ip_address::local_ip().ok().map(|ip| ip.to_string());

        Self {
            port: LAN_SYNC_PORT,
            tenant_id,
            server_id: Uuid::new_v4().to_string(),
            clients: Arc::new(Mutex::new(HashMap::new())),
            broadcast_tx,
            is_running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            started_at: chrono::Utc::now(),
            local_ip,
            mdns_daemon: None,
            db_path: String::new(),
        }
    }

    /// Start the WebSocket server
    pub async fn start(&mut self, app_handle: AppHandle) -> Result<String, String> {
        if self.is_running.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("LAN server is already running".to_string());
        }

        let addr = format!("0.0.0.0:{}", self.port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

        self.is_running
            .store(true, std::sync::atomic::Ordering::SeqCst);
        self.started_at = chrono::Utc::now();

        // Derive database path from app_handle
        self.db_path = app_handle
            .path()
            .app_data_dir()
            .map(|d| d.join(crate::get_db_filename()).to_string_lossy().to_string())
            .unwrap_or_default();

        // Register mDNS service
        self.register_mdns()?;

        let clients = self.clients.clone();
        let is_running = self.is_running.clone();
        let tenant_id = self.tenant_id.clone();
        let server_id = self.server_id.clone();
        let broadcast_tx = self.broadcast_tx.clone();
        let db_path = self.db_path.clone();

        // Spawn server task
        tokio::spawn(async move {
            while is_running.load(std::sync::atomic::Ordering::SeqCst) {
                tokio::select! {
                    Ok((stream, addr)) = listener.accept() => {
                        let clients = clients.clone();
                        let tenant_id = tenant_id.clone();
                        let server_id = server_id.clone();
                        let broadcast_tx = broadcast_tx.clone();
                        let app_handle = app_handle.clone();
                        let db_path = db_path.clone();

                        tokio::spawn(async move {
                            if let Err(e) = handle_connection(
                                stream,
                                addr,
                                clients,
                                tenant_id,
                                server_id,
                                broadcast_tx,
                                app_handle,
                                db_path,
                            ).await {
                                eprintln!("[LAN Server] Connection error: {}", e);
                            }
                        });
                    }
                    _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                        // Check if we should stop
                    }
                }
            }
        });

        let address = self
            .local_ip
            .clone()
            .unwrap_or_else(|| "localhost".to_string());
        Ok(format!("ws://{}:{}", address, self.port))
    }

    /// Register mDNS service for discovery
    fn register_mdns(&mut self) -> Result<(), String> {
        let mdns = ServiceDaemon::new().map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

        let host_name = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "handsfree-pos".to_string());

        let service_name = format!("{}-{}", get_mdns_service_name(), &self.tenant_id[..8.min(self.tenant_id.len())]);

        let mut properties = HashMap::new();
        properties.insert("tenant".to_string(), self.tenant_id.clone());
        properties.insert("server_id".to_string(), self.server_id.clone());

        let service_info = ServiceInfo::new(
            &get_mdns_service_type(),
            &service_name,
            &format!("{}.local.", host_name),
            self.local_ip.as_deref().unwrap_or(""),
            self.port,
            properties,
        )
        .map_err(|e| format!("Failed to create service info: {}", e))?;

        mdns.register(service_info)
            .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

        self.mdns_daemon = Some(mdns);
        println!(
            "[LAN Server] mDNS registered: {} on port {}",
            service_name, self.port
        );

        Ok(())
    }

    /// Stop the server
    pub async fn stop(&mut self) -> Result<(), String> {
        self.is_running
            .store(false, std::sync::atomic::Ordering::SeqCst);

        // Unregister mDNS
        if let Some(mdns) = self.mdns_daemon.take() {
            let _ = mdns.shutdown();
        }

        // Close all client connections
        let mut clients = self.clients.lock().await;
        clients.clear();

        Ok(())
    }

    /// Broadcast a message to all connected clients
    pub async fn broadcast(&self, message: &LanMessage) -> Result<usize, String> {
        let json = serde_json::to_string(message)
            .map_err(|e| format!("Failed to serialize message: {}", e))?;

        let sent = self.broadcast_tx.send(json).unwrap_or(0);
        Ok(sent)
    }

    /// Get server status
    pub async fn status(&self) -> LanServerStatus {
        let clients = self.clients.lock().await;
        let client_infos: Vec<ClientInfo> = clients
            .values()
            .map(|c| ClientInfo {
                client_id: c.client_id.clone(),
                device_type: c.device_type.clone(),
                connected_at: c.connected_at.to_rfc3339(),
                ip_address: c.ip_address.clone(),
            })
            .collect();

        LanServerStatus {
            is_running: self.is_running.load(std::sync::atomic::Ordering::SeqCst),
            port: self.port,
            ip_address: self.local_ip.clone(),
            mdns_registered: self.mdns_daemon.is_some(),
            connected_clients: client_infos,
            started_at: Some(self.started_at.to_rfc3339()),
        }
    }
}

/// Handle a single connection — routes to HTTP or WebSocket based on the request
async fn handle_connection(
    stream: TcpStream,
    addr: SocketAddr,
    clients: Arc<Mutex<HashMap<String, ClientSession>>>,
    tenant_id: String,
    server_id: String,
    broadcast_tx: broadcast::Sender<String>,
    app_handle: AppHandle,
    db_path: String,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Peek at the request to decide HTTP vs WebSocket — peek does not consume bytes
    let mut peek_buf = [0u8; 512];
    let n = stream.peek(&mut peek_buf).await.unwrap_or(0);
    let preview = std::str::from_utf8(&peek_buf[..n]).unwrap_or("").to_lowercase();

    if preview.contains("upgrade: websocket") {
        handle_websocket_connection(stream, addr, clients, tenant_id, server_id, broadcast_tx, app_handle).await
    } else {
        handle_http_connection(stream, db_path, broadcast_tx, app_handle, tenant_id, server_id).await
    }
}

/// Handle a WebSocket connection (original logic)
async fn handle_websocket_connection(
    stream: TcpStream,
    addr: SocketAddr,
    clients: Arc<Mutex<HashMap<String, ClientSession>>>,
    tenant_id: String,
    server_id: String,
    broadcast_tx: broadcast::Sender<String>,
    app_handle: AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws_stream = accept_async(stream).await?;
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    let client_id = Uuid::new_v4().to_string();
    let mut device_type = DeviceType::Kds; // Default
    let mut broadcast_rx = broadcast_tx.subscribe();

    println!("[LAN Server] New connection from {}", addr);

    // Wait for registration message
    if let Some(Ok(msg)) = ws_receiver.next().await {
        if let Message::Text(text) = msg {
            if let Ok(LanMessage::Register {
                device_type: dt,
                tenant_id: client_tenant,
            }) = serde_json::from_str(&text)
            {
                if client_tenant != tenant_id {
                    let error = LanMessage::Error {
                        message: "Tenant ID mismatch".to_string(),
                        code: "TENANT_MISMATCH".to_string(),
                    };
                    let _ = ws_sender
                        .send(Message::Text(serde_json::to_string(&error)?))
                        .await;
                    return Ok(());
                }

                device_type = dt;

                // Send registration acknowledgment
                let clients_lock = clients.lock().await;
                let ack = LanMessage::Registered {
                    client_id: client_id.clone(),
                    server_info: ServerInfo {
                        server_id: server_id.clone(),
                        tenant_id: tenant_id.clone(),
                        connected_clients: clients_lock.len(),
                        server_time: chrono::Utc::now().to_rfc3339(),
                    },
                };
                drop(clients_lock);

                ws_sender
                    .send(Message::Text(serde_json::to_string(&ack)?))
                    .await?;
            }
        }
    }

    // Add client to the list
    {
        let mut clients_lock = clients.lock().await;
        clients_lock.insert(
            client_id.clone(),
            ClientSession {
                client_id: client_id.clone(),
                device_type: device_type.clone(),
                connected_at: chrono::Utc::now(),
                ip_address: addr.ip().to_string(),
                tx: broadcast_tx.clone(),
            },
        );
    }

    // Emit event to frontend
    let _ = app_handle.emit(
        "lan_client_connected",
        ClientInfo {
            client_id: client_id.clone(),
            device_type: device_type.clone(),
            connected_at: chrono::Utc::now().to_rfc3339(),
            ip_address: addr.ip().to_string(),
        },
    );

    println!(
        "[LAN Server] Client registered: {} ({:?})",
        client_id, device_type
    );

    // Handle messages
    loop {
        tokio::select! {
            // Incoming message from client
            msg = ws_receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(LanMessage::Ping) = serde_json::from_str(&text) {
                            let pong = serde_json::to_string(&LanMessage::Pong)?;
                            let _ = ws_sender.send(Message::Text(pong)).await;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        break;
                    }
                    _ => {}
                }
            }
            // Broadcast message to client
            Ok(msg) = broadcast_rx.recv() => {
                if ws_sender.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
        }
    }

    // Remove client on disconnect
    {
        let mut clients_lock = clients.lock().await;
        clients_lock.remove(&client_id);
    }

    // Emit disconnect event
    let _ = app_handle.emit("lan_client_disconnected", &client_id);

    println!("[LAN Server] Client disconnected: {}", client_id);

    Ok(())
}

// ============ HTTP API (for staff mobile app) ============

/// Minimal HTTP server that handles /health, /api/menu, /api/order on the same port as WebSocket.
/// Writes raw HTTP/1.1 responses over the TcpStream.
async fn handle_http_connection(
    mut stream: TcpStream,
    db_path: String,
    broadcast_tx: broadcast::Sender<String>,
    app_handle: AppHandle,
    tenant_id: String,
    server_id: String,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = vec![0u8; 16384];
    let n = stream.read(&mut buf).await.unwrap_or(0);
    let request = String::from_utf8_lossy(&buf[..n]);

    let first_line = request.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("").split('?').next().unwrap_or("");

    // CORS preflight
    if method == "OPTIONS" {
        let resp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n";
        stream.write_all(resp.as_bytes()).await?;
        return Ok(());
    }

    let (status, body) = match (method, path) {
        ("GET", "/health") => {
            // Includes tenant_id/server_id so a manual "Connect by IP" probe can identify
            // the server and connect without relying on mDNS discovery.
            let body = serde_json::json!({
                "status": "healthy",
                "service": "handsfree-lan-server",
                "tenant_id": tenant_id,
                "server_id": server_id,
            }).to_string();
            (200u16, body)
        }
        ("GET", "/api/menu") => {
            match lan_fetch_menu(&db_path) {
                Ok(menu) => (200, serde_json::to_string(&menu).unwrap_or_default()),
                Err(e) => (500, serde_json::json!({"success": false, "error": e}).to_string()),
            }
        }
        ("POST", "/api/order") => {
            let body_str = request.find("\r\n\r\n")
                .map(|i| &request[i + 4..])
                .unwrap_or("");
            match lan_insert_order(&db_path, body_str, &broadcast_tx, &app_handle) {
                Ok(order_id) => {
                    (200, serde_json::json!({"success": true, "order_id": order_id, "message": "Order received"}).to_string())
                }
                Err(e) => (400, serde_json::json!({"success": false, "error": e}).to_string()),
            }
        }
        _ => (404, serde_json::json!({"error": "not found"}).to_string()),
    };

    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {len}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n{body}",
        status = match status { 200 => "200 OK", 400 => "400 Bad Request", 404 => "404 Not Found", _ => "500 Internal Server Error" },
        len = body.len(),
        body = body
    );
    stream.write_all(response.as_bytes()).await?;
    Ok(())
}

#[derive(serde::Serialize)]
struct LanMenuResponse {
    success: bool,
    categories: Vec<LanMenuCategory>,
    restaurant_name: String,
}

#[derive(serde::Serialize)]
struct LanMenuCategory {
    name: String,
    items: Vec<LanMenuItem>,
}

#[derive(serde::Serialize)]
struct LanMenuItem {
    item_id: String,
    name: String,
    price: f64,
    category: String,
    description: Option<String>,
    is_veg: Option<bool>,
}

fn lan_fetch_menu(db_path: &str) -> Result<LanMenuResponse, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let restaurant_name = conn
        .query_row("SELECT name FROM restaurant_settings LIMIT 1", [], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "Restaurant".to_string());

    let mut stmt = conn.prepare(
        "SELECT mi.id, mi.name, mi.price, mc.name, mi.description, mi.is_vegetarian
         FROM menu_items mi
         LEFT JOIN menu_categories mc ON mi.category_id = mc.id
         WHERE mi.is_available = 1
         ORDER BY mc.display_order, mi.display_order"
    ).map_err(|e| e.to_string())?;

    let mut category_map: std::collections::HashMap<String, Vec<LanMenuItem>> = std::collections::HashMap::new();
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "Other".to_string()),
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<bool>>(5)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in rows.flatten() {
        let (id, name, price, category, description, is_veg) = row;
        category_map.entry(category.clone()).or_default().push(LanMenuItem {
            item_id: id,
            name,
            price,
            category,
            description,
            is_veg,
        });
    }

    let categories = category_map.into_iter()
        .map(|(name, items)| LanMenuCategory { name, items })
        .collect();

    Ok(LanMenuResponse { success: true, categories, restaurant_name })
}

#[derive(serde::Deserialize)]
struct LanOrderItem {
    item_id: String,
    name: String,
    quantity: i32,
    price: f64,
    notes: Option<String>,
}

#[derive(serde::Deserialize)]
struct LanOrder {
    table_number: String,
    items: Vec<LanOrderItem>,
    customer_name: Option<String>,
    special_instructions: Option<String>,
    staff_id: Option<String>,
}

fn lan_insert_order(
    db_path: &str,
    body: &str,
    broadcast_tx: &broadcast::Sender<String>,
    app_handle: &AppHandle,
) -> Result<String, String> {
    let order: LanOrder = serde_json::from_str(body).map_err(|e| format!("Invalid JSON: {}", e))?;

    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let order_id = format!("STAFF-{}", chrono::Utc::now().timestamp_millis());
    let timestamp = chrono::Utc::now().to_rfc3339();

    let total: f64 = order.items.iter().map(|i| i.price * i.quantity as f64).sum();

    conn.execute(
        "INSERT INTO guest_orders (id, table_number, customer_name, customer_phone,
                 special_instructions, total_amount, status, source, created_at)
         VALUES (?1, ?2, ?3, NULL, ?4, ?5, 'pending', 'staff-app', ?6)",
        rusqlite::params![
            &order_id,
            &order.table_number,
            &order.customer_name,
            &order.special_instructions,
            total,
            &timestamp,
        ],
    ).map_err(|e| e.to_string())?;

    for (i, item) in order.items.iter().enumerate() {
        conn.execute(
            "INSERT INTO guest_order_items (order_id, item_id, name, quantity, price, notes, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                &order_id, &item.item_id, &item.name, item.quantity, item.price, &item.notes, i as i32,
            ],
        ).ok();
    }

    // Notify POS frontend
    let event_data = serde_json::json!({
        "order_id": &order_id,
        "table_number": &order.table_number,
        "items": order.items.iter().map(|i| serde_json::json!({
            "item_id": &i.item_id, "name": &i.name,
            "quantity": i.quantity, "price": i.price,
        })).collect::<Vec<_>>(),
        "customer_name": &order.customer_name,
        "staff_id": &order.staff_id,
        "total_amount": total,
        "source": "staff-app",
    });
    let _ = app_handle.emit("new-guest-order", &event_data);

    // Broadcast to WebSocket clients (KDS devices)
    let _ = broadcast_tx.send(serde_json::json!({
        "type": "new_order",
        "order_id": &order_id,
        "table_number": &order.table_number,
        "total_amount": total,
    }).to_string());

    println!("[LAN Server] Staff order {} created for table {}", order_id, order.table_number);
    Ok(order_id)
}

// ============ Tauri Commands ============

/// Start the LAN server (POS only)
#[tauri::command]
pub async fn start_lan_server(
    tenant_id: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    let mut server_lock = LAN_SERVER.write().await;

    if server_lock.is_some() {
        return Err("LAN server is already running".to_string());
    }

    let mut server = LanServer::new(tenant_id);
    let address = server.start(app_handle).await?;

    *server_lock = Some(server);

    Ok(address)
}

/// Stop the LAN server
#[tauri::command]
pub async fn stop_lan_server() -> Result<(), String> {
    let mut server_lock = LAN_SERVER.write().await;

    if let Some(ref mut server) = *server_lock {
        server.stop().await?;
    }

    *server_lock = None;

    Ok(())
}

/// Get LAN server status
#[tauri::command]
pub async fn get_lan_server_status() -> Result<LanServerStatus, String> {
    let server_lock = LAN_SERVER.read().await;

    match &*server_lock {
        Some(server) => Ok(server.status().await),
        None => Ok(LanServerStatus {
            is_running: false,
            port: LAN_SYNC_PORT,
            ip_address: local_ip_address::local_ip().ok().map(|ip| ip.to_string()),
            mdns_registered: false,
            connected_clients: vec![],
            started_at: None,
        }),
    }
}

/// Broadcast an order to all connected clients
#[tauri::command]
pub async fn broadcast_order(
    order: serde_json::Value,
    kitchen_order: serde_json::Value,
) -> Result<usize, String> {
    let server_lock = LAN_SERVER.read().await;

    match &*server_lock {
        Some(server) => {
            let message = LanMessage::OrderCreated {
                order,
                kitchen_order,
            };
            server.broadcast(&message).await
        }
        None => Err("LAN server is not running".to_string()),
    }
}

/// Broadcast an order status update to all connected clients
#[tauri::command]
pub async fn broadcast_order_status(
    order_id: String,
    status: String,
) -> Result<usize, String> {
    let server_lock = LAN_SERVER.read().await;

    match &*server_lock {
        Some(server) => {
            let message = LanMessage::OrderStatusUpdate {
                order_id,
                status,
                updated_at: chrono::Utc::now().to_rfc3339(),
            };
            server.broadcast(&message).await
        }
        None => Err("LAN server is not running".to_string()),
    }
}

/// Get list of connected LAN clients
#[tauri::command]
pub async fn get_lan_clients() -> Result<Vec<ClientInfo>, String> {
    let server_lock = LAN_SERVER.read().await;

    match &*server_lock {
        Some(server) => {
            let status = server.status().await;
            Ok(status.connected_clients)
        }
        None => Ok(vec![]),
    }
}
