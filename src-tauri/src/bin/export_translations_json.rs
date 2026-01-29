/**
 * Export Translations to JSON Files
 *
 * Exports translations from SQLite database to lightweight JSON files
 * for mobile staff portal. Each language gets its own JSON file.
 *
 * Usage:
 *   cargo run --bin export_translations_json
 *
 * Output:
 *   src-tauri/static/i18n/en-IN.json
 *   src-tauri/static/i18n/hi-IN.json
 *   ... (22 files total)
 */

use rusqlite::{Connection, params};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::env;
use std::fs;

// All 22 Indian languages supported by Sarvam AI
const INDIAN_LANGUAGES: &[(&str, &str)] = &[
    ("en-IN", "English"),
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

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("📦 Translation JSON Exporter");
    println!("============================\n");

    // Get database path
    let db_path = env::var("DATABASE_PATH").unwrap_or_else(|_| {
        let home = env::var("HOME").expect("HOME not set");
        format!("{}/Library/Application Support/com.stonepot-tech.handsfree-pos/handsfree_pos.db", home)
    });

    println!("📂 Database: {}", db_path);

    // Connect to database
    let db = Connection::open(&db_path)?;
    println!("✅ Connected to database\n");

    // Create output directory
    let output_dir = "static/i18n";
    fs::create_dir_all(output_dir)?;
    println!("📁 Output directory: {}\n", output_dir);

    // Export each language
    for (lang_code, lang_name) in INDIAN_LANGUAGES {
        print!("🌐 Exporting {} ({})... ", lang_name, lang_code);

        // Get all translations for this language
        let mut translations = HashMap::new();

        // Query to get translations with fallback to English
        let mut stmt = db.prepare(
            r#"
            SELECT
                tk.key,
                COALESCE(t.value, tk.default_value_en) as value
            FROM translation_keys tk
            LEFT JOIN translations t ON tk.id = t.key_id AND t.language = ?
            ORDER BY tk.category, tk.key
            "#
        )?;

        let rows = stmt.query_map(params![lang_code], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        for row in rows {
            let (key, value) = row?;
            translations.insert(key, value);
        }

        // Convert to nested JSON structure
        let mut json_tree: HashMap<String, Value> = HashMap::new();

        for (key, value) in &translations {
            let parts: Vec<&str> = key.split('.').collect();

            if parts.len() == 1 {
                // Top-level key
                json_tree.insert(key.clone(), json!(value));
            } else {
                // Nested key (e.g., "pos.addToCart" -> { "pos": { "addToCart": "..." } })
                let category = parts[0];
                let sub_key = parts[1..].join(".");

                json_tree
                    .entry(category.to_string())
                    .or_insert_with(|| json!({}))
                    .as_object_mut()
                    .unwrap()
                    .insert(sub_key, json!(value));
            }
        }

        // Add metadata
        let output = json!({
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
        let json_string = serde_json::to_string_pretty(&output)?;
        fs::write(&file_path, json_string)?;

        let file_size = fs::metadata(&file_path)?.len();
        println!("✅ {} keys ({} KB)", translations.len(), file_size / 1024);
    }

    println!("\n📊 Export Summary");
    println!("=================");
    println!("Languages exported: {}", INDIAN_LANGUAGES.len());
    println!("Output directory: {}", output_dir);

    // Calculate total size
    let total_size: u64 = fs::read_dir(output_dir)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.metadata().ok())
        .map(|metadata| metadata.len())
        .sum();

    println!("Total size: {} KB", total_size / 1024);
    println!("\n✅ JSON export complete!");
    println!("\n💡 Usage in mobile app:");
    println!("   fetch('/static/i18n/hi-IN.json')");
    println!("     .then(r => r.json())");
    println!("     .then(data => loadTranslations(data.translations))");

    Ok(())
}
