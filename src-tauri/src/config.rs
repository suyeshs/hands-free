/**
 * Configuration Manager
 * Loads and manages aggregator selector configurations
 *
 * Security: In release builds, selectors are encrypted at compile time
 * and decrypted at runtime to protect against reverse engineering.
 */

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use obfstr::obfstr;

/// Embedded encrypted selectors (only in release builds)
#[cfg(not(debug_assertions))]
static ENCRYPTED_SELECTORS: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/selectors.enc"));

/// XOR decrypt with the same key used in build.rs
#[cfg(not(debug_assertions))]
fn xor_decrypt(data: &[u8]) -> Vec<u8> {
    // Key must match build.rs exactly (obfuscated at compile time)
    let key = obfstr!("H4ndsF733P0S_S3l3ct0r_K3y_2025!");
    data.iter()
        .enumerate()
        .map(|(i, &b)| b ^ key.as_bytes()[i % key.len()])
        .collect()
}

/// Load embedded encrypted config (release builds only)
#[cfg(not(debug_assertions))]
fn load_embedded_config() -> Result<AggregatorConfig, String> {
    let decrypted = xor_decrypt(ENCRYPTED_SELECTORS);
    let config_str = String::from_utf8(decrypted)
        .map_err(|e| format!("Failed to decode decrypted config: {}", e))?;
    serde_json::from_str(&config_str)
        .map_err(|e| format!("Failed to parse embedded config: {}", e))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectorConfig {
    #[serde(rename = "orderContainer")]
    pub order_container: String,
    #[serde(rename = "orderId")]
    pub order_id: String,
    #[serde(rename = "orderNumber")]
    pub order_number: String,
    #[serde(rename = "customerName")]
    pub customer_name: String,
    #[serde(rename = "customerPhone")]
    pub customer_phone: String,
    #[serde(rename = "customerAddress")]
    pub customer_address: String,
    #[serde(rename = "itemsList")]
    pub items_list: String,
    #[serde(rename = "itemRow")]
    pub item_row: String,
    #[serde(rename = "itemName")]
    pub item_name: String,
    #[serde(rename = "itemQuantity")]
    pub item_quantity: String,
    #[serde(rename = "itemPrice")]
    pub item_price: String,
    #[serde(rename = "itemModifiers")]
    pub item_modifiers: String,
    #[serde(rename = "specialInstructions")]
    pub special_instructions: String,
    #[serde(rename = "orderTotal")]
    pub order_total: String,
    #[serde(rename = "orderStatus")]
    pub order_status: String,
    #[serde(rename = "orderTime")]
    pub order_time: String,
    #[serde(rename = "acceptButton")]
    pub accept_button: String,
    #[serde(rename = "rejectButton")]
    pub reject_button: String,
    #[serde(rename = "readyButton")]
    pub ready_button: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttributeConfig {
    #[serde(rename = "orderId")]
    pub order_id: String,
    #[serde(rename = "orderNumber")]
    pub order_number: String,
    #[serde(rename = "orderStatus")]
    pub order_status: String,
    #[serde(rename = "itemQuantity")]
    pub item_quantity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollingConfig {
    pub enabled: bool,
    #[serde(rename = "intervalMs")]
    pub interval_ms: u64,
    #[serde(rename = "useObserver")]
    pub use_observer: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionConfig {
    #[serde(rename = "skipProcessedOrders")]
    pub skip_processed_orders: bool,
    #[serde(rename = "maxOrdersPerScan")]
    pub max_orders_per_scan: usize,
    #[serde(rename = "parseNumericValues")]
    pub parse_numeric_values: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub enabled: bool,
    #[serde(rename = "dashboardUrl")]
    pub dashboard_url: String,
    pub selectors: SelectorConfig,
    pub attributes: AttributeConfig,
    pub polling: PollingConfig,
    pub extraction: ExtractionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalConfig {
    #[serde(rename = "debugMode")]
    pub debug_mode: bool,
    #[serde(rename = "logExtractions")]
    pub log_extractions: bool,
    #[serde(rename = "notifyOnNewOrder")]
    pub notify_on_new_order: bool,
    #[serde(rename = "autoAcceptOrders")]
    pub auto_accept_orders: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformsConfig {
    pub swiggy: PlatformConfig,
    pub zomato: PlatformConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatorConfig {
    pub version: String,
    #[serde(rename = "lastUpdated")]
    pub last_updated: String,
    pub platforms: PlatformsConfig,
    pub global: GlobalConfig,
}

/// Get the path to the config file
fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    Ok(resource_path.join("configs").join("aggregator_selectors.json"))
}

/// Load aggregator configuration
/// In release builds: loads from encrypted embedded data
/// In debug builds: loads from JSON file for easy development
pub fn load_config(app_handle: &tauri::AppHandle) -> Result<AggregatorConfig, String> {
    // In release builds, use embedded encrypted config
    #[cfg(not(debug_assertions))]
    {
        println!("[Config] Loading encrypted embedded config (release mode)");
        let config = load_embedded_config()?;
        println!("[Config] Loaded version {}", config.version);
        return Ok(config);
    }

    // In debug builds, load from file for easy development
    #[cfg(debug_assertions)]
    {
        let config_path = get_config_path(app_handle)?;
        println!("[Config] Loading from file: {:?} (debug mode)", config_path);

        if !config_path.exists() {
            return Err(format!("Config file not found: {:?}", config_path));
        }

        let config_content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        let config: AggregatorConfig = serde_json::from_str(&config_content)
            .map_err(|e| format!("Failed to parse config JSON: {}", e))?;

        println!("[Config] Loaded version {}", config.version);
        Ok(config)
    }
}

/// Save configuration to file (debug builds only)
/// In release builds, config is embedded and cannot be modified
pub fn save_config(
    app_handle: &tauri::AppHandle,
    config: &AggregatorConfig,
) -> Result<(), String> {
    // Disable config saving in release builds for security
    #[cfg(not(debug_assertions))]
    {
        let _ = (app_handle, config); // Suppress unused warnings
        return Err("Config modification is disabled in release builds".to_string());
    }

    #[cfg(debug_assertions)]
    {
        let config_path = get_config_path(app_handle)?;
        println!("[Config] Saving to: {:?}", config_path);

        let config_json = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&config_path, config_json)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        println!("[Config] Saved successfully");
        Ok(())
    }
}

/// Get platform configuration by name
pub fn get_platform_config<'a>(
    config: &'a AggregatorConfig,
    platform: &str,
) -> Option<&'a PlatformConfig> {
    match platform.to_lowercase().as_str() {
        "swiggy" => Some(&config.platforms.swiggy),
        "zomato" => Some(&config.platforms.zomato),
        _ => None,
    }
}

/// Tauri command to get current config
#[tauri::command]
pub fn get_aggregator_config(app: tauri::AppHandle) -> Result<AggregatorConfig, String> {
    load_config(&app)
}

/// Tauri command to update config
#[tauri::command]
pub fn update_aggregator_config(
    app: tauri::AppHandle,
    config: AggregatorConfig,
) -> Result<(), String> {
    save_config(&app, &config)
}

/// Tauri command to get platform-specific config
#[tauri::command]
pub fn get_platform_selectors(
    app: tauri::AppHandle,
    platform: String,
) -> Result<PlatformConfig, String> {
    let config = load_config(&app)?;

    get_platform_config(&config, &platform)
        .cloned()
        .ok_or_else(|| format!("Unknown platform: {}", platform))
}
