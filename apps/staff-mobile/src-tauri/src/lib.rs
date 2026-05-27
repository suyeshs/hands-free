use tauri::Manager;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use uuid::Uuid;
use serde_json::json;

/// Hash a PIN using Argon2 (used during device registration)
#[tauri::command]
async fn hash_staff_pin(pin: String) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let hash = argon2
        .hash_password(pin.as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash PIN: {}", e))?;

    Ok(hash.to_string())
}

/// Verify a PIN against a hash
#[tauri::command]
async fn verify_staff_pin(pin: String, hash: String) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(&hash)
        .map_err(|e| format!("Failed to parse hash: {}", e))?;

    Ok(Argon2::default()
        .verify_password(pin.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Get a unique device ID (persistent across app restarts)
#[tauri::command]
async fn get_device_id(app: tauri::AppHandle) -> Result<String, String> {
    // Try to get persistent device ID from file
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let device_id_file = app_data_dir.join("device_id.txt");

    // Check if device ID file exists
    if device_id_file.exists() {
        // Read existing device ID
        match std::fs::read_to_string(&device_id_file) {
            Ok(id) => {
                if !id.trim().is_empty() {
                    return Ok(id.trim().to_string());
                }
            }
            Err(e) => {
                eprintln!("[DeviceID] Failed to read device ID file: {}", e);
            }
        }
    }

    // Generate new device ID
    let new_device_id = Uuid::new_v4().to_string();

    // Create app data directory if it doesn't exist
    if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
        eprintln!("[DeviceID] Failed to create app data dir: {}", e);
    }

    // Save device ID to file
    if let Err(e) = std::fs::write(&device_id_file, &new_device_id) {
        eprintln!("[DeviceID] Failed to save device ID: {}", e);
    } else {
        println!("[DeviceID] Generated and saved new device ID: {}", new_device_id);
    }

    Ok(new_device_id)
}

/// Get device information
#[tauri::command]
async fn get_device_info() -> Result<serde_json::Value, String> {
    let hostname = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "Unknown".to_string());

    Ok(json!({
        "name": hostname,
        "platform": std::env::consts::OS,
        "version": std::env::consts::ARCH,
    }))
}

/// Get local IP address (works by connecting a UDP socket to a public IP — no packet is sent)
#[tauri::command]
async fn get_local_ip() -> Result<Option<String>, String> {
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    let _ = socket.connect("8.8.8.8:80"); // no packet sent, just sets route
    match socket.local_addr() {
        Ok(addr) => Ok(Some(addr.ip().to_string())),
        Err(_) => Ok(None),
    }
}

/// Check if biometric authentication is available on this device
#[tauri::command]
async fn is_biometric_available() -> Result<bool, String> {
    // Platform-specific biometric availability check
    #[cfg(target_os = "android")]
    {
        // On Android, check if BiometricPrompt is available
        // This is a simplified version - full implementation would use JNI
        Ok(true)
    }
    #[cfg(target_os = "ios")]
    {
        // On iOS, check if LocalAuthentication is available
        // This is a simplified version - full implementation would use Swift bridging
        Ok(true)
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // On desktop platforms, biometric auth is typically not available
        Ok(false)
    }
}

/// Authenticate user with biometric (fingerprint/face ID)
#[tauri::command]
async fn authenticate_with_biometric(reason: String) -> Result<bool, String> {
    println!("[Biometric] Authentication requested: {}", reason);

    // Platform-specific biometric authentication
    #[cfg(target_os = "android")]
    {
        // On Android, this would trigger BiometricPrompt
        // Simplified implementation - full version would use JNI to call Android APIs
        println!("[Biometric] Android biometric prompt would appear here");
        // For development, simulate successful authentication
        Ok(true)
    }
    #[cfg(target_os = "ios")]
    {
        // On iOS, this would trigger LocalAuthentication
        // Simplified implementation - full version would use Swift bridging
        println!("[Biometric] iOS biometric prompt would appear here");
        // For development, simulate successful authentication
        Ok(true)
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // On desktop, biometric auth is not available
        Err("Biometric authentication not available on this platform".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            hash_staff_pin,
            verify_staff_pin,
            get_device_id,
            get_device_info,
            get_local_ip,
            is_biometric_available,
            authenticate_with_biometric,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
