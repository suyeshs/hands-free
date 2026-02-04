/**
 * Table Token Management
 *
 * Generates and validates secure tokens for QR code table ordering.
 * Each table gets a unique token that expires after 7 days.
 */

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use rand::Rng;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct TableToken {
    pub table_id: String,
    pub token: String,
    pub created_at: i64,
    pub expires_at: i64,
}

/// Generate a secure random token
fn generate_secure_token() -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: [u8; 32] = rng.gen();
    hex::encode(random_bytes)
}

/// Generate or refresh a table token
#[tauri::command]
pub async fn generate_table_token(app: tauri::AppHandle, table_id: String) -> Result<TableToken, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let token = generate_secure_token();
    let now = chrono::Utc::now().timestamp();
    let expires_at = now + (7 * 24 * 60 * 60); // 7 days from now

    // Insert or replace existing token
    db.execute(
        "INSERT INTO table_tokens (table_id, token, created_at, expires_at, regenerate_count)
         VALUES (?1, ?2, ?3, ?4, 0)
         ON CONFLICT(table_id) DO UPDATE SET
            token = ?2,
            created_at = ?3,
            expires_at = ?4,
            regenerate_count = regenerate_count + 1",
        params![&table_id, &token, now, expires_at],
    )
    .map_err(|e| format!("Failed to generate token: {}", e))?;

    println!("[TableTokens] Generated token for table: {}", table_id);

    Ok(TableToken {
        table_id,
        token,
        created_at: now,
        expires_at,
    })
}

/// Validate a table token
#[tauri::command]
pub async fn validate_table_token(app: tauri::AppHandle, table_id: String, token: String) -> Result<bool, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().timestamp();

    let is_valid = db
        .query_row(
            "SELECT 1 FROM table_tokens
             WHERE table_id = ?1 AND token = ?2 AND expires_at > ?3",
            params![&table_id, &token, now],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if is_valid {
        println!("[TableTokens] Valid token for table: {}", table_id);
    } else {
        println!("[TableTokens] Invalid or expired token for table: {}", table_id);
    }

    Ok(is_valid)
}

/// Get token for a table (if exists and not expired)
#[tauri::command]
pub async fn get_table_token(app: tauri::AppHandle, table_id: String) -> Result<Option<TableToken>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().timestamp();

    let result = db
        .query_row(
            "SELECT table_id, token, created_at, expires_at
             FROM table_tokens
             WHERE table_id = ?1 AND expires_at > ?2",
            params![&table_id, now],
            |row| {
                Ok(TableToken {
                    table_id: row.get(0)?,
                    token: row.get(1)?,
                    created_at: row.get(2)?,
                    expires_at: row.get(3)?,
                })
            },
        )
        .ok();

    Ok(result)
}

/// Generate tokens for all tables in floor plan
#[tauri::command]
pub async fn generate_tokens_for_all_tables(app: tauri::AppHandle) -> Result<Vec<TableToken>, String> {
    // Collect table IDs in a separate scope to avoid holding connection across await
    let table_ids = {
        let db_path = app.path().app_data_dir()
            .map_err(|e| e.to_string())?
            .join(crate::get_db_filename());
        let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

        // Get all table IDs from floor plan
        let mut stmt = db
            .prepare("SELECT id FROM tables")
            .map_err(|e| format!("Failed to query tables: {}", e))?;

        let table_ids: Result<Vec<String>, _> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to fetch tables: {}", e))?
            .collect();

        table_ids.map_err(|e| format!("Failed to process tables: {}", e))?
    }; // db and stmt dropped here

    // Generate token for each table
    let mut tokens = Vec::new();
    for table_id in table_ids {
        match generate_table_token(app.clone(), table_id.clone()).await {
            Ok(token) => tokens.push(token),
            Err(e) => eprintln!("[TableTokens] Failed to generate token for table {}: {}", table_id, e),
        }
    }

    println!("[TableTokens] Generated {} tokens", tokens.len());

    Ok(tokens)
}

/// Delete expired tokens (cleanup)
#[tauri::command]
pub async fn cleanup_expired_tokens(app: tauri::AppHandle) -> Result<usize, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().timestamp();

    let deleted = db
        .execute("DELETE FROM table_tokens WHERE expires_at <= ?1", params![now])
        .map_err(|e| format!("Failed to cleanup tokens: {}", e))?;

    println!("[TableTokens] Cleaned up {} expired tokens", deleted);

    Ok(deleted)
}
