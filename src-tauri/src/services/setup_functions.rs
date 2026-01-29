use crate::models::agent_types::*;
use rusqlite::Connection;
use serde_json::{json, Value};

/// Handle function calls from Gemini
/// Routes function calls to appropriate handlers
pub async fn handle_function_call(
    call: FunctionCall,
    tenant_id: &str,
    db_path: &str,
) -> Result<FunctionResponse, String> {
    println!("[SetupFunctions] Handling function call: {}", call.name);

    let result = match call.name.as_str() {
        "show_settings_form" => handle_show_settings_form(call.args).await,
        "navigate_to_page" => handle_navigate_to_page(call.args).await,
        "get_current_setting" => handle_get_current_setting(call.args, db_path).await,
        "update_setting" => handle_update_setting(call.args, tenant_id, db_path).await,
        "toggle_feature" => handle_toggle_feature(call.args, tenant_id, db_path).await,
        "search_settings" => handle_search_settings(call.args).await,
        "save_all_settings" => handle_save_all_settings(tenant_id, db_path).await,
        _ => Err(format!("Unknown function: {}", call.name)),
    };

    match result {
        Ok(response) => Ok(FunctionResponse {
            name: call.name,
            id: call.id,
            response,
        }),
        Err(e) => Ok(FunctionResponse {
            name: call.name,
            id: call.id,
            response: json!({
                "success": false,
                "error": e
            }),
        }),
    }
}

// ============================================================================
// Function Handlers
// ============================================================================

async fn handle_show_settings_form(args: Value) -> Result<Value, String> {
    let category = args
        .get("category")
        .and_then(|v| v.as_str())
        .ok_or("Missing category parameter")?;

    let field = args.get("field").and_then(|v| v.as_str());
    let action = args.get("action").and_then(|v| v.as_str()).unwrap_or("edit");

    println!(
        "[SetupFunctions] Show settings form: category={}, field={:?}, action={}",
        category, field, action
    );

    // Return UI action for frontend to execute
    Ok(json!({
        "success": true,
        "ui_action": {
            "type": "ShowForm",
            "category": category,
            "field": field
        },
        "message": format!(
            "Opening {} settings{}",
            category,
            field.map(|f| format!(" and highlighting {}", f)).unwrap_or_default()
        )
    }))
}

async fn handle_navigate_to_page(args: Value) -> Result<Value, String> {
    let page = args
        .get("page")
        .and_then(|v| v.as_str())
        .ok_or("Missing page parameter")?;

    let subpage = args.get("subpage").and_then(|v| v.as_str());

    println!(
        "[SetupFunctions] Navigate to page: page={}, subpage={:?}",
        page, subpage
    );

    // Map page names to routes
    let route = match page {
        "pos" => "/pos",
        "kitchen" => "/kitchen",
        "inventory" => "/inventory",
        "settings" => "/settings",
        "hub" => "/hub",
        "menu" => "/settings?tab=menu",
        "staff" => "/settings?tab=staff",
        _ => page,
    };

    Ok(json!({
        "success": true,
        "ui_action": {
            "type": "Navigate",
            "page": route,
            "subpage": subpage
        },
        "message": format!("Navigating to {}", page)
    }))
}

async fn handle_get_current_setting(args: Value, db_path: &str) -> Result<Value, String> {
    let field = args
        .get("field")
        .and_then(|v| v.as_str())
        .ok_or("Missing field parameter")?;

    println!("[SetupFunctions] Get current setting: field={}", field);

    // Open database
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Query the setting value
    let value = get_setting_value(&conn, field)?;

    Ok(json!({
        "success": true,
        "field": field,
        "value": value,
        "message": format!("Current value of {} is: {}", field, format_value(&value))
    }))
}

async fn handle_update_setting(
    args: Value,
    _tenant_id: &str,
    db_path: &str,
) -> Result<Value, String> {
    let field = args
        .get("field")
        .and_then(|v| v.as_str())
        .ok_or("Missing field parameter")?;

    let value = args.get("value").ok_or("Missing value parameter")?;
    let confirm = args.get("confirm").and_then(|v| v.as_bool()).unwrap_or(false);

    println!(
        "[SetupFunctions] Update setting: field={}, value={:?}, confirm={}",
        field, value, confirm
    );

    // Validate the field and value
    validate_setting(field, value)?;

    // Open database
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // For critical settings, require confirmation
    if is_critical_setting(field) && !confirm {
        return Ok(json!({
            "success": false,
            "requires_confirmation": true,
            "field": field,
            "new_value": value,
            "message": format!(
                "Changing {} to {} will {}. Please confirm this change.",
                field,
                format_value(value),
                get_impact_message(field)
            )
        }));
    }

    // Update the setting
    update_setting_value(&conn, field, value)?;

    Ok(json!({
        "success": true,
        "field": field,
        "new_value": value,
        "message": format!("Successfully updated {} to {}", field, format_value(value))
    }))
}

async fn handle_toggle_feature(
    args: Value,
    _tenant_id: &str,
    db_path: &str,
) -> Result<Value, String> {
    let feature = args
        .get("feature")
        .and_then(|v| v.as_str())
        .ok_or("Missing feature parameter")?;

    let enabled = args
        .get("enabled")
        .and_then(|v| v.as_bool())
        .ok_or("Missing enabled parameter")?;

    println!(
        "[SetupFunctions] Toggle feature: feature={}, enabled={}",
        feature, enabled
    );

    // Map feature names to database fields
    let field = match feature {
        "tax" => "tax_enabled",
        "service_charge" => "service_charge_enabled",
        "staff_pin" => "require_staff_pin_for_pos",
        "online_features" => "activate_online",
        "inventory" => "inventory_enabled",
        "training_mode" => {
            // Training mode is inverted (activate_online = false means training)
            return handle_training_mode_toggle(enabled, db_path).await;
        }
        _ => return Err(format!("Unknown feature: {}", feature)),
    };

    // Open database
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Update the feature flag
    let query = format!(
        "UPDATE restaurant_settings SET {} = ? WHERE id = 1",
        field
    );

    conn.execute(&query, [enabled])
        .map_err(|e| format!("Failed to update feature: {}", e))?;

    Ok(json!({
        "success": true,
        "feature": feature,
        "enabled": enabled,
        "message": format!(
            "Successfully {} {}",
            if enabled { "enabled" } else { "disabled" },
            feature
        )
    }))
}

async fn handle_search_settings(args: Value) -> Result<Value, String> {
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or("Missing query parameter")?;

    println!("[SetupFunctions] Search settings: query={}", query);

    // Get settings schema and search
    let schema = crate::utils::context_builder::get_settings_schema();
    let query_lower = query.to_lowercase();

    let results: Vec<Value> = schema
        .iter()
        .filter(|setting| {
            setting.field.to_lowercase().contains(&query_lower)
                || setting.description.to_lowercase().contains(&query_lower)
                || setting.category.to_lowercase().contains(&query_lower)
        })
        .take(5) // Limit to top 5 results
        .map(|setting| {
            json!({
                "field": setting.field,
                "description": setting.description,
                "category": setting.category,
                "type": setting.field_type
            })
        })
        .collect();

    Ok(json!({
        "success": true,
        "query": query,
        "results": results,
        "count": results.len(),
        "message": if results.is_empty() {
            format!("No settings found matching '{}'", query)
        } else {
            format!("Found {} setting(s) matching '{}'", results.len(), query)
        }
    }))
}

async fn handle_save_all_settings(_tenant_id: &str, db_path: &str) -> Result<Value, String> {
    println!("[SetupFunctions] Save all settings");

    // In this implementation, settings are saved immediately when updated
    // So this is a no-op, but we return success

    // We could add validation here to ensure database consistency

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Verify database is accessible
    let _count: i32 = conn
        .query_row("SELECT COUNT(*) FROM restaurant_settings", [], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to verify settings: {}", e))?;

    Ok(json!({
        "success": true,
        "message": "All settings are saved and up to date"
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_setting_value(conn: &Connection, field: &str) -> Result<Value, String> {
    // Map field name to SQL query
    let query = format!(
        "SELECT {} FROM restaurant_settings WHERE id = 1",
        field
    );

    conn.query_row(&query, [], |row| {
        // Try to get as different types
        if let Ok(val) = row.get::<_, String>(0) {
            Ok(json!(val))
        } else if let Ok(val) = row.get::<_, f64>(0) {
            Ok(json!(val))
        } else if let Ok(val) = row.get::<_, i64>(0) {
            Ok(json!(val))
        } else if let Ok(val) = row.get::<_, bool>(0) {
            Ok(json!(val))
        } else {
            Ok(Value::Null)
        }
    })
    .map_err(|e| format!("Failed to get setting {}: {}", field, e))
}

fn update_setting_value(conn: &Connection, field: &str, value: &Value) -> Result<(), String> {
    let query = format!(
        "UPDATE restaurant_settings SET {} = ? WHERE id = 1",
        field
    );

    // Handle special case for GST rate (need to split into CGST + SGST)
    if field == "gst_rate" {
        let gst_rate = value
            .as_f64()
            .ok_or("GST rate must be a number")?;

        let cgst_rate = gst_rate / 2.0;
        let sgst_rate = gst_rate / 2.0;

        conn.execute(
            "UPDATE restaurant_settings SET cgst_rate = ?, sgst_rate = ? WHERE id = 1",
            [cgst_rate, sgst_rate],
        )
        .map_err(|e| format!("Failed to update GST rates: {}", e))?;

        return Ok(());
    }

    // Execute update based on value type
    if let Some(s) = value.as_str() {
        conn.execute(&query, [s])
    } else if let Some(n) = value.as_f64() {
        conn.execute(&query, [n])
    } else if let Some(b) = value.as_bool() {
        conn.execute(&query, [b])
    } else if let Some(i) = value.as_i64() {
        conn.execute(&query, [i])
    } else {
        return Err("Unsupported value type".to_string());
    }
    .map_err(|e| format!("Failed to update setting {}: {}", field, e))?;

    Ok(())
}

fn validate_setting(field: &str, value: &Value) -> Result<(), String> {
    let schema = crate::utils::context_builder::get_settings_schema();

    // Find field in schema
    let field_schema = schema
        .iter()
        .find(|s| s.field == field)
        .ok_or_else(|| format!("Unknown setting field: {}", field))?;

    // Validate type
    match field_schema.field_type.as_str() {
        "string" => {
            if !value.is_string() {
                return Err(format!("{} must be a string", field));
            }
        }
        "number" => {
            if !value.is_number() {
                return Err(format!("{} must be a number", field));
            }

            // Check constraints
            if let Some(constraints) = &field_schema.constraints {
                if let Some(num) = value.as_f64() {
                    if let Some(min) = constraints.min {
                        if num < min {
                            return Err(format!("{} must be at least {}", field, min));
                        }
                    }
                    if let Some(max) = constraints.max {
                        if num > max {
                            return Err(format!("{} must be at most {}", field, max));
                        }
                    }
                }
            }
        }
        "boolean" => {
            if !value.is_boolean() {
                return Err(format!("{} must be true or false", field));
            }
        }
        _ => {}
    }

    // Check options if defined
    if let Some(constraints) = &field_schema.constraints {
        if let Some(options) = &constraints.options {
            if let Some(val_str) = value.as_str() {
                if !options.contains(&val_str.to_string()) {
                    return Err(format!(
                        "{} must be one of: {}",
                        field,
                        options.join(", ")
                    ));
                }
            }
        }
    }

    Ok(())
}

fn is_critical_setting(field: &str) -> bool {
    matches!(
        field,
        "gst_rate" | "cgst_rate" | "sgst_rate" | "activate_online" | "tax_enabled"
    )
}

fn get_impact_message(field: &str) -> &'static str {
    match field {
        "gst_rate" | "cgst_rate" | "sgst_rate" => "affect all future invoices and tax calculations",
        "activate_online" => "enable/disable cloud sync and online ordering features",
        "tax_enabled" => "change how bills are calculated",
        _ => "change system behavior",
    }
}

fn format_value(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => if *b { "enabled" } else { "disabled" }.to_string(),
        Value::Null => "not set".to_string(),
        _ => value.to_string(),
    }
}

async fn handle_training_mode_toggle(enabled: bool, db_path: &str) -> Result<Value, String> {
    // Training mode is enabled when activate_online is FALSE
    let activate_online = !enabled;

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute(
        "UPDATE restaurant_settings SET activate_online = ? WHERE id = 1",
        [activate_online],
    )
    .map_err(|e| format!("Failed to toggle training mode: {}", e))?;

    Ok(json!({
        "success": true,
        "feature": "training_mode",
        "enabled": enabled,
        "message": if enabled {
            "Switched to training mode. Online features are now disabled."
        } else {
            "Going live! Online features are now enabled."
        }
    }))
}
