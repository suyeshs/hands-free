use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub ssid: Option<String>,
    pub is_connected: bool,
}

/// Get the current WiFi SSID
/// Platform-specific implementations:
/// - Android: Uses WiFiManager via JNI (requires ACCESS_FINE_LOCATION permission)
/// - macOS: Uses airport command
/// - Linux: Uses nmcli or iwgetid
/// - Windows: Uses netsh
#[command]
pub async fn get_current_wifi_ssid() -> Result<NetworkInfo, String> {
    #[cfg(target_os = "android")]
    {
        // Android implementation using JNI
        get_wifi_ssid_android().await
    }

    #[cfg(target_os = "macos")]
    {
        get_wifi_ssid_macos().await
    }

    #[cfg(target_os = "linux")]
    {
        get_wifi_ssid_linux().await
    }

    #[cfg(target_os = "windows")]
    {
        get_wifi_ssid_windows().await
    }

    #[cfg(not(any(target_os = "android", target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("Platform not supported for WiFi detection".to_string())
    }
}

#[cfg(target_os = "android")]
async fn get_wifi_ssid_android() -> Result<NetworkInfo, String> {
    use jni::{JNIEnv, JavaVM, objects::JObject};

    // TODO: Implement Android WiFi detection using JNI
    // This requires:
    // 1. Get Android Context
    // 2. Get WifiManager system service
    // 3. Get ConnectionInfo
    // 4. Extract SSID
    // 5. Handle permissions (ACCESS_FINE_LOCATION)

    // For now, return a placeholder
    // Full implementation requires adding JNI dependencies and Android permissions
    Err("Android WiFi detection requires JNI implementation - use manual configuration".to_string())
}

#[cfg(target_os = "macos")]
async fn get_wifi_ssid_macos() -> Result<NetworkInfo, String> {
    use std::process::Command;

    // First, find the WiFi interface name (usually en0 or en1)
    let list_output = Command::new("networksetup")
        .args(&["-listallhardwareports"])
        .output()
        .map_err(|e| format!("Failed to list network interfaces: {}", e))?;

    if !list_output.status.success() {
        return Ok(NetworkInfo {
            ssid: None,
            is_connected: false,
        });
    }

    let list_str = String::from_utf8_lossy(&list_output.stdout);
    let mut wifi_interface: Option<String> = None;

    // Parse output to find Wi-Fi interface
    // Looking for pattern: "Hardware Port: Wi-Fi" followed by "Device: en0" or "Device: en1"
    let mut next_is_device = false;
    for line in list_str.lines() {
        let trimmed = line.trim();
        if trimmed.contains("Wi-Fi") && trimmed.starts_with("Hardware Port:") {
            next_is_device = true;
        } else if next_is_device && trimmed.starts_with("Device:") {
            if let Some(device) = trimmed.strip_prefix("Device:") {
                wifi_interface = Some(device.trim().to_string());
                break;
            }
        }
    }

    let interface = match wifi_interface {
        Some(iface) => iface,
        None => return Ok(NetworkInfo {
            ssid: None,
            is_connected: false,
        }),
    };

    // Get current WiFi network using networksetup
    let output = Command::new("networksetup")
        .args(&["-getairportnetwork", &interface])
        .output()
        .map_err(|e| format!("Failed to get WiFi network: {}", e))?;

    if !output.status.success() {
        return Ok(NetworkInfo {
            ssid: None,
            is_connected: false,
        });
    }

    let output_str = String::from_utf8_lossy(&output.stdout);

    // Parse SSID from output
    // Looking for line like: "Current Wi-Fi Network: MyWiFiNetwork"
    for line in output_str.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Current Wi-Fi Network:") {
            let ssid = trimmed
                .strip_prefix("Current Wi-Fi Network:")
                .unwrap_or("")
                .trim()
                .to_string();

            if !ssid.is_empty() && ssid != "You are not associated with an AirPort network." {
                return Ok(NetworkInfo {
                    ssid: Some(ssid),
                    is_connected: true,
                });
            }
        }
    }

    Ok(NetworkInfo {
        ssid: None,
        is_connected: false,
    })
}

#[cfg(target_os = "linux")]
async fn get_wifi_ssid_linux() -> Result<NetworkInfo, String> {
    use std::process::Command;

    // Try nmcli first (more common on modern Linux distributions)
    // Use terse mode (-t) and specify fields to get "yes:SSID" or "no:SSID" format
    if let Ok(output) = Command::new("nmcli")
        .args(&["-t", "-f", "active,ssid", "dev", "wifi"])
        .output()
    {
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                let trimmed = line.trim();
                // Look for active connection: "yes:NetworkName"
                if trimmed.starts_with("yes:") {
                    let ssid = trimmed
                        .strip_prefix("yes:")
                        .unwrap_or("")
                        .trim()
                        .to_string();

                    // Filter out empty or placeholder SSIDs
                    if !ssid.is_empty() && ssid != "--" {
                        return Ok(NetworkInfo {
                            ssid: Some(ssid),
                            is_connected: true,
                        });
                    }
                }
            }
        }
    }

    // Fallback to iwgetid (works on older systems or minimal installations)
    if let Ok(output) = Command::new("iwgetid")
        .arg("-r") // Raw mode - output only SSID
        .output()
    {
        if output.status.success() {
            let ssid = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !ssid.is_empty() {
                return Ok(NetworkInfo {
                    ssid: Some(ssid),
                    is_connected: true,
                });
            }
        }
    }

    // No WiFi connection found
    Ok(NetworkInfo {
        ssid: None,
        is_connected: false,
    })
}

#[cfg(target_os = "windows")]
async fn get_wifi_ssid_windows() -> Result<NetworkInfo, String> {
    use std::process::Command;

    // Use netsh command to get WiFi info
    let output = Command::new("netsh")
        .args(&["wlan", "show", "interfaces"])
        .output()
        .map_err(|e| format!("Failed to execute netsh command: {}", e))?;

    if !output.status.success() {
        return Ok(NetworkInfo {
            ssid: None,
            is_connected: false,
        });
    }

    let output_str = String::from_utf8_lossy(&output.stdout);

    // First check if WiFi is connected
    // Looking for: "State                  : connected"
    let mut is_connected = false;
    let mut found_ssid: Option<String> = None;

    for line in output_str.lines() {
        let trimmed = line.trim();

        // Check connection state
        if trimmed.starts_with("State") && trimmed.contains(":") {
            let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
            if parts.len() == 2 {
                let state = parts[1].trim().to_lowercase();
                is_connected = state == "connected";
            }
        }

        // Parse SSID from output
        // Looking for line like: "    SSID                   : MyWiFiNetwork"
        // Use exact match " SSID " to avoid matching "BSSID"
        if (trimmed.starts_with("SSID") && !trimmed.starts_with("BSSID")) && trimmed.contains(":") {
            let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
            if parts.len() == 2 {
                let ssid = parts[1].trim().to_string();
                if !ssid.is_empty() {
                    found_ssid = Some(ssid);
                }
            }
        }
    }

    // Return SSID only if connected and SSID was found
    if is_connected && found_ssid.is_some() {
        Ok(NetworkInfo {
            ssid: found_ssid,
            is_connected: true,
        })
    } else {
        Ok(NetworkInfo {
            ssid: None,
            is_connected: false,
        })
    }
}

/// Check if currently connected to a specific WiFi network
/// Supports comma-separated list of SSIDs
#[command]
pub async fn is_on_wifi(allowed_ssids: String) -> Result<bool, String> {
    let network_info = get_current_wifi_ssid().await?;

    if !network_info.is_connected {
        return Ok(false);
    }

    let current_ssid = match network_info.ssid {
        Some(ssid) => ssid,
        None => return Ok(false),
    };

    // Split allowed SSIDs by comma and check if current SSID matches any
    let allowed_list: Vec<String> = allowed_ssids
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    Ok(allowed_list.iter().any(|allowed| allowed == &current_ssid))
}
