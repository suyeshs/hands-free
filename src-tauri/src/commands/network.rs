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

    // Use airport command to get WiFi info
    let output = Command::new("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport")
        .arg("-I")
        .output()
        .map_err(|e| format!("Failed to execute airport command: {}", e))?;

    if !output.status.success() {
        return Ok(NetworkInfo {
            ssid: None,
            is_connected: false,
        });
    }

    let output_str = String::from_utf8_lossy(&output.stdout);

    // Parse SSID from output
    // Looking for line like: "SSID: MyWiFiNetwork"
    for line in output_str.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("SSID:") {
            let ssid = trimmed
                .strip_prefix("SSID:")
                .unwrap_or("")
                .trim()
                .to_string();

            if !ssid.is_empty() {
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

    // Try nmcli first (more common)
    if let Ok(output) = Command::new("nmcli")
        .args(&["-t", "-f", "active,ssid", "dev", "wifi"])
        .output()
    {
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                if line.starts_with("yes:") {
                    let ssid = line
                        .strip_prefix("yes:")
                        .unwrap_or("")
                        .trim()
                        .to_string();

                    if !ssid.is_empty() {
                        return Ok(NetworkInfo {
                            ssid: Some(ssid),
                            is_connected: true,
                        });
                    }
                }
            }
        }
    }

    // Fallback to iwgetid
    if let Ok(output) = Command::new("iwgetid")
        .arg("-r")
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

    // Parse SSID from output
    // Looking for line like: "    SSID                   : MyWiFiNetwork"
    for line in output_str.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("SSID") && trimmed.contains(":") {
            let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
            if parts.len() == 2 {
                let ssid = parts[1].trim().to_string();
                if !ssid.is_empty() {
                    return Ok(NetworkInfo {
                        ssid: Some(ssid),
                        is_connected: true,
                    });
                }
            }
        }
    }

    Ok(NetworkInfo {
        ssid: None,
        is_connected: false,
    })
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
