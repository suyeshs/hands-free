/**
 * Printer Discovery and Management Commands
 * Cross-platform printer detection for USB and Network printers
 */

use serde::{Deserialize, Serialize};
use std::process::Command;
use std::net::{SocketAddr, IpAddr, Ipv4Addr};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredPrinter {
    pub id: String,
    pub name: String,
    pub connection_type: String, // "usb", "network", "wifi"
    pub address: Option<String>, // IP address or USB path
    pub port: Option<u16>,
    pub model: Option<String>,
    pub status: String, // "online", "offline", "unknown"
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkScanResult {
    pub ip: String,
    pub port: u16,
    pub is_printer: bool,
    pub response_time_ms: u64,
}

/// Get list of system printers (USB and installed network printers)
#[tauri::command]
#[allow(unused_mut)]
pub async fn get_system_printers() -> Result<Vec<DiscoveredPrinter>, String> {
    let mut printers = Vec::new();

    #[cfg(target_os = "macos")]
    {
        // Use lpstat to get printer list on macOS
        match Command::new("lpstat")
            .args(["-p", "-d"])
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let lines: Vec<&str> = stdout.lines().collect();

                let mut default_printer = String::new();

                // Find default printer
                for line in &lines {
                    if line.starts_with("system default destination:") {
                        default_printer = line.replace("system default destination:", "").trim().to_string();
                    }
                }

                // Parse printer entries
                for line in &lines {
                    if line.starts_with("printer ") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            let name = parts[1].to_string();
                            let status = if line.contains("idle") {
                                "online"
                            } else if line.contains("disabled") {
                                "offline"
                            } else {
                                "unknown"
                            };

                            printers.push(DiscoveredPrinter {
                                id: format!("system-{}", name),
                                name: name.clone(),
                                connection_type: "system".to_string(),
                                address: None,
                                port: None,
                                model: None,
                                status: status.to_string(),
                                is_default: name == default_printer,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to get printers via lpstat: {}", e);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Use PowerShell to get printer list on Windows
        match Command::new("powershell")
            .args(["-Command", "Get-Printer | Select-Object Name, PortName, PrinterStatus, Default | ConvertTo-Json"])
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(json_printers) = serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
                    for p in json_printers {
                        let name = p["Name"].as_str().unwrap_or("Unknown").to_string();
                        let port = p["PortName"].as_str().map(|s| s.to_string());
                        let is_default = p["Default"].as_bool().unwrap_or(false);
                        let status = match p["PrinterStatus"].as_u64() {
                            Some(0) => "unknown",
                            Some(1) => "other",
                            Some(2) => "unknown",
                            Some(3) => "online",
                            Some(4) => "printing",
                            Some(5) => "warmup",
                            Some(6) => "offline",
                            Some(7) => "offline",
                            _ => "unknown",
                        };

                        printers.push(DiscoveredPrinter {
                            id: format!("system-{}", name.replace(" ", "_")),
                            name,
                            connection_type: "system".to_string(),
                            address: port,
                            port: None,
                            model: None,
                            status: status.to_string(),
                            is_default,
                        });
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to get printers via PowerShell: {}", e);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Use lpstat on Linux (similar to macOS)
        match Command::new("lpstat")
            .args(["-p", "-d"])
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let lines: Vec<&str> = stdout.lines().collect();

                let mut default_printer = String::new();

                for line in &lines {
                    if line.starts_with("system default destination:") {
                        default_printer = line.replace("system default destination:", "").trim().to_string();
                    }
                }

                for line in &lines {
                    if line.starts_with("printer ") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            let name = parts[1].to_string();
                            let status = if line.contains("idle") || line.contains("enabled") {
                                "online"
                            } else if line.contains("disabled") {
                                "offline"
                            } else {
                                "unknown"
                            };

                            printers.push(DiscoveredPrinter {
                                id: format!("system-{}", name),
                                name: name.clone(),
                                connection_type: "system".to_string(),
                                address: None,
                                port: None,
                                model: None,
                                status: status.to_string(),
                                is_default: name == default_printer,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to get printers via lpstat: {}", e);
            }
        }
    }

    Ok(printers)
}

/// Scan network for thermal printers on common ports
#[tauri::command]
pub async fn scan_network_printers(subnet: Option<String>) -> Result<Vec<DiscoveredPrinter>, String> {
    let mut printers = Vec::new();

    // Common thermal printer ports
    let printer_ports: Vec<u16> = vec![9100, 515, 631, 9101, 9102];

    // Determine subnet to scan
    let base_ip = subnet.unwrap_or_else(|| "192.168.1".to_string());

    // Scan common IP range (1-254)
    let mut scan_tasks = Vec::new();

    for host in 1..=254 {
        let ip_str = format!("{}.{}", base_ip, host);
        let ports = printer_ports.clone();

        scan_tasks.push(tokio::spawn(async move {
            let mut results = Vec::new();

            for port in ports {
                if let Ok(ip) = ip_str.parse::<Ipv4Addr>() {
                    let addr = SocketAddr::new(IpAddr::V4(ip), port);

                    let start = std::time::Instant::now();
                    match tokio::time::timeout(
                        Duration::from_millis(100),
                        TcpStream::connect(addr)
                    ).await {
                        Ok(Ok(_)) => {
                            results.push(NetworkScanResult {
                                ip: ip_str.clone(),
                                port,
                                is_printer: true,
                                response_time_ms: start.elapsed().as_millis() as u64,
                            });
                        }
                        _ => {}
                    }
                }
            }

            results
        }));
    }

    // Collect results
    for task in scan_tasks {
        if let Ok(results) = task.await {
            for result in results {
                // Check if this IP/port combination looks like a printer
                if result.is_printer {
                    let printer_type = match result.port {
                        9100 => "RAW (ESC/POS)",
                        515 => "LPD",
                        631 => "IPP/CUPS",
                        _ => "Unknown",
                    };

                    printers.push(DiscoveredPrinter {
                        id: format!("network-{}-{}", result.ip.replace(".", "_"), result.port),
                        name: format!("Network Printer at {}:{}", result.ip, result.port),
                        connection_type: "network".to_string(),
                        address: Some(result.ip.clone()),
                        port: Some(result.port),
                        model: Some(printer_type.to_string()),
                        status: "online".to_string(),
                        is_default: false,
                    });
                }
            }
        }
    }

    Ok(printers)
}

/// Test connection to a specific printer
#[tauri::command]
pub async fn test_printer_connection(address: String, port: u16) -> Result<bool, String> {
    match address.parse::<Ipv4Addr>() {
        Ok(ip) => {
            let addr = SocketAddr::new(IpAddr::V4(ip), port);

            match tokio::time::timeout(
                Duration::from_secs(3),
                TcpStream::connect(addr)
            ).await {
                Ok(Ok(_)) => Ok(true),
                Ok(Err(e)) => Err(format!("Connection failed: {}", e)),
                Err(_) => Err("Connection timeout".to_string()),
            }
        }
        Err(_) => Err("Invalid IP address".to_string()),
    }
}

/// Send raw data to a network printer (for testing)
#[tauri::command]
pub async fn send_to_network_printer(address: String, port: u16, data: String) -> Result<bool, String> {
    match address.parse::<Ipv4Addr>() {
        Ok(ip) => {
            let addr = SocketAddr::new(IpAddr::V4(ip), port);

            match tokio::time::timeout(
                Duration::from_secs(5),
                TcpStream::connect(addr)
            ).await {
                Ok(Ok(mut stream)) => {
                    // Send data
                    stream.write_all(data.as_bytes()).await
                        .map_err(|e| format!("Failed to write: {}", e))?;

                    // Flush
                    stream.flush().await
                        .map_err(|e| format!("Failed to flush: {}", e))?;

                    Ok(true)
                }
                Ok(Err(e)) => Err(format!("Connection failed: {}", e)),
                Err(_) => Err("Connection timeout".to_string()),
            }
        }
        Err(_) => Err("Invalid IP address".to_string()),
    }
}

/// Print using system printer (CUPS/Windows Print Spooler)
/// content_type: "text" for plain text, "raw" for ESC/POS binary data
#[tauri::command]
pub async fn print_to_system_printer(printer_name: String, content: String, content_type: String) -> Result<bool, String> {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        use std::io::Write;
        use std::process::{Command, Stdio};

        // Build lp command with appropriate options
        let mut cmd = Command::new("lp");
        cmd.arg("-d").arg(&printer_name);

        // For raw content (ESC/POS), tell CUPS to send data directly without processing
        if content_type == "raw" {
            cmd.arg("-o").arg("raw");
        }

        let mut child = cmd
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start lp: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(content.as_bytes())
                .map_err(|e| format!("Failed to write to lp: {}", e))?;
        }

        let output = child.wait()
            .map_err(|e| format!("Failed to wait for lp: {}", e))?;

        Ok(output.success())
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        // On Windows, for raw ESC/POS, use direct port writing or copy command
        if content_type == "raw" {
            // Write to temp file and use copy to printer port
            use std::fs;
            let temp_path = std::env::temp_dir().join("print_job.bin");
            fs::write(&temp_path, content.as_bytes())
                .map_err(|e| format!("Failed to write temp file: {}", e))?;

            // Use copy command to send raw data to printer
            // Format: copy /b <file> \\<computer>\<printer>
            let output = Command::new("cmd")
                .args(["/C", "copy", "/b", temp_path.to_str().unwrap_or(""), &format!("\\\\localhost\\{}", printer_name)])
                .output()
                .map_err(|e| format!("Failed to print: {}", e))?;

            // Clean up temp file
            let _ = fs::remove_file(&temp_path);

            Ok(output.status.success())
        } else {
            // For plain text, use PowerShell Out-Printer
            let script = format!(
                r#"
                $content = @"
{}
"@
                $content | Out-Printer -Name "{}"
                "#,
                content.replace("\"", "`\""),
                printer_name
            );

            let output = Command::new("powershell")
                .args(["-Command", &script])
                .output()
                .map_err(|e| format!("Failed to print: {}", e))?;

            Ok(output.status.success())
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("Printing not supported on this platform".to_string())
    }
}

/// Get local network subnet
#[tauri::command]
pub fn get_local_subnet() -> Result<String, String> {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        match Command::new("hostname")
            .args(["-I"])
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(ip) = stdout.split_whitespace().next() {
                    let parts: Vec<&str> = ip.split('.').collect();
                    if parts.len() >= 3 {
                        return Ok(format!("{}.{}.{}", parts[0], parts[1], parts[2]));
                    }
                }

                // Fallback: try ifconfig
                match Command::new("ifconfig").output() {
                    Ok(output) => {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        for line in stdout.lines() {
                            if line.contains("inet ") && !line.contains("127.0.0.1") {
                                let parts: Vec<&str> = line.split_whitespace().collect();
                                for (i, part) in parts.iter().enumerate() {
                                    if *part == "inet" && i + 1 < parts.len() {
                                        let ip = parts[i + 1];
                                        let ip_parts: Vec<&str> = ip.split('.').collect();
                                        if ip_parts.len() >= 3 {
                                            return Ok(format!("{}.{}.{}", ip_parts[0], ip_parts[1], ip_parts[2]));
                                        }
                                    }
                                }
                            }
                        }
                        Ok("192.168.1".to_string())
                    }
                    Err(_) => Ok("192.168.1".to_string()),
                }
            }
            Err(_) => Ok("192.168.1".to_string()),
        }
    }

    #[cfg(target_os = "windows")]
    {
        match Command::new("powershell")
            .args(["-Command", "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress"])
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let parts: Vec<&str> = stdout.split('.').collect();
                if parts.len() >= 3 {
                    Ok(format!("{}.{}.{}", parts[0], parts[1], parts[2]))
                } else {
                    Ok("192.168.1".to_string())
                }
            }
            Err(_) => Ok("192.168.1".to_string()),
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Ok("192.168.1".to_string())
    }
}

/// Print HTML content using the system's print dialog
/// Creates a temporary window, loads the HTML, and triggers print
/// Note: This only works on desktop. On mobile, it returns an error.
#[tauri::command]
pub async fn print_html_content(
    #[allow(unused_variables)] app: tauri::AppHandle,
    #[allow(unused_variables)] html: String
) -> Result<bool, String> {
    #[cfg(desktop)]
    {
        use tauri::Manager;
        use base64::Engine;

        let print_window_label = format!("print-window-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis());

        // Create a data URL from the HTML content
        let encoded_html = base64::engine::general_purpose::STANDARD.encode(html.as_bytes());
        let data_url = format!("data:text/html;base64,{}", encoded_html);

        // Create a temporary window for printing
        let window = tauri::WebviewWindowBuilder::new(
            &app,
            &print_window_label,
            tauri::WebviewUrl::External(data_url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
        )
        .title("Print Preview")
        .inner_size(400.0, 600.0)
        .visible(false) // Hidden window
        .build()
        .map_err(|e| format!("Failed to create print window: {}", e))?;

        // Wait a moment for the content to load, then trigger print
        let window_clone = window.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            // Execute JavaScript to trigger print
            if let Err(e) = window_clone.eval("window.print()") {
                eprintln!("Failed to trigger print: {}", e);
            }

            // Wait for print dialog to be handled (give user time)
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;

            // Close the print window
            let _ = window_clone.close();
        });

        Ok(true)
    }

    #[cfg(mobile)]
    {
        // Browser printing not supported on mobile
        // Mobile devices should use network/Bluetooth printers directly
        Err("Browser printing not supported on mobile. Use network printer instead.".to_string())
    }
}
