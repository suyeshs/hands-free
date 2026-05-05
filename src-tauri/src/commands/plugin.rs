/**
 * Plugin Management Commands
 * Handles plugin installation, migrations, and activation
 */

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub requires_permissions: Vec<String>,
    #[serde(default)]
    pub migrations: Vec<PluginMigration>,
    #[serde(default)]
    pub commands: Vec<String>,
    #[serde(default)]
    pub ui_routes: Vec<PluginRoute>,
    pub hub_card: Option<PluginHubCard>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginMigration {
    pub version: u32,
    pub name: String,
    pub sql_url: String, // R2 URL to SQL file
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginRoute {
    pub path: String,
    pub component_url: String, // WASM component URL
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginHubCard {
    pub title: String,
    pub description: String,
    pub icon: String,
    pub path: String,
    pub accent_color: String,
    pub roles: Vec<String>,
    pub order: u32,
}

/// Check if plugin infrastructure tables exist, create if needed
fn ensure_plugin_tables(db: &Connection) -> Result<(), String> {
    // Create installed_plugins table
    db.execute(
        "CREATE TABLE IF NOT EXISTS installed_plugins (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            description TEXT,
            author TEXT,
            manifest TEXT NOT NULL,
            installed_at INTEGER NOT NULL,
            enabled INTEGER DEFAULT 1
        )",
        [],
    ).map_err(|e| format!("Failed to create installed_plugins table: {}", e))?;

    // Create plugin_migrations table
    db.execute(
        "CREATE TABLE IF NOT EXISTS plugin_migrations (
            plugin_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            name TEXT NOT NULL,
            applied_at INTEGER NOT NULL,
            checksum TEXT NOT NULL,
            PRIMARY KEY (plugin_id, version)
        )",
        [],
    ).map_err(|e| format!("Failed to create plugin_migrations table: {}", e))?;

    // Create indexes
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_installed_plugins_enabled ON installed_plugins(enabled)",
        [],
    ).map_err(|e| format!("Failed to create index: {}", e))?;

    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_plugin_migrations_plugin ON plugin_migrations(plugin_id)",
        [],
    ).map_err(|e| format!("Failed to create index: {}", e))?;

    Ok(())
}

/// Check if a plugin is installed
#[tauri::command]
pub fn is_plugin_installed(app: tauri::AppHandle, plugin_id: String) -> Result<bool, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    if !db_path.exists() {
        return Ok(false);
    }

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    ensure_plugin_tables(&db)?;

    let count: i32 = db.query_row(
        "SELECT COUNT(*) FROM installed_plugins WHERE id = ?1 AND enabled = 1",
        [&plugin_id],
        |row| row.get(0),
    ).unwrap_or(0);

    Ok(count > 0)
}

/// Require a plugin to be installed (used by commands)
pub fn require_plugin(app: &tauri::AppHandle, plugin_id: &str) -> Result<(), String> {
    let is_installed = is_plugin_installed(app.clone(), plugin_id.to_string())?;

    if !is_installed {
        return Err(format!("Plugin '{}' is not installed. Please install it from the Plugins page.", plugin_id));
    }

    Ok(())
}

/// Download plugin manifest from R2
async fn download_manifest(plugin_id: &str) -> Result<PluginManifest, String> {
    let manifest_url = format!(
        "https://pub-d01c3c013f71424e8a32d71257785463.r2.dev/plugins/{}/manifest.json",
        plugin_id
    );

    println!("[plugin.rs] Downloading manifest from: {}", manifest_url);

    let response = reqwest::get(&manifest_url)
        .await
        .map_err(|e| format!("Failed to download manifest: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Manifest not found (HTTP {})", response.status()));
    }

    let manifest: PluginManifest = response.json()
        .await
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;

    Ok(manifest)
}

/// Download a migration SQL file
async fn download_migration_sql(migration: &PluginMigration) -> Result<String, String> {
    println!("[plugin.rs] Downloading migration: {} (v{})", migration.name, migration.version);

    let response = reqwest::get(&migration.sql_url)
        .await
        .map_err(|e| format!("Failed to download migration: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Migration SQL not found (HTTP {})", response.status()));
    }

    let sql = response.text()
        .await
        .map_err(|e| format!("Failed to read migration SQL: {}", e))?;

    Ok(sql)
}

/// Execute a migration SQL (synchronous, no awaits)
fn execute_migration_sql(db: &Connection, migration_name: &str, sql: &str) -> Result<(), String> {
    println!("[plugin.rs] Executing migration: {}", migration_name);

    db.execute_batch(sql)
        .map_err(|e| format!("Migration {} failed: {}", migration_name, e))?;

    Ok(())
}

/// Mark a migration as applied
fn mark_migration_applied(
    db: &Connection,
    plugin_id: &str,
    migration: &PluginMigration,
) -> Result<(), String> {
    use std::time::SystemTime;

    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let checksum = format!("{}-{}", plugin_id, migration.name);

    db.execute(
        "INSERT OR REPLACE INTO plugin_migrations (plugin_id, version, name, applied_at, checksum)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            plugin_id,
            migration.version,
            &migration.name,
            timestamp,
            &checksum,
        ],
    ).map_err(|e| format!("Failed to mark migration as applied: {}", e))?;

    Ok(())
}

/// Check if a migration has been applied
fn is_migration_applied(db: &Connection, plugin_id: &str, version: u32) -> Result<bool, String> {
    let count: i32 = db.query_row(
        "SELECT COUNT(*) FROM plugin_migrations WHERE plugin_id = ?1 AND version = ?2",
        params![plugin_id, version],
        |row| row.get(0),
    ).unwrap_or(0);

    Ok(count > 0)
}

/// Install a plugin from R2
#[tauri::command]
pub async fn install_plugin(app: tauri::AppHandle, plugin_id: String) -> Result<String, String> {
    println!("[plugin.rs] ===== Installing Plugin: {} =====", plugin_id);

    // 1. Download manifest
    let manifest = download_manifest(&plugin_id).await?;
    println!("[plugin.rs] Manifest downloaded: {} v{}", manifest.name, manifest.version);

    // 2. Validate manifest
    if manifest.id != plugin_id {
        return Err(format!(
            "Manifest ID mismatch: expected '{}', got '{}'",
            plugin_id, manifest.id
        ));
    }

    // 3. Get database connection
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // 4. Ensure plugin infrastructure tables exist
    ensure_plugin_tables(&db)?;

    // 5. Check if already installed
    let already_installed: i32 = db.query_row(
        "SELECT COUNT(*) FROM installed_plugins WHERE id = ?1",
        [&plugin_id],
        |row| row.get(0),
    ).unwrap_or(0);

    if already_installed > 0 {
        return Err(format!("Plugin '{}' is already installed", plugin_id));
    }

    // 6. Download all migration SQL files first (async operations)
    let mut migrations_to_apply = Vec::new();

    for migration in &manifest.migrations {
        let already_applied = is_migration_applied(&db, &plugin_id, migration.version)?;

        if already_applied {
            continue;
        }

        let sql = download_migration_sql(migration).await?;
        migrations_to_apply.push((migration.clone(), sql));
    }

    // Close the connection before downloads to avoid holding it during awaits
    drop(db);

    // 7. Reopen connection and execute migrations synchronously
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut applied_count = 0;
    let skipped_count = manifest.migrations.len() - migrations_to_apply.len();

    for (migration, sql) in migrations_to_apply {
        execute_migration_sql(&db, &migration.name, &sql)?;
        mark_migration_applied(&db, &plugin_id, &migration)?;
        applied_count += 1;
        println!("[plugin.rs] ✅ Migration {} applied", migration.name);
    }

    println!("[plugin.rs] Migrations: {} applied, {} skipped", applied_count, skipped_count);

    // 7. Mark plugin as installed
    use std::time::SystemTime;
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let manifest_json = serde_json::to_string(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    db.execute(
        "INSERT INTO installed_plugins (id, name, version, description, author, manifest, installed_at, enabled)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
        params![
            &manifest.id,
            &manifest.name,
            &manifest.version,
            &manifest.description,
            &manifest.author,
            &manifest_json,
            timestamp,
        ],
    ).map_err(|e| format!("Failed to save plugin: {}", e))?;

    println!("[plugin.rs] ✅ Plugin '{}' installed successfully", manifest.name);

    Ok(format!(
        "Plugin '{}' v{} installed successfully. {} migrations applied.",
        manifest.name, manifest.version, applied_count
    ))
}

/// Get list of installed plugins
#[tauri::command]
pub fn get_installed_plugins(app: tauri::AppHandle) -> Result<Vec<PluginManifest>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    if !db_path.exists() {
        return Ok(Vec::new());
    }

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    ensure_plugin_tables(&db)?;

    let mut stmt = db.prepare(
        "SELECT manifest FROM installed_plugins WHERE enabled = 1 ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let manifests = stmt.query_map([], |row| {
        let manifest_json: String = row.get(0)?;
        Ok(manifest_json)
    }).map_err(|e| e.to_string())?;

    let mut plugins = Vec::new();
    for manifest_json in manifests {
        let manifest_json = manifest_json.map_err(|e| e.to_string())?;
        let manifest: PluginManifest = serde_json::from_str(&manifest_json)
            .map_err(|e| format!("Failed to parse manifest: {}", e))?;
        plugins.push(manifest);
    }

    Ok(plugins)
}

/// Uninstall a plugin (disable only, keep data)
#[tauri::command]
pub fn uninstall_plugin(app: tauri::AppHandle, plugin_id: String) -> Result<String, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    ensure_plugin_tables(&db)?;

    db.execute(
        "UPDATE installed_plugins SET enabled = 0 WHERE id = ?1",
        [&plugin_id],
    ).map_err(|e| format!("Failed to uninstall plugin: {}", e))?;

    Ok(format!("Plugin '{}' has been disabled. Data is preserved.", plugin_id))
}

/// Re-enable a disabled plugin
#[tauri::command]
pub fn enable_plugin(app: tauri::AppHandle, plugin_id: String) -> Result<String, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    ensure_plugin_tables(&db)?;

    db.execute(
        "UPDATE installed_plugins SET enabled = 1 WHERE id = ?1",
        [&plugin_id],
    ).map_err(|e| format!("Failed to enable plugin: {}", e))?;

    Ok(format!("Plugin '{}' has been enabled.", plugin_id))
}
