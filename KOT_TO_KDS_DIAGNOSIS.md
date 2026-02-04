# KOT to KDS Issue - Diagnostic Guide

## Issue
Clicking "Send KOT" in POS dashboard is not sending orders to the Kitchen Display System (KDS).

## Quick Diagnosis (Run These First)

### 1. Open Browser DevTools Console
Press `F12` or `Cmd+Option+I` to open the browser console before testing.

### 2. Run Automatic Diagnostic
In the browser console, paste and run:
```javascript
// Replace 'your-tenant-id' with your actual tenant ID
await window.kdsDebug.fullDiagnostic('your-tenant-id');
```

This will check:
- ✅ KDS Store state
- ✅ Database table existence
- ✅ Order counts in database vs store
- ✅ Sync status

### 3. Test Sending a KOT
1. Go to POS Dashboard
2. Add items to cart
3. Select a table (for dine-in)
4. Click "SEND KOT"
5. Watch the console for these logs:

**Expected successful logs:**
```
[POSDashboard] Sending KOT to kitchen...
[POSStore] Saving table X session: Y items
[POSStore] ✓ Table session persisted to SQLite
[POSStore] 🏃 Running order detected - Table X, KOT #1  (if running order)
[KDSStore] Adding order: KOT-XXX v1
[POSStore] ✓ KOT sent to kitchen (auto-print disabled)
[POSDashboard] ✓ KOT sent successfully!
```

## Common Issues and Solutions

### Issue 1: `kds_orders` Table Does Not Exist

**Symptom:**
```
❌ kds_orders table DOES NOT EXIST!
```

**Solution:**
The database migrations haven't been applied. Check:

1. Look for migration errors at app startup
2. Check if the Tauri app has the migration file: `migrations-for-r2-deployment/005_kds_orders.sql`
3. Try restarting the app to trigger migrations
4. If still not working, manually run the migration:

```javascript
// In browser console
const db = await Database.load('sqlite:pos.db');
await db.execute(`
CREATE TABLE IF NOT EXISTS kds_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    table_number INTEGER,
    order_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_running_order INTEGER NOT NULL DEFAULT 0,
    kot_sequence INTEGER,
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    completed_at TEXT,
    elapsed_minutes INTEGER DEFAULT 0,
    estimated_prep_time INTEGER DEFAULT 15,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    tenant_id TEXT NOT NULL,
    UNIQUE(order_number, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_kds_orders_tenant_status ON kds_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_kds_orders_table ON kds_orders(table_number);
`);
```

### Issue 2: Orders in Database but Not in KDS Store

**Symptom:**
```
Database has 5 active orders
Store has 0 active orders
⚠️ MISMATCH: Store has 0 orders, DB has 5
```

**Solution:**
The KDS Store isn't loading orders from the database. Try:

1. **Reload orders manually:**
```javascript
import { useKDSStore } from './stores/kdsStore';
import { useAuthStore } from './stores/authStore';

const tenantId = useAuthStore.getState().user?.tenantId;
await useKDSStore.getState().loadOrdersFromDb(tenantId);
```

2. **Navigate to Kitchen Dashboard** - It should auto-load orders on mount

3. **Check for errors** - Look for `[KDSStore] Failed to load orders from SQLite:` in console

### Issue 3: Orders in Store but Not in Database

**Symptom:**
```
Store has 5 active orders
Database has 0 active orders
⚠️ MISMATCH
Orders in Store but not in DB:
  - KOT-123 (kitchen-xxxxx)
```

**Solution:**
Orders are being added to memory but failing to persist to SQLite.

**Check for persistence errors:**
```
[KDSStore] Failed to persist order to SQLite: [error details]
```

**Possible causes:**
- Database file is locked (another process has it open)
- Disk is full or write-protected
- Tauri SQL plugin not initialized properly

**Try:**
1. Restart the application
2. Check disk space
3. Check file permissions on the database file

### Issue 4: "Rejecting stale order" Messages

**Symptom:**
```
[KDSStore] Rejecting stale order: KOT-123 (370 minutes old, max: 360)
```

**Solution:**
The order timestamp is too old. This is normal for:
- Old test orders
- Orders from previous days
- System time is incorrect

**Actions:**
- Check your system time is correct
- Old orders are automatically rejected (this is by design)
- Fresh orders should work fine

### Issue 5: Kitchen Dashboard Not Showing Orders

**Checklist:**
1. ✅ Orders are in the database (checked with diagnostic)
2. ✅ Orders are in the KDS Store (checked with `window.kdsDebug.inspectStore()`)
3. ❌ Orders not visible in UI

**Solution:**
This is likely a UI filtering issue.

**Check:**
1. **Station Filter** - Is "All Stations" selected?
   - Orders might be filtered to a specific station
   - Click "All Stations" in the Kitchen Dashboard

2. **Order Status** - Are completed orders hidden?
   - The UI only shows active orders by default
   - Completed orders move to a separate list

3. **Table Number** - For dine-in orders, check table filter

## Manual Store Inspection

### Check KDS Store State
```javascript
window.kdsDebug.inspectStore();
```

### Check Database State
```javascript
const tenantId = 'your-tenant-id';
await window.kdsDebug.inspectDatabase(tenantId);
```

### Force Load Orders from Database
```javascript
import { useKDSStore } from './stores/kdsStore';
const tenantId = 'your-tenant-id';
await useKDSStore.getState().loadOrdersFromDb(tenantId);
window.kdsDebug.inspectStore(); // Check if loaded
```

### Manually Add Test Order
```javascript
import { useKDSStore } from './stores/kdsStore';

useKDSStore.getState().addOrder({
  id: 'test-' + Date.now(),
  orderNumber: 'TEST-001',
  orderType: 'dine-in',
  source: 'pos',
  status: 'pending',
  createdAt: new Date().toISOString(),
  acceptedAt: new Date().toISOString(),
  items: [
    {
      id: 'item-1',
      name: 'Test Paneer Tikka',
      quantity: 2,
      status: 'pending',
      station: 'Main Kitchen',
      specialInstructions: null,
      modifiers: []
    }
  ],
  tableNumber: 5,
  isUrgent: false,
  elapsedMinutes: 0,
  isRunningOrder: false,
  version: 1,
  updatedAt: new Date().toISOString()
});
```

If this test order shows up in the Kitchen Dashboard, then the issue is with the KOT sending flow, not the KDS display.

## Workflow Verification

The expected flow when clicking "Send KOT":

1. **POSDashboard.tsx:425** - `handleSendToKitchen()` called
2. **posStore.ts:920** - `sendToKitchen()` called with tenantId
3. **posStore.ts:1043-1052** - Table session saved to SQLite
4. **posStore.ts:1091-1109** - Order transformed to KitchenOrder format
5. **posStore.ts:1116** - `useKDSStore.getState().addOrder(kitchenOrder)` called
6. **kdsStore.ts:135-216** - `addOrder()` processes the order:
   - Checks if order is stale (rejects if too old)
   - Checks for duplicates
   - Adds to activeOrders array
   - Persists to SQLite (line 189-198)
   - Broadcasts to other tabs
   - Plays notification sound
7. **kdsStore.ts:194** - `kdsOrderService.saveOrder()` persists to SQLite
8. **Kitchen Dashboard** - Loads orders from SQLite on mount (line 104)

## Database File Location

The SQLite database is located at:
- **macOS**: `~/Library/Application Support/com.stonepot-tech.handsfree-pos/pos.db`
- **Windows**: `%APPDATA%\com.stonepot-tech.handsfree-pos\pos.db`
- **Linux**: `~/.local/share/com.stonepot-tech.handsfree-pos/pos.db`

You can inspect it with any SQLite browser tool.

## Still Not Working?

If the issue persists after trying the above:

1. **Capture full console logs** when sending a KOT
2. **Run the full diagnostic** and share the output:
   ```javascript
   await window.kdsDebug.fullDiagnostic('your-tenant-id');
   ```
3. **Check for JavaScript errors** in the console
4. **Verify the Kitchen Dashboard route** is accessible at `/#/kitchen`

## Reset Options (Use with Caution)

### Clear All KDS Orders
```javascript
import { useKDSStore } from './stores/kdsStore';
useKDSStore.getState().clearAllOrders();
```

### Clear KDS Orders from Database
```javascript
import { kdsOrderService } from './lib/kdsOrderService';
const tenantId = 'your-tenant-id';
await kdsOrderService.clearAllOrders(tenantId);
```

### Full Reset (clears both store and database)
```javascript
import { useKDSStore } from './stores/kdsStore';
import { kdsOrderService } from './lib/kdsOrderService';

const tenantId = 'your-tenant-id';
useKDSStore.getState().clearAllOrders();
await kdsOrderService.clearAllOrders(tenantId);
```

## Debug Mode

The app now has automatic debug utilities loaded. After starting the app, open the console and you'll see:
```
[KDS Debug] Debug utilities loaded. Use window.kdsDebug in console.
```

Available commands:
- `window.kdsDebug.inspectStore()` - Check KDS store state
- `window.kdsDebug.inspectDatabase(tenantId)` - Check database contents
- `window.kdsDebug.syncCheck(tenantId)` - Compare store vs database
- `window.kdsDebug.fullDiagnostic(tenantId)` - Run all checks
