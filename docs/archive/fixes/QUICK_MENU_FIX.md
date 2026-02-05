# Quick Fix: Add Append Mode to Menu Upload

## Summary
Add an "Append Mode" toggle to prevent menu uploads from deleting existing items.

## Files to Change

### 1. `src/lib/menuSync.ts` - Add replaceMode parameter
```typescript
export async function syncMenuFromBackend(
  tenantId: string, 
  replaceMode: boolean = true // NEW: default to current behavior
): Promise<{ synced: number; categoriesCreated: number; itemsCreated: number }> {
  
  // ... existing code ...

  // 4. Conditionally clear existing menu data
  if (replaceMode) {
    await db.execute("DELETE FROM menu_items");
    await db.execute("DELETE FROM menu_categories");
    console.log('[Menu Sync] Cleared existing menu data (replace mode)');
  } else {
    console.log('[Menu Sync] Appending to existing menu (append mode)');
    // Delete only items that will be replaced (by matching ID or name)
    const itemNames = items.map(i => i.name);
    if (itemNames.length > 0) {
      const placeholders = itemNames.map(() => '?').join(',');
      await db.execute(
        `DELETE FROM menu_items WHERE name IN (${placeholders})`,
        itemNames
      );
      console.log('[Menu Sync] Removed', itemNames.length, 'duplicate items by name');
    }
  }

  // ... rest of code stays the same ...
}
```

### 2. `src/components/admin/MenuOnboarding.tsx` - Add toggle UI
```typescript
const [appendMode, setAppendMode] = useState(false);

// In the upload section UI:
<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={appendMode}
    onChange={(e) => setAppendMode(e.target.checked)}
    className="rounded border-gray-300"
  />
  <span>Append to existing menu (don't delete existing items)</span>
</label>
```

### 3. Update sync calls to pass appendMode
```typescript
// In MenuConfirmationTable.tsx or wherever sync is called
await syncMenuFromBackend(tenantId, !appendMode); // false = append, true = replace
```

## Test Plan

1. **Fresh Upload (Replace Mode OFF)**
   - Upload food menu → 50 items
   - Verify 50 items in database

2. **Append Upload (Append Mode ON)**
   - Enable "Append to existing menu"
   - Upload bar menu → 30 items
   - **Expected:** 80 items total (50 food + 30 bar)

3. **Replace Upload (Replace Mode ON)**
   - Disable "Append to existing menu"
   - Upload new menu → 40 items
   - **Expected:** Only 40 items (previous 80 deleted)

4. **Duplicate Handling**
   - Upload menu with "Pizza" item
   - Enable append mode
   - Upload again with "Pizza" item (different price)
   - **Expected:** Only 1 Pizza item (updated to new price)

