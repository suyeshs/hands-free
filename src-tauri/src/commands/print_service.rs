/**
 * Tauri Commands for mDNS Print Service
 * Allows frontend to control the print service
 */

use crate::print_service::{
    start_print_service, stop_print_service, get_print_service_status,
    discover_print_services, PrintServiceStatus, DiscoveredPrintService,
    PrintRequest, PrintResponse,
};

/// Start the mDNS print service
#[tauri::command]
pub async fn start_mdns_print_service(
    app: tauri::AppHandle,
    device_name: Option<String>
) -> Result<PrintServiceStatus, String> {
    start_print_service(device_name, app).await
}

/// Stop the mDNS print service
#[tauri::command]
pub async fn stop_mdns_print_service() -> Result<(), String> {
    stop_print_service().await
}

/// Get print service status
#[tauri::command]
pub async fn get_mdns_print_service_status() -> PrintServiceStatus {
    get_print_service_status().await
}

/// Discover print services on the network
#[tauri::command]
pub async fn discover_mdns_print_services(timeout_secs: Option<u64>) -> Result<Vec<DiscoveredPrintService>, String> {
    let timeout = timeout_secs.unwrap_or(5);
    discover_print_services(timeout).await
}

/// Send print request to a remote print service
#[tauri::command]
pub async fn send_remote_print_request(
    host: String,
    port: u16,
    request: PrintRequest,
) -> Result<PrintResponse, String> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpStream;
    use std::time::Duration;

    // Serialize request
    let body = serde_json::to_string(&request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;

    // Connect to remote service
    let addr = format!("{}:{}", host, port);
    let mut stream = tokio::time::timeout(
        Duration::from_secs(5),
        TcpStream::connect(&addr)
    ).await
        .map_err(|_| "Connection timeout".to_string())?
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Send HTTP request
    let http_request = format!(
        "POST /print HTTP/1.1\r\n\
         Host: {}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        addr, body.len(), body
    );

    stream.write_all(http_request.as_bytes()).await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    stream.flush().await
        .map_err(|e| format!("Failed to flush: {}", e))?;

    // Read response
    let mut reader = BufReader::new(stream);
    let mut response_data = String::new();
    let mut reading_body = false;
    let mut content_length = 0usize;

    loop {
        let mut line = String::new();
        match reader.read_line(&mut line).await {
            Ok(0) => break,
            Ok(_) => {
                if !reading_body {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        reading_body = true;
                        continue;
                    }
                    if trimmed.to_lowercase().starts_with("content-length:") {
                        if let Some(len) = trimmed.split(':').nth(1) {
                            content_length = len.trim().parse().unwrap_or(0);
                        }
                    }
                } else {
                    response_data.push_str(&line);
                    if response_data.len() >= content_length {
                        break;
                    }
                }
            }
            Err(_) => break,
        }
    }

    // Parse response
    serde_json::from_str(&response_data)
        .map_err(|e| format!("Failed to parse response: {} (data: {})", e, response_data))
}
