use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{Manager, Emitter};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserDevicePreference {
    pub user_id: String,
    pub user_role: String,
    pub preferred_device_mode: String,
    pub last_login_at: Option<i64>,
    pub login_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAdaptationResult {
    pub previous_mode: String,
    pub new_mode: String,
    pub features_updated: HashMap<String, bool>,
    pub user_preference_applied: bool,
}

/// Role hierarchy: higher roles inherit permissions from lower roles
fn get_role_hierarchy_level(role: &str) -> i32 {
    match role.to_lowercase().as_str() {
        "owner" => 100,
        "manager" => 90,
        "captain" => 70,
        "service" => 50,
        "bar" => 40,
        "kitchen" => 30,
        "cleaning" => 20,
        _ => 0,
    }
}

/// Check if user has permission based on role hierarchy
pub fn has_role_permission(user_role: &str, required_role: &str) -> bool {
    get_role_hierarchy_level(user_role) >= get_role_hierarchy_level(required_role)
}

/// Enable WAL mode for better concurrency
fn enable_wal_mode(db: &Connection) -> Result<(), rusqlite::Error> {
    db.pragma_update(None, "journal_mode", "WAL")?;
    db.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(())
}

/// Determine the best device mode for a user based on their role
fn determine_device_mode(user_role: &str, user_preference: Option<String>) -> String {
    // If user has a saved preference, use it
    if let Some(pref) = user_preference {
        return pref;
    }

    // Otherwise, use role-based defaults
    match user_role.to_lowercase().as_str() {
        "owner" | "manager" => "pos".to_string(),
        "captain" | "service" => "pos".to_string(),
        "kitchen" => "kds".to_string(),
        "bar" => "bds".to_string(),
        "cleaning" => "mobile".to_string(),
        _ => "pos".to_string(), // Default to POS
    }
}

/// Determine features based on device mode and user role with hierarchy support
fn determine_features(device_mode: &str, user_role: &str) -> HashMap<String, bool> {
    let mut features = HashMap::new();

    match (device_mode, user_role.to_lowercase().as_str()) {
        // POS mode - role-based features with hierarchy
        ("pos", role) if has_role_permission(role, "owner") || has_role_permission(role, "manager") => {
            features.insert("pos.takeOrders".to_string(), true);
            features.insert("pos.applyDiscounts".to_string(), true);
            features.insert("pos.voidOrders".to_string(), true);
            features.insert("pos.viewReports".to_string(), true);
            features.insert("admin.manageMenu".to_string(), true);
            features.insert("admin.manageStaff".to_string(), true);
            features.insert("admin.settings".to_string(), true);
            features.insert("kitchen.viewOrders".to_string(), true);
            features.insert("bar.viewOrders".to_string(), true);
        }
        ("pos", role) if has_role_permission(role, "captain") => {
            features.insert("pos.takeOrders".to_string(), true);
            features.insert("pos.applyDiscounts".to_string(), true);
            features.insert("pos.voidOrders".to_string(), false);
            features.insert("pos.viewReports".to_string(), false);
            features.insert("team.viewAssignments".to_string(), true);
            features.insert("team.overseeService".to_string(), true);
            features.insert("admin.settings".to_string(), false);
        }
        ("pos", role) if has_role_permission(role, "service") => {
            features.insert("pos.takeOrders".to_string(), true);
            features.insert("pos.applyDiscounts".to_string(), false);
            features.insert("pos.voidOrders".to_string(), false);
            features.insert("pos.trackTips".to_string(), true);
            features.insert("admin.settings".to_string(), false);
        }

        // KDS mode - kitchen features only
        ("kds", _) => {
            features.insert("kitchen.viewOrders".to_string(), true);
            features.insert("kitchen.updateStatus".to_string(), true);
            features.insert("kitchen.viewRecipes".to_string(), true);
            features.insert("pos.takeOrders".to_string(), false);
            features.insert("admin.settings".to_string(), false);
        }

        // BDS mode - bar features only
        ("bds", _) => {
            features.insert("bar.viewOrders".to_string(), true);
            features.insert("bar.updateStatus".to_string(), true);
            features.insert("bar.manageInventory".to_string(), true);
            features.insert("pos.takeOrders".to_string(), false);
            features.insert("admin.settings".to_string(), false);
        }

        // Mobile mode - staff features only
        ("mobile", _) => {
            features.insert("staff.viewSchedule".to_string(), true);
            features.insert("staff.clockInOut".to_string(), true);
            features.insert("staff.requestLeave".to_string(), true);
            features.insert("staff.viewSalary".to_string(), true);
            features.insert("pos.takeOrders".to_string(), false);
            features.insert("admin.settings".to_string(), false);
        }

        _ => {
            // Default minimal features
            features.insert("pos.takeOrders".to_string(), false);
        }
    }

    features
}

/// Configure device for a specific user (OPTIMIZED with WAL, transactions, and events)
#[tauri::command]
pub async fn configure_device_for_user(
    app: tauri::AppHandle,
    user_id: String,
    user_role: String,
) -> Result<DeviceAdaptationResult, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let mut db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Enable WAL mode for better concurrency
    enable_wal_mode(&db).map_err(|e| format!("Failed to enable WAL: {}", e))?;

    // Use transaction for atomicity
    let tx = db.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Get current device settings
    let current_mode: String = tx
        .query_row(
            "SELECT device_mode FROM device_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get current mode: {}", e))?;

    // Check if auto-adapt is enabled and device is not locked
    let (auto_adapt, locked_mode): (bool, bool) = tx
        .query_row(
            "SELECT auto_adapt_mode, locked_mode FROM device_settings WHERE id = 1",
            [],
            |row| Ok((row.get::<_, i64>(0)? == 1, row.get::<_, i64>(1)? == 1)),
        )
        .map_err(|e| format!("Failed to check auto-adapt: {}", e))?;

    // If device is locked to a mode, don't change it
    if locked_mode {
        return Ok(DeviceAdaptationResult {
            previous_mode: current_mode.clone(),
            new_mode: current_mode,
            features_updated: HashMap::new(),
            user_preference_applied: false,
        });
    }

    // If auto-adapt is disabled, don't change mode
    if !auto_adapt {
        return Ok(DeviceAdaptationResult {
            previous_mode: current_mode.clone(),
            new_mode: current_mode,
            features_updated: HashMap::new(),
            user_preference_applied: false,
        });
    }

    // Get user's preferred device mode (if any)
    let user_preference = tx
        .query_row(
            "SELECT preferred_device_mode FROM user_device_preferences WHERE user_id = ?1",
            params![&user_id],
            |row| row.get::<_, String>(0),
        )
        .ok();

    // Determine the best device mode for this user
    let new_mode = determine_device_mode(&user_role, user_preference.clone());

    // Determine features based on mode and role (with hierarchy)
    let features = determine_features(&new_mode, &user_role);
    let features_json = serde_json::to_string(&features).unwrap_or_else(|_| "{}".to_string());

    // Update device settings
    tx.execute(
        "UPDATE device_settings
         SET device_mode = ?1,
             features_json = ?2,
             current_user_id = ?3,
             current_user_role = ?4,
             updated_at = unixepoch()
         WHERE id = 1",
        params![&new_mode, &features_json, &user_id, &user_role],
    )
    .map_err(|e| format!("Failed to update device settings: {}", e))?;

    // Update or create user device preference with conflict resolution
    tx.execute(
        "INSERT INTO user_device_preferences (user_id, user_role, preferred_device_mode, last_login_at, login_count)
         VALUES (?1, ?2, ?3, unixepoch(), 1)
         ON CONFLICT(user_id) DO UPDATE SET
             user_role = ?2,
             preferred_device_mode = CASE
                 WHEN excluded.last_login_at > user_device_preferences.last_login_at
                 THEN ?3
                 ELSE user_device_preferences.preferred_device_mode
             END,
             last_login_at = unixepoch(),
             login_count = login_count + 1,
             updated_at = unixepoch()",
        params![&user_id, &user_role, &new_mode],
    )
    .map_err(|e| format!("Failed to update user preference: {}", e))?;

    // Get device_id for login history
    let device_id: String = tx
        .query_row(
            "SELECT device_id FROM device_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "unknown".to_string());

    // Record login in history
    tx.execute(
        "INSERT INTO device_login_history (device_id, user_id, user_role, device_mode_before, device_mode_after)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&device_id, &user_id, &user_role, &current_mode, &new_mode],
    )
    .ok(); // Don't fail if history recording fails

    // Commit transaction
    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    let result = DeviceAdaptationResult {
        previous_mode: current_mode.clone(),
        new_mode: new_mode.clone(),
        features_updated: features.clone(),
        user_preference_applied: user_preference.is_some(),
    };

    // Emit event if mode changed (for UI to react)
    if current_mode != new_mode {
        app.emit("device-mode-changed", result.clone())
            .map_err(|e| format!("Failed to emit event: {}", e))?;
    }

    Ok(result)
}

/// Verify user has feature permission (backend enforcement)
#[tauri::command]
pub async fn verify_feature_permission(
    app: tauri::AppHandle,
    user_id: String,
    feature: String,
) -> Result<bool, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Get current user's role and features
    let (current_user, features_json): (String, String) = db
        .query_row(
            "SELECT current_user_id, features_json FROM device_settings WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Failed to get device settings: {}", e))?;

    // Verify user matches
    if current_user != user_id {
        return Ok(false);
    }

    // Parse features
    let features: HashMap<String, bool> = serde_json::from_str(&features_json)
        .unwrap_or_default();

    // Check feature permission
    Ok(*features.get(&feature).unwrap_or(&false))
}

/// Get user's device preference
#[tauri::command]
pub async fn get_user_device_preference(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<Option<UserDevicePreference>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let result = db
        .query_row(
            "SELECT user_id, user_role, preferred_device_mode, last_login_at, login_count
             FROM user_device_preferences
             WHERE user_id = ?1",
            params![&user_id],
            |row| {
                Ok(UserDevicePreference {
                    user_id: row.get(0)?,
                    user_role: row.get(1)?,
                    preferred_device_mode: row.get(2)?,
                    last_login_at: row.get(3)?,
                    login_count: row.get(4)?,
                })
            },
        )
        .ok();

    Ok(result)
}

/// Set user's preferred device mode with timestamp-based conflict resolution
#[tauri::command]
pub async fn set_user_device_preference(
    app: tauri::AppHandle,
    user_id: String,
    user_role: String,
    preferred_mode: String,
) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Validate mode
    if !["pos", "kds", "bds", "server", "mobile"].contains(&preferred_mode.as_str()) {
        return Err("Invalid device mode".to_string());
    }

    db.execute(
        "INSERT INTO user_device_preferences (user_id, user_role, preferred_device_mode)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(user_id) DO UPDATE SET
             preferred_device_mode = ?3,
             updated_at = unixepoch()",
        params![&user_id, &user_role, &preferred_mode],
    )
    .map_err(|e| format!("Failed to set preference: {}", e))?;

    Ok(())
}

/// Record user logout with idle timeout support
#[tauri::command]
pub async fn record_user_logout(
    app: tauri::AppHandle,
    user_id: String,
    reason: Option<String>, // "manual" | "timeout" | "forced"
) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let mut db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let tx = db.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Update the most recent login record for this user
    tx.execute(
        "UPDATE device_login_history
         SET logout_timestamp = unixepoch()
         WHERE user_id = ?1 AND logout_timestamp IS NULL
         ORDER BY login_timestamp DESC
         LIMIT 1",
        params![&user_id],
    )
    .map_err(|e| format!("Failed to record logout: {}", e))?;

    // Clear current user from device settings
    tx.execute(
        "UPDATE device_settings
         SET current_user_id = NULL,
             current_user_role = NULL,
             updated_at = unixepoch()
         WHERE id = 1",
        [],
    )
    .map_err(|e| format!("Failed to clear user: {}", e))?;

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    // Emit event for UI
    app.emit("user-logged-out", serde_json::json!({
        "userId": user_id,
        "reason": reason.unwrap_or_else(|| "manual".to_string())
    }))
    .ok();

    Ok(())
}

/// Toggle auto-adapt mode
#[tauri::command]
pub async fn set_auto_adapt_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE device_settings SET auto_adapt_mode = ?1, updated_at = unixepoch() WHERE id = 1",
        params![if enabled { 1 } else { 0 }],
    )
    .map_err(|e| format!("Failed to set auto-adapt: {}", e))?;

    Ok(())
}

/// Get device login history with pagination
#[tauri::command]
pub async fn get_device_login_history(
    app: tauri::AppHandle,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let mut stmt = db
        .prepare(
            "SELECT device_id, user_id, user_role, device_mode_before, device_mode_after,
                    login_timestamp, logout_timestamp
             FROM device_login_history
             ORDER BY login_timestamp DESC
             LIMIT ?1 OFFSET ?2"
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map(params![limit, offset], |row| {
            Ok(serde_json::json!({
                "deviceId": row.get::<_, String>(0)?,
                "userId": row.get::<_, String>(1)?,
                "userRole": row.get::<_, String>(2)?,
                "deviceModeBefore": row.get::<_, Option<String>>(3)?,
                "deviceModeAfter": row.get::<_, Option<String>>(4)?,
                "loginTimestamp": row.get::<_, i64>(5)?,
                "logoutTimestamp": row.get::<_, Option<i64>>(6)?,
            }))
        })
        .map_err(|e| format!("Failed to query history: {}", e))?;

    let mut history = Vec::new();
    for row in rows {
        history.push(row.map_err(|e| format!("Failed to read row: {}", e))?);
    }

    Ok(history)
}

/// Check for idle session and trigger logout if needed
#[tauri::command]
pub async fn check_idle_timeout(
    app: tauri::AppHandle,
    timeout_minutes: i64,
) -> Result<bool, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Get current user and last activity
    let result = db
        .query_row(
            "SELECT current_user_id, updated_at FROM device_settings WHERE id = 1",
            [],
            |row| {
                let user_id: Option<String> = row.get(0)?;
                let updated_at: i64 = row.get(1)?;
                Ok((user_id, updated_at))
            },
        )
        .ok();

    if let Some((Some(user_id), updated_at)) = result {
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let idle_time_minutes = (current_time - updated_at) / 60;

        if idle_time_minutes >= timeout_minutes {
            // Trigger logout due to idle timeout
            record_user_logout(app, user_id, Some("timeout".to_string())).await?;
            return Ok(true); // Session timed out
        }
    }

    Ok(false) // Still active
}

/// Update last activity timestamp (called on user interaction)
#[tauri::command]
pub async fn update_last_activity(app: tauri::AppHandle) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE device_settings SET updated_at = unixepoch() WHERE id = 1",
        [],
    )
    .map_err(|e| format!("Failed to update activity: {}", e))?;

    Ok(())
}
