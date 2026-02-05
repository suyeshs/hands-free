# Multi-Image Menu Upload Solutions

## The Real Problem

### Scenario: Multi-Page Food Menu
```
Page 1: Appetizers (10 items)
Page 2: Mains (15 items)
Page 3: Desserts (8 items)
Page 4: Bar drinks (12 items)
```

### Current Behavior (Even with Type-Tagged)
```
Upload page 1 → DELETE WHERE menu_type='food' → Only appetizers (10)
Upload page 2 → DELETE WHERE menu_type='food' → Only mains (15) ❌
Upload page 3 → DELETE WHERE menu_type='food' → Only desserts (8) ❌
```

**Problem:** Each upload of the same type wipes the previous one!

---

## Solution 1: Upload Session with Batch Commit ⭐⭐⭐

### Concept
Upload multiple images into a "session", review all together, then commit once.

### Schema
```sql
CREATE TABLE menu_upload_sessions (
  id TEXT PRIMARY KEY,
  menu_type TEXT, -- 'food' | 'bar'
  status TEXT DEFAULT 'in_progress', -- 'in_progress' | 'committed' | 'cancelled'
  created_at TEXT,
  committed_at TEXT
);

CREATE TABLE menu_items_staging (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  page_number INTEGER, -- which image/page this came from
  name TEXT,
  category TEXT,
  price REAL,
  ...
  FOREIGN KEY(session_id) REFERENCES menu_upload_sessions(id)
);
```

### Upload Flow
```typescript
// 1. Start session
const sessionId = await startUploadSession('food');

// 2. Upload image 1
await uploadToSession(sessionId, image1, pageNumber: 1);
// → Parses 10 appetizers → Saves to staging with session_id

// 3. Upload image 2
await uploadToSession(sessionId, image2, pageNumber: 2);
// → Parses 15 mains → Adds to same session

// 4. Upload image 3
await uploadToSession(sessionId, image3, pageNumber: 3);
// → Parses 8 desserts → Adds to same session

// 5. Review all items from session
const allItems = await getSessionItems(sessionId); // Returns all 33 items

// 6. Commit session
await commitSession(sessionId);
// → DELETE WHERE menu_type='food'
// → INSERT all 33 items from staging
// → DELETE staging items
```

### UI Flow
```
┌─────────────────────────────────┐
│  Upload Food Menu               │
├─────────────────────────────────┤
│  📄 Page 1: 10 items (✓)       │
│  📄 Page 2: 15 items (✓)       │
│  📄 Page 3: 8 items (✓)        │
│  ➕ Add more pages              │
├─────────────────────────────────┤
│  Total: 33 items                │
│  [Review All] [Commit]          │
└─────────────────────────────────┘
```

### Benefits
- ✅ Natural multi-page workflow
- ✅ Review everything before committing
- ✅ Can delete/retry individual pages
- ✅ Single atomic operation at the end

### Implementation
```typescript
interface UploadSession {
  id: string;
  menuType: 'food' | 'bar';
  pages: Array<{
    pageNumber: number;
    fileName: string;
    itemCount: number;
    status: 'uploading' | 'parsed' | 'error';
  }>;
  totalItems: number;
  status: 'in_progress' | 'committed' | 'cancelled';
}

async function startUploadSession(menuType: 'food' | 'bar'): Promise<string> {
  const sessionId = `session-${Date.now()}`;
  await db.execute(`
    INSERT INTO menu_upload_sessions (id, menu_type, created_at)
    VALUES (?, ?, ?)
  `, [sessionId, menuType, new Date().toISOString()]);
  return sessionId;
}

async function uploadToSession(
  sessionId: string,
  file: File,
  pageNumber: number
) {
  // 1. Upload to R2 and parse with AI
  const items = await parseMenuImage(file);

  // 2. Save to staging
  for (const item of items) {
    await db.execute(`
      INSERT INTO menu_items_staging (
        id, session_id, page_number, name, category, price, ...
      ) VALUES (?, ?, ?, ?, ?, ?, ...)
    `, [
      `item-${Date.now()}-${Math.random()}`,
      sessionId,
      pageNumber,
      item.name,
      item.category,
      item.price,
      // ...
    ]);
  }

  return { itemCount: items.length };
}

async function commitSession(sessionId: string) {
  // 1. Get menu type
  const session = await db.select(`
    SELECT menu_type FROM menu_upload_sessions WHERE id = ?
  `, [sessionId]);
  const menuType = session[0].menu_type;

  // 2. Start transaction
  await db.execute('BEGIN TRANSACTION');

  try {
    // 3. Delete old items of this type
    await db.execute(
      'DELETE FROM menu_items WHERE menu_type = ?',
      [menuType]
    );

    // 4. Copy from staging to production
    await db.execute(`
      INSERT INTO menu_items (id, name, category, price, menu_type, ...)
      SELECT
        id, name, category, price, ? as menu_type, ...
      FROM menu_items_staging
      WHERE session_id = ?
    `, [menuType, sessionId]);

    // 5. Mark session as committed
    await db.execute(`
      UPDATE menu_upload_sessions
      SET status = 'committed', committed_at = ?
      WHERE id = ?
    `, [new Date().toISOString(), sessionId]);

    // 6. Clean up staging
    await db.execute(
      'DELETE FROM menu_items_staging WHERE session_id = ?',
      [sessionId]
    );

    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}
```

---

## Solution 2: Category-Aware Smart Replace ⭐⭐

### Concept
Detect which categories are in the upload, only replace those categories.

### Upload Logic
```typescript
async function smartUpload(items: MenuItem[], menuType: 'food' | 'bar') {
  // 1. Extract categories from uploaded items
  const uploadedCategories = [...new Set(items.map(i => i.category))];

  // 2. Delete only items in these categories + this menu type
  const placeholders = uploadedCategories.map(() => '?').join(',');
  await db.execute(`
    DELETE FROM menu_items
    WHERE menu_type = ?
    AND category IN (${placeholders})
  `, [menuType, ...uploadedCategories]);

  // 3. Insert new items
  for (const item of items) {
    await insertItem({ ...item, menu_type: menuType });
  }
}
```

### Example
```
Existing: Appetizers(10), Mains(15), Desserts(8)

Upload page with Appetizers(12):
  → DELETE WHERE menu_type='food' AND category='Appetizers'
  → INSERT 12 new appetizers
  → Result: Appetizers(12), Mains(15), Desserts(8) ✅

Upload page with Mains(20):
  → DELETE WHERE menu_type='food' AND category='Mains'
  → INSERT 20 new mains
  → Result: Appetizers(12), Mains(20), Desserts(8) ✅
```

### Benefits
- ✅ Automatic, no user intervention
- ✅ Can re-upload specific sections
- ✅ Simpler than sessions

### Drawbacks
- ⚠️ If AI mis-detects categories, can delete wrong items
- ⚠️ Requires consistent category naming

---

## Solution 3: Pure Append with Deduplication ⭐

### Concept
Never delete. Always append. Use UPSERT to handle duplicates.

### Schema
```sql
CREATE UNIQUE INDEX idx_menu_unique_item
ON menu_items(name, category, menu_type);
```

### Upload Logic
```typescript
async function appendUpload(items: MenuItem[], menuType: 'food' | 'bar') {
  for (const item of items) {
    await db.execute(`
      INSERT INTO menu_items (name, category, price, menu_type, ...)
      VALUES (?, ?, ?, ?, ...)
      ON CONFLICT(name, category, menu_type)
      DO UPDATE SET
        price = excluded.price,
        description = excluded.description,
        updated_at = excluded.updated_at
    `, [item.name, item.category, item.price, menuType, ...]);
  }
}
```

### Example
```
Upload page 1: Pizza($10), Pasta($12) → Inserts both
Upload page 2: Pasta($15), Salad($8) → Updates Pasta to $15, Inserts Salad
Result: Pizza($10), Pasta($15), Salad($8) ✅
```

### Benefits
- ✅ Never loses data
- ✅ Can upload pages in any order
- ✅ Automatic deduplication

### Drawbacks
- ⚠️ Can't remove items (old items persist forever)
- ⚠️ Need manual cleanup UI for obsolete items

---

## Solution 4: Hybrid: Session + Category-Aware

Combine sessions with smart category detection for best of both worlds.

### Upload Flow
```typescript
async function uploadWithSession(
  sessionId: string,
  file: File,
  pageNumber: number
) {
  // 1. Parse items
  const items = await parseMenuImage(file);
  const categories = [...new Set(items.map(i => i.category))];

  // 2. Save to staging with detected categories
  await saveStagingWithCategories(sessionId, pageNumber, items, categories);
}

async function commitSmartSession(sessionId: string) {
  // 1. Get all categories from this session
  const sessionCategories = await db.select(`
    SELECT DISTINCT category FROM menu_items_staging WHERE session_id = ?
  `, [sessionId]);

  const categories = sessionCategories.map(r => r.category);

  // 2. Delete only matching categories
  await db.execute(`
    DELETE FROM menu_items
    WHERE menu_type = (SELECT menu_type FROM menu_upload_sessions WHERE id = ?)
    AND category IN (${categories.map(() => '?').join(',')})
  `, [sessionId, ...categories]);

  // 3. Copy from staging
  await db.execute(`
    INSERT INTO menu_items SELECT * FROM menu_items_staging WHERE session_id = ?
  `, [sessionId]);
}
```

### Benefits
- ✅ Multi-page support (sessions)
- ✅ Smart replacement (category-aware)
- ✅ Review before commit
- ✅ Surgical precision

---

## Comparison

| Approach | Multi-Page | Safety | Complexity | Auto-Merge |
|----------|-----------|--------|------------|------------|
| **Session Batch** ⭐⭐⭐ | Perfect | High | Medium | No |
| **Category-Aware** ⭐⭐ | Good | Medium | Low | Yes |
| **Pure Append** ⭐ | Perfect | Very High | Low | Yes |
| **Hybrid** ⭐⭐⭐ | Perfect | Very High | High | Partial |

---

## Recommended: Upload Sessions ⭐⭐⭐

### Why
- ✅ Matches real-world workflow (scan multiple pages)
- ✅ Safe (review before commit)
- ✅ Clear UX (see all pages, total count)
- ✅ Can retry/delete individual pages
- ✅ Single atomic commit

### Implementation Steps

1. **Database Migration**
```sql
CREATE TABLE menu_upload_sessions (
  id TEXT PRIMARY KEY,
  menu_type TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  created_at TEXT NOT NULL,
  committed_at TEXT
);

CREATE TABLE menu_items_staging (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  page_number INTEGER,
  -- same columns as menu_items
  name TEXT,
  category TEXT,
  price REAL,
  ...
  FOREIGN KEY(session_id) REFERENCES menu_upload_sessions(id)
);
```

2. **Update MenuOnboarding UI**
- Add "Start Food Upload" / "Start Bar Upload" buttons
- Show list of uploaded pages
- Show total item count
- Add "Add More Pages" button
- Add "Review All & Commit" button

3. **Update ExcelUploader**
- Accept `sessionId` prop
- Upload to staging instead of production
- Return page summary

4. **Add Review/Commit Screen**
- Show all items from all pages
- Group by category
- Allow editing before commit
- Commit button triggers atomic operation

### Estimated Effort
- Database migrations: 1 hour
- Backend logic: 3 hours
- UI updates: 4 hours
- Testing: 2 hours

**Total: ~10 hours (1-2 days)**

---

## Quick Win Alternative: Category-Aware

If you need a quick fix without sessions:

```typescript
// Add this to menuSync.ts
async function smartCategoryReplace(
  items: MenuItem[],
  menuType: 'food' | 'bar'
) {
  const categories = [...new Set(items.map(i => i.category))];

  // Only delete items in uploaded categories
  if (categories.length > 0) {
    const placeholders = categories.map(() => '?').join(',');
    await db.execute(`
      DELETE FROM menu_items
      WHERE menu_type = ?
      AND category IN (${placeholders})
    `, [menuType, ...categories]);
  }

  // Insert new items
  for (const item of items) {
    await insertItem({ ...item, menu_type: menuType });
  }
}
```

**Effort: ~2 hours**

---

## Your Choice

Which approach fits your needs?

1. **Quick fix** → Category-Aware (2 hours)
2. **Best UX** → Upload Sessions (10 hours)
3. **Safest** → Pure Append + Manual cleanup UI
4. **Maximum flexibility** → Hybrid approach

