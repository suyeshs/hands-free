# Test Cloud Sync with Current Tenant

Quick guide to test the cloud sync implementation with your current tenant.

## Prerequisites

✅ Worker deployed to `https://handsfree-orders.suyesh.workers.dev`
✅ Cloudflare API token configured in worker secrets
✅ POS app running with activated tenant

## Method 1: Via POS UI (Recommended)

### 1. Open POS App

```bash
# Make sure app is running
npm run dev
# or if using Tauri
npm run tauri dev
```

### 2. Navigate to Cloud Sync Settings

```
Settings → Cloud Sync
```

### 3. Enable Cloud Sync

1. Click **"Enable Cloud Sync"** button
2. Watch the progress dialog:
   - ✅ Extracting database schema
   - ✅ Creating cloud database
   - ✅ Starting initial sync
3. Wait for completion (~2-5 minutes depending on data size)

### 4. Verify Sync

1. Status should show **"Synced X minutes ago"**
2. Click **"Sync Now"** to trigger manual sync
3. Check D1 database in Cloudflare Dashboard

---

## Method 2: Via Browser Console

### 1. Open DevTools Console

Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)

### 2. Check Current Tenant

```javascript
// Check tenant info
const tenantId = localStorage.getItem('tenant:id');
console.log('Tenant ID:', tenantId);

// Check if D1 is already provisioned
const isProvisioned = localStorage.getItem(`d1:${tenantId}:provisioned`);
console.log('D1 Provisioned:', isProvisioned === 'true');

// Check if cloud sync is enabled
const isSyncEnabled = localStorage.getItem('sync:d1:enabled');
console.log('Cloud Sync Enabled:', isSyncEnabled === 'true');
```

### 3. Test D1 Provisioning Service

```javascript
// Import service
const { d1ProvisioningService } = await import('./src/services/d1ProvisioningService');
const { invoke } = await import('@tauri-apps/api/core');

// Get tenant ID
const tenantId = localStorage.getItem('tenant:id') || 'test-restaurant';
const dbPath = `${tenantId}.db`;

// Check status
const status = await d1ProvisioningService.checkStatus(tenantId);
console.log('D1 Status:', status);

// If not provisioned, provision now
if (!status.provisioned) {
  console.log('📦 Starting D1 provisioning...');

  const result = await d1ProvisioningService.provisionD1(
    tenantId,
    dbPath,
    (progress) => {
      console.log(`${progress.message} - ${progress.progress}%`);
    }
  );

  console.log('Provisioning result:', result);
}
```

### 4. Test Initial Sync

```javascript
// Import services
const { createInitialD1Sync } = await import('./src/services/sync/InitialD1Sync');

// Get tenant ID
const tenantId = localStorage.getItem('tenant:id');

// Perform initial sync
console.log('🔄 Starting initial sync...');
const initialSync = createInitialD1Sync(tenantId, (progress) => {
  console.log(`[${progress.step}] ${progress.message} - ${progress.progress}%`);
  if (progress.currentDataType) {
    console.log(`  → Syncing ${progress.currentDataType}`);
  }
});

const syncResult = await initialSync.performInitialSync();
console.log('Initial sync result:', syncResult);
```

### 5. Test Manual Sync

```javascript
// Import service
const { createD1SyncService } = await import('./src/services/sync/D1SyncService');

// Get tenant ID
const tenantId = localStorage.getItem('tenant:id');

// Create sync service
const syncService = createD1SyncService(tenantId);

// Sync individual data types
console.log('🔄 Syncing sales...');
const salesResult = await syncService.syncSalesToD1();
console.log('Sales sync result:', salesResult);

console.log('🔄 Syncing menu...');
const menuResult = await syncService.syncMenuToD1();
console.log('Menu sync result:', menuResult);

console.log('🔄 Syncing staff...');
const staffResult = await syncService.syncStaffToD1();
console.log('Staff sync result:', staffResult);

// Or sync all at once
console.log('🔄 Syncing all data...');
const results = await Promise.all([
  syncService.syncSalesToD1(),
  syncService.syncTipsToD1(),
  syncService.syncMenuToD1(),
  syncService.syncStaffToD1(),
  syncService.syncSettingsToD1(),
  syncService.syncFloorPlanToD1(),
  syncService.syncBarInventoryToD1(),
]);

const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
console.log(`✅ Synced ${totalSynced} records, ${totalFailed} failed`);
```

### 6. Test Tiered Sync Manager

```javascript
// Import service
const { getTieredSyncManager } = await import('./src/services/sync/TieredSyncManager');

// Get tenant ID
const tenantId = localStorage.getItem('tenant:id');

// Get or create sync manager
const syncManager = getTieredSyncManager(tenantId);

// Enable D1 sync
syncManager.enableD1Sync(tenantId);

// Start background sync
await syncManager.start();
console.log('✅ Tiered sync manager started');

// Check status
const status = syncManager.getStatus();
console.log('Sync manager status:', status);

// Check D1 sync status
const d1Status = await syncManager.getD1SyncStatus();
console.log('D1 sync status:', d1Status);

// Trigger immediate sync for specific data type
await syncManager.triggerImmediateSync('sales');
console.log('✅ Immediate sales sync triggered');
```

---

## Method 3: Via Wrangler CLI

### 1. Check D1 Status

```bash
# List all D1 databases
wrangler d1 list

# Should see: <tenant-id>_db
```

### 2. Query D1 Database

```bash
# Get tenant ID from localStorage or settings
TENANT_ID="your-tenant-id"

# Query sales
wrangler d1 execute ${TENANT_ID}_db \
  --remote \
  --command "SELECT COUNT(*) as count FROM sales_transactions"

# Query recent sales
wrangler d1 execute ${TENANT_ID}_db \
  --remote \
  --command "SELECT * FROM sales_transactions ORDER BY completed_at DESC LIMIT 5"

# Query menu items
wrangler d1 execute ${TENANT_ID}_db \
  --remote \
  --command "SELECT COUNT(*) as count FROM menu_items"

# Query staff
wrangler d1 execute ${TENANT_ID}_db \
  --remote \
  --command "SELECT id, name, role FROM staff_users LIMIT 10"
```

### 3. Check Worker Logs

```bash
# View real-time logs
cd workers/handsfree-orders
npm run tail

# Or
wrangler tail
```

---

## Expected Results

### After D1 Provisioning:

✅ D1 database created: `<tenant-id>_db`
✅ Schema applied (15-45 tables depending on features)
✅ Metadata stored in KV
✅ localStorage updated: `d1:<tenant-id>:provisioned = true`

### After Initial Sync:

✅ All existing data synced to D1
✅ Progress: 100%
✅ localStorage updated: `d1:<tenant-id>:initial_sync_complete = true`
✅ Sync timestamps stored for each data type

### During Ongoing Sync:

✅ Tier 1 (sales, tips): syncs every 1 minute
✅ Tier 2 (staff, payouts): syncs every 3 minutes
✅ Tier 3 (menu, settings): syncs every 10 minutes
✅ Tier 4 (inventory): syncs every 30 minutes

---

## Verification Checklist

### 1. D1 Database Created
- [ ] Check Cloudflare Dashboard → D1 Databases
- [ ] Should see: `<tenant-id>_db`
- [ ] Table count matches local SQLite

### 2. Data Synced
- [ ] Query sales_transactions: should have records
- [ ] Query menu_items: should match local menu
- [ ] Query staff_users: should match local staff

### 3. Sync Status
- [ ] Settings → Cloud Sync shows "Synced X minutes ago"
- [ ] Last sync timestamp updates every minute
- [ ] "Sync Now" button works

### 4. Background Sync Works
- [ ] Create new sale in POS
- [ ] Wait 1 minute
- [ ] Query D1: new sale should appear
- [ ] Console shows: "[TieredSync] D1 sales synced: 1 records"

### 5. Error Handling
- [ ] Disconnect internet
- [ ] Create sale
- [ ] Reconnect internet
- [ ] Sale should sync within 1 minute

---

## Troubleshooting

### D1 Not Provisioning

**Check:**
1. Worker deployed: `wrangler whoami`
2. API token set: `wrangler secret list`
3. Worker logs: `wrangler tail`
4. Browser console for errors

**Common Issues:**
- Missing `CLOUDFLARE_API_TOKEN` secret
- Incorrect `CLOUDFLARE_ACCOUNT_ID` in wrangler.jsonc
- D1 not enabled on account (requires paid plan)

### Sync Not Working

**Check:**
1. D1 is provisioned: `localStorage.getItem('d1:<tenant-id>:provisioned')`
2. Sync is enabled: `localStorage.getItem('sync:d1:enabled')`
3. TieredSyncManager is running
4. Worker logs for errors

**Common Issues:**
- Table schema mismatch (re-provision D1)
- Network errors (check internet connection)
- Worker errors (check `wrangler tail`)

### Data Not Appearing

**Check:**
1. Wait 1 minute (Tier 1 sync interval)
2. Check worker logs for sync requests
3. Query D1 directly via wrangler
4. Verify tenant ID matches

---

## Quick Test Commands

Copy and paste into browser console:

```javascript
// Quick test: Full flow
(async () => {
  const tenantId = localStorage.getItem('tenant:id');
  console.log('🏪 Tenant:', tenantId);

  // Check D1 status
  const { d1ProvisioningService } = await import('./src/services/d1ProvisioningService');
  const status = await d1ProvisioningService.checkStatus(tenantId);
  console.log('📊 D1 Status:', status);

  if (status.provisioned) {
    console.log('✅ D1 is provisioned!');

    // Test manual sync
    const { createD1SyncService } = await import('./src/services/sync/D1SyncService');
    const syncService = createD1SyncService(tenantId);

    console.log('🔄 Testing sales sync...');
    const result = await syncService.syncSalesToD1();
    console.log('✅ Synced:', result.synced, 'Failed:', result.failed);
  } else {
    console.log('⚠️ D1 not provisioned. Go to Settings → Cloud Sync to enable.');
  }
})();
```

---

## Success Criteria

✅ D1 database created in Cloudflare
✅ All local data synced to D1
✅ Background sync running every 1-30 minutes
✅ Manual "Sync Now" works
✅ New sales appear in D1 within 1 minute
✅ Offline mode works (queues syncs)
✅ No errors in console or worker logs

🎉 **If all checks pass, cloud sync is working!**
