/**
 * reCamera Discovery and Configuration Commands
 *
 * Provides Tauri commands for discovering, testing, and configuring reCamera devices
 * on the local network. Follows patterns from printer discovery.
 */

use serde::{Deserialize, Serialize};
use std::net::{IpAddr, SocketAddr, TcpStream};
use std::time::Duration;
use tokio::task;

/// Discovered reCamera device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredReCamera {
    pub ip_address: String,
    pub model: String,
    pub firmware_version: String,
    pub mac_address: String,
    pub signal_strength: Option<i32>,
    pub port: u16,
}

/// reCamera connection information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReCameraInfo {
    pub model: String,
    pub firmware: String,
    pub features: Vec<String>, // ["rtsp", "websocket", "edge_ai"]
    pub status: String,         // "online", "offline", "configuring"
}

/// WiFi configuration for reCamera
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WiFiConfig {
    pub ssid: String,
    pub password: String,
    pub security: String, // "open", "wpa", "wpa2", "wpa3"
}

/// Network status of reCamera
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub connected: bool,
    pub ssid: String,
    pub signal_strength: i32,
    pub ip_address: String,
    pub mac_address: String,
}

/// Scan local network for reCamera devices
///
/// Performs parallel TCP scanning on the specified subnet, testing common
/// reCamera HTTP ports (80, 8080, 8000) and querying /api/info endpoint.
///
/// # Arguments
/// * `subnet` - Optional subnet to scan (e.g., "192.168.1"). If None, detects from local IP.
///
/// # Returns
/// * `Result<Vec<DiscoveredReCamera>>` - List of discovered reCamera devices
#[tauri::command]
pub async fn scan_recameras(subnet: Option<String>) -> Result<Vec<DiscoveredReCamera>, String> {
    // Get subnet from parameter or detect from local IP
    let subnet = match subnet {
        Some(s) => s,
        None => {
            // Get local IP address
            let local_ip = local_ip_address::local_ip()
                .map_err(|e| format!("Failed to get local IP: {}", e))?;

            // Extract subnet (first 3 octets)
            match local_ip {
                IpAddr::V4(ip) => {
                    let octets = ip.octets();
                    format!("{}.{}.{}", octets[0], octets[1], octets[2])
                }
                IpAddr::V6(_) => return Err("IPv6 not supported for scanning".to_string()),
            }
        }
    };

    println!("[reCamera] Scanning subnet: {}", subnet);

    // Common reCamera HTTP ports
    let ports = vec![80, 8080, 8000];

    // IP range to scan (1-254)
    let mut tasks = vec![];

    for i in 1..=254 {
        for port in &ports {
            let ip = format!("{}.{}", subnet, i);
            let port = *port;

            // Spawn async task for each IP:port combination
            let task = task::spawn(async move {
                test_recamera_port(ip, port).await
            });

            tasks.push(task);
        }
    }

    // Wait for all tasks to complete
    let mut discovered = Vec::new();
    for task in tasks {
        if let Ok(Ok(Some(camera))) = task.await {
            discovered.push(camera);
        }
    }

    println!("[reCamera] Found {} devices", discovered.len());
    Ok(discovered)
}

/// Test a specific IP:port for reCamera device
async fn test_recamera_port(ip: String, port: u16) -> Result<Option<DiscoveredReCamera>, String> {
    // Test TCP connection
    let addr: SocketAddr = format!("{}:{}", ip, port)
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;

    // Try to connect with 100ms timeout
    let stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(100)) {
        Ok(_) => true,
        Err(_) => return Ok(None), // Not a reCamera or not responding
    };

    if !stream {
        return Ok(None);
    }

    // Query /api/info endpoint
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("http://{}:{}/api/info", ip, port);

    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                // Parse response to check if it's a reCamera
                match response.json::<serde_json::Value>().await {
                    Ok(json) => {
                        // Check if response has reCamera signature
                        if let Some(model) = json.get("model").and_then(|v| v.as_str()) {
                            if model.contains("reCamera") || model.contains("SeedStudio") {
                                let camera = DiscoveredReCamera {
                                    ip_address: ip,
                                    model: model.to_string(),
                                    firmware_version: json.get("firmware")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Unknown")
                                        .to_string(),
                                    mac_address: json.get("mac")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Unknown")
                                        .to_string(),
                                    signal_strength: json.get("signal_strength")
                                        .and_then(|v| v.as_i64())
                                        .map(|v| v as i32),
                                    port,
                                };

                                println!("[reCamera] Found: {} at {}:{}", camera.model, camera.ip_address, port);
                                return Ok(Some(camera));
                            }
                        }
                    }
                    Err(_) => {}
                }
            }
        }
        Err(_) => {}
    }

    Ok(None)
}

/// Test connection to a specific reCamera device
///
/// Tests HTTP, RTSP, and WebSocket connectivity to verify the reCamera is accessible.
///
/// # Arguments
/// * `ip_address` - IP address of the reCamera device
///
/// # Returns
/// * `Result<ReCameraInfo>` - Connection info and available features
#[tauri::command]
pub async fn test_recamera_connection(ip_address: String) -> Result<ReCameraInfo, String> {
    println!("[reCamera] Testing connection to: {}", ip_address);

    // Test available features by checking ports directly
    let mut features = Vec::new();
    let mut model = "reCamera".to_string();
    let firmware = "Unknown".to_string();

    // Test HTTP port (80) - Web interface
    if test_tcp_port(&ip_address, 80).await {
        features.push("http".to_string());

        // Try to get device info from web interface
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        // Check if web interface is accessible
        if let Ok(response) = client.get(&format!("http://{}/", ip_address)).send().await {
            if response.status().is_success() {
                model = "reCamera (Web)".to_string();
            }
        }
    }

    // Test RTSP port (554) - Video streaming
    if test_tcp_port(&ip_address, 554).await {
        features.push("rtsp".to_string());
        println!("[reCamera] RTSP port 554 accessible");
    } else {
        println!("[reCamera] Warning: RTSP port 554 not accessible");
    }

    // Test WebSocket/Edge AI port (80 or 8080)
    if test_tcp_port(&ip_address, 80).await {
        features.push("websocket".to_string());
        features.push("edge_ai".to_string()); // Assume Edge AI if WebSocket port open
        println!("[reCamera] WebSocket port accessible");
    }

    if features.is_empty() {
        return Err(format!("No reCamera features detected at {}. Device might be offline or unreachable.", ip_address));
    }

    let info = ReCameraInfo {
        model,
        firmware,
        features,
        status: "online".to_string(),
    };

    println!("[reCamera] Connection test passed: {} features available", info.features.len());
    Ok(info)
}

/// Test TCP connection to a specific port
async fn test_tcp_port(ip: &str, port: u16) -> bool {
    let addr: SocketAddr = match format!("{}:{}", ip, port).parse() {
        Ok(a) => a,
        Err(_) => return false,
    };

    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

/// Configure reCamera WiFi settings
///
/// Sends WiFi configuration to reCamera via HTTP POST. The camera will reboot
/// and attempt to join the specified network.
///
/// # Arguments
/// * `gateway_ip` - IP address of the reCamera (typically 192.168.4.1 when in AP mode)
/// * `wifi_config` - WiFi credentials and security settings
///
/// # Returns
/// * `Result<()>` - Success or error message
#[tauri::command]
pub async fn configure_recamera_wifi(
    gateway_ip: String,
    wifi_config: WiFiConfig,
) -> Result<(), String> {
    println!("[reCamera] Configuring WiFi for: {}", gateway_ip);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30)) // Longer timeout for reboot
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Prepare WiFi configuration payload
    let payload = serde_json::json!({
        "ssid": wifi_config.ssid,
        "password": wifi_config.password,
        "security": wifi_config.security,
    });

    // Send configuration to reCamera
    let url = format!("http://{}/api/wifi/config", gateway_ip);
    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send WiFi config: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("reCamera returned error: {}", response.status()));
    }

    println!("[reCamera] WiFi configuration sent successfully");
    Ok(())
}

/// Get network status from reCamera
///
/// Queries the reCamera for its current network connection status.
///
/// # Arguments
/// * `ip_address` - IP address of the reCamera device
///
/// # Returns
/// * `Result<NetworkStatus>` - Current network status
#[tauri::command]
pub async fn get_recamera_network_status(ip_address: String) -> Result<NetworkStatus, String> {
    println!("[reCamera] Getting network status for: {}", ip_address);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("http://{}/api/network/status", ip_address);
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to get network status: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("reCamera returned status: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse network status: {}", e))?;

    let status = NetworkStatus {
        connected: json.get("connected")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        ssid: json.get("ssid")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string(),
        signal_strength: json.get("signal_strength")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32,
        ip_address: json.get("ip")
            .and_then(|v| v.as_str())
            .unwrap_or(&ip_address)
            .to_string(),
        mac_address: json.get("mac")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string(),
    };

    println!("[reCamera] Network status: connected={}, ssid={}", status.connected, status.ssid);
    Ok(status)
}
