use serde::{Deserialize, Serialize};
use tauri::Manager;
use rusqlite::{Connection, params};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComboFilterKeyword {
    pub id: String,
    pub filter_key: String,
    pub display_name: String,
    pub emoji: Option<String>,
    pub keywords: Vec<String>,
    pub color_class: Option<String>,
    pub sort_order: i32,
    pub active: bool,
}

#[tauri::command]
pub fn get_combo_filter_keywords(app: tauri::AppHandle) -> Result<Vec<ComboFilterKeyword>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        "SELECT id, filter_key, display_name, emoji, keywords, color_class, sort_order, active
         FROM combo_filter_keywords
         WHERE active = 1
         ORDER BY sort_order ASC"
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let keyword_iter = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let filter_key: String = row.get(1)?;
        let display_name: String = row.get(2)?;
        let emoji: Option<String> = row.get(3)?;
        let keywords_json: String = row.get(4)?;
        let color_class: Option<String> = row.get(5)?;
        let sort_order: i32 = row.get(6)?;
        let active: i32 = row.get(7)?;

        // Parse JSON keywords array
        let keywords: Vec<String> = serde_json::from_str(&keywords_json)
            .unwrap_or_else(|_| vec![]);

        Ok(ComboFilterKeyword {
            id,
            filter_key,
            display_name,
            emoji,
            keywords,
            color_class,
            sort_order,
            active: active == 1,
        })
    }).map_err(|e| format!("Failed to query combo filter keywords: {}", e))?;

    let keywords: Vec<ComboFilterKeyword> = keyword_iter
        .filter_map(|k| k.ok())
        .collect();

    Ok(keywords)
}

#[tauri::command]
pub fn save_combo_filter_keyword(
    app: tauri::AppHandle,
    keyword: ComboFilterKeyword,
) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Serialize keywords array to JSON
    let keywords_json = serde_json::to_string(&keyword.keywords)
        .map_err(|e| format!("Failed to serialize keywords: {}", e))?;

    db.execute(
        "INSERT OR REPLACE INTO combo_filter_keywords
         (id, filter_key, display_name, emoji, keywords, color_class, sort_order, active, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
        params![
            keyword.id,
            keyword.filter_key,
            keyword.display_name,
            keyword.emoji,
            keywords_json,
            keyword.color_class,
            keyword.sort_order,
            keyword.active as i32,
        ],
    )
    .map_err(|e| format!("Failed to save combo filter keyword: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_combo_filter_keyword(
    app: tauri::AppHandle,
    keyword_id: String,
) -> Result<(), String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute(
        "DELETE FROM combo_filter_keywords WHERE id = ?1",
        params![keyword_id],
    )
    .map_err(|e| format!("Failed to delete combo filter keyword: {}", e))?;

    Ok(())
}
