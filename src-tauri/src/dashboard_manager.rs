// Dashboard manager - Desktop only (multi-window not supported on Android)
#![allow(dead_code)]

use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

#[cfg(not(target_os = "android"))]
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(not(target_os = "android"))]
use crate::config::{load_config, get_platform_config};

#[cfg(not(target_os = "android"))]
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedOrder {
    pub platform: String,
    pub order_id: String,
    pub order_number: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub customer_address: Option<String>,
    pub items: Vec<OrderItem>,
    pub total: f64,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItem {
    pub name: String,
    pub quantity: u32,
    pub price: f64,
    pub modifiers: Option<Vec<String>>,
    pub special_instructions: Option<String>,
}

// Desktop-only implementations
#[cfg(not(target_os = "android"))]
mod desktop {
    use super::*;

    /// Generate initialization script with config injected
    pub fn generate_extractor_script(app: &AppHandle, platform: &str) -> Result<String, String> {
        // Load aggregator config
        let config = load_config(app)?;

        // Get platform-specific config
        let platform_config = get_platform_config(&config, platform)
            .ok_or_else(|| format!("No configuration found for platform: {}", platform))?;

        // Read the universal extractor template
        let extractor_template = include_str!("../scripts/universal_extractor.js");

        // Build config object for injection
        let injection_config = serde_json::json!({
            "platform": platform,
            "selectors": platform_config.selectors,
            "attributes": platform_config.attributes,
            "polling": platform_config.polling,
            "extraction": platform_config.extraction,
            "global": config.global
        });

        // Convert config to JSON string
        let config_json = serde_json::to_string(&injection_config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        // Inject config into script
        let script = format!(
            "const EXTRACTOR_CONFIG = {};\n\n{}",
            config_json,
            extractor_template
        );

        Ok(script)
    }

    /// Get platform-specific data directory for session isolation
    fn get_platform_data_dir(app: &AppHandle, platform: &str) -> Result<PathBuf, String> {
        let app_data_dir = app.path().app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        // Create platform-specific subdirectory for session isolation
        let platform_dir = app_data_dir.join("aggregator_sessions").join(platform);

        // Ensure directory exists
        std::fs::create_dir_all(&platform_dir)
            .map_err(|e| format!("Failed to create platform data dir: {}", e))?;

        Ok(platform_dir)
    }

    /// Generic function to open aggregator dashboard
    pub async fn open_dashboard(app: AppHandle, platform: &str) -> Result<(), String> {
        let label = format!("{}-dashboard", platform);

        // Check if window already exists
        if let Some(window) = app.get_webview_window(&label) {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            return Ok(());
        }

        // Load config to get dashboard URL
        let config = load_config(&app)?;
        let platform_config = get_platform_config(&config, platform)
            .ok_or_else(|| format!("No configuration found for platform: {}", platform))?;

        if !platform_config.enabled {
            return Err(format!("Platform {} is disabled in configuration", platform));
        }

        let url = &platform_config.dashboard_url;

        // Generate extractor script with injected config
        let script = generate_extractor_script(&app, platform)?;

        // Get platform-specific data directory for session isolation
        // This ensures Swiggy and Zomato have completely separate cookies/sessions
        let data_dir = get_platform_data_dir(&app, platform)?;

        println!("[DashboardManager] Opening {} dashboard at {}", platform, url);
        println!("[DashboardManager] Window label: {}", label);
        println!("[DashboardManager] Data directory: {:?}", data_dir);

        // Create new window with Chrome user agent and separate data directory
        // The data_directory ensures each platform has its own cookies, localStorage, etc.
        let result = WebviewWindowBuilder::new(
            &app,
            &label,
            WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
        )
        .title(&format!("{} Partner Dashboard", platform.to_uppercase()))
        .inner_size(1024.0, 768.0)
        .resizable(true)
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .initialization_script(&script)
        .data_directory(data_dir)
        .build();

        match result {
            Ok(_window) => {
                println!("[DashboardManager] ✅ {} dashboard window created successfully", platform);
                Ok(())
            },
            Err(e) => {
                eprintln!("[DashboardManager] ❌ Failed to create {} dashboard window: {}", platform, e);
                Err(format!("Failed to create dashboard window: {}", e))
            }
        }
    }

    /// Close dashboard window
    pub async fn close_dashboard_impl(app: AppHandle, platform: String) -> Result<(), String> {
        let label = format!("{}-dashboard", platform.to_lowercase());

        if let Some(window) = app.get_webview_window(&label) {
            window.destroy().map_err(|e| e.to_string())?;
            println!("[DashboardManager] Closed {} dashboard", platform);
        }

        Ok(())
    }

    /// Reload dashboard with updated config
    pub async fn reload_dashboard_impl(app: AppHandle, platform: String) -> Result<(), String> {
        let label = format!("{}-dashboard", platform.to_lowercase());

        // Close existing window
        if let Some(window) = app.get_webview_window(&label) {
            window.destroy().map_err(|e| e.to_string())?;
        }

        // Reopen with new config
        open_dashboard(app, &platform.to_lowercase()).await
    }
}

/// Open Swiggy dashboard in a new webview window
#[tauri::command]
pub async fn open_swiggy_dashboard(app: AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        desktop::open_dashboard(app, "swiggy").await
    }
    #[cfg(target_os = "android")]
    {
        let _ = app;
        Err("Multi-window dashboards are not supported on Android".to_string())
    }
}

/// Open Zomato dashboard in a new webview window
#[tauri::command]
pub async fn open_zomato_dashboard(app: AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        desktop::open_dashboard(app, "zomato").await
    }
    #[cfg(target_os = "android")]
    {
        let _ = app;
        Err("Multi-window dashboards are not supported on Android".to_string())
    }
}

/// Close aggregator dashboard
#[tauri::command]
pub async fn close_dashboard(app: AppHandle, platform: String) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        desktop::close_dashboard_impl(app, platform).await
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform);
        Err("Multi-window dashboards are not supported on Android".to_string())
    }
}

/// Process extracted orders from dashboard
#[tauri::command]
pub async fn process_extracted_orders(
    app: AppHandle,
    orders: Vec<ExtractedOrder>
) -> Result<(), String> {
    println!("[DashboardManager] Processing {} extracted orders", orders.len());

    #[cfg(not(target_os = "android"))]
    {
        // Log orders in debug mode
        let config = load_config(&app)?;
        if config.global.debug_mode {
            for order in &orders {
                println!("[DashboardManager] Order {}: {} items, total: ₹{}",
                    order.order_number,
                    order.items.len(),
                    order.total
                );
            }
        }
    }

    // Emit event to frontend with extracted orders
    app.emit("aggregator-orders-extracted", orders)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Notify about new orders (for system notifications)
#[tauri::command]
pub async fn notify_new_orders(
    app: AppHandle,
    platform: String,
    count: usize
) -> Result<(), String> {
    println!("[DashboardManager] {} new orders from {}", count, platform);

    // Emit notification event
    app.emit("new-order-notification", serde_json::json!({
        "platform": platform,
        "count": count
    }))
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reload dashboard with updated config
#[tauri::command]
pub async fn reload_dashboard(app: AppHandle, platform: String) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        desktop::reload_dashboard_impl(app, platform).await
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform);
        Err("Multi-window dashboards are not supported on Android".to_string())
    }
}
