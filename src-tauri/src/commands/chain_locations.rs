/**
 * Chain Location Management Commands
 * Tauri commands for managing restaurant chains and location tenants in SQLite
 */

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct LocationTenantMetadata {
    pub location_id: String,
    pub location_tenant_id: String,
    pub location_name: String,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state: String,
    pub pincode: String,
    pub country: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub activation_code: String,
    pub subdomain: String,
    pub restaurant_type: String,
    pub provisioning_status: String,
    pub d1_database_id: Option<String>,
    pub kv_namespace_id: Option<String>,
    pub r2_bucket_name: Option<String>,
    pub worker_url: Option<String>,
    // Google Maps metadata
    pub google_place_id: Option<String>,
    pub google_maps_url: Option<String>,
    pub google_rating: Option<f32>,
    pub google_total_reviews: Option<i32>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RestaurantChain {
    pub id: String,
    pub chain_name: String,
    pub master_tenant_id: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Create a new restaurant chain
#[tauri::command]
pub fn create_chain(
    app: AppHandle,
    chain_id: String,
    chain_name: String,
    master_tenant_id: String,
) -> Result<(), String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO restaurant_chains (id, chain_name, master_tenant_id) VALUES (?1, ?2, ?3)",
        &[&chain_id, &chain_name, &master_tenant_id],
    ).map_err(|e| format!("Failed to create chain: {}", e))?;

    Ok(())
}

/// Store location tenant metadata
#[tauri::command]
pub fn store_location_tenant(
    app: AppHandle,
    chain_id: String,
    location_metadata: LocationTenantMetadata,
) -> Result<(), String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute(
        r#"
        INSERT INTO location_tenants (
            id, chain_id, location_tenant_id, location_name,
            address_line1, address_line2, city, state, pincode, country,
            phone, email, activation_code, subdomain, restaurant_type,
            provisioning_status, d1_database_id, kv_namespace_id,
            r2_bucket_name, worker_url, google_place_id, google_maps_url,
            google_rating, google_total_reviews, latitude, longitude, status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, 'active')
        "#,
        rusqlite::params![
            location_metadata.location_id,
            chain_id,
            location_metadata.location_tenant_id,
            location_metadata.location_name,
            location_metadata.address_line1,
            location_metadata.address_line2,
            location_metadata.city,
            location_metadata.state,
            location_metadata.pincode,
            location_metadata.country,
            location_metadata.phone,
            location_metadata.email,
            location_metadata.activation_code,
            location_metadata.subdomain,
            location_metadata.restaurant_type,
            location_metadata.provisioning_status,
            location_metadata.d1_database_id,
            location_metadata.kv_namespace_id,
            location_metadata.r2_bucket_name,
            location_metadata.worker_url,
            location_metadata.google_place_id,
            location_metadata.google_maps_url,
            location_metadata.google_rating,
            location_metadata.google_total_reviews,
            location_metadata.latitude,
            location_metadata.longitude,
        ],
    ).map_err(|e| format!("Failed to store location tenant: {}", e))?;

    Ok(())
}

/// Get all locations for a chain
#[tauri::command]
pub fn get_chain_locations(
    app: AppHandle,
    chain_id: String,
) -> Result<Vec<LocationTenantMetadata>, String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        r#"
        SELECT
            id, location_tenant_id, location_name,
            address_line1, address_line2, city, state, pincode, country,
            phone, email, activation_code, subdomain, restaurant_type,
            provisioning_status, d1_database_id, kv_namespace_id,
            r2_bucket_name, worker_url, google_place_id, google_maps_url,
            google_rating, google_total_reviews, latitude, longitude
        FROM location_tenants
        WHERE chain_id = ?1 AND status = 'active'
        ORDER BY created_at DESC
        "#,
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let locations = stmt.query_map([&chain_id], |row| {
        Ok(LocationTenantMetadata {
            location_id: row.get(0)?,
            location_tenant_id: row.get(1)?,
            location_name: row.get(2)?,
            address_line1: row.get(3)?,
            address_line2: row.get(4)?,
            city: row.get(5)?,
            state: row.get(6)?,
            pincode: row.get(7)?,
            country: row.get(8)?,
            phone: row.get(9)?,
            email: row.get(10)?,
            activation_code: row.get(11)?,
            subdomain: row.get(12)?,
            restaurant_type: row.get(13)?,
            provisioning_status: row.get(14)?,
            d1_database_id: row.get(15)?,
            kv_namespace_id: row.get(16)?,
            r2_bucket_name: row.get(17)?,
            worker_url: row.get(18)?,
            google_place_id: row.get(19)?,
            google_maps_url: row.get(20)?,
            google_rating: row.get(21)?,
            google_total_reviews: row.get(22)?,
            latitude: row.get(23)?,
            longitude: row.get(24)?,
        })
    }).map_err(|e| format!("Failed to query locations: {}", e))?;

    locations.collect::<Result<Vec<_>, _>>().map_err(|e| format!("Failed to collect locations: {}", e))
}

/// Get current tenant ID
#[tauri::command]
pub fn get_current_tenant_id(app: AppHandle) -> Result<String, String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let tenant_id: String = db.query_row(
        "SELECT tenant_id FROM tenant_config WHERE id = 1",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get tenant ID: {}", e))?;

    Ok(tenant_id)
}

/// Get chain by ID
#[tauri::command]
pub fn get_chain(
    app: AppHandle,
    chain_id: String,
) -> Result<RestaurantChain, String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let chain = db.query_row(
        "SELECT id, chain_name, master_tenant_id, created_at, updated_at FROM restaurant_chains WHERE id = ?1",
        [&chain_id],
        |row| {
            Ok(RestaurantChain {
                id: row.get(0)?,
                chain_name: row.get(1)?,
                master_tenant_id: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    ).map_err(|e| format!("Failed to get chain: {}", e))?;

    Ok(chain)
}

/// Get chain by master tenant ID
#[tauri::command]
pub fn get_chain_by_master_tenant(
    app: AppHandle,
    master_tenant_id: String,
) -> Result<RestaurantChain, String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let chain = db.query_row(
        "SELECT id, chain_name, master_tenant_id, created_at, updated_at FROM restaurant_chains WHERE master_tenant_id = ?1",
        [&master_tenant_id],
        |row| {
            Ok(RestaurantChain {
                id: row.get(0)?,
                chain_name: row.get(1)?,
                master_tenant_id: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    ).map_err(|e| format!("Failed to get chain: {}", e))?;

    Ok(chain)
}

/// Update location status (active/inactive)
#[tauri::command]
pub fn update_location_status(
    app: AppHandle,
    location_tenant_id: String,
    status: String,
) -> Result<(), String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE location_tenants SET status = ?1, updated_at = datetime('now') WHERE location_tenant_id = ?2",
        &[&status, &location_tenant_id],
    ).map_err(|e| format!("Failed to update location status: {}", e))?;

    Ok(())
}

/// Get location by tenant ID
#[tauri::command]
pub fn get_location_by_tenant_id(
    app: AppHandle,
    location_tenant_id: String,
) -> Result<LocationTenantMetadata, String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let location = db.query_row(
        r#"
        SELECT
            id, location_tenant_id, location_name,
            address_line1, address_line2, city, state, pincode, country,
            phone, email, activation_code, subdomain, restaurant_type,
            provisioning_status, d1_database_id, kv_namespace_id,
            r2_bucket_name, worker_url, google_place_id, google_maps_url,
            google_rating, google_total_reviews, latitude, longitude
        FROM location_tenants
        WHERE location_tenant_id = ?1
        "#,
        [&location_tenant_id],
        |row| {
            Ok(LocationTenantMetadata {
                location_id: row.get(0)?,
                location_tenant_id: row.get(1)?,
                location_name: row.get(2)?,
                address_line1: row.get(3)?,
                address_line2: row.get(4)?,
                city: row.get(5)?,
                state: row.get(6)?,
                pincode: row.get(7)?,
                country: row.get(8)?,
                phone: row.get(9)?,
                email: row.get(10)?,
                activation_code: row.get(11)?,
                subdomain: row.get(12)?,
                restaurant_type: row.get(13)?,
                provisioning_status: row.get(14)?,
                d1_database_id: row.get(15)?,
                kv_namespace_id: row.get(16)?,
                r2_bucket_name: row.get(17)?,
                worker_url: row.get(18)?,
                google_place_id: row.get(19)?,
                google_maps_url: row.get(20)?,
                google_rating: row.get(21)?,
                google_total_reviews: row.get(22)?,
                latitude: row.get(23)?,
                longitude: row.get(24)?,
            })
        },
    ).map_err(|e| format!("Failed to get location: {}", e))?;

    Ok(location)
}

/// Delete a location (soft delete by setting status to inactive)
#[tauri::command]
pub fn delete_location(
    app: AppHandle,
    location_tenant_id: String,
) -> Result<(), String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE location_tenants SET status = 'inactive', updated_at = datetime('now') WHERE location_tenant_id = ?1",
        [&location_tenant_id],
    ).map_err(|e| format!("Failed to delete location: {}", e))?;

    Ok(())
}

// Menu sync structures
#[derive(Debug, Serialize, Deserialize)]
pub struct MenuCategory {
    pub id: String,
    pub name: String,
    #[serde(rename = "nameHindi")]
    pub name_hindi: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "displayOrder")]
    pub display_order: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuItem {
    pub id: String,
    pub name: String,
    #[serde(rename = "nameHindi")]
    pub name_hindi: Option<String>,
    pub category: String,
    pub description: Option<String>,
    pub price: f64,
    #[serde(rename = "photoUrl")]
    pub photo_url: Option<String>,
    #[serde(rename = "cloudflareImageId")]
    pub cloudflare_image_id: Option<String>,
    pub available: bool,
    #[serde(rename = "isVegetarian")]
    pub is_vegetarian: bool,
    #[serde(rename = "spiceLevel")]
    pub spice_level: Option<String>,
    #[serde(rename = "displayOrder")]
    pub display_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct MasterMenuResponse {
    categories: Vec<MenuCategory>,
    items: Vec<MenuItem>,
}

/// Fetch master menu from master tenant's D1 and load into local SQLite
/// Called automatically during location tenant activation
#[tauri::command]
pub async fn fetch_and_load_master_menu(
    master_tenant_id: String,
    app: AppHandle,
) -> Result<usize, String> {
    use rusqlite::Connection;

    println!("[MenuSync] Fetching menu from master tenant: {}", master_tenant_id);

    // Step 1: Fetch menu from master tenant's D1
    let backend_url = std::env::var("VITE_BACKEND_API_URL")
        .unwrap_or_else(|_| "https://handsfree-restaurant-client.suyesh.workers.dev/api".to_string());

    let url = format!("{}/menu/{}", backend_url, master_tenant_id);

    println!("[MenuSync] Fetching from URL: {}", url);

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch master menu: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Backend returned error: {}", response.status()));
    }

    let master_menu: MasterMenuResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse master menu: {}", e))?;

    println!(
        "[MenuSync] Received {} categories, {} items",
        master_menu.categories.len(),
        master_menu.items.len()
    );

    // Step 2: Load menu into local SQLite
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let mut db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Begin transaction for atomicity
    let tx = db.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    println!("[MenuSync] Clearing existing menu data...");

    // Clear existing menu (full replacement)
    tx.execute("DELETE FROM menu_items", [])
        .map_err(|e| format!("Failed to clear menu items: {}", e))?;
    tx.execute("DELETE FROM menu_categories", [])
        .map_err(|e| format!("Failed to clear menu categories: {}", e))?;

    println!("[MenuSync] Inserting {} categories...", master_menu.categories.len());

    // Insert categories
    let mut category_stmt = tx.prepare(
        "INSERT INTO menu_categories (id, name, name_hindi, description, display_order)
         VALUES (?1, ?2, ?3, ?4, ?5)"
    ).map_err(|e| format!("Failed to prepare category insert: {}", e))?;

    for cat in &master_menu.categories {
        category_stmt.execute(rusqlite::params![
            &cat.id,
            &cat.name,
            &cat.name_hindi,
            &cat.description,
            cat.display_order,
        ]).map_err(|e| format!("Failed to insert category {}: {}", cat.name, e))?;
    }
    drop(category_stmt);

    println!("[MenuSync] Inserting {} menu items...", master_menu.items.len());

    // Insert menu items
    let mut item_stmt = tx.prepare(
        "INSERT INTO menu_items (id, name, name_hindi, category, description, price,
                                 photo_url, cloudflare_image_id, available, is_vegetarian,
                                 spice_level, display_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    ).map_err(|e| format!("Failed to prepare item insert: {}", e))?;

    for item in &master_menu.items {
        item_stmt.execute(rusqlite::params![
            &item.id,
            &item.name,
            &item.name_hindi,
            &item.category,
            &item.description,
            item.price,
            &item.photo_url,
            &item.cloudflare_image_id,
            if item.available { 1 } else { 0 },
            if item.is_vegetarian { 1 } else { 0 },
            &item.spice_level,
            &item.display_order,
        ]).map_err(|e| format!("Failed to insert menu item {}: {}", item.name, e))?;
    }
    drop(item_stmt);

    // Commit transaction
    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    println!("[MenuSync] ✅ Menu sync complete: {} items loaded", master_menu.items.len());

    Ok(master_menu.items.len())
}
