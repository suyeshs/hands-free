use crate::types::*;
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

const TENANT_ID: &str = "coorg-food-company-6163";

// Re-export types for convenience
pub use crate::types::{DetectionResult, MigrationResult};

/// Find the database directory
fn get_db_dir() -> Result<PathBuf> {
    let data_dir = dirs::data_local_dir()
        .context("Could not find app data directory")?;

    // Try multiple possible locations
    let possible_paths = vec![
        data_dir.join("restaurant-pos-ai"),
        data_dir.join("com.guanix.pos"),
        data_dir.join("Guanix Restaurant"),
    ];

    for path in possible_paths {
        if path.exists() {
            return Ok(path);
        }
    }

    // Return first path as default
    Ok(data_dir.join("restaurant-pos-ai"))
}

/// Detect v1.0 database
pub async fn detect_v1_database() -> Result<DetectionResult, String> {
    let db_dir = get_db_dir().map_err(|e| e.to_string())?;
    let pos_db_path = db_dir.join("pos.db");

    if !pos_db_path.exists() {
        return Err(format!("pos.db not found at {:?}", pos_db_path));
    }

    // Open database
    let conn = Connection::open(&pos_db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Check if already migrated (has sales_transactions table)
    let has_sales_table: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='sales_transactions'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check schema: {}", e))?;

    if has_sales_table > 0 {
        return Err("Database already migrated (sales_transactions table exists)".to_string());
    }

    // Get counts
    let sales_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM table_sessions WHERE status = 'closed'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let staff_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM staff_users",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(DetectionResult {
        found: true,
        path: pos_db_path.to_string_lossy().to_string(),
        sales_count,
        staff_count,
    })
}

/// Export v1.0 data
fn export_v1_data(conn: &Connection) -> Result<ExportData, String> {
    // Export closed sales
    let mut stmt = conn
        .prepare("SELECT id, tenant_id, table_number, guest_count, server_name, started_at, closed_at, status, order_data FROM table_sessions WHERE status = 'closed' ORDER BY closed_at")
        .map_err(|e| format!("Failed to prepare sales query: {}", e))?;

    let closed_sales = stmt
        .query_map([], |row| {
            Ok(TableSession {
                id: row.get(0)?,
                tenant_id: row.get(1)?,
                table_number: row.get(2)?,
                guest_count: row.get(3)?,
                server_name: row.get(4)?,
                started_at: row.get(5)?,
                closed_at: row.get(6)?,
                status: row.get(7)?,
                order_data: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query sales: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect sales: {}", e))?;

    // Export active sessions
    let mut stmt = conn
        .prepare("SELECT id, tenant_id, table_number, guest_count, server_name, started_at, closed_at, status, order_data FROM table_sessions WHERE status = 'active'")
        .map_err(|e| format!("Failed to prepare active sessions query: {}", e))?;

    let active_sessions = stmt
        .query_map([], |row| {
            Ok(TableSession {
                id: row.get(0)?,
                tenant_id: row.get(1)?,
                table_number: row.get(2)?,
                guest_count: row.get(3)?,
                server_name: row.get(4)?,
                started_at: row.get(5)?,
                closed_at: row.get(6)?,
                status: row.get(7)?,
                order_data: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query active sessions: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect active sessions: {}", e))?;

    // Export staff
    let mut stmt = conn
        .prepare("SELECT id, tenant_id, name, role, pin_hash, is_active, permissions, created_at, last_login_at, created_by FROM staff_users")
        .map_err(|e| format!("Failed to prepare staff query: {}", e))?;

    let staff = stmt
        .query_map([], |row| {
            Ok(StaffUser {
                id: row.get(0)?,
                tenant_id: row.get(1)?,
                name: row.get(2)?,
                role: row.get(3)?,
                pin_hash: row.get(4)?,
                is_active: row.get(5)?,
                permissions: row.get(6)?,
                created_at: row.get(7)?,
                last_login_at: row.get(8).ok(),
                created_by: row.get(9).ok(),
            })
        })
        .map_err(|e| format!("Failed to query staff: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect staff: {}", e))?;

    Ok(ExportData {
        tenant_id: TENANT_ID.to_string(),
        closed_sales,
        active_sessions,
        staff,
        export_date: Utc::now().to_rfc3339(),
    })
}

/// Create backup
fn create_backup(export_data: &ExportData) -> Result<BackupPaths, String> {
    let db_dir = get_db_dir().map_err(|e| e.to_string())?;
    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();

    // Backup database file
    let source_path = db_dir.join("pos.db");
    let backup_db_path = db_dir.join(format!("pos-v1-backup-{}.db", timestamp));

    fs::copy(&source_path, &backup_db_path)
        .map_err(|e| format!("Failed to backup database: {}", e))?;

    // Save export JSON
    let export_json_path = db_dir.join(format!("migration-export-{}.json", timestamp));
    let json_str = serde_json::to_string_pretty(export_data)
        .map_err(|e| format!("Failed to serialize export data: {}", e))?;

    fs::write(&export_json_path, json_str)
        .map_err(|e| format!("Failed to write export JSON: {}", e))?;

    Ok(BackupPaths {
        db_path: backup_db_path.to_string_lossy().to_string(),
        json_path: export_json_path.to_string_lossy().to_string(),
    })
}

/// Transform table session to sales transaction
fn transform_to_sales_transaction(
    session: &TableSession,
    invoice_counter: &mut i32,
) -> Result<SalesTransaction, String> {
    // Parse order_data JSON
    let order_data: OrderData = serde_json::from_str(&session.order_data)
        .map_err(|e| format!("Failed to parse order_data: {}", e))?;

    // Generate invoice number
    let invoice_number = format!("MIG-{:06}", *invoice_counter);
    *invoice_counter += 1;

    // Calculate taxes (2.5% CGST + 2.5% SGST = 5% total)
    let subtotal = order_data.subtotal;
    let cgst = subtotal * 0.025;
    let sgst = subtotal * 0.025;
    let service_charge = 0.0;

    let before_round = subtotal + cgst + sgst + service_charge - order_data.discount;
    let grand_total = before_round.round();
    let round_off = grand_total - before_round;

    Ok(SalesTransaction {
        id: session.id.clone(),
        tenant_id: TENANT_ID.to_string(),
        invoice_number,
        order_type: order_data.order_type.unwrap_or_else(|| "dine-in".to_string()),
        table_number: session.table_number,
        source: "pos".to_string(),
        subtotal,
        service_charge,
        cgst,
        sgst,
        discount: order_data.discount,
        round_off,
        grand_total,
        payment_method: "cash".to_string(),
        payment_status: "completed".to_string(),
        items_json: serde_json::to_string(&order_data.items)
            .map_err(|e| format!("Failed to serialize items: {}", e))?,
        cashier_name: session.server_name.clone(),
        created_at: session.started_at.clone(),
        completed_at: session.closed_at.clone(),
    })
}

/// Create new database with migrations
fn create_new_database() -> Result<Connection, String> {
    let db_dir = get_db_dir().map_err(|e| e.to_string())?;
    let guanix_db_path = db_dir.join("guanix.db");

    // Remove if exists (for clean migration)
    if guanix_db_path.exists() {
        fs::remove_file(&guanix_db_path)
            .map_err(|e| format!("Failed to remove existing guanix.db: {}", e))?;
    }

    // Create new database
    let conn = Connection::open(&guanix_db_path)
        .map_err(|e| format!("Failed to create guanix.db: {}", e))?;

    // Apply all migrations (simplified - in production, would load from files)
    apply_migrations(&conn)?;

    Ok(conn)
}

/// Apply database migrations - loads complete D1 schema
fn apply_migrations(conn: &Connection) -> Result<(), String> {
    // Embed the complete schema at compile time
    const SCHEMA_SQL: &str = include_str!("../resources/d1-schema.sql");

    // Execute the complete schema
    // Split by semicolons and execute each statement
    let statements: Vec<&str> = SCHEMA_SQL
        .split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !s.starts_with("--"))
        .collect();

    for (idx, statement) in statements.iter().enumerate() {
        conn.execute(statement, [])
            .map_err(|e| {
                format!(
                    "Failed to execute migration statement #{}: {}\nStatement preview: {}...",
                    idx + 1,
                    e,
                    statement.chars().take(100).collect::<String>()
                )
            })?;
    }

    Ok(())
}

/// Import data to new database
fn import_data(conn: &Connection, export_data: &ExportData, app_handle: &tauri::AppHandle) -> Result<ImportResult, String> {
    let mut result = ImportResult {
        staff_imported: 0,
        sales_imported: 0,
        sessions_imported: 0,
    };

    // Import staff
    for user in &export_data.staff {
        conn.execute(
            "INSERT INTO staff_users (id, tenant_id, name, role, pin_hash, is_active, permissions, created_at, last_login_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                user.id,
                TENANT_ID,
                user.name,
                user.role,
                user.pin_hash,
                user.is_active,
                user.permissions,
                user.created_at,
                user.last_login_at,
                user.created_by,
            ],
        ).map_err(|e| format!("Failed to import staff: {}", e))?;

        result.staff_imported += 1;
    }

    // Emit progress
    let _ = app_handle.emit("migration_progress", serde_json::json!({
        "step": "import",
        "progress": 30,
        "message": format!("Imported {} staff users", result.staff_imported)
    }));

    // Transform and import sales
    let mut invoice_counter = 1;
    for session in &export_data.closed_sales {
        let transaction = transform_to_sales_transaction(session, &mut invoice_counter)?;

        conn.execute(
            "INSERT INTO sales_transactions (id, tenant_id, invoice_number, order_type, table_number, source, subtotal, service_charge, cgst, sgst, discount, round_off, grand_total, payment_method, payment_status, items_json, cashier_name, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                transaction.id,
                transaction.tenant_id,
                transaction.invoice_number,
                transaction.order_type,
                transaction.table_number,
                transaction.source,
                transaction.subtotal,
                transaction.service_charge,
                transaction.cgst,
                transaction.sgst,
                transaction.discount,
                transaction.round_off,
                transaction.grand_total,
                transaction.payment_method,
                transaction.payment_status,
                transaction.items_json,
                transaction.cashier_name,
                transaction.created_at,
                transaction.completed_at,
            ],
        ).map_err(|e| format!("Failed to import sales transaction: {}", e))?;

        result.sales_imported += 1;

        // Emit progress every 100 records
        if result.sales_imported % 100 == 0 {
            let progress = 30 + ((result.sales_imported as f64 / export_data.closed_sales.len() as f64) * 40.0) as i32;
            let _ = app_handle.emit("migration_progress", serde_json::json!({
                "step": "import",
                "progress": progress,
                "message": format!("Imported {}/{} sales", result.sales_imported, export_data.closed_sales.len())
            }));
        }
    }

    // Import active sessions
    for session in &export_data.active_sessions {
        conn.execute(
            "INSERT INTO table_sessions (id, tenant_id, table_number, guest_count, server_name, started_at, closed_at, status, order_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                session.id,
                TENANT_ID,
                session.table_number,
                session.guest_count,
                session.server_name,
                session.started_at,
                session.closed_at,
                session.status,
                session.order_data,
            ],
        ).map_err(|e| format!("Failed to import active session: {}", e))?;

        result.sessions_imported += 1;
    }

    // Initialize restaurant_settings
    conn.execute(
        "INSERT INTO restaurant_settings (id, name, invoice_prefix, current_invoice_number, cgst_rate, sgst_rate, device_role, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            "Coorg Food Company",
            "MIG",
            invoice_counter,
            2.5,
            2.5,
            "server",
            Utc::now().to_rfc3339(),
            Utc::now().to_rfc3339(),
        ],
    ).map_err(|e| format!("Failed to initialize restaurant_settings: {}", e))?;

    // Initialize tenant_config
    let existing_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tenant_config WHERE tenant_id = ?",
            params![TENANT_ID],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if existing_count == 0 {
        conn.execute(
            "INSERT INTO tenant_config (id, tenant_id, company_name, subdomain, activated_at) VALUES (1, ?, ?, ?, ?)",
            params![
                TENANT_ID,
                "Coorg Food Company",
                "coorg-food-company",
                Utc::now().to_rfc3339(),
            ],
        ).map_err(|e| format!("Failed to initialize tenant_config: {}", e))?;
    }

    Ok(result)
}

/// Validate migration
fn validate_migration(conn: &Connection, export_data: &ExportData) -> Result<ValidationResult, String> {
    // Count staff
    let staff_actual: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM staff_users WHERE tenant_id = ?",
            params![TENANT_ID],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Count sales
    let sales_actual: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sales_transactions WHERE tenant_id = ?",
            params![TENANT_ID],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Calculate revenue
    let revenue: f64 = conn
        .query_row(
            "SELECT SUM(grand_total) FROM sales_transactions WHERE tenant_id = ?",
            params![TENANT_ID],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Get date range
    let oldest: Option<String> = conn
        .query_row(
            "SELECT MIN(completed_at) FROM sales_transactions WHERE tenant_id = ?",
            params![TENANT_ID],
            |row| row.get(0),
        )
        .ok();

    let newest: Option<String> = conn
        .query_row(
            "SELECT MAX(completed_at) FROM sales_transactions WHERE tenant_id = ?",
            params![TENANT_ID],
            |row| row.get(0),
        )
        .ok();

    let staff_expected = export_data.staff.len() as i32;
    let sales_expected = export_data.closed_sales.len() as i32;

    Ok(ValidationResult {
        staff: ValidationCount {
            expected: staff_expected,
            actual: staff_actual,
            match_: staff_actual == staff_expected,
        },
        sales: ValidationCount {
            expected: sales_expected,
            actual: sales_actual,
            match_: sales_actual == sales_expected,
        },
        revenue,
        date_range: DateRange { oldest, newest },
        overall_success: staff_actual == staff_expected && sales_actual == sales_expected,
    })
}

/// Commit migration
fn commit_migration() -> Result<(), String> {
    let db_dir = get_db_dir().map_err(|e| e.to_string())?;
    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();

    let old_path = db_dir.join("pos.db");
    let archive_path = db_dir.join(format!("pos-v1-archive-{}.db", timestamp));

    if old_path.exists() {
        fs::rename(&old_path, &archive_path)
            .map_err(|e| format!("Failed to archive old database: {}", e))?;
    }

    Ok(())
}

/// Run full migration
pub async fn run_full_migration(app_handle: tauri::AppHandle) -> Result<MigrationResult, String> {
    // Step 1: Detect
    app_handle.emit("migration_progress", serde_json::json!({
        "step": "detect",
        "progress": 5,
        "message": "Detecting v1.0 database..."
    })).map_err(|e| e.to_string())?;

    let _detection = detect_v1_database().await?;

    // Step 2: Export
    app_handle.emit("migration_progress", serde_json::json!({
        "step": "export",
        "progress": 10,
        "message": "Exporting v1.0 data..."
    })).map_err(|e| e.to_string())?;

    let db_dir = get_db_dir().map_err(|e| e.to_string())?;
    let pos_db_path = db_dir.join("pos.db");
    let old_conn = Connection::open(&pos_db_path)
        .map_err(|e| format!("Failed to open pos.db: {}", e))?;

    let export_data = export_v1_data(&old_conn)?;

    // Step 3: Backup
    app_handle.emit("migration_progress", serde_json::json!({
        "step": "backup",
        "progress": 20,
        "message": "Creating backup..."
    })).map_err(|e| e.to_string())?;

    let backup_paths = create_backup(&export_data)?;

    // Step 4: Create new database
    app_handle.emit("migration_progress", serde_json::json!({
        "step": "create",
        "progress": 25,
        "message": "Creating new database..."
    })).map_err(|e| e.to_string())?;

    let new_conn = create_new_database()?;

    // Step 5: Import
    app_handle.emit("migration_progress", serde_json::json!({
        "step": "import",
        "progress": 30,
        "message": "Importing data..."
    })).map_err(|e| e.to_string())?;

    let _import_result = import_data(&new_conn, &export_data, &app_handle)?;

    // Step 6: Validate
    app_handle.emit("migration_progress", serde_json::json!({
        "step": "validate",
        "progress": 80,
        "message": "Validating migration..."
    })).map_err(|e| e.to_string())?;

    let validation = validate_migration(&new_conn, &export_data)?;

    if !validation.overall_success {
        return Err("Validation failed: data mismatch detected".to_string());
    }

    // Step 7: Commit
    app_handle.emit("migration_progress", serde_json::json!({
        "step": "commit",
        "progress": 90,
        "message": "Committing migration..."
    })).map_err(|e| e.to_string())?;

    commit_migration()?;

    // Done
    app_handle.emit("migration_progress", serde_json::json!({
        "step": "complete",
        "progress": 100,
        "message": "Migration complete!"
    })).map_err(|e| e.to_string())?;

    Ok(MigrationResult {
        validation,
        backup_paths,
    })
}

/// Rollback migration
pub async fn rollback_migration(backup_path: &str) -> Result<(), String> {
    let db_dir = get_db_dir().map_err(|e| e.to_string())?;
    let active_path = db_dir.join("pos.db");
    let guanix_path = db_dir.join("guanix.db");

    // Delete new database
    if guanix_path.exists() {
        fs::remove_file(&guanix_path)
            .map_err(|e| format!("Failed to remove guanix.db: {}", e))?;
    }

    // Restore backup
    fs::copy(backup_path, &active_path)
        .map_err(|e| format!("Failed to restore backup: {}", e))?;

    Ok(())
}
