/**
 * Restaurant Settings Commands
 * Tauri commands for managing restaurant configuration in SQLite
 */

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RestaurantSettings {
    // Restaurant Type & Scale
    #[serde(default = "default_restaurant_type")]
    pub restaurant_type: String,
    #[serde(default = "default_operational_scale")]
    pub operational_scale: String,

    // Basic Info
    pub name: String,
    #[serde(default)]
    pub owner_name: String,
    pub tagline: Option<String>,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state: String,
    pub pincode: String,
    pub phone: String,
    pub email: Option<String>,
    pub website: Option<String>,

    // Legal/Tax Info
    pub gst_number: Option<String>,
    pub fssai_number: Option<String>,
    pub pan_number: Option<String>,
    pub cin_number: Option<String>,

    // Invoice Settings
    pub invoice_prefix: String,
    pub invoice_start_number: i32,
    pub current_invoice_number: i32,
    pub invoice_terms: Option<String>,
    pub footer_note: Option<String>,

    // Tax Settings
    pub tax_enabled: bool,
    pub cgst_rate: f64,
    pub sgst_rate: f64,
    pub service_charge_rate: f64,
    pub service_charge_enabled: bool,
    pub round_off_enabled: bool,
    pub tax_included_in_price: bool,

    // Print Settings
    pub print_logo: bool,
    pub logo_url: Option<String>,
    pub print_qr_code: bool,
    pub qr_code_url: Option<String>,
    pub paper_width: String,
    pub show_itemwise_tax: bool,

    // POS Workflow Settings
    pub require_staff_pin_for_pos: bool,
    pub filter_tables_by_staff_assignment: bool,
    pub pin_session_timeout_minutes: i32,
    pub theme: String,
    pub activate_online: bool,
    pub enable_inventory_sync: bool,

    // Device Role
    pub device_role: String,

    // Packing Charges
    pub packing_charges_enabled: bool,
    pub packing_charges_by_category: Option<String>, // JSON string
    pub packing_charges_default: f64,
}

fn default_restaurant_type() -> String {
    "full-service".to_string()
}

fn default_operational_scale() -> String {
    "single-location".to_string()
}

/// Get restaurant settings from SQLite
#[tauri::command]
pub fn get_restaurant_settings(app: tauri::AppHandle) -> Result<RestaurantSettings, String> {
    use rusqlite::{Connection, params};

    println!("[settings.rs] ===== get_restaurant_settings called =====");

    // Use the same database path as the plugin migrations
    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            println!("[settings.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join("pos.db");

    println!("[settings.rs] Database path: {:?}", db_path);
    println!("[settings.rs] Database exists: {}", db_path.exists());

    let db = Connection::open(&db_path).map_err(|e| {
        println!("[settings.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    println!("[settings.rs] Database connection opened successfully");

    let query = "SELECT
        restaurant_type, operational_scale,
        name, owner_name, tagline, address_line1, address_line2, city, state, pincode, phone, email, website,
        gst_number, fssai_number, pan_number, cin_number,
        invoice_prefix, invoice_start_number, current_invoice_number, invoice_terms, footer_note,
        tax_enabled, cgst_rate, sgst_rate, service_charge_rate, service_charge_enabled,
        round_off_enabled, tax_included_in_price,
        print_logo, logo_url, print_qr_code, qr_code_url, paper_width, show_itemwise_tax,
        require_staff_pin_for_pos, filter_tables_by_staff_assignment, pin_session_timeout_minutes, theme,
        activate_online, enable_inventory_sync, device_role,
        packing_charges_enabled, packing_charges_by_category, packing_charges_default
    FROM restaurant_settings WHERE id = 1";

    let settings = db.query_row(query, [], |row| {
        Ok(RestaurantSettings {
            restaurant_type: row.get(0).unwrap_or_else(|_| "full-service".to_string()),
            operational_scale: row.get(1).unwrap_or_else(|_| "single-location".to_string()),
            name: row.get(2)?,
            owner_name: row.get(3).unwrap_or_default(), // Handle NULLs gracefully
            tagline: row.get(4)?,
            address_line1: row.get(5)?,
            address_line2: row.get(6)?,
            city: row.get(7)?,
            state: row.get(8)?,
            pincode: row.get(9)?,
            phone: row.get(10)?,
            email: row.get(11)?,
            website: row.get(12)?,

            gst_number: row.get(13)?,
            fssai_number: row.get(14)?,
            pan_number: row.get(15)?,
            cin_number: row.get(16)?,

            invoice_prefix: row.get(17)?,
            invoice_start_number: row.get(18)?,
            current_invoice_number: row.get(19)?,
            invoice_terms: row.get(20)?,
            footer_note: row.get(21)?,

            tax_enabled: row.get(22)?,
            cgst_rate: row.get(23)?,
            sgst_rate: row.get(24)?,
            service_charge_rate: row.get(25)?,
            service_charge_enabled: row.get(26)?,
            round_off_enabled: row.get(27)?,
            tax_included_in_price: row.get(28)?,

            print_logo: row.get(29)?,
            logo_url: row.get(30)?,
            print_qr_code: row.get(31)?,
            qr_code_url: row.get(32)?,
            paper_width: row.get(33)?,
            show_itemwise_tax: row.get(34)?,

            require_staff_pin_for_pos: row.get(35)?,
            filter_tables_by_staff_assignment: row.get(36)?,
            pin_session_timeout_minutes: row.get(37)?,
            theme: row.get(38)?,
            activate_online: row.get(39)?,
            enable_inventory_sync: row.get(40)?,

            device_role: row.get(41)?,

            packing_charges_enabled: row.get(42)?,
            packing_charges_by_category: row.get(43)?,
            packing_charges_default: row.get(44)?,
        })
    }).map_err(|e| {
        println!("[settings.rs] ❌ Failed to query settings: {}", e);
        e.to_string()
    })?;

    println!("[settings.rs] ✅ Settings retrieved successfully");
    println!("[settings.rs] Restaurant name: {}", settings.name);
    println!("[settings.rs] Owner name: {}", settings.owner_name);
    println!("[settings.rs] Address: {}, {}, {}", settings.city, settings.state, settings.pincode);
    println!("[settings.rs] Phone: {}", settings.phone);
    println!("[settings.rs] Tax enabled: {}", settings.tax_enabled);

    Ok(settings)
}

/// Save restaurant settings to SQLite
#[tauri::command]
pub fn save_restaurant_settings(
    app: tauri::AppHandle,
    settings: RestaurantSettings,
) -> Result<(), String> {
    use rusqlite::{Connection, params};

    println!("[settings.rs] ===== save_restaurant_settings called =====");
    println!("[settings.rs] Restaurant name: {}", settings.name);
    println!("[settings.rs] Phone: {}", settings.phone);
    println!("[settings.rs] Address line 1: {}", settings.address_line1);
    println!("[settings.rs] City: {}", settings.city);
    println!("[settings.rs] State: {}", settings.state);
    println!("[settings.rs] Pincode: {}", settings.pincode);

    // Use the same database path as the plugin migrations
    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            println!("[settings.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join("pos.db");

    println!("[settings.rs] Database path: {:?}", db_path);
    println!("[settings.rs] Database exists: {}", db_path.exists());

    let db = Connection::open(&db_path).map_err(|e| {
        println!("[settings.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    println!("[settings.rs] Database connection opened successfully");

    // Check if table exists
    let table_check: Result<i32, _> = db.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='restaurant_settings'",
        [],
        |row| row.get(0)
    );

    match &table_check {
        Ok(count) => {
            let exists = *count > 0;
            println!("[settings.rs] restaurant_settings table exists: {}", exists);
            if !exists {
                println!("[settings.rs] ❌ Table does not exist - migration may not have run");
                return Err("restaurant_settings table does not exist - please restart the app to run migrations".to_string());
            }
        }
        Err(e) => println!("[settings.rs] ⚠️ Cannot check table existence: {}", e)
    }

    // Use INSERT OR REPLACE to ensure row is created/updated
    // This guarantees the row exists even if migration didn't create it
    let query = "INSERT OR REPLACE INTO restaurant_settings (
        id,
        restaurant_type, operational_scale,
        name, owner_name, tagline, address_line1, address_line2, city, state, pincode, phone, email, website,
        gst_number, fssai_number, pan_number, cin_number,
        invoice_prefix, invoice_start_number, current_invoice_number, invoice_terms, footer_note,
        tax_enabled, cgst_rate, sgst_rate, service_charge_rate, service_charge_enabled,
        round_off_enabled, tax_included_in_price,
        print_logo, logo_url, print_qr_code, qr_code_url, paper_width, show_itemwise_tax,
        require_staff_pin_for_pos, filter_tables_by_staff_assignment,
        pin_session_timeout_minutes, theme, activate_online, enable_inventory_sync, device_role,
        packing_charges_enabled, packing_charges_by_category, packing_charges_default
    ) VALUES (
        1,
        ?1, ?2,
        ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
        ?14, ?15, ?16, ?17,
        ?18, ?19, ?20, ?21, ?22,
        ?23, ?24, ?25, ?26, ?27, ?28, ?29,
        ?30, ?31, ?32, ?33, ?34, ?35,
        ?36, ?37, ?38, ?39, ?40, ?41,
        ?42, ?43, ?44, ?45
    )";

    println!("[settings.rs] Executing INSERT OR REPLACE query...");

    let rows_affected = db.execute(query, params![
        settings.restaurant_type,
        settings.operational_scale,
        settings.name,
        settings.owner_name,
        settings.tagline,
        settings.address_line1,
        settings.address_line2,
        settings.city,
        settings.state,
        settings.pincode,
        settings.phone,
        settings.email,
        settings.website,
        settings.gst_number,
        settings.fssai_number,
        settings.pan_number,
        settings.cin_number,
        settings.invoice_prefix,
        settings.invoice_start_number,
        settings.current_invoice_number,
        settings.invoice_terms,
        settings.footer_note,
        settings.tax_enabled,
        settings.cgst_rate,
        settings.sgst_rate,
        settings.service_charge_rate,
        settings.service_charge_enabled,
        settings.round_off_enabled,
        settings.tax_included_in_price,
        settings.print_logo,
        settings.logo_url,
        settings.print_qr_code,
        settings.qr_code_url,
        settings.paper_width,
        settings.show_itemwise_tax,
        settings.require_staff_pin_for_pos,
        settings.filter_tables_by_staff_assignment,
        settings.pin_session_timeout_minutes,
        settings.theme,
        settings.activate_online,
        settings.enable_inventory_sync,
        settings.device_role,
        settings.packing_charges_enabled,
        settings.packing_charges_by_category,
        settings.packing_charges_default,
    ])
    .map_err(|e| {
        println!("[settings.rs] ❌ Query execution failed: {}", e);
        format!("Failed to save settings: {}", e)
    })?;

    println!("[settings.rs] ✅ Query succeeded, rows affected: {}", rows_affected);

    if rows_affected == 0 {
        println!("[settings.rs] ⚠️ WARNING: No rows were affected!");
        return Err("Settings save failed - no rows were affected".to_string());
    }

    println!("[settings.rs] ✅ Settings saved to SQLite successfully");
    Ok(())
}
