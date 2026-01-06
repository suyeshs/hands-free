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

        // Tab bar injection script for unified aggregator view
        let tab_bar_script = generate_tab_bar_script(platform);

        // Inject config and tab bar into script
        let script = format!(
            "{}\n\nconst EXTRACTOR_CONFIG = {};\n\n{}",
            tab_bar_script,
            config_json,
            extractor_template
        );

        Ok(script)
    }

    /// Generate tab bar HTML/CSS/JS for unified aggregator view
    fn generate_tab_bar_script(current_platform: &str) -> String {
        let swiggy_active = if current_platform == "swiggy" { "" } else { "tab-inactive" };
        let zomato_active = if current_platform == "zomato" { "" } else { "tab-inactive" };

        format!(r#"
(function() {{
    // Wait for DOM to be ready
    function injectTabBar() {{
        if (document.getElementById('aggregator-tab-bar')) return;

        const style = document.createElement('style');
        style.textContent = `
            #aggregator-tab-bar {{
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 2147483647;
                display: flex;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                padding: 8px 16px;
                gap: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                align-items: center;
            }}
            #aggregator-tab-bar .tab-title {{
                color: #888;
                font-size: 12px;
                font-weight: 500;
                margin-right: 8px;
            }}
            #aggregator-tab-bar button {{
                padding: 10px 32px;
                border: none;
                border-radius: 6px;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            #aggregator-tab-bar button:hover {{
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }}
            #aggregator-tab-bar .tab-swiggy {{
                background: linear-gradient(135deg, #fc8019 0%, #e67316 100%);
                color: white;
            }}
            #aggregator-tab-bar .tab-zomato {{
                background: linear-gradient(135deg, #e23744 0%, #cb2d3e 100%);
                color: white;
            }}
            #aggregator-tab-bar .tab-inactive {{
                opacity: 0.4;
                transform: scale(0.95);
            }}
            #aggregator-tab-bar .tab-inactive:hover {{
                opacity: 0.7;
            }}
            body {{
                padding-top: 56px !important;
            }}
        `;
        document.head.appendChild(style);

        const bar = document.createElement('div');
        bar.id = 'aggregator-tab-bar';
        bar.innerHTML = `
            <span class="tab-title">Switch Dashboard:</span>
            <button class="tab-swiggy {}" onclick="window.__TAURI__.core.invoke('switch_aggregator_tab', {{platform: 'swiggy'}})">
                🟠 Swiggy
            </button>
            <button class="tab-zomato {}" onclick="window.__TAURI__.core.invoke('switch_aggregator_tab', {{platform: 'zomato'}})">
                🔴 Zomato
            </button>
        `;

        if (document.body) {{
            document.body.prepend(bar);
        }} else {{
            document.addEventListener('DOMContentLoaded', () => {{
                document.body.prepend(bar);
            }});
        }}
    }}

    // Try immediately and also on DOMContentLoaded
    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', injectTabBar);
    }} else {{
        injectTabBar();
    }}

    // Also try after a short delay as backup
    setTimeout(injectTabBar, 500);
    setTimeout(injectTabBar, 2000);
}})();
"#, swiggy_active, zomato_active)
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

    /// Open both dashboards in unified tabbed mode (overlapping windows with show/hide)
    pub async fn open_both_dashboards(app: AppHandle) -> Result<(), String> {
        use tauri::Manager;

        // Try to get screen size from primary monitor
        let (screen_width, screen_height) = if let Some(main_window) = app.get_webview_window("main") {
            if let Ok(Some(monitor)) = main_window.primary_monitor() {
                let size = monitor.size();
                (size.width as f64, size.height as f64)
            } else {
                (1920.0, 1080.0) // Default fallback
            }
        } else {
            (1920.0, 1080.0) // Default fallback
        };

        let window_height = (screen_height - 100.0).max(600.0); // Leave some space for taskbar

        println!("[DashboardManager] Opening unified aggregator view: {}x{}",
            screen_width, window_height);

        // Create both dashboard windows at same position
        let swiggy_window = open_dashboard_for_tabbing(app.clone(), "swiggy", screen_width, window_height).await?;
        let zomato_window = open_dashboard_for_tabbing(app.clone(), "zomato", screen_width, window_height).await?;

        // Hide zomato initially, show only swiggy
        // Tab bar injected in each webview allows switching via switch_aggregator_tab command
        zomato_window.hide().map_err(|e| e.to_string())?;
        swiggy_window.show().map_err(|e| e.to_string())?;
        swiggy_window.set_focus().map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Create a dashboard window configured for tabbing
    async fn open_dashboard_for_tabbing(
        app: AppHandle,
        platform: &str,
        width: f64,
        height: f64
    ) -> Result<tauri::WebviewWindow, String> {
        let label = format!("{}-dashboard", platform);

        // Check if window already exists
        if let Some(window) = app.get_webview_window(&label) {
            window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
                .map_err(|e| e.to_string())?;
            window.show().map_err(|e| e.to_string())?;
            return Ok(window);
        }

        // Load config to get dashboard URL
        let config = load_config(&app)?;
        let platform_config = get_platform_config(&config, platform)
            .ok_or_else(|| format!("No configuration found for platform: {}", platform))?;

        if !platform_config.enabled {
            return Err(format!("Platform {} is disabled in configuration", platform));
        }

        let url = &platform_config.dashboard_url;
        let script = generate_extractor_script(&app, platform)?;
        let data_dir = get_platform_data_dir(&app, platform)?;

        println!("[DashboardManager] Creating {} dashboard for tabbing", platform);

        let window = WebviewWindowBuilder::new(
            &app,
            &label,
            WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
        )
        .title(&format!("{} Dashboard", platform.to_uppercase()))
        .inner_size(width, height)
        .center()
        .resizable(true)
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .initialization_script(&script)
        .data_directory(data_dir)
        .build()
        .map_err(|e| format!("Failed to create {} dashboard: {}", platform, e))?;

        println!("[DashboardManager] ✅ {} dashboard created for tabbing", platform);
        Ok(window)
    }

    /// Open dashboard at specific position (legacy, kept for compatibility)
    async fn open_dashboard_positioned(app: AppHandle, platform: &str, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
        let label = format!("{}-dashboard", platform);

        // Check if window already exists
        if let Some(window) = app.get_webview_window(&label) {
            // Reposition existing window
            window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)))
                .map_err(|e| e.to_string())?;
            window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
                .map_err(|e| e.to_string())?;
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
        let script = generate_extractor_script(&app, platform)?;
        let data_dir = get_platform_data_dir(&app, platform)?;

        println!("[DashboardManager] Opening {} dashboard at position ({}, {})", platform, x, y);

        let result = WebviewWindowBuilder::new(
            &app,
            &label,
            WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
        )
        .title(&format!("{} Partner Dashboard", platform.to_uppercase()))
        .inner_size(width, height)
        .position(x, y)
        .resizable(true)
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .initialization_script(&script)
        .data_directory(data_dir)
        .build();

        match result {
            Ok(_window) => {
                println!("[DashboardManager] ✅ {} dashboard window created at ({}, {})", platform, x, y);
                Ok(())
            },
            Err(e) => {
                eprintln!("[DashboardManager] ❌ Failed to create {} dashboard window: {}", platform, e);
                Err(format!("Failed to create dashboard window: {}", e))
            }
        }
    }

    /// Close both dashboards
    pub async fn close_both_dashboards(app: AppHandle) -> Result<(), String> {
        close_dashboard_impl(app.clone(), "swiggy".to_string()).await?;
        close_dashboard_impl(app, "zomato".to_string()).await?;
        Ok(())
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

/// Open both Swiggy and Zomato dashboards side-by-side
#[tauri::command]
pub async fn open_unified_aggregator(app: AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        desktop::open_both_dashboards(app).await
    }
    #[cfg(target_os = "android")]
    {
        let _ = app;
        Err("Split-screen aggregator is not supported on Android".to_string())
    }
}

/// Close both aggregator dashboards
#[tauri::command]
pub async fn close_unified_aggregator(app: AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        desktop::close_both_dashboards(app).await
    }
    #[cfg(target_os = "android")]
    {
        let _ = app;
        Err("Split-screen aggregator is not supported on Android".to_string())
    }
}

/// Execute JavaScript in a dashboard webview
/// Used to trigger history fetch or other actions
#[tauri::command]
pub async fn eval_in_dashboard(app: AppHandle, platform: String, script: String) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        let label = format!("{}-dashboard", platform.to_lowercase());

        if let Some(window) = app.get_webview_window(&label) {
            window.eval(&script)
                .map_err(|e| format!("Failed to evaluate script in {}: {}", platform, e))?;
            println!("[DashboardManager] Evaluated script in {} dashboard", platform);
            Ok(())
        } else {
            Err(format!("{} dashboard is not open", platform))
        }
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform, script);
        Err("Script evaluation is not supported on Android".to_string())
    }
}

/// Handle history extraction completion notification from JS
#[tauri::command]
pub async fn history_extraction_complete(
    app: AppHandle,
    platform: String,
    count: usize,
    days: u32
) -> Result<(), String> {
    println!("[DashboardManager] History extraction complete for {}: {} orders from {} days", platform, count, days);

    // Emit event to frontend
    app.emit("history-extraction-complete", serde_json::json!({
        "platform": platform,
        "count": count,
        "days": days
    }))
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ==================== DEBUG/TESTING COMMANDS ====================

/// Receive debug results from JS and emit to frontend
#[tauri::command]
pub async fn dashboard_debug_result(
    app: AppHandle,
    result_type: String,
    platform: String,
    data: serde_json::Value,
) -> Result<(), String> {
    println!("[DashboardManager] Debug result received: {} from {}", result_type, platform);

    let payload = serde_json::json!({
        "resultType": result_type,
        "platform": platform,
        "data": data,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    });

    app.emit("dashboard-debug-result", payload)
        .map_err(|e| format!("Failed to emit debug result: {}", e))?;

    Ok(())
}

/// Trigger button identification in dashboard
#[tauri::command]
pub async fn identify_dashboard_buttons(app: AppHandle, platform: String) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        let label = format!("{}-dashboard", platform.to_lowercase());

        if let Some(window) = app.get_webview_window(&label) {
            window.eval("window.identifyButtons()")
                .map_err(|e| format!("Failed to identify buttons: {}", e))?;
            println!("[DashboardManager] Button identification triggered for {}", platform);
            Ok(())
        } else {
            Err(format!("{} dashboard is not open", platform))
        }
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform);
        Err("Dashboard debugging is not supported on Android".to_string())
    }
}

/// Test click a button in dashboard
#[tauri::command]
pub async fn test_dashboard_click(
    app: AppHandle,
    platform: String,
    button_type: String,
    order_id: Option<String>,
    dry_run: bool,
) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        let label = format!("{}-dashboard", platform.to_lowercase());

        if let Some(window) = app.get_webview_window(&label) {
            let order_id_js = order_id
                .map(|id| format!("'{}'", id))
                .unwrap_or_else(|| "null".to_string());

            let script = format!(
                "window.testClick('{}', {}, {})",
                button_type, order_id_js, dry_run
            );

            window.eval(&script)
                .map_err(|e| format!("Failed to test click: {}", e))?;
            println!("[DashboardManager] Click test triggered: {} in {}", button_type, platform);
            Ok(())
        } else {
            Err(format!("{} dashboard is not open", platform))
        }
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform, button_type, order_id, dry_run);
        Err("Dashboard debugging is not supported on Android".to_string())
    }
}

/// Get current page state from dashboard
#[tauri::command]
pub async fn get_dashboard_page_state(app: AppHandle, platform: String) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        let label = format!("{}-dashboard", platform.to_lowercase());

        if let Some(window) = app.get_webview_window(&label) {
            window.eval("window.getPageState()")
                .map_err(|e| format!("Failed to get page state: {}", e))?;
            println!("[DashboardManager] Page state requested for {}", platform);
            Ok(())
        } else {
            Err(format!("{} dashboard is not open", platform))
        }
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform);
        Err("Dashboard debugging is not supported on Android".to_string())
    }
}

/// Navigate to a specific tab in dashboard
#[tauri::command]
pub async fn navigate_dashboard_tab(
    app: AppHandle,
    platform: String,
    tab_name: String,
) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        let label = format!("{}-dashboard", platform.to_lowercase());

        if let Some(window) = app.get_webview_window(&label) {
            let script = format!("window.navigateToTab('{}')", tab_name);
            window.eval(&script)
                .map_err(|e| format!("Failed to navigate tab: {}", e))?;
            println!("[DashboardManager] Tab navigation triggered: {} in {}", tab_name, platform);
            Ok(())
        } else {
            Err(format!("{} dashboard is not open", platform))
        }
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform, tab_name);
        Err("Dashboard debugging is not supported on Android".to_string())
    }
}

/// Verify all selectors in dashboard
#[tauri::command]
pub async fn verify_dashboard_selectors(app: AppHandle, platform: String) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        let label = format!("{}-dashboard", platform.to_lowercase());

        if let Some(window) = app.get_webview_window(&label) {
            window.eval("window.verifySelectorConfig()")
                .map_err(|e| format!("Failed to verify selectors: {}", e))?;
            println!("[DashboardManager] Selector verification triggered for {}", platform);
            Ok(())
        } else {
            Err(format!("{} dashboard is not open", platform))
        }
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform);
        Err("Dashboard debugging is not supported on Android".to_string())
    }
}

/// Switch between aggregator tabs (show one, hide the other)
#[tauri::command]
pub async fn switch_aggregator_tab(app: AppHandle, platform: String) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        let platforms = ["swiggy", "zomato"];
        for p in platforms {
            let label = format!("{}-dashboard", p);
            if let Some(window) = app.get_webview_window(&label) {
                if p == platform.to_lowercase() {
                    window.show().map_err(|e| e.to_string())?;
                    window.set_focus().map_err(|e| e.to_string())?;
                    println!("[DashboardManager] Switched to {} tab", p);
                } else {
                    window.hide().map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(())
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, platform);
        Err("Tab switching not supported on Android".to_string())
    }
}

/// Minimize all aggregator dashboard windows
#[tauri::command]
pub async fn minimize_aggregator_dashboards(app: AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        for platform in ["swiggy", "zomato"] {
            let label = format!("{}-dashboard", platform);
            if let Some(window) = app.get_webview_window(&label) {
                window.minimize().map_err(|e| e.to_string())?;
                println!("[DashboardManager] Minimized {} dashboard", platform);
            }
        }
        Ok(())
    }
    #[cfg(target_os = "android")]
    {
        let _ = app;
        Err("Dashboard windows are not supported on Android".to_string())
    }
}

/// Focus on the main application window
#[tauri::command]
pub async fn focus_main_window(app: AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "android"))]
    {
        use tauri::Manager;
        // Try common main window labels
        let main_labels = ["main", "main-window", "handsfree-pos"];
        for label in main_labels {
            if let Some(window) = app.get_webview_window(label) {
                window.show().map_err(|e| e.to_string())?;
                window.set_focus().map_err(|e| e.to_string())?;
                println!("[DashboardManager] Focused main window: {}", label);
                return Ok(());
            }
        }
        // If no named window found, try to get any window and focus it
        if let Some((_label, window)) = app.webview_windows().into_iter().find(|(l, _)| !l.contains("dashboard")) {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            println!("[DashboardManager] Focused window: {}", _label);
            return Ok(());
        }
        Err("Could not find main window".to_string())
    }
    #[cfg(target_os = "android")]
    {
        let _ = app;
        Ok(()) // On Android, there's only one window
    }
}

/// Check if any aggregator dashboard is open
#[tauri::command]
pub fn are_dashboards_open(app: AppHandle) -> bool {
    #[cfg(not(target_os = "android"))]
    {
        app.get_webview_window("swiggy-dashboard").is_some() ||
        app.get_webview_window("zomato-dashboard").is_some()
    }
    #[cfg(target_os = "android")]
    {
        let _ = app;
        false
    }
}
