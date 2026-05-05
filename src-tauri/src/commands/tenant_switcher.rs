/**
 * Tenant Switcher Commands
 * Tauri commands for switching between master and location tenants
 */

use serde::{Deserialize, Serialize};
use rusqlite::{Connection, params};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TenantInfo {
    pub tenant_id: String,
    pub tenant_name: String,
    pub tenant_type: String, // 'master' or 'location'
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subdomain: Option<String>,
    pub is_active: bool,
}

/// Get list of accessible tenants (master + locations)
#[tauri::command]
pub fn get_accessible_tenants(app: tauri::AppHandle) -> Result<Vec<TenantInfo>, String> {
    println!("[TenantSwitcher] Getting accessible tenants...");

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut tenants = Vec::new();

    // Get master tenant info
    let master = conn.query_row(
        "SELECT name, subdomain FROM restaurant_settings WHERE id = 1",
        [],
        |row| {
            let name: String = row.get(0)?;
            let subdomain: Option<String> = row.get(1).ok();
            Ok((name, subdomain))
        },
    );

    if let Ok((master_name, master_subdomain)) = master {
        // Get master tenant_id from tenant_config if it exists
        let master_tenant_id = conn.query_row(
            "SELECT tenant_id FROM tenant_config WHERE id = 1",
            [],
            |row| row.get::<_, String>(0),
        ).unwrap_or_else(|_| "master".to_string());

        tenants.push(TenantInfo {
            tenant_id: master_tenant_id.clone(),
            tenant_name: format!("{} (Master)", master_name),
            tenant_type: "master".to_string(),
            location_id: None,
            subdomain: master_subdomain,
            is_active: true,
        });

        println!("[TenantSwitcher] Master tenant: {}", master_tenant_id);
    }

    // Get all location tenants
    let mut stmt = conn.prepare(
        "SELECT location_id, location_tenant_id, location_name, subdomain
         FROM location_tenants
         WHERE is_accessible = 1
         ORDER BY location_name"
    ).map_err(|e| e.to_string())?;

    let location_iter = stmt.query_map([], |row| {
        Ok(TenantInfo {
            tenant_id: row.get(1)?,
            tenant_name: row.get(2)?,
            tenant_type: "location".to_string(),
            location_id: Some(row.get(0)?),
            subdomain: row.get(3).ok(),
            is_active: true,
        })
    }).map_err(|e| e.to_string())?;

    for location in location_iter {
        if let Ok(loc) = location {
            tenants.push(loc);
        }
    }

    println!("[TenantSwitcher] Found {} total tenants (1 master + {} locations)",
             tenants.len(), tenants.len() - 1);

    Ok(tenants)
}

/// Get current tenant context
#[tauri::command]
pub fn get_current_tenant_context(app: tauri::AppHandle) -> Result<TenantInfo, String> {
    println!("[TenantSwitcher] Getting current tenant context...");

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Check if there's a tenant_context table
    let has_context = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tenant_context'",
        [],
        |row| row.get::<_, i64>(0),
    ).unwrap_or(0) > 0;

    if has_context {
        // Try to get from tenant_context table
        let result = conn.query_row(
            "SELECT current_tenant_id, current_tenant_type FROM tenant_context WHERE id = 1",
            [],
            |row| {
                let tenant_id: String = row.get(0)?;
                let tenant_type: String = row.get(1)?;
                Ok((tenant_id, tenant_type))
            },
        );

        if let Ok((tenant_id, tenant_type)) = result {
            // Get tenant details
            if tenant_type == "master" {
                let name = conn.query_row(
                    "SELECT name FROM restaurant_settings WHERE id = 1",
                    [],
                    |row| row.get::<_, String>(0),
                ).unwrap_or_else(|_| "Master".to_string());

                return Ok(TenantInfo {
                    tenant_id,
                    tenant_name: format!("{} (Master)", name),
                    tenant_type,
                    location_id: None,
                    subdomain: None,
                    is_active: true,
                });
            } else {
                // Location tenant
                let location = conn.query_row(
                    "SELECT location_id, location_name, subdomain
                     FROM location_tenants
                     WHERE location_tenant_id = ?1",
                    [&tenant_id],
                    |row| {
                        Ok(TenantInfo {
                            tenant_id: tenant_id.clone(),
                            tenant_name: row.get(1)?,
                            tenant_type: "location".to_string(),
                            location_id: Some(row.get(0)?),
                            subdomain: row.get(2).ok(),
                            is_active: true,
                        })
                    },
                ).map_err(|e| e.to_string())?;

                return Ok(location);
            }
        }
    }

    // Default: assume master tenant
    let name = conn.query_row(
        "SELECT name FROM restaurant_settings WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    ).unwrap_or_else(|_| "Master".to_string());

    let tenant_id = conn.query_row(
        "SELECT tenant_id FROM tenant_config WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    ).unwrap_or_else(|_| "master".to_string());

    println!("[TenantSwitcher] No context found, defaulting to master: {}", tenant_id);

    Ok(TenantInfo {
        tenant_id,
        tenant_name: format!("{} (Master)", name),
        tenant_type: "master".to_string(),
        location_id: None,
        subdomain: None,
        is_active: true,
    })
}

/// Switch to a different tenant
#[tauri::command]
pub async fn switch_tenant(
    app: tauri::AppHandle,
    tenant_id: String,
    tenant_type: String,
) -> Result<(), String> {
    println!("[TenantSwitcher] Switching to tenant: {} ({})", tenant_id, tenant_type);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Create tenant_context table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tenant_context (
            id INTEGER PRIMARY KEY DEFAULT 1,
            current_tenant_id TEXT NOT NULL,
            current_tenant_type TEXT NOT NULL,
            switched_at TEXT DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| e.to_string())?;

    // Update or insert tenant context
    conn.execute(
        "INSERT OR REPLACE INTO tenant_context (id, current_tenant_id, current_tenant_type, switched_at)
         VALUES (1, ?1, ?2, CURRENT_TIMESTAMP)",
        params![tenant_id, tenant_type],
    ).map_err(|e| e.to_string())?;

    println!("[TenantSwitcher] Tenant context updated successfully");

    // Auto-configure chain sync for location tenants
    if tenant_type == "location" {
        println!("[TenantSwitcher] Auto-configuring chain sync for location tenant...");

        // Get location metadata from location_tenants table
        let location_result = conn.query_row(
            "SELECT chain_id, location_name FROM location_tenants WHERE location_tenant_id = ?1",
            [&tenant_id],
            |row| {
                let chain_id: String = row.get(0)?;
                let location_name: String = row.get(1)?;
                Ok((chain_id, location_name))
            },
        );

        if let Ok((chain_id, location_name)) = location_result {
            // Get master tenant ID from the chain
            let master_tenant_id_result = conn.query_row(
                "SELECT master_tenant_id FROM restaurant_chains WHERE id = ?1",
                [&chain_id],
                |row| row.get::<_, String>(0),
            );

            if let Ok(master_tenant_id) = master_tenant_id_result {
                // Update restaurant_settings with chain configuration
                conn.execute(
                    "UPDATE restaurant_settings
                     SET location_group_id = ?,
                         master_tenant_id = ?,
                         current_location_name = ?,
                         is_location = 1,
                         chain_sync_enabled = 1
                     WHERE id = 1",
                    params![chain_id, master_tenant_id, location_name],
                ).map_err(|e| format!("Failed to update restaurant_settings: {}", e))?;

                println!("[TenantSwitcher] Chain sync configured:");
                println!("  - location_group_id: {}", chain_id);
                println!("  - master_tenant_id: {}", master_tenant_id);
                println!("  - current_location_name: {}", location_name);
                println!("  - is_location: 1");
            } else {
                println!("[TenantSwitcher] Warning: Could not find master_tenant_id for chain {}", chain_id);
            }
        } else {
            println!("[TenantSwitcher] Warning: Could not find location metadata for tenant_id {}", tenant_id);
        }
    }

    // TODO: In future, switch database connection to location's database
    // For now, we're using a single database with all data

    Ok(())
}
