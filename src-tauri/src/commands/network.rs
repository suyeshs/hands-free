use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub ssid: Option<String>,
    pub is_connected: bool,
}

/// Get the current WiFi SSID
///
/// Platform-specific implementations with fallbacks:
///
/// **macOS:**
/// - Primary: `networksetup -getairportnetwork <interface>`
/// - Finds WiFi interface via `networksetup -listallhardwareports`
/// - Parses output: "Current Wi-Fi Network: NetworkName"
/// - Tested on macOS ✅
///
/// **Linux:**
/// - Primary: `nmcli -t -f active,ssid dev wifi`
///   - Output format: "yes:NetworkName" for active connections
///   - Works on Ubuntu, Fedora, Debian (NetworkManager required)
/// - Fallback: `iwgetid -r`
///   - Output: Raw SSID string
///   - Works on minimal/older Linux installations
///
/// **Windows:**
/// - Primary: `netsh wlan show interfaces`
/// - Parses for:
///   - State: connected
///   - SSID: NetworkName (excludes BSSID)
/// - Works on Windows 7+, Windows 10, Windows 11
///
/// **Android:**
/// - Not yet implemented (requires JNI and ACCESS_FINE_LOCATION permission)
/// - Placeholder returns error
///
/// **Testing Commands:**
/// ```bash
/// # macOS
/// networksetup -listallhardwareports
/// networksetup -getairportnetwork en1
///
/// # Linux
/// nmcli -t -f active,ssid dev wifi
/// iwgetid -r
///
/// # Windows (PowerShell/CMD)
/// netsh wlan show interfaces
/// ```
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
        .map_err(|e| {
            eprintln!("[WiFi] Failed to list network interfaces: {}", e);
            format!("Failed to list network interfaces: {}", e)
        })?;

    if !list_output.status.success() {
        eprintln!("[WiFi] networksetup list command failed");
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
        Some(iface) => {
            eprintln!("[WiFi] Found WiFi interface: {}", iface);
            iface
        },
        None => {
            eprintln!("[WiFi] No WiFi interface found");
            return Ok(NetworkInfo {
                ssid: None,
                is_connected: false,
            });
        }
    };

    // Get current WiFi network using networksetup
    let output = Command::new("networksetup")
        .args(&["-getairportnetwork", &interface])
        .output()
        .map_err(|e| {
            eprintln!("[WiFi] Failed to get WiFi network: {}", e);
            format!("Failed to get WiFi network: {}", e)
        })?;

    if !output.status.success() {
        eprintln!("[WiFi] getairportnetwork command failed");
        return Ok(NetworkInfo {
            ssid: None,
            is_connected: false,
        });
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    eprintln!("[WiFi] Command output: {}", output_str);

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

            eprintln!("[WiFi] Found SSID: {}", ssid);

            if !ssid.is_empty() && ssid != "You are not associated with an AirPort network." {
                eprintln!("[WiFi] Returning connected with SSID: {}", ssid);
                return Ok(NetworkInfo {
                    ssid: Some(ssid),
                    is_connected: true,
                });
            }
        }
    }

    eprintln!("[WiFi] No valid SSID found in output");
    Ok(NetworkInfo {
        ssid: None,
        is_connected: false,
    })
}

#[cfg(target_os = "linux")]
async fn get_wifi_ssid_linux() -> Result<NetworkInfo, String> {
    use std::process::Command;

    eprintln!("[WiFi] Linux: Attempting WiFi detection...");

    // Try nmcli first (more common on modern Linux distributions)
    // Use terse mode (-t) and specify fields to get "yes:SSID" or "no:SSID" format
    if let Ok(output) = Command::new("nmcli")
        .args(&["-t", "-f", "active,ssid", "dev", "wifi"])
        .output()
    {
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            eprintln!("[WiFi] nmcli output: {}", output_str);

            for line in output_str.lines() {
                let trimmed = line.trim();
                // Look for active connection: "yes:NetworkName"
                if trimmed.starts_with("yes:") {
                    let ssid = trimmed
                        .strip_prefix("yes:")
                        .unwrap_or("")
                        .trim()
                        .to_string();

                    eprintln!("[WiFi] Found active WiFi via nmcli: {}", ssid);

                    // Filter out empty or placeholder SSIDs
                    if !ssid.is_empty() && ssid != "--" {
                        eprintln!("[WiFi] Returning connected with SSID: {}", ssid);
                        return Ok(NetworkInfo {
                            ssid: Some(ssid),
                            is_connected: true,
                        });
                    }
                }
            }
        } else {
            eprintln!("[WiFi] nmcli command failed, trying fallback...");
        }
    } else {
        eprintln!("[WiFi] nmcli not available, trying iwgetid...");
    }

    // Fallback to iwgetid (works on older systems or minimal installations)
    if let Ok(output) = Command::new("iwgetid")
        .arg("-r") // Raw mode - output only SSID
        .output()
    {
        if output.status.success() {
            let ssid = String::from_utf8_lossy(&output.stdout).trim().to_string();
            eprintln!("[WiFi] iwgetid output: {}", ssid);

            if !ssid.is_empty() {
                eprintln!("[WiFi] Returning connected with SSID: {}", ssid);
                return Ok(NetworkInfo {
                    ssid: Some(ssid),
                    is_connected: true,
                });
            }
        } else {
            eprintln!("[WiFi] iwgetid command failed");
        }
    } else {
        eprintln!("[WiFi] iwgetid not available");
    }

    // No WiFi connection found
    eprintln!("[WiFi] No WiFi connection detected");
    Ok(NetworkInfo {
        ssid: None,
        is_connected: false,
    })
}

#[cfg(target_os = "windows")]
async fn get_wifi_ssid_windows() -> Result<NetworkInfo, String> {
    use std::process::Command;

    eprintln!("[WiFi] Windows: Attempting WiFi detection...");

    // Use netsh command to get WiFi info
    let output = Command::new("netsh")
        .args(&["wlan", "show", "interfaces"])
        .output()
        .map_err(|e| {
            eprintln!("[WiFi] Failed to execute netsh command: {}", e);
            format!("Failed to execute netsh command: {}", e)
        })?;

    if !output.status.success() {
        eprintln!("[WiFi] netsh command failed with status: {:?}", output.status);
        return Ok(NetworkInfo {
            ssid: None,
            is_connected: false,
        });
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    eprintln!("[WiFi] netsh output:\n{}", output_str);

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
                eprintln!("[WiFi] Found state: {}, is_connected: {}", state, is_connected);
            }
        }

        // Parse SSID from output
        // Looking for line like: "    SSID                   : MyWiFiNetwork"
        // Use exact match to avoid matching "BSSID"
        if (trimmed.starts_with("SSID") && !trimmed.starts_with("BSSID")) && trimmed.contains(":") {
            let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
            if parts.len() == 2 {
                let ssid = parts[1].trim().to_string();
                if !ssid.is_empty() {
                    eprintln!("[WiFi] Found SSID: {}", ssid);
                    found_ssid = Some(ssid);
                }
            }
        }
    }

    // Return SSID only if connected and SSID was found
    if is_connected && found_ssid.is_some() {
        eprintln!("[WiFi] Returning connected with SSID: {:?}", found_ssid);
        Ok(NetworkInfo {
            ssid: found_ssid,
            is_connected: true,
        })
    } else {
        eprintln!("[WiFi] Not connected or no SSID found (is_connected: {}, ssid: {:?})", is_connected, found_ssid);
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
