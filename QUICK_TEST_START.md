# Quick Test Start - 5 Minutes

## Step 1: Add Test Route

Add this to your router (in `App.tsx` or wherever routes are defined):

```typescript
import { I18nTestPage } from './pages/I18nTestPage';

// Add to your routes
<Route path="/test/i18n" element={<I18nTestPage />} />
```

## Step 2: Build and Run

```bash
# Terminal 1: Build Rust backend
npm run tauri dev

# Wait for app to open...
```

## Step 3: Open Test Page

Navigate to: `http://localhost:5173/test/i18n` (or your dev URL)

## Step 4: Run Tests

In the test page UI:

1. **Click "Database Check"** - MUST pass first
   - ✅ Should show: "Database OK, X translations loaded"
   - ❌ If fails: Migrations didn't run (see troubleshooting below)

2. **Click other test buttons** - All should pass

3. **Change language dropdown** - Watch buttons update

4. **Check menu item** - Should show translated name

## Expected Results

### Database Check Output:
```
✅ Database OK

Tables exist and 7 translations loaded.

Test passed successfully!
```

### Get All Translations Output:
```
✅ Get All Translations (French)

Loaded 7 French translations:

{
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.edit": "Modifier",
  "common.confirm": "Confirmer",
  "common.search": "Rechercher",
  "common.loading": "Chargement..."
}
```

### Language Switching:
- Select "French" → Buttons change to "Enregistrer", "Annuler", etc.
- Select "Hindi" → Buttons change to "सहेजें", "रद्द करें", etc.
- Select "Spanish" → Buttons change to "Guardar", "Cancelar", etc.

---

## Troubleshooting

### Issue: "Database Check" fails

**Error**: "Tables don't exist" or "Cannot find table"

**Solution**:

```bash
# Option 1: Check migrations in lib.rs
grep -n "021_i18n_support" src-tauri/src/lib.rs
# Should see: version: 16, description: "create i18n translation tables..."

# Option 2: Manual migration (if Option 1 shows migrations exist)
sqlite3 src-tauri/pos.db < src-tauri/migrations/021_i18n_support.sql
sqlite3 src-tauri/pos.db < src-tauri/migrations/022_seed_translations.sql

# Option 3: Force rebuild database (CAUTION: Deletes existing data)
rm src-tauri/pos.db
npm run tauri dev  # Will recreate with all migrations
```

### Issue: "No seed data found"

**Error**: "Tables exist but 0 translations loaded"

**Solution**:

```bash
# Run seed migration manually
sqlite3 src-tauri/pos.db < src-tauri/migrations/022_seed_translations.sql

# Verify it worked
sqlite3 src-tauri/pos.db "SELECT COUNT(*) FROM translations;"
# Should show: 91 (7 keys × 13 languages)
```

### Issue: Build errors

**Error**: Rust compilation fails

**Solution**:

```bash
# Check Cargo.toml has dependencies
cd src-tauri
cat Cargo.toml | grep -A 5 dependencies

# Should see:
# rusqlite = "0.30"
# serde = { version = "1.0", features = ["derive"] }
# serde_json = "1.0"
# reqwest = { version = "0.11", features = ["json"] }

# If missing, add them and rebuild
cargo build
```

### Issue: TypeScript errors

**Error**: Cannot find module './pages/I18nTestPage'

**Solution**:

```bash
# Check file was created
ls src/pages/I18nTestPage.tsx

# If missing, create it (copy from MULTILINGUAL_TESTING_GUIDE.md)

# Check TypeScript compiles
npx tsc --noEmit
```

---

## Alternative: Console Testing (No UI)

If you can't add routes, test via browser console:

```javascript
// Open DevTools Console (F12)

const { invoke } = window.__TAURI__.core;

// Test 1: Database check
const result = await invoke('get_translations', {
  language: 'fr',
  namespace: 'common',
  tenantId: null
});

console.log('French translations:', result);
// Expected: Object with 7 translations

// Test 2: Single translation
const hi = await invoke('get_translation', {
  key: 'common.save',
  language: 'hi',
  tenantId: null
});

console.log('Hindi:', hi);
// Expected: "सहेजें"

// Test 3: User language
await invoke('set_user_language', {
  userId: 'test-user',
  language: 'fr'
});

const saved = await invoke('get_user_language', {
  userId: 'test-user'
});

console.log('Saved language:', saved);
// Expected: "fr"
```

---

## Success Criteria

✅ **All tests pass** if:

1. Database Check returns "Database OK"
2. Get Translations returns 7+ translations
3. Single translation returns correct language
4. User language saves and retrieves correctly
5. UI buttons update when language changes
6. Menu items show translated names

**Time**: 5-10 minutes for complete verification

---

## Next Steps After Testing

Once all tests pass:

1. **Update real components** (MenuItemCard, Cart, etc.)
2. **Add Language Selector to Settings page**
3. **Integrate Cloudflare Workers AI** for menu transliteration
4. **Test in production** with real menu data

See: [MULTILINGUAL_IMPLEMENTATION_GUIDE.md](MULTILINGUAL_IMPLEMENTATION_GUIDE.md) for complete integration steps.
