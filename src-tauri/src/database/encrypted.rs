/**
 * Encrypted Database Module
 *
 * Uses SQLCipher to store sensitive data like tokens and hashed credentials.
 * This provides encryption at rest for the most sensitive data.
 *
 * Security Features:
 * - AES-256 encryption using SQLCipher
 * - Key derived from device ID + hardware identifiers
 * - Stored in a separate database from the main POS data
 */

use rusqlite::{Connection, Result as SqliteResult, params};
use std::path::PathBuf;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use obfstr::obfstr;
use tauri::Manager;

/// Global encrypted database connection (using Mutex for thread safety)
static ENCRYPTED_DB: Lazy<Mutex<Option<EncryptedDatabase>>> =
    Lazy::new(|| Mutex::new(None));

// Implement Send for EncryptedDatabase to allow it to be used across threads
// Safety: All operations on Connection are protected by Mutex
unsafe impl Send for EncryptedDatabase {}

/// Encrypted database wrapper
pub struct EncryptedDatabase {
    conn: Connection,
}

impl EncryptedDatabase {
    /// Create or open the encrypted database
    pub fn open(db_path: &PathBuf, encryption_key: &str) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;

        // Set the encryption key (SQLCipher pragma)
        conn.pragma_update(None, "key", encryption_key)?;

        // Verify the database is accessible (will fail if wrong key)
        conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))?;

        Ok(Self { conn })
    }

    /// Initialize the schema
    pub fn initialize(&self) -> SqliteResult<()> {
        self.conn.execute_batch(r#"
            -- Encrypted secrets table
            CREATE TABLE IF NOT EXISTS secrets (
                key TEXT PRIMARY KEY,
                value BLOB NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- Encrypted session tokens
            CREATE TABLE IF NOT EXISTS session_tokens (
                id TEXT PRIMARY KEY,
                token_type TEXT NOT NULL,
                encrypted_token BLOB NOT NULL,
                expires_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- Audit log for security events
            CREATE TABLE IF NOT EXISTS security_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                timestamp TEXT NOT NULL DEFAULT (datetime('now'))
            );
        "#)?;

        Ok(())
    }

    /// Store an encrypted secret
    pub fn store_secret(&self, key: &str, value: &[u8]) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO secrets (key, value, updated_at) VALUES (?1, ?2, datetime('now'))",
            params![key, value],
        )?;
        Ok(())
    }

    /// Retrieve an encrypted secret
    pub fn get_secret(&self, key: &str) -> SqliteResult<Option<Vec<u8>>> {
        let mut stmt = self.conn.prepare("SELECT value FROM secrets WHERE key = ?1")?;
        let result = stmt.query_row(params![key], |row| row.get(0));

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Delete a secret
    pub fn delete_secret(&self, key: &str) -> SqliteResult<()> {
        self.conn.execute("DELETE FROM secrets WHERE key = ?1", params![key])?;
        Ok(())
    }

    /// Log a security event
    pub fn log_security_event(&self, event_type: &str, details: Option<&str>, ip: Option<&str>) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT INTO security_audit_log (event_type, details, ip_address) VALUES (?1, ?2, ?3)",
            params![event_type, details, ip],
        )?;
        Ok(())
    }
}

/// Derive encryption key from device characteristics
/// Uses SHA-256 to combine multiple sources of entropy
fn derive_encryption_key() -> String {
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();

    // Add a salt (obfuscated at compile time)
    hasher.update(obfstr!("H4ndsF733_Encr1pt10n_S4lt_2025!").as_bytes());

    // Add machine-specific identifiers
    #[cfg(target_os = "macos")]
    {
        // Use machine UUID on macOS
        if let Ok(output) = std::process::Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            hasher.update(&output.stdout);
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Use machine GUID on Windows
        if let Ok(output) = std::process::Command::new("wmic")
            .args(["csproduct", "get", "UUID"])
            .output()
        {
            hasher.update(&output.stdout);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Use machine-id on Linux
        if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
            hasher.update(id.as_bytes());
        }
    }

    #[cfg(target_os = "android")]
    {
        // Use Android ID or package name
        hasher.update(obfstr!("com.stonepot_tech.handsfree_pos").as_bytes());
    }

    // Finalize and return as hex string
    let result = hasher.finalize();
    hex::encode(result)
}

/// Get the encrypted database path
fn get_encrypted_db_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("secure_data.db")
}

/// Initialize the global encrypted database
pub fn initialize_encrypted_db(app_data_dir: &PathBuf) -> Result<(), String> {
    let db_path = get_encrypted_db_path(app_data_dir);
    let encryption_key = derive_encryption_key();

    let db = EncryptedDatabase::open(&db_path, &encryption_key)
        .map_err(|e| format!("Failed to open encrypted database: {}", e))?;

    db.initialize()
        .map_err(|e| format!("Failed to initialize encrypted database: {}", e))?;

    // Store in global state
    let mut global_db = ENCRYPTED_DB.lock().map_err(|e| format!("Lock error: {}", e))?;
    *global_db = Some(db);

    println!("[SecureDB] Encrypted database initialized at {:?}", db_path);
    Ok(())
}

/// Store a secret in the encrypted database
pub fn store_encrypted_secret(key: &str, value: &[u8]) -> Result<(), String> {
    let db = ENCRYPTED_DB.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db.as_ref().ok_or("Encrypted database not initialized")?;
    db.store_secret(key, value)
        .map_err(|e| format!("Failed to store secret: {}", e))
}

/// Retrieve a secret from the encrypted database
pub fn get_encrypted_secret(key: &str) -> Result<Option<Vec<u8>>, String> {
    let db = ENCRYPTED_DB.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db.as_ref().ok_or("Encrypted database not initialized")?;
    db.get_secret(key)
        .map_err(|e| format!("Failed to get secret: {}", e))
}

/// Delete a secret from the encrypted database
pub fn delete_encrypted_secret(key: &str) -> Result<(), String> {
    let db = ENCRYPTED_DB.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db.as_ref().ok_or("Encrypted database not initialized")?;
    db.delete_secret(key)
        .map_err(|e| format!("Failed to delete secret: {}", e))
}

/// Log a security event
pub fn log_security_event(event_type: &str, details: Option<&str>, ip: Option<&str>) -> Result<(), String> {
    let db = ENCRYPTED_DB.lock().map_err(|e| format!("Lock error: {}", e))?;
    if let Some(db) = db.as_ref() {
        db.log_security_event(event_type, details, ip)
            .map_err(|e| format!("Failed to log event: {}", e))?;
    }
    Ok(())
}

// Tauri commands for encrypted storage

/// Initialize the encrypted database (call on app startup)
#[tauri::command]
pub fn init_encrypted_storage(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure directory exists
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    initialize_encrypted_db(&app_data_dir)
}

/// Store a secret (generic)
#[tauri::command]
pub fn store_secret(key: String, value: String) -> Result<(), String> {
    store_encrypted_secret(&key, value.as_bytes())
}

/// Get a secret (generic)
#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    let result = get_encrypted_secret(&key)?;
    match result {
        Some(bytes) => {
            let s = String::from_utf8(bytes)
                .map_err(|e| format!("Invalid UTF-8: {}", e))?;
            Ok(Some(s))
        }
        None => Ok(None),
    }
}

/// Delete a secret
#[tauri::command]
pub fn delete_secret_cmd(key: String) -> Result<(), String> {
    delete_encrypted_secret(&key)
}
