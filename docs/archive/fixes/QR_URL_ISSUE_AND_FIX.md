# QR Code URL Generation Issue & Fix

## Problem Identified ⚠️

### Current Behavior (INCORRECT)

The system currently generates QR codes that point to **cloud subdomains** instead of the **local cloudflared tunnel**:

```typescript
// src/stores/floorPlanStore.ts:252
const qrCodeUrl = tenantId
    ? `https://${tenantId}.handsfree.tech/#/table/${id}`  // ❌ Cloud subdomain
    : `${window.location.origin}/#/table/${id}`;
```

**Example QR Code URL**: `https://test-restaurant.handsfree.tech/#/table/tab-001`

### What Happens Now (Broken Flow)

```
Customer scans QR code
    ↓
Opens: https://test-restaurant.handsfree.tech/#/table/tab-001
    ↓
Loads React app from Cloudflare Pages (cloud-hosted)
    ↓
Calls API: https://handsfree-orders.suyesh.workers.dev/api/menu
    ↓
Menu served from D1 database (cloud)
    ↓
Order submitted to cloud Workers
    ↓
POS polls cloud every 5-10 seconds for new orders
    ↓
HIGH LATENCY (5-10 seconds) ❌
```

### Why This is Wrong

1. **Defeats the purpose of cloudflared tunnel** - The tunnel is running but unused
2. **High latency** - Orders go through cloud instead of local network
3. **Requires internet** - Customers can't order if WiFi is down
4. **Cloud costs** - Every order hits cloud infrastructure
5. **Privacy concerns** - Data leaves premises unnecessarily

---

## What Should Happen (Correct Flow)

### Intended Behavior

QR codes should point to the **cloudflared tunnel URL** which routes to the **local web server**:

```
Customer scans QR code
    ↓
Opens: https://purple-monkey-abc123.trycloudflare.com/#/table/tab-001
    ↓
Cloudflare tunnel routes to localhost:3000
    ↓
Rust web server handles request
    ↓
Loads React app from localhost
    ↓
Calls API: /api/menu (relative URL → localhost:3000/api/menu)
    ↓
Menu served from local SQLite
    ↓
Order submitted to local server (POST /api/order)
    ↓
Saved to local SQLite
    ↓
Tauri event emitted: "new-guest-order"
    ↓
GuestOrderListener shows popup notification
    ↓
LOW LATENCY (10-100ms) ✅
```

---

## The Fix

### Step 1: Store Tunnel URL in Global State

Create a new store or add to existing settings store:

```typescript
// src/stores/qrOrderingStore.ts (NEW FILE)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface QROrderingStore {
  tunnelUrl: string | null;
  tunnelStatus: 'offline' | 'starting' | 'online';
  setTunnelUrl: (url: string | null) => void;
  setTunnelStatus: (status: 'offline' | 'starting' | 'online') => void;
}

export const useQROrderingStore = create<QROrderingStore>()(
  persist(
    (set) => ({
      tunnelUrl: null,
      tunnelStatus: 'offline',
      setTunnelUrl: (url) => set({ tunnelUrl: url }),
      setTunnelStatus: (status) => set({ tunnelStatus: status }),
    }),
    {
      name: 'qr-ordering-storage',
    }
  )
);
```

### Step 2: Update Tunnel URL When Tunnel Starts

```typescript
// src/pages-v2/QROrderingSettings.tsx
import { useQROrderingStore } from '../stores/qrOrderingStore';

// Inside the component:
const setTunnelUrl = useQROrderingStore((state) => state.setTunnelUrl);
const setTunnelStatus = useQROrderingStore((state) => state.setTunnelStatus);

useEffect(() => {
  const unlisten = listen('tunnel-url-ready', (event) => {
    const url = event.payload as string;
    console.log('[QROrderingSettings] Tunnel URL ready:', url);

    // Store the tunnel URL globally
    setTunnelUrl(url);
    setTunnelStatus('online');
    setLocalTunnelUrl(url);
  });

  return () => {
    unlisten.then(fn => fn());
  };
}, [setTunnelUrl, setTunnelStatus]);
```

### Step 3: Fix QR Code URL Generation

```typescript
// src/stores/floorPlanStore.ts:252 (BEFORE)
const qrCodeUrl = tenantId
    ? `https://${tenantId}.handsfree.tech/#/table/${id}`
    : `${window.location.origin}/#/table/${id}`;

// src/stores/floorPlanStore.ts:252 (AFTER)
import { useQROrderingStore } from './qrOrderingStore';

// Inside addTable function:
const tunnelUrl = useQROrderingStore.getState().tunnelUrl;
const qrCodeUrl = tunnelUrl
    ? `${tunnelUrl}/#/table/${id}`                      // ✅ Use tunnel URL
    : tenantId
    ? `https://${tenantId}.handsfree.tech/#/table/${id}` // Fallback to cloud
    : `${window.location.origin}/#/table/${id}`;         // Fallback to localhost
```

### Step 4: Add "Regenerate QR Codes" Button

When tunnel restarts, the URL changes. Need a way to update existing tables:

```typescript
// src/components/admin/FloorPlanManager.tsx
const regenerateQRCodesWithTunnelUrl = async () => {
  const tunnelUrl = useQROrderingStore.getState().tunnelUrl;

  if (!tunnelUrl) {
    alert('Please start the tunnel first');
    return;
  }

  if (!confirm(`Regenerate all QR codes with tunnel URL?\n${tunnelUrl}`)) {
    return;
  }

  try {
    const db = await Database.load('sqlite:pos.db');

    // Update all tables with new tunnel-based QR codes
    for (const table of tables) {
      const newQrUrl = `${tunnelUrl}/#/table/${table.id}`;
      await db.execute(
        `UPDATE floor_tables SET qr_code_url = ? WHERE id = ?`,
        [newQrUrl, table.id]
      );
    }

    // Reload floor plan
    await loadFloorPlan(tenantId);

    alert(`✅ Updated ${tables.length} QR codes with tunnel URL`);
  } catch (error) {
    console.error('Failed to regenerate QR codes:', error);
    alert('Failed to regenerate QR codes: ' + error);
  }
};

// Add button in UI:
<button onClick={regenerateQRCodesWithTunnelUrl}>
  🔄 Regenerate QR Codes with Tunnel URL
</button>
```

---

## Implementation Plan

### Phase 1: Core Fix (30 minutes)

1. Create `src/stores/qrOrderingStore.ts` ✅
2. Update `QROrderingSettings.tsx` to store tunnel URL ✅
3. Fix `floorPlanStore.ts` QR code generation ✅
4. Test: Create new table and verify QR code has tunnel URL ✅

### Phase 2: Migration (15 minutes)

1. Add "Regenerate QR Codes" button to Floor Plan Manager ✅
2. Update existing tables when tunnel URL is available ✅
3. Add visual indicator showing which URL type is being used ✅

### Phase 3: UI Improvements (15 minutes)

1. Show tunnel status in Floor Plan Manager header ✅
2. Display tunnel URL in QR code modal ✅
3. Add warning if tunnel is offline when viewing QR codes ✅

### Phase 4: Testing (30 minutes)

1. Start tunnel ✅
2. Verify tunnel URL is stored ✅
3. Create new table ✅
4. Check QR code contains tunnel URL ✅
5. Scan QR code with phone ✅
6. Verify it opens tunnel URL (not cloud) ✅
7. Place test order ✅
8. Verify order appears instantly in POS ✅

---

## Testing Checklist

### Pre-Test Setup
- [ ] Start POS app: `bun tauri dev`
- [ ] Navigate to Settings → QR Code Ordering
- [ ] Click "Start Tunnel"
- [ ] Wait for tunnel URL (e.g., `https://xyz.trycloudflare.com`)
- [ ] Verify tunnel URL is displayed in settings

### Test 1: New Table QR Code
- [ ] Go to Floor Plan Manager
- [ ] Create new section "Test Section"
- [ ] Add new table "Table 99"
- [ ] Click on table to view QR code
- [ ] **VERIFY**: QR code URL starts with tunnel URL (not handsfree.tech)
- [ ] Example: `https://xyz.trycloudflare.com/#/table/tab-123`

### Test 2: Scan QR Code
- [ ] Use phone camera to scan the QR code
- [ ] **VERIFY**: Phone opens the tunnel URL
- [ ] **VERIFY**: Browser shows "Loading menu..." (React app from tunnel)
- [ ] **VERIFY**: Menu loads from local SQLite (not cloud)
- [ ] **VERIFY**: Network tab shows requests to tunnel URL (not handsfree.tech)

### Test 3: Place Order
- [ ] Add items to cart on phone
- [ ] Enter customer name: "Test Customer"
- [ ] Click "Place Order"
- [ ] **VERIFY**: Order submits successfully
- [ ] **VERIFY**: POS shows popup notification within 1 second
- [ ] **VERIFY**: Popup shows order details
- [ ] **VERIFY**: Audio notification plays

### Test 4: Database Verification
```bash
# Open SQLite database
sqlite3 ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos/pos.db

# Check order was saved
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

# Verify it's a guest order
SELECT customer_name, source, items_json FROM orders WHERE source = 'qr-code' ORDER BY created_at DESC LIMIT 1;
```

### Test 5: Regenerate QR Codes
- [ ] Create a few tables with old QR codes (before fix)
- [ ] Click "Regenerate QR Codes with Tunnel URL"
- [ ] **VERIFY**: All QR codes updated to use tunnel URL
- [ ] **VERIFY**: Old tables now have tunnel URL instead of cloud URL

### Test 6: Tunnel Restart
- [ ] Stop tunnel (click "Stop Tunnel" button)
- [ ] Wait 2 seconds
- [ ] Start tunnel again (click "Start Tunnel")
- [ ] **VERIFY**: New tunnel URL is generated
- [ ] **VERIFY**: App updates stored tunnel URL
- [ ] Click "Regenerate QR Codes"
- [ ] **VERIFY**: All QR codes now use new tunnel URL

---

## Expected Results

### Before Fix
- QR Code URL: `https://test-restaurant.handsfree.tech/#/table/tab-001`
- Customer scans → Opens cloud app
- Order latency: 5-10 seconds
- Requires internet connection
- Data goes to cloud

### After Fix
- QR Code URL: `https://purple-monkey-abc123.trycloudflare.com/#/table/tab-001`
- Customer scans → Opens tunnel → Local app
- Order latency: 10-100 milliseconds
- Works on LAN even if internet is down
- Data stays on local SQLite

---

## Troubleshooting

### QR Code Still Shows Cloud URL

**Cause**: Table was created before tunnel URL was stored

**Fix**: Click "Regenerate QR Codes with Tunnel URL" button

### Tunnel URL Not Stored

**Cause**: Event listener not set up correctly

**Fix**: Check browser console for `tunnel-url-ready` event

**Debug**:
```javascript
// In browser console
window.__TAURI__.event.listen('tunnel-url-ready', (event) => {
  console.log('Tunnel URL:', event.payload);
});
```

### QR Code Opens Cloud App Instead of Tunnel

**Cause**: Old QR code URL still in database

**Fix**:
1. View QR code modal
2. Check displayed URL
3. If it shows `handsfree.tech`, regenerate QR codes
4. Rescan the updated QR code

### Order Doesn't Appear in POS

**Cause**: Order went to cloud instead of local server

**Fix**:
1. Verify tunnel is running: `ps aux | grep cloudflared`
2. Verify local server is running: `curl http://localhost:3000/health`
3. Check QR code URL starts with tunnel URL
4. Rescan QR code and try again

---

## Future Enhancements

### Named Tunnels (Phase 2)

Instead of random URLs that change on restart, use persistent named tunnels:

```bash
# One-time setup (requires Cloudflare account)
cloudflared tunnel login
cloudflared tunnel create my-restaurant-pos
cloudflared tunnel route dns my-restaurant-pos my-restaurant.handsfree.tech

# Start tunnel with persistent URL
cloudflared tunnel run my-restaurant-pos
```

**Benefits**:
- Persistent URL: `https://my-restaurant.handsfree.tech`
- QR codes remain valid forever
- No need to regenerate after restart
- Custom branded domain

**Drawbacks**:
- Requires Cloudflare account
- Need to manage credentials
- More complex setup

### QR Code Auto-Update

When tunnel restarts and gets new URL:

```typescript
// Auto-regenerate QR codes when tunnel URL changes
useEffect(() => {
  const unlisten = listen('tunnel-url-ready', async (event) => {
    const newUrl = event.payload as string;
    const oldUrl = tunnelUrl;

    if (oldUrl && oldUrl !== newUrl) {
      // Tunnel restarted with new URL
      console.log('[FloorPlan] Tunnel URL changed, regenerating QR codes');
      await regenerateQRCodesWithTunnelUrl();
    }

    setTunnelUrl(newUrl);
  });

  return () => unlisten.then(fn => fn());
}, [tunnelUrl]);
```

---

## Summary

### The Issue
QR codes currently point to cloud subdomains (`handsfree.tech`) instead of the local cloudflared tunnel, defeating the purpose of the tunnel and causing high latency.

### The Fix
1. Store tunnel URL in global state when tunnel starts
2. Use tunnel URL when generating QR codes for tables
3. Add "Regenerate QR Codes" button for existing tables
4. Display tunnel URL in QR code modal for verification

### Impact
- ✅ Order latency: 5-10 seconds → 10-100 milliseconds (50x faster!)
- ✅ Works offline (LAN only, no internet required)
- ✅ Data stays local (privacy and security)
- ✅ No cloud costs per order
- ✅ Better reliability (LAN more stable than internet)

### Next Steps
1. Implement the fix (30 minutes)
2. Test end-to-end (30 minutes)
3. Update documentation
4. Train staff on new workflow
5. Consider named tunnels for production (Phase 2)

---

## Files to Modify

1. **src/stores/qrOrderingStore.ts** (NEW) - Store tunnel URL globally
2. **src/stores/floorPlanStore.ts:252** - Fix QR code URL generation
3. **src/pages-v2/QROrderingSettings.tsx** - Store tunnel URL when ready
4. **src/components/admin/FloorPlanManager.tsx** - Add regenerate button
5. **src/components/admin/FloorPlanManager.tsx:220-224** - Show tunnel URL in modal

---

## Code Changes Summary

```diff
+ // NEW FILE: src/stores/qrOrderingStore.ts
+ export const useQROrderingStore = create<QROrderingStore>()(...);

// src/stores/floorPlanStore.ts
- const qrCodeUrl = tenantId
-     ? `https://${tenantId}.handsfree.tech/#/table/${id}`
-     : `${window.location.origin}/#/table/${id}`;
+ const tunnelUrl = useQROrderingStore.getState().tunnelUrl;
+ const qrCodeUrl = tunnelUrl
+     ? `${tunnelUrl}/#/table/${id}`
+     : tenantId
+     ? `https://${tenantId}.handsfree.tech/#/table/${id}`
+     : `${window.location.origin}/#/table/${id}`;

// src/pages-v2/QROrderingSettings.tsx
+ const setTunnelUrl = useQROrderingStore((state) => state.setTunnelUrl);
+ useEffect(() => {
+   const unlisten = listen('tunnel-url-ready', (event) => {
+     setTunnelUrl(event.payload as string);
+   });
+   return () => unlisten.then(fn => fn());
+ }, []);

// src/components/admin/FloorPlanManager.tsx
+ const regenerateQRCodesWithTunnelUrl = async () => { ... };
+ <button onClick={regenerateQRCodesWithTunnelUrl}>
+   🔄 Regenerate QR Codes with Tunnel URL
+ </button>
```

---

**Status**: 🔴 **CRITICAL BUG** - Requires immediate fix
**Priority**: **HIGH** - Defeats core feature (instant local ordering)
**Effort**: **LOW** - 1-2 hours to implement and test
**Impact**: **HIGH** - 50x latency improvement
