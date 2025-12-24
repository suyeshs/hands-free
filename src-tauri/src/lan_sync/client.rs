//! LAN WebSocket Client for KDS/BDS
//!
//! KDS and BDS devices use this client to connect to the POS server.
//! - Discovers POS via mDNS
//! - Connects to POS WebSocket
//! - Receives order broadcasts and emits Tauri events

use crate::lan_sync::types::*;
use futures_util::{SinkExt, StreamExt};
use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tokio_tungstenite::{connect_async, tungstenite::Message};

/// Global client state
static LAN_CLIENT: once_cell::sync::Lazy<Arc<RwLock<Option<LanClient>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(None)));

/// LAN WebSocket Client
pub struct LanClient {
    device_type: DeviceType,
    tenant_id: String,
    client_id: Option<String>,
    server_address: Option<String>,
    server_info: Option<ServerInfo>,
    is_connected: Arc<std::sync::atomic::AtomicBool>,
    connected_at: Option<chrono::DateTime<chrono::Utc>>,
    stop_signal: Option<tokio::sync::oneshot::Sender<()>>,
}

impl LanClient {
    /// Create a new LAN client
    pub fn new(device_type: DeviceType, tenant_id: String) -> Self {
        Self {
            device_type,
            tenant_id,
            client_id: None,
            server_address: None,
            server_info: None,
            is_connected: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            connected_at: None,
            stop_signal: None,
        }
    }

    /// Discover POS servers on the network via mDNS
    pub async fn discover_servers(
        tenant_id: Option<String>,
        timeout_secs: u64,
    ) -> Result<Vec<DiscoveredServer>, String> {
        let mdns = ServiceDaemon::new()
            .map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

        let receiver = mdns
            .browse(MDNS_SERVICE_TYPE)
            .map_err(|e| format!("Failed to browse mDNS: {}", e))?;

        let mut servers = Vec::new();
        let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_secs(timeout_secs);

        loop {
            tokio::select! {
                _ = tokio::time::sleep_until(deadline) => {
                    break;
                }
                event = tokio::task::spawn_blocking({
                    let receiver = receiver.clone();
                    move || receiver.recv_timeout(std::time::Duration::from_millis(100))
                }) => {
                    if let Ok(Ok(event)) = event {
                        match event {
                            ServiceEvent::ServiceResolved(info) => {
                                let server_tenant = info.get_property_val_str("tenant")
                                    .map(|s| s.to_string());

                                // Filter by tenant if specified
                                if let Some(ref filter_tenant) = tenant_id {
                                    if server_tenant.as_ref() != Some(filter_tenant) {
                                        continue;
                                    }
                                }

                                if let Some(addr) = info.get_addresses().iter().next() {
                                    servers.push(DiscoveredServer {
                                        name: info.get_fullname().to_string(),
                                        ip_address: addr.to_string(),
                                        port: info.get_port(),
                                        tenant_id: server_tenant,
                                    });
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        let _ = mdns.shutdown();

        Ok(servers)
    }

    /// Connect to a POS server
    pub async fn connect(
        &mut self,
        server_address: String,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        if self.is_connected.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("Already connected to a server".to_string());
        }

        let url = if server_address.starts_with("ws://") || server_address.starts_with("wss://") {
            server_address.clone()
        } else {
            format!("ws://{}", server_address)
        };

        let (ws_stream, _) = connect_async(&url)
            .await
            .map_err(|e| format!("Failed to connect to {}: {}", url, e))?;

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // Send registration message
        let register = LanMessage::Register {
            device_type: self.device_type.clone(),
            tenant_id: self.tenant_id.clone(),
        };

        ws_sender
            .send(Message::Text(serde_json::to_string(&register).unwrap()))
            .await
            .map_err(|e| format!("Failed to send registration: {}", e))?;

        // Wait for registration acknowledgment
        if let Some(Ok(Message::Text(text))) = ws_receiver.next().await {
            match serde_json::from_str::<LanMessage>(&text) {
                Ok(LanMessage::Registered { client_id, server_info }) => {
                    self.client_id = Some(client_id);
                    self.server_info = Some(server_info);
                }
                Ok(LanMessage::Error { message, code }) => {
                    return Err(format!("Registration failed: {} ({})", message, code));
                }
                _ => {
                    return Err("Unexpected response from server".to_string());
                }
            }
        } else {
            return Err("No response from server".to_string());
        }

        self.server_address = Some(server_address);
        self.is_connected
            .store(true, std::sync::atomic::Ordering::SeqCst);
        self.connected_at = Some(chrono::Utc::now());

        // Create stop signal channel
        let (stop_tx, mut stop_rx) = tokio::sync::oneshot::channel::<()>();
        self.stop_signal = Some(stop_tx);

        let is_connected = self.is_connected.clone();

        // Emit connected event
        let _ = app_handle.emit(
            "lan_connected",
            self.status(),
        );

        println!(
            "[LAN Client] Connected to POS server, client_id: {:?}",
            self.client_id
        );

        // Spawn message handler
        tokio::spawn(async move {
            let mut ping_interval = tokio::time::interval(tokio::time::Duration::from_secs(30));

            loop {
                tokio::select! {
                    // Check for stop signal
                    _ = &mut stop_rx => {
                        println!("[LAN Client] Stop signal received");
                        break;
                    }
                    // Send periodic ping
                    _ = ping_interval.tick() => {
                        let ping = serde_json::to_string(&LanMessage::Ping).unwrap();
                        if ws_sender.send(Message::Text(ping)).await.is_err() {
                            break;
                        }
                    }
                    // Handle incoming messages
                    msg = ws_receiver.next() => {
                        match msg {
                            Some(Ok(Message::Text(text))) => {
                                if let Ok(message) = serde_json::from_str::<LanMessage>(&text) {
                                    handle_message(&app_handle, message);
                                }
                            }
                            Some(Ok(Message::Close(_))) | None => {
                                println!("[LAN Client] Connection closed by server");
                                break;
                            }
                            _ => {}
                        }
                    }
                }
            }

            is_connected.store(false, std::sync::atomic::Ordering::SeqCst);
            let _ = app_handle.emit("lan_disconnected", ());
        });

        Ok(())
    }

    /// Disconnect from the server
    pub async fn disconnect(&mut self) -> Result<(), String> {
        if let Some(stop_tx) = self.stop_signal.take() {
            let _ = stop_tx.send(());
        }

        self.is_connected
            .store(false, std::sync::atomic::Ordering::SeqCst);
        self.server_address = None;
        self.server_info = None;
        self.client_id = None;
        self.connected_at = None;

        Ok(())
    }

    /// Get client status
    pub fn status(&self) -> LanClientStatus {
        LanClientStatus {
            is_connected: self.is_connected.load(std::sync::atomic::Ordering::SeqCst),
            server_address: self.server_address.clone(),
            server_info: self.server_info.clone(),
            connected_at: self.connected_at.map(|t| t.to_rfc3339()),
            device_type: self.device_type.clone(),
        }
    }
}

/// Handle incoming LAN message
fn handle_message(app_handle: &AppHandle, message: LanMessage) {
    match message {
        LanMessage::OrderCreated { order, kitchen_order } => {
            println!("[LAN Client] Received new order");
            let _ = app_handle.emit("lan_order_created", serde_json::json!({
                "order": order,
                "kitchenOrder": kitchen_order,
            }));
        }
        LanMessage::OrderStatusUpdate { order_id, status, updated_at } => {
            println!("[LAN Client] Order status update: {} -> {}", order_id, status);
            let _ = app_handle.emit("lan_order_status_update", serde_json::json!({
                "orderId": order_id,
                "status": status,
                "updatedAt": updated_at,
            }));
        }
        LanMessage::SyncState { orders } => {
            println!("[LAN Client] Received sync state with {} orders", orders.len());
            let _ = app_handle.emit("lan_sync_state", serde_json::json!({
                "orders": orders,
            }));
        }
        LanMessage::Pong => {
            // Server responded to ping
        }
        _ => {}
    }
}

// ============ Tauri Commands ============

/// Discover LAN servers via mDNS
#[tauri::command]
pub async fn discover_lan_servers(
    tenant_id: Option<String>,
    timeout_secs: Option<u64>,
) -> Result<Vec<DiscoveredServer>, String> {
    LanClient::discover_servers(tenant_id, timeout_secs.unwrap_or(5)).await
}

/// Connect to a LAN server (KDS/BDS only)
#[tauri::command]
pub async fn connect_lan_server(
    server_address: String,
    device_type: String,
    tenant_id: String,
    app_handle: AppHandle,
) -> Result<LanClientStatus, String> {
    let mut client_lock = LAN_CLIENT.write().await;

    // Parse device type
    let device_type = match device_type.to_lowercase().as_str() {
        "kds" => DeviceType::Kds,
        "bds" => DeviceType::Bds,
        "manager" => DeviceType::Manager,
        _ => return Err("Invalid device type. Must be 'kds', 'bds', or 'manager'".to_string()),
    };

    // Disconnect existing client if any
    if let Some(ref mut client) = *client_lock {
        client.disconnect().await?;
    }

    let mut client = LanClient::new(device_type, tenant_id);
    client.connect(server_address, app_handle).await?;

    let status = client.status();
    *client_lock = Some(client);

    Ok(status)
}

/// Disconnect from LAN server
#[tauri::command]
pub async fn disconnect_lan_server() -> Result<(), String> {
    let mut client_lock = LAN_CLIENT.write().await;

    if let Some(ref mut client) = *client_lock {
        client.disconnect().await?;
    }

    *client_lock = None;

    Ok(())
}

/// Get LAN client status
#[tauri::command]
pub async fn get_lan_client_status() -> Result<LanClientStatus, String> {
    let client_lock = LAN_CLIENT.read().await;

    match &*client_lock {
        Some(client) => Ok(client.status()),
        None => Ok(LanClientStatus {
            is_connected: false,
            server_address: None,
            server_info: None,
            connected_at: None,
            device_type: DeviceType::Kds,
        }),
    }
}
