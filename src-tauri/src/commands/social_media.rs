/**
 * Social Media Campaign Commands
 *
 * Secure Tauri commands for:
 * - OAuth token encryption/storage (AES-256-GCM)
 * - API credentials management (tenant-provided keys)
 * - Secure API calls to social platforms
 * - Post scheduling and publishing
 */

use tauri::{command, Manager};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use base64::{Engine as _, engine::general_purpose};

// ============================================================================
// TYPES & STRUCTURES
// ============================================================================

#[derive(Serialize, Deserialize, Clone)]
pub struct OAuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: String,
    pub platform_account_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct ApiCredentials {
    pub app_id: String,
    pub app_secret: String,
    pub verify_token: Option<String>,
}

// ============================================================================
// OAUTH TOKEN MANAGEMENT
// ============================================================================

/// Store OAuth token (encrypted with AES-256-GCM)
#[command]
pub async fn store_oauth_token(
    tenant_id: String,
    platform: String,
    access_token: String,
    refresh_token: Option<String>,
    expires_at: String,
    platform_account_id: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use ring::hkdf;
    use aes_gcm::{
        aead::{Aead, KeyInit, OsRng},
        Aes256Gcm, Nonce
    };
    use rand::RngCore;

    // 1. Generate encryption key from device key + tenant_id using HKDF
    let device_key = get_device_encryption_key(&app)?;
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, tenant_id.as_bytes());
    let prk = salt.extract(&device_key);
    let info: &[&[u8]] = &[b"social-campaigns"];

    let mut encryption_key = [0u8; 32];
    let okm = prk.expand(info, hkdf::HKDF_SHA256)
        .map_err(|_| "Key derivation failed".to_string())?;
    okm.fill(&mut encryption_key)
        .map_err(|_| "Key generation failed".to_string())?;

    // 2. Encrypt tokens using AES-256-GCM
    let cipher = Aes256Gcm::new(&encryption_key.into());

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted_access = cipher
        .encrypt(nonce, access_token.as_bytes())
        .map_err(|_| "Encryption failed".to_string())?;

    let encrypted_refresh = if let Some(ref token) = refresh_token {
        let mut nonce_bytes2 = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes2);
        let nonce2 = Nonce::from_slice(&nonce_bytes2);

        Some(cipher
            .encrypt(nonce2, token.as_bytes())
            .map_err(|_| "Encryption failed".to_string())?)
    } else {
        None
    };

    // 3. Store in local SQLite
    let db_path = get_db_path(&app)?;
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let encrypted_access_b64 = general_purpose::STANDARD.encode(&encrypted_access);
    let encrypted_refresh_b64 = encrypted_refresh.map(|r| general_purpose::STANDARD.encode(&r));
    let nonce_b64 = general_purpose::STANDARD.encode(&nonce_bytes);

    conn.execute(
        "INSERT OR REPLACE INTO social_oauth_tokens
         (id, tenant_id, platform, encrypted_access_token, encrypted_refresh_token,
          expires_at, platform_account_id, created_at, updated_at, connected_at, nonce)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            uuid::Uuid::new_v4().to_string(),
            tenant_id,
            platform,
            encrypted_access_b64,
            encrypted_refresh_b64,
            expires_at,
            platform_account_id,
            chrono::Utc::now().to_rfc3339(),
            chrono::Utc::now().to_rfc3339(),
            chrono::Utc::now().to_rfc3339(),
            nonce_b64,
        ],
    )
    .map_err(|e| format!("Database insert failed: {}", e))?;

    Ok("Token stored securely".to_string())
}

/// Get OAuth token (decrypted)
#[command]
pub async fn get_oauth_token(
    tenant_id: String,
    platform: String,
    app: tauri::AppHandle,
) -> Result<OAuthToken, String> {
    use ring::hkdf;
    use aes_gcm::{
        aead::{Aead, KeyInit},
        Aes256Gcm, Nonce
    };

    // 1. Retrieve from local SQLite
    let db_path = get_db_path(&app)?;
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT encrypted_access_token, encrypted_refresh_token, expires_at,
                    platform_account_id, nonce
             FROM social_oauth_tokens
             WHERE tenant_id = ?1 AND platform = ?2 AND is_active = 1",
        )
        .map_err(|e| format!("Query preparation failed: {}", e))?;

    let (encrypted_access, encrypted_refresh, expires_at, platform_account_id, nonce): (
        String,
        Option<String>,
        String,
        String,
        String,
    ) = stmt
        .query_row(rusqlite::params![tenant_id, platform], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .map_err(|e| format!("Token not found for {}/{}: {}", tenant_id, platform, e))?;

    // 2. Derive encryption key
    let device_key = get_device_encryption_key(&app)?;
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, tenant_id.as_bytes());
    let prk = salt.extract(&device_key);
    let info: &[&[u8]] = &[b"social-campaigns"];

    let mut encryption_key = [0u8; 32];
    let okm = prk.expand(info, hkdf::HKDF_SHA256)
        .map_err(|_| "Key derivation failed".to_string())?;
    okm.fill(&mut encryption_key)
        .map_err(|_| "Key generation failed".to_string())?;

    // 3. Decrypt tokens
    let cipher = Aes256Gcm::new(&encryption_key.into());
    let nonce_bytes = general_purpose::STANDARD.decode(&nonce)
        .map_err(|_| "Invalid nonce".to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted_access_bytes = general_purpose::STANDARD.decode(&encrypted_access)
        .map_err(|_| "Invalid base64".to_string())?;

    let access_token = cipher
        .decrypt(nonce, encrypted_access_bytes.as_ref())
        .map_err(|_| "Decryption failed".to_string())?;

    let access_token = String::from_utf8(access_token)
        .map_err(|_| "Invalid UTF-8".to_string())?;

    let refresh_token = if let Some(ref encrypted) = encrypted_refresh {
        let encrypted_bytes = general_purpose::STANDARD.decode(encrypted)
            .map_err(|_| "Invalid base64".to_string())?;

        let decrypted = cipher
            .decrypt(nonce, encrypted_bytes.as_ref())
            .map_err(|_| "Decryption failed".to_string())?;

        Some(String::from_utf8(decrypted)
            .map_err(|_| "Invalid UTF-8".to_string())?)
    } else {
        None
    };

    Ok(OAuthToken {
        access_token,
        refresh_token,
        expires_at,
        platform_account_id,
    })
}

// ============================================================================
// API CREDENTIALS MANAGEMENT
// ============================================================================

/// Store API credentials (tenant-provided app keys)
#[command]
pub async fn store_api_credentials(
    platform: String,
    app_id: String,
    app_secret: String,
    verify_token: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use ring::hkdf;
    use aes_gcm::{
        aead::{Aead, KeyInit, OsRng},
        Aes256Gcm, Nonce
    };
    use rand::RngCore;

    let tenant_id = get_current_tenant_id(&app)?;

    // Derive encryption key
    let device_key = get_device_encryption_key(&app)?;
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, tenant_id.as_bytes());
    let prk = salt.extract(&device_key);
    let info: &[&[u8]] = &[b"social-campaigns"];

    let mut encryption_key = [0u8; 32];
    let okm = prk.expand(info, hkdf::HKDF_SHA256)
        .map_err(|_| "Key derivation failed".to_string())?;
    okm.fill(&mut encryption_key)
        .map_err(|_| "Key generation failed".to_string())?;

    // Encrypt credentials
    let cipher = Aes256Gcm::new(&encryption_key.into());

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted_app_id = cipher
        .encrypt(nonce, app_id.as_bytes())
        .map_err(|_| "Encryption failed".to_string())?;

    let encrypted_app_secret = cipher
        .encrypt(nonce, app_secret.as_bytes())
        .map_err(|_| "Encryption failed".to_string())?;

    let encrypted_verify_token = if let Some(ref token) = verify_token {
        Some(cipher
            .encrypt(nonce, token.as_bytes())
            .map_err(|_| "Encryption failed".to_string())?)
    } else {
        None
    };

    // Store in local SQLite
    let db_path = get_db_path(&app)?;
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO social_api_credentials
         (id, tenant_id, platform, encrypted_app_id, encrypted_app_secret,
          encrypted_verify_token, is_configured, created_at, updated_at, nonce)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8, ?9)",
        rusqlite::params![
            uuid::Uuid::new_v4().to_string(),
            tenant_id,
            platform,
            general_purpose::STANDARD.encode(&encrypted_app_id),
            general_purpose::STANDARD.encode(&encrypted_app_secret),
            encrypted_verify_token.map(|t| general_purpose::STANDARD.encode(&t)),
            chrono::Utc::now().to_rfc3339(),
            chrono::Utc::now().to_rfc3339(),
            general_purpose::STANDARD.encode(&nonce_bytes),
        ],
    )
    .map_err(|e| format!("Database insert failed: {}", e))?;

    Ok("API credentials stored securely".to_string())
}

/// Check if API credentials are configured
#[command]
pub async fn check_api_credentials(
    platform: String,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let tenant_id = get_current_tenant_id(&app)?;
    let db_path = get_db_path(&app)?;
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let configured: bool = conn
        .query_row(
            "SELECT is_configured FROM social_api_credentials
             WHERE tenant_id = ?1 AND platform = ?2",
            rusqlite::params![tenant_id, platform],
            |row| row.get(0),
        )
        .unwrap_or(false);

    Ok(configured)
}

// ============================================================================
// SECURE API CALLS
// ============================================================================

/// Make secure API call to social media platform
#[command]
pub async fn secure_social_api_call(
    tenant_id: String,
    platform: String,
    endpoint: String,
    method: String,
    body: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // 1. Get OAuth token
    let token = get_oauth_token(tenant_id.clone(), platform.clone(), app.clone()).await?;

    // 2. Build API request
    let client = reqwest::Client::new();
    let url = build_platform_url(&platform, &endpoint)?;

    let mut request = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => return Err("Unsupported HTTP method".to_string()),
    };

    // 3. Add OAuth authorization
    request = request.header("Authorization", format!("Bearer {}", token.access_token));

    // 4. Add body if present
    if let Some(body_data) = body {
        request = request
            .header("Content-Type", "application/json")
            .body(body_data);
    }

    // 5. Execute request
    let response = request
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(response_text)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn get_device_encryption_key(app: &tauri::AppHandle) -> Result<Vec<u8>, String> {
    // Get device-specific encryption key from secure storage
    // This should be generated once and stored securely
    // For now, use a placeholder - in production, use keyring or secure enclave
    Ok(b"device-specific-encryption-key-32b".to_vec())
}

fn get_current_tenant_id(app: &tauri::AppHandle) -> Result<String, String> {
    // Get current tenant ID from app state
    // Placeholder implementation
    Ok("default-tenant".to_string())
}

fn get_db_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("database.db"))
        .map_err(|e| format!("Failed to get database path: {}", e))
}

fn build_platform_url(platform: &str, endpoint: &str) -> Result<String, String> {
    let base_url = match platform {
        "instagram" => "https://graph.facebook.com/v18.0",
        "tiktok" => "https://open.tiktokapis.com/v2",
        "whatsapp" => "https://graph.facebook.com/v18.0",
        _ => return Err(format!("Unsupported platform: {}", platform)),
    };

    Ok(format!("{}/{}", base_url, endpoint.trim_start_matches('/')))
}
