/**
 * Core Database Migrations
 *
 * Runs all core POS table migrations on app startup.
 * Plugin tables are handled separately via the plugin migration system.
 */

use rusqlite::Connection;
use std::path::PathBuf;

/// Migration definition
struct Migration {
    version: u32,
    name: &'static str,
    sql: &'static str,
}

/// Core base migrations (plugin-specific tables moved to plugin system)
/// Only essential business setup migrations are included here
/// Migrations run in order, regardless of version number
const MIGRATIONS: &[Migration] = &[
    // User authentication (required for base system)
    Migration { version: 1, name: "staff_users", sql: include_str!("../../migrations-for-r2-deployment/001_staff_users.sql") },

    // Restaurant business details (required for base setup)
    Migration { version: 24, name: "restaurant_settings", sql: include_str!("../../migrations-for-r2-deployment/024_restaurant_settings.sql") },

    // Setup wizard state (required for onboarding)
    Migration { version: 25, name: "setup_wizard_state", sql: include_str!("../../migrations-for-r2-deployment/025_setup_wizard_state.sql") },

    // Add online sync columns (required for cloud sync)
    Migration { version: 31, name: "add_online_sync_columns", sql: include_str!("../../migrations-for-r2-deployment/031_add_online_sync_columns.sql") },

    // Wizard provisioning data (required for activation flow)
    Migration { version: 34, name: "wizard_provisioning_data", sql: include_str!("../../migrations-for-r2-deployment/034_wizard_provisioning_data.sql") },

    // Owner flag (required to identify restaurant owner)
    Migration { version: 35, name: "wizard_owner_flag", sql: include_str!("../../migrations-for-r2-deployment/035_wizard_owner_flag.sql") },

    // Add owner_name column (required for restaurant settings)
    Migration { version: 42, name: "add_owner_name", sql: include_str!("../../migrations-for-r2-deployment/042_add_owner_name.sql") },

    // Add restaurant_type and operational_scale columns (required for restaurant settings)
    Migration { version: 44, name: "restaurant_settings_missing_columns", sql: include_str!("../../migrations-for-r2-deployment/044_restaurant_settings_missing_columns.sql") },

    // Device settings (required for device management)
    Migration { version: 48, name: "device_settings", sql: include_str!("../../migrations-for-r2-deployment/048_device_settings.sql") },

    // User-device alignment (required for multi-device support)
    Migration { version: 49, name: "user_device_alignment", sql: include_str!("../../migrations-for-r2-deployment/049_user_device_alignment.sql") },

    // Minimal tenant config (required for business setup - MUST run before migration 50)
    // Creates tenant_config table with d1_database_id column included
    Migration { version: 53, name: "minimal_tenant_config", sql: include_str!("../../migrations-for-r2-deployment/053_minimal_tenant_config.sql") },
];

/// Create schema_migrations table to track applied migrations
/// Uses the existing schema structure with source, checksum, and app_version columns
fn create_migrations_table(db: &Connection) -> Result<(), rusqlite::Error> {
    db.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            source TEXT NOT NULL CHECK(source IN ('built-in', 'cloud')),
            checksum TEXT NOT NULL,
            applied_at INTEGER NOT NULL,
            app_version TEXT NOT NULL
        )",
        [],
    )?;
    Ok(())
}

/// Check if a migration has been applied
/// Checks by version AND source='built-in' to avoid conflicts with legacy migrations
fn is_migration_applied(db: &Connection, version: u32) -> Result<bool, rusqlite::Error> {
    let count: i32 = db.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1 AND source = 'built-in' AND checksum LIKE 'core-%'",
        [version],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Mark a migration as applied
/// Includes source='built-in', checksum (migration name hash), and app_version
fn mark_migration_applied(db: &Connection, version: u32, name: &str) -> Result<(), rusqlite::Error> {
    use std::time::SystemTime;

    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Use migration name as checksum (unique identifier for this migration)
    let checksum = format!("core-{}", name);

    db.execute(
        "INSERT OR REPLACE INTO schema_migrations (version, name, description, source, checksum, applied_at, app_version)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        [
            &version.to_string(),
            name,
            "Core POS migration",
            "built-in",
            &checksum,
            &timestamp.to_string(),
            "3.1.0",
        ],
    )?;
    Ok(())
}

/// Run all pending migrations
pub fn run_migrations(db_path: &PathBuf) -> Result<(), String> {
    println!("[Migrations] ===== Running Core POS Migrations =====");
    println!("[Migrations] Database: {:?}", db_path);

    let db = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Create migrations tracking table
    create_migrations_table(&db)
        .map_err(|e| format!("Failed to create migrations table: {}", e))?;

    let mut applied_count = 0;
    let mut skipped_count = 0;

    // Run migrations in order
    for migration in MIGRATIONS {
        let already_applied = is_migration_applied(&db, migration.version)
            .map_err(|e| format!("Failed to check migration {}: {}", migration.version, e))?;

        if already_applied {
            skipped_count += 1;
            continue;
        }

        println!("[Migrations] Applying migration {}: {}", migration.version, migration.name);

        // Execute the migration SQL
        db.execute_batch(migration.sql)
            .map_err(|e| format!("Migration {} failed: {}", migration.version, e))?;

        // Mark as applied
        mark_migration_applied(&db, migration.version, migration.name)
            .map_err(|e| format!("Failed to mark migration {} as applied: {}", migration.version, e))?;

        applied_count += 1;
        println!("[Migrations] ✅ Migration {} applied successfully", migration.version);
    }

    println!("[Migrations] ===== Migration Summary =====");
    println!("[Migrations] Total migrations: {}", MIGRATIONS.len());
    println!("[Migrations] Applied: {}", applied_count);
    println!("[Migrations] Skipped (already applied): {}", skipped_count);
    println!("[Migrations] =====================================");

    Ok(())
}
