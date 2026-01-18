/**
 * Tiered Sync Scheduler for Tauri
 * Manages periodic sync intervals with different priorities for different data types
 */

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use super::SyncConfig;
use super::incremental_sync::{
    sync_orders, sync_tips, sync_sales, sync_menu_items,
    sync_staff, sync_staff_login_history,
    sync_cash_registers, sync_cash_payouts,
    sync_inventory_suppliers, sync_inventory_items,
    sync_inventory_transactions, sync_inventory_recipes,
};

// Re-export DbConnection for commands.rs
pub use super::incremental_sync::DbConnection;

/// Tiered sync scheduler
pub struct TieredSyncScheduler {
    db: DbConnection,
    config: SyncConfig,
    handles: Vec<JoinHandle<()>>,
    is_running: Arc<Mutex<bool>>,
}

impl TieredSyncScheduler {
    pub fn new(db: DbConnection, config: SyncConfig) -> Self {
        Self {
            db,
            config,
            handles: Vec::new(),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Start all sync intervals
    pub async fn start(&mut self) {
        let mut running = self.is_running.lock().await;
        if *running {
            println!("[TieredSync] Already running");
            return;
        }
        *running = true;
        drop(running);

        println!("[TieredSync] Starting tiered sync scheduler...");

        let db = self.db.clone();
        let config = self.config.clone();

        // Tier 1: Critical data (1 minute)
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("orders", Duration::from_secs(60), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_orders(db, &config).await }
            });
        }
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("tips", Duration::from_secs(60), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_tips(db, &config).await }
            });
        }
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("sales", Duration::from_secs(60), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_sales(db, &config).await }
            });
        }

        // Tier 2: Important data (3 minutes)
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("staff_login_history", Duration::from_secs(180), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_staff_login_history(db, &config).await }
            });
        }
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("cash_payouts", Duration::from_secs(180), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_cash_payouts(db, &config).await }
            });
        }
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("inventory_transactions", Duration::from_secs(180), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_inventory_transactions(db, &config).await }
            });
        }

        // Tier 3: Configuration data (10 minutes)
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("menu_items", Duration::from_secs(600), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_menu_items(db, &config).await }
            });
        }
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("staff", Duration::from_secs(600), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_staff(db, &config).await }
            });
        }
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("inventory_items", Duration::from_secs(600), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_inventory_items(db, &config).await }
            });
        }
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("inventory_suppliers", Duration::from_secs(600), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_inventory_suppliers(db, &config).await }
            });
        }

        // Tier 4: Bulk data (30 minutes)
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("cash_registers", Duration::from_secs(1800), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_cash_registers(db, &config).await }
            });
        }
        {
            let db = db.clone();
            let config = config.clone();
            self.schedule_sync("inventory_recipes", Duration::from_secs(1800), move || {
                let db = db.clone();
                let config = config.clone();
                async move { sync_inventory_recipes(db, &config).await }
            });
        }

        println!("[TieredSync] All sync intervals started");
    }

    /// Stop all sync intervals
    pub async fn stop(&mut self) {
        println!("[TieredSync] Stopping all sync intervals...");

        let mut running = self.is_running.lock().await;
        *running = false;
        drop(running);

        // Cancel all running tasks
        for handle in self.handles.drain(..) {
            handle.abort();
        }

        println!("[TieredSync] All sync intervals stopped");
    }

    /// Schedule a sync function to run at a specific interval
    fn schedule_sync<F, Fut>(&mut self, name: &'static str, interval: Duration, sync_fn: F)
    where
        F: Fn() -> Fut + Send + 'static,
        Fut: std::future::Future<Output = rusqlite::Result<super::SyncResult>> + Send + 'static,
    {
        let is_running = self.is_running.clone();

        let handle = tokio::spawn(async move {
            println!("[TieredSync] Started interval: {} (every {}s)", name, interval.as_secs());

            // Run immediately on start
            match sync_fn().await {
                Ok(result) => {
                    if result.synced > 0 {
                        println!("[TieredSync] {} initial sync: {} records synced", name, result.synced);
                    }
                }
                Err(e) => {
                    eprintln!("[TieredSync] {} initial sync failed: {}", name, e);
                }
            }

            // Then run on interval
            let mut interval_timer = tokio::time::interval(interval);
            interval_timer.tick().await; // First tick completes immediately

            loop {
                interval_timer.tick().await;

                let running = is_running.lock().await;
                if !*running {
                    break;
                }
                drop(running);

                match sync_fn().await {
                    Ok(result) => {
                        if result.synced > 0 {
                            println!("[TieredSync] {} synced: {} records in {}ms", name, result.synced, result.duration_ms);
                        }
                        if result.failed > 0 {
                            eprintln!("[TieredSync] {} sync errors: {} failed", name, result.failed);
                        }
                    }
                    Err(e) => {
                        eprintln!("[TieredSync] {} sync failed: {}", name, e);
                    }
                }
            }

            println!("[TieredSync] Stopped interval: {}", name);
        });

        self.handles.push(handle);
    }

    /// Trigger immediate sync for a specific data type
    pub async fn trigger_immediate_sync(&self, data_type: &str) -> Result<(), String> {
        println!("[TieredSync] Triggering immediate sync for: {}", data_type);

        let db = self.db.clone();
        let config = self.config.clone();

        let result = match data_type {
            "orders" => sync_orders(db, &config).await,
            "tips" => sync_tips(db, &config).await,
            "sales" => sync_sales(db, &config).await,
            "menu_items" => sync_menu_items(db, &config).await,
            "staff" => sync_staff(db, &config).await,
            "staff_login_history" => sync_staff_login_history(db, &config).await,
            "cash_registers" => sync_cash_registers(db, &config).await,
            "cash_payouts" => sync_cash_payouts(db, &config).await,
            "inventory_suppliers" => sync_inventory_suppliers(db, &config).await,
            "inventory_items" => sync_inventory_items(db, &config).await,
            "inventory_transactions" => sync_inventory_transactions(db, &config).await,
            "inventory_recipes" => sync_inventory_recipes(db, &config).await,
            _ => return Err(format!("Unknown data type: {}", data_type)),
        };

        match result {
            Ok(sync_result) => {
                if sync_result.success {
                    println!("[TieredSync] Immediate sync completed: {} synced, {} failed", sync_result.synced, sync_result.failed);
                    Ok(())
                } else {
                    Err(format!("Sync failed: {:?}", sync_result.errors))
                }
            }
            Err(e) => Err(format!("Sync error: {}", e)),
        }
    }

    /// Get sync status
    pub async fn get_status(&self) -> SyncStatus {
        let running = self.is_running.lock().await;
        SyncStatus {
            is_running: *running,
            active_intervals: self.handles.len(),
        }
    }
}

#[derive(Debug)]
pub struct SyncStatus {
    pub is_running: bool,
    pub active_intervals: usize,
}
