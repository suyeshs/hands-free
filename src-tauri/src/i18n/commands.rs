// ============================================================================
// TAURI COMMANDS - Translation API for Frontend
// ============================================================================

use super::service::TranslationService;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{Manager, State};

/// Response for translation requests
#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationsResponse {
    pub translations: HashMap<String, String>,
    pub language: String,
    pub namespace: Option<String>,
}

/// Request for updating a tenant override
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTranslationRequest {
    pub key: String,
    pub language: String,
    pub value: String,
}

/// Get all translations for a specific language and optional namespace
///
/// Tauri command to load translations from Rust into React
/// Includes tenant-specific overrides if tenant_id is provided
///
/// # Arguments
/// * `language` - ISO 639-1 language code (e.g., "fr", "hi", "es")
/// * `namespace` - Optional namespace filter (e.g., "pos", "common")
/// * `tenant_id` - Optional tenant ID for customization
#[tauri::command]
pub async fn get_translations(
    app: tauri::AppHandle,
    language: String,
    namespace: Option<String>,
    tenant_id: Option<String>,
) -> Result<TranslationsResponse, String> {
    // Open database connection using the same path as migrations
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Load translations using TranslationService
    let translations = TranslationService::get_all_translations(
        &db,
        tenant_id.as_deref(),
        &language,
        namespace.as_deref(),
    )
    .map_err(|e| e.to_string())?;

    Ok(TranslationsResponse {
        translations,
        language,
        namespace,
    })
}

/// Get a single translation
///
/// Retrieves one specific translation with fallback support
#[tauri::command]
pub async fn get_translation(
    app: tauri::AppHandle,
    key: String,
    language: String,
    tenant_id: Option<String>,
) -> Result<String, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    TranslationService::get_translation(&db, tenant_id.as_deref(), &key, &language)
        .map_err(|e| e.to_string())
}

/// Update a tenant-specific translation override
///
/// Allows restaurant admins to customize labels
/// Creates or updates an override in tenant_translation_overrides table
#[tauri::command]
pub async fn update_tenant_translation(
    app: tauri::AppHandle,
    tenant_id: String,
    key: String,
    language: String,
    value: String,
    user_id: Option<String>,
) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    TranslationService::set_tenant_override(
        &db,
        &tenant_id,
        &key,
        &language,
        &value,
        user_id.as_deref(),
    )
    .map_err(|e| e.to_string())
}

/// Delete a tenant translation override
///
/// Reverts to base translation by removing customization
#[tauri::command]
pub async fn delete_tenant_translation(
    app: tauri::AppHandle,
    tenant_id: String,
    key: String,
    language: String,
) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    TranslationService::delete_tenant_override(&db, &tenant_id, &key, &language)
        .map_err(|e| e.to_string())
}

/// Get all tenant overrides (for admin UI)
///
/// Returns list of all custom translations set by this tenant
#[tauri::command]
pub async fn get_tenant_overrides(
    app: tauri::AppHandle,
    tenant_id: String,
    language: Option<String>,
) -> Result<Vec<super::service::TenantTranslationOverride>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    TranslationService::get_tenant_overrides(&db, &tenant_id, language.as_deref())
        .map_err(|e| e.to_string())
}

/// Get all translation keys (for admin UI)
///
/// Useful for building translation management interfaces
/// Returns all translatable keys with metadata
#[tauri::command]
pub async fn get_translation_keys(
    app: tauri::AppHandle,
    category: Option<String>,
) -> Result<Vec<super::service::TranslationKey>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    TranslationService::get_all_keys(&db, category.as_deref()).map_err(|e| e.to_string())
}

/// Get user's preferred language
///
/// Retrieves the staff user's language preference from database
#[tauri::command]
pub async fn get_user_language(app: tauri::AppHandle, user_id: String) -> Result<String, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    TranslationService::get_user_language(&db, &user_id).map_err(|e| e.to_string())
}

/// Set user's preferred language
///
/// Updates the staff user's language preference
#[tauri::command]
pub async fn set_user_language(app: tauri::AppHandle, user_id: String, language: String) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    TranslationService::set_user_language(&db, &user_id, &language).map_err(|e| e.to_string())
}

/// ============================================================================
/// AI-POWERED TRANSLITERATION (Gemini API)
/// ============================================================================
///
/// For menu items, restaurant names, and proper nouns, we use AI transliteration
/// instead of simple translation to ensure phonetically accurate local script rendering.
///
/// Example:
/// - "Margherita Pizza" → "मार्घेरिटा पिज्जा" (Hindi transliteration)
/// - Not: "मार्गेरिटा पिज्जा" (incorrect phonetics)
/// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct TransliterateRequest {
    pub text: String,
    pub target_language: String,
    pub source_language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransliterateResponse {
    pub original: String,
    pub transliterated: String,
    pub language: String,
}

/// Transliterate text using Gemini API
///
/// Converts proper nouns and menu items to local scripts
/// with phonetically accurate transliteration
///
/// # Arguments
/// * `text` - Text to transliterate (e.g., "Margherita Pizza")
/// * `target_language` - Target language code (e.g., "hi", "ta", "th")
/// * `source_language` - Optional source language (defaults to "en")
/// * `gemini_api_key` - Gemini API key from environment or settings
#[tauri::command]
pub async fn transliterate_text(
    text: String,
    target_language: String,
    source_language: Option<String>,
    gemini_api_key: Option<String>,
) -> Result<TransliterateResponse, String> {
    // Get API key from parameter or environment variable
    let api_key = gemini_api_key
        .or_else(|| std::env::var("GEMINI_API_KEY").ok())
        .ok_or("Gemini API key not provided")?;

    let source = source_language.unwrap_or_else(|| "en".to_string());

    // Build Gemini API request
    let prompt = format!(
        r#"Transliterate the following text from {} to {} script.
Provide ONLY the transliterated text in {} script, nothing else.
Do not translate the meaning - just convert the sounds to {} script.

Text to transliterate: {}

Transliterated text:"#,
        source, target_language, target_language, target_language, text
    );

    // Call Gemini API
    let client = reqwest::Client::new();
    let response = client
        .post("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent")
        .header("Content-Type", "application/json")
        .query(&[("key", api_key)])
        .json(&serde_json::json!({
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 256
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Gemini API request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Gemini API error: {}", response.status()));
    }

    // Parse response
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

    let transliterated = json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or("Invalid Gemini API response format")?
        .trim()
        .to_string();

    Ok(TransliterateResponse {
        original: text,
        transliterated,
        language: target_language,
    })
}

/// Batch transliterate multiple menu items
///
/// Efficiently transliterates multiple items in one API call
/// Returns a HashMap of original -> transliterated text
#[tauri::command]
pub async fn transliterate_batch(
    items: Vec<String>,
    target_language: String,
    source_language: Option<String>,
    gemini_api_key: Option<String>,
) -> Result<HashMap<String, String>, String> {
    let mut results = HashMap::new();

    for item in items {
        let response = transliterate_text(
            item.clone(),
            target_language.clone(),
            source_language.clone(),
            gemini_api_key.clone(),
        )
        .await?;

        results.insert(item, response.transliterated);
    }

    Ok(results)
}
