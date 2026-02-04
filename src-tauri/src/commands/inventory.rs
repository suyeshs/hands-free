/**
 * Inventory Management Commands
 * Tauri commands for managing inventory, suppliers, recipes, and documents in SQLite
 */

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tauri::Manager;

// ==================== STRUCTS ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Supplier {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,

    // Enhanced fields (from migration 029)
    pub gstin: Option<String>,
    pub tax_id: Option<String>,
    pub payment_terms: Option<String>,
    pub currency: String,
    pub bank_name: Option<String>,
    pub bank_account: Option<String>,
    pub bank_ifsc: Option<String>,
    pub upi_id: Option<String>,
    pub website: Option<String>,
    pub category: Option<String>,
    pub is_verified: bool,
    pub total_orders: i32,
    pub total_spent: f64,
    pub rating: Option<f64>,

    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItem {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub sku: Option<String>,
    pub category: String,
    pub current_stock: f64,
    pub unit: String,
    pub price_per_unit: Option<f64>,
    pub reorder_level: f64,
    pub supplier_id: Option<String>,
    pub storage_location: Option<String>,
    pub expiry_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecipeIngredient {
    pub id: String,
    pub tenant_id: String,
    pub menu_item_id: String,
    pub inventory_item_id: String,
    pub quantity_required: f64,
    pub unit: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InventoryDocument {
    pub id: String,
    pub tenant_id: String,
    pub document_type: String,
    pub supplier_id: Option<String>,
    pub file_path: Option<String>,
    pub ocr_status: String,
    pub ocr_provider: Option<String>,
    pub extracted_data: Option<String>, // JSON string
    pub total_amount: Option<f64>,
    pub tax_amount: Option<f64>,
    pub document_date: Option<String>,
    pub invoice_number: Option<String>,
    pub processing_time_ms: Option<i32>,
    pub confidence_score: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InventoryTransaction {
    pub id: String,
    pub tenant_id: String,
    pub item_id: String,
    pub document_id: Option<String>,
    pub transaction_type: String,
    pub quantity_change: f64,
    pub previous_quantity: f64,
    pub new_quantity: f64,
    pub unit_price: Option<f64>,
    pub reason: Option<String>,
    pub recorded_by: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LowStockAlert {
    pub item_id: String,
    pub item_name: String,
    pub current_stock: f64,
    pub reorder_level: f64,
    pub unit: String,
    pub deficit: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExpiryAlert {
    pub item_id: String,
    pub item_name: String,
    pub expiry_date: String,
    pub current_stock: f64,
    pub unit: String,
    pub days_until_expiry: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InventorySummary {
    pub total_items: i32,
    pub total_value: f64,
    pub low_stock_count: i32,
    pub expiring_soon_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncQueueItem {
    pub id: i64,
    pub table_name: String,
    pub record_id: String,
    pub data: String, // JSON string
    pub created_at: String,
}

// ==================== SUPPLIER COMMANDS ====================

// Helper function to map supplier rows
fn map_supplier_row(row: &rusqlite::Row) -> rusqlite::Result<Supplier> {
    Ok(Supplier {
        id: row.get(0)?,
        tenant_id: row.get(1)?,
        name: row.get(2)?,
        contact_name: row.get(3)?,
        phone: row.get(4)?,
        email: row.get(5)?,
        address: row.get(6)?,
        notes: row.get(7)?,
        gstin: row.get(8)?,
        tax_id: row.get(9)?,
        payment_terms: row.get(10)?,
        currency: row.get::<_, Option<String>>(11)?.unwrap_or_else(|| "INR".to_string()),
        bank_name: row.get(12)?,
        bank_account: row.get(13)?,
        bank_ifsc: row.get(14)?,
        upi_id: row.get(15)?,
        website: row.get(16)?,
        category: row.get(17)?,
        is_verified: row.get::<_, Option<i32>>(18)?.unwrap_or(0) == 1,
        total_orders: row.get::<_, Option<i32>>(19)?.unwrap_or(0),
        total_spent: row.get::<_, Option<f64>>(20)?.unwrap_or(0.0),
        rating: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get(23)?,
    })
}

#[tauri::command]
pub fn get_suppliers(
    app: tauri::AppHandle,
    tenant_id: String,
    search: Option<String>,
) -> Result<Vec<Supplier>, String> {
    println!("[inventory.rs] get_suppliers called for tenant: {}", tenant_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let query = if search.is_some() {
        "SELECT id, tenant_id, name, contact_name, phone, email, address, notes,
                gstin, tax_id, payment_terms, currency, bank_name, bank_account, bank_ifsc,
                upi_id, website, category, is_verified, total_orders, total_spent, rating,
                created_at, updated_at
         FROM suppliers
         WHERE tenant_id = ?1 AND (name LIKE ?2 OR contact_name LIKE ?2 OR phone LIKE ?2)
         ORDER BY name"
    } else {
        "SELECT id, tenant_id, name, contact_name, phone, email, address, notes,
                gstin, tax_id, payment_terms, currency, bank_name, bank_account, bank_ifsc,
                upi_id, website, category, is_verified, total_orders, total_spent, rating,
                created_at, updated_at
         FROM suppliers
         WHERE tenant_id = ?1
         ORDER BY name"
    };

    let mut stmt = db.prepare(query).map_err(|e| e.to_string())?;

    let suppliers = if let Some(search_term) = search {
        let search_pattern = format!("%{}%", search_term);
        stmt.query_map(params![tenant_id, search_pattern], map_supplier_row)
    } else {
        stmt.query_map(params![tenant_id], map_supplier_row)
    }.map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    println!("[inventory.rs] Found {} suppliers", suppliers.len());
    Ok(suppliers)
}

#[tauri::command]
pub fn get_supplier(
    app: tauri::AppHandle,
    supplier_id: String,
    tenant_id: String,
) -> Result<Option<Supplier>, String> {
    println!("[inventory.rs] get_supplier called: {}", supplier_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let supplier = db.query_row(
        "SELECT id, tenant_id, name, contact_name, phone, email, address, notes,
                gstin, tax_id, payment_terms, currency, bank_name, bank_account, bank_ifsc,
                upi_id, website, category, is_verified, total_orders, total_spent, rating,
                created_at, updated_at
         FROM suppliers
         WHERE id = ?1 AND tenant_id = ?2",
        params![supplier_id, tenant_id],
        |row| {
            Ok(Supplier {
                id: row.get(0)?,
                tenant_id: row.get(1)?,
                name: row.get(2)?,
                contact_name: row.get(3)?,
                phone: row.get(4)?,
                email: row.get(5)?,
                address: row.get(6)?,
                notes: row.get(7)?,
                gstin: row.get(8)?,
                tax_id: row.get(9)?,
                payment_terms: row.get(10)?,
                currency: row.get::<_, Option<String>>(11)?.unwrap_or_else(|| "INR".to_string()),
                bank_name: row.get(12)?,
                bank_account: row.get(13)?,
                bank_ifsc: row.get(14)?,
                upi_id: row.get(15)?,
                website: row.get(16)?,
                category: row.get(17)?,
                is_verified: row.get::<_, Option<i32>>(18)?.unwrap_or(0) == 1,
                total_orders: row.get::<_, Option<i32>>(19)?.unwrap_or(0),
                total_spent: row.get::<_, Option<f64>>(20)?.unwrap_or(0.0),
                rating: row.get(21)?,
                created_at: row.get(22)?,
                updated_at: row.get(23)?,
            })
        }
    );

    match supplier {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_supplier(
    app: tauri::AppHandle,
    supplier: Supplier,
    tenant_id: String,
) -> Result<Supplier, String> {
    println!("[inventory.rs] create_supplier called: {}", supplier.name);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let id = if supplier.id.is_empty() {
        format!("sup-{}-{}", chrono::Utc::now().timestamp(), rand::random::<u32>())
    } else {
        supplier.id.clone()
    };

    db.execute(
        "INSERT INTO suppliers (
            id, tenant_id, name, contact_name, phone, email, address, notes,
            gstin, tax_id, payment_terms, currency, bank_name, bank_account, bank_ifsc,
            upi_id, website, category, is_verified, total_orders, total_spent, rating,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
        params![
            id,
            tenant_id,
            supplier.name,
            supplier.contact_name,
            supplier.phone,
            supplier.email,
            supplier.address,
            supplier.notes,
            supplier.gstin,
            supplier.tax_id,
            supplier.payment_terms,
            supplier.currency,
            supplier.bank_name,
            supplier.bank_account,
            supplier.bank_ifsc,
            supplier.upi_id,
            supplier.website,
            supplier.category,
            if supplier.is_verified { 1 } else { 0 },
            supplier.total_orders,
            supplier.total_spent,
            supplier.rating,
            now.clone(),
            now.clone(),
        ]
    ).map_err(|e| e.to_string())?;

    println!("[inventory.rs] Supplier created with id: {}", id);

    Ok(Supplier {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..supplier
    })
}

#[tauri::command]
pub fn update_supplier(
    app: tauri::AppHandle,
    supplier_id: String,
    supplier: Supplier,
    tenant_id: String,
) -> Result<Supplier, String> {
    println!("[inventory.rs] update_supplier called: {}", supplier_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "UPDATE suppliers SET
            name = ?1, contact_name = ?2, phone = ?3, email = ?4, address = ?5, notes = ?6,
            gstin = ?7, tax_id = ?8, payment_terms = ?9, currency = ?10,
            bank_name = ?11, bank_account = ?12, bank_ifsc = ?13, upi_id = ?14,
            website = ?15, category = ?16, is_verified = ?17, rating = ?18, updated_at = ?19
         WHERE id = ?20 AND tenant_id = ?21",
        params![
            supplier.name,
            supplier.contact_name,
            supplier.phone,
            supplier.email,
            supplier.address,
            supplier.notes,
            supplier.gstin,
            supplier.tax_id,
            supplier.payment_terms,
            supplier.currency,
            supplier.bank_name,
            supplier.bank_account,
            supplier.bank_ifsc,
            supplier.upi_id,
            supplier.website,
            supplier.category,
            if supplier.is_verified { 1 } else { 0 },
            supplier.rating,
            now.clone(),
            supplier_id,
            tenant_id,
        ]
    ).map_err(|e| e.to_string())?;

    println!("[inventory.rs] Supplier updated");

    Ok(Supplier {
        updated_at: now,
        ..supplier
    })
}

#[tauri::command]
pub fn delete_supplier(
    app: tauri::AppHandle,
    supplier_id: String,
    tenant_id: String,
) -> Result<bool, String> {
    println!("[inventory.rs] delete_supplier called: {}", supplier_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let rows_affected = db.execute(
        "DELETE FROM suppliers WHERE id = ?1 AND tenant_id = ?2",
        params![supplier_id, tenant_id],
    ).map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

// ==================== INVENTORY ITEM COMMANDS ====================

#[tauri::command]
pub fn get_inventory_items(
    app: tauri::AppHandle,
    tenant_id: String,
    category: Option<String>,
    supplier_id: Option<String>,
    low_stock: Option<bool>,
) -> Result<Vec<InventoryItem>, String> {
    println!("[inventory.rs] get_inventory_items called for tenant: {}", tenant_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut query = "SELECT id, tenant_id, name, sku, category, current_stock, unit, price_per_unit,
                           reorder_level, supplier_id, storage_location, expiry_date, notes,
                           created_at, updated_at
                     FROM inventory_items
                     WHERE tenant_id = ?1".to_string();

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(tenant_id.clone())];

    if let Some(cat) = category {
        query.push_str(" AND category = ?");
        params_vec.push(Box::new(cat));
    }

    if let Some(sup_id) = supplier_id {
        query.push_str(" AND supplier_id = ?");
        params_vec.push(Box::new(sup_id));
    }

    if low_stock == Some(true) {
        query.push_str(" AND current_stock <= reorder_level");
    }

    query.push_str(" ORDER BY name");

    let mut stmt = db.prepare(&query).map_err(|e| e.to_string())?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let items = stmt.query_map(&param_refs[..], |row| {
        Ok(InventoryItem {
            id: row.get(0)?,
            tenant_id: row.get(1)?,
            name: row.get(2)?,
            sku: row.get(3)?,
            category: row.get(4)?,
            current_stock: row.get(5)?,
            unit: row.get(6)?,
            price_per_unit: row.get(7)?,
            reorder_level: row.get(8)?,
            supplier_id: row.get(9)?,
            storage_location: row.get(10)?,
            expiry_date: row.get(11)?,
            notes: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    println!("[inventory.rs] Found {} inventory items", items.len());
    Ok(items)
}

#[tauri::command]
pub fn create_inventory_item(
    app: tauri::AppHandle,
    item: InventoryItem,
    tenant_id: String,
) -> Result<InventoryItem, String> {
    println!("[inventory.rs] create_inventory_item called: {}", item.name);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let id = if item.id.is_empty() {
        format!("inv-{}-{}", chrono::Utc::now().timestamp(), rand::random::<u32>())
    } else {
        item.id.clone()
    };

    db.execute(
        "INSERT INTO inventory_items (
            id, tenant_id, name, sku, category, current_stock, unit, price_per_unit,
            reorder_level, supplier_id, storage_location, expiry_date, notes,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            id,
            tenant_id,
            item.name,
            item.sku,
            item.category,
            item.current_stock,
            item.unit,
            item.price_per_unit,
            item.reorder_level,
            item.supplier_id,
            item.storage_location,
            item.expiry_date,
            item.notes,
            now.clone(),
            now.clone(),
        ]
    ).map_err(|e| e.to_string())?;

    println!("[inventory.rs] Item created with id: {}", id);

    Ok(InventoryItem {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..item
    })
}

#[tauri::command]
pub fn update_inventory_item(
    app: tauri::AppHandle,
    item_id: String,
    item: InventoryItem,
    tenant_id: String,
) -> Result<InventoryItem, String> {
    println!("[inventory.rs] update_inventory_item called: {}", item_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "UPDATE inventory_items SET
            name = ?1, sku = ?2, category = ?3, current_stock = ?4, unit = ?5,
            price_per_unit = ?6, reorder_level = ?7, supplier_id = ?8,
            storage_location = ?9, expiry_date = ?10, notes = ?11, updated_at = ?12
         WHERE id = ?13 AND tenant_id = ?14",
        params![
            item.name,
            item.sku,
            item.category,
            item.current_stock,
            item.unit,
            item.price_per_unit,
            item.reorder_level,
            item.supplier_id,
            item.storage_location,
            item.expiry_date,
            item.notes,
            now.clone(),
            item_id,
            tenant_id,
        ]
    ).map_err(|e| e.to_string())?;

    println!("[inventory.rs] Item updated");

    Ok(InventoryItem {
        updated_at: now,
        ..item
    })
}

#[tauri::command]
pub fn delete_inventory_item(
    app: tauri::AppHandle,
    item_id: String,
    tenant_id: String,
) -> Result<bool, String> {
    println!("[inventory.rs] delete_inventory_item called: {}", item_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let rows_affected = db.execute(
        "DELETE FROM inventory_items WHERE id = ?1 AND tenant_id = ?2",
        params![item_id, tenant_id],
    ).map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

#[tauri::command]
pub fn adjust_inventory_stock(
    app: tauri::AppHandle,
    item_id: String,
    quantity_change: f64,
    transaction_type: String,
    reason: String,
    tenant_id: String,
    recorded_by: Option<String>,
    unit_price: Option<f64>,
) -> Result<InventoryItem, String> {
    println!("[inventory.rs] adjust_inventory_stock called: {} by {}", item_id, quantity_change);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Get current item
    let current_item: (f64, String, String, String, f64, f64) = db.query_row(
        "SELECT current_stock, name, unit, created_at, reorder_level, price_per_unit FROM inventory_items WHERE id = ?1 AND tenant_id = ?2",
        params![item_id, tenant_id],
        |row| Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get::<_, Option<f64>>(5)?.unwrap_or(0.0),
        ))
    ).map_err(|e| format!("Item not found: {}", e))?;

    let (previous_quantity, item_name, item_unit, item_created_at, item_reorder_level, item_price_per_unit) = current_item;
    let new_quantity = previous_quantity + quantity_change;

    // Update stock
    let now = chrono::Utc::now().to_rfc3339();
    db.execute(
        "UPDATE inventory_items SET current_stock = ?1, updated_at = ?2 WHERE id = ?3 AND tenant_id = ?4",
        params![new_quantity, now.clone(), item_id, tenant_id],
    ).map_err(|e| e.to_string())?;

    // Create transaction record
    let transaction_id = format!("txn-{}-{}", chrono::Utc::now().timestamp(), rand::random::<u32>());
    db.execute(
        "INSERT INTO inventory_transactions (
            id, tenant_id, item_id, transaction_type, quantity_change,
            previous_quantity, new_quantity, unit_price, reason, recorded_by, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            transaction_id,
            tenant_id,
            item_id,
            transaction_type,
            quantity_change,
            previous_quantity,
            new_quantity,
            unit_price,
            reason,
            recorded_by,
            now.clone(),
        ]
    ).map_err(|e| e.to_string())?;

    println!("[inventory.rs] Stock adjusted: {} -> {}", previous_quantity, new_quantity);

    // Return updated item
    Ok(InventoryItem {
        id: item_id.clone(),
        tenant_id: tenant_id.clone(),
        name: item_name,
        sku: None,
        category: "other".to_string(), // Will be fetched properly
        current_stock: new_quantity,
        unit: item_unit,
        price_per_unit: Some(item_price_per_unit),
        reorder_level: item_reorder_level,
        supplier_id: None,
        storage_location: None,
        expiry_date: None,
        notes: None,
        created_at: item_created_at,
        updated_at: now,
    })
}

// ==================== ALERT COMMANDS ====================

#[tauri::command]
pub fn get_low_stock_alerts(
    app: tauri::AppHandle,
    tenant_id: String,
) -> Result<Vec<LowStockAlert>, String> {
    println!("[inventory.rs] get_low_stock_alerts called");

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        "SELECT id, name, current_stock, reorder_level, unit
         FROM inventory_items
         WHERE tenant_id = ?1 AND current_stock <= reorder_level
         ORDER BY (reorder_level - current_stock) DESC"
    ).map_err(|e| e.to_string())?;

    let alerts = stmt.query_map(params![tenant_id], |row| {
        let current_stock: f64 = row.get(2)?;
        let reorder_level: f64 = row.get(3)?;
        Ok(LowStockAlert {
            item_id: row.get(0)?,
            item_name: row.get(1)?,
            current_stock,
            reorder_level,
            unit: row.get(4)?,
            deficit: reorder_level - current_stock,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    println!("[inventory.rs] Found {} low stock alerts", alerts.len());
    Ok(alerts)
}

#[tauri::command]
pub fn get_expiring_soon_alerts(
    app: tauri::AppHandle,
    tenant_id: String,
    days: i32,
) -> Result<Vec<ExpiryAlert>, String> {
    println!("[inventory.rs] get_expiring_soon_alerts called for {} days", days);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let cutoff_date = chrono::Utc::now() + chrono::Duration::days(days as i64);
    let cutoff_date_str = cutoff_date.format("%Y-%m-%d").to_string();

    let mut stmt = db.prepare(
        "SELECT id, name, expiry_date, current_stock, unit
         FROM inventory_items
         WHERE tenant_id = ?1 AND expiry_date IS NOT NULL AND expiry_date <= ?2
         ORDER BY expiry_date ASC"
    ).map_err(|e| e.to_string())?;

    let alerts = stmt.query_map(params![tenant_id, cutoff_date_str], |row| {
        let expiry_date_str: String = row.get(2)?;
        let days_until_expiry = if let Ok(expiry_date) = chrono::NaiveDate::parse_from_str(&expiry_date_str, "%Y-%m-%d") {
            let now = chrono::Utc::now().date_naive();
            (expiry_date - now).num_days() as i32
        } else {
            0
        };

        Ok(ExpiryAlert {
            item_id: row.get(0)?,
            item_name: row.get(1)?,
            expiry_date: expiry_date_str,
            current_stock: row.get(3)?,
            unit: row.get(4)?,
            days_until_expiry,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    println!("[inventory.rs] Found {} expiring soon alerts", alerts.len());
    Ok(alerts)
}

#[tauri::command]
pub fn get_inventory_summary(
    app: tauri::AppHandle,
    tenant_id: String,
) -> Result<InventorySummary, String> {
    println!("[inventory.rs] get_inventory_summary called");

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let total_items: i32 = db.query_row(
        "SELECT COUNT(*) FROM inventory_items WHERE tenant_id = ?1",
        params![tenant_id],
        |row| row.get(0)
    ).unwrap_or(0);

    let total_value: f64 = db.query_row(
        "SELECT SUM(current_stock * COALESCE(price_per_unit, 0)) FROM inventory_items WHERE tenant_id = ?1",
        params![tenant_id],
        |row| row.get(0)
    ).unwrap_or(0.0);

    let low_stock_count: i32 = db.query_row(
        "SELECT COUNT(*) FROM inventory_items WHERE tenant_id = ?1 AND current_stock <= reorder_level",
        params![tenant_id],
        |row| row.get(0)
    ).unwrap_or(0);

    let cutoff_date = chrono::Utc::now() + chrono::Duration::days(7);
    let cutoff_date_str = cutoff_date.format("%Y-%m-%d").to_string();
    let expiring_soon_count: i32 = db.query_row(
        "SELECT COUNT(*) FROM inventory_items WHERE tenant_id = ?1 AND expiry_date IS NOT NULL AND expiry_date <= ?2",
        params![tenant_id, cutoff_date_str],
        |row| row.get(0)
    ).unwrap_or(0);

    Ok(InventorySummary {
        total_items,
        total_value,
        low_stock_count,
        expiring_soon_count,
    })
}

// ==================== RECIPE COMMANDS ====================

#[tauri::command]
pub fn get_recipe_ingredients(
    app: tauri::AppHandle,
    menu_item_id: String,
    tenant_id: String,
) -> Result<Vec<RecipeIngredient>, String> {
    println!("[inventory.rs] get_recipe_ingredients called for menu item: {}", menu_item_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        "SELECT id, tenant_id, menu_item_id, inventory_item_id, quantity_required, unit, created_at
         FROM recipe_ingredients
         WHERE menu_item_id = ?1 AND tenant_id = ?2"
    ).map_err(|e| e.to_string())?;

    let ingredients = stmt.query_map(params![menu_item_id, tenant_id], |row| {
        Ok(RecipeIngredient {
            id: row.get(0)?,
            tenant_id: row.get(1)?,
            menu_item_id: row.get(2)?,
            inventory_item_id: row.get(3)?,
            quantity_required: row.get(4)?,
            unit: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    println!("[inventory.rs] Found {} recipe ingredients", ingredients.len());
    Ok(ingredients)
}

#[tauri::command]
pub fn add_recipe_ingredient(
    app: tauri::AppHandle,
    menu_item_id: String,
    inventory_item_id: String,
    quantity: f64,
    unit: String,
    tenant_id: String,
) -> Result<RecipeIngredient, String> {
    println!("[inventory.rs] add_recipe_ingredient called");

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let id = format!("rcp-{}-{}", chrono::Utc::now().timestamp(), rand::random::<u32>());

    db.execute(
        "INSERT INTO recipe_ingredients (
            id, tenant_id, menu_item_id, inventory_item_id, quantity_required, unit, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, tenant_id, menu_item_id, inventory_item_id, quantity, unit, now.clone()]
    ).map_err(|e| e.to_string())?;

    Ok(RecipeIngredient {
        id,
        tenant_id,
        menu_item_id,
        inventory_item_id,
        quantity_required: quantity,
        unit,
        created_at: now,
    })
}

#[tauri::command]
pub fn remove_recipe_ingredient(
    app: tauri::AppHandle,
    ingredient_id: String,
    tenant_id: String,
) -> Result<bool, String> {
    println!("[inventory.rs] remove_recipe_ingredient called: {}", ingredient_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let rows_affected = db.execute(
        "DELETE FROM recipe_ingredients WHERE id = ?1 AND tenant_id = ?2",
        params![ingredient_id, tenant_id],
    ).map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

// ==================== DOCUMENT & TRANSACTION COMMANDS ====================

#[tauri::command]
pub fn save_inventory_document(
    app: tauri::AppHandle,
    document: InventoryDocument,
    tenant_id: String,
) -> Result<InventoryDocument, String> {
    println!("[inventory.rs] save_inventory_document called");

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let id = if document.id.is_empty() {
        format!("doc-{}-{}", chrono::Utc::now().timestamp(), rand::random::<u32>())
    } else {
        document.id.clone()
    };

    db.execute(
        "INSERT OR REPLACE INTO inventory_documents (
            id, tenant_id, document_type, supplier_id, file_path, ocr_status, ocr_provider,
            extracted_data, total_amount, tax_amount, document_date, invoice_number,
            processing_time_ms, confidence_score, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            id,
            tenant_id,
            document.document_type,
            document.supplier_id,
            document.file_path,
            document.ocr_status,
            document.ocr_provider,
            document.extracted_data,
            document.total_amount,
            document.tax_amount,
            document.document_date,
            document.invoice_number,
            document.processing_time_ms,
            document.confidence_score,
            now.clone(),
            now.clone(),
        ]
    ).map_err(|e| e.to_string())?;

    Ok(InventoryDocument {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..document
    })
}

// Helper function to map transaction rows
fn map_transaction_row(row: &rusqlite::Row) -> rusqlite::Result<InventoryTransaction> {
    Ok(InventoryTransaction {
        id: row.get(0)?,
        tenant_id: row.get(1)?,
        item_id: row.get(2)?,
        document_id: row.get(3)?,
        transaction_type: row.get(4)?,
        quantity_change: row.get(5)?,
        previous_quantity: row.get(6)?,
        new_quantity: row.get(7)?,
        unit_price: row.get(8)?,
        reason: row.get(9)?,
        recorded_by: row.get(10)?,
        created_at: row.get(11)?,
    })
}

#[tauri::command]
pub fn get_item_transactions(
    app: tauri::AppHandle,
    item_id: String,
    tenant_id: String,
    limit: Option<i32>,
) -> Result<Vec<InventoryTransaction>, String> {
    println!("[inventory.rs] get_item_transactions called for item: {}", item_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let query = if limit.is_some() {
        "SELECT id, tenant_id, item_id, document_id, transaction_type, quantity_change,
                previous_quantity, new_quantity, unit_price, reason, recorded_by, created_at
         FROM inventory_transactions
         WHERE item_id = ?1 AND tenant_id = ?2
         ORDER BY created_at DESC
         LIMIT ?3"
    } else {
        "SELECT id, tenant_id, item_id, document_id, transaction_type, quantity_change,
                previous_quantity, new_quantity, unit_price, reason, recorded_by, created_at
         FROM inventory_transactions
         WHERE item_id = ?1 AND tenant_id = ?2
         ORDER BY created_at DESC"
    };

    let mut stmt = db.prepare(query).map_err(|e| e.to_string())?;

    let transactions = if let Some(lim) = limit {
        stmt.query_map(params![item_id, tenant_id, lim], map_transaction_row)
    } else {
        stmt.query_map(params![item_id, tenant_id], map_transaction_row)
    }.map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    println!("[inventory.rs] Found {} transactions", transactions.len());
    Ok(transactions)
}

// ==================== SYNC QUEUE COMMANDS ====================

#[tauri::command]
pub fn mark_inventory_sync_pending(
    app: tauri::AppHandle,
    table_name: String,
    record_id: String,
    data: String,
) -> Result<(), String> {
    println!("[inventory.rs] mark_inventory_sync_pending: {} {}", table_name, record_id);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "INSERT OR REPLACE INTO sync_queue (table_name, record_id, data, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![table_name, record_id, data, now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_pending_inventory_syncs(
    app: tauri::AppHandle,
) -> Result<Vec<SyncQueueItem>, String> {
    println!("[inventory.rs] get_pending_inventory_syncs called");

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        "SELECT id, table_name, record_id, data, created_at
         FROM sync_queue
         ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let syncs = stmt.query_map([], |row| {
        Ok(SyncQueueItem {
            id: row.get(0)?,
            table_name: row.get(1)?,
            record_id: row.get(2)?,
            data: row.get(3)?,
            created_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    println!("[inventory.rs] Found {} pending syncs", syncs.len());
    Ok(syncs)
}

#[tauri::command]
pub fn clear_inventory_sync_queue(
    app: tauri::AppHandle,
    ids: Vec<i64>,
) -> Result<(), String> {
    println!("[inventory.rs] clear_inventory_sync_queue called for {} ids", ids.len());

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    for id in ids {
        db.execute(
            "DELETE FROM sync_queue WHERE id = ?1",
            params![id],
        ).map_err(|e| e.to_string())?;
    }

    println!("[inventory.rs] Cleared sync queue");
    Ok(())
}
