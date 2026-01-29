use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationManifest {
    pub version: i32,
    pub migrations: Vec<MigrationEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MigrationEntry {
    pub version: i32,
    pub name: String,
    pub description: Option<String>,
    pub file: String,
    pub checksum: String,
    pub required_app_version: String,
    pub tenant_whitelist: Option<Vec<String>>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppliedMigration {
    pub version: i32,
    pub name: String,
    pub description: Option<String>,
    pub source: String,
    pub checksum: String,
    pub applied_at: i64,
    pub app_version: String,
}

pub struct DynamicMigrationService {
    db_path: PathBuf,
    cloud_base_url: String,
    tenant_id: String,
    app_version: String,
}

impl DynamicMigrationService {
    pub fn new(
        db_path: PathBuf,
        cloud_base_url: String,
        tenant_id: String,
        app_version: String,
    ) -> Self {
        Self {
            db_path,
            cloud_base_url,
            tenant_id,
            app_version,
        }
    }

    /// Fetch migration manifest from cloud
    pub async fn fetch_manifest(&self) -> Result<MigrationManifest, String> {
        let url = format!("{}/migrations/manifest.json", self.cloud_base_url);

        println!("[DynamicMigrations] Fetching manifest from: {}", url);

        // Create a client with timeout to prevent hanging
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let response = client.get(&url)
            .send()
            .await
            .map_err(|e| {
                let err_msg = format!("Failed to fetch manifest from {}: {}", url, e);
                println!("[DynamicMigrations] {}", err_msg);
                err_msg
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let err_msg = format!("Manifest fetch failed with status {} from {}", status, url);
            println!("[DynamicMigrations] {}", err_msg);
            return Err(err_msg);
        }

        let manifest: MigrationManifest = response
            .json()
            .await
            .map_err(|e| {
                let err_msg = format!("Failed to parse manifest JSON: {}", e);
                println!("[DynamicMigrations] {}", err_msg);
                err_msg
            })?;

        Ok(manifest)
    }

    /// Download migration SQL file from cloud
    pub async fn download_migration(&self, entry: &MigrationEntry) -> Result<String, String> {
        let url = format!("{}/migrations/{}", self.cloud_base_url, entry.file);

        println!("[DynamicMigrations] Downloading migration from: {}", url);

        // Create a client with timeout to prevent hanging
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let response = client.get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to download migration: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Migration download failed: {}", response.status()));
        }

        let sql_content = response
            .text()
            .await
            .map_err(|e| format!("Failed to read migration content: {}", e))?;

        // Verify checksum
        let calculated_checksum = self.calculate_checksum(&sql_content);
        if calculated_checksum != entry.checksum {
            return Err(format!(
                "Checksum mismatch! Expected: {}, Got: {}",
                entry.checksum, calculated_checksum
            ));
        }

        Ok(sql_content)
    }

    /// Calculate SHA256 checksum
    fn calculate_checksum(&self, content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("sha256:{}", hex::encode(hasher.finalize()))
    }

    /// Get list of applied migrations
    pub fn get_applied_migrations(&self) -> Result<Vec<AppliedMigration>, String> {
        let db = Connection::open(&self.db_path).map_err(|e| e.to_string())?;

        let mut stmt = db
            .prepare(
                "SELECT version, name, description, source, checksum, applied_at, app_version
                 FROM schema_migrations
                 ORDER BY version ASC"
            )
            .map_err(|e| format!("Failed to query migrations: {}", e))?;

        let migrations = stmt
            .query_map([], |row| {
                Ok(AppliedMigration {
                    version: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    source: row.get(3)?,
                    checksum: row.get(4)?,
                    applied_at: row.get(5)?,
                    app_version: row.get(6)?,
                })
            })
            .map_err(|e| format!("Failed to fetch migrations: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to process migrations: {}", e))?;

        Ok(migrations)
    }

    /// Check if migration is already applied
    pub fn is_migration_applied(&self, version: i32) -> Result<bool, String> {
        let db = Connection::open(&self.db_path).map_err(|e| e.to_string())?;

        let count: i32 = db
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
                params![version],
                |row| row.get(0),
            )
            .unwrap_or(0);

        Ok(count > 0)
    }

    /// Check if migration is applicable to this tenant
    pub fn is_migration_applicable(&self, entry: &MigrationEntry) -> bool {
        // Check tenant whitelist
        if let Some(whitelist) = &entry.tenant_whitelist {
            if !whitelist.contains(&self.tenant_id) {
                println!(
                    "[DynamicMigrations] Migration {} not applicable for tenant {}",
                    entry.name, self.tenant_id
                );
                return false;
            }
        }

        // Check app version compatibility
        if !self.is_version_compatible(&entry.required_app_version) {
            println!(
                "[DynamicMigrations] Migration {} requires app version {} (current: {})",
                entry.name, entry.required_app_version, self.app_version
            );
            return false;
        }

        true
    }

    /// Check if current app version meets requirement
    fn is_version_compatible(&self, required: &str) -> bool {
        // Simple version comparison (you can use semver crate for better handling)
        let current_parts: Vec<u32> = self.app_version
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect();
        let required_parts: Vec<u32> = required
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect();

        for i in 0..3 {
            let current = current_parts.get(i).unwrap_or(&0);
            let required = required_parts.get(i).unwrap_or(&0);

            if current < required {
                return false;
            } else if current > required {
                return true;
            }
        }

        true
    }

    /// Apply a migration
    pub fn apply_migration(
        &self,
        entry: &MigrationEntry,
        sql_content: &str,
    ) -> Result<(), String> {
        let db = Connection::open(&self.db_path).map_err(|e| e.to_string())?;

        // Execute migration in transaction
        db.execute("BEGIN TRANSACTION", [])
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        match db.execute_batch(sql_content) {
            Ok(_) => {
                // Record migration as applied
                db.execute(
                    "INSERT INTO schema_migrations (version, name, description, source, checksum, app_version)
                     VALUES (?1, ?2, ?3, 'cloud', ?4, ?5)",
                    params![
                        entry.version,
                        &entry.name,
                        &entry.description,
                        &entry.checksum,
                        &self.app_version,
                    ],
                )
                .map_err(|e| format!("Failed to record migration: {}", e))?;

                db.execute("COMMIT", [])
                    .map_err(|e| format!("Failed to commit transaction: {}", e))?;

                println!(
                    "[DynamicMigrations] Applied migration {} (version {})",
                    entry.name, entry.version
                );

                Ok(())
            }
            Err(e) => {
                db.execute("ROLLBACK", []).ok();
                Err(format!("Failed to apply migration: {}", e))
            }
        }
    }

    /// Check for and apply new migrations
    pub async fn sync_migrations(&self) -> Result<Vec<String>, String> {
        println!("[DynamicMigrations] Checking for new migrations...");

        // Fetch manifest
        let manifest = match self.fetch_manifest().await {
            Ok(m) => m,
            Err(e) => {
                // If manifest doesn't exist (404), treat as no migrations available
                if e.contains("404") || e.contains("Not Found") {
                    println!("[DynamicMigrations] No manifest found (expected for fresh installs)");
                    return Ok(Vec::new());
                }
                // For network errors during development, also treat as non-fatal
                if e.contains("Failed to fetch") {
                    println!("[DynamicMigrations] Network error fetching manifest (expected in dev): {}", e);
                    return Ok(Vec::new());
                }
                return Err(e);
            }
        };

        let mut applied_migrations = Vec::new();

        // Process each migration
        for entry in manifest.migrations {
            // Skip if already applied
            if self.is_migration_applied(entry.version)? {
                continue;
            }

            // Skip if not applicable to this tenant
            if !self.is_migration_applicable(&entry) {
                continue;
            }

            // Download migration
            println!("[DynamicMigrations] Downloading migration: {}", entry.name);
            let sql_content = self.download_migration(&entry).await?;

            // Apply migration
            self.apply_migration(&entry, &sql_content)?;

            applied_migrations.push(format!("{} (v{})", entry.name, entry.version));
        }

        if applied_migrations.is_empty() {
            println!("[DynamicMigrations] No new migrations to apply");
        } else {
            println!(
                "[DynamicMigrations] Applied {} migrations: {:?}",
                applied_migrations.len(),
                applied_migrations
            );
        }

        Ok(applied_migrations)
    }
}
