#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod migration;
mod types;

use migration::{
    detect_v1_database, run_full_migration, rollback_migration,
    DetectionResult, MigrationResult,
};

#[tauri::command]
async fn detect_database() -> Result<DetectionResult, String> {
    detect_v1_database().await
}

#[tauri::command]
async fn start_migration(app_handle: tauri::AppHandle) -> Result<MigrationResult, String> {
    run_full_migration(app_handle).await
}

#[tauri::command]
async fn rollback(backup_path: String) -> Result<(), String> {
    rollback_migration(&backup_path).await
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            detect_database,
            start_migration,
            rollback
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
