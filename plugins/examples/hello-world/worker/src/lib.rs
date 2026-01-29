/**
 * Hello World Worker Plugin
 *
 * Runs on Cloudflare Workers
 * Demonstrates:
 * - Worker-side business logic
 * - API endpoints
 * - Database access (via host bindings)
 * - Server-side calculations
 */

use serde::{Deserialize, Serialize};

/// Plugin context
#[derive(Deserialize)]
struct PluginContext {
    #[serde(rename = "pluginId")]
    plugin_id: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    version: String,
}

/// Greeting response
#[derive(Serialize)]
struct GreetingResponse {
    message: String,
    #[serde(rename = "serverTime")]
    server_time: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
}

/// Error response
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

// Host functions provided by the worker runtime
// These are imported from the host environment
extern "C" {
    fn log(level: *const u8, level_len: usize, message: *const u8, message_len: usize);
    fn now() -> f64;
    fn get_context() -> *const u8;
}

/// Safe wrapper for logging
fn plugin_log(level: &str, message: &str) {
    unsafe {
        log(
            level.as_ptr(),
            level.len(),
            message.as_ptr(),
            message.len(),
        );
    }
}

/// Safe wrapper for getting timestamp
fn get_timestamp() -> f64 {
    unsafe { now() }
}

/// Safe wrapper for getting context
fn get_plugin_context() -> Result<PluginContext, String> {
    unsafe {
        let ptr = get_context();
        let slice = std::slice::from_raw_parts(ptr, 1024); // Assuming max 1KB context

        // Find null terminator
        let len = slice.iter().position(|&c| c == 0).unwrap_or(1024);
        let json_str = std::str::from_utf8(&slice[..len])
            .map_err(|e| format!("UTF-8 error: {}", e))?;

        serde_json::from_str(json_str)
            .map_err(|e| format!("JSON parse error: {}", e))
    }
}

/// Initialize the plugin
/// Called when the worker plugin is loaded
#[no_mangle]
pub extern "C" fn init() -> i32 {
    match get_plugin_context() {
        Ok(context) => {
            let msg = format!(
                "Worker plugin initialized! ID: {}, Tenant: {}, Version: {}",
                context.plugin_id, context.tenant_id, context.version
            );
            plugin_log("info", &msg);
            0 // Success
        }
        Err(e) => {
            plugin_log("error", &format!("Failed to get context: {}", e));
            -1 // Error
        }
    }
}

/// Handle HTTP requests
/// This is the main entry point for plugin API requests
#[no_mangle]
pub extern "C" fn handle_request(path_ptr: *const u8, path_len: usize) -> *const u8 {
    let path = unsafe {
        std::str::from_utf8(std::slice::from_raw_parts(path_ptr, path_len))
            .unwrap_or("")
    };

    plugin_log("info", &format!("Handling request: {}", path));

    // Get context
    let context = match get_plugin_context() {
        Ok(ctx) => ctx,
        Err(e) => {
            let error = ErrorResponse {
                error: format!("Failed to get context: {}", e),
            };
            let json = serde_json::to_string(&error).unwrap();
            return json.as_ptr();
        }
    };

    // Route handling
    let response = match path {
        "/greet" => {
            let timestamp = get_timestamp();
            let date = format_timestamp(timestamp);

            GreetingResponse {
                message: format!("Hello from the worker! Tenant: {}", context.tenant_id),
                server_time: date,
                tenant_id: context.tenant_id.clone(),
            }
        }
        "/info" => {
            GreetingResponse {
                message: "Hello World Worker Plugin v1.0.0".to_string(),
                server_time: format_timestamp(get_timestamp()),
                tenant_id: context.tenant_id.clone(),
            }
        }
        _ => {
            let error = ErrorResponse {
                error: format!("Unknown path: {}", path),
            };
            return match serde_json::to_string(&error) {
                Ok(json) => {
                    let bytes = json.into_bytes();
                    let ptr = bytes.as_ptr();
                    std::mem::forget(bytes);
                    ptr
                }
                Err(_) => std::ptr::null(),
            };
        }
    };

    // Serialize response
    match serde_json::to_string(&response) {
        Ok(json) => {
            let bytes = json.into_bytes();
            let ptr = bytes.as_ptr();
            std::mem::forget(bytes); // Prevent deallocation
            ptr
        }
        Err(e) => {
            plugin_log("error", &format!("Serialization error: {}", e));
            std::ptr::null()
        }
    }
}

/// Format timestamp to ISO 8601
fn format_timestamp(timestamp: f64) -> String {
    // Simple ISO-like format (in production, use proper date library)
    format!("{}", timestamp as u64)
}

/// Cleanup when plugin is unloaded
#[no_mangle]
pub extern "C" fn destroy() {
    plugin_log("info", "Worker plugin destroyed");
}

/// Example calculation function
/// Demonstrates server-side computation
#[no_mangle]
pub extern "C" fn calculate_total(price: f64, quantity: f64, tax_rate: f64) -> f64 {
    let subtotal = price * quantity;
    let tax = subtotal * tax_rate;
    subtotal + tax
}
