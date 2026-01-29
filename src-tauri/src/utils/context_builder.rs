use crate::models::agent_types::*;
use rusqlite::{Connection, Result as SqlResult};
use serde_json::json;

/// Build tenant context from SQLite database
pub async fn build_tenant_context(
    _tenant_id: &str,
    db_path: &str,
) -> Result<TenantContext, String> {
    // Open database connection
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Load restaurant settings
    let restaurant_info = load_restaurant_info(&conn)?;

    // Load menu statistics
    let menu_stats = load_menu_stats(&conn)?;

    // Load current user info (for now, use admin as default)
    let user_info = UserInfo {
        name: "Admin".to_string(),
        role: "Owner".to_string(),
        is_admin: true,
    };

    // Load current settings values
    let current_values = load_current_settings(&conn)?;

    Ok(TenantContext {
        restaurant: restaurant_info,
        settings_schema: get_settings_schema(),
        current_values,
        menu_stats,
        user: user_info,
    })
}

/// Load restaurant basic information
fn load_restaurant_info(conn: &Connection) -> Result<RestaurantInfo, String> {
    let query = "SELECT name, restaurant_type, activate_online FROM restaurant_settings LIMIT 1";

    match conn.query_row(query, [], |row| {
        let name: String = row.get(0).unwrap_or_else(|_| "My Restaurant".to_string());
        let restaurant_type: String = row.get(1).unwrap_or_else(|_| "Quick Service".to_string());
        let activate_online: bool = row.get(2).unwrap_or(false);

        Ok(RestaurantInfo {
            name,
            restaurant_type,
            current_mode: if activate_online { "live".to_string() } else { "training".to_string() },
        })
    }) {
        Ok(info) => Ok(info),
        Err(e) => {
            // If table doesn't exist or query fails, return defaults
            eprintln!("Warning: Failed to load restaurant info: {}", e);
            Ok(RestaurantInfo {
                name: "My Restaurant".to_string(),
                restaurant_type: "Quick Service".to_string(),
                current_mode: "training".to_string(),
            })
        }
    }
}

/// Load menu statistics
fn load_menu_stats(conn: &Connection) -> Result<MenuStats, String> {
    // Count menu items
    let total_items: u32 = conn
        .query_row("SELECT COUNT(*) FROM menu_items", [], |row| row.get(0))
        .unwrap_or(0);

    // Count categories
    let total_categories: u32 = conn
        .query_row("SELECT COUNT(DISTINCT category) FROM menu_items", [], |row| row.get(0))
        .unwrap_or(0);

    // Check if there are any specials
    let has_specials: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM menu_items WHERE is_special = 1)",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    Ok(MenuStats {
        total_items,
        total_categories,
        has_specials,
    })
}

/// Load current settings values from database
fn load_current_settings(conn: &Connection) -> Result<serde_json::Value, String> {
    let query = r#"
        SELECT
            name,
            owner_name,
            phone,
            email,
            address,
            city,
            pincode,
            gst_number,
            fssai_number,
            cgst_rate,
            sgst_rate,
            service_charge_enabled,
            service_charge_rate,
            tax_enabled,
            round_off_enabled,
            invoice_prefix,
            restaurant_type,
            activate_online
        FROM restaurant_settings
        LIMIT 1
    "#;

    match conn.query_row(query, [], |row| {
        let cgst_rate: f64 = row.get(9).unwrap_or(2.5);
        let sgst_rate: f64 = row.get(10).unwrap_or(2.5);

        Ok(json!({
            "name": row.get::<_, String>(0).unwrap_or_default(),
            "owner_name": row.get::<_, String>(1).unwrap_or_default(),
            "phone": row.get::<_, String>(2).unwrap_or_default(),
            "email": row.get::<_, String>(3).unwrap_or_default(),
            "address": row.get::<_, String>(4).unwrap_or_default(),
            "city": row.get::<_, String>(5).unwrap_or_default(),
            "pincode": row.get::<_, String>(6).unwrap_or_default(),
            "gst_number": row.get::<_, String>(7).unwrap_or_default(),
            "fssai_number": row.get::<_, String>(8).unwrap_or_default(),
            "gst_rate": cgst_rate + sgst_rate,
            "cgst_rate": cgst_rate,
            "sgst_rate": sgst_rate,
            "service_charge_enabled": row.get::<_, bool>(11).unwrap_or(false),
            "service_charge_rate": row.get::<_, f64>(12).unwrap_or(0.0),
            "tax_enabled": row.get::<_, bool>(13).unwrap_or(false),
            "round_off_enabled": row.get::<_, bool>(14).unwrap_or(false),
            "invoice_prefix": row.get::<_, String>(15).unwrap_or_default(),
            "restaurant_type": row.get::<_, String>(16).unwrap_or_default(),
            "activate_online": row.get::<_, bool>(17).unwrap_or(false),
        }))
    }) {
        Ok(settings) => Ok(settings),
        Err(e) => {
            eprintln!("Warning: Failed to load settings: {}", e);
            Ok(json!({
                "name": "My Restaurant",
                "gst_rate": 5.0,
                "service_charge_enabled": false,
                "tax_enabled": false
            }))
        }
    }
}

/// Get complete settings schema with all field definitions
pub fn get_settings_schema() -> Vec<SettingFieldSchema> {
    vec![
        // Restaurant Information
        SettingFieldSchema {
            field: "name".to_string(),
            field_type: "string".to_string(),
            description: "Restaurant name".to_string(),
            category: "restaurant".to_string(),
            editable: true,
            constraints: Some(FieldConstraints {
                min: None,
                max: None,
                options: None,
                required: true,
            }),
        },
        SettingFieldSchema {
            field: "owner_name".to_string(),
            field_type: "string".to_string(),
            description: "Owner name".to_string(),
            category: "restaurant".to_string(),
            editable: true,
            constraints: None,
        },
        SettingFieldSchema {
            field: "phone".to_string(),
            field_type: "string".to_string(),
            description: "Contact phone number".to_string(),
            category: "restaurant".to_string(),
            editable: true,
            constraints: None,
        },
        SettingFieldSchema {
            field: "email".to_string(),
            field_type: "string".to_string(),
            description: "Contact email address".to_string(),
            category: "restaurant".to_string(),
            editable: true,
            constraints: None,
        },
        SettingFieldSchema {
            field: "address".to_string(),
            field_type: "string".to_string(),
            description: "Restaurant address".to_string(),
            category: "restaurant".to_string(),
            editable: true,
            constraints: None,
        },

        // Tax Settings
        SettingFieldSchema {
            field: "gst_rate".to_string(),
            field_type: "number".to_string(),
            description: "Combined GST rate (CGST + SGST) in percentage".to_string(),
            category: "tax".to_string(),
            editable: true,
            constraints: Some(FieldConstraints {
                min: Some(0.0),
                max: Some(28.0),
                options: None,
                required: false,
            }),
        },
        SettingFieldSchema {
            field: "cgst_rate".to_string(),
            field_type: "number".to_string(),
            description: "CGST rate in percentage (half of total GST)".to_string(),
            category: "tax".to_string(),
            editable: true,
            constraints: Some(FieldConstraints {
                min: Some(0.0),
                max: Some(14.0),
                options: None,
                required: false,
            }),
        },
        SettingFieldSchema {
            field: "sgst_rate".to_string(),
            field_type: "number".to_string(),
            description: "SGST rate in percentage (half of total GST)".to_string(),
            category: "tax".to_string(),
            editable: true,
            constraints: Some(FieldConstraints {
                min: Some(0.0),
                max: Some(14.0),
                options: None,
                required: false,
            }),
        },
        SettingFieldSchema {
            field: "tax_enabled".to_string(),
            field_type: "boolean".to_string(),
            description: "Enable tax calculation on bills".to_string(),
            category: "tax".to_string(),
            editable: true,
            constraints: None,
        },
        SettingFieldSchema {
            field: "service_charge_enabled".to_string(),
            field_type: "boolean".to_string(),
            description: "Enable service charge on bills".to_string(),
            category: "tax".to_string(),
            editable: true,
            constraints: None,
        },
        SettingFieldSchema {
            field: "service_charge_rate".to_string(),
            field_type: "number".to_string(),
            description: "Service charge rate in percentage".to_string(),
            category: "tax".to_string(),
            editable: true,
            constraints: Some(FieldConstraints {
                min: Some(0.0),
                max: Some(25.0),
                options: None,
                required: false,
            }),
        },
        SettingFieldSchema {
            field: "round_off_enabled".to_string(),
            field_type: "boolean".to_string(),
            description: "Round off bill total to nearest rupee".to_string(),
            category: "tax".to_string(),
            editable: true,
            constraints: None,
        },

        // Legal & Compliance
        SettingFieldSchema {
            field: "gst_number".to_string(),
            field_type: "string".to_string(),
            description: "GST registration number (15 characters)".to_string(),
            category: "restaurant".to_string(),
            editable: true,
            constraints: None,
        },
        SettingFieldSchema {
            field: "fssai_number".to_string(),
            field_type: "string".to_string(),
            description: "FSSAI license number (14 digits)".to_string(),
            category: "restaurant".to_string(),
            editable: true,
            constraints: None,
        },

        // Invoice Settings
        SettingFieldSchema {
            field: "invoice_prefix".to_string(),
            field_type: "string".to_string(),
            description: "Prefix for invoice numbers (e.g., INV, BILL)".to_string(),
            category: "pos_workflow".to_string(),
            editable: true,
            constraints: None,
        },

        // POS Workflow
        SettingFieldSchema {
            field: "activate_online".to_string(),
            field_type: "boolean".to_string(),
            description: "Enable online features (cloud sync, aggregator orders)".to_string(),
            category: "pos_workflow".to_string(),
            editable: true,
            constraints: None,
        },
        SettingFieldSchema {
            field: "restaurant_type".to_string(),
            field_type: "string".to_string(),
            description: "Type of restaurant (Quick Service, Fine Dining, Cafe, Bar, Cloud Kitchen)".to_string(),
            category: "restaurant".to_string(),
            editable: true,
            constraints: Some(FieldConstraints {
                min: None,
                max: None,
                options: Some(vec![
                    "Quick Service".to_string(),
                    "Fine Dining".to_string(),
                    "Cafe".to_string(),
                    "Bar".to_string(),
                    "Cloud Kitchen".to_string(),
                ]),
                required: false,
            }),
        },
    ]
}

/// Format settings summary for system prompt
pub fn format_settings_summary(context: &TenantContext) -> String {
    let settings = &context.current_values;

    format!(
        r#"**Restaurant Details:**
- Name: {}
- Type: {}
- Mode: {}
- Phone: {}
- GST Number: {}

**Tax Configuration:**
- Tax Enabled: {}
- GST Rate: {}%
- Service Charge: {} ({}%)
- Round Off: {}

**Menu Statistics:**
- Total Items: {}
- Categories: {}
- Has Specials: {}"#,
        settings.get("name").and_then(|v| v.as_str()).unwrap_or("Not set"),
        context.restaurant.restaurant_type,
        context.restaurant.current_mode,
        settings.get("phone").and_then(|v| v.as_str()).unwrap_or("Not set"),
        settings.get("gst_number").and_then(|v| v.as_str()).unwrap_or("Not set"),
        settings.get("tax_enabled").and_then(|v| v.as_bool()).unwrap_or(false),
        settings.get("gst_rate").and_then(|v| v.as_f64()).unwrap_or(0.0),
        if settings.get("service_charge_enabled").and_then(|v| v.as_bool()).unwrap_or(false) { "Enabled" } else { "Disabled" },
        settings.get("service_charge_rate").and_then(|v| v.as_f64()).unwrap_or(0.0),
        if settings.get("round_off_enabled").and_then(|v| v.as_bool()).unwrap_or(false) { "Yes" } else { "No" },
        context.menu_stats.total_items,
        context.menu_stats.total_categories,
        if context.menu_stats.has_specials { "Yes" } else { "No" }
    )
}
