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
/// All essential POS functionality migrations in correct order
/// Migrations run in order, regardless of version number
const MIGRATIONS: &[Migration] = &[
    // ===== CORE AUTHENTICATION & USERS =====
    Migration { version: 1, name: "staff_users", sql: include_str!("../../migrations-for-r2-deployment/001_staff_users.sql") },

    // ===== CORE POS OPERATIONS =====
    Migration { version: 2, name: "table_sessions", sql: include_str!("../../migrations-for-r2-deployment/002_table_sessions.sql") },
    Migration { version: 3, name: "aggregator_orders", sql: include_str!("../../migrations-for-r2-deployment/003_aggregator_orders.sql") },
    Migration { version: 4, name: "table_session_kot_records", sql: include_str!("../../migrations-for-r2-deployment/004_table_session_kot_records.sql") },
    Migration { version: 5, name: "kds_orders", sql: include_str!("../../migrations-for-r2-deployment/005_kds_orders.sql") },
    Migration { version: 6, name: "sales_transactions", sql: include_str!("../../migrations-for-r2-deployment/006_sales_transactions.sql") },
    Migration { version: 7, name: "daily_cash_registers", sql: include_str!("../../migrations-for-r2-deployment/007_daily_cash_registers.sql") },
    Migration { version: 9, name: "cash_payouts", sql: include_str!("../../migrations-for-r2-deployment/009_cash_payouts.sql") },

    // ===== INVENTORY & STOCK =====
    Migration { version: 10, name: "inventory", sql: include_str!("../../migrations-for-r2-deployment/010_inventory.sql") },
    Migration { version: 11, name: "aggregator_picked_up", sql: include_str!("../../migrations-for-r2-deployment/011_aggregator_picked_up.sql") },
    Migration { version: 12, name: "aggregator_archived", sql: include_str!("../../migrations-for-r2-deployment/012_aggregator_archived.sql") },
    Migration { version: 13, name: "out_of_stock", sql: include_str!("../../migrations-for-r2-deployment/013_out_of_stock.sql") },

    // ===== STAFF & ATTENDANCE =====
    Migration { version: 16, name: "attendance_records", sql: include_str!("../../migrations-for-r2-deployment/016_attendance_records.sql") },
    Migration { version: 17, name: "weekly_roster", sql: include_str!("../../migrations-for-r2-deployment/017_weekly_roster.sql") },
    Migration { version: 18, name: "leave_management", sql: include_str!("../../migrations-for-r2-deployment/018_leave_management.sql") },
    Migration { version: 20, name: "tips", sql: include_str!("../../migrations-for-r2-deployment/020_tips.sql") },

    // ===== I18N & TRANSLATIONS =====
    Migration { version: 21, name: "i18n_support", sql: include_str!("../../migrations-for-r2-deployment/021_i18n_support.sql") },
    Migration { version: 22, name: "seed_translations", sql: include_str!("../../migrations-for-r2-deployment/022_seed_translations.sql") },

    // ===== RESTAURANT SETTINGS =====
    Migration { version: 24, name: "restaurant_settings", sql: include_str!("../../migrations-for-r2-deployment/024_restaurant_settings.sql") },
    Migration { version: 25, name: "setup_wizard_state", sql: include_str!("../../migrations-for-r2-deployment/025_setup_wizard_state.sql") },

    // ===== CLOUD SYNC =====
    Migration { version: 31, name: "add_online_sync_columns", sql: include_str!("../../migrations-for-r2-deployment/031_add_online_sync_columns.sql") },

    // ===== BAR FEATURES =====
    Migration { version: 32, name: "bar_orders", sql: include_str!("../../migrations-for-r2-deployment/032_bar_orders.sql") },
    Migration { version: 33, name: "bar_inventory", sql: include_str!("../../migrations-for-r2-deployment/033_bar_inventory.sql") },

    // ===== PROVISIONING & ACTIVATION =====
    Migration { version: 34, name: "wizard_provisioning_data", sql: include_str!("../../migrations-for-r2-deployment/034_wizard_provisioning_data.sql") },
    Migration { version: 35, name: "wizard_owner_flag", sql: include_str!("../../migrations-for-r2-deployment/035_wizard_owner_flag.sql") },
    Migration { version: 36, name: "guest_orders", sql: include_str!("../../migrations-for-r2-deployment/036_guest_orders.sql") },

    // ===== SETTINGS ENHANCEMENTS =====
    Migration { version: 42, name: "add_owner_name", sql: include_str!("../../migrations-for-r2-deployment/042_add_owner_name.sql") },
    Migration { version: 44, name: "restaurant_settings_missing_columns", sql: include_str!("../../migrations-for-r2-deployment/044_restaurant_settings_missing_columns.sql") },
    Migration { version: 47, name: "combo_filter_keywords", sql: include_str!("../../migrations-for-r2-deployment/047_combo_filter_keywords.sql") },

    // ===== DEVICE MANAGEMENT =====
    Migration { version: 48, name: "device_settings", sql: include_str!("../../migrations-for-r2-deployment/048_device_settings.sql") },
    Migration { version: 49, name: "user_device_alignment", sql: include_str!("../../migrations-for-r2-deployment/049_user_device_alignment.sql") },
    Migration { version: 51, name: "add_wifi_settings", sql: include_str!("../../migrations-for-r2-deployment/051_add_wifi_settings.sql") },

    // ===== MENU UPLOAD =====
    Migration { version: 52, name: "menu_upload_sessions", sql: include_str!("../../migrations-for-r2-deployment/052_menu_upload_sessions.sql") },

    // ===== MENU IMAGE MANAGEMENT =====
    Migration { version: 28, name: "unassigned_images", sql: include_str!("../../migrations-for-r2-deployment/028_unassigned_images.sql") },

    // ===== TENANT CONFIGURATION (MUST BE LAST - creates tenant_config) =====
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
