/**
 * Translation Generator Tool
 *
 * One-time tool to generate translations for all 22 Indian languages using Sarvam AI.
 * Reads existing translation_keys from database and generates missing translations.
 *
 * Usage:
 *   cargo run --bin translate_generator
 *
 * Environment Variables:
 *   SARVAM_AI_API_KEY - Your Sarvam AI API key
 *   DATABASE_PATH - Path to SQLite database (optional, defaults to app data dir)
 */

use reqwest::Client;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::env;
use std::thread;
use std::time::Duration;

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
) -> Result<String, Box<dyn std::error::Error>> {
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
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        return Err(format!("API error: {}", error_text).into());
    }

    let translation: TranslationResponse = response.json().await?;
    Ok(translation.translated_text)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🌍 Translation Generator - Sarvam AI Integration");
    println!("================================================\n");

    // Get API key
    let api_key = env::var("SARVAM_AI_API_KEY")
        .expect("SARVAM_AI_API_KEY environment variable not set");

    // Get database path
    let db_path = env::var("DATABASE_PATH").unwrap_or_else(|_| {
        let home = env::var("HOME").expect("HOME not set");
        format!("{}/Library/Application Support/com.stonepot-tech.handsfree-pos/handsfree_pos.db", home)
    });

    println!("📂 Database: {}", db_path);
    println!("🔑 API Key: {}...{}", &api_key[..10], &api_key[api_key.len()-5..]);
    println!();

    // Connect to database
    let db = Connection::open(&db_path)?;
    println!("✅ Connected to database\n");

    // Get all translation keys
    let mut stmt = db.prepare(
        "SELECT id, key, default_value_en FROM translation_keys ORDER BY key"
    )?;

    let keys: Vec<(String, String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    println!("📝 Found {} translation keys", keys.len());
    println!();

    // Create HTTP client
    let client = Client::new();

    // Statistics
    let mut total_translations = 0;
    let mut new_translations = 0;
    let mut skipped_translations = 0;

    // Process each language
    for (lang_code, lang_name) in INDIAN_LANGUAGES {
        println!("🌐 Processing {} ({})...", lang_name, lang_code);

        for (key_id, key, default_value) in &keys {
            // Check if translation already exists
            let exists: bool = db
                .query_row(
                    "SELECT COUNT(*) FROM translations WHERE key_id = ? AND language = ?",
                    params![key_id, lang_code],
                    |row| row.get::<_, i64>(0),
                )? > 0;

            if exists {
                skipped_translations += 1;
                continue;
            }

            // Translate using Sarvam AI
            print!("  Translating '{}'... ", key);
            match translate_text(&client, &api_key, default_value, lang_code).await {
                Ok(translated) => {
                    // Insert into database
                    let trans_id = format!("trans-{}-{}", key.replace(".", "-"), lang_code.replace("-IN", ""));
                    db.execute(
                        "INSERT INTO translations (id, key_id, language, value) VALUES (?, ?, ?, ?)",
                        params![trans_id, key_id, lang_code, translated],
                    )?;

                    println!("✅ {}", translated);
                    new_translations += 1;
                    total_translations += 1;

                    // Rate limiting: Wait 100ms between requests to avoid hitting API limits
                    thread::sleep(Duration::from_millis(100));
                }
                Err(e) => {
                    println!("❌ Error: {}", e);
                    // Continue with next translation instead of failing completely
                }
            }
        }

        println!();
    }

    // Summary
    println!("\n📊 Translation Summary");
    println!("=====================");
    println!("Total translations: {}", total_translations);
    println!("New translations added: {}", new_translations);
    println!("Skipped (already exist): {}", skipped_translations);
    println!("\n✅ Translation generation complete!");

    Ok(())
}
