//! LAN WebSocket Server for POS
//!
//! The POS device runs this server to broadcast orders to KDS/BDS devices.
//! - Listens on port 3847
//! - Registers mDNS service for discovery
//! - Broadcasts order events to all connected clients

use crate::lan_sync::types::*;
use futures_util::{SinkExt, StreamExt};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
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

        // Register mDNS service
        self.register_mdns()?;

        let clients = self.clients.clone();
        let is_running = self.is_running.clone();
        let tenant_id = self.tenant_id.clone();
        let server_id = self.server_id.clone();
        let broadcast_tx = self.broadcast_tx.clone();

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

                        tokio::spawn(async move {
                            if let Err(e) = handle_connection(
                                stream,
                                addr,
                                clients,
                                tenant_id,
                                server_id,
                                broadcast_tx,
                                app_handle,
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

        let service_name = format!("{}-{}", MDNS_SERVICE_NAME, &self.tenant_id[..8.min(self.tenant_id.len())]);

        let mut properties = HashMap::new();
        properties.insert("tenant".to_string(), self.tenant_id.clone());
        properties.insert("server_id".to_string(), self.server_id.clone());

        let service_info = ServiceInfo::new(
            MDNS_SERVICE_TYPE,
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

/// Handle a single WebSocket connection
async fn handle_connection(
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
