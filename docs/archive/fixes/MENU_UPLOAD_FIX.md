# Menu Upload Tables Fix

## Problem
Menu upload functionality was failing with:
```
error returned from database: (code: 1) no such table: menu_items_staging
```

## Root Cause
1. Migration 052 created `menu_staging_items` but the code expected `menu_items_staging`
2. Missing columns: `preparation_time`, `allergens`, `dietary_tags`

## Solution

### Updated Migration 052
[migrations-for-r2-deployment/052_menu_upload_sessions.sql](migrations-for-r2-deployment/052_menu_upload_sessions.sql)

Created three tables for menu upload workflow:

#### 1. menu_upload_sessions
Tracks entire upload workflows
- `id` - Session identifier
- `menu_type` - 'food' or 'bar'
- `status` - 'in_progress', 'committed', or 'cancelled'
- `created_at` - Session start time
- `committed_at` - When session was committed
- `total_items` - Total menu items in session
- `total_pages` - Total pages/files uploaded

#### 2. menu_upload_pages
Tracks individual PDF/image uploads within a session
- `id` - Page identifier
- `session_id` - Parent session
- `page_number` - Sequential page number
- `file_name` - Original filename
- `item_count` - Items extracted from this page
- `status` - 'uploading', 'parsed', or 'error'
- `error_message` - Error details if parsing failed
- `created_at` - Upload time

#### 3. menu_items_staging
Temporary storage for parsed menu items before commit
- `id` - Item identifier
- `session_id` - Parent session
- `page_number` - Source page number
- `name` - Menu item name
- `category` - Menu category
- `description` - Item description
- `price` - Item price
- `image` - Image URL (optional)
- `active` - Active status (default: true)
- `preparation_time` - Prep time in minutes (default: 15)
- `allergens` - JSON array of allergens
- `dietary_tags` - JSON array of dietary tags
- `created_at` - Creation time

## Verification

```bash
sqlite3 "~/Library/Application Support/com.stonepot-tech.handsfree-pos/pos.db" \
  ".schema menu_items_staging"
```

### Expected Schema:
```sql
CREATE TABLE menu_items_staging (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image TEXT,
    active BOOLEAN NOT NULL DEFAULT 1,
    preparation_time INTEGER DEFAULT 15,
    allergens TEXT DEFAULT '[]',
    dietary_tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES menu_upload_sessions(id) ON DELETE CASCADE
);
```

## Migration Status

✅ Migration 051: WiFi settings
✅ Migration 052: Menu upload sessions (corrected)

Total migrations applied: **52**

## Testing

1. **Start upload session**:
   ```typescript
   const sessionId = await startUploadSession('food');
   ```

2. **Upload pages**:
   ```typescript
   const pageId = await addUploadPage(sessionId, 1, 'menu-page-1.pdf');
   ```

3. **Add staging items**:
   ```typescript
   await addStagingItems(sessionId, 1, [
     {
       name: 'Paneer Tikka',
       category: 'Appetizers',
       price: 250,
       preparationTime: 20,
       allergens: ['dairy'],
       dietaryTags: ['vegetarian']
     }
   ]);
   ```

4. **Commit session**:
   ```typescript
   await commitUploadSession(sessionId);
   // Items are moved to menu_items and menu_categories
   // Staging tables are cleaned up
   ```

## Related Files

### Frontend
- [src/components/admin/MenuUploadSession.tsx](src/components/admin/MenuUploadSession.tsx) - Upload UI
- [src/lib/database.ts](src/lib/database.ts) - Database operations

### Backend
- [src-tauri/src/migrations.rs](src-tauri/src/migrations.rs#L67-L68) - Migration registration
- [migrations-for-r2-deployment/052_menu_upload_sessions.sql](migrations-for-r2-deployment/052_menu_upload_sessions.sql) - Table definitions

## Workflow

1. User starts menu upload session
2. Uploads multiple PDF/image pages
3. AI parses each page → items go to `menu_items_staging`
4. User reviews and edits staged items
5. User commits → items moved to `menu_items` and `menu_categories`
6. Staging tables cleaned up

## Status

✅ **Fixed** - Menu upload functionality now has all required tables and columns.
