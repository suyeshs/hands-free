# KOT Not Sending to KDS - Quick Fix

## Issue
After migrating from localStorage to SQLite, KOT orders aren't appearing in KDS.

## QUICK TEST (Do This First)

### Step 1: Clear localStorage remnants
Open browser console and run:
```javascript
// Clear any old localStorage data that might conflict
localStorage.removeItem('kds-orders');
localStorage.removeItem('kds-storage');
console.log('✅ Cleared old localStorage KDS data');
```

### Step 2: Verify database table exists
```javascript
// Check if kds_orders table exists
const db = await Database.load('sqlite:pos.db');
const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table' AND name='kds_orders'`);
console.log('kds_orders table exists:', tables.length > 0);
```

### Step 3: Test KOT send with minimal logging
1. Open POS Dashboard
2. Add one item to cart
3. Select a table
4. Click "SEND KOT"
5. Look for these specific logs (use console filter: `KOT` or `KDS`):

**Success indicators:**
- `[POSDashboard] ✓ KOT sent successfully!`
- `[KDSStore] Adding order: KOT-XXX`

**Error indicators:**
- `[KDSStore] Rejecting stale order`
- `[POSStore] Failed to send to KDS/Printer`
- `[KDSStore] Failed to persist order to SQLite`

### Step 4: Check KDS Store immediately after sending
```javascript
import { useKDSStore } from './stores/kdsStore';
const orders = useKDSStore.getState().activeOrders;
console.log(`KDS has ${orders.length} active orders`);
if (orders.length > 0) {
  console.log('Latest order:', orders[0].orderNumber, 'Table:', orders[0].tableNumber);
}
```

### Step 5: Navigate to Kitchen Dashboard
Go to `/#/kitchen` and see if orders appear there.

## Most Likely Issue: localStorage Conflict

The system might still be checking localStorage. Let me check the code...

### Check for localStorage references in kdsStore
The kdsStore should NOT be using localStorage anymore. If you see any of these errors:
- `localStorage is not defined`
- References to `localStorage.getItem('kds-orders')`

Then there's leftover code trying to use localStorage.

## Common Fixes

### Fix 1: Database table missing
If step 2 shows table doesn't exist:
```javascript
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
console.log('✅ Created kds_orders table');
```

### Fix 2: Orders stuck in memory only
If orders appear in store but not in Kitchen Dashboard:
```javascript
// Force reload Kitchen Dashboard
window.location.href = '/#/kitchen';
window.location.reload();
```

### Fix 3: Station filter blocking orders
In Kitchen Dashboard, make sure "All Stations" is selected at the top.

## Targeted Console Filter

To reduce console noise, use these filters in Chrome DevTools:

1. Click the "Filter" button in console
2. Add these filters (one at a time):
   - `KOT` - Shows KOT-related logs only
   - `KDS` - Shows KDS-related logs only
   - `-[D1Sync]` - Hide D1 sync logs
   - `-[WebSocket]` - Hide WebSocket logs

Or use this regex filter:
```
/KOT|KDS|kitchen/i
```

## Debug Commands (Less Verbose)

### Silent check - just counts
```javascript
const { useKDSStore } = await import('./stores/kdsStore');
const { useAuthStore } = await import('./stores/authStore');
const tenantId = useAuthStore.getState().user?.tenantId;

// Check store
const storeCount = useKDSStore.getState().activeOrders.length;

// Check database
const { kdsOrderService } = await import('./lib/kdsOrderService');
const dbOrders = await kdsOrderService.getActiveOrders(tenantId);

console.log(`📊 KDS Status: Store=${storeCount}, Database=${dbOrders.length}`);
```

### Add a test order (silent)
```javascript
const { useKDSStore } = await import('./stores/kdsStore');
const testOrder = {
  id: 'test-' + Date.now(),
  orderNumber: 'TEST-' + Math.floor(Math.random() * 1000),
  orderType: 'dine-in',
  source: 'pos',
  status: 'pending',
  createdAt: new Date().toISOString(),
  acceptedAt: new Date().toISOString(),
  items: [{
    id: 'item-1',
    name: 'Test Dish',
    quantity: 1,
    status: 'pending',
    station: 'Main Kitchen',
    specialInstructions: null,
    modifiers: []
  }],
  tableNumber: 99,
  isUrgent: false,
  elapsedMinutes: 0,
  isRunningOrder: false,
  version: 1,
  updatedAt: new Date().toISOString()
};

useKDSStore.getState().addOrder(testOrder);
console.log('✅ Test order added. Check Kitchen Dashboard at table 99');
```

## Likely Root Causes (Based on SQLite Migration)

1. **BroadcastChannel is working but SQLite persistence is failing**
   - Orders show up briefly in store
   - Disappear after page refresh
   - Not in database

2. **kds_orders table wasn't created during migration**
   - Migration 005 didn't run
   - Need to manually create table

3. **tenantId is null or undefined**
   - Check: `useAuthStore.getState().user?.tenantId`
   - If null, login again

4. **Old localStorage data interfering**
   - Clear with Fix 1 above

## What to Share

If still not working, share this output:
```javascript
// Run this complete check
const { useKDSStore } = await import('./stores/kdsStore');
const { useAuthStore } = await import('./stores/authStore');
const { kdsOrderService } = await import('./lib/kdsOrderService');

const tenantId = useAuthStore.getState().user?.tenantId;
const storeOrders = useKDSStore.getState().activeOrders;

console.log('=== KOT/KDS STATUS ===');
console.log('Tenant ID:', tenantId || 'NULL/UNDEFINED ❌');
console.log('Store orders:', storeOrders.length);

if (tenantId) {
  const dbOrders = await kdsOrderService.getActiveOrders(tenantId);
  console.log('Database orders:', dbOrders.length);

  const db = await Database.load('sqlite:pos.db');
  const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table' AND name='kds_orders'`);
  console.log('kds_orders table exists:', tables.length > 0);
}
console.log('=====================');
```

Share the output of this check!
