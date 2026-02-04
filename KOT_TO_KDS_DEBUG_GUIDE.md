# KOT to Kitchen Display Debug Guide

## Issue
KOT is being sent from POS but not showing up in the Kitchen Display System (KDS).

## Debug Steps

### Step 1: Check Console Logs When Sending KOT

1. **Open browser console** (F12 or Cmd+Option+I)
2. **Go to POS page** and add items to cart
3. **Click "SEND KOT"**
4. **Check for these logs**:

```
[POSDashboard] Sending KOT to kitchen...
[POSStore] Saving table X session: Y items
[POSStore] ✓ Table session persisted to SQLite
[POSStore] 🏃 Running order detected - Table X, KOT #1  (if running order)
[KDSStore] Adding order: KOT-XXX v1
[POSStore] ✓ KOT sent to kitchen (auto-print disabled)
  OR
[POSStore] ✓ KOT printed successfully
[POSDashboard] ✓ KOT sent successfully!
```

### Step 2: Check for Errors

Look for any error messages in the console:
- `[POSStore] Failed to send to KDS/Printer:`
- `[KDSStore] Rejecting stale order:`
- Any other error messages

### Step 3: Verify KDS Store State

In the browser console, run:
```javascript
// Check if orders are in KDS store
console.log('Active orders:', window.__ZUSTAND__?.kds?.activeOrders || 'Not available');

// Or access the store directly
import { useKDSStore } from './stores/kdsStore';
console.log('Active orders:', useKDSStore.getState().activeOrders);
```

### Step 4: Check Kitchen Dashboard

1. **Navigate to Kitchen Dashboard** (/kitchen route)
2. **Check if orders appear there**
3. **Check station filter** - make sure "All Stations" is selected
4. **Look for the order count** at the top

### Common Issues

#### Issue 1: Order is Stale
**Symptom:** Log shows `[KDSStore] Rejecting stale order`
**Solution:** The order timestamp is too old. Check your system time.

#### Issue 2: Auto-print is Disabled
**Symptom:** Log shows `[POSStore] ✓ KOT sent to kitchen (auto-print disabled)`
**Solution:** This is normal - the order should still appear in KDS even without printing.

#### Issue 3: Order Already Exists
**Symptom:** Log shows `[KDSStore] Skipping duplicate/older order`
**Solution:** The order is already in the KDS with the same or higher version number.

#### Issue 4: Station Filter
**Symptom:** Orders don't show in Kitchen Dashboard
**Solution:** Check if the station filter is set to a specific station that doesn't match your items.

### Step 5: Check Order Transformation

The POS order is transformed to a Kitchen order. Check the transformation:

In browser console after sending KOT:
```javascript
// This should show the transformed order
// Look for the last KitchenOrder added to KDS
```

### Step 6: Check Multi-Tab Sync

If you have Kitchen Dashboard open in another tab/window:
1. Check if the order appears there
2. Look for `(from tab sync)` in console logs
3. The BroadcastChannel should sync orders across tabs

### Manual Fix

If orders are stuck, you can manually clear the KDS store:

```javascript
// In browser console
localStorage.removeItem('kds-orders');
window.location.reload();
```

## Expected Flow

1. POS: User clicks "SEND KOT"
2. POS Store: Creates KOT order → transforms to Kitchen order
3. KDS Store: Adds order to activeOrders array
4. KDS Store: Persists to SQLite
5. KDS Store: Broadcasts to other tabs
6. Kitchen Dashboard: Displays order in real-time

## Quick Test

To test if KDS is working at all:

1. Go to Kitchen Dashboard (/kitchen)
2. Open console
3. Run:
```javascript
import { useKDSStore } from './stores/kdsStore';
useKDSStore.getState().addOrder({
  id: 'test-' + Date.now(),
  orderNumber: 'TEST-001',
  createdAt: new Date().toISOString(),
  acceptedAt: new Date().toISOString(),
  items: [
    {
      id: 'item-1',
      name: 'Test Item',
      quantity: 1,
      status: 'pending',
      station: 'Main Kitchen'
    }
  ],
  status: 'pending',
  tableNumber: 5,
  orderType: 'dine-in',
  version: 1
});
```

If this test order appears, then KDS is working and the issue is with the order creation/transformation in POS.

## Files to Check

- **POS Order Creation**: `src/stores/posStore.ts` (line 920-1153)
- **Order Transformation**: `src/lib/orderTransformations.ts`
- **KDS Store**: `src/stores/kdsStore.ts` (line 135-200)
- **Kitchen Dashboard**: `src/pages-v2/KitchenDashboard.tsx`

## Need More Help?

Share the console logs when sending a KOT, including:
1. All logs from [POSStore]
2. All logs from [KDSStore]
3. Any error messages
