/**
 * Device Settings Commands
 * Tauri commands for managing device configuration in SQLite
 */

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSettings {
    pub tenant_id: Option<String>,

    // Device Configuration
    pub device_mode: String,
    pub device_name: String,
    pub device_id: String,

    // Feature Flags
    pub features_json: String,

    // Mode Lock Settings
    pub locked_mode: bool,
    pub kiosk_mode: bool,

    // Auto-Login Settings
    pub auto_login_enabled: bool,
    pub auto_login_role: Option<String>,
    pub auto_login_staff_id: Option<String>,

    // Network Settings
    pub lan_server_enabled: bool,
    pub lan_server_port: i32,
}

/// Get device settings from SQLite
#[tauri::command]
pub fn get_device_settings(app: tauri::AppHandle) -> Result<DeviceSettings, String> {
    use rusqlite::Connection;

    println!("[device_settings.rs] ===== get_device_settings called =====");

    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            println!("[device_settings.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join(crate::get_db_filename());

    println!("[device_settings.rs] Database path: {:?}", db_path);

    let db = Connection::open(&db_path).map_err(|e| {
        println!("[device_settings.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    let query = "SELECT
        tenant_id, device_mode, device_name, device_id,
        features_json, locked_mode, kiosk_mode,
        auto_login_enabled, auto_login_role, auto_login_staff_id,
        lan_server_enabled, lan_server_port
    FROM device_settings WHERE id = 1";

    let settings = db.query_row(query, [], |row| {
        Ok(DeviceSettings {
            tenant_id: row.get(0)?,
            device_mode: row.get(1)?,
            device_name: row.get(2)?,
            device_id: row.get(3)?,
            features_json: row.get(4)?,
            locked_mode: row.get::<_, i32>(5)? != 0,
            kiosk_mode: row.get::<_, i32>(6)? != 0,
            auto_login_enabled: row.get::<_, i32>(7)? != 0,
            auto_login_role: row.get(8)?,
            auto_login_staff_id: row.get(9)?,
            lan_server_enabled: row.get::<_, i32>(10)? != 0,
            lan_server_port: row.get(11)?,
        })
    }).map_err(|e| {
        println!("[device_settings.rs] ❌ Failed to query settings: {}", e);
        e.to_string()
    })?;

    println!("[device_settings.rs] ✅ Device settings retrieved successfully");
    println!("[device_settings.rs] Device mode: {}", settings.device_mode);
    println!("[device_settings.rs] LAN server enabled: {}", settings.lan_server_enabled);

    Ok(settings)
}

/// Save device settings to SQLite
#[tauri::command]
pub fn save_device_settings(
    app: tauri::AppHandle,
    settings: DeviceSettings,
) -> Result<(), String> {
    use rusqlite::{Connection, params};

    println!("[device_settings.rs] ===== save_device_settings called =====");
    println!("[device_settings.rs] Device mode: {}", settings.device_mode);
    println!("[device_settings.rs] LAN server enabled: {}", settings.lan_server_enabled);

    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            println!("[device_settings.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| {
        println!("[device_settings.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    // Use UPDATE instead of INSERT OR REPLACE to preserve device_id
    let query = "UPDATE device_settings SET
        tenant_id = ?1,
        device_mode = ?2,
        device_name = ?3,
        features_json = ?4,
        locked_mode = ?5,
        kiosk_mode = ?6,
        auto_login_enabled = ?7,
        auto_login_role = ?8,
        auto_login_staff_id = ?9,
        lan_server_enabled = ?10,
        lan_server_port = ?11,
        updated_at = unixepoch()
    WHERE id = 1";

    let rows_affected = db.execute(query, params![
        settings.tenant_id,
        settings.device_mode,
        settings.device_name,
        settings.features_json,
        if settings.locked_mode { 1 } else { 0 },
        if settings.kiosk_mode { 1 } else { 0 },
        if settings.auto_login_enabled { 1 } else { 0 },
        settings.auto_login_role,
        settings.auto_login_staff_id,
        if settings.lan_server_enabled { 1 } else { 0 },
        settings.lan_server_port,
    ])
    .map_err(|e| {
        println!("[device_settings.rs] ❌ Query execution failed: {}", e);
        format!("Failed to save device settings: {}", e)
    })?;

    println!("[device_settings.rs] ✅ Rows affected: {}", rows_affected);

    if rows_affected == 0 {
        println!("[device_settings.rs] ⚠️  No rows affected, device_settings may not be initialized");
        return Err("Device settings not found - please restart the app".to_string());
    }

    println!("[device_settings.rs] ✅ Device settings saved successfully");
    Ok(())
}

/// Update only the LAN server settings (lightweight update)
#[tauri::command]
pub fn update_lan_server_settings(
    app: tauri::AppHandle,
    enabled: bool,
    port: Option<i32>,
) -> Result<(), String> {
    use rusqlite::{Connection, params};

    println!("[device_settings.rs] ===== update_lan_server_settings called =====");
    println!("[device_settings.rs] Enabled: {}, Port: {:?}", enabled, port);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let query = if let Some(p) = port {
        "UPDATE device_settings SET lan_server_enabled = ?1, lan_server_port = ?2, updated_at = unixepoch() WHERE id = 1"
    } else {
        "UPDATE device_settings SET lan_server_enabled = ?1, updated_at = unixepoch() WHERE id = 1"
    };

    let rows_affected = if let Some(p) = port {
        db.execute(query, params![if enabled { 1 } else { 0 }, p])
    } else {
        db.execute(query, params![if enabled { 1 } else { 0 }])
    }
    .map_err(|e| format!("Failed to update LAN server settings: {}", e))?;

    if rows_affected == 0 {
        return Err("Device settings not found".to_string());
    }

    println!("[device_settings.rs] ✅ LAN server settings updated");
    Ok(())
}
