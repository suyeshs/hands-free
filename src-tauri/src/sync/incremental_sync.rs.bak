// Incremental Sync - Only syncs changed records since last sync
// Uses Rust for performance-critical SQLite queries

use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use reqwest::Client;
use std::time::Instant;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

use super::{SyncConfig, SyncResult, get_last_sync_timestamp, update_last_sync_timestamp, is_online};

type DbConnection = Arc<TokioMutex<Connection>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Order {
    id: String,
    order_number: String,
    order_type: String,
    status: String,
    subtotal: f64,
    tax: Option<f64>,
    total: f64,
    payment_method: Option<String>,
    table_number: Option<i32>,
    customer_name: Option<String>,
    customer_phone: Option<String>,
    notes: Option<String>,
    source: Option<String>,
    created_at: String,
    updated_at: String,
    completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    items: Option<Vec<OrderItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OrderItem {
    id: String,
    order_id: String,
    menu_item_id: String,
    name: String,
    quantity: i32,
    price: f64,
    customization: Option<String>,
    item_total: f64,
}

/// Sync orders incrementally
pub async fn sync_orders(
    db: DbConnection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();

    // Acquire lock, query data, then release before HTTP call
    let orders = {
        let db_guard = db.lock().await;
        let last_sync = get_last_sync_timestamp(&db_guard, "orders")?;

        // Query changed orders
        let mut stmt = db_guard.prepare(
            "SELECT id, order_number, order_type, status, subtotal, tax, total,
                    payment_method, table_number, customer_name, customer_phone,
                    notes, source, created_at, updated_at, completed_at
             FROM orders
             WHERE updated_at > ?1 OR created_at > ?1
             ORDER BY updated_at DESC
             LIMIT 500"
        )?;

        let orders_iter = stmt.query_map([&last_sync], |row| {
            Ok(Order {
                id: row.get(0)?,
                order_number: row.get(1)?,
                order_type: row.get(2)?,
                status: row.get(3)?,
                subtotal: row.get(4)?,
                tax: row.get(5)?,
                total: row.get(6)?,
                payment_method: row.get(7)?,
                table_number: row.get(8)?,
                customer_name: row.get(9)?,
                customer_phone: row.get(10)?,
                notes: row.get(11)?,
                source: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
                completed_at: row.get(15)?,
                items: None,
            })
        })?;

        let mut orders: Vec<Order> = orders_iter.filter_map(Result::ok).collect();

        if orders.is_empty() {
            return Ok(SyncResult {
                success: true,
                synced: 0,
                failed: 0,
                errors: vec![],
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        // Fetch order items for each order
        for order in &mut orders {
            let mut items_stmt = db_guard.prepare(
                "SELECT id, order_id, menu_item_id, name, quantity, price, customization, item_total
                 FROM order_items
                 WHERE order_id = ?1"
            )?;

            let items_iter = items_stmt.query_map([&order.id], |row| {
                Ok(OrderItem {
                    id: row.get(0)?,
                    order_id: row.get(1)?,
                    menu_item_id: row.get(2)?,
                    name: row.get(3)?,
                    quantity: row.get(4)?,
                    price: row.get(5)?,
                    customization: row.get(6)?,
                    item_total: row.get(7)?,
                })
            })?;

            order.items = Some(items_iter.filter_map(Result::ok).collect());
        }

        orders
    }; // Lock is released here

    println!("[Sync] Found {} changed orders to sync", orders.len());

    // Sync to cloud (no lock held during HTTP call)
    let result = sync_to_cloud(config, "/orders/sync", json!({ "orders": orders })).await?;

    // Update timestamp if successful
    if result.success {
        let db_guard = db.lock().await;
        update_last_sync_timestamp(&db_guard, "orders", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync tips incrementally
pub async fn sync_tips(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "tips")?;

    // Query changed tips
    let mut stmt = db.prepare(
        "SELECT id, invoice_number, order_type, tip_amount, server_name, staff_id,
                created_at, tip_date
         FROM tips
         WHERE created_at > ?1
         ORDER BY created_at DESC
         LIMIT 500"
    )?;

    let tips_iter = stmt.query_map([&last_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "invoiceNumber": row.get::<_, String>(1)?,
            "orderType": row.get::<_, String>(2)?,
            "tipAmount": row.get::<_, f64>(3)?,
            "serverName": row.get::<_, Option<String>>(4)?,
            "staffId": row.get::<_, Option<String>>(5)?,
            "createdAt": row.get::<_, String>(6)?,
            "tipDate": row.get::<_, String>(7)?,
        }))
    })?;

    let tips: Vec<Value> = tips_iter.filter_map(Result::ok).collect();

    if tips.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} changed tips to sync", tips.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/tips/sync", json!({ "tips": tips })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "tips", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync sales transactions incrementally
pub async fn sync_sales(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "sales_transactions")?;

    // Query changed sales
    let mut stmt = db.prepare(
        "SELECT id, invoice_number, order_number, order_type, table_number, source,
                subtotal, service_charge, cgst, sgst, discount, round_off, grand_total,
                payment_method, payment_status, items_json, cashier_name, staff_id,
                created_at, completed_at
         FROM sales_transactions
         WHERE completed_at > ?1
         ORDER BY completed_at DESC
         LIMIT 500"
    )?;

    let sales_iter = stmt.query_map([&last_sync], |row| {
        // Parse items_json string back to JSON
        let items_json_str: String = row.get(15)?;
        let items_json: Value = serde_json::from_str(&items_json_str).unwrap_or(json!([]));

        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "invoiceNumber": row.get::<_, String>(1)?,
            "orderNumber": row.get::<_, Option<String>>(2)?,
            "orderType": row.get::<_, String>(3)?,
            "tableNumber": row.get::<_, Option<i32>>(4)?,
            "source": row.get::<_, String>(5)?,
            "subtotal": row.get::<_, f64>(6)?,
            "serviceCharge": row.get::<_, Option<f64>>(7)?,
            "cgst": row.get::<_, Option<f64>>(8)?,
            "sgst": row.get::<_, Option<f64>>(9)?,
            "discount": row.get::<_, Option<f64>>(10)?,
            "roundOff": row.get::<_, Option<f64>>(11)?,
            "grandTotal": row.get::<_, f64>(12)?,
            "paymentMethod": row.get::<_, String>(13)?,
            "paymentStatus": row.get::<_, String>(14)?,
            "items": items_json,
            "cashierName": row.get::<_, Option<String>>(16)?,
            "staffId": row.get::<_, Option<String>>(17)?,
            "createdAt": row.get::<_, String>(18)?,
            "completedAt": row.get::<_, String>(19)?,
        }))
    })?;

    let sales: Vec<Value> = sales_iter.filter_map(Result::ok).collect();

    if sales.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} changed sales to sync", sales.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/sales/sync", json!({ "transactions": sales })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "sales_transactions", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync menu items incrementally
pub async fn sync_menu_items(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "menu_items")?;

    // Query changed menu items
    let mut stmt = db.prepare(
        "SELECT id, name, name_hindi, name_local, category, description, price, photo_url,
                cloudflare_image_id, available, is_vegetarian, is_vegan, spice_level,
                allergens, tags, display_order, is_bestseller, order_count,
                last_bestseller_update, created_at, updated_at, synced_from_filesearch,
                filesearch_sync_at
         FROM menu_items
         WHERE updated_at > ?1
         ORDER BY updated_at DESC
         LIMIT 500"
    )?;

    let menu_items_iter = stmt.query_map([&last_sync], |row| {
        // Parse tags JSON if present
        let tags_str: Option<String> = row.get(14)?;
        let tags_json: Option<Value> = tags_str.and_then(|s| serde_json::from_str(&s).ok());

        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "nameHindi": row.get::<_, Option<String>>(2)?,
            "nameLocal": row.get::<_, Option<String>>(3)?,
            "category": row.get::<_, String>(4)?,
            "description": row.get::<_, Option<String>>(5)?,
            "price": row.get::<_, f64>(6)?,
            "photoUrl": row.get::<_, Option<String>>(7)?,
            "cloudflareImageId": row.get::<_, Option<String>>(8)?,
            "available": row.get::<_, i32>(9)? == 1,
            "isVegetarian": row.get::<_, i32>(10)? == 1,
            "isVegan": row.get::<_, i32>(11)? == 1,
            "spiceLevel": row.get::<_, Option<String>>(12)?,
            "allergens": row.get::<_, Option<String>>(13)?,
            "tags": tags_json,
            "displayOrder": row.get::<_, Option<i32>>(15)?,
            "isBestseller": row.get::<_, i32>(16)? == 1,
            "orderCount": row.get::<_, Option<i32>>(17)?,
            "lastBestsellerUpdate": row.get::<_, Option<String>>(18)?,
            "createdAt": row.get::<_, String>(19)?,
            "updatedAt": row.get::<_, String>(20)?,
            "syncedFromFilesearch": row.get::<_, i32>(21)? == 1,
            "filesearchSyncAt": row.get::<_, Option<String>>(22)?,
        }))
    })?;

    let menu_items: Vec<Value> = menu_items_iter.filter_map(Result::ok).collect();

    if menu_items.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} changed menu items to sync", menu_items.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/menu/sync", json!({ "menuItems": menu_items })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "menu_items", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync staff users incrementally
pub async fn sync_staff(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "staff_users")?;

    // Query changed staff users
    let mut stmt = db.prepare(
        "SELECT id, name, role, pin_hash, is_active, phone, email, created_at, updated_at
         FROM staff_users
         WHERE created_at > ?1 OR updated_at > ?1
         ORDER BY updated_at DESC
         LIMIT 100"
    )?;

    let staff_iter = stmt.query_map([&last_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "role": row.get::<_, String>(2)?,
            "pinHash": row.get::<_, String>(3)?,
            "isActive": row.get::<_, i32>(4)? == 1,
            "phone": row.get::<_, Option<String>>(5)?,
            "email": row.get::<_, Option<String>>(6)?,
            "createdAt": row.get::<_, String>(7)?,
            "updatedAt": row.get::<_, String>(8)?,
        }))
    })?;

    let staff: Vec<Value> = staff_iter.filter_map(Result::ok).collect();

    if staff.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} changed staff users to sync", staff.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/staff/sync", json!({ "staff": staff })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "staff_users", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync staff login history incrementally
pub async fn sync_staff_login_history(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "staff_login_history")?;

    // Query changed login history
    let mut stmt = db.prepare(
        "SELECT id, staff_id, login_at, device_id, success
         FROM staff_login_history
         WHERE login_at > ?1
         ORDER BY login_at DESC
         LIMIT 500"
    )?;

    let login_history_iter = stmt.query_map([&last_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "staffId": row.get::<_, String>(1)?,
            "loginAt": row.get::<_, String>(2)?,
            "deviceId": row.get::<_, Option<String>>(3)?,
            "success": row.get::<_, i32>(4)? == 1,
        }))
    })?;

    let login_history: Vec<Value> = login_history_iter.filter_map(Result::ok).collect();

    if login_history.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} login history records to sync", login_history.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/staff/login-history/sync", json!({ "loginHistory": login_history })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "staff_login_history", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync daily cash registers incrementally
pub async fn sync_cash_registers(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "daily_cash_registers")?;

    // Query changed cash registers
    let mut stmt = db.prepare(
        "SELECT id, business_date, opening_cash, closing_cash, total_cash_sales,
                total_upi_sales, total_card_sales, total_other_sales, expected_cash,
                actual_cash, variance, opened_by, closed_by, created_at, updated_at
         FROM daily_cash_registers
         WHERE updated_at > ?1
         ORDER BY updated_at DESC
         LIMIT 100"
    )?;

    let cash_registers_iter = stmt.query_map([&last_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "businessDate": row.get::<_, String>(1)?,
            "openingCash": row.get::<_, f64>(2)?,
            "closingCash": row.get::<_, Option<f64>>(3)?,
            "totalCashSales": row.get::<_, Option<f64>>(4)?,
            "totalUpiSales": row.get::<_, Option<f64>>(5)?,
            "totalCardSales": row.get::<_, Option<f64>>(6)?,
            "totalOtherSales": row.get::<_, Option<f64>>(7)?,
            "expectedCash": row.get::<_, Option<f64>>(8)?,
            "actualCash": row.get::<_, Option<f64>>(9)?,
            "variance": row.get::<_, Option<f64>>(10)?,
            "openedBy": row.get::<_, String>(11)?,
            "closedBy": row.get::<_, Option<String>>(12)?,
            "createdAt": row.get::<_, String>(13)?,
            "updatedAt": row.get::<_, String>(14)?,
        }))
    })?;

    let cash_registers: Vec<Value> = cash_registers_iter.filter_map(Result::ok).collect();

    if cash_registers.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} cash registers to sync", cash_registers.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/cash-registers/sync", json!({ "cashRegisters": cash_registers })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "daily_cash_registers", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync cash payouts incrementally
pub async fn sync_cash_payouts(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "cash_payouts")?;

    // Query changed cash payouts
    let mut stmt = db.prepare(
        "SELECT id, business_date, payout_type, amount, description, recipient,
                category, payment_method, reference_number, approved_by,
                created_at, updated_at
         FROM cash_payouts
         WHERE updated_at > ?1
         ORDER BY updated_at DESC
         LIMIT 200"
    )?;

    let payouts_iter = stmt.query_map([&last_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "businessDate": row.get::<_, String>(1)?,
            "payoutType": row.get::<_, String>(2)?,
            "amount": row.get::<_, f64>(3)?,
            "description": row.get::<_, String>(4)?,
            "recipient": row.get::<_, Option<String>>(5)?,
            "category": row.get::<_, Option<String>>(6)?,
            "paymentMethod": row.get::<_, String>(7)?,
            "referenceNumber": row.get::<_, Option<String>>(8)?,
            "approvedBy": row.get::<_, String>(9)?,
            "createdAt": row.get::<_, String>(10)?,
            "updatedAt": row.get::<_, String>(11)?,
        }))
    })?;

    let payouts: Vec<Value> = payouts_iter.filter_map(Result::ok).collect();

    if payouts.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} cash payouts to sync", payouts.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/cash-payouts/sync", json!({ "payouts": payouts })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "cash_payouts", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync inventory suppliers incrementally
pub async fn sync_inventory_suppliers(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "inventory_suppliers")?;

    // Query changed suppliers
    let mut stmt = db.prepare(
        "SELECT id, name, contact_person, phone, email, address, city, state, pincode,
                gstin, pan, payment_terms, credit_days, bank_name, account_number,
                ifsc_code, created_at, updated_at
         FROM inventory_suppliers
         WHERE updated_at > ?1
         ORDER BY updated_at DESC
         LIMIT 100"
    )?;

    let suppliers_iter = stmt.query_map([&last_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "contactPerson": row.get::<_, Option<String>>(2)?,
            "phone": row.get::<_, Option<String>>(3)?,
            "email": row.get::<_, Option<String>>(4)?,
            "address": row.get::<_, Option<String>>(5)?,
            "city": row.get::<_, Option<String>>(6)?,
            "state": row.get::<_, Option<String>>(7)?,
            "pincode": row.get::<_, Option<String>>(8)?,
            "gstin": row.get::<_, Option<String>>(9)?,
            "pan": row.get::<_, Option<String>>(10)?,
            "paymentTerms": row.get::<_, Option<String>>(11)?,
            "creditDays": row.get::<_, Option<i32>>(12)?,
            "bankName": row.get::<_, Option<String>>(13)?,
            "accountNumber": row.get::<_, Option<String>>(14)?,
            "ifscCode": row.get::<_, Option<String>>(15)?,
            "createdAt": row.get::<_, String>(16)?,
            "updatedAt": row.get::<_, String>(17)?,
        }))
    })?;

    let suppliers: Vec<Value> = suppliers_iter.filter_map(Result::ok).collect();

    if suppliers.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} inventory suppliers to sync", suppliers.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/inventory/suppliers/sync", json!({ "suppliers": suppliers })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "inventory_suppliers", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync inventory items incrementally
pub async fn sync_inventory_items(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "inventory_items")?;

    // Query changed inventory items
    let mut stmt = db.prepare(
        "SELECT id, name, category, unit, current_quantity, reorder_level,
                max_stock_level, unit_price, supplier_id, description, storage_location,
                created_at, updated_at
         FROM inventory_items
         WHERE updated_at > ?1
         ORDER BY updated_at DESC
         LIMIT 500"
    )?;

    let items_iter = stmt.query_map([&last_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "category": row.get::<_, String>(2)?,
            "unit": row.get::<_, String>(3)?,
            "currentQuantity": row.get::<_, f64>(4)?,
            "reorderLevel": row.get::<_, Option<f64>>(5)?,
            "maxStockLevel": row.get::<_, Option<f64>>(6)?,
            "unitPrice": row.get::<_, Option<f64>>(7)?,
            "supplierId": row.get::<_, Option<String>>(8)?,
            "description": row.get::<_, Option<String>>(9)?,
            "storageLocation": row.get::<_, Option<String>>(10)?,
            "createdAt": row.get::<_, String>(11)?,
            "updatedAt": row.get::<_, String>(12)?,
        }))
    })?;

    let items: Vec<Value> = items_iter.filter_map(Result::ok).collect();

    if items.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} inventory items to sync", items.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/inventory/items/sync", json!({ "items": items })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "inventory_items", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync inventory transactions incrementally
pub async fn sync_inventory_transactions(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_sync = get_last_sync_timestamp(db, "inventory_transactions")?;

    // Query changed inventory transactions
    let mut stmt = db.prepare(
        "SELECT id, item_id, transaction_type, quantity, unit_price, total_amount,
                reference_type, reference_id, supplier_id, notes, performed_by,
                transaction_date, created_at
         FROM inventory_transactions
         WHERE created_at > ?1
         ORDER BY created_at DESC
         LIMIT 500"
    )?;

    let transactions_iter = stmt.query_map([&last_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "itemId": row.get::<_, String>(1)?,
            "transactionType": row.get::<_, String>(2)?,
            "quantity": row.get::<_, f64>(3)?,
            "unitPrice": row.get::<_, Option<f64>>(4)?,
            "totalAmount": row.get::<_, Option<f64>>(5)?,
            "referenceType": row.get::<_, Option<String>>(6)?,
            "referenceId": row.get::<_, Option<String>>(7)?,
            "supplierId": row.get::<_, Option<String>>(8)?,
            "notes": row.get::<_, Option<String>>(9)?,
            "performedBy": row.get::<_, String>(10)?,
            "transactionDate": row.get::<_, String>(11)?,
            "createdAt": row.get::<_, String>(12)?,
        }))
    })?;

    let transactions: Vec<Value> = transactions_iter.filter_map(Result::ok).collect();

    if transactions.is_empty() {
        return Ok(SyncResult {
            success: true,
            synced: 0,
            failed: 0,
            errors: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    println!("[Sync] Found {} inventory transactions to sync", transactions.len());

    // Sync to cloud
    let result = sync_to_cloud(config, "/inventory/transactions/sync", json!({ "transactions": transactions })).await?;

    // Update timestamp if successful
    if result.success {
        update_last_sync_timestamp(db, "inventory_transactions", None)?;
    }

    Ok(SyncResult {
        success: result.success,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync inventory recipes incrementally
pub async fn sync_inventory_recipes(
    db: &Connection,
    config: &SyncConfig,
) -> SqliteResult<SyncResult> {
    if !is_online() {
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec!["Offline".to_string()],
            duration_ms: 0,
        });
    }

    let start = Instant::now();
    let last_recipe_sync = get_last_sync_timestamp(db, "inventory_recipes")?;
    let last_ingredient_sync = get_last_sync_timestamp(db, "inventory_recipe_ingredients")?;

    // Query changed recipes
    let mut recipes_stmt = db.prepare(
        "SELECT id, menu_item_id, recipe_name, serving_size, preparation_time,
                total_cost, created_at, updated_at
         FROM inventory_recipes
         WHERE updated_at > ?1
         ORDER BY updated_at DESC
         LIMIT 200"
    )?;

    let recipes_iter = recipes_stmt.query_map([&last_recipe_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "menuItemId": row.get::<_, String>(1)?,
            "recipeName": row.get::<_, String>(2)?,
            "servingSize": row.get::<_, f64>(3)?,
            "preparationTime": row.get::<_, Option<i32>>(4)?,
            "totalCost": row.get::<_, Option<f64>>(5)?,
            "createdAt": row.get::<_, String>(6)?,
            "updatedAt": row.get::<_, String>(7)?,
        }))
    })?;

    let recipes: Vec<Value> = recipes_iter.filter_map(Result::ok).collect();

    // Query changed recipe ingredients
    let mut ingredients_stmt = db.prepare(
        "SELECT id, recipe_id, item_id, quantity, unit, waste_percentage, created_at
         FROM inventory_recipe_ingredients
         WHERE created_at > ?1
         ORDER BY created_at DESC
         LIMIT 500"
    )?;

    let ingredients_iter = ingredients_stmt.query_map([&last_ingredient_sync], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "recipeId": row.get::<_, String>(1)?,
            "itemId": row.get::<_, String>(2)?,
            "quantity": row.get::<_, f64>(3)?,
            "unit": row.get::<_, String>(4)?,
            "wastePercentage": row.get::<_, Option<f64>>(5)?,
            "createdAt": row.get::<_, String>(6)?,
        }))
    })?;

    let ingredients: Vec<Value> = ingredients_iter.filter_map(Result::ok).collect();

    let mut recipes_synced = 0;
    let mut ingredients_synced = 0;
    let mut errors: Vec<String> = vec![];

    // Sync recipes
    if !recipes.is_empty() {
        println!("[Sync] Found {} recipes to sync", recipes.len());
        match sync_to_cloud(config, "/inventory/recipes/sync", json!({ "recipes": recipes })).await {
            Ok(result) => {
                if result.success {
                    recipes_synced = result.synced;
                    update_last_sync_timestamp(db, "inventory_recipes", None)?;
                } else {
                    errors.extend(result.errors);
                }
            }
            Err(e) => {
                errors.push(format!("Recipes sync failed: {}", e));
            }
        }
    }

    // Sync recipe ingredients
    if !ingredients.is_empty() {
        println!("[Sync] Found {} recipe ingredients to sync", ingredients.len());
        match sync_to_cloud(config, "/inventory/recipe-ingredients/sync", json!({ "recipeIngredients": ingredients })).await {
            Ok(result) => {
                if result.success {
                    ingredients_synced = result.synced;
                    update_last_sync_timestamp(db, "inventory_recipe_ingredients", None)?;
                } else {
                    errors.extend(result.errors);
                }
            }
            Err(e) => {
                errors.push(format!("Recipe ingredients sync failed: {}", e));
            }
        }
    }

    let duration = start.elapsed().as_millis() as u64;

    Ok(SyncResult {
        success: errors.is_empty(),
        synced: recipes_synced + ingredients_synced,
        failed: 0,
        errors,
        duration_ms: duration,
    })
}

/// Generic function to sync data to cloud
async fn sync_to_cloud(
    config: &SyncConfig,
    endpoint: &str,
    data: Value,
) -> SqliteResult<SyncResult> {
    let client = Client::new();
    let url = format!("{}{}", config.api_base_url, endpoint);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Tenant-Id", &config.tenant_id)
        .json(&data)
        .send()
        .await
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    if !response.status().is_success() {
        let status = response.status();
        return Ok(SyncResult {
            success: false,
            synced: 0,
            failed: 0,
            errors: vec![format!("HTTP {}: {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown"))],
            duration_ms: 0,
        });
    }

    let result: CloudSyncResult = response
        .json()
        .await
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    Ok(SyncResult {
        success: result.success,
        synced: result.synced.unwrap_or(0),
        failed: result.failed.unwrap_or(0),
        errors: result.errors.unwrap_or_default(),
        duration_ms: 0,
    })
}

#[derive(Debug, Deserialize)]
struct CloudSyncResult {
    success: bool,
    synced: Option<usize>,
    failed: Option<usize>,
    errors: Option<Vec<String>>,
}
