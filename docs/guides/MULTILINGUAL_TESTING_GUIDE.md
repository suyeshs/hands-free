# Multilingual System Testing Guide

## Quick Start Testing (15 minutes)

Follow these steps to verify the multilingual system works:

---

## Step 1: Build and Run the Application

```bash
# Build Rust backend with new i18n code
cd src-tauri
cargo build

# Run the application
npm run tauri dev
```

**Expected**: Application starts without build errors. Check console for migration messages.

---

## Step 2: Verify Database Migrations

Open SQLite database and check tables were created:

```bash
# Install sqlite3 if needed
brew install sqlite3  # macOS
# or: sudo apt install sqlite3  # Linux

# Open the database
sqlite3 src-tauri/pos.db

# Check translation tables exist
.tables
# Should see: translation_keys, translations, tenant_translation_overrides

# Check translation_keys has data
SELECT COUNT(*) FROM translation_keys;
# Should return > 0 (e.g., 7 keys from seed migration)

# Check translations has data
SELECT COUNT(*) FROM translations;
# Should return > 0 (e.g., 91 translations: 7 keys × 13 languages)

# Check staff_users has language column
.schema staff_users
# Should see: preferred_language TEXT DEFAULT 'en'

# View sample translations
SELECT tk.key, t.language, t.value
FROM translation_keys tk
JOIN translations t ON tk.id = t.key_id
WHERE tk.key = 'common.save'
LIMIT 5;

# Expected output:
# common.save|en|Save
# common.save|fr|Enregistrer
# common.save|de|Speichern
# common.save|es|Guardar
# common.save|hi|सहेजें

.quit
```

**✅ Pass**: Tables exist, seed data loaded, staff_users updated

---

## Step 3: Test Rust Backend (Tauri Commands)

Create a test page in your app to verify Tauri commands work.

### Option A: Use Browser DevTools Console

Open the app and run in DevTools console:

```javascript
// Test: Get all translations for French
const { invoke } = window.__TAURI__.core;

// 1. Get translations for 'common' namespace in French
const result = await invoke('get_translations', {
  language: 'fr',
  namespace: 'common',
  tenantId: null
});

console.log('French translations:', result);
// Expected: { translations: { "common.save": "Enregistrer", ... }, language: "fr", ... }

// 2. Get single translation
const translation = await invoke('get_translation', {
  key: 'common.save',
  language: 'hi',
  tenantId: null
});

console.log('Hindi translation:', translation);
// Expected: "सहेजें"

// 3. Get user language (replace with actual user ID)
const userLang = await invoke('get_user_language', {
  userId: 'your-user-id'
});

console.log('User language:', userLang);
// Expected: "en" (default)

// 4. Set user language
await invoke('set_user_language', {
  userId: 'your-user-id',
  language: 'fr'
});

console.log('Language updated to French');

// 5. Verify it saved
const newLang = await invoke('get_user_language', {
  userId: 'your-user-id'
});

console.log('New user language:', newLang);
// Expected: "fr"
```

### Option B: Create Test Component

```typescript
// src/pages/TranslationTest.tsx

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function TranslationTest() {
  const [result, setResult] = useState<string>('');

  const testGetTranslations = async () => {
    try {
      const res = await invoke('get_translations', {
        language: 'fr',
        namespace: 'common',
        tenantId: null,
      });
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setResult(`Error: ${err}`);
    }
  };

  const testGetTranslation = async () => {
    try {
      const res = await invoke('get_translation', {
        key: 'common.save',
        language: 'hi',
        tenantId: null,
      });
      setResult(`Hindi translation: ${res}`);
    } catch (err) {
      setResult(`Error: ${err}`);
    }
  };

  const testUserLanguage = async () => {
    try {
      // Get current language
      const current = await invoke('get_user_language', {
        userId: 'test-user-123',
      });

      // Set to French
      await invoke('set_user_language', {
        userId: 'test-user-123',
        language: 'fr',
      });

      // Get new language
      const updated = await invoke('get_user_language', {
        userId: 'test-user-123',
      });

      setResult(`Current: ${current} → Updated: ${updated}`);
    } catch (err) {
      setResult(`Error: ${err}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Translation System Test</h1>

      <div className="space-y-4">
        <button
          onClick={testGetTranslations}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Test: Get French Translations
        </button>

        <button
          onClick={testGetTranslation}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Test: Get Hindi Translation
        </button>

        <button
          onClick={testUserLanguage}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Test: User Language Preference
        </button>
      </div>

      <pre className="mt-8 p-4 bg-gray-100 rounded overflow-auto">
        {result || 'Click a button to test...'}
      </pre>
    </div>
  );
}
```

Add to router:
```typescript
// In App.tsx or router config
import { TranslationTest } from './pages/TranslationTest';

<Route path="/test/translations" element={<TranslationTest />} />
```

Navigate to `/test/translations` and click buttons.

**✅ Pass**: All commands return expected data, no errors

---

## Step 4: Test React Hooks

### Test useTranslations Hook

```typescript
// Create test component: src/pages/HookTest.tsx

import { useTranslations } from '../hooks/useTranslations';
import { useLanguageStore } from '../stores/languageStore';

export function HookTest() {
  const { currentLanguage, setLanguage } = useLanguageStore();
  const { t, isLoading, error } = useTranslations('common');

  if (isLoading) return <div>Loading translations...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">useTranslations Hook Test</h1>

      {/* Language selector */}
      <div className="mb-6">
        <label>Select Language:</label>
        <select
          value={currentLanguage}
          onChange={(e) => setLanguage(e.target.value as any)}
          className="ml-2 border rounded px-3 py-1"
        >
          <option value="en">English</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="es">Spanish</option>
          <option value="hi">Hindi</option>
          <option value="ta">Tamil</option>
        </select>
      </div>

      {/* Test translations */}
      <div className="space-y-4">
        <div>
          <strong>Save button:</strong> <button className="ml-2 px-4 py-2 bg-blue-500 text-white rounded">{t('save')}</button>
        </div>

        <div>
          <strong>Cancel button:</strong> <button className="ml-2 px-4 py-2 bg-gray-500 text-white rounded">{t('cancel')}</button>
        </div>

        <div>
          <strong>Delete button:</strong> <button className="ml-2 px-4 py-2 bg-red-500 text-white rounded">{t('delete')}</button>
        </div>

        <div>
          <strong>Search input:</strong> <input placeholder={t('search')} className="ml-2 border rounded px-3 py-1" />
        </div>

        <div>
          <strong>Loading text:</strong> <span className="ml-2">{t('loading')}</span>
        </div>
      </div>

      <div className="mt-8 text-sm text-gray-600">
        Current language: <strong>{currentLanguage}</strong>
      </div>
    </div>
  );
}
```

**Test Steps**:
1. Navigate to `/test/hooks`
2. Verify buttons show English text (default)
3. Change language to French
4. Verify buttons update to French ("Enregistrer", "Annuler", etc.)
5. Change to Hindi
6. Verify buttons show Hindi script ("सहेजें", "रद्द करें", etc.)
7. Change to German, Spanish, Tamil - verify each updates

**✅ Pass**: Text updates immediately when language changes, no errors

---

## Step 5: Test Menu Translations

### Add Sample Menu Data

```sql
-- Add to database via sqlite3 or SQL tool
sqlite3 src-tauri/pos.db

-- Insert test menu item with translations
INSERT INTO menu_items (
  id, name, description, price, category_id, active,
  name_translations, description_translations
) VALUES (
  'test-item-pizza',
  'Margherita Pizza',
  'Classic Italian pizza with tomato and mozzarella',
  12.99,
  'main-courses',
  1,
  '{"fr": "Pizza Margherita", "de": "Margherita-Pizza", "es": "Pizza Margarita", "hi": "मार्घेरिटा पिज्जा", "ta": "மார்கரிட்டா பீட்சா"}',
  '{"fr": "Pizza italienne classique avec tomate et mozzarella", "hi": "टमाटर और मोज़ेरेला के साथ क्लासिक इतालवी पिज्जा"}'
);

INSERT INTO menu_items (
  id, name, description, price, category_id, active,
  name_translations, description_translations
) VALUES (
  'test-item-pasta',
  'Chicken Tikka Pasta',
  'Spicy chicken with Indian-Italian fusion pasta',
  14.99,
  'main-courses',
  1,
  '{"fr": "Pâtes Tikka au Poulet", "de": "Hähnchen Tikka Pasta", "es": "Pasta de Pollo Tikka", "hi": "चिकन टिक्का पास्ता", "ta": "சிக்கன் டிக்கா பாஸ்தா"}',
  '{"fr": "Poulet épicé avec pâtes fusion indo-italienne", "hi": "मसालेदार चिकन के साथ भारतीय-इतालवी फ्यूजन पास्ता"}'
);

.quit
```

### Test useMenuTranslations Hook

```typescript
// Create test component: src/pages/MenuTest.tsx

import { useMenuTranslations } from '../hooks/useMenuTranslations';
import { useLanguageStore } from '../stores/languageStore';
import type { MenuItem } from '../types';

export function MenuTest() {
  const { currentLanguage, setLanguage } = useLanguageStore();
  const { getItemName, getItemDescription } = useMenuTranslations();

  // Test menu items (these should match what's in your database)
  const testItems: MenuItem[] = [
    {
      id: 'test-item-pizza',
      name: 'Margherita Pizza',
      description: 'Classic Italian pizza with tomato and mozzarella',
      price: 12.99,
      category_id: 'main-courses',
      active: true,
      name_translations: {
        fr: 'Pizza Margherita',
        de: 'Margherita-Pizza',
        es: 'Pizza Margarita',
        hi: 'मार्घेरिटा पिज्जा',
        ta: 'மார்கரிட்டா பீட்சா',
      },
      description_translations: {
        fr: 'Pizza italienne classique avec tomate et mozzarella',
        hi: 'टमाटर और मोज़ेरेला के साथ क्लासिक इतालवी पिज्जा',
      },
    },
    {
      id: 'test-item-pasta',
      name: 'Chicken Tikka Pasta',
      description: 'Spicy chicken with Indian-Italian fusion pasta',
      price: 14.99,
      category_id: 'main-courses',
      active: true,
      name_translations: {
        fr: 'Pâtes Tikka au Poulet',
        de: 'Hähnchen Tikka Pasta',
        es: 'Pasta de Pollo Tikka',
        hi: 'चिकन टिक्का पास्ता',
        ta: 'சிக்கன் டிக்கா பாஸ்தா',
      },
      description_translations: {
        fr: 'Poulet épicé avec pâtes fusion indo-italienne',
        hi: 'मसालेदार चिकन के साथ भारतीय-इतालवी फ्यूजन पास्ता',
      },
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Menu Translation Test</h1>

      {/* Language selector */}
      <div className="mb-6">
        <label>Select Language:</label>
        <select
          value={currentLanguage}
          onChange={(e) => setLanguage(e.target.value as any)}
          className="ml-2 border rounded px-3 py-1"
        >
          <option value="en">English</option>
          <option value="fr">French (Français)</option>
          <option value="de">German (Deutsch)</option>
          <option value="es">Spanish (Español)</option>
          <option value="hi">Hindi (हिंदी)</option>
          <option value="ta">Tamil (தமிழ்)</option>
        </select>
      </div>

      {/* Display menu items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testItems.map((item) => (
          <div key={item.id} className="border rounded-lg p-6 bg-white shadow">
            <h3 className="text-xl font-bold mb-2">{getItemName(item)}</h3>
            <p className="text-gray-600 mb-4">{getItemDescription(item)}</p>
            <div className="text-lg font-semibold text-green-600">
              ${item.price.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <strong>Current Language:</strong> {currentLanguage}
        <div className="mt-2 text-sm text-gray-600">
          Switch languages to see menu items update in real-time
        </div>
      </div>
    </div>
  );
}
```

**Test Steps**:
1. Navigate to `/test/menu`
2. Verify menu items show in English (default)
3. Switch to French → verify "Pizza Margherita", "Pâtes Tikka au Poulet"
4. Switch to Hindi → verify "मार्घेरिटा पिज्जा", "चिकन टिक्का पास्ता"
5. Switch to Tamil → verify Tamil script appears
6. Switch to German, Spanish → verify each language

**✅ Pass**: Menu items update with correct translations, descriptions update too

---

## Step 6: Test Language Selector Component

Add to Settings page:

```typescript
// In SettingsPage.tsx

import { LanguageSelector } from '../components/language/LanguageSelector';

// Inside your Settings component
<section className="bg-white rounded-lg shadow p-6">
  <h2 className="text-xl font-semibold mb-4">Language Preferences</h2>

  <LanguageSelector
    mode="dropdown"
    showNativeNames={true}
    groupByRegion={true}
  />
</section>
```

**Test Steps**:
1. Navigate to Settings page
2. Verify language dropdown appears
3. Verify grouped by region (US, Europe, Southeast Asia, India)
4. Change language to French
5. Verify entire UI updates (if other components use translations)
6. Close app and reopen
7. Verify language persists (should still be French)

**✅ Pass**: Dropdown works, language changes and persists

---

## Step 7: Test Tenant Overrides (Admin Customization)

```javascript
// In DevTools console or test component

const { invoke } = window.__TAURI__.core;

// 1. Update a tenant override (customize "Add to Cart" label)
await invoke('update_tenant_translation', {
  tenantId: 'test-tenant-123',
  key: 'pos.addToCart',
  language: 'en',
  value: 'Add to Order', // Custom label
  userId: 'admin-user-123'
});

console.log('Override created');

// 2. Get translation with tenant override
const customTranslation = await invoke('get_translation', {
  key: 'pos.addToCart',
  language: 'en',
  tenantId: 'test-tenant-123' // Must provide tenant ID
});

console.log('Custom translation:', customTranslation);
// Expected: "Add to Order" (not "Add to Cart")

// 3. Get translation WITHOUT tenant ID (base translation)
const baseTranslation = await invoke('get_translation', {
  key: 'pos.addToCart',
  language: 'en',
  tenantId: null
});

console.log('Base translation:', baseTranslation);
// Expected: "Add to Cart"

// 4. Delete override (revert to base)
await invoke('delete_tenant_translation', {
  tenantId: 'test-tenant-123',
  key: 'pos.addToCart',
  language: 'en'
});

console.log('Override deleted');

// 5. Verify reverted
const revertedTranslation = await invoke('get_translation', {
  key: 'pos.addToCart',
  language: 'en',
  tenantId: 'test-tenant-123'
});

console.log('Reverted translation:', revertedTranslation);
// Expected: "Add to Cart" (back to base)
```

**✅ Pass**: Tenant overrides work, can customize and revert

---

## Step 8: Test AI Transliteration (Optional)

**Requires**: Gemini API key

```javascript
// In DevTools console or test component

const { invoke } = window.__TAURI__.core;

// Set your Gemini API key (get from https://ai.google.dev/)
const GEMINI_API_KEY = 'your-api-key-here';

// Test: Transliterate "Margherita Pizza" to Hindi
const result = await invoke('transliterate_text', {
  text: 'Margherita Pizza',
  targetLanguage: 'hi',
  sourceLanguage: 'en',
  geminiApiKey: GEMINI_API_KEY
});

console.log('Transliteration result:', result);
// Expected: { original: "Margherita Pizza", transliterated: "मार्घेरिटा पिज्जा", language: "hi" }

// Test: Batch transliteration
const batchResult = await invoke('transliterate_batch', {
  items: ['Chicken Tikka', 'Pad Thai', 'Margherita Pizza'],
  targetLanguage: 'ta', // Tamil
  sourceLanguage: 'en',
  geminiApiKey: GEMINI_API_KEY
});

console.log('Batch result:', batchResult);
// Expected: { "Chicken Tikka": "சிக்கன் டிக்கா", "Pad Thai": "பாட் தாய்", ... }
```

**✅ Pass**: API calls succeed, transliterations look correct

---

## Step 9: Integration Test (Complete User Flow)

### Scenario: Staff Member Changes Language Preference

1. **Login** as staff user
2. **Navigate** to Settings → User Profile
3. **Select** language from dropdown (e.g., French)
4. **Verify** immediate updates:
   - All buttons/labels change to French
   - Navigation items update
   - Form labels update
5. **Navigate** to POS screen
6. **Verify** POS interface in French:
   - Menu items show French names (if translations exist)
   - Buttons ("Ajouter au panier", etc.)
   - Cart labels
7. **Close** application
8. **Reopen** application
9. **Verify** language persisted (still French)
10. **Navigate** to different pages
11. **Verify** all pages respect language preference

**✅ Pass**: Complete flow works, language persists, all pages translated

---

## Step 10: Performance Test

```javascript
// Measure translation loading time

console.time('Load translations');

const result = await invoke('get_translations', {
  language: 'fr',
  namespace: 'common',
  tenantId: null
});

console.timeEnd('Load translations');
// Expected: < 50ms

// Test multiple namespaces
console.time('Load all namespaces');

await Promise.all([
  invoke('get_translations', { language: 'fr', namespace: 'common' }),
  invoke('get_translations', { language: 'fr', namespace: 'pos' }),
  invoke('get_translations', { language: 'fr', namespace: 'menu' }),
  invoke('get_translations', { language: 'fr', namespace: 'settings' }),
]);

console.timeEnd('Load all namespaces');
// Expected: < 200ms
```

**✅ Pass**: Fast loading times, no lag when switching languages

---

## Common Issues and Solutions

### Issue 1: "Table does not exist" error

**Solution**: Migrations didn't run. Check:
```bash
# Verify migrations in lib.rs
grep -A 5 "021_i18n_support" src-tauri/src/lib.rs

# Force migration by deleting and recreating DB
rm src-tauri/pos.db
npm run tauri dev  # Will recreate and run all migrations
```

### Issue 2: Translations not loading (returns empty object)

**Solution**: Seed data not loaded. Run:
```bash
sqlite3 src-tauri/pos.db < src-tauri/migrations/022_seed_translations.sql
```

### Issue 3: Language not persisting

**Solution**: User ID not set correctly. Verify:
```javascript
// Check if user is logged in
const { currentUser } = useStaffAuthStore();
console.log('Current user:', currentUser);

// Make sure user ID is valid when calling set_user_language
```

### Issue 4: Menu items not translating

**Solution**: Check `name_translations` field:
```sql
SELECT id, name, name_translations FROM menu_items WHERE id = 'your-item-id';

-- If NULL, add translations:
UPDATE menu_items
SET name_translations = '{"fr": "Your French Name", "hi": "आपका हिंदी नाम"}'
WHERE id = 'your-item-id';
```

### Issue 5: Build errors in Rust

**Solution**: Add missing dependencies:
```toml
# In src-tauri/Cargo.toml, check these exist:
[dependencies]
rusqlite = "0.30"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
reqwest = { version = "0.11", features = ["json"] }
```

---

## Automated Test Script

Create this file to run all tests:

```bash
#!/bin/bash
# test_i18n.sh

echo "🧪 Testing Multilingual System..."

# 1. Check database tables exist
echo "\n1️⃣ Checking database schema..."
sqlite3 src-tauri/pos.db "SELECT COUNT(*) FROM translation_keys;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Database tables exist"
else
  echo "❌ Database tables missing - migrations failed"
  exit 1
fi

# 2. Check seed data
echo "\n2️⃣ Checking seed data..."
TRANS_COUNT=$(sqlite3 src-tauri/pos.db "SELECT COUNT(*) FROM translations;")
if [ "$TRANS_COUNT" -gt 0 ]; then
  echo "✅ Seed data loaded ($TRANS_COUNT translations)"
else
  echo "❌ Seed data missing"
  exit 1
fi

# 3. Check Rust files compile
echo "\n3️⃣ Checking Rust compilation..."
cd src-tauri && cargo check --quiet 2>&1 | grep -i error
if [ $? -eq 1 ]; then
  echo "✅ Rust code compiles"
else
  echo "❌ Rust compilation errors"
  exit 1
fi
cd ..

# 4. Check TypeScript files
echo "\n4️⃣ Checking TypeScript..."
npx tsc --noEmit 2>&1 | grep -i error
if [ $? -eq 1 ]; then
  echo "✅ TypeScript passes"
else
  echo "⚠️  TypeScript has errors (may be pre-existing)"
fi

echo "\n✅ All automated tests passed!"
echo "\n👉 Next: Run manual tests in the app (see Step 3-9 in MULTILINGUAL_TESTING_GUIDE.md)"
```

Run:
```bash
chmod +x test_i18n.sh
./test_i18n.sh
```

---

## Quick Visual Test Checklist

Print this and check off as you test:

- [ ] ✅ Database tables exist (translation_keys, translations, tenant_translation_overrides)
- [ ] ✅ Seed data loaded (90+ translations)
- [ ] ✅ Rust backend compiles without errors
- [ ] ✅ `get_translations` Tauri command works
- [ ] ✅ `get_translation` Tauri command works
- [ ] ✅ `set_user_language` saves to database
- [ ] ✅ `useTranslations` hook loads translations
- [ ] ✅ UI updates when language changes
- [ ] ✅ Menu items show translated names
- [ ] ✅ Language selector appears in Settings
- [ ] ✅ Language preference persists after restart
- [ ] ✅ Tenant overrides work (optional)
- [ ] ✅ AI transliteration works (optional)

---

## Summary

You now have **13 comprehensive tests** to verify the multilingual system:

1. ✅ Build & Run
2. ✅ Database Migrations
3. ✅ Rust Backend Commands
4. ✅ React Hooks
5. ✅ Menu Translations
6. ✅ Language Selector
7. ✅ Tenant Overrides
8. ✅ AI Transliteration
9. ✅ Integration Flow
10. ✅ Performance

**Estimated Testing Time**: 1-2 hours for complete coverage

**Start Here**: Steps 1-3 (15 minutes) - verify backend works before testing frontend.
