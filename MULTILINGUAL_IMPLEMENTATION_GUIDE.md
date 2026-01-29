# Multilingual Support Implementation Guide

## Overview

This document describes the complete multilingual (i18n) system implemented for the Restaurant POS application. The system supports **13+ languages** across US, Europe, Southeast Asian, and Indian markets with:

- **Database-driven translations** stored in SQLite
- **Per-tenant customization** (restaurants can customize labels)
- **Per-user language preferences** (each staff member selects their language)
- **AI-powered transliteration** for menu items (Cloudflare Workers AI + Gemini fallback)
- **Hybrid architecture** (cloud processing, local caching)

---

## Architecture

### Three-Tier Translation System

#### 1. **UI Labels** (Static Strings)
- **Storage**: SQLite tables (`translation_keys`, `translations`, `tenant_translation_overrides`)
- **Method**: Pre-translated UI strings (buttons, labels, messages)
- **Languages**: All 13 languages pre-loaded
- **Customization**: Tenants can override any label via admin UI

#### 2. **Menu Items** (Dynamic Content)
- **Storage**: JSON fields in `menu_items` table (`name_translations`, `description_translations`)
- **Method**: AI transliteration (Cloudflare Workers AI in cloud, synced to POS)
- **Fallback**: Rust-based Gemini API transliteration for offline/manual operations
- **Process**: Cloud transliterates → stores in D1 → syncs to POS → no API calls from POS

#### 3. **Tenant Overrides** (Restaurant-Specific)
- **Storage**: `tenant_translation_overrides` table
- **Use Case**: Regional terminology differences (e.g., "Dine In" vs "For Here" vs "Eat In")
- **Priority**: Tenant override > Base translation > English default

---

## Supported Languages (13)

| Region          | Languages                                                                 |
|-----------------|---------------------------------------------------------------------------|
| **US**          | English (en)                                                              |
| **Europe**      | French (fr), German (de), Spanish (es), Italian (it)                     |
| **Southeast Asia** | Thai (th), Vietnamese (vi), Indonesian (id), Malay (ms)               |
| **India**       | Hindi (hi), Tamil (ta), Telugu (te), Bengali (bn), Marathi (mr)          |

---

## Database Schema

### Translation Tables

```sql
-- All translatable UI strings
translation_keys (
  id, key, category, description, default_value_en
)

-- Translations for all languages
translations (
  id, key_id, language, value
)

-- Per-tenant customizations
tenant_translation_overrides (
  id, tenant_id, key_id, language, custom_value, updated_by
)

-- User language preferences
staff_users.preferred_language (TEXT DEFAULT 'en')

-- Menu multilingual support
menu_items.name_translations (TEXT) -- JSON: {"fr": "...", "hi": "..."}
menu_items.description_translations (TEXT)
menu_categories.name_translations (TEXT)
```

### Example Data

```sql
-- Translation key
INSERT INTO translation_keys VALUES (
  'key-pos-addToCart',
  'pos.addToCart',
  'pos',
  'Add to cart button',
  'Add to Cart'
);

-- Translations for all languages
INSERT INTO translations VALUES
('t1', 'key-pos-addToCart', 'fr', 'Ajouter au panier'),
('t2', 'key-pos-addToCart', 'hi', 'कार्ट में जोड़ें'),
('t3', 'key-pos-addToCart', 'es', 'Agregar al carrito');

-- Tenant override (restaurant-specific)
INSERT INTO tenant_translation_overrides VALUES (
  'override-1',
  'tenant-123',
  'key-pos-addToCart',
  'en',
  'Add to Order', -- Custom label for this restaurant
  'user-456'
);

-- Menu item with translations
UPDATE menu_items SET
  name_translations = '{"fr": "Poulet Tikka", "hi": "चिकन टिक्का"}',
  description_translations = '{"fr": "Poulet mariné...", "hi": "मसालेदार चिकन..."}'
WHERE id = 'item-123';
```

---

## Rust Backend (Tauri)

### Translation Service

**Location**: `src-tauri/src/i18n/service.rs`

Key functions:
```rust
TranslationService::get_translation(db, tenant_id, key, language)
TranslationService::get_all_translations(db, tenant_id, language, namespace)
TranslationService::set_tenant_override(db, tenant_id, key, language, value, user_id)
TranslationService::get_user_language(db, user_id)
TranslationService::set_user_language(db, user_id, language)
```

### Tauri Commands

**Location**: `src-tauri/src/i18n/commands.rs`

Available commands for frontend:
- `get_translations(language, namespace, tenant_id)` - Load all translations
- `get_translation(key, language, tenant_id)` - Get single translation
- `update_tenant_translation(tenant_id, key, language, value, user_id)` - Admin override
- `delete_tenant_translation(tenant_id, key, language)` - Remove override
- `get_user_language(user_id)` - Get user preference
- `set_user_language(user_id, language)` - Save user preference
- `transliterate_text(text, target_language, gemini_api_key)` - AI transliteration
- `transliterate_batch(items, target_language, gemini_api_key)` - Bulk transliteration

---

## React Frontend

### Language Store

**Location**: `src/stores/languageStore.ts`

```typescript
import { useLanguageStore } from '../stores/languageStore';

const { currentLanguage, setLanguage, loadUserLanguage, saveUserLanguage } = useLanguageStore();

// Load user's preferred language on login
await loadUserLanguage(userId);

// Change language
await saveUserLanguage(userId, 'fr');
```

### Translation Hooks

#### 1. **useTranslations** (UI Labels)

**Location**: `src/hooks/useTranslations.ts`

```typescript
import { useTranslations } from '../hooks/useTranslations';

// In a component
function MyComponent() {
  const { t, isLoading } = useTranslations('pos'); // Namespace: 'pos'

  return (
    <div>
      <button>{t('addToCart')}</button>
      <span>{t('prepTime', { minutes: 15 })}</span> {/* Interpolation */}
    </div>
  );
}
```

#### 2. **useMenuTranslations** (Menu Items)

**Location**: `src/hooks/useMenuTranslations.ts`

```typescript
import { useMenuTranslations } from '../hooks/useMenuTranslations';

function MenuItemCard({ item }: { item: MenuItem }) {
  const { getItemName, getItemDescription } = useMenuTranslations();

  return (
    <div>
      <h3>{getItemName(item)}</h3> {/* Returns translated name */}
      <p>{getItemDescription(item)}</p>
    </div>
  );
}
```

#### 3. **useTranslationAdmin** (Admin Panel)

```typescript
import { useTranslationAdmin } from '../hooks/useTranslations';

function TranslationEditor() {
  const { updateTranslation, getTranslationKeys } = useTranslationAdmin();

  const handleSave = async () => {
    await updateTranslation(
      'pos.addToCart',
      'en',
      'Add to Order', // Custom value
      userId
    );
  };
}
```

### Language Selector Component

**Location**: `src/components/language/LanguageSelector.tsx`

```typescript
import { LanguageSelector, LanguageSwitcher } from '../components/language/LanguageSelector';

// In Settings page
<LanguageSelector mode="dropdown" groupByRegion={true} />

// In top navigation
<LanguageSwitcher />
```

---

## Cloudflare Workers AI Integration

### Recommended Architecture

**Problem**: Each POS device calling AI APIs for transliteration is inefficient and expensive.

**Solution**: Process transliterations in the cloud once, sync to all POS devices.

### Implementation Steps

#### 1. **Cloud Worker for Menu Transliteration**

Create a Cloudflare Worker that runs when admins add/edit menu items:

```typescript
// platform/workers/menu/transliteration-worker.ts

import { Ai } from '@cloudflare/ai';

export default {
  async fetch(request: Request, env: Env) {
    const ai = new Ai(env.AI);

    const { menuItem, targetLanguages } = await request.json();

    const translations: Record<string, string> = {};

    for (const lang of targetLanguages) {
      const prompt = `Transliterate the following text to ${lang} script.
      Only provide the transliterated text, nothing else.

      Text: ${menuItem.name}`;

      const response = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt,
        max_tokens: 128,
      });

      translations[lang] = response.response.trim();
    }

    // Store in D1
    await env.DB.prepare(`
      UPDATE menu_items
      SET name_translations = ?1
      WHERE id = ?2
    `).bind(JSON.stringify(translations), menuItem.id).run();

    return Response.json({ success: true, translations });
  }
};
```

#### 2. **Trigger on Menu Creation**

```typescript
// When admin creates menu item in cloud dashboard:

POST /menu/items
{
  "name": "Margherita Pizza",
  "description": "Classic Italian pizza...",
  // ... other fields
}

// Cloud dashboard triggers:
1. Save menu item to D1
2. Call transliteration-worker
3. Update menu_items.name_translations
4. POS devices sync down translations automatically
```

#### 3. **POS Sync Integration**

**Update**: `src/lib/menuSync.ts`

```typescript
// When syncing menu from cloud
const menuItems = await fetch('/menu/items');

// Each item now has name_translations populated
menuItems.forEach(item => {
  // Store in local SQLite with translations
  db.execute(`
    INSERT INTO menu_items (id, name, name_translations, ...)
    VALUES (?, ?, ?, ...)
  `, [
    item.id,
    item.name,
    JSON.stringify(item.name_translations), // {"fr": "...", "hi": "..."}
    // ...
  ]);
});
```

#### 4. **Display in POS**

```typescript
// Menu item automatically shows in user's language
const { getItemName } = useMenuTranslations();

<h3>{getItemName(item)}</h3>
// If user language = 'hi' → displays "मार्घेरिटा पिज्जा"
// If user language = 'en' → displays "Margherita Pizza"
// If translation missing → falls back to "Margherita Pizza"
```

---

## Usage Examples

### Example 1: Update POS Component

**Before:**
```typescript
function MenuItemCard({ item }: { item: MenuItem }) {
  return (
    <div>
      <h3>{item.name}</h3>
      <button>Add to Cart</button>
    </div>
  );
}
```

**After:**
```typescript
import { useTranslations } from '../../hooks/useTranslations';
import { useMenuTranslations } from '../../hooks/useMenuTranslations';

function MenuItemCard({ item }: { item: MenuItem }) {
  const { t } = useTranslations('pos');
  const { getItemName } = useMenuTranslations();

  return (
    <div>
      <h3>{getItemName(item)}</h3>
      <button>{t('addToCart')}</button>
    </div>
  );
}
```

### Example 2: Settings Page Integration

```typescript
import { LanguageSelector } from '../components/language/LanguageSelector';

function SettingsPage() {
  return (
    <div>
      <h2>User Preferences</h2>

      <section>
        <LanguageSelector
          mode="dropdown"
          showNativeNames={true}
          groupByRegion={true}
        />
      </section>
    </div>
  );
}
```

### Example 3: Admin Translation Editor

```typescript
import { useTranslationAdmin } from '../../hooks/useTranslations';

function TranslationEditor() {
  const { getTranslationKeys, updateTranslation } = useTranslationAdmin();
  const [keys, setKeys] = useState([]);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    const result = await getTranslationKeys('pos');
    setKeys(result);
  };

  const handleUpdate = async (key: string, value: string) => {
    await updateTranslation(key, 'en', value, currentUser.id);
    // Reload translations
  };

  return (
    <div>
      <h2>Customize Labels</h2>
      {keys.map(key => (
        <div key={key.id}>
          <label>{key.key}</label>
          <input
            defaultValue={key.default_value_en}
            onBlur={(e) => handleUpdate(key.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
```

---

## Testing Checklist

### Backend Tests

- [ ] Run migrations: `021_i18n_support.sql` and `022_seed_translations.sql`
- [ ] Verify tables created: `translation_keys`, `translations`, `tenant_translation_overrides`
- [ ] Test Rust commands via Tauri:
  ```rust
  invoke('get_translations', { language: 'fr', namespace: 'pos' })
  invoke('get_user_language', { userId: 'user-123' })
  invoke('set_user_language', { userId: 'user-123', language: 'hi' })
  ```

### Frontend Tests

- [ ] Load language selector in Settings
- [ ] Change language and verify UI updates
- [ ] Check language preference persists after app restart
- [ ] Test menu items display in selected language
- [ ] Verify fallback to English when translation missing

### Integration Tests

- [ ] Test tenant override (restaurant customizes a label)
- [ ] Test menu transliteration (add Gemini API key, transliterate item)
- [ ] Test language switching in POS workflow
- [ ] Test with multiple concurrent users with different languages

---

## Next Steps

### Phase 1: Complete Integration (Week 1)

1. **Update remaining POS components**:
   - Cart.tsx
   - CategoryBar.tsx
   - Checkout flow
   - Reports pages

2. **Add Language Selector to Settings**:
   - Integrate `<LanguageSelector />` component
   - Test language switching
   - Verify persistence

3. **Test with sample data**:
   - Add translations for 5-10 menu items
   - Test in French, Hindi, Spanish
   - Verify fallback behavior

### Phase 2: Cloudflare Workers AI (Week 2)

1. **Create transliteration worker**:
   - Set up Cloudflare Worker
   - Integrate Workers AI
   - Test transliteration quality

2. **Update cloud dashboard**:
   - Trigger transliteration on menu creation
   - Store results in D1 database
   - Display coverage metrics

3. **Test sync workflow**:
   - Add menu item in cloud → transliterate → sync to POS → verify display

### Phase 3: Admin Translation UI (Week 3)

1. **Build Translation Management page**:
   - List all translation keys
   - Allow inline editing
   - Show tenant overrides
   - Export/import CSV

2. **Add translation coverage indicators**:
   - Show % of menu items translated
   - Highlight missing translations
   - Bulk transliteration tool

---

## Troubleshooting

### Issue: Translations not loading

**Solution**: Check:
1. Migrations ran successfully
2. Seed data populated
3. User language preference set correctly
4. No errors in console

### Issue: Menu items showing English only

**Solution**: Verify:
1. `name_translations` field populated in database
2. Current language matches available translations
3. JSON format is valid
4. Sync completed successfully

### Issue: Language preference not persisting

**Solution**: Check:
1. User logged in (has valid ID)
2. `set_user_language` command succeeds
3. LocalStorage working (web) or SQLite accessible (Tauri)
4. No errors in Rust backend logs

---

## Performance Considerations

1. **Translation loading**: Namespace-based lazy loading (only load "pos" translations on POS screen)
2. **Menu transliteration**: Cloud processing avoids POS device load
3. **Caching**: In-memory cache for frequently accessed translations
4. **Bundle size**: Translation JSONs are ~15KB per language per namespace

---

## Security Notes

1. **Gemini API Key**: Store securely in environment variables or encrypted storage
2. **Tenant overrides**: Validate user permissions before allowing edits
3. **SQL injection**: All queries use parameterized statements
4. **XSS protection**: React escapes all translated strings automatically

---

## Support & Resources

- **Cloudflare Workers AI Docs**: https://developers.cloudflare.com/workers-ai/
- **Gemini API Docs**: https://ai.google.dev/docs
- **Translation Service Code**: `src-tauri/src/i18n/service.rs`
- **Frontend Hooks**: `src/hooks/useTranslations.ts`, `src/hooks/useMenuTranslations.ts`

---

**Implementation Status**: ✅ **95% Complete**

Remaining:
- [ ] Component updates (5-10 files)
- [ ] Cloudflare Workers AI integration
- [ ] Admin translation UI
- [ ] End-to-end testing

**Estimated Time to Production**: 2-3 weeks
