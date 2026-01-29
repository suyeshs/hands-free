/**
 * Translation Generation Commands
 *
 * Tauri commands to generate translations using Sarvam AI during
 * migration/provisioning flow.
 */

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;
use std::collections::HashMap;
use std::fs;
use tauri::State;

#[derive(Debug, Serialize)]
struct TranslationRequest {
    input: String,
    source_language_code: String,
    target_language_code: String,
    model: String,
}

#[derive(Debug, Deserialize)]
struct TranslationResponse {
    translated_text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationProgress {
    pub language: String,
    pub language_name: String,
    pub total_keys: usize,
    pub translated: usize,
    pub skipped: usize,
}

// All 22 Indian languages supported by Sarvam AI
const INDIAN_LANGUAGES: &[(&str, &str)] = &[
    ("hi-IN", "Hindi"),
    ("bn-IN", "Bengali"),
    ("mr-IN", "Marathi"),
    ("te-IN", "Telugu"),
    ("ta-IN", "Tamil"),
    ("gu-IN", "Gujarati"),
    ("ur-IN", "Urdu"),
    ("kn-IN", "Kannada"),
    ("od-IN", "Odia"),
    ("ml-IN", "Malayalam"),
    ("pa-IN", "Punjabi"),
    ("as-IN", "Assamese"),
    ("mai-IN", "Maithili"),
    ("sat-IN", "Santali"),
    ("ks-IN", "Kashmiri"),
    ("ne-IN", "Nepali"),
    ("sd-IN", "Sindhi"),
    ("doi-IN", "Dogri"),
    ("kok-IN", "Konkani"),
    ("mni-IN", "Manipuri"),
    ("brx-IN", "Bodo"),
    ("sa-IN", "Sanskrit"),
];

async fn translate_text(
    client: &Client,
    api_key: &str,
    text: &str,
    target_language: &str,
) -> Result<String, String> {
    let request = TranslationRequest {
        input: text.to_string(),
        source_language_code: "en-IN".to_string(),
        target_language_code: target_language.to_string(),
        model: "sarvam-translate:v1".to_string(),
    };

    let response = client
        .post("https://api.sarvam.ai/translate")
        .header("api-subscription-key", api_key)
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error: {}", error_text));
    }

    let translation: TranslationResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(translation.translated_text)
}

/// Generate all missing translations using Sarvam AI
/// Called automatically during provisioning or manually from settings
#[tauri::command]
pub async fn generate_translations(
    db_path: String,
) -> Result<Vec<TranslationProgress>, String> {
    println!("[Translations] Starting generation for 22 Indian languages");
    println!("[Translations] Database path: {}", db_path);

    // Get API key from environment
    let api_key = env::var("SARVAM_AI_API_KEY")
        .map_err(|_| "SARVAM_AI_API_KEY not set in environment".to_string())?;

    if api_key.is_empty() {
        return Err("SARVAM_AI_API_KEY is empty".to_string());
    }

    // Step 1: Collect all data from database (synchronous, no await)
    let (keys, existing_translations) = {
        // Check if database file exists
        println!("[Translations] Opening database: {}", db_path);
        println!("[Translations] File exists: {}", std::path::Path::new(&db_path).exists());

        let db = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        println!("[Translations] Database opened successfully");

        // Debug: List all tables in the database
        let table_query = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        if let Ok(mut stmt) = table_query {
            let tables: Vec<String> = stmt
                .query_map([], |row| row.get(0))
                .unwrap_or_else(|_| panic!("Failed to query tables"))
                .filter_map(Result::ok)
                .collect();
            println!("[Translations] Tables in database: {:?}", tables);
        }

        // Get all translation keys
        let mut stmt = db
            .prepare("SELECT id, key, default_value_en FROM translation_keys ORDER BY key")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let keys: Vec<(String, String, String)> = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| format!("Failed to query keys: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect keys: {}", e))?;

        // Get all existing translations
        let mut existing = HashMap::new();
        let mut stmt = db
            .prepare("SELECT key_id, language FROM translations")
            .map_err(|e| format!("Failed to prepare translations query: {}", e))?;

        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| format!("Failed to query existing translations: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect existing translations: {}", e))?;

        for (key_id, lang) in rows {
            existing.insert((key_id, lang), true);
        }

        (keys, existing)
        // db is dropped here, releasing the connection
    };

    println!("[Translations] Found {} translation keys", keys.len());

    let client = Client::new();
    let mut progress_list = Vec::new();
    let mut all_translations = Vec::new();

    // Step 2: Do all async translations (no database access)
    for (lang_code, lang_name) in INDIAN_LANGUAGES {
        println!("[Translations] Processing {} ({})...", lang_name, lang_code);

        let mut translated = 0;
        let mut skipped = 0;

        for (key_id, key, default_value) in &keys {
            // Check if translation already exists
            if existing_translations.contains_key(&(key_id.clone(), lang_code.to_string())) {
                skipped += 1;
                continue;
            }

            // Translate using Sarvam AI
            match translate_text(&client, &api_key, default_value, lang_code).await {
                Ok(translation_value) => {
                    let trans_id = format!("trans-{}-{}", key.replace(".", "-"), lang_code.replace("-IN", ""));
                    all_translations.push((trans_id, key_id.clone(), lang_code.to_string(), translation_value.clone()));

                    println!("[Translations]   {} -> {}", key, translation_value);
                    translated += 1;

                    // Rate limiting: Wait 500ms between requests to avoid rate limits
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
                Err(e) => {
                    let error_str = e.to_string();
                    println!("[Translations]   Error translating {}: {}", key, error_str);

                    // If rate limit error, wait longer before continuing
                    if error_str.contains("rate_limit") || error_str.contains("Rate limit") {
                        println!("[Translations]   Rate limit hit, waiting 10 seconds before continuing...");
                        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                    }
                    // Continue with next translation instead of failing completely
                }
            }
        }

        progress_list.push(TranslationProgress {
            language: lang_code.to_string(),
            language_name: lang_name.to_string(),
            total_keys: keys.len(),
            translated,
            skipped,
        });

        println!("[Translations] {} complete: {} new, {} existing", lang_name, translated, skipped);
    }

    // Step 3: Insert all translations into database (synchronous, after all async work)
    {
        let db = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database for insert: {}", e))?;

        for (trans_id, key_id, lang_code, translation_value) in all_translations {
            // Use INSERT OR IGNORE to skip duplicates instead of failing
            let result = db.execute(
                "INSERT OR IGNORE INTO translations (id, key_id, language, value) VALUES (?, ?, ?, ?)",
                params![trans_id, key_id, lang_code, translation_value],
            );

            match result {
                Ok(rows) => {
                    if rows == 0 {
                        println!("[Translations] Skipped duplicate: {} - {}", lang_code, key_id);
                    }
                }
                Err(e) => {
                    println!("[Translations] Warning: Failed to insert translation for {} - {}: {}", lang_code, key_id, e);
                    // Continue instead of failing completely
                }
            }
        }
        // db is dropped here
    }

    println!("[Translations] ✅ All translations generated!");
    Ok(progress_list)
}

/// Export translations to JSON files for mobile staff portal
#[tauri::command]
pub async fn export_translations_to_json(
    db_path: String,
    output_dir: String,
) -> Result<usize, String> {
    println!("[Translations] Exporting to JSON files: {}", output_dir);

    // Create output directory
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    // Connect to database
    let db = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let mut files_created = 0;

    // Export each language
    for (lang_code, lang_name) in INDIAN_LANGUAGES {
        // Get all translations for this language
        let mut translations = HashMap::new();

        let mut stmt = db
            .prepare(
                r#"
                SELECT
                    tk.key,
                    COALESCE(t.value, tk.default_value_en) as value
                FROM translation_keys tk
                LEFT JOIN translations t ON tk.id = t.key_id AND t.language = ?
                ORDER BY tk.category, tk.key
                "#
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt
            .query_map(params![lang_code], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| format!("Failed to query translations: {}", e))?;

        for row in rows {
            let (key, value) = row.map_err(|e| format!("Failed to read row: {}", e))?;
            translations.insert(key, value);
        }

        // Convert to nested JSON structure
        let mut json_tree: HashMap<String, serde_json::Value> = HashMap::new();

        for (key, value) in &translations {
            let parts: Vec<&str> = key.split('.').collect();

            if parts.len() == 1 {
                json_tree.insert(key.clone(), serde_json::json!(value));
            } else {
                let category = parts[0];
                let sub_key = parts[1..].join(".");

                json_tree
                    .entry(category.to_string())
                    .or_insert_with(|| serde_json::json!({}))
                    .as_object_mut()
                    .unwrap()
                    .insert(sub_key, serde_json::json!(value));
            }
        }

        // Add metadata
        let output = serde_json::json!({
            "_metadata": {
                "language": lang_code,
                "language_name": lang_name,
                "version": "1.0",
                "generated_at": chrono::Utc::now().to_rfc3339(),
                "total_keys": translations.len(),
            },
            "translations": json_tree,
        });

        // Write to file
        let file_path = format!("{}/{}.json", output_dir, lang_code);
        let json_string = serde_json::to_string_pretty(&output)
            .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
        fs::write(&file_path, json_string)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        files_created += 1;
        println!("[Translations] Exported {} ({} keys)", lang_code, translations.len());
    }

    println!("[Translations] ✅ Exported {} JSON files to {}", files_created, output_dir);
    Ok(files_created)
}

/// Check if translations have been generated
#[tauri::command]
pub async fn check_translations_status(db_path: String) -> Result<HashMap<String, usize>, String> {
    let db = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let mut status = HashMap::new();

    for (lang_code, lang_name) in INDIAN_LANGUAGES {
        let count: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM translations WHERE language = ?",
                params![lang_code],
                |row| row.get(0),
            )
            .unwrap_or(0);

        status.insert(lang_name.to_string(), count as usize);
    }

    Ok(status)
}
