/**
 * Staff Portal Window Management
 *
 * Commands for spawning separate windows for different staff roles.
 * Each staff member can open their personalized portal with:
 * - Role-specific functionality
 * - Personal salary/payroll information
 * - Time tracking and attendance
 */

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StaffPortalConfig {
    pub staff_id: String,
    pub staff_name: String,
    pub role: String,
    pub window_label: String,
}

/// Open staff portal window
#[tauri::command]
pub async fn open_staff_portal(
    app_handle: AppHandle,
    staff_id: String,
    staff_name: String,
    role: String,
) -> Result<String, String> {
    println!("[StaffPortal] Opening portal for {} ({})", staff_name, role);

    // Generate unique window label
    let window_label = format!("staff-portal-{}", staff_id);

    // Check if window already exists
    if app_handle.get_webview_window(&window_label).is_some() {
        println!("[StaffPortal] Window already exists, focusing...");
        if let Some(window) = app_handle.get_webview_window(&window_label) {
            let _ = window.set_focus();
        }
        return Ok(window_label);
    }

    // Determine portal route based on role
    let route = match role.to_lowercase().as_str() {
        "server" => "/staff-portal/service",
        "kitchen" => "/staff-portal/kitchen",
        "manager" => "/staff-portal/operations",
        "cleaner" => "/staff-portal/cleaning",
        _ => "/staff-portal/service", // Default to service
    };

    // Build window URL with staff info
    let url = format!("/#{}?staff_id={}&name={}&role={}",
        route,
        urlencoding::encode(&staff_id),
        urlencoding::encode(&staff_name),
        urlencoding::encode(&role)
    );

    println!("[StaffPortal] Creating window at: {}", url);

    // Create new window
    let webview_url = WebviewUrl::App(url.into());

    WebviewWindowBuilder::new(&app_handle, window_label.clone(), webview_url)
        .title(format!("{} Portal - {}", role, staff_name))
        .inner_size(1024.0, 768.0)
        .resizable(true)
        .maximized(false)
        .decorations(true)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    println!("[StaffPortal] ✅ Window created: {}", window_label);

    Ok(window_label)
}

/// Close staff portal window
#[tauri::command]
pub async fn close_staff_portal(
    app_handle: AppHandle,
    staff_id: String,
) -> Result<(), String> {
    let window_label = format!("staff-portal-{}", staff_id);

    if let Some(window) = app_handle.get_webview_window(&window_label) {
        window.close().map_err(|e| e.to_string())?;
        println!("[StaffPortal] ✅ Closed window: {}", window_label);
        Ok(())
    } else {
        Err("Window not found".to_string())
    }
}

/// Get list of open staff portals
#[tauri::command]
pub async fn get_open_staff_portals(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let windows: Vec<String> = app_handle
        .webview_windows()
        .keys()
        .filter(|label| label.starts_with("staff-portal-"))
        .cloned()
        .collect();

    println!("[StaffPortal] Open portals: {:?}", windows);

    Ok(windows)
}

/// Focus staff portal window if already open
#[tauri::command]
pub async fn focus_staff_portal(
    app_handle: AppHandle,
    staff_id: String,
) -> Result<bool, String> {
    let window_label = format!("staff-portal-{}", staff_id);

    if let Some(window) = app_handle.get_webview_window(&window_label) {
        window.set_focus().map_err(|e| e.to_string())?;
        println!("[StaffPortal] ✅ Focused window: {}", window_label);
        Ok(true)
    } else {
        Ok(false)
    }
}
