use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct UserDevicePreference {
    pub user_id: String,
    pub user_role: String,
    pub preferred_device_mode: String,
    pub last_login_at: Option<i64>,
    pub login_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceAdaptationResult {
    pub previous_mode: String,
    pub new_mode: String,
    pub features_updated: HashMap<String, bool>,
    pub user_preference_applied: bool,
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

/// Determine features based on device mode and user role
fn determine_features(device_mode: &str, user_role: &str) -> HashMap<String, bool> {
    let mut features = HashMap::new();

    match (device_mode, user_role.to_lowercase().as_str()) {
        // POS mode - role-based features
        ("pos", "owner") | ("pos", "manager") => {
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
        ("pos", "captain") => {
            features.insert("pos.takeOrders".to_string(), true);
            features.insert("pos.applyDiscounts".to_string(), true);
            features.insert("pos.voidOrders".to_string(), false);
            features.insert("pos.viewReports".to_string(), false);
            features.insert("team.viewAssignments".to_string(), true);
            features.insert("team.overseeService".to_string(), true);
            features.insert("admin.settings".to_string(), false);
        }
        ("pos", "service") => {
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

/// Configure device for a specific user
#[tauri::command]
pub async fn configure_device_for_user(
    app: tauri::AppHandle,
    user_id: String,
    user_role: String,
) -> Result<DeviceAdaptationResult, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Get current device settings
    let current_mode: String = db
        .query_row(
            "SELECT device_mode FROM device_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get current mode: {}", e))?;

    // Check if auto-adapt is enabled and device is not locked
    let (auto_adapt, locked_mode): (bool, bool) = db
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
    let user_preference = db
        .query_row(
            "SELECT preferred_device_mode FROM user_device_preferences WHERE user_id = ?1",
            params![&user_id],
            |row| row.get::<_, String>(0),
        )
        .ok();

    // Determine the best device mode for this user
    let new_mode = determine_device_mode(&user_role, user_preference.clone());

    // Determine features based on mode and role
    let features = determine_features(&new_mode, &user_role);
    let features_json = serde_json::to_string(&features).unwrap_or_else(|_| "{}".to_string());

    // Update device settings
    db.execute(
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

    // Update or create user device preference
    db.execute(
        "INSERT INTO user_device_preferences (user_id, user_role, preferred_device_mode, last_login_at, login_count)
         VALUES (?1, ?2, ?3, unixepoch(), 1)
         ON CONFLICT(user_id) DO UPDATE SET
             user_role = ?2,
             last_login_at = unixepoch(),
             login_count = login_count + 1,
             updated_at = unixepoch()",
        params![&user_id, &user_role, &new_mode],
    )
    .map_err(|e| format!("Failed to update user preference: {}", e))?;

    // Get device_id for login history
    let device_id: String = db
        .query_row(
            "SELECT device_id FROM device_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "unknown".to_string());

    // Record login in history
    db.execute(
        "INSERT INTO device_login_history (device_id, user_id, user_role, device_mode_before, device_mode_after)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&device_id, &user_id, &user_role, &current_mode, &new_mode],
    )
    .ok(); // Don't fail if history recording fails

    Ok(DeviceAdaptationResult {
        previous_mode: current_mode,
        new_mode,
        features_updated: features,
        user_preference_applied: user_preference.is_some(),
    })
}

/// Get user's device preference
#[tauri::command]
pub async fn get_user_device_preference(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<Option<UserDevicePreference>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

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

/// Set user's preferred device mode
#[tauri::command]
pub async fn set_user_device_preference(
    app: tauri::AppHandle,
    user_id: String,
    user_role: String,
    preferred_mode: String,
) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

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

/// Record user logout
#[tauri::command]
pub async fn record_user_logout(app: tauri::AppHandle, user_id: String) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Update the most recent login record for this user
    db.execute(
        "UPDATE device_login_history
         SET logout_timestamp = unixepoch()
         WHERE user_id = ?1 AND logout_timestamp IS NULL
         ORDER BY login_timestamp DESC
         LIMIT 1",
        params![&user_id],
    )
    .map_err(|e| format!("Failed to record logout: {}", e))?;

    // Clear current user from device settings
    db.execute(
        "UPDATE device_settings
         SET current_user_id = NULL,
             current_user_role = NULL,
             updated_at = unixepoch()
         WHERE id = 1",
        [],
    )
    .map_err(|e| format!("Failed to clear user: {}", e))?;

    Ok(())
}

/// Toggle auto-adapt mode
#[tauri::command]
pub async fn set_auto_adapt_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE device_settings SET auto_adapt_mode = ?1, updated_at = unixepoch() WHERE id = 1",
        params![if enabled { 1 } else { 0 }],
    )
    .map_err(|e| format!("Failed to set auto-adapt: {}", e))?;

    Ok(())
}

/// Get device login history
#[tauri::command]
pub async fn get_device_login_history(app: tauri::AppHandle, limit: Option<i64>) -> Result<Vec<serde_json::Value>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let limit = limit.unwrap_or(50);

    let mut stmt = db
        .prepare(
            "SELECT device_id, user_id, user_role, device_mode_before, device_mode_after,
                    login_timestamp, logout_timestamp
             FROM device_login_history
             ORDER BY login_timestamp DESC
             LIMIT ?1"
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map(params![limit], |row| {
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
