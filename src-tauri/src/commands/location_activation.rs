/**
 * Location Activation Commands
 * Tauri commands for activating location tenants via activation codes
 */

use serde::{Deserialize, Serialize};
use rusqlite::{Connection, params};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocationMetadata {
    pub location_id: String,
    pub location_tenant_id: String,
    pub location_name: String,
    pub chain_id: String,
    pub chain_name: String,
    pub master_tenant_id: String,
    pub subdomain: Option<String>,
    pub address: LocationAddress,
    pub phone: String,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocationAddress {
    pub line1: String,
    pub line2: Option<String>,
    pub city: String,
    pub state: String,
    pub pincode: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivationResponse {
    success: bool,
    location: Option<LocationMetadata>,
    error: Option<String>,
}

/// Validate activation code and get location metadata from backend
#[tauri::command]
pub async fn validate_activation_code(
    activation_code: String,
) -> Result<LocationMetadata, String> {
    println!("[LocationActivation] Validating code: {}", activation_code);

    // Call backend API
    let client = reqwest::Client::new();

    // Use environment variable or default to production URL
    let api_url = std::env::var("VITE_TENANT_ROUTER_URL")
        .unwrap_or_else(|_| "https://handsfree-tenant-router.pages.dev".to_string());

    let response = client
        .post(format!("{}/api/locations/activate", api_url))
        .json(&serde_json::json!({
            "activation_code": activation_code
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = response.status();

    if !status.is_success() {
        let error_body: serde_json::Value = response.json().await
            .unwrap_or_else(|_| serde_json::json!({"error": "Unknown error"}));

        let error_message = error_body.get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Activation failed");

        return Err(format!("{}", error_message));
    }

    let result: ActivationResponse = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if !result.success {
        return Err(result.error.unwrap_or_else(|| "Activation failed".to_string()));
    }

    result.location.ok_or_else(|| "No location data in response".to_string())
}

/// Configure device as location tenant after successful activation
#[tauri::command]
pub async fn configure_as_location(
    app: tauri::AppHandle,
    location: LocationMetadata,
) -> Result<(), String> {
    println!("[LocationActivation] Configuring as location: {}", location.location_name);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // 1. Create tenant_context table if not exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tenant_context (
            id INTEGER PRIMARY KEY DEFAULT 1,
            current_tenant_id TEXT NOT NULL,
            current_tenant_type TEXT NOT NULL,
            switched_at TEXT DEFAULT CURRENT_TIMESTAMP,
            CHECK (id = 1)
        )",
        [],
    ).map_err(|e| format!("Failed to create tenant_context table: {}", e))?;

    // 2. Set up tenant_context
    conn.execute(
        "INSERT OR REPLACE INTO tenant_context (id, current_tenant_id, current_tenant_type, switched_at)
         VALUES (1, ?1, 'location', CURRENT_TIMESTAMP)",
        params![location.location_tenant_id],
    ).map_err(|e| format!("Failed to set tenant context: {}", e))?;

    println!("[LocationActivation] ✓ Tenant context configured");

    // 3. Configure restaurant_settings
    conn.execute(
        "INSERT OR REPLACE INTO restaurant_settings (
            id,
            is_location,
            location_group_id,
            master_tenant_id,
            current_location_name,
            chain_sync_enabled,
            name,
            address_line1,
            address_line2,
            city,
            state,
            pincode,
            phone,
            email
        ) VALUES (
            1, 1, ?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
        )",
        params![
            location.chain_id,
            location.master_tenant_id,
            location.location_name,
            location.location_name,
            location.address.line1,
            location.address.line2,
            location.address.city,
            location.address.state,
            location.address.pincode,
            location.phone,
            location.email,
        ],
    ).map_err(|e| format!("Failed to configure restaurant_settings: {}", e))?;

    println!("[LocationActivation] ✓ Restaurant settings configured");

    // 4. Save tenant_config
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tenant_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            tenant_id TEXT NOT NULL,
            subdomain TEXT,
            CHECK (id = 1)
        )",
        [],
    ).map_err(|e| format!("Failed to create tenant_config table: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO tenant_config (id, tenant_id, subdomain)
         VALUES (1, ?1, ?2)",
        params![location.location_tenant_id, location.subdomain],
    ).map_err(|e| format!("Failed to save tenant config: {}", e))?;

    println!("[LocationActivation] ✓ Tenant config saved");

    println!("[LocationActivation] ✅ Configuration complete - Location is ready!");
    Ok(())
}

/// Get current activation status (if device is already activated as location)
#[tauri::command]
pub fn get_activation_status(app: tauri::AppHandle) -> Result<bool, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Check if tenant_context exists and is set to location
    let result = conn.query_row(
        "SELECT current_tenant_type FROM tenant_context WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(tenant_type) => Ok(tenant_type == "location"),
        Err(_) => Ok(false), // Not activated yet
    }
}
