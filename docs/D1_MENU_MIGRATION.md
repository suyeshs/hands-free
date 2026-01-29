# D1 Database Migration Guide - Menu Management

This guide outlines the changes needed to sync your Cloudflare D1 database with the menu management feature.

## Overview

The menu management feature requires two tables in D1:
- `menu_categories` - Menu categories (e.g., Appetizers, Main Course, Desserts)
- `menu_items` - Menu items with pricing, ingredients, and metadata

**CRITICAL**: The D1 schema MUST match local SQLite exactly for sync to work.

## 1. Database Schema Changes

### Run this SQL on your D1 database:

```bash
# Apply the migration using Wrangler CLI
wrangler d1 execute <YOUR_DATABASE_NAME> --file=./docs/d1-menu-migration.sql
```

Or use the Cloudflare dashboard to run the SQL directly.

### Schema Details

#### menu_categories
```sql
CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT 1,
  icon TEXT,
  description TEXT DEFAULT '',
  created_at TEXT,
  updated_at TEXT,
  name_translations TEXT
);
```

#### menu_items
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
  name_translations TEXT,
  description_translations TEXT
);
```

## 2. Cloudflare Worker Updates

### Add Menu Sync Endpoints

Add these endpoints to your Cloudflare Worker (`handsfree-orders` or similar):

```typescript
// POST /api/menu/:tenantId/sync - Sync menu items from POS to D1
app.post('/api/menu/:tenantId/sync', async (c) => {
  const { tenantId } = c.req.param();
  const { categories, menuItems } = await c.req.json();

  const db = c.env.DB; // D1 binding

  // Sync categories
  if (categories && categories.length > 0) {
    const categoryStmt = db.prepare(`
      INSERT OR REPLACE INTO menu_categories
      (id, name, sort_order, active, icon, description, created_at, updated_at, name_translations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const categoryBatch = categories.map((cat: any) =>
      categoryStmt.bind(
        cat.id,
        cat.name,
        cat.sort_order || 0,
        cat.active ? 1 : 0,
        cat.icon || null,
        cat.description || '',
        cat.created_at || new Date().toISOString(),
        cat.updated_at || new Date().toISOString(),
        cat.name_translations || null
      )
    );

    await db.batch(categoryBatch);
  }

  // Sync menu items
  if (menuItems && menuItems.length > 0) {
    const itemStmt = db.prepare(`
      INSERT OR REPLACE INTO menu_items
      (id, category_id, name, description, price, image, active, preparation_time,
       allergens, dietary_tags, name_translations, description_translations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const itemBatch = menuItems.map((item: any) =>
      itemStmt.bind(
        item.id,
        item.category_id,
        item.name,
        item.description || '',
        item.price,
        item.image || null,
        item.active ? 1 : 0,
        item.preparation_time || 15,
        JSON.stringify(item.allergens || []),
        JSON.stringify(item.dietary_tags || []),
        item.name_translations || null,
        item.description_translations || null
      )
    );

    await db.batch(itemBatch);
  }

  return c.json({
    success: true,
    synced: {
      categories: categories?.length || 0,
      menuItems: menuItems?.length || 0
    }
  });
});

// GET /api/menu/:tenantId - Fetch menu from D1
app.get('/api/menu/:tenantId', async (c) => {
  const { tenantId } = c.req.param();
  const db = c.env.DB;

  const categories = await db.prepare(
    'SELECT * FROM menu_categories WHERE active = 1 ORDER BY sort_order'
  ).all();

  const menuItems = await db.prepare(
    'SELECT * FROM menu_items WHERE active = 1'
  ).all();

  return c.json({
    categories: categories.results,
    menuItems: menuItems.results
  });
});
```

## 3. Voice Ordering Integration

After syncing to D1, the menu data can be used for voice ordering:

### Option 1: File Search (OpenAI)
The worker can upload menu items to OpenAI File Search for AI-powered voice ordering.

### Option 2: Direct D1 Query
Voice ordering can query D1 directly for menu items, avoiding File Search entirely.

## 4. Data Flow

### POS → Cloud Sync Flow:

1. **POS uploads menu file** (Excel/CSV)
2. **AI parses** menu items
3. **User reviews** and edits items
4. **Save to local SQLite** (immediate)
5. **Trigger background sync** to D1 via Service Worker
6. **Service Worker** calls `/api/menu/:tenantId/sync` endpoint
7. **D1 stores** menu items for cloud access
8. **(Optional)** Upload to File Search for voice ordering

### Cloud → POS Fetch Flow:

1. **POS requests** menu from cloud
2. **Worker queries** D1 for menu items
3. **POS receives** and displays menu

## 5. Field Descriptions

### menu_categories

| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT | Unique category ID (e.g., "appetizers") |
| `name` | TEXT | Category name (e.g., "Appetizers") |
| `sort_order` | INTEGER | Display order (lower = first) |
| `active` | BOOLEAN | 1 = active, 0 = hidden |
| `icon` | TEXT | Optional emoji or icon |
| `description` | TEXT | Category description |
| `created_at` | TEXT | ISO 8601 timestamp |
| `updated_at` | TEXT | ISO 8601 timestamp |
| `name_translations` | TEXT | JSON object with translations |

### menu_items

| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT | Unique item ID |
| `category_id` | TEXT | Links to menu_categories.id |
| `name` | TEXT | Item name (e.g., "Chicken Tikka") |
| `description` | TEXT | Item description |
| `price` | REAL | Price in currency |
| `image` | TEXT | Image URL (Cloudflare R2) |
| `active` | BOOLEAN | 1 = available, 0 = hidden |
| `preparation_time` | INTEGER | Prep time in minutes |
| `allergens` | TEXT | JSON array (e.g., ["nuts", "dairy"]) |
| `dietary_tags` | TEXT | JSON array (e.g., ["veg", "gluten-free"]) |
| `name_translations` | TEXT | JSON object with translations |
| `description_translations` | TEXT | JSON object with translations |

## 6. Important Notes

### Schema Matching
- **CRITICAL**: D1 schema MUST exactly match local SQLite schema
- Field names, types, and defaults must be identical
- Any mismatch will cause sync failures

### Data Types
- `allergens` and `dietary_tags` are stored as JSON strings
- Use `JSON.stringify()` when syncing to D1
- Use `JSON.parse()` when reading from D1

### Unique Constraints
- `menu_categories.name` must be unique
- Prevents duplicate categories
- Category names are case-sensitive

### Image Storage
- Images are stored in Cloudflare R2
- `image` field stores the R2 URL
- Format: `https://<account>.r2.dev/<bucket>/<key>`

## 7. Testing Checklist

- [ ] D1 database has both tables with all indexes
- [ ] Worker endpoint `/api/menu/:tenantId/sync` accepts categories and items
- [ ] Worker endpoint `/api/menu/:tenantId` returns menu data
- [ ] POS can sync menu to D1 successfully
- [ ] Voice ordering can query menu from D1
- [ ] Image URLs work from R2
- [ ] Translations sync correctly
- [ ] Allergens and dietary tags parse correctly

## 8. Rollback Plan

If you need to rollback:

```sql
-- Remove menu tables
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS menu_categories;

-- Remove indexes
DROP INDEX IF EXISTS idx_menu_categories_active;
DROP INDEX IF EXISTS idx_menu_categories_sort;
DROP INDEX IF EXISTS idx_menu_items_category;
DROP INDEX IF EXISTS idx_menu_items_active;
DROP INDEX IF EXISTS idx_menu_items_price;
```

## 9. Related Files

- **Local SQLite Migration**: `src-tauri/migrations/027_fix_duplicate_categories.sql`
- **D1 Migration SQL**: `docs/d1-menu-migration.sql`
- **Database Functions**: `src/lib/database.ts`
- **Menu Store**: `src/stores/menuStore.ts`
- **Menu Uploader**: `src/components/admin/ExcelUploader.tsx`
- **Service Worker**: `src/services/sync/service-worker.ts`

## 10. Next Steps After Migration

1. **Apply D1 migration** using Wrangler CLI
2. **Update Cloudflare Worker** with menu sync endpoints
3. **Remove direct File Search upload** from ExcelUploader
4. **Test sync** by uploading menu on POS
5. **Verify D1 data** using Wrangler: `wrangler d1 execute <DB> --command="SELECT * FROM menu_items LIMIT 5"`
6. **Enable voice ordering** (if using File Search)

## 11. Troubleshooting

### Sync fails with "table not found"
- Check D1 migration was applied successfully
- Verify table names match exactly (lowercase)

### Items not appearing in voice ordering
- Ensure `active = 1` for items
- Check image URLs are accessible
- Verify File Search upload is working

### Duplicate categories error
- Category names must be unique
- Check for case variations ("Appetizers" vs "appetizers")
- Clean up duplicates in local SQLite first

## 12. Support

For questions or issues:
1. Check Cloudflare D1 documentation: https://developers.cloudflare.com/d1/
2. Verify schema match: Compare local SQLite and D1 schemas
3. Check worker logs in Cloudflare dashboard
4. Test sync with small dataset first (1-2 items)
