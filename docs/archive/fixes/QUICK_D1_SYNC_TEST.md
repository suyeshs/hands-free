# Quick D1 Sync Testing with Mock Data

You asked for a quick way to test D1 sync without going through the full POS flow. Here are **two methods** to test using mock aggregator orders and sales.

---

## Method 1: Visual UI Test (Recommended)

### Access the Test Page

1. Start the app in dev mode:
   ```bash
   bun tauri dev
   ```

2. Login as Manager/Owner

3. Navigate to the test page:
   ```
   /#/d1-sync-test
   ```

### Run Tests

The test page provides several options:

#### Quick Full Test (One Click)
1. Click **"Run Full Test"** button
2. This will:
   - Check local database status
   - Generate 5 mock sales transactions
   - Generate 3 mock aggregator orders
   - Sync to D1
   - Show detailed results

#### Individual Tests
- **Generate Mock Sales** - Creates 5 test sales in local DB
- **Generate Mock Aggregator Orders** - Creates 3 test orders
- **Test Sync** - Triggers D1 sync manually
- **Check Local Data** - Shows current DB stats
- **Check Sync Status** - Queries D1 sync service status
- **Clear Test Data** - Removes all test records (safe)

### What Gets Created

**Mock Sales:**
- Invoice numbers: `TEST-INV-{timestamp}-{index}`
- IDs: `test-sale-{timestamp}-{index}`
- Random amounts between Rs.200-1200
- Various payment methods (cash/card/upi)
- Table numbers 1-20

**Mock Aggregator Orders:**
- Order numbers: `AGG-{timestamp}-{index}`
- IDs: `test-agg-{timestamp}-{index}`
- Random Swiggy/Zomato orders
- Amounts between Rs.300-1100
- Delivery orders with mock customer data

### View Results

All test results appear in expandable cards showing:
- ✅ Success status
- 🔄 Running status
- ❌ Error status
- Detailed JSON data (click "View Details")

---

## Method 2: CLI Script (Fastest)

For quick command-line testing without UI.

### Setup

1. Set your tenant ID:
   ```bash
   export TENANT_ID="your-tenant-id-here"
   ```

   To find your tenant ID:
   ```bash
   # In app, open dev tools console and run:
   localStorage.getItem('tenant_id')
   ```

### Run Tests

#### Full Test (Generate + Sync)
```bash
bun run test-d1-sync.ts test
```

This will:
1. Check local database stats
2. Generate 5 mock sales
3. Sync to D1
4. Show updated stats

#### Generate Mock Data Only
```bash
# Generate 5 sales (default)
bun run test-d1-sync.ts generate

# Generate custom amount
bun run test-d1-sync.ts generate 10
```

#### Check Database Stats
```bash
bun run test-d1-sync.ts check
```

Shows:
- Total sales count
- Test sales count
- 5 most recent sales

#### Sync Existing Test Data
```bash
bun run test-d1-sync.ts sync
```

Syncs all existing test sales to D1.

#### Clean Up Test Data
```bash
bun run test-d1-sync.ts cleanup
```

Removes all test records (prefixed with `test-` or `TEST-`).

---

## Verify D1 Sync

### In Browser Console

After running tests, check console for:

```
[SalesTransactionService] Recorded sale: TEST-INV-...
[OrderSyncService] Sale completed broadcast: TEST-INV-... 1500
[TieredSync] Syncing sales...
[D1Sync] Sales sync complete: {synced: 5, failed: 0, errors: []}
```

### Query D1 Database Directly

```sql
-- Check if test sales are in D1
SELECT * FROM sales_transactions
WHERE invoice_number LIKE 'TEST-%'
ORDER BY completed_at DESC
LIMIT 10;

-- Count synced sales
SELECT COUNT(*) as synced_count
FROM sales_transactions
WHERE tenant_id = 'your-tenant-id';
```

### Check WebSocket Connection

In browser console:
```javascript
// Import the service
import { orderSyncService } from './lib/orderSyncService';

// Check connection status
const status = orderSyncService.getDetailedStatus();
console.log('WebSocket Status:', status);

// Should show:
// cloud: { status: "connected", reconnectAttempts: 0 }
```

---

## Testing Scenarios

### Scenario 1: Immediate Sync Test
```bash
# Terminal 1: Generate data
bun run test-d1-sync.ts generate 3

# In app: Watch console for immediate sync
# Should see broadcast within 1-2 seconds

# Terminal 2: Check D1 (after 3-5 seconds)
# Query your D1 database for TEST-* sales
```

### Scenario 2: Batch Sync Test
```bash
# Terminal: Generate data
bun run test-d1-sync.ts generate 10

# Wait 60 seconds (batch sync interval)

# Check console for:
# [TieredSync] Syncing sales...
# [D1Sync] Sales sync complete: {synced: 10, ...}
```

### Scenario 3: Offline Resilience Test
```bash
# 1. Disconnect network
# 2. In UI: Generate mock sales
# 3. Check console for queue message
# 4. Reconnect network
# 5. Wait 60 seconds
# 6. Verify batch sync caught missed sales
```

---

## Troubleshooting

### Issue: "No tenant ID found"

**Solution:**
```bash
# Set environment variable
export TENANT_ID="your-actual-tenant-id"

# Or edit test-d1-sync.ts and hardcode it:
const TENANT_ID = "your-tenant-id-here";
```

### Issue: "WebSocket not connected"

**Solution:**
1. Check `VITE_ORDERS_ENDPOINT` in .env
2. Verify worker is deployed
3. Check tenant is activated
4. See [TEST_D1_SYNC.md](TEST_D1_SYNC.md) for detailed troubleshooting

### Issue: "Table not found"

**Solution:**
The app needs to be opened at least once to run migrations:
```bash
bun tauri dev
# Wait for app to fully load
# Then close and run CLI tests
```

### Issue: Sync fails with HTTP 500

**Solution:**
1. Check worker logs in Cloudflare dashboard
2. Verify D1 database ID is correct in tenant_config
3. Check D1 database permissions
4. See worker error logs for specific issue

---

## Performance Expectations

### Immediate Sync (WebSocket)
- **Latency:** < 1 second
- **When:** Sale completed
- **Requires:** WebSocket connected

### Batch Sync (Fallback)
- **Frequency:** Every 60 seconds
- **Batch Size:** 500 records max
- **Requires:** Cloud sync enabled

### Test Data Volume
- **5 mock sales:** ~10-15 KB data
- **Sync time:** < 1 second (immediate) or 60s (batch)
- **D1 write:** < 100ms per batch

---

## Clean Up

### Remove All Test Data

**In UI:**
- Click "Clear Test Data" button

**In CLI:**
```bash
bun run test-d1-sync.ts cleanup
```

**Manual SQL:**
```sql
DELETE FROM sales_transactions
WHERE id LIKE 'test-sale-%' OR invoice_number LIKE 'TEST-%';

DELETE FROM aggregator_orders
WHERE id LIKE 'test-agg-%';
```

---

## Next Steps

After confirming sync works with test data:

1. ✅ Test with real POS flow
2. 📊 Verify multi-location reporting
3. 🔍 Monitor D1 sync in production
4. 🧪 Test offline scenarios
5. 📈 Check performance under load

---

## Quick Reference

| Action | UI Method | CLI Method |
|--------|-----------|------------|
| Generate test data | Click "Generate Mock Sales" | `bun run test-d1-sync.ts generate` |
| Test sync | Click "Test Sync" | `bun run test-d1-sync.ts sync` |
| Full test | Click "Run Full Test" | `bun run test-d1-sync.ts test` |
| Check status | Click "Check Local Data" | `bun run test-d1-sync.ts check` |
| Clean up | Click "Clear Test Data" | `bun run test-d1-sync.ts cleanup` |

---

## Related Documentation

- [TEST_D1_SYNC.md](TEST_D1_SYNC.md) - Comprehensive D1 sync testing guide
- [DATABASE_PATH_FIX_SUMMARY.md](DATABASE_PATH_FIX_SUMMARY.md) - Database path fixes
