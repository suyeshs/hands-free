# Better Menu Upload Architectures

## Current Problems
- ❌ Destructive full-table DELETE on every upload
- ❌ No separation between food/bar menus
- ❌ Fragile category keyword matching
- ❌ No version history or undo
- ❌ No safety checks or previews

---

## Option 1: Type-Tagged Menu (Recommended) ⭐

### Schema Change
```sql
ALTER TABLE menu_items ADD COLUMN menu_type TEXT DEFAULT 'food';
-- Values: 'food' | 'bar' | 'both'

CREATE INDEX idx_menu_items_type ON menu_items(menu_type, active);
```

### Upload Logic
```typescript
async function uploadMenu(items: MenuItem[], menuType: 'food' | 'bar') {
  // 1. Delete only items of this type
  await db.execute(
    "DELETE FROM menu_items WHERE menu_type = ?",
    [menuType]
  );

  // 2. Insert with type tag
  for (const item of items) {
    await db.execute(
      "INSERT INTO menu_items (..., menu_type) VALUES (..., ?)",
      [...values, menuType]
    );
  }
}
```

### Benefits
- ✅ **Efficient**: Single table, single index
- ✅ **Safe**: Only deletes specified type
- ✅ **Clear**: Explicit separation
- ✅ **Flexible**: Can mark items as 'both'

### Implementation Cost
- Add column migration
- Update upload UI (Food/Bar selector)
- Update queries to filter by type

---

## Option 2: Smart UPSERT with Unique Keys

### Schema Change
```sql
-- Add unique constraint on (name, category_id)
CREATE UNIQUE INDEX idx_menu_unique_item
ON menu_items(name, category_id);
```

### Upload Logic
```typescript
async function upsertMenu(items: MenuItem[]) {
  for (const item of items) {
    // SQLite UPSERT: Update if exists, insert if not
    await db.execute(`
      INSERT INTO menu_items (id, name, category_id, price, ...)
      VALUES (?, ?, ?, ?, ...)
      ON CONFLICT(name, category_id)
      DO UPDATE SET
        price = excluded.price,
        description = excluded.description,
        updated_at = excluded.updated_at
      WHERE menu_items.name = excluded.name
    `, [values]);
  }
}
```

### Benefits
- ✅ **Database-level deduplication**
- ✅ **Append by default** - never loses data
- ✅ **Updates existing** - price changes work
- ✅ **No DELETE needed**

### Drawbacks
- ⚠️ Can't remove items (orphaned items stay)
- ⚠️ Need cleanup job for obsolete items

---

## Option 3: Category-Scoped Deletion (Smart Replace)

### Upload Logic
```typescript
async function smartUpload(items: MenuItem[]) {
  // 1. Extract categories from uploaded items
  const uploadedCategories = [...new Set(items.map(i => i.category))];

  // 2. Delete only items in these categories
  const placeholders = uploadedCategories.map(() => '?').join(',');
  await db.execute(
    `DELETE FROM menu_items
     WHERE category_id IN (
       SELECT id FROM menu_categories
       WHERE name IN (${placeholders})
     )`,
    uploadedCategories
  );

  // 3. Insert new items
  for (const item of items) {
    await insertItem(item);
  }
}
```

### Benefits
- ✅ **Automatic** - no user choice needed
- ✅ **Smart** - only replaces related categories
- ✅ **Preserves** - other categories untouched

### Example
```
Existing: Appetizers(10), Mains(20), Drinks(15)
Upload:   Appetizers(12), Mains(25)
Result:   Appetizers(12), Mains(25), Drinks(15) ✅
```

---

## Option 4: Staging Table with Preview/Diff

### Schema
```sql
CREATE TABLE menu_items_staging (
  upload_id TEXT NOT NULL,
  -- same columns as menu_items
  ...
);

CREATE TABLE menu_uploads (
  id TEXT PRIMARY KEY,
  status TEXT, -- 'pending', 'approved', 'rejected'
  uploaded_at TEXT,
  uploaded_by TEXT
);
```

### Upload Flow
```typescript
// 1. Upload to staging
async function uploadToStaging(items: MenuItem[]): string {
  const uploadId = `upload-${Date.now()}`;

  for (const item of items) {
    await db.execute(
      "INSERT INTO menu_items_staging (upload_id, ...) VALUES (?, ...)",
      [uploadId, ...values]
    );
  }

  return uploadId;
}

// 2. Show diff/preview
async function getUploadDiff(uploadId: string) {
  const adds = await db.select(`
    SELECT * FROM menu_items_staging
    WHERE upload_id = ?
    AND name NOT IN (SELECT name FROM menu_items)
  `, [uploadId]);

  const updates = await db.select(`
    SELECT s.*, m.price as old_price
    FROM menu_items_staging s
    JOIN menu_items m ON s.name = m.name
    WHERE s.upload_id = ? AND s.price != m.price
  `, [uploadId]);

  return { adds, updates };
}

// 3. User approves → merge
async function approveUpload(uploadId: string) {
  // Copy from staging to production
  await db.execute(`
    INSERT INTO menu_items SELECT * FROM menu_items_staging
    WHERE upload_id = ?
    ON CONFLICT(name, category_id) DO UPDATE SET ...
  `, [uploadId]);

  // Cleanup staging
  await db.execute("DELETE FROM menu_items_staging WHERE upload_id = ?", [uploadId]);
}
```

### Benefits
- ✅ **Safe** - review before applying
- ✅ **Visible** - see exactly what changes
- ✅ **Reversible** - reject if wrong
- ✅ **Auditable** - track who uploaded what

### Drawbacks
- ⚠️ More complex
- ⚠️ Extra tables/storage
- ⚠️ Multi-step workflow

---

## Option 5: Versioned Menu (Full History)

### Schema
```sql
CREATE TABLE menu_versions (
  id TEXT PRIMARY KEY,
  version_number INTEGER,
  created_at TEXT,
  created_by TEXT,
  is_active BOOLEAN DEFAULT 0
);

CREATE TABLE menu_items_versioned (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  name TEXT,
  price REAL,
  ...
  FOREIGN KEY(version_id) REFERENCES menu_versions(id)
);

CREATE INDEX idx_menu_active_version
ON menu_items_versioned(version_id)
WHERE version_id IN (SELECT id FROM menu_versions WHERE is_active = 1);
```

### Upload Logic
```typescript
async function uploadNewVersion(items: MenuItem[]) {
  // 1. Create new version
  const versionId = `v-${Date.now()}`;
  await db.execute(
    "INSERT INTO menu_versions (id, version_number, is_active) VALUES (?, ?, 1)",
    [versionId, nextVersion]
  );

  // 2. Deactivate old version
  await db.execute("UPDATE menu_versions SET is_active = 0 WHERE is_active = 1");

  // 3. Insert items for this version
  for (const item of items) {
    await db.execute(
      "INSERT INTO menu_items_versioned (version_id, ...) VALUES (?, ...)",
      [versionId, ...values]
    );
  }
}

// Query active menu
async function getActiveMenu() {
  return db.select(`
    SELECT m.* FROM menu_items_versioned m
    JOIN menu_versions v ON m.version_id = v.id
    WHERE v.is_active = 1
  `);
}

// Rollback to previous version
async function rollbackToVersion(versionId: string) {
  await db.execute("UPDATE menu_versions SET is_active = 0");
  await db.execute("UPDATE menu_versions SET is_active = 1 WHERE id = ?", [versionId]);
}
```

### Benefits
- ✅ **Full history** - never lose data
- ✅ **Rollback** - undo mistakes easily
- ✅ **Audit trail** - who changed what when
- ✅ **A/B testing** - switch between menus

### Drawbacks
- ⚠️ Storage grows over time
- ⚠️ More complex queries
- ⚠️ Need cleanup strategy

---

## Comparison Matrix

| Approach | Efficiency | Safety | Complexity | Flexibility |
|----------|-----------|--------|------------|-------------|
| **Type-Tagged** ⭐ | High | Medium | Low | High |
| **UPSERT** | High | High | Low | Medium |
| **Category-Scoped** | Medium | Medium | Medium | Medium |
| **Staging/Diff** | Medium | Very High | High | High |
| **Versioned** | Low | Very High | Very High | Very High |

---

## Recommended Solution: Hybrid Approach

Combine the best of multiple approaches:

### Phase 1: Type-Tagged + UPSERT (Quick Win)
```sql
-- Add menu_type column
ALTER TABLE menu_items ADD COLUMN menu_type TEXT DEFAULT 'food';

-- Add unique constraint
CREATE UNIQUE INDEX idx_menu_unique
ON menu_items(name, category_id, menu_type);
```

```typescript
async function uploadMenu(
  items: MenuItem[],
  menuType: 'food' | 'bar',
  mode: 'replace' | 'merge' = 'replace'
) {
  if (mode === 'replace') {
    // Delete only this menu type
    await db.execute(
      "DELETE FROM menu_items WHERE menu_type = ?",
      [menuType]
    );
  }

  // UPSERT items
  for (const item of items) {
    await db.execute(`
      INSERT INTO menu_items (name, menu_type, category_id, price, ...)
      VALUES (?, ?, ?, ?, ...)
      ON CONFLICT(name, category_id, menu_type)
      DO UPDATE SET price = excluded.price, ...
    `, [item.name, menuType, ...values]);
  }
}
```

### Phase 2: Add Staging for Safety
- Implement staging table for large uploads
- Show diff/preview UI
- Allow approval/rejection

### Phase 3: Add Versioning (Optional)
- For restaurants with frequent menu changes
- Regulatory compliance (audit trail)
- A/B testing capabilities

---

## Migration Path

### Step 1: Add menu_type column (backwards compatible)
```sql
ALTER TABLE menu_items ADD COLUMN menu_type TEXT DEFAULT 'food';

-- Mark existing bar items
UPDATE menu_items
SET menu_type = 'bar'
WHERE category_id IN (
  SELECT id FROM menu_categories
  WHERE name LIKE '%cocktail%'
  OR name LIKE '%beer%'
  OR name LIKE '%wine%'
);
```

### Step 2: Update upload UI
- Add "Menu Type" selector (Food/Bar)
- Add "Upload Mode" toggle (Replace/Merge)

### Step 3: Update queries
- BarPOS: `WHERE menu_type IN ('bar', 'both')`
- Food POS: `WHERE menu_type IN ('food', 'both')`

---

## Implementation Effort

| Approach | Lines of Code | Migration Risk | Time |
|----------|--------------|----------------|------|
| Type-Tagged | ~100 | Low | 2-3 hours |
| + UPSERT | +50 | Low | +1 hour |
| + Staging | +300 | Medium | +1 day |
| + Versioning | +500 | High | +2 days |

---

## Recommendation

**Start with Type-Tagged + UPSERT** ⭐

**Why:**
- ✅ Solves 80% of problems with 20% effort
- ✅ Backwards compatible migration
- ✅ Clear, simple, efficient
- ✅ Can add staging/versioning later if needed

**Next Steps:**
1. Add `menu_type` column migration
2. Update upload UI with type selector
3. Implement UPSERT logic
4. Test with food + bar uploads
5. Monitor performance

