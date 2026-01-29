# Inventory Management - Testing Guide

## Overview

This guide provides step-by-step instructions for testing the local-first inventory management system. Follow these tests to verify offline CRUD, cloud sync, performance, and UI behavior.

**Version:** 3.1.0
**Last Updated:** 2026-01-23

---

## Prerequisites

### 1. Build the App

```bash
# Install dependencies
npm install

# Build Rust backend
cd src-tauri
cargo build
cd ..

# Run app in development
npm run tauri dev
```

### 2. Check Database

```bash
# Open SQLite database
sqlite3 src-tauri/pos.db

# Verify migration 029 ran
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'inventory%';
# Should show: inventory_items, inventory_transactions, inventory_documents, inventory_barcode_mappings

SELECT * FROM sync_queue LIMIT 5;
# Should show sync queue table exists

.quit
```

### 3. Enable Console Logging

Open DevTools (Cmd+Option+I on macOS, Ctrl+Shift+I on Windows) to see sync logs:
- `[App] 📦 Starting inventory sync on app start...`
- `[App] ✅ Inventory loaded from SQLite`
- `[App] ✅ Inventory synced from cloud`

---

## Test Suite

### Test 1: Offline CRUD Operations

**Goal:** Verify all CRUD operations work without internet

#### Steps:

1. **Disconnect from Internet**
   - macOS: Turn off Wi-Fi
   - Windows: Disconnect from network
   - Verify: UI should show "⚠️ Offline - changes will sync when online"

2. **Create New Item**
   ```
   - Click "Add Item" button
   - Fill in:
     - Name: "Test Tomatoes"
     - Category: Vegetables
     - Unit: kg
     - Current Stock: 50
     - Reorder Level: 10
     - Price per Unit: 80
   - Click "Add Item"
   - Verify: Item appears in list immediately
   - Verify: Yellow badge shows "1 change pending sync"
   ```

3. **Update Item**
   ```
   - Click edit icon on "Test Tomatoes"
   - Change:
     - Current Stock: 45
     - Price per Unit: 85
   - Click "Update Item"
   - Verify: Changes appear immediately
   - Verify: Pending sync count increases to 2
   ```

4. **Adjust Stock**
   ```
   - Click stock adjustment icon on "Test Tomatoes"
   - Add: +10 kg (purchase)
   - Reason: "Stock replenishment"
   - Verify: Stock updates to 55
   - Verify: Pending sync count increases to 3
   ```

5. **Delete Item**
   ```
   - Click delete icon on "Test Tomatoes"
   - Confirm deletion
   - Verify: Item removed from list
   - Verify: Pending sync count increases to 4
   ```

6. **Check SQLite**
   ```sql
   SELECT * FROM sync_queue;
   -- Should show 4 pending syncs (create, update, adjust, delete)

   SELECT * FROM inventory_items WHERE name = 'Test Tomatoes';
   -- Should be empty (item deleted)

   SELECT * FROM inventory_transactions WHERE reason = 'Stock replenishment';
   -- Should show the +10 transaction
   ```

#### Expected Results:
- ✅ All operations complete instantly
- ✅ UI updates optimistically
- ✅ Sync queue tracks all changes
- ✅ SQLite reflects current state
- ✅ Offline warning badge visible

---

### Test 2: Cloud Sync (Reconnect)

**Goal:** Verify offline changes sync when network returns

#### Steps:

1. **Still Offline from Test 1**
   - Verify: "4 changes pending sync" badge visible

2. **Reconnect to Internet**
   - Turn on Wi-Fi
   - Wait 5 seconds

3. **Observe Sync**
   ```
   - Console should show:
     [App] 🌐 Network reconnected, syncing inventory to cloud...
     [Inventory] Processing 4 pending syncs...
     [Inventory] Synced create: xxx
     [Inventory] Synced update: xxx
     [Inventory] Synced adjust: xxx
     [Inventory] Synced delete: xxx
     [App] ✅ Inventory synced after reconnect

   - UI should show:
     - Blue "Syncing..." indicator (briefly)
     - Pending sync count decreases to 0
     - "Last synced: [time]" appears
   ```

4. **Verify Cloud**
   ```
   - Open cloud admin panel / API
   - Check that all 4 operations were applied
   - Verify data matches local SQLite
   ```

5. **Check Sync Queue Cleared**
   ```sql
   SELECT * FROM sync_queue;
   -- Should be empty
   ```

#### Expected Results:
- ✅ Sync triggered automatically on reconnect
- ✅ All pending changes sent to cloud
- ✅ Sync queue cleared after success
- ✅ UI indicators update correctly
- ✅ No errors in console

---

### Test 3: Fresh Install (Cloud → Local Sync)

**Goal:** Verify fresh install downloads all data from cloud

#### Steps:

1. **Delete Local Database**
   ```bash
   rm src-tauri/pos.db
   ```

2. **Start App**
   ```bash
   npm run tauri dev
   ```

3. **Observe Initial Sync**
   ```
   - Console should show:
     [App] 📦 Starting inventory sync on app start...
     [App] ✅ Inventory loaded from SQLite (empty)
     [App] 🔄 Syncing from cloud...
     [App] ✅ Inventory synced from cloud (X items)

   - UI should show:
     - Loading spinner briefly
     - All items from cloud appear
     - Summary stats populated
   ```

4. **Verify Data**
   ```sql
   SELECT COUNT(*) FROM inventory_items;
   -- Should match cloud count

   SELECT * FROM inventory_items LIMIT 5;
   -- Should show items from cloud
   ```

#### Expected Results:
- ✅ App downloads all data from cloud
- ✅ SQLite populated correctly
- ✅ UI shows all items
- ✅ Summary/alerts work

---

### Test 4: Conflict Resolution

**Goal:** Verify merge strategy when local and cloud differ

#### Steps:

1. **Setup Conflict**
   ```
   Device A (offline):
   - Edit item "Tomatoes"
   - Change: Stock = 100, Name = "Fresh Tomatoes"

   Device B (offline):
   - Edit same item "Tomatoes"
   - Change: Stock = 80, Price = 90
   ```

2. **Reconnect Both Devices**
   - Device A syncs first (stock=100, name="Fresh Tomatoes")
   - Device B syncs second (stock=80, price=90)

3. **Observe Merge**
   ```
   Final result should be:
   - Name: "Fresh Tomatoes" (from Device A, cloud wins)
   - Price: 90 (from Device B, cloud wins)
   - Stock: 100 (MAX of 100 and 80, max wins)
   ```

4. **Verify in SQLite**
   ```sql
   SELECT name, current_stock, price_per_unit FROM inventory_items WHERE name LIKE '%Tomato%';
   -- Should show merged values
   ```

#### Expected Results:
- ✅ Cloud wins for metadata (name, price)
- ✅ Max wins for stock levels
- ✅ No data loss
- ✅ Both devices see same final state

---

### Test 5: Performance (Large Dataset)

**Goal:** Verify performance with 1000+ items

#### Steps:

1. **Generate Test Data**
   ```sql
   -- Insert 1000 test items
   BEGIN TRANSACTION;
   -- Use a script or SQL to insert 1000 items
   -- Example: items with names "Item 001" through "Item 1000"
   COMMIT;
   ```

2. **Measure Load Time**
   ```
   - Restart app
   - Open DevTools → Performance tab
   - Start recording
   - Navigate to /inventory
   - Stop recording

   Verify:
   - Initial load: < 1 second
   - First render: < 500ms
   ```

3. **Test Search**
   ```
   - Type in search box: "Item 5"
   - Measure response time

   Verify:
   - Search results: < 200ms
   - Filtered list updates instantly
   ```

4. **Test Scroll Performance**
   ```
   - Scroll through entire list (1000 items)
   - Monitor FPS in DevTools

   Verify:
   - Smooth scrolling (60 FPS)
   - No lag or jank
   ```

5. **Memory Usage**
   ```
   - Open DevTools → Memory tab
   - Take heap snapshot

   Verify:
   - Total memory < 200MB
   - No memory leaks
   ```

#### Expected Results:
- ✅ Load 1000+ items in < 1s
- ✅ Search/filter in < 200ms
- ✅ Smooth scrolling (60 FPS)
- ✅ Memory < 200MB

---

### Test 6: Bill Scanning (Hybrid)

**Goal:** Verify bill scanning works online, results stored locally

#### Steps:

1. **Online Scan**
   ```
   - Go to /inventory/scan
   - Upload bill image
   - Wait for OCR processing (requires cloud)

   Verify:
   - OCR results appear
   - Items extracted correctly
   - Supplier detected (if on bill)
   ```

2. **Confirm Results (Offline)**
   ```
   - Disconnect from internet
   - Match extracted items to existing inventory
   - Add new items if needed
   - Click "Confirm & Save"

   Verify:
   - Items saved to SQLite
   - Stock levels updated
   - Transaction history logged
   - Document metadata saved
   - Sync queue shows pending changes
   ```

3. **Verify SQLite**
   ```sql
   SELECT * FROM inventory_documents ORDER BY created_at DESC LIMIT 1;
   -- Should show latest scan with OCR results

   SELECT * FROM inventory_transactions WHERE reason LIKE '%Bill scan%';
   -- Should show stock adjustments from scan
   ```

4. **Reconnect and Sync**
   ```
   - Turn on internet
   - Wait for sync

   Verify:
   - Changes pushed to cloud
   - Cloud shows updated stock levels
   ```

#### Expected Results:
- ✅ OCR works online (requires cloud)
- ✅ Results stored locally
- ✅ Can process results offline
- ✅ Syncs to cloud when online

---

### Test 7: Periodic Sync

**Goal:** Verify automatic sync every 5 minutes

#### Steps:

1. **Make Changes**
   ```
   - Create 3 new items (while online)
   - Verify: Changes sync immediately (background)
   ```

2. **Wait 5 Minutes**
   ```
   - Do nothing, wait
   - Watch console

   At 5 minute mark, should see:
   [App] 📦 Periodic inventory sync...
   [Inventory] Processing sync queue...
   ```

3. **Verify Periodic Sync Ran**
   ```
   - Check "Last synced" timestamp
   - Should be within last 5 minutes

   - Check sync queue
   SELECT * FROM sync_queue;
   -- Should be empty
   ```

#### Expected Results:
- ✅ Automatic sync every 5 minutes
- ✅ Sync queue processed
- ✅ No user action required

---

### Test 8: UI Indicators

**Goal:** Verify all sync UI elements work correctly

#### Steps:

1. **Test Sync Indicator**
   ```
   - Make a change while online
   - Watch for blue "Syncing..." indicator
   - Verify: Spinner animates
   - Verify: Disappears after sync complete
   ```

2. **Test Pending Count Badge**
   ```
   - Go offline
   - Make 3 changes
   - Verify: Yellow badge shows "3 changes pending sync"
   - Make 2 more changes
   - Verify: Badge updates to "5 changes pending sync"
   ```

3. **Test Offline Warning**
   ```
   - Disconnect from internet
   - Verify: Red "⚠️ Offline" badge appears
   - Reconnect
   - Verify: Red badge disappears
   ```

4. **Test Last Synced Timestamp**
   ```
   - Make a change online
   - Wait for sync
   - Verify: "Last synced: [time]" shows correct time
   - Wait 1 minute
   - Verify: Timestamp doesn't change (only updates on sync)
   ```

5. **Test Manual Sync Button**
   ```
   - Make a change
   - Click "🔄 Sync Now" button
   - Verify: Sync triggered immediately
   - Verify: Button disabled during sync
   - Verify: Spinner animates on button icon
   ```

#### Expected Results:
- ✅ Sync indicator shows/hides correctly
- ✅ Pending count badge accurate
- ✅ Offline warning appears/disappears
- ✅ Last synced timestamp correct
- ✅ Manual sync button works

---

### Test 9: Error Handling

**Goal:** Verify app handles errors gracefully

#### Steps:

1. **Cloud API Error (401 Unauthorized)**
   ```
   - Modify token to invalid value
   - Make a change
   - Try to sync

   Verify:
   - Error logged to console
   - Item stays in sync queue
   - UI shows error message (if implemented)
   - App doesn't crash
   ```

2. **Cloud API Error (500 Server Error)**
   ```
   - Trigger server error (e.g., invalid data)
   - Try to sync

   Verify:
   - Error logged to console
   - Retry logic works (if implemented)
   - Item stays in sync queue
   - App doesn't crash
   ```

3. **SQLite Error (Invalid Data)**
   ```
   - Try to create item with missing required field

   Verify:
   - Error caught and handled
   - User sees error message
   - No partial data saved
   ```

4. **Network Timeout**
   ```
   - Simulate slow network (DevTools → Network tab → Throttling)
   - Try to sync

   Verify:
   - Sync eventually completes or times out
   - App remains responsive
   - No infinite loading
   ```

#### Expected Results:
- ✅ Errors logged clearly
- ✅ Failed syncs stay in queue
- ✅ UI shows error messages
- ✅ App doesn't crash
- ✅ Graceful degradation

---

## Verification Checklist

### Pre-Launch Checklist

- [ ] Migration 029 runs successfully
- [ ] All 21 Rust commands registered in lib.rs
- [ ] All commands compile without errors
- [ ] TypeScript service layer type-checks
- [ ] Zustand store has all sync methods
- [ ] App.tsx has all sync triggers
- [ ] InventoryDashboard.tsx shows sync UI
- [ ] No infinite loops (guards working)

### Functional Tests

- [ ] ✅ Test 1: Offline CRUD operations work
- [ ] ✅ Test 2: Cloud sync on reconnect works
- [ ] ✅ Test 3: Fresh install downloads data
- [ ] ✅ Test 4: Conflict resolution correct
- [ ] ✅ Test 5: Performance acceptable (< 1s load)
- [ ] ✅ Test 6: Bill scanning works (hybrid)
- [ ] ✅ Test 7: Periodic sync runs every 5 min
- [ ] ✅ Test 8: All UI indicators work
- [ ] ✅ Test 9: Error handling graceful

### Edge Cases

- [ ] Sync queue grows to 100+ items → still works
- [ ] App killed mid-sync → resumes correctly
- [ ] Network flaps (on/off/on/off) → handles gracefully
- [ ] Two devices edit same item → merge correct
- [ ] Large bill scan (50+ items) → processes correctly
- [ ] Empty database → no errors
- [ ] Invalid data → validation catches

### Performance

- [ ] 1000+ items load in < 1s
- [ ] Search/filter < 200ms
- [ ] Memory usage < 200MB
- [ ] 60 FPS scrolling
- [ ] No memory leaks
- [ ] Sync doesn't block UI

### Security

- [ ] Tenant ID filtering works (can't see other tenants)
- [ ] SQL injection prevented (parameterized queries)
- [ ] Auth tokens validated
- [ ] Sensitive data not logged

---

## Debugging Tips

### View Current State

```javascript
// In browser console
const store = useInventoryStore.getState();

console.log('Items:', store.items.length);
console.log('Is Syncing:', store.isSyncing);
console.log('Pending Count:', store.pendingSyncCount);
console.log('Last Synced:', store.lastSyncedAt);
```

### Check Sync Queue

```sql
-- In SQLite
SELECT
  id,
  table_name,
  record_id,
  json_extract(data, '$.action') as action,
  created_at
FROM sync_queue
ORDER BY created_at DESC;
```

### Reset Guards (If Stuck)

```javascript
// In browser console
isLoadingInventory = false;
isUpdatingInventory = false;
isSyncingInventory = false;
```

### Force Sync

```javascript
// In browser console
const tenantId = 'your-tenant-id';
await useInventoryStore.getState().syncToCloud(tenantId);
```

### Clear Sync Queue

```sql
-- In SQLite (use with caution)
DELETE FROM sync_queue;
```

---

## Known Issues

### Issue 1: Sync Queue Growing Large

**Symptom:** Pending count keeps increasing, never clears

**Cause:** Cloud API errors or network issues

**Fix:**
1. Check console for API errors
2. Verify auth token valid
3. Manually retry: `useInventoryStore.getState().syncToCloud(tenantId)`
4. If stuck, clear queue: `DELETE FROM sync_queue WHERE created_at < datetime('now', '-1 day')`

### Issue 2: Duplicate Items

**Symptom:** Same item appears twice

**Cause:** ID collision or merge logic bug

**Fix:**
1. Identify duplicates: `SELECT name, COUNT(*) FROM inventory_items GROUP BY name HAVING COUNT(*) > 1`
2. Delete duplicates: Keep one, delete others
3. Report bug with reproduction steps

### Issue 3: Performance Degradation

**Symptom:** App slows down over time

**Cause:** Memory leak or too many items in state

**Fix:**
1. Check memory: DevTools → Memory tab
2. Restart app
3. Implement pagination/virtual scrolling if > 1000 items

---

## Reporting Issues

When reporting bugs, include:

1. **Steps to Reproduce**
2. **Expected Behavior**
3. **Actual Behavior**
4. **Console Logs** (DevTools → Console)
5. **Network Logs** (DevTools → Network)
6. **SQLite State**:
   ```sql
   SELECT COUNT(*) FROM inventory_items;
   SELECT COUNT(*) FROM sync_queue;
   SELECT * FROM sync_metadata WHERE key LIKE '%inventory%';
   ```
7. **Environment**:
   - OS: macOS / Windows / Linux
   - App Version: 3.1.0
   - Online/Offline status

---

## Success Criteria

The inventory system is ready for production when:

✅ **All 9 tests pass**
✅ **Performance targets met** (< 1s load, < 200ms search)
✅ **No critical bugs**
✅ **Sync works reliably** (offline → online → cloud)
✅ **UI indicators accurate**
✅ **Error handling graceful**
✅ **Documentation complete**

---

## Next Steps

After testing complete:

1. **Fix any failing tests**
2. **Optimize performance** (if needed)
3. **Add unit tests** (Jest + React Testing Library)
4. **Add E2E tests** (Playwright or Cypress)
5. **Deploy to staging**
6. **User acceptance testing**
7. **Deploy to production**

Good luck testing! 🚀
