# Menu Upload Schema Fix

## Problem
The code was trying to save fields that don't exist in the SQLite schema:
- `spice_level` ❌
- `image_url` (should be `image`)
- `preparation_time` as TEXT "15 min" (should be INTEGER)
- Various other fields like `updated_at`, `needs_sync`, etc.

## Actual Schema
From `src-tauri/src/database/mod.rs`:

```sql
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    active BOOLEAN NOT NULL DEFAULT 1,
    preparation_time INTEGER NOT NULL DEFAULT 15,
    allergens TEXT,
    dietary_tags TEXT,
    FOREIGN KEY (category_id) REFERENCES menu_categories(id)
);
```

## Fixes Applied

### 1. ExcelUploader.tsx (Line 168-201)
Simplified to only save core fields:

```typescript
const itemsToSave = reviewedItems.map(item => {
  const dietaryTags: string[] = item.dietary || [];

  // Add vegetarian/vegan info if available
  if (item.type === 'veg' || item.dietary?.includes('vegetarian')) {
    if (!dietaryTags.includes('vegetarian')) dietaryTags.push('vegetarian');
  }
  if (item.dietary?.includes('vegan')) {
    if (!dietaryTags.includes('vegan')) dietaryTags.push('vegan');
  }

  return {
    name: item.name,
    description: item.description || '',
    price: item.price,
    category_id: categoryMap[item.category || 'Uncategorized'] || 'uncategorized',
    allergens: item.allergens || [],
    dietary_tags: dietaryTags,
    preparation_time: item.preparationTime || 15, // INTEGER
    image: item.imageUrl || null, // 'image' not 'image_url'
    active: item.available !== false,
  };
});
```

### 2. database.ts saveMenuItem() (Lines 183-238)
Updated SQL queries to match schema:

**UPDATE query:**
```sql
UPDATE menu_items SET
  name = $1,
  description = $2,
  price = $3,
  category_id = $4,
  allergens = $5,
  dietary_tags = $6,
  preparation_time = $7,  -- INTEGER not TEXT
  image = $8,             -- 'image' not 'image_url'
  active = $9             -- No spice_level, updated_at, needs_sync
WHERE id = $10
```

**INSERT query:**
```sql
INSERT INTO menu_items (
  id, name, description, price, category_id, allergens, dietary_tags,
  preparation_time, image, active
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
```

## What Was Removed

Fields that don't exist in the schema:
- ❌ `spice_level` - Not in schema
- ❌ `image_url` - Renamed to `image`
- ❌ `updated_at` - Not in schema
- ❌ `created_at` - Not in schema
- ❌ `needs_sync` - Not in schema
- ❌ `combo_items`, `combo_savings` - Not in schema
- ❌ `valid_from`, `valid_until`, `days_available` - Not in schema
- ❌ `variant_name`, `parent_item_id` - Not in schema

## What Was Preserved

Core fields that AI extracts:
- ✅ `name` - Menu item name
- ✅ `description` - Item description
- ✅ `price` - Price (REAL)
- ✅ `category_id` - Category reference
- ✅ `allergens` - JSON array of allergens
- ✅ `dietary_tags` - JSON array of dietary info (vegetarian, vegan, etc.)
- ✅ `preparation_time` - Minutes as INTEGER
- ✅ `image` - Image URL (can be null)
- ✅ `active` - Boolean (1 or 0)

## Dietary Information Handling

The AI returns fields like:
- `type: "veg"` or `"non-veg"`
- `dietary: ["vegetarian", "vegan", "gluten-free"]`
- `spiceLevel: "mild"` (now ignored, not in schema)

We consolidate this into `dietary_tags`:
```typescript
const dietaryTags: string[] = item.dietary || [];

if (item.type === 'veg' || item.dietary?.includes('vegetarian')) {
  if (!dietaryTags.includes('vegetarian')) dietaryTags.push('vegetarian');
}
if (item.dietary?.includes('vegan')) {
  if (!dietaryTags.includes('vegan')) dietaryTags.push('vegan');
}
```

## Testing After Reload

The app should now:
1. ✅ Upload file to R2
2. ✅ Parse with Gemini AI (27 items)
3. ✅ Save categories with `description` field
4. ✅ Save menu items with only existing schema fields
5. ✅ No more "table has no column named..." errors

## Next Step

**Reload the app in development mode** for the changes to take effect:

```bash
# The app is running in dev mode, so just reload the page
# Or restart the Tauri dev server:
npm run tauri dev
```

Then try uploading the menu again - it should work end-to-end!
