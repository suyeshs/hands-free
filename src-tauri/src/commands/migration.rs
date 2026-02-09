/**
 * Manual Database Migration Commands
 * Allows users to run migrations on-demand instead of automatic startup
 */

use tauri::{AppHandle, Manager};
use std::path::PathBuf;
use crate::migrations;
use crate::get_db_filename;

#[tauri::command]
pub async fn run_core_migrations(app: AppHandle) -> Result<String, String> {
    println!("[Migration Command] Manual migration triggered by user");

    // Get database path
    let db_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join(get_db_filename());

    println!("[Migration Command] Database: {:?}", db_path);

    // Run migrations
    migrations::run_migrations(&db_path)?;

    Ok("Migrations completed successfully".to_string())
}

#[tauri::command]
pub async fn check_migration_status(app: AppHandle) -> Result<MigrationStatus, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join(get_db_filename());

    // Check if database exists
    if !db_path.exists() {
        return Ok(MigrationStatus {
            is_fresh_install: true,
            migrations_applied: 0,
            migrations_pending: 0,
            needs_migration: true,
        });
    }

    // Check how many migrations are applied
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Check if schema_migrations table exists
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
            [],
            |row| {
                let count: i64 = row.get(0)?;
                Ok(count > 0)
            },
        )
        .unwrap_or(false);

    if !table_exists {
        return Ok(MigrationStatus {
            is_fresh_install: true,
            migrations_applied: 0,
            migrations_pending: 8, // Total base migrations count (plugin migrations excluded)
            needs_migration: true,
        });
    }

    // Count applied migrations
    let applied: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE source = 'built-in' AND checksum LIKE 'core-%'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(MigrationStatus {
        is_fresh_install: applied == 0,
        migrations_applied: applied as u32,
        migrations_pending: 8 - (applied as u32), // Total base migrations - applied
        needs_migration: applied < 8,
    })
}

#[derive(serde::Serialize)]
pub struct MigrationStatus {
    pub is_fresh_install: bool,
    pub migrations_applied: u32,
    pub migrations_pending: u32,
    pub needs_migration: bool,
}
