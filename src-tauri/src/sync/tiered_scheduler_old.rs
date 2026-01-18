/**
 * Tiered Sync Scheduler for Tauri
 * Manages periodic sync intervals with different priorities for different data types
 */

use rusqlite::Connection;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use super::{
    SyncConfig,
    incremental_sync::{
        sync_orders, sync_tips, sync_sales, sync_menu_items,
        sync_staff, sync_staff_login_history,
        sync_cash_registers, sync_cash_payouts,
        sync_inventory_suppliers, sync_inventory_items,
        sync_inventory_transactions, sync_inventory_recipes,
    },
};

pub type DbConnection = Arc<Mutex<Connection>>;

/// Sync tier configuration
#[derive(Debug, Clone)]
pub struct SyncTier {
    pub name: &'static str,
    pub interval: Duration,
    pub enabled: bool,
}

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

        // Tier 1: Critical data (1 minute)
        self.schedule_sync("orders", Duration::from_secs(60), |db, config| {
            Box::pin(async move { sync_orders(&db, &config).await })
        });

        self.schedule_sync("tips", Duration::from_secs(60), |db, config| {
            Box::pin(async move { sync_tips(&db, &config).await })
        });

        self.schedule_sync("sales", Duration::from_secs(60), |db, config| {
            Box::pin(async move { sync_sales(&db, &config).await })
        });

        // Tier 2: Important data (3 minutes)
        self.schedule_sync("staff_login_history", Duration::from_secs(180), |db, config| {
            Box::pin(async move { sync_staff_login_history(&db, &config).await })
        });

        self.schedule_sync("cash_payouts", Duration::from_secs(180), |db, config| {
            Box::pin(async move { sync_cash_payouts(&db, &config).await })
        });

        self.schedule_sync("inventory_transactions", Duration::from_secs(180), |db, config| {
            Box::pin(async move { sync_inventory_transactions(&db, &config).await })
        });

        // Tier 3: Configuration data (10 minutes)
        self.schedule_sync("menu_items", Duration::from_secs(600), |db, config| {
            Box::pin(async move { sync_menu_items(&db, &config).await })
        });

        self.schedule_sync("staff", Duration::from_secs(600), |db, config| {
            Box::pin(async move { sync_staff(&db, &config).await })
        });

        self.schedule_sync("inventory_items", Duration::from_secs(600), |db, config| {
            Box::pin(async move { sync_inventory_items(&db, &config).await })
        });

        self.schedule_sync("inventory_suppliers", Duration::from_secs(600), |db, config| {
            Box::pin(async move { sync_inventory_suppliers(&db, &config).await })
        });

        // Tier 4: Bulk data (30 minutes)
        self.schedule_sync("cash_registers", Duration::from_secs(1800), |db, config| {
            Box::pin(async move { sync_cash_registers(&db, &config).await })
        });

        self.schedule_sync("inventory_recipes", Duration::from_secs(1800), |db, config| {
            Box::pin(async move { sync_inventory_recipes(&db, &config).await })
        });

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
    fn schedule_sync<F>(&mut self, name: &'static str, interval: Duration, sync_fn: F)
    where
        F: Fn(Connection, SyncConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = rusqlite::Result<super::SyncResult>> + Send>> + Send + 'static,
    {
        let db = self.db.clone();
        let config = self.config.clone();
        let is_running = self.is_running.clone();

        let handle = tokio::spawn(async move {
            println!("[TieredSync] Started interval: {} (every {}s)", name, interval.as_secs());

            // Run immediately on start
            {
                let db_guard = db.lock().await;
                match sync_fn(db_guard.try_clone().unwrap(), config.clone()).await {
                    Ok(result) => {
                        if result.synced > 0 {
                            println!("[TieredSync] {} initial sync: {} records synced", name, result.synced);
                        }
                    }
                    Err(e) => {
                        eprintln!("[TieredSync] {} initial sync failed: {}", name, e);
                    }
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

                let db_guard = db.lock().await;
                match sync_fn(db_guard.try_clone().unwrap(), config.clone()).await {
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

        let db = self.db.lock().await;
        let db_clone = db.try_clone().map_err(|e| format!("DB clone failed: {}", e))?;
        drop(db);

        let result = match data_type {
            "orders" => sync_orders(&db_clone, &self.config).await,
            "tips" => sync_tips(&db_clone, &self.config).await,
            "sales" => sync_sales(&db_clone, &self.config).await,
            "menu_items" => sync_menu_items(&db_clone, &self.config).await,
            "staff" => sync_staff(&db_clone, &self.config).await,
            "staff_login_history" => sync_staff_login_history(&db_clone, &self.config).await,
            "cash_registers" => sync_cash_registers(&db_clone, &self.config).await,
            "cash_payouts" => sync_cash_payouts(&db_clone, &self.config).await,
            "inventory_suppliers" => sync_inventory_suppliers(&db_clone, &self.config).await,
            "inventory_items" => sync_inventory_items(&db_clone, &self.config).await,
            "inventory_transactions" => sync_inventory_transactions(&db_clone, &self.config).await,
            "inventory_recipes" => sync_inventory_recipes(&db_clone, &self.config).await,
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
