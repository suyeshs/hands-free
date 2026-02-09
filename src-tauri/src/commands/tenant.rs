/**
 * Tenant Configuration Commands
 * Tauri commands for managing tenant activation data in SQLite
 */

use serde::{Deserialize, Serialize};
use rusqlite::{Connection, params};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TenantTheme {
    pub primary_color: String,
    pub secondary_color: Option<String>,
    pub logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TenantConfig {
    pub tenant_id: String,
    pub company_name: String,
    pub subdomain: String,
    pub api_base_url: String,
    pub orders_endpoint: String,
    pub menu_endpoint: String,
    pub theme: TenantTheme,
    pub currency: String,
    pub timezone: String,
    pub activated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub d1_database_id: Option<String>,
}

/// Save tenant configuration to SQLite
#[tauri::command]
pub fn save_tenant_config(
    app: tauri::AppHandle,
    config: TenantConfig,
) -> Result<(), String> {
    // println!("[tenant.rs] ===== save_tenant_config called =====");
    // println!("[tenant.rs] Tenant ID: {}", config.tenant_id);
    // println!("[tenant.rs] Company: {}", config.company_name);

    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            // println!("[tenant.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join(crate::get_db_filename());

    // println!("[tenant.rs] Database path: {:?}", db_path);

    let db = Connection::open(&db_path).map_err(|e| {
        // println!("[tenant.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    // println!("[tenant.rs] Database connection opened successfully");

    // Note: tenant_config table and d1_database_id column are created by core migrations in lib.rs
    // No runtime schema changes needed here

    // Insert or replace tenant config (only one row allowed)
    db.execute(
        "INSERT OR REPLACE INTO tenant_config (
            id, tenant_id, company_name, subdomain,
            api_base_url, orders_endpoint, menu_endpoint,
            primary_color, secondary_color, logo_url,
            currency, timezone, activated_at, d1_database_id
        ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            config.tenant_id,
            config.company_name,
            config.subdomain,
            config.api_base_url,
            config.orders_endpoint,
            config.menu_endpoint,
            config.theme.primary_color,
            config.theme.secondary_color,
            config.theme.logo_url,
            config.currency,
            config.timezone,
            config.activated_at,
            config.d1_database_id,
        ],
    ).map_err(|e| {
        // println!("[tenant.rs] ❌ Failed to save tenant config: {}", e);
        e.to_string()
    })?;

    // println!("[tenant.rs] ✅ Tenant config saved successfully");
    Ok(())
}

/// Get tenant configuration from SQLite
#[tauri::command]
pub fn get_tenant_config(app: tauri::AppHandle) -> Result<Option<TenantConfig>, String> {
    // println!("[tenant.rs] ===== get_tenant_config called =====");

    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            // println!("[tenant.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join(crate::get_db_filename());

    // println!("[tenant.rs] Database path: {:?}", db_path);

    if !db_path.exists() {
        // println!("[tenant.rs] ℹ️  Database does not exist yet");
        return Ok(None);
    }

    let db = Connection::open(&db_path).map_err(|e| {
        // println!("[tenant.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    // println!("[tenant.rs] Database connection opened successfully");

    // Check if d1_database_id column exists
    let has_d1_column = db.query_row(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='tenant_config'",
        [],
        |row| {
            let schema: String = row.get(0)?;
            Ok(schema.contains("d1_database_id"))
        }
    ).unwrap_or(false);

    // Build query based on column existence
    let query = if has_d1_column {
        "SELECT tenant_id, company_name, subdomain, api_base_url, orders_endpoint, menu_endpoint,
                primary_color, secondary_color, logo_url, currency, timezone, activated_at, d1_database_id
         FROM tenant_config WHERE id = 1"
    } else {
        // println!("[tenant.rs] ⚠️  d1_database_id column not found, querying without it");
        "SELECT tenant_id, company_name, subdomain, api_base_url, orders_endpoint, menu_endpoint,
                primary_color, secondary_color, logo_url, currency, timezone, activated_at
         FROM tenant_config WHERE id = 1"
    };

    let mut stmt = db.prepare(query).map_err(|e| {
        // println!("[tenant.rs] ❌ Failed to prepare query: {}", e);
        e.to_string()
    })?;

    let config = stmt.query_row([], |row| {
        Ok(TenantConfig {
            tenant_id: row.get(0)?,
            company_name: row.get(1)?,
            subdomain: row.get(2)?,
            api_base_url: row.get(3)?,
            orders_endpoint: row.get(4)?,
            menu_endpoint: row.get(5)?,
            theme: TenantTheme {
                primary_color: row.get(6)?,
                secondary_color: row.get(7)?,
                logo_url: row.get(8)?,
            },
            currency: row.get(9)?,
            timezone: row.get(10)?,
            activated_at: row.get(11)?,
            d1_database_id: if has_d1_column { row.get(12).ok() } else { None },
        })
    });

    match config {
        Ok(config) => {
            // println!("[tenant.rs] ✅ Tenant config retrieved successfully");
            // println!("[tenant.rs] Tenant ID: {}", config.tenant_id);
            // println!("[tenant.rs] Company: {}", config.company_name);
            Ok(Some(config))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // println!("[tenant.rs] ℹ️  No tenant config found (not activated)");
            Ok(None)
        }
        Err(e) => {
            // println!("[tenant.rs] ❌ Failed to retrieve tenant config: {}", e);
            Err(e.to_string())
        }
    }
}

/// Clear tenant configuration (for deactivation/reset)
#[tauri::command]
pub fn clear_tenant_config(app: tauri::AppHandle) -> Result<(), String> {
    // println!("[tenant.rs] ===== clear_tenant_config called =====");

    let db_path = app.path().app_data_dir()
        .map_err(|e| {
            // println!("[tenant.rs] ❌ Failed to get app_data_dir: {}", e);
            e.to_string()
        })?
        .join(crate::get_db_filename());

    if !db_path.exists() {
        // println!("[tenant.rs] ℹ️  Database does not exist, nothing to clear");
        return Ok(());
    }

    let db = Connection::open(&db_path).map_err(|e| {
        // println!("[tenant.rs] ❌ Failed to open database: {}", e);
        e.to_string()
    })?;

    db.execute("DELETE FROM tenant_config WHERE id = 1", [])
        .map_err(|e| {
            // println!("[tenant.rs] ❌ Failed to clear tenant config: {}", e);
            e.to_string()
        })?;

    // println!("[tenant.rs] ✅ Tenant config cleared successfully");
    Ok(())
}

// Migration function removed - all core migrations now run in lib.rs on app startup
