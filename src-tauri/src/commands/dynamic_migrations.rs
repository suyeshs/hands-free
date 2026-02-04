use crate::services::dynamic_migrations::{DynamicMigrationService, AppliedMigration};
use rusqlite::{Connection, params};
use tauri::Manager;

/// Apply a migration SQL directly (SQL content provided from frontend)
#[tauri::command]
pub fn apply_migration_sql(
    app: tauri::AppHandle,
    version: i32,
    name: String,
    description: Option<String>,
    sql_content: String,
    checksum: String,
) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let app_version = env!("CARGO_PKG_VERSION").to_string();

    let db = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Check if already applied
    let count: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
            params![version],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if count > 0 {
        println!("[DynamicMigrations] Migration {} already applied, skipping", name);
        return Ok(());
    }

    // Execute migration in transaction
    db.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    match db.execute_batch(&sql_content) {
        Ok(_) => {
            // Record migration as applied
            db.execute(
                "INSERT INTO schema_migrations (version, name, description, source, checksum, applied_at, app_version)
                 VALUES (?1, ?2, ?3, 'cloud', ?4, strftime('%s', 'now'), ?5)",
                params![version, &name, &description, &checksum, &app_version],
            )
            .map_err(|e| format!("Failed to record migration: {}", e))?;

            db.execute("COMMIT", [])
                .map_err(|e| format!("Failed to commit transaction: {}", e))?;

            println!("[DynamicMigrations] ✅ Applied migration {} (version {})", name, version);

            Ok(())
        }
        Err(e) => {
            db.execute("ROLLBACK", []).ok();
            Err(format!("Failed to apply migration: {}", e))
        }
    }
}

/// Sync dynamic migrations from cloud (DEPRECATED - use apply_migration_sql from frontend)
#[tauri::command]
pub async fn sync_dynamic_migrations(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    // Get tenant ID from database (if available)
    // For initial setup, use placeholder tenant_id to allow migrations to run
    let tenant_id = match get_tenant_id(&app) {
        Ok(id) => id,
        Err(e) => {
            // If no tenant is activated yet, use placeholder for initial migrations
            if e.contains("no rows") || e.contains("tenant_id") || e.contains("no such table") {
                println!("[DynamicMigrations] No tenant found - running initial setup migrations with placeholder tenant");
                "initial-setup".to_string()
            } else {
                return Err(e);
            }
        }
    };

    // Get app version from package.json
    let app_version = env!("CARGO_PKG_VERSION").to_string();

    // Get cloud base URL from env
    let cloud_base_url = std::env::var("VITE_API_BASE_URL")
        .unwrap_or_else(|_| "https://pub-828b3a74735b48008ba164cea04402bb.r2.dev".to_string());

    let service = DynamicMigrationService::new(
        db_path,
        cloud_base_url,
        tenant_id,
        app_version,
    );

    service.sync_migrations().await
}

/// Get migration history
#[tauri::command]
pub async fn get_migration_history(app: tauri::AppHandle) -> Result<Vec<AppliedMigration>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let service = DynamicMigrationService::new(
        db_path,
        String::new(),
        String::new(),
        String::new(),
    );

    service.get_applied_migrations()
}

/// Get tenant ID from database
fn get_tenant_id(app: &tauri::AppHandle) -> Result<String, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let tenant_id: String = db
        .query_row(
            "SELECT tenant_id FROM tenant_config WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get tenant_id: {}", e))?;

    Ok(tenant_id)
}
