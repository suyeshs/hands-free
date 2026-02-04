# D1 Sync Testing Guide

This guide explains how to test synchronization between the local SQLite database and Cloudflare D1 database.

## Overview

The POS system uses a multi-tier sync architecture:
- **Local SQLite**: Primary data store on the device
- **Cloudflare D1**: Cloud database for backup and multi-device sync
- **Sync Services**: Automatic and manual sync mechanisms

## Architecture

### Sync Components

1. **D1SyncService** ([src/services/sync/D1SyncService.ts](src/services/sync/D1SyncService.ts))
   - Handles incremental sync of specific data types
   - Syncs: sales, tips, menu, staff, settings, floor plan, bar inventory
   - Batches records (500 per request)
   - Tracks last sync timestamps

2. **InitialD1Sync** ([src/services/sync/InitialD1Sync.ts](src/services/sync/InitialD1Sync.ts))
   - Handles one-time bulk sync when cloud sync is first enabled
   - Provides progress tracking for UI feedback
   - Syncs all data types in weighted sequence

3. **TieredSyncManager** ([src/services/sync/TieredSyncManager.ts](src/services/sync/TieredSyncManager.ts))
   - Manages periodic sync intervals
   - Different tiers for different data types:
     - **Tier 1 (1 min)**: Orders, tips, sales
     - **Tier 2 (3 min)**: Staff history, cash payouts, inventory transactions
     - **Tier 3 (10 min)**: Menu, staff, inventory items
     - **Tier 4 (30 min)**: Cash registers, inventory recipes

4. **D1ProvisioningService** ([src/services/d1ProvisioningService.ts](src/services/d1ProvisioningService.ts))
   - Handles D1 database provisioning
   - Extracts schema from local SQLite
   - Creates D1 database with tenant-specific schema
   - Triggers initial data sync

## Testing with the Test Suite

### Access the Test Page

1. Start the application
2. Login as Manager or Owner
3. Navigate to: `http://localhost:1420/#/d1-sync-test`

### Prerequisites

Before testing, ensure:
1. **Device is activated**: Tenant must be configured
2. **D1 is provisioned**: Run provisioning from Settings > Cloud Sync
3. **Local data exists**: Create some test data (menu items, sales, etc.)

### Test Suite Features

The test page provides:

#### 1. Run All Tests
Tests the complete sync flow:
- ✅ Check tenant configuration
- ✅ Verify D1 provisioning status
- ✅ Check local SQLite data
- ✅ Create test sales transaction
- ✅ Sync data to D1 (incremental)
- ✅ **Verify data exists in D1** (NEW)
- ✅ **Test offline/online sync recovery** (NEW)
- ✅ Verify sync status

#### 2. Test Full Sync
Performs a complete bulk sync:
- Syncs all data types (sales, tips, menu, staff, settings, floor plan, inventory)
- Shows real-time progress
- Provides detailed results

#### 3. D1 Data Verification (NEW)
Confirms data actually arrived in D1:
- Queries D1 database directly
- Returns record counts per table
- Validates sync integrity
- Catches issues where sync "succeeds" but data doesn't arrive

#### 4. Offline/Online Scenario Testing (NEW)
Tests sync recovery after offline period:
- Creates records "while offline"
- Simulates coming back online
- Verifies all offline records sync successfully
- Tests data persistence and recovery

## Manual Testing

### 1. Check Current Status

```typescript
import { getD1ProvisioningService } from './services/d1ProvisioningService';
import { useTenantStore } from './stores/tenantStore';

const { tenant } = useTenantStore.getState();
const service = getD1ProvisioningService();

// Check D1 status
const status = await service.checkStatus(tenant.tenantId);
console.log('D1 Status:', status);

// Check if sync is enabled
const syncEnabled = await service.isCloudSyncEnabled();
console.log('Sync Enabled:', syncEnabled);
```

### 2. Trigger Manual Sync

```typescript
import { createD1SyncService } from './services/sync/D1SyncService';
import { getDatabaseFilePath } from './lib/database';

const dbPath = await getDatabaseFilePath();
const syncService = createD1SyncService(tenant.tenantId, undefined, dbPath);

// Sync specific data types
const salesResult = await syncService.syncSalesToD1();
const menuResult = await syncService.syncMenuToD1();
const staffResult = await syncService.syncStaffToD1();

console.log('Sales synced:', salesResult);
console.log('Menu synced:', menuResult);
console.log('Staff synced:', staffResult);
```

### 3. Check Sync Status

```typescript
// Get sync status for all tables
const status = await syncService.getSyncStatus();
console.log('Sync Status:', status);

// Check last sync time
const lastSync = await service.getLastSyncTime();
console.log('Last Sync:', lastSync);
```

### 4. Verify Data in D1

Query the worker endpoint to verify data:

```bash
# Using curl
curl https://handsfree-orders.suyesh.workers.dev/api/sync/${TENANT_ID}/status

# Check D1 database directly (requires wrangler)
wrangler d1 execute ${DATABASE_ID} --command "SELECT COUNT(*) FROM sales_transactions"
```

## New Testing Features

### D1 Verification

The test suite now queries D1 directly to confirm data exists:

```typescript
// Example verification request
const response = await fetch(
  `${workerUrl}/api/sync/${tenantId}/verify`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tables: ['sales_transactions', 'menu_items', 'staff_users'],
    }),
  }
);

const verification = await response.json();
console.log('D1 Record Counts:', verification.tables);
// Output: { sales_transactions: 145, menu_items: 32, staff_users: 8 }
```

**Benefits:**
- Detects "false positive" syncs (reports success but data doesn't arrive)
- Verifies data integrity
- Provides confidence in sync reliability
- Useful for debugging sync issues

**Requirements:**
- Worker must implement `/api/sync/{tenantId}/verify` endpoint
- See [D1_VERIFICATION_ENDPOINT.md](D1_VERIFICATION_ENDPOINT.md) for implementation details

### Offline/Online Testing

Simulates real-world scenario where device goes offline:

```typescript
// 1. Create data while "offline" (don't sync)
for (let i = 0; i < 3; i++) {
  await createSalesTransaction(`offline-sale-${i}`);
}

// 2. Come back "online" and sync
const syncResult = await syncService.syncSalesToD1();

// 3. Verify all offline records were synced
console.log(`Synced ${syncResult.synced} offline records`);
```

**Tests:**
- Data persistence during offline periods
- Sync recovery when connection restored
- Batch sync of accumulated records
- No data loss during offline → online transition

**Use Cases:**
- Network outages
- Device in areas with poor connectivity
- Testing reliability of offline-first architecture

## Testing Scenarios

### Scenario 1: First-Time Sync

1. Activate device with tenant code
2. Provision D1 database from Settings > Cloud Sync
3. Watch initial sync progress
4. Verify all data is synced

### Scenario 2: Incremental Sync

1. Create new sales transaction locally
2. Wait for automatic sync (1 minute) or trigger manual sync
3. Verify new transaction appears in D1
4. Check sync timestamp is updated

### Scenario 3: Offline/Online Sync

1. Disconnect from internet
2. Create several sales transactions
3. Reconnect to internet
4. Verify offline queue is processed
5. Check all transactions are synced

### Scenario 4: Multi-Device Sync

1. Sync from Device A
2. Wait for sync to complete
3. Open Device B with same tenant
4. Verify data from Device A appears on Device B

### Scenario 5: Data Verification (NEW)

1. Perform sync operation
2. Run D1 verification test
3. Check that D1 record counts match expectations
4. If counts don't match, investigate:
   - Worker errors
   - D1 write permissions
   - Network timeouts

### Scenario 6: Offline Recovery (NEW)

1. Disable network (airplane mode or disconnect WiFi)
2. Create 10-20 sales transactions
3. Re-enable network
4. Run sync test
5. Verify all transactions appear in D1
6. Check no data was lost

## Debugging

### Enable Debug Logging

All sync services log to console:
- `[D1Sync]` - D1 sync service
- `[InitialD1Sync]` - Initial bulk sync
- `[TieredSync]` - Tiered sync manager
- `[D1ProvisioningService]` - Provisioning service

### Check Local Storage

Sync state is stored in localStorage:
```javascript
// Check last sync timestamps
localStorage.getItem('sync:d1:sales:last')
localStorage.getItem('sync:d1:tips:last')
localStorage.getItem('sync:d1:menu:last')

// Check if initial sync complete
localStorage.getItem(`d1:${tenantId}:initial_sync_complete`)
localStorage.getItem(`d1:${tenantId}:initial_sync_at`)

// Check if sync enabled
localStorage.getItem('sync:d1:enabled')
```

### Check SQLite Metadata

The `sync_metadata` table stores sync state:
```sql
SELECT * FROM sync_metadata WHERE key LIKE 'd1:%';
```

### Common Issues

1. **D1 not provisioned**
   - Error: "D1 database is NOT provisioned"
   - Solution: Go to Settings > Cloud Sync and provision D1

2. **No tenant configured**
   - Error: "No tenant configured"
   - Solution: Activate device with activation code

3. **Network errors**
   - Error: "Failed to call worker API"
   - Solution: Check internet connection and worker URL

4. **Empty schema extracted**
   - Error: "No schema statements extracted"
   - Solution: Ensure local database has tables created

5. **Verification endpoint not found (NEW)**
   - Error: "Verification endpoint returned 404"
   - Solution: Worker needs to implement `/api/sync/{tenantId}/verify` endpoint
   - See: [D1_VERIFICATION_ENDPOINT.md](D1_VERIFICATION_ENDPOINT.md)

6. **Verification shows no data (NEW)**
   - Error: "No data found in D1"
   - Possible causes:
     - Sync actually failed (check sync errors)
     - Data synced to wrong database
     - D1 write permissions issue
   - Solution: Check worker logs and D1 console

7. **Offline records not syncing (NEW)**
   - Error: "Some records failed to sync"
   - Possible causes:
     - Records created with incorrect timestamps
     - Sync service not finding new records
     - Batch size limit exceeded
   - Solution: Check last sync timestamp and query filters

## API Endpoints

### Sync Endpoint
```
POST /api/sync/${tenantId}
Body: {
  dataType: string,
  records: any[]
}
```

### Provisioning Endpoint
```
POST /api/provision/${tenantId}
Body: {
  databaseName: string,
  schema: string[]
}
```

### Status Endpoint
```
GET /api/provision/${tenantId}/status
```

## Performance Considerations

- **Batch Size**: 500 records per request (configurable)
- **Sync Intervals**: Staggered by data priority
- **Rate Limiting**: Worker may rate-limit frequent syncs
- **Network Usage**: Monitor bandwidth for large menu images

## Next Steps

1. Test with real production data
2. Monitor sync performance and errors
3. Adjust sync intervals based on usage patterns
4. Implement conflict resolution for multi-device scenarios
5. Add retry logic for failed syncs
