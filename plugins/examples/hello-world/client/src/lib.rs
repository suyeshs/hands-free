/**
 * Hello World Client Plugin
 *
 * A simple example plugin demonstrating:
 * - WASM compilation from Rust
 * - Plugin host bindings usage
 * - Client-side calculations
 * - Storage API
 * - Logging
 */

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use web_sys::console;

/// Plugin context passed during initialization
#[derive(Deserialize)]
struct PluginContext {
    #[serde(rename = "pluginId")]
    plugin_id: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    version: String,
}

/// Greeting result
#[derive(Serialize)]
struct GreetingResult {
    message: String,
    timestamp: f64,
    #[serde(rename = "pluginVersion")]
    plugin_version: String,
}

/// Initialize the plugin
/// Called when the plugin is loaded
#[wasm_bindgen]
pub fn init(context_json: &str, _host_json: &str) -> Result<(), JsValue> {
    // Parse context
    let context: PluginContext = serde_json::from_str(context_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse context: {}", e)))?;

    console::log_1(&JsValue::from_str(&format!(
        "[HelloWorld] Plugin initialized! ID: {}, Tenant: {}, Version: {}",
        context.plugin_id, context.tenant_id, context.version
    )));

    Ok(())
}

/// Generate a personalized greeting
/// This is a client-side calculation (works offline)
#[wasm_bindgen]
pub fn greet(name: &str) -> Result<String, JsValue> {
    let timestamp = js_sys::Date::now();

    let result = GreetingResult {
        message: format!("Hello, {}! Welcome to HandsFree POS!", name),
        timestamp,
        plugin_version: "1.0.0".to_string(),
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Calculate a simple greeting with time of day
#[wasm_bindgen]
pub fn greet_with_time(name: &str) -> Result<String, JsValue> {
    let now = js_sys::Date::new_0();
    let hour = now.get_hours();

    let time_of_day = match hour {
        5..=11 => "Good morning",
        12..=17 => "Good afternoon",
        18..=21 => "Good evening",
        _ => "Good night",
    };

    let result = GreetingResult {
        message: format!("{}, {}! Great to see you.", time_of_day, name),
        timestamp: js_sys::Date::now(),
        plugin_version: "1.0.0".to_string(),
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Get plugin info
#[wasm_bindgen]
pub fn get_info() -> Result<String, JsValue> {
    #[derive(Serialize)]
    struct PluginInfo {
        name: String,
        version: String,
        description: String,
        author: String,
    }

    let info = PluginInfo {
        name: "Hello World".to_string(),
        version: "1.0.0".to_string(),
        description: "A simple example plugin demonstrating WASM capabilities".to_string(),
        author: "HandsFree POS Team".to_string(),
    };

    serde_json::to_string(&info)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Cleanup when plugin is unloaded
#[wasm_bindgen]
pub fn destroy() {
    console::log_1(&JsValue::from_str("[HelloWorld] Plugin destroyed"));
}

/// Example of a calculation function
/// Demonstrates pure client-side logic
#[wasm_bindgen]
pub fn calculate_sum(a: f64, b: f64) -> f64 {
    a + b
}

/// Example with JSON input/output
#[wasm_bindgen]
pub fn process_data(input_json: &str) -> Result<String, JsValue> {
    #[derive(Deserialize)]
    struct Input {
        numbers: Vec<f64>,
    }

    #[derive(Serialize)]
    struct Output {
        sum: f64,
        count: usize,
        average: f64,
    }

    let input: Input = serde_json::from_str(input_json)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    let sum: f64 = input.numbers.iter().sum();
    let count = input.numbers.len();
    let average = if count > 0 { sum / count as f64 } else { 0.0 };

    let output = Output { sum, count, average };

    serde_json::to_string(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
