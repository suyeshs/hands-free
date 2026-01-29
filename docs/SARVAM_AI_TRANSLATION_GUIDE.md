# Sarvam AI Translation Integration Guide

## Overview

This project uses **Sarvam AI** for translating the restaurant POS interface into all 22 officially recognized Indian languages. The translation system follows a **one-time generation** approach where translations are generated once using the Sarvam AI API and stored in the local SQLite database for fast, offline access.

## Supported Languages

All 22 Indian languages supported by Sarvam AI:

| Language | Code | Native Name |
|----------|------|-------------|
| Hindi | hi-IN | हिन्दी |
| Bengali | bn-IN | বাংলা |
| Marathi | mr-IN | मराठी |
| Telugu | te-IN | తెలుగు |
| Tamil | ta-IN | தமிழ் |
| Gujarati | gu-IN | ગુજરાતી |
| Urdu | ur-IN | اردو |
| Kannada | kn-IN | ಕನ್ನಡ |
| Odia | od-IN | ଓଡ଼ିଆ |
| Malayalam | ml-IN | മലയാളം |
| Punjabi | pa-IN | ਪੰਜਾਬੀ |
| Assamese | as-IN | অসমীয়া |
| Maithili | mai-IN | मैथिली |
| Santali | sat-IN | ᱥᱟᱱᱛᱟᱲᱤ |
| Kashmiri | ks-IN | कॉशुर |
| Nepali | ne-IN | नेपाली |
| Sindhi | sd-IN | سنڌي |
| Dogri | doi-IN | डोगरी |
| Konkani | kok-IN | कोंकणी |
| Manipuri (Meitei) | mni-IN | ꯃꯩꯇꯩꯂꯣꯟ |
| Bodo | brx-IN | बड़ो |
| Sanskrit | sa-IN | संस्कृतम् |

## Architecture

### Database Schema

The translation system uses 3 SQLite tables:

```sql
-- 1. Translation Keys (English source text)
CREATE TABLE translation_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,              -- e.g., "pos.addToCart"
    category TEXT NOT NULL,                -- e.g., "pos", "common", "settings"
    description TEXT,                      -- Human-readable description
    default_value_en TEXT NOT NULL,        -- English fallback
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 2. Translations (Base translations for all languages)
CREATE TABLE translations (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    language TEXT NOT NULL,                -- BCP-47 code (e.g., "hi-IN")
    value TEXT NOT NULL,                   -- Translated text
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (key_id) REFERENCES translation_keys(id),
    UNIQUE(key_id, language)
);

-- 3. Tenant Translation Overrides (Restaurant-specific customizations)
CREATE TABLE tenant_translation_overrides (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    language TEXT NOT NULL,
    custom_value TEXT NOT NULL,
    updated_by TEXT,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (key_id) REFERENCES translation_keys(id),
    UNIQUE(tenant_id, key_id, language)
);
```

### Translation Fallback Chain

When requesting a translation, the system checks in this order:

1. **Tenant Override** (if tenant_id provided) - Restaurant-specific customization
2. **Base Translation** - Standard translation from Sarvam AI
3. **English Default** - Original English text from translation_keys
4. **Key Itself** - If key doesn't exist, return the key as-is

This ensures the app never shows missing translations.

## How to Generate Translations

### Prerequisites

1. **Sarvam AI API Key** - Already configured in `.env`:
   ```
   SARVAM_AI_API_KEY=sk_g11w7cet_wKAOSf7c0I4ARBkyHgGs1sqU
   ```

2. **SQLite Database** - The app database at:
   ```
   ~/Library/Application Support/com.stonepot-tech.handsfree-pos/handsfree_pos.db
   ```

3. **Rust Toolchain** - Already installed for Tauri development

### Step 1: Run the Translation Generator

```bash
cd src-tauri

# Generate translations for all 22 Indian languages
SARVAM_AI_API_KEY=sk_g11w7cet_wKAOSf7c0I4ARBkyHgGs1sqU \
cargo run --bin translate_generator
```

### What the Tool Does

1. **Connects to SQLite database**
2. **Reads all translation keys** from `translation_keys` table
3. **For each of the 22 Indian languages**:
   - Checks if translation already exists (skips if yes)
   - Calls Sarvam AI API to translate English text
   - Inserts translated text into `translations` table
4. **Rate limiting**: Waits 100ms between API calls to avoid hitting limits
5. **Error handling**: Continues on error instead of failing completely

### Expected Output

```
🌍 Translation Generator - Sarvam AI Integration
================================================

📂 Database: /Users/stonepot-tech/Library/Application Support/com.stonepot-tech.handsfree-pos/handsfree_pos.db
🔑 API Key: sk_g11w7ce...s1sqU

✅ Connected to database

📝 Found 150 translation keys

🌐 Processing Hindi (hi-IN)...
  Translating 'common.save'... ✅ सहेजें
  Translating 'common.cancel'... ✅ रद्द करें
  Translating 'common.delete'... ✅ हटाएं
  ...

🌐 Processing Bengali (bn-IN)...
  Translating 'common.save'... ✅ সংরক্ষণ
  ...

📊 Translation Summary
=====================
Total translations: 3300
New translations added: 2800
Skipped (already exist): 500

✅ Translation generation complete!
```

### Cost Estimation

- **Sarvam AI Pricing**: ₹20 per 10,000 characters
- **Average translation key length**: ~20 characters
- **Number of keys**: ~150
- **Number of languages**: 22

**Total Cost**:
```
150 keys × 20 chars × 22 languages = 66,000 characters
66,000 chars ÷ 10,000 × ₹20 = ₹132 (~$1.60 USD)
```

**One-time cost** - translations are cached forever!

## How to Use Translations in the App

### Frontend (React/TypeScript)

```typescript
import { useTranslations } from '@/hooks/useTranslations';

function MyComponent() {
  const { t } = useTranslations('pos'); // Namespace: pos, common, settings, etc.

  return (
    <button>{t('addToCart')}</button>  // Uses key "pos.addToCart"
  );
}
```

### Backend (Rust/Tauri Commands)

```rust
use crate::i18n::service::TranslationService;

#[tauri::command]
pub async fn get_ui_text(
    db: State<'_, Database>,
    key: String,
    language: String,
) -> Result<String, String> {
    let conn = db.get_connection().map_err(|e| e.to_string())?;

    TranslationService::get_translation(
        &conn,
        None,        // No tenant override
        &key,
        &language,
    ).map_err(|e| e.to_string())
}
```

## Adding New Translation Keys

### Step 1: Add to Database

Insert into `translation_keys` table:

```sql
INSERT INTO translation_keys (id, key, category, description, default_value_en)
VALUES (
    'key-staff-clockIn',
    'staff.clockIn',
    'staff',
    'Staff clock-in button',
    'Clock In'
);
```

### Step 2: Run Translation Generator

```bash
cargo run --bin translate_generator
```

The tool will automatically translate the new key into all 22 languages.

### Step 3: Use in Code

```typescript
const { t } = useTranslations('staff');
<button>{t('clockIn')}</button>
```

## Translation Categories

Organize translation keys by feature area:

- `common` - Shared UI elements (Save, Cancel, Delete, etc.)
- `pos` - Point of Sale interface
- `menu` - Menu management
- `settings` - Settings screens
- `staff` - Staff portal and management
- `reports` - Reports and analytics
- `auth` - Authentication and login
- `errors` - Error messages
- `validation` - Form validation messages

## Tenant-Specific Customizations

Restaurants can override translations to use their preferred terminology:

### Example: Override "Add to Cart" with "Add to Order"

```rust
TranslationService::set_tenant_override(
    &db,
    "coorg-food-company-6163",  // Tenant ID
    "pos.addToCart",              // Key
    "hi-IN",                      // Language
    "ऑर्डर में जोड़ें",           // Custom value
    Some("admin-user-123"),      // Updated by
)?;
```

Now when this restaurant loads the POS in Hindi, it will show their custom text instead of the default translation.

## Language Selection

### Staff Portal (Mobile)

When staff log in to their mobile portal, they select their preferred language:

```typescript
// Language selector on first login
<select onChange={(e) => setLanguage(e.target.value)}>
  <option value="en-IN">English</option>
  <option value="hi-IN">हिन्दी (Hindi)</option>
  <option value="ta-IN">தமிழ் (Tamil)</option>
  <option value="te-IN">తెలుగు (Telugu)</option>
  <!-- All 22 languages -->
</select>
```

Language preference is saved in `staff_users.preferred_language` column.

### Customer Ordering (QR Code)

Language auto-detected from browser locale or manually selectable:

```javascript
// Auto-detect browser language
const browserLang = navigator.language; // e.g., "hi-IN"

// Or manual selector
<div class="language-selector">
  <button onclick="setLanguage('en-IN')">English</button>
  <button onclick="setLanguage('hi-IN')">हिन्दी</button>
  <button onclick="setLanguage('ta-IN')">தமிழ்</button>
</div>
```

## API Reference

### Sarvam AI Translation API

**Endpoint**: `POST https://api.sarvam.ai/translate`

**Headers**:
```
api-subscription-key: YOUR_API_KEY
Content-Type: application/json
```

**Request**:
```json
{
  "input": "Hello, welcome to our restaurant",
  "source_language_code": "en-IN",
  "target_language_code": "hi-IN",
  "model": "sarvam-translate:v1"
}
```

**Response**:
```json
{
  "request_id": "uuid-here",
  "translated_text": "नमस्ते, हमारे रेस्तरां में आपका स्वागत है",
  "source_language_code": "en-IN"
}
```

**Documentation**: https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/text-processing/translation

## Troubleshooting

### Issue: "SARVAM_AI_API_KEY not set"

**Solution**: Set environment variable before running:
```bash
export SARVAM_AI_API_KEY=sk_g11w7cet_wKAOSf7c0I4ARBkyHgGs1sqU
cargo run --bin translate_generator
```

### Issue: "Database not found"

**Solution**: Specify custom database path:
```bash
DATABASE_PATH=/path/to/handsfree_pos.db cargo run --bin translate_generator
```

### Issue: "API rate limit exceeded"

**Solution**: The tool already includes 100ms delays between requests. If still hitting limits, edit `translate_generator.rs` and increase the delay:
```rust
thread::sleep(Duration::from_millis(200)); // Increase from 100ms to 200ms
```

### Issue: "Some translations failed"

The tool continues on errors. Check output for specific failures:
```
  Translating 'common.save'... ❌ Error: API timeout
```

Re-run the tool - it will skip existing translations and only retry failed ones.

## Best Practices

### 1. Translation Keys Naming Convention

```
<category>.<feature>.<element>

Examples:
- common.save
- pos.addToCart
- settings.profile.updateButton
- staff.attendance.clockIn
```

### 2. Keep English Text Simple

Avoid idioms, slang, or complex sentences:
```
✅ Good: "Add to cart"
❌ Bad: "Toss it in the basket"
```

### 3. Provide Context in Description

```sql
INSERT INTO translation_keys (...) VALUES (
    'staff.clockIn',
    'Staff clock-in button - appears when staff arrives at work',
    'Clock In'
);
```

This helps with accurate translations.

### 4. Test Translations with Native Speakers

While Sarvam AI provides high-quality translations, always validate with native speakers before deployment, especially for:
- Legal terms
- Currency formatting
- Date/time formatting
- Cultural nuances

### 5. Use Tenant Overrides Sparingly

Only override translations when:
- Restaurant has specific branding (e.g., "Order" vs "Cart")
- Regional dialect differences (e.g., Mumbai Hindi vs Delhi Hindi)
- Special terminology (e.g., "Thali" vs "Meal Set")

## Migration Checklist

- [x] Sarvam AI API key configured in `.env`
- [x] Translation service implemented in `src-tauri/src/services/translation.rs`
- [x] Translation generator tool created in `src-tauri/src/bin/translate_generator.rs`
- [x] Binary target added to `Cargo.toml`
- [ ] Run translation generator to populate database
- [ ] Test translations in staff portal
- [ ] Test language selection on login
- [ ] Test tenant overrides
- [ ] Deploy to production

## Resources

- **Sarvam AI Dashboard**: https://www.sarvam.ai/
- **API Documentation**: https://docs.sarvam.ai/
- **Supported Languages**: 22 Indian languages
- **Pricing**: ₹20 per 10k characters
- **Status**: Production-ready

---

**Last Updated**: 2026-01-23
**Version**: 1.0
**Status**: ✅ Ready for use
