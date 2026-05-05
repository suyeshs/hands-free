-- ============================================================================
-- MULTILINGUAL SUPPORT SCHEMA
-- ============================================================================
-- This migration adds comprehensive i18n support with:
-- 1. Translation keys registry (all translatable UI strings)
-- 2. Multi-language translation storage (13+ languages)
-- 3. Per-tenant customization (restaurant-specific terminology)
-- ============================================================================

-- ============================================================================
-- 1. TRANSLATION KEYS TABLE
-- ============================================================================
-- Defines all translatable UI strings across the application
-- Each key represents a unique translatable string (e.g., "pos.addToCart")
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,           -- Namespaced key: "common.save", "pos.addToCart"
    category TEXT NOT NULL,              -- Namespace: "common", "pos", "menu", "settings", etc.
    description TEXT,                    -- Context for admins: "Button text for adding items to cart"
    default_value_en TEXT NOT NULL,      -- English default value (fallback)
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_keys_category ON translation_keys(category);
CREATE INDEX IF NOT EXISTS idx_translation_keys_key ON translation_keys(key);

-- ============================================================================
-- 2. TRANSLATIONS TABLE
-- ============================================================================
-- Stores actual translations for each key in different languages
-- This is the base translation that all tenants share by default
-- ============================================================================
CREATE TABLE IF NOT EXISTS translations (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,                -- FK to translation_keys.id
    language TEXT NOT NULL,              -- ISO 639-1 code: "en", "fr", "hi", "es", etc.
    value TEXT NOT NULL,                 -- Translated string
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (key_id) REFERENCES translation_keys(id) ON DELETE CASCADE,
    UNIQUE(key_id, language)
);

CREATE INDEX IF NOT EXISTS idx_translations_key_lang ON translations(key_id, language);
CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language);

-- ============================================================================
-- 3. TENANT TRANSLATION OVERRIDES TABLE
-- ============================================================================
-- Per-tenant customization: allows restaurants to override translations
-- Example: "Dine In" → "For Here" or "Eat In" based on regional preference
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_translation_overrides (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,             -- Restaurant/tenant identifier
    key_id TEXT NOT NULL,                -- FK to translation_keys.id
    language TEXT NOT NULL,              -- ISO 639-1 code
    custom_value TEXT NOT NULL,          -- Custom translation value
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_by TEXT,                     -- Staff user ID who made the change
    FOREIGN KEY (key_id) REFERENCES translation_keys(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, key_id, language)
);

CREATE INDEX IF NOT EXISTS idx_tenant_overrides_lookup ON tenant_translation_overrides(tenant_id, key_id, language);
CREATE INDEX IF NOT EXISTS idx_tenant_overrides_tenant ON tenant_translation_overrides(tenant_id);

-- ============================================================================
-- 4. USER LANGUAGE PREFERENCES
-- ============================================================================
-- Add language preference column to staff_users table
-- Each staff member can select their preferred UI language
-- Note: This may fail with "duplicate column" if partially applied - that's OK
-- ============================================================================
ALTER TABLE staff_users ADD COLUMN preferred_language TEXT DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_staff_language ON staff_users(preferred_language);

-- ============================================================================
-- 5. MENU ITEM MULTILINGUAL SUPPORT (DISABLED - Managed by Menu Plugin)
-- ============================================================================
-- Menu translation columns are added by the @guanix/plugin-menu-management plugin
-- DO NOT alter menu tables here - they may not exist yet during initial setup
-- The plugin handles its own schema including translations
-- ============================================================================
-- ALTER TABLE menu_items ADD COLUMN name_translations TEXT;
-- ALTER TABLE menu_items ADD COLUMN description_translations TEXT;

-- ============================================================================
-- 6. MENU CATEGORY MULTILINGUAL SUPPORT (DISABLED - Managed by Menu Plugin)
-- ============================================================================
-- Menu category translations are added by the menu management plugin
-- ============================================================================
-- ALTER TABLE menu_categories ADD COLUMN name_translations TEXT;

-- ============================================================================
-- 7. TENANT SETTINGS TABLE
-- ============================================================================
-- Store tenant-level settings including default language
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_settings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(tenant_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_lookup ON tenant_settings(tenant_id, setting_key);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Populate translation_keys with all UI strings
-- 2. Populate translations with default language translations
-- 3. Implement Rust TranslationService to load/manage translations
-- 4. Create React hooks to fetch translations from Rust
-- 5. Build admin UI for customizing translations
-- ============================================================================
