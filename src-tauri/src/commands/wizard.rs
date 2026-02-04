/**
 * Setup Wizard State Commands
 * Tauri commands for managing setup wizard state in SQLite
 * This replaces localStorage to eliminate race conditions with page reloads
 */

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use rusqlite::{Connection, params};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetupWizardState {
    // Navigation state
    pub current_screen: String,
    pub completed_screens: String, // JSON array
    pub skipped_screens: String,   // JSON array
    pub selected_optional_items: String, // JSON array

    // Wizard data (JSON object)
    pub wizard_data: String,

    // Completion state
    pub is_complete: bool,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub awaiting_activation: bool,

    // Provisioning data (stored in SQLite, replaces localStorage)
    pub activation_code: Option<String>,
    pub provisioning_web_socket_url: Option<String>,
    pub is_restaurant_owner: bool,

    // Checklist dismissal
    pub checklist_dismissed: bool,
}

/// Get setup wizard state from SQLite
#[tauri::command]
pub fn get_setup_wizard_state(app: tauri::AppHandle) -> Result<SetupWizardState, String> {
    println!("[wizard.rs] ===== get_setup_wizard_state called =====");

    // Use the same database path as other migrations
    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            println!("[wizard.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join(crate::get_db_filename());

    println!("[wizard.rs] Database path: {:?}", db_path);
    println!("[wizard.rs] Database exists: {}", db_path.exists());

    let db = Connection::open(&db_path).map_err(|e| {
        println!("[wizard.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    println!("[wizard.rs] Database connection opened successfully");

    // Note: setup_wizard_state table is created by core migrations in lib.rs
    // No runtime table creation needed here

    let query = "SELECT
        current_screen, completed_screens, skipped_screens, selected_optional_items,
        wizard_data,
        is_complete, started_at, completed_at, awaiting_activation,
        activation_code, provisioning_web_socket_url, is_restaurant_owner,
        checklist_dismissed
    FROM setup_wizard_state WHERE id = 1";

    let state = db.query_row(query, [], |row| {
        Ok(SetupWizardState {
            current_screen: row.get(0)?,
            completed_screens: row.get(1)?,
            skipped_screens: row.get(2)?,
            selected_optional_items: row.get(3)?,
            wizard_data: row.get(4)?,
            is_complete: row.get(5)?,
            started_at: row.get(6)?,
            completed_at: row.get(7)?,
            awaiting_activation: row.get(8)?,
            activation_code: row.get(9)?,
            provisioning_web_socket_url: row.get(10)?,
            is_restaurant_owner: row.get(11)?,
            checklist_dismissed: row.get(12)?,
        })
    }).map_err(|e| {
        println!("[wizard.rs] ❌ Failed to query wizard state: {}", e);
        e.to_string()
    })?;

    println!("[wizard.rs] ✅ Wizard state retrieved successfully");
    println!("[wizard.rs] Current screen: {}", state.current_screen);
    println!("[wizard.rs] Is complete: {}", state.is_complete);
    println!("[wizard.rs] Awaiting activation: {}", state.awaiting_activation);

    Ok(state)
}

/// Save setup wizard state to SQLite
#[tauri::command]
pub fn save_setup_wizard_state(
    app: tauri::AppHandle,
    state: SetupWizardState,
) -> Result<(), String> {
    println!("[wizard.rs] ===== save_setup_wizard_state called =====");
    println!("[wizard.rs] Current screen: {}", state.current_screen);
    println!("[wizard.rs] Is complete: {}", state.is_complete);
    println!("[wizard.rs] Awaiting activation: {}", state.awaiting_activation);

    // Use the same database path as other migrations
    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            println!("[wizard.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join(crate::get_db_filename());

    println!("[wizard.rs] Database path: {:?}", db_path);
    println!("[wizard.rs] Database exists: {}", db_path.exists());

    let db = Connection::open(&db_path).map_err(|e| {
        println!("[wizard.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    println!("[wizard.rs] Database connection opened successfully");

    // Note: setup_wizard_state table is created by core migrations in lib.rs
    // No runtime table creation needed here

    // Use INSERT OR REPLACE to ensure row is created/updated
    let query = "INSERT OR REPLACE INTO setup_wizard_state (
        id,
        current_screen, completed_screens, skipped_screens, selected_optional_items,
        wizard_data,
        is_complete, started_at, completed_at, awaiting_activation,
        activation_code, provisioning_web_socket_url, is_restaurant_owner,
        checklist_dismissed
    ) VALUES (
        1,
        ?1, ?2, ?3, ?4,
        ?5,
        ?6, ?7, ?8, ?9,
        ?10, ?11, ?12,
        ?13
    )";

    println!("[wizard.rs] Executing INSERT OR REPLACE query...");

    let rows_affected = db.execute(query, params![
        state.current_screen,
        state.completed_screens,
        state.skipped_screens,
        state.selected_optional_items,
        state.wizard_data,
        state.is_complete,
        state.started_at,
        state.completed_at,
        state.awaiting_activation,
        state.activation_code,
        state.provisioning_web_socket_url,
        state.is_restaurant_owner,
        state.checklist_dismissed,
    ])
    .map_err(|e| {
        println!("[wizard.rs] ❌ Query execution failed: {}", e);
        format!("Failed to save wizard state: {}", e)
    })?;

    println!("[wizard.rs] ✅ Query succeeded, rows affected: {}", rows_affected);

    if rows_affected == 0 {
        println!("[wizard.rs] ⚠️ WARNING: No rows were affected!");
        return Err("Wizard state save failed - no rows were affected".to_string());
    }

    println!("[wizard.rs] ✅ Wizard state saved to SQLite successfully");
    Ok(())
}

/// Reset wizard state to defaults (for testing or re-setup)
#[tauri::command]
pub fn reset_setup_wizard_state(app: tauri::AppHandle) -> Result<(), String> {
    println!("[wizard.rs] ===== reset_setup_wizard_state called =====");

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Reset to default values
    let query = "UPDATE setup_wizard_state SET
        current_screen = 'welcome',
        completed_screens = '[]',
        skipped_screens = '[]',
        selected_optional_items = '[]',
        wizard_data = '{}',
        is_complete = 0,
        started_at = NULL,
        completed_at = NULL,
        awaiting_activation = 0,
        activation_code = NULL,
        provisioning_web_socket_url = NULL,
        is_restaurant_owner = 0,
        checklist_dismissed = 0
    WHERE id = 1";

    db.execute(query, [])
        .map_err(|e| {
            println!("[wizard.rs] ❌ Reset failed: {}", e);
            format!("Failed to reset wizard state: {}", e)
        })?;

    println!("[wizard.rs] ✅ Wizard state reset successfully");
    Ok(())
}

/// Clean up stale provisioning WebSocket URL if provisioning is complete
/// This prevents connection errors to expired WebSocket endpoints
#[tauri::command]
pub fn cleanup_provisioning_websocket(app: tauri::AppHandle) -> Result<bool, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Check if tenant is provisioned (tenant_config exists with id = 1)
    let tenant_exists: bool = db
        .query_row(
            "SELECT COUNT(*) FROM tenant_config WHERE id = 1",
            [],
            |row| {
                let count: i32 = row.get(0)?;
                Ok(count > 0)
            },
        )
        .unwrap_or(false);

    // Check if provisioning WebSocket URL exists
    let has_websocket_url: bool = db
        .query_row(
            "SELECT provisioning_web_socket_url FROM setup_wizard_state WHERE id = 1",
            [],
            |row| {
                let url: Option<String> = row.get(0)?;
                Ok(url.is_some())
            },
        )
        .unwrap_or(false);

    // If tenant exists and there's a WebSocket URL, clean it up
    if tenant_exists && has_websocket_url {
        println!("[wizard.rs] Tenant provisioning complete, cleaning up stale WebSocket URL");

        db.execute(
            "UPDATE setup_wizard_state SET provisioning_web_socket_url = NULL WHERE id = 1",
            [],
        )
        .map_err(|e| format!("Failed to cleanup WebSocket URL: {}", e))?;

        println!("[wizard.rs] ✅ Cleaned up stale provisioning WebSocket URL");
        Ok(true) // Cleaned up
    } else {
        if !has_websocket_url {
            println!("[wizard.rs] No provisioning WebSocket URL to clean up");
        } else if !tenant_exists {
            println!("[wizard.rs] Tenant not provisioned yet, keeping WebSocket URL");
        }
        Ok(false) // Nothing to clean up
    }
}
