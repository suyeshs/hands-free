# Subscription Sync Testing Guide

This guide helps you verify that subscription data is syncing correctly from your local POS to the cloud D1 database.

## Quick Start

### 1. Import Subscription Menu (Required First Step)

Before testing sync, you need data in your local database:

1. Open your POS application
2. Navigate to **Subscriptions → Menu Importer**
3. Click **"Import Default Menu (150+ items)"**
4. Wait for import to complete (should see ✅ success message)

### 2. Run Sync Test

You can test the sync in two ways:

#### Option A: Using the UI Component (Recommended)

1. Add the sync tester to your app:
```tsx
import { SubscriptionSyncTester } from '@/components/subscriptions';

// In your page/component:
<SubscriptionSyncTester />
```

2. Click **"Run Sync Test"** button
3. Watch the progress as it runs through 6 test steps
4. Review the results (all should show ✅ green checkmarks)

#### Option B: Using the Browser Console

1. Open DevTools Console (F12)
2. Run:
```javascript
import { testSubscriptionSync, displaySyncTestResults } from './scripts/testSubscriptionSync';

const results = await testSubscriptionSync();
displaySyncTestResults(results);
```

## What the Test Checks

The sync test runs through 6 comprehensive steps:

### Step 1: Local Data Check ✅
- Verifies subscription plans exist in local SQLite database
- If fails: Import menu data first using Menu Importer

### Step 2: Fetch Local Plans ✅
- Retrieves all subscription plans from local database
- Shows plan IDs and names
- If fails: Database connection issue

### Step 3: Cloud API Connectivity ✅
- Tests connection to `https://restaurant.guanix.com/api`
- Checks if cloud API is reachable
- If fails: Network issue or worker not deployed

### Step 4: Sync Plans to Cloud ✅
- Sends subscription plans to cloud via POST request
- Uses `/subscriptions/plans/sync` endpoint
- If fails: Authentication or worker configuration issue

### Step 5: Verify Cloud D1 Data ✅
- Fetches plans from cloud to confirm they were saved
- Compares local vs cloud plan counts
- If fails: Data didn't persist in D1 database

### Step 6: Sync Cuisine Types ✅
- Tests syncing of cuisine type definitions
- Ensures all data types sync correctly
- If fails: Schema mismatch or API issue

## Understanding Test Results

### All Tests Passed ✅✅✅

```
✅ Step 1: Local Data Check
   Found 3 subscription plans in local database

✅ Step 2: Fetch Local Plans
   Retrieved 3 plans from local database

✅ Step 3: Cloud API Connectivity
   Cloud API is reachable. Found 3 plans in cloud

✅ Step 4: Sync Plans to Cloud
   Synced 3 plans, 0 failed

✅ Step 5: Verify Cloud D1 Data
   ✅ All 3 local plans are synced to cloud D1

✅ Step 6: Sync Cuisine Types
   Synced 5 cuisine types

═══════════════════════════════════════
✅✅✅ ALL TESTS PASSED ✅✅✅
```

**Meaning:** Your subscription sync is working perfectly! Data flows from POS → Cloud D1.

### Some Tests Failed ❌

If you see failures, check these common issues:

#### ❌ Step 1 Failed: "No subscription plans found in local database"

**Problem:** No data to sync

**Solution:**
```bash
# Import the subscription menu first
1. Open Menu Importer
2. Click "Import Default Menu"
3. Wait for import to complete
4. Run sync test again
```

#### ❌ Step 3 Failed: "Failed to connect to cloud API"

**Problem:** Cannot reach cloud worker

**Solution:**
```bash
# Check worker deployment
cd workers/tenant-router/tenant-worker
wrangler deploy

# Verify worker URL
curl https://restaurant.guanix.com/api/subscriptions/plans
```

#### ❌ Step 4 Failed: "Sync failed with 401"

**Problem:** Authentication issue

**Solution:**
- Verify tenant ID is correct in settings
- Check that `X-Tenant-Id` header is being sent
- Ensure worker has correct tenant configuration

#### ❌ Step 5 Failed: "Some plans missing in cloud"

**Problem:** Data didn't persist to D1

**Solution:**
```bash
# Check D1 database
wrangler d1 execute handsfree-tenants --command "SELECT COUNT(*) FROM subscription_plans"

# View D1 logs
wrangler tail --name handsfree-tenants
```

## Manual Verification

### Check Local Database

```typescript
// In browser console or Tauri command
import { invoke } from '@tauri-apps/api/core';

const plans = await invoke('query_sqlite', {
  dbPath: 'path/to/handsfree.db',
  query: 'SELECT * FROM subscription_plans',
  params: []
});

console.log('Local plans:', plans);
```

### Check Cloud D1 Database

```bash
# Using wrangler CLI
wrangler d1 execute handsfree-tenants \
  --command "SELECT * FROM subscription_plans WHERE tenant_id = 'your-tenant-id'"

# Should output:
# id | tenant_id | name | price_per_week | meals_per_week | ...
# plan-1 | tenant-123 | 5-Day Weekday Plan | 1500 | 5 | ...
```

### Check API Response

```bash
# Test GET endpoint
curl -X GET https://restaurant.guanix.com/api/subscriptions/plans \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: your-tenant-id"

# Should return:
# {
#   "success": true,
#   "tenantId": "your-tenant-id",
#   "plans": [
#     { "id": "plan-1", "name": "5-Day Weekday Plan", ... }
#   ]
# }
```

## Troubleshooting

### Sync Takes Too Long

If sync appears stuck:

1. Check browser network tab for failed requests
2. Look for CORS errors in console
3. Verify worker is deployed and running
4. Check D1 database quota limits

### Data Not Appearing in Theme

Even if sync succeeds, data might not show in customer-facing theme:

1. Ensure weekly menu is **published** (not just created)
   ```sql
   UPDATE subscription_menu_weeks SET published = 1 WHERE id = 'week-id';
   ```

2. Verify theme is fetching from correct API endpoint
   ```typescript
   // Theme should call
   GET /api/subscriptions/weeks?published=true
   ```

3. Check theme worker deployment
   ```bash
   cd workers/theme-edge-worker
   wrangler deploy
   ```

### Performance Issues

For large datasets (1000+ items):

1. **Enable batching** - Already configured in sync configs:
   ```typescript
   batchSize: 50 // Plans/Weeks
   batchSize: 100 // Menu items
   ```

2. **Check sync duration** - Monitor in test results:
   ```
   Synced 150 items in 2.3 seconds ✅
   Synced 150 items in 45 seconds ⚠️ (too slow)
   ```

3. **Optimize queries** - Add indexes if needed

## Next Steps After Successful Sync

Once all tests pass:

### 1. Set Up Automatic Sync

```typescript
// Initialize subscription sync service
import { SubscriptionPluginSync } from '@/plugins/subscription-meals/sync/SubscriptionPluginSync';

const subscriptionSync = new SubscriptionPluginSync(
  tenantId,
  dbPath,
  'https://restaurant.guanix.com/api'
);

await subscriptionSync.initialize();
```

### 2. Trigger Sync After Changes

```typescript
// After creating a weekly menu
await createWeeklyMenu(weekData);

// Trigger sync
const syncManager = getTieredSyncManager();
await syncManager.triggerPluginSync('subscription-meals');
```

### 3. Monitor Sync Status

```typescript
// Get sync status
const status = await pluginSyncRegistry.getStatus('subscription-meals');

console.log('Last sync:', status.lastSync);
console.log('Record count:', status.recordCount);
```

### 4. Update Theme to Fetch Real Data

Replace hardcoded subscription data in theme with API calls:

```typescript
// In coorg-subscription.ts
async function fetchWeeklyMenus() {
  const response = await fetch('/api/subscriptions/weeks?published=true');
  const data = await response.json();
  return data.weeks;
}
```

## Testing Checklist

- [ ] Imported subscription menu successfully
- [ ] Ran sync test - all 6 steps passed
- [ ] Verified data in cloud D1 database
- [ ] Tested API endpoints return correct data
- [ ] Published at least one weekly menu
- [ ] Confirmed theme displays weekly menus
- [ ] Tested customer subscription flow
- [ ] Verified delivery scheduling works

## Support

If sync still doesn't work after following this guide:

1. **Check logs:**
   ```bash
   # Worker logs
   wrangler tail --name handsfree-tenants

   # Desktop logs (DevTools Console)
   [SubscriptionPluginSync] Syncing plans...
   ```

2. **Review error messages** in test results

3. **Verify schema matches** between local SQLite and cloud D1:
   ```bash
   # Local
   .schema subscription_plans

   # Cloud
   wrangler d1 execute handsfree-tenants --command ".schema subscription_plans"
   ```

4. **Report issue** with full test output and error logs

## Summary

The subscription sync system provides:

- ✅ Automatic table creation on fresh installs
- ✅ Comprehensive sync testing UI
- ✅ Detailed error reporting
- ✅ Manual and automatic sync options
- ✅ Data verification between local and cloud
- ✅ Multi-tenant isolation in cloud D1

Your subscription data should now sync reliably from desktop POS to cloud, making it available for customer-facing ordering themes!
