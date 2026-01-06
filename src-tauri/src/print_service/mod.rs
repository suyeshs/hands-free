/**
 * mDNS Print Service Module
 * Allows connected devices on the LAN to send print requests via mDNS discovery
 *
 * Features:
 * - Advertises print service via mDNS (_handsfree-print._tcp)
 * - Runs HTTP server to accept print requests
 * - Forwards print jobs to configured printers (network/system)
 */

use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{SocketAddr, TcpListener};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener as AsyncTcpListener, TcpStream};
use tokio::sync::RwLock;

// Service type for mDNS advertisement
const SERVICE_TYPE: &str = "_handsfree-print._tcp.local.";
const SERVICE_PORT_DEFAULT: u16 = 8765;

/// Print request from a remote device
/// Client sends order_id - POS looks up order and prints using its configured printer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintRequest {
    /// Type of print: "bill", "kot"
    pub print_type: String,
    /// Order ID to print (POS will look up and format)
    pub order_id: String,
    /// Request ID for tracking
    pub request_id: Option<String>,
    /// Requesting device name
    pub device_name: Option<String>,
}

/// Print response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintResponse {
    pub success: bool,
    pub message: String,
    pub request_id: Option<String>,
}

/// Print service status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintServiceStatus {
    pub running: bool,
    pub port: u16,
    pub service_name: String,
    pub local_ip: String,
    pub connected_devices: Vec<String>,
}

/// Discovered print service on the network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredPrintService {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub ip_addresses: Vec<String>,
}

/// Print service state
pub struct PrintServiceState {
    pub running: bool,
    pub port: u16,
    pub service_name: String,
    pub mdns_daemon: Option<ServiceDaemon>,
    pub connected_devices: Vec<String>,
    pub app_handle: Option<AppHandle>,
}

impl Default for PrintServiceState {
    fn default() -> Self {
        Self {
            running: false,
            port: SERVICE_PORT_DEFAULT,
            service_name: String::new(),
            mdns_daemon: None,
            connected_devices: Vec::new(),
            app_handle: None,
        }
    }
}

// Global print service state
lazy_static::lazy_static! {
    pub static ref PRINT_SERVICE_STATE: Arc<RwLock<PrintServiceState>> = Arc::new(RwLock::new(PrintServiceState::default()));
}

/// Get local IP address for mDNS advertisement
fn get_local_ip() -> Option<String> {
    if let Ok(ip) = local_ip_address::local_ip() {
        return Some(ip.to_string());
    }
    None
}

/// Find an available port starting from the default
fn find_available_port(start_port: u16) -> u16 {
    for port in start_port..start_port + 100 {
        if TcpListener::bind(format!("0.0.0.0:{}", port)).is_ok() {
            return port;
        }
    }
    start_port
}

/// Start the mDNS print service
pub async fn start_print_service(device_name: Option<String>, app_handle: AppHandle) -> Result<PrintServiceStatus, String> {
    let mut state = PRINT_SERVICE_STATE.write().await;

    if state.running {
        return Err("Print service is already running".to_string());
    }

    // Store app handle for emitting events
    state.app_handle = Some(app_handle);

    // Get local IP
    let local_ip = get_local_ip().unwrap_or_else(|| "0.0.0.0".to_string());

    // Find available port
    let port = find_available_port(SERVICE_PORT_DEFAULT);

    // Generate service name
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let service_name = device_name.unwrap_or_else(|| format!("HandsFree-POS-{}", hostname));

    // Create mDNS daemon
    let mdns = ServiceDaemon::new()
        .map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

    // Create service info for advertisement
    let mut properties = HashMap::new();
    properties.insert("version".to_string(), "1.0".to_string());
    properties.insert("device".to_string(), hostname.clone());
    properties.insert("type".to_string(), "pos-printer".to_string());

    let service_info = ServiceInfo::new(
        SERVICE_TYPE,
        &service_name,
        &format!("{}.local.", hostname),
        &local_ip,
        port,
        Some(properties),
    ).map_err(|e| format!("Failed to create service info: {}", e))?;

    // Register the service
    mdns.register(service_info)
        .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

    // Start HTTP server for print requests
    let port_clone = port;
    tokio::spawn(async move {
        if let Err(e) = run_print_server(port_clone).await {
            eprintln!("[PrintService] Server error: {}", e);
        }
    });

    // Update state
    state.running = true;
    state.port = port;
    state.service_name = service_name.clone();
    state.mdns_daemon = Some(mdns);

    println!("[PrintService] Started on {}:{}", local_ip, port);
    println!("[PrintService] Advertising as: {}", service_name);

    Ok(PrintServiceStatus {
        running: true,
        port,
        service_name,
        local_ip,
        connected_devices: Vec::new(),
    })
}

/// Stop the mDNS print service
pub async fn stop_print_service() -> Result<(), String> {
    let mut state = PRINT_SERVICE_STATE.write().await;

    if !state.running {
        return Ok(());
    }

    // Shutdown mDNS daemon
    if let Some(mdns) = state.mdns_daemon.take() {
        let _ = mdns.shutdown();
    }

    state.running = false;
    state.connected_devices.clear();

    println!("[PrintService] Stopped");

    Ok(())
}

/// Get print service status
pub async fn get_print_service_status() -> PrintServiceStatus {
    let state = PRINT_SERVICE_STATE.read().await;
    let local_ip = get_local_ip().unwrap_or_else(|| "0.0.0.0".to_string());

    PrintServiceStatus {
        running: state.running,
        port: state.port,
        service_name: state.service_name.clone(),
        local_ip,
        connected_devices: state.connected_devices.clone(),
    }
}

/// Discover print services on the network
pub async fn discover_print_services(timeout_secs: u64) -> Result<Vec<DiscoveredPrintService>, String> {
    let mdns = ServiceDaemon::new()
        .map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

    let receiver = mdns.browse(SERVICE_TYPE)
        .map_err(|e| format!("Failed to browse services: {}", e))?;

    let mut services = Vec::new();
    let timeout = std::time::Duration::from_secs(timeout_secs);
    let start = std::time::Instant::now();

    while start.elapsed() < timeout {
        match tokio::time::timeout(
            std::time::Duration::from_millis(100),
            tokio::task::spawn_blocking({
                let receiver = receiver.clone();
                move || receiver.recv_timeout(std::time::Duration::from_millis(50))
            })
        ).await {
            Ok(Ok(Ok(event))) => {
                if let mdns_sd::ServiceEvent::ServiceResolved(info) = event {
                    let ip_addresses: Vec<String> = info.get_addresses()
                        .iter()
                        .map(|ip| ip.to_string())
                        .collect();

                    services.push(DiscoveredPrintService {
                        name: info.get_fullname().to_string(),
                        host: info.get_hostname().to_string(),
                        port: info.get_port(),
                        ip_addresses,
                    });
                }
            }
            _ => {}
        }
    }

    let _ = mdns.shutdown();

    Ok(services)
}

/// Run the HTTP server for print requests
async fn run_print_server(port: u16) -> Result<(), String> {
    let addr = format!("0.0.0.0:{}", port);
    let listener = AsyncTcpListener::bind(&addr).await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

    println!("[PrintService] HTTP server listening on {}", addr);

    loop {
        match listener.accept().await {
            Ok((stream, peer_addr)) => {
                tokio::spawn(handle_print_connection(stream, peer_addr));
            }
            Err(e) => {
                eprintln!("[PrintService] Accept error: {}", e);
            }
        }
    }
}

/// Handle an incoming print connection
async fn handle_print_connection(mut stream: TcpStream, peer_addr: SocketAddr) {
    println!("[PrintService] Connection from {}", peer_addr);

    // Track connected device
    {
        let mut state = PRINT_SERVICE_STATE.write().await;
        let device_addr = peer_addr.ip().to_string();
        if !state.connected_devices.contains(&device_addr) {
            state.connected_devices.push(device_addr);
        }
    }

    let mut reader = BufReader::new(&mut stream);
    let mut request_line = String::new();

    // Read request line
    if reader.read_line(&mut request_line).await.is_err() {
        return;
    }

    // Read headers
    let mut headers = HashMap::new();
    let mut content_length = 0usize;

    loop {
        let mut header_line = String::new();
        if reader.read_line(&mut header_line).await.is_err() {
            break;
        }
        let trimmed = header_line.trim();
        if trimmed.is_empty() {
            break;
        }
        if let Some((key, value)) = trimmed.split_once(':') {
            let key = key.trim().to_lowercase();
            let value = value.trim().to_string();
            if key == "content-length" {
                content_length = value.parse().unwrap_or(0);
            }
            headers.insert(key, value);
        }
    }

    // Read body
    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        if let Err(_) = tokio::io::AsyncReadExt::read_exact(&mut reader, &mut body).await {
            send_error_response(&mut stream, 400, "Failed to read body").await;
            return;
        }
    }

    // Parse request
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        send_error_response(&mut stream, 400, "Invalid request").await;
        return;
    }

    let method = parts[0];
    let path = parts[1];

    // Route request
    match (method, path) {
        ("POST", "/print") => {
            handle_print_request(&mut stream, &body).await;
        }
        ("GET", "/status") => {
            handle_status_request(&mut stream).await;
        }
        ("GET", "/health") => {
            send_json_response(&mut stream, 200, r#"{"status":"ok"}"#).await;
        }
        ("OPTIONS", _) => {
            // CORS preflight
            send_cors_response(&mut stream).await;
        }
        _ => {
            send_error_response(&mut stream, 404, "Not found").await;
        }
    }
}

/// Handle print request - emits event to frontend which handles order lookup and printing
async fn handle_print_request(stream: &mut TcpStream, body: &[u8]) {
    // Parse print request
    let request: PrintRequest = match serde_json::from_slice(body) {
        Ok(req) => req,
        Err(e) => {
            send_error_response(stream, 400, &format!("Invalid JSON: {}", e)).await;
            return;
        }
    };

    println!("[PrintService] Print request: type={}, order_id={}, from={:?}",
             request.print_type, request.order_id, request.device_name);

    // Get app handle from state and emit event to frontend
    let emit_result = {
        let state = PRINT_SERVICE_STATE.read().await;
        if let Some(ref app_handle) = state.app_handle {
            app_handle.emit("remote_print_request", &request)
        } else {
            Err(tauri::Error::WebviewNotFound)
        }
    };

    // Send response
    let response = match emit_result {
        Ok(()) => PrintResponse {
            success: true,
            message: "Print request queued".to_string(),
            request_id: request.request_id,
        },
        Err(e) => PrintResponse {
            success: false,
            message: format!("Failed to queue print: {}", e),
            request_id: request.request_id,
        },
    };

    let json = serde_json::to_string(&response).unwrap_or_else(|_| r#"{"success":false}"#.to_string());
    send_json_response(stream, if response.success { 200 } else { 500 }, &json).await;
}

/// Handle status request
async fn handle_status_request(stream: &mut TcpStream) {
    let status = get_print_service_status().await;
    let json = serde_json::to_string(&status).unwrap_or_else(|_| r#"{"running":false}"#.to_string());
    send_json_response(stream, 200, &json).await;
}

/// Send JSON response
async fn send_json_response(stream: &mut TcpStream, status: u16, body: &str) {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "Unknown",
    };

    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: application/json\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        status, status_text, body.len(), body
    );

    let _ = stream.write_all(response.as_bytes()).await;
}

/// Send error response
async fn send_error_response(stream: &mut TcpStream, status: u16, message: &str) {
    let body = format!(r#"{{"error":"{}"}}"#, message);
    send_json_response(stream, status, &body).await;
}

/// Send CORS preflight response
async fn send_cors_response(stream: &mut TcpStream) {
    let response = "HTTP/1.1 204 No Content\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type\r\n\
         Access-Control-Max-Age: 86400\r\n\
         Connection: close\r\n\
         \r\n";

    let _ = stream.write_all(response.as_bytes()).await;
}
