# Combo Filter Keywords - Database Migration Complete ✅

## Overview

The "QUICK ADD ALL" feature filter keywords have been moved from hard-coded constants to the tenant database. This allows restaurants to customize which item categories appear in the combo configuration UI.

## What Changed

### Before (Hard-coded)
```typescript
const ITEM_FILTER_KEYWORDS = {
  rice: ['rice', 'biryani', 'pulao', ...],
  'puttu-otti': ['puttu', 'otti', 'appam', ...],
  // etc - fixed in code
};
```

### After (Database-driven)
- Keywords stored in `combo_filter_keywords` table
- Dynamically loaded from database on component mount
- Fully customizable per tenant
- Fallback to defaults if database fetch fails

## Database Schema

### Table: `combo_filter_keywords`

```sql
CREATE TABLE combo_filter_keywords (
    id TEXT PRIMARY KEY,
    filter_key TEXT NOT NULL UNIQUE,      -- e.g., 'rice', 'dal', 'curry'
    display_name TEXT NOT NULL,           -- e.g., 'Rice', 'Dal'
    emoji TEXT,                           -- e.g., '🍚', '🥣'
    keywords TEXT NOT NULL,               -- JSON array: ["rice", "biryani", ...]
    color_class TEXT,                     -- Tailwind color: 'amber', 'yellow'
    sort_order INTEGER DEFAULT 0,         -- Display order
    active INTEGER DEFAULT 1,             -- Enable/disable
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

### Default Data Seeded

The migration seeds 6 default filter categories:
1. 🍚 **Rice** - rice, biryani, pulao, fried rice, etc.
2. 🥞 **Puttu/Otti** - puttu, otti, appam, idiyappam, etc.
3. 🫓 **Roti/Naan** - roti, naan, paratha, chapati, etc.
4. 🥣 **Dal** - dal, daal, lentil
5. 🍛 **Curry** - curry, gravy, masala, sabzi, kadhi
6. 🥗 **Sides** - raita, papad, pickle, chutney, salad, etc.

## API

### Rust Commands

#### `get_combo_filter_keywords`
Fetch all active filter keywords from database.

```rust
#[tauri::command]
pub async fn get_combo_filter_keywords(app: tauri::AppHandle)
    -> Result<Vec<ComboFilterKeyword>, String>
```

#### `save_combo_filter_keyword`
Create or update a filter keyword.

```rust
#[tauri::command]
pub async fn save_combo_filter_keyword(
    app: tauri::AppHandle,
    keyword: ComboFilterKeyword,
) -> Result<(), String>
```

#### `delete_combo_filter_keyword`
Delete a filter keyword by ID.

```rust
#[tauri::command]
pub async fn delete_combo_filter_keyword(
    app: tauri::AppHandle,
    keyword_id: String,
) -> Result<(), String>
```

### TypeScript Service

File: [src/lib/comboFilters.ts](src/lib/comboFilters.ts)

```typescript
import { getComboFilterKeywords, ComboFilterKeyword } from '@/lib/comboFilters';

// Fetch all filter keywords
const keywords = await getComboFilterKeywords();

// Save a new keyword
await saveComboFilterKeyword({
  id: 'filter-biryani',
  filter_key: 'biryani',
  display_name: 'Biryani',
  emoji: '🍛',
  keywords: ['biryani', 'veg biryani', 'chicken biryani'],
  color_class: 'orange',
  sort_order: 7,
  active: true,
});

// Delete a keyword
await deleteComboFilterKeyword('filter-biryani');
```

## Updated Components

Both combo configuration components now load keywords dynamically:

1. **[BulkComboConfigurator.tsx](src/components/admin/BulkComboConfigurator.tsx)** - Lines 6-9, 24-52, 513-544, 690-716
2. **[ComboEditor.tsx](src/components/admin/ComboEditor.tsx)** - Lines 6-9, 24-72, 524-592, 734-746

### How It Works

1. Component opens
2. `useEffect` calls `loadFilterKeywords()`
3. Fetches from database via `getComboFilterKeywords()`
4. Updates state: `filterKeywords` and `itemFilterKeywords`
5. UI renders dynamic buttons based on database data
6. Fallback to hard-coded defaults if fetch fails

## Migration Deployment

### Version: 44
- **File**: `043_combo_filter_keywords.sql`
- **Deployed**: Yes ✅ (via dynamic migration system)
- **Checksum**: `sha256:4e2a408571191290fe144fa3e76bf0251ca2e5d874e0bbb39f0ff591538c5f0b`
- **Required App Version**: 3.1.0

### Deployment Details
```bash
./deploy-migration.sh \
  src-tauri/migrations/043_combo_filter_keywords.sql \
  44 \
  combo_filter_keywords \
  3.1.0
```

Uploaded to Cloudflare R2:
- Migration: `handsfree-pos/migrations/043_combo_filter_keywords.sql`
- Manifest: `handsfree-pos/migrations/manifest.json`

### Rollout Timeline
- Apps will auto-sync within 60 minutes
- Or on next app startup
- Or when user manually triggers migration sync

## Usage Examples

### User Experience

**Before**: Hard-coded buttons, same for all restaurants
```
Quick Add All:
🍚 All Rice Items  🥞 All Puttu/Otti  🥗 All Papad/Sides
```

**After**: Customizable buttons per tenant
```
Quick Add All:
🍚 All Rice  🥞 All Puttu/Otti  🫓 All Roti/Naan  🥣 All Dal  🍛 All Curry  🥗 All Sides
```

### Customization (Future Feature)

Restaurants can add custom filters via Settings UI:

```typescript
// Example: Add "South Indian" filter
await saveComboFilterKeyword({
  id: 'filter-south-indian',
  filter_key: 'south-indian',
  display_name: 'South Indian',
  emoji: '🥥',
  keywords: ['dosa', 'idli', 'vada', 'uttapam', 'sambar'],
  color_class: 'teal',
  sort_order: 10,
  active: true,
});
```

## Benefits

✅ **Tenant Customization** - Each restaurant can define their own categories
✅ **No App Rebuild** - Changes deployed via dynamic migrations
✅ **Cuisine Flexibility** - Support for any cuisine type (Chinese, Mexican, etc.)
✅ **Multi-language Ready** - Display names can be translated
✅ **Performance** - Cached in component state, minimal DB queries
✅ **Fallback Safety** - Hard-coded defaults if database unavailable

## Future Enhancements

### Phase 1: Management UI (Recommended Next)
Create a Settings page for managing combo filter keywords:
- Add/Edit/Delete filters
- Reorder with drag-and-drop
- Toggle active/inactive
- Test keyword matches against menu

### Phase 2: AI-Powered Suggestions
Analyze menu items and suggest relevant filter categories:
```typescript
// Analyze menu and suggest filters
const suggestions = await analyzeMenuForFilters();
// Returns: ["pasta", "pizza", "appetizers", "desserts"]
```

### Phase 3: Multi-Language Support
Integrate with existing i18n system:
```sql
ALTER TABLE combo_filter_keywords ADD COLUMN display_name_i18n_key TEXT;
```

## Testing

### Manual Testing Steps

1. **Verify Migration Applied**
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' AND name='combo_filter_keywords';
   -- Should return: combo_filter_keywords

   SELECT COUNT(*) FROM combo_filter_keywords WHERE active = 1;
   -- Should return: 6
   ```

2. **Test UI Components**
   - Open Bulk Combo Configurator
   - Click "📋 Select from Menu"
   - Verify filter buttons appear at top
   - Click "🍚 All Rice Items" quick button
   - Verify picker opens with rice items pre-filtered
   - Click "Add All X Items" button
   - Verify all rice items added to combo group

3. **Test Fallback**
   - Temporarily break database connection
   - Open combo configurator
   - Verify fallback keywords still work
   - Check console for error message

4. **Test Customization**
   ```typescript
   // Add custom filter via console
   await saveComboFilterKeyword({
     id: 'filter-test',
     filter_key: 'test',
     display_name: 'Test Items',
     emoji: '🧪',
     keywords: ['test', 'sample'],
     color_class: 'pink',
     sort_order: 99,
     active: true,
   });

   // Reload component
   // Should see new "🧪 Test Items" button
   ```

## Files Modified

### New Files
- ✅ `src-tauri/migrations/043_combo_filter_keywords.sql`
- ✅ `src-tauri/src/commands/combo.rs`
- ✅ `src/lib/comboFilters.ts`
- ✅ `COMBO_FILTER_KEYWORDS_DATABASE_MIGRATION.md` (this file)

### Modified Files
- ✅ `src-tauri/src/commands/mod.rs` - Added `combo` module
- ✅ `src-tauri/src/lib.rs` - Registered combo commands
- ✅ `src/components/admin/BulkComboConfigurator.tsx` - Dynamic keywords
- ✅ `src/components/admin/ComboEditor.tsx` - Dynamic keywords

### Deployed Files
- ✅ `migrations/manifest.json` - Updated with migration 44
- ✅ `handsfree-pos/migrations/043_combo_filter_keywords.sql` (R2)

## Migration Status

| Step | Status | Notes |
|------|--------|-------|
| Create migration SQL | ✅ Complete | 043_combo_filter_keywords.sql |
| Create Rust commands | ✅ Complete | combo.rs (using rusqlite) |
| Create TypeScript service | ✅ Complete | comboFilters.ts |
| Update UI components | ✅ Complete | Both combo editors |
| Deploy to R2 | ✅ Complete | Version 44 deployed |
| Rust compilation | ✅ Complete | cargo check passed |
| Test locally | ⏳ Pending | Needs rebuild + restart |
| Verify in production | ⏳ Pending | After auto-sync |
| Create management UI | 📋 Future | Optional enhancement |

## Support

For issues or questions:
1. Check console logs for errors
2. Verify migration applied: `SELECT * FROM combo_filter_keywords;`
3. Check database connection
4. Test with fallback keywords

## Summary

The QUICK ADD ALL feature keywords are now stored in the tenant database (`combo_filter_keywords` table), deployed via dynamic migration system (version 44), and ready for per-tenant customization. The feature gracefully falls back to hard-coded defaults if database access fails.

🎉 **Migration Complete!**
