// ============================================================================
// TRANSLATION SERVICE - Core i18n Logic
// ============================================================================

use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a single translation key with its metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationKey {
    pub id: String,
    pub key: String,
    pub category: String,
    pub description: Option<String>,
    pub default_value_en: String,
}

/// Represents a translation value for a specific language
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translation {
    pub id: String,
    pub key_id: String,
    pub language: String,
    pub value: String,
}

/// Represents a tenant-specific translation override
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantTranslationOverride {
    pub id: String,
    pub tenant_id: String,
    pub key_id: String,
    pub language: String,
    pub custom_value: String,
    pub updated_by: Option<String>,
}

/// Main translation service for loading and managing translations
pub struct TranslationService;

impl TranslationService {
    /// Get a single translation with tenant override and fallback support
    ///
    /// Fallback chain:
    /// 1. Tenant-specific override (if exists)
    /// 2. Base translation for language (if exists)
    /// 3. English default value
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `tenant_id` - Optional tenant ID for customization
    /// * `key` - Translation key (e.g., "pos.addToCart")
    /// * `language` - ISO 639-1 language code (e.g., "fr", "hi")
    pub fn get_translation(
        db: &Connection,
        tenant_id: Option<&str>,
        key: &str,
        language: &str,
    ) -> SqliteResult<String> {
        // Step 1: Try tenant override first (if tenant_id provided)
        if let Some(tid) = tenant_id {
            let override_result: SqliteResult<String> = db.query_row(
                r#"
                SELECT custom_value
                FROM tenant_translation_overrides
                WHERE tenant_id = ?1 AND key_id = (
                    SELECT id FROM translation_keys WHERE key = ?2
                ) AND language = ?3
                "#,
                params![tid, key, language],
                |row| row.get(0),
            );

            if let Ok(value) = override_result {
                return Ok(value);
            }
        }

        // Step 2: Try base translation for the language
        let translation_result: SqliteResult<String> = db.query_row(
            r#"
            SELECT t.value
            FROM translations t
            INNER JOIN translation_keys tk ON t.key_id = tk.id
            WHERE tk.key = ?1 AND t.language = ?2
            "#,
            params![key, language],
            |row| row.get(0),
        );

        if let Ok(value) = translation_result {
            return Ok(value);
        }

        // Step 3: Fallback to English default
        let default_result: SqliteResult<String> = db.query_row(
            r#"
            SELECT default_value_en
            FROM translation_keys
            WHERE key = ?1
            "#,
            params![key],
            |row| row.get(0),
        );

        // If key doesn't exist at all, return the key itself
        default_result.or(Ok(key.to_string()))
    }

    /// Get all translations for a specific language and optional namespace
    ///
    /// Returns a HashMap of key -> translated value
    /// Includes tenant overrides if tenant_id is provided
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `tenant_id` - Optional tenant ID for customization
    /// * `language` - ISO 639-1 language code
    /// * `namespace` - Optional category filter (e.g., "pos", "common")
    pub fn get_all_translations(
        db: &Connection,
        tenant_id: Option<&str>,
        language: &str,
        namespace: Option<&str>,
    ) -> SqliteResult<HashMap<String, String>> {
        let mut translations = HashMap::new();

        // Build the SQL query with optional category filter
        let category_filter = namespace.map(|_| "WHERE tk.category = ?").unwrap_or("");

        let base_query = format!(
            r#"
            SELECT tk.key, COALESCE(t.value, tk.default_value_en) as value
            FROM translation_keys tk
            LEFT JOIN translations t ON tk.id = t.key_id AND t.language = ?
            {}
            ORDER BY tk.category, tk.key
            "#,
            category_filter
        );

        // Execute query to get base translations
        let mut stmt = db.prepare(&base_query)?;

        let results: Vec<_> = if let Some(ns) = namespace {
            stmt.query_map(params![language, ns], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?.collect()
        } else {
            stmt.query_map(params![language], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?.collect()
        };

        for row in results {
            let (key, value) = row?;
            translations.insert(key, value);
        }

        // If tenant_id provided, apply overrides
        if let Some(tid) = tenant_id {
            let override_query = if let Some(_) = namespace {
                r#"
                SELECT tk.key, tto.custom_value
                FROM tenant_translation_overrides tto
                INNER JOIN translation_keys tk ON tto.key_id = tk.id
                WHERE tto.tenant_id = ? AND tto.language = ? AND tk.category = ?
                "#
            } else {
                r#"
                SELECT tk.key, tto.custom_value
                FROM tenant_translation_overrides tto
                INNER JOIN translation_keys tk ON tto.key_id = tk.id
                WHERE tto.tenant_id = ? AND tto.language = ?
                "#
            };

            let mut override_stmt = db.prepare(override_query)?;

            let override_results: Vec<_> = if let Some(ns) = namespace {
                override_stmt.query_map(params![tid, language, ns], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })?.collect()
            } else {
                override_stmt.query_map(params![tid, language], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })?.collect()
            };

            for row in override_results {
                let (key, value) = row?;
                translations.insert(key, value); // Override base translation
            }
        }

        Ok(translations)
    }

    /// Get all translation keys (for admin UI)
    ///
    /// Returns all translatable keys with metadata
    /// Useful for building translation management interfaces
    pub fn get_all_keys(db: &Connection, category: Option<&str>) -> SqliteResult<Vec<TranslationKey>> {
        let query = if category.is_some() {
            "SELECT id, key, category, description, default_value_en FROM translation_keys WHERE category = ? ORDER BY key"
        } else {
            "SELECT id, key, category, description, default_value_en FROM translation_keys ORDER BY category, key"
        };

        let mut stmt = db.prepare(query)?;

        let results: Vec<_> = if let Some(cat) = category {
            stmt.query_map(params![cat], |row| {
                Ok(TranslationKey {
                    id: row.get(0)?,
                    key: row.get(1)?,
                    category: row.get(2)?,
                    description: row.get(3)?,
                    default_value_en: row.get(4)?,
                })
            })?.collect()
        } else {
            stmt.query_map([], |row| {
                Ok(TranslationKey {
                    id: row.get(0)?,
                    key: row.get(1)?,
                    category: row.get(2)?,
                    description: row.get(3)?,
                    default_value_en: row.get(4)?,
                })
            })?.collect()
        };

        results.into_iter().collect()
    }

    /// Update or create a tenant translation override
    ///
    /// Allows restaurant admins to customize translations
    /// Creates a new override or updates existing one
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `tenant_id` - Tenant identifier
    /// * `key` - Translation key
    /// * `language` - Language code
    /// * `custom_value` - Custom translation value
    /// * `updated_by` - Staff user ID who made the change
    pub fn set_tenant_override(
        db: &Connection,
        tenant_id: &str,
        key: &str,
        language: &str,
        custom_value: &str,
        updated_by: Option<&str>,
    ) -> SqliteResult<()> {
        // First, get the key_id
        let key_id: String = db.query_row(
            "SELECT id FROM translation_keys WHERE key = ?",
            params![key],
            |row| row.get(0),
        )?;

        // Generate unique ID
        let override_id = format!("override-{}-{}-{}", tenant_id, key, language);

        // Upsert the override
        db.execute(
            r#"
            INSERT INTO tenant_translation_overrides (id, tenant_id, key_id, language, custom_value, updated_by)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(tenant_id, key_id, language) DO UPDATE SET
                custom_value = excluded.custom_value,
                updated_at = strftime('%s', 'now'),
                updated_by = excluded.updated_by
            "#,
            params![override_id, tenant_id, key_id, language, custom_value, updated_by],
        )?;

        Ok(())
    }

    /// Delete a tenant translation override
    ///
    /// Removes customization and reverts to base translation
    pub fn delete_tenant_override(
        db: &Connection,
        tenant_id: &str,
        key: &str,
        language: &str,
    ) -> SqliteResult<()> {
        db.execute(
            r#"
            DELETE FROM tenant_translation_overrides
            WHERE tenant_id = ?1 AND key_id = (
                SELECT id FROM translation_keys WHERE key = ?2
            ) AND language = ?3
            "#,
            params![tenant_id, key, language],
        )?;

        Ok(())
    }

    /// Get all tenant overrides for management UI
    ///
    /// Returns list of all customizations made by a tenant
    pub fn get_tenant_overrides(
        db: &Connection,
        tenant_id: &str,
        language: Option<&str>,
    ) -> SqliteResult<Vec<TenantTranslationOverride>> {
        let query = if language.is_some() {
            r#"
            SELECT id, tenant_id, key_id, language, custom_value, updated_by
            FROM tenant_translation_overrides
            WHERE tenant_id = ? AND language = ?
            ORDER BY updated_at DESC
            "#
        } else {
            r#"
            SELECT id, tenant_id, key_id, language, custom_value, updated_by
            FROM tenant_translation_overrides
            WHERE tenant_id = ?
            ORDER BY updated_at DESC
            "#
        };

        let mut stmt = db.prepare(query)?;

        let results: Vec<_> = if let Some(lang) = language {
            stmt.query_map(params![tenant_id, lang], |row| {
                Ok(TenantTranslationOverride {
                    id: row.get(0)?,
                    tenant_id: row.get(1)?,
                    key_id: row.get(2)?,
                    language: row.get(3)?,
                    custom_value: row.get(4)?,
                    updated_by: row.get(5)?,
                })
            })?.collect()
        } else {
            stmt.query_map(params![tenant_id], |row| {
                Ok(TenantTranslationOverride {
                    id: row.get(0)?,
                    tenant_id: row.get(1)?,
                    key_id: row.get(2)?,
                    language: row.get(3)?,
                    custom_value: row.get(4)?,
                    updated_by: row.get(5)?,
                })
            })?.collect()
        };

        results.into_iter().collect()
    }

    /// Get user's preferred language from database
    ///
    /// Returns the preferred language for a staff user
    /// Defaults to "en" if not set
    pub fn get_user_language(db: &Connection, user_id: &str) -> SqliteResult<String> {
        let result: SqliteResult<String> = db.query_row(
            "SELECT preferred_language FROM staff_users WHERE id = ?",
            params![user_id],
            |row| row.get(0),
        );

        Ok(result.unwrap_or_else(|_| "en".to_string()))
    }

    /// Set user's preferred language
    ///
    /// Updates the staff user's language preference
    pub fn set_user_language(
        db: &Connection,
        user_id: &str,
        language: &str,
    ) -> SqliteResult<()> {
        db.execute(
            "UPDATE staff_users SET preferred_language = ? WHERE id = ?",
            params![language, user_id],
        )?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_translation_service() {
        let db = Connection::open_in_memory().unwrap();

        // Create schema (simplified for test)
        db.execute_batch(
            r#"
            CREATE TABLE translation_keys (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE,
                category TEXT,
                description TEXT,
                default_value_en TEXT
            );
            CREATE TABLE translations (
                id TEXT PRIMARY KEY,
                key_id TEXT,
                language TEXT,
                value TEXT
            );
            "#,
        )
        .unwrap();

        // Insert test data
        db.execute(
            "INSERT INTO translation_keys VALUES ('k1', 'common.save', 'common', 'Save button', 'Save')",
            [],
        )
        .unwrap();

        db.execute(
            "INSERT INTO translations VALUES ('t1', 'k1', 'fr', 'Enregistrer')",
            [],
        )
        .unwrap();

        // Test translation retrieval
        let french = TranslationService::get_translation(&db, None, "common.save", "fr").unwrap();
        assert_eq!(french, "Enregistrer");

        let english = TranslationService::get_translation(&db, None, "common.save", "en").unwrap();
        assert_eq!(english, "Save");
    }
}
