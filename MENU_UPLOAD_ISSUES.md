# Menu Upload Issues & Solutions

## Issue 1: Multiple Uploads REPLACE Instead of APPEND ❌

### Current Behavior
When you upload a menu file (Excel/PDF), the system:
1. **Deletes ALL existing menu items** (`DELETE FROM menu_items`)
2. **Deletes ALL existing categories** (`DELETE FROM menu_categories`)
3. Inserts the new items from the upload

**Source:** `src/lib/menuSync.ts` lines 62-64

### Problem
- Upload food menu → 50 items saved ✅
- Upload bar menu → **Food menu deleted!** ❌ Only bar menu remains
- Upload another file → Previous upload completely wiped out

### Impact
- Can't build up a complete menu incrementally
- Can't have separate food/bar menus
- Accidental re-uploads destroy existing data

---

## Issue 2: No Bar-Specific Menu Upload ❌

### Current Setup
Bar POS uses the **same menu_items table** but filters by category keywords:
- Categories containing: 'beverages', 'drinks', 'bar', 'cocktails', 'beer', 'wine', 'spirits'
- **Source:** `src/pages-v2/BarPOS.tsx` lines 69-73

### What Exists
- ✅ Bar recipes table (`bar_recipes`) - Links to menu items + adds ingredients
- ✅ Bar inventory (`bar_inventory_items`)
- ✅ Bar POS interface
- ❌ **No separate bar menu upload workflow**

### Problem
- No way to upload bar menu separately from food menu
- Bar drinks must be in the main menu upload
- If you upload "food only" → bar items get deleted
- If you upload "bar only" → food items get deleted

---

## Solutions

### Option A: Add Append Mode (Quick Fix)
Add a checkbox in MenuOnboarding: "Append to existing menu" vs "Replace entire menu"

**Pros:**
- Simple to implement
- Gives user control
- Works for both food and bar

**Cons:**
- Manual process
- User can still accidentally replace

### Option B: Smart Category Detection (Recommended)
Detect if upload contains food vs bar items and only replace matching categories

**Example:**
- Upload contains drinks → Only replace 'beverages', 'cocktails', etc.
- Upload contains food → Only replace 'appetizers', 'mains', etc.
- Preserve non-matching categories

**Pros:**
- Automatic
- Prevents accidental deletion
- Works incrementally

**Cons:**
- More complex logic
- Need to define category mappings

### Option C: Separate Food/Bar Upload Tabs
Create two upload sections: "Food Menu" and "Bar Menu"

**Pros:**
- Clear separation
- Less confusion
- Natural workflow

**Cons:**
- Need to tag menu items as food/bar
- More UI changes

---

## Recommended Implementation

### Phase 1: Add Append Mode (Now)
1. Add checkbox in `MenuOnboarding.tsx`
2. Update `menuSync.ts` to skip DELETE if append mode
3. Handle duplicate items (update vs insert)

### Phase 2: Smart Detection (Later)
1. Analyze uploaded items for category types
2. Only delete matching category groups
3. Preserve other categories

### Current Fix Required

**File:** `src/lib/menuSync.ts`

Change this:
```typescript
// 4. Clear existing menu data
await db.execute("DELETE FROM menu_items");
await db.execute("DELETE FROM menu_categories");
```

To this:
```typescript
// 4. Optionally clear existing menu data
if (replaceMode) {
  // Delete all if replacing
  await db.execute("DELETE FROM menu_items");
  await db.execute("DELETE FROM menu_categories");
} else {
  // Append mode - keep existing, update duplicates by name
  console.log('[Menu Sync] Append mode - merging with existing items');
}
```

---

## Testing Scenario

### Before Fix:
1. Upload food menu (50 items)
2. Upload bar menu (30 items)
3. **Result:** Only 30 bar items exist ❌

### After Fix (Append Mode):
1. Upload food menu (50 items)
2. Enable "Append to existing menu"
3. Upload bar menu (30 items)
4. **Result:** 80 items total (50 food + 30 bar) ✅

---

## Next Steps

1. ✅ Acknowledge the issue
2. Choose solution approach (A, B, or C)
3. Implement the fix
4. Test with multiple uploads
5. Update documentation

