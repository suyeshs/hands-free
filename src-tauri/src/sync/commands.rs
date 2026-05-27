/**
 * Tauri Commands for Sync Operations
 * Exposes Rust sync functions to the frontend
 */

use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

use super::{
    SyncConfig, SyncResult, SyncStatus,
    tiered_scheduler::{TieredSyncScheduler, DbConnection},
    offline_queue,
};

/// Global sync scheduler state
pub struct SyncSchedulerState {
    pub scheduler: Arc<Mutex<Option<TieredSyncScheduler>>>,
    pub db: DbConnection,
    pub config: Arc<Mutex<SyncConfig>>,
}

/// Initialize sync system
#[tauri::command]
pub async fn init_sync(
    tenant_id: String,
    api_base_url: String,
    state: State<'_, SyncSchedulerState>,
) -> Result<String, String> {
    println!("[Sync] Initializing sync system for tenant: {}", tenant_id);

    let config = SyncConfig {
        tenant_id,
        api_base_url,
        enable_auto_sync: true,
    };

    // Update config
    let mut config_guard = state.config.lock().await;
    *config_guard = config.clone();
    drop(config_guard);

    // Initialize database tables
    let db = state.db.lock().await;
    super::init_sync_system(&db).map_err(|e| format!("Failed to init sync system: {}", e))?;
    drop(db);

    // Create scheduler
    let scheduler = TieredSyncScheduler::new(state.db.clone(), config);

    let mut scheduler_guard = state.scheduler.lock().await;
    *scheduler_guard = Some(scheduler);

    Ok("Sync system initialized".to_string())
}

/// Start automatic sync with tiered intervals
#[tauri::command]
pub async fn start_auto_sync(state: State<'_, SyncSchedulerState>) -> Result<String, String> {
    let mut scheduler_guard = state.scheduler.lock().await;

    if let Some(scheduler) = scheduler_guard.as_mut() {
        scheduler.start().await;
        Ok("Auto sync started".to_string())
    } else {
        Err("Sync system not initialized".to_string())
    }
}

/// Stop automatic sync
#[tauri::command]
pub async fn stop_auto_sync(state: State<'_, SyncSchedulerState>) -> Result<String, String> {
    let mut scheduler_guard = state.scheduler.lock().await;

    if let Some(scheduler) = scheduler_guard.as_mut() {
        scheduler.stop().await;
        Ok("Auto sync stopped".to_string())
    } else {
        Err("Sync system not initialized".to_string())
    }
}

/// Trigger immediate sync for a specific data type
#[tauri::command]
pub async fn trigger_sync(
    data_type: String,
    state: State<'_, SyncSchedulerState>,
) -> Result<SyncResult, String> {
    let scheduler_guard = state.scheduler.lock().await;

    if let Some(scheduler) = scheduler_guard.as_ref() {
        scheduler.trigger_immediate_sync(&data_type).await?;

        // Return a basic success result
        Ok(SyncResult {
            success: true,
            synced: 0, // Actual count handled internally
            failed: 0,
            errors: vec![],
            duration_ms: 0,
        })
    } else {
        Err("Sync system not initialized".to_string())
    }
}

/// Get sync status
#[tauri::command]
pub async fn get_sync_status(state: State<'_, SyncSchedulerState>) -> Result<SyncStatus, String> {
    let scheduler_guard = state.scheduler.lock().await;

    let is_syncing = if let Some(scheduler) = scheduler_guard.as_ref() {
        let status = scheduler.get_status().await;
        status.is_running
    } else {
        false
    };

    drop(scheduler_guard);

    // Get queue stats
    let db = state.db.lock().await;
    let pending_count = offline_queue::get_queue_count(&db, None)
        .map_err(|e| format!("Failed to get queue count: {}", e))?;

    let last_sync_timestamp = super::get_last_sync_timestamp(&db, "sync:last_run")
        .ok()
        .and_then(|ts| ts.parse::<u64>().ok());

    drop(db);

    Ok(SyncStatus {
        is_syncing,
        last_sync: last_sync_timestamp,
        pending_count,
        is_online: super::is_online(),
    })
}

/// Get offline queue statistics
#[tauri::command]
pub async fn get_queue_stats(state: State<'_, SyncSchedulerState>) -> Result<QueueStatsResponse, String> {
    let db = state.db.lock().await;

    let stats = offline_queue::get_queue_stats(&db)
        .map_err(|e| format!("Failed to get queue stats: {}", e))?;

    Ok(QueueStatsResponse {
        total: stats.total,
        pending: stats.pending,
        failed: stats.failed,
        oldest_timestamp: stats.oldest_timestamp,
    })
}

/// Clear failed queue items
#[tauri::command]
pub async fn clear_failed_queue(state: State<'_, SyncSchedulerState>) -> Result<usize, String> {
    let db = state.db.lock().await;

    offline_queue::clear_failed_items(&db)
        .map_err(|e| format!("Failed to clear failed items: {}", e))
}

/// Process offline queue manually
#[tauri::command]
pub async fn process_offline_queue(state: State<'_, SyncSchedulerState>) -> Result<ProcessQueueResult, String> {
    let config_guard = state.config.lock().await;
    let config = config_guard.clone();
    drop(config_guard);

    // Get all pending items (keep lock only while reading)
    let pending_items = {
        let db_guard = state.db.lock().await;
        offline_queue::get_all_pending_items(&*db_guard, 100)
            .map_err(|e| format!("Failed to get pending items: {}", e))?
    }; // Lock released here

    let total = pending_items.len();
    let mut synced = 0;
    let mut failed = 0;

    // Group by table and sync
    use std::collections::HashMap;
    let mut by_table: HashMap<String, Vec<serde_json::Value>> = HashMap::new();

    for item in pending_items {
        by_table.entry(item.table_name.clone())
            .or_insert_with(Vec::new)
            .push(item.data);
    }

    // Sync each table's pending items
    for (table_name, records) in by_table {
        let endpoint = get_sync_endpoint(&table_name);
        let payload = serde_json::json!({ get_payload_key(&table_name): records });

        match sync_to_cloud(&config, &endpoint, payload).await {
            Ok(_) => {
                synced += records.len();
            }
            Err(e) => {
                failed += records.len();
                eprintln!("[OfflineQueue] Failed to sync {}: {}", table_name, e);
            }
        }
    }

    Ok(ProcessQueueResult {
        total,
        synced,
        failed,
    })
}

// Helper functions

fn get_sync_endpoint(table_name: &str) -> String {
    match table_name {
        "orders" => "/orders/sync".to_string(),
        "tips" => "/tips/sync".to_string(),
        "sales_transactions" => "/sales/sync".to_string(),
        "menu_items" => "/menu/sync".to_string(),
        "menu_categories" => "/categories/sync".to_string(),
        "staff_users" => "/staff/sync".to_string(),
        "staff_login_history" => "/staff/login-history/sync".to_string(),
        "daily_cash_registers" => "/cash-registers/sync".to_string(),
        "cash_payouts" => "/cash-payouts/sync".to_string(),
        "inventory_suppliers" => "/inventory/suppliers/sync".to_string(),
        "inventory_items" => "/inventory/items/sync".to_string(),
        "inventory_transactions" => "/inventory/transactions/sync".to_string(),
        "inventory_recipes" => "/inventory/recipes/sync".to_string(),
        "floor_sections" => "/admin/floor-plan/sections/sync".to_string(),
        "floor_tables" => "/admin/floor-plan/tables/sync".to_string(),
        "floor_staff_assignments" => "/admin/floor-plan/assignments/sync".to_string(),
        _ => format!("/{}/sync", table_name),
    }
}

fn get_payload_key(table_name: &str) -> &str {
    match table_name {
        "sales_transactions" => "transactions",
        "menu_items" => "menuItems",
        "menu_categories" => "categories",
        "staff_users" => "staff",
        "staff_login_history" => "loginHistory",
        "daily_cash_registers" => "cashRegisters",
        "cash_payouts" => "payouts",
        "inventory_suppliers" => "suppliers",
        "inventory_items" => "items",
        "inventory_transactions" => "transactions",
        "inventory_recipes" => "recipes",
        "floor_sections" => "sections",
        "floor_tables" => "tables",
        "floor_staff_assignments" => "assignments",
        _ => table_name,
    }
}

async fn sync_to_cloud(config: &SyncConfig, endpoint: &str, data: serde_json::Value) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", config.api_base_url, endpoint);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Tenant-Id", &config.tenant_id)
        .json(&data)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}: {}", response.status().as_u16(), response.status().canonical_reason().unwrap_or("Unknown")));
    }

    Ok(())
}

/// Sync floor plan to cloud (sections, tables, assignments)
#[tauri::command]
pub async fn sync_floor_plan_to_cloud(
    tenant_id: String,
    state: State<'_, SyncSchedulerState>,
) -> Result<SyncResult, String> {
    let config_guard = state.config.lock().await;
    let config = config_guard.clone();
    drop(config_guard);

    let mut total_synced = 0;
    let mut total_failed = 0;
    let mut errors = Vec::new();

    let start = std::time::Instant::now();

    // Sync sections
    match sync_table_to_cloud(&state.db, &config, &tenant_id, "floor_sections").await {
        Ok(count) => total_synced += count,
        Err(e) => {
            total_failed += 1;
            errors.push(format!("Sections: {}", e));
        }
    }

    // Sync tables
    match sync_table_to_cloud(&state.db, &config, &tenant_id, "floor_tables").await {
        Ok(count) => total_synced += count,
        Err(e) => {
            total_failed += 1;
            errors.push(format!("Tables: {}", e));
        }
    }

    // Sync assignments
    match sync_table_to_cloud(&state.db, &config, &tenant_id, "floor_staff_assignments").await {
        Ok(count) => total_synced += count,
        Err(e) => {
            total_failed += 1;
            errors.push(format!("Assignments: {}", e));
        }
    }

    Ok(SyncResult {
        success: errors.is_empty(),
        synced: total_synced,
        failed: total_failed,
        errors,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Sync a single floor plan table to cloud
async fn sync_table_to_cloud(
    db: &DbConnection,
    config: &SyncConfig,
    tenant_id: &str,
    table_name: &str,
) -> Result<usize, String> {
    if config.api_base_url.is_empty() {
        return Err("HTTP request failed: Sync not initialized — call init_sync first".to_string());
    }

    // Get changed records since last sync
    let records = {
        let db_guard = db.lock().await;

        let last_sync = super::get_last_sync_timestamp(&db_guard, table_name)
            .map_err(|e| format!("Failed to get last sync timestamp: {}", e))?;

        let query = format!(
            "SELECT * FROM {} WHERE tenant_id = ?1 AND (updated_at > ?2 OR synced_at IS NULL) LIMIT 100",
            table_name
        );

        let mut stmt = db_guard.prepare(&query)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let column_count = stmt.column_count();
        let column_names: Vec<String> = (0..column_count)
            .map(|i| stmt.column_name(i).unwrap().to_string())
            .collect();

        let rows = stmt.query_map([tenant_id, &last_sync], |row| {
            let mut map = std::collections::HashMap::new();
            for (i, name) in column_names.iter().enumerate() {
                let value: String = row.get(i).unwrap_or_default();
                map.insert(name.clone(), value);
            }
            Ok(serde_json::to_value(map).unwrap())
        })
        .map_err(|e| format!("Failed to query: {}", e))?;

        rows.filter_map(Result::ok).collect::<Vec<_>>()
    }; // Lock released

    if records.is_empty() {
        return Ok(0);
    }

    let count = records.len();

    // Send to cloud
    let endpoint = get_sync_endpoint(table_name);
    let payload_key = get_payload_key(table_name);
    let payload = serde_json::json!({ payload_key: records });

    sync_to_cloud(config, &endpoint, payload).await?;

    // Update sync timestamp
    {
        let db_guard = db.lock().await;
        super::update_last_sync_timestamp(&db_guard, table_name, None)
            .map_err(|e| format!("Failed to update sync timestamp: {}", e))?;

        // Update synced_at for synced records
        let update_query = format!(
            "UPDATE {} SET synced_at = CURRENT_TIMESTAMP WHERE tenant_id = ?1 AND synced_at IS NULL",
            table_name
        );
        db_guard.execute(&update_query, [tenant_id])
            .map_err(|e| format!("Failed to update synced_at: {}", e))?;
    }

    Ok(count)
}

// Response types

#[derive(Debug, serde::Serialize)]
pub struct QueueStatsResponse {
    pub total: usize,
    pub pending: usize,
    pub failed: usize,
    pub oldest_timestamp: Option<u64>,
}

#[derive(Debug, serde::Serialize)]
pub struct ProcessQueueResult {
    pub total: usize,
    pub synced: usize,
    pub failed: usize,
}
