# Cloud Sync Integration Guide

Complete guide for POS-driven D1 cloud sync implementation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         POS Application                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Local SQLite (Source of Truth)                              │
│     - All data stored locally first                             │
│     - Full offline functionality                                │
│                                                                  │
│  2. Schema Extraction (Rust/Tauri)                              │
│     - extract_sqlite_schema → queries sqlite_master             │
│     - Dynamic schema based on enabled features                  │
│                                                                  │
│  3. D1 Provisioning Service (TypeScript)                        │
│     - Calls worker to create D1 database                        │
│     - Applies custom schema from local SQLite                   │
│                                                                  │
│  4. Initial Sync (One-time Bulk)                                │
│     - InitialD1Sync with weighted progress                      │
│     - Sales (25%), Menu (15%), Tips (10%), etc.                 │
│                                                                  │
│  5. Incremental Sync (Ongoing)                                  │
│     - TieredSyncManager with 4 tiers                            │
│     - Tier 1 (1min): sales, tips                                │
│     - Tier 2 (3min): staff, payouts                             │
│     - Tier 3 (10min): menu, settings                            │
│     - Tier 4 (30min): inventory, registers                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                            │
│              handsfree-orders.suyesh.workers.dev                │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/provision/:tenantId                                  │
│    - Creates D1 database via Cloudflare API                     │
│    - Applies schema statements one by one                       │
│    - Stores metadata in KV                                      │
│                                                                  │
│  POST /api/sync/:tenantId                                       │
│    - Unified endpoint for all data types                        │
│    - Routes: sales, tips, menu, staff, settings, etc.           │
│    - Batch processing (500 records max)                         │
│    - INSERT OR REPLACE for idempotency                          │
│                                                                  │
│  GET /api/provision/:tenantId/status                            │
│    - Returns provisioning status from KV                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare D1                              │
│                 (Tenant-specific databases)                     │
├─────────────────────────────────────────────────────────────────┤
│  my-restaurant-123_db                                           │
│    - Custom schema from restaurant's SQLite                     │
│    - Tables based on enabled features                           │
│    - QSR: ~15 tables (basic)                                    │
│    - Full-service: ~25 tables (+ floor plan)                    │
│    - Bar-enabled: ~35 tables (+ bar inventory)                  │
│    - Multi-location: ~45 tables (+ chain management)            │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Enable Cloud Sync (User Action)

**UI Flow:**
```
Hub Page → Cloud Sync Banner → "Enable Now"
  ↓
Settings → Cloud Sync → "Enable Cloud Sync" button
  ↓
Provisioning Progress Dialog (3 steps)
```

**Code Flow:**
```typescript
// src/components/admin/CloudSyncSettings.tsx
const handleEnableCloud = async () => {
  // 1. Extract schema from local SQLite
  const dbPath = localStorage.getItem('sqlite:db_path') || `${tenantId}.db`;

  // 2. Provision D1 via worker
  const result = await d1ProvisioningService.provisionD1(
    tenantId,
    dbPath,
    (progress) => setProvisioningProgress(progress)
  );

  // 3. Perform initial bulk sync
  if (result.success) {
    await performInitialSync();

    // 4. Enable ongoing sync
    const syncManager = getTieredSyncManager(tenantId);
    syncManager.enableD1Sync(tenantId);
  }
};
```

**Rust/Tauri Commands:**
```rust
// src-tauri/src/commands/d1_provision.rs

// Step 1: Extract schema
#[command]
pub async fn extract_sqlite_schema(db_path: String) -> Result<Vec<String>, String> {
  // Query sqlite_master for all tables and indexes
  // Add IF NOT EXISTS to CREATE statements
  // Return Vec<String> of CREATE statements
}

// Step 2: Call worker to provision D1
#[command]
pub async fn provision_d1_via_worker(
  tenant_id: String,
  worker_url: String,
  database_name: String,
  schema: Vec<String>,
) -> Result<D1ProvisionResult, String> {
  // POST to worker endpoint with schema
}
```

**Frontend Service:**
```typescript
// src/services/d1ProvisioningService.ts
async provisionD1(
  tenantId: string,
  dbPath: string,
  onProgress?: (progress: ProvisionProgress) => void
): Promise<D1ProvisionResult> {
  // Step 1: Extract schema (10% progress)
  const schema = await invoke('extract_sqlite_schema', { dbPath });

  // Step 2: Provision D1 (40% progress)
  const result = await invoke('provision_d1_via_worker', {
    tenantId,
    workerUrl: `${this.workerUrl}/api/provision`,
    databaseName: `${tenantId}_db`,
    schema,
  });

  // Step 3: Store metadata (100% progress)
  if (result.success) {
    localStorage.setItem(`d1:${tenantId}:provisioned`, 'true');
    localStorage.setItem(`d1:${tenantId}:database_id`, result.databaseId);
  }

  return result;
}
```

### 2. Initial Bulk Sync

**Purpose:** One-time sync of all existing data after D1 provisioning

**Implementation:**
```typescript
// src/services/sync/InitialD1Sync.ts
async performInitialSync(): Promise<InitialSyncResult> {
  // 7 weighted steps:
  // 1. Sales (25% weight)
  await this.d1SyncService.syncSalesToD1();

  // 2. Tips (10% weight)
  await this.d1SyncService.syncTipsToD1();

  // 3. Menu (15% weight)
  await this.d1SyncService.syncMenuToD1();

  // 4. Staff (10% weight)
  await this.d1SyncService.syncStaffToD1();

  // 5. Settings (5% weight)
  await this.d1SyncService.syncSettingsToD1();

  // 6. Floor Plan (10% weight)
  await this.d1SyncService.syncFloorPlanToD1();

  // 7. Bar Inventory (25% weight)
  await this.d1SyncService.syncBarInventoryToD1();

  // Mark complete
  localStorage.setItem(`d1:${tenantId}:initial_sync_complete`, 'true');
}
```

### 3. Ongoing Incremental Sync

**Automatic Background Sync:**
```typescript
// src/services/sync/TieredSyncManager.ts
class TieredSyncManager {
  // 4 sync tiers based on data importance
  private readonly SYNC_INTERVALS = {
    // Tier 1: Critical (1 minute)
    sales: { interval: 60000 },
    tips: { interval: 60000 },

    // Tier 2: Important (3 minutes)
    staffLoginHistory: { interval: 180000 },
    cashPayouts: { interval: 180000 },

    // Tier 3: Configuration (10 minutes)
    menu: { interval: 600000 },
    staff: { interval: 600000 },

    // Tier 4: Bulk (30 minutes)
    cashRegisters: { interval: 1800000 },
    inventoryRecipes: { interval: 1800000 },
  };

  // Sync method example
  private async syncSales(): Promise<void> {
    // 1. WebSocket sync (existing)
    await this.incrementalSync.syncSales();

    // 2. D1 cloud sync (new)
    if (this.d1SyncService && this.d1SyncEnabled) {
      await this.d1SyncService.syncSalesToD1();
    }
  }
}
```

**D1 Sync Service:**
```typescript
// src/services/sync/D1SyncService.ts
async syncSalesToD1(since?: string): Promise<SyncResult> {
  // 1. Get last sync timestamp
  const lastSync = since || this.getLastSyncTimestamp('sales');

  // 2. Query new records from SQLite
  const records = await invoke('query_sqlite', {
    dbPath: this.dbPath,
    query: 'SELECT * FROM sales_transactions WHERE completed_at > ? LIMIT 500',
    params: [lastSync],
  });

  // 3. Batch sync to D1 (500 max per request)
  const response = await fetch(`${this.workerUrl}/api/sync/${this.tenantId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataType: 'sales',
      records: records,
    }),
  });

  // 4. Update last sync timestamp
  if (response.ok) {
    this.updateLastSyncTimestamp('sales');
  }

  return await response.json();
}
```

### 4. Worker Endpoints

**D1 Provisioning:**
```typescript
// workers/handsfree-orders/src/index.ts
async function handleProvision(request: Request, env: Env, tenantId: string) {
  const { databaseName, schema } = await request.json();

  // 1. Create D1 database via Cloudflare API
  const createDbResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
      body: JSON.stringify({ name: databaseName }),
    }
  );

  const { result } = await createDbResponse.json();
  const databaseId = result.uuid;

  // 2. Apply schema statements
  for (const statement of schema) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
        body: JSON.stringify({ sql: statement }),
      }
    );
  }

  // 3. Store metadata in KV
  await env.TENANT_METADATA.put(`tenant:${tenantId}:d1`, JSON.stringify({
    provisioned: true,
    databaseId,
    databaseName,
    tableCount: schema.length,
  }));

  return { success: true, databaseId, tableCount: schema.length };
}
```

**Data Sync:**
```typescript
async function handleSync(request: Request, env: Env, tenantId: string) {
  const { dataType, records } = await request.json();

  // Route to appropriate sync handler
  switch (dataType) {
    case 'sales':
      return await syncSales(env, records);
    case 'tips':
      return await syncTips(env, records);
    case 'menu':
      return await syncMenu(env, records);
    // ... etc
  }
}

async function syncSales(env: Env, records: any[]) {
  const result = { synced: 0, failed: 0, errors: [] };

  for (const record of records) {
    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO sales_transactions
         (id, tenant_id, order_id, total_amount, payment_method, completed_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        record.id,
        record.tenant_id,
        record.order_id,
        record.total_amount,
        record.payment_method,
        record.completed_at
      ).run();

      result.synced++;
    } catch (error) {
      result.failed++;
      result.errors.push(error.message);
    }
  }

  return result;
}
```

## Testing Guide

### 1. Local Development Testing

```bash
# Start worker locally
cd workers/handsfree-orders
npm install
npm run dev
```

```typescript
// Test provisioning (from POS)
const result = await invoke('provision_d1_via_worker', {
  tenantId: 'test-restaurant-123',
  workerUrl: 'http://localhost:8787/api/provision',
  databaseName: 'test-restaurant-123_db',
  schema: [
    'CREATE TABLE IF NOT EXISTS sales_transactions (...)',
    'CREATE TABLE IF NOT EXISTS menu_items (...)',
  ],
});

console.log('Provisioning result:', result);
```

### 2. Production Deployment

```bash
# Deploy worker
cd workers/handsfree-orders
wrangler secret put CLOUDFLARE_API_TOKEN
npm run deploy
```

### 3. End-to-End Test

1. **Enable Cloud Sync:**
   - Open POS app
   - Go to Settings → Cloud Sync
   - Click "Enable Cloud Sync"
   - Watch progress (schema extraction → D1 creation → initial sync)

2. **Verify Provisioning:**
   - Check Cloudflare Dashboard → D1 Databases
   - Should see `<tenant-id>_db` database
   - Tables should match local SQLite schema

3. **Test Sync:**
   - Create a sale in POS
   - Wait 1 minute (Tier 1 sync interval)
   - Query D1 database to verify sale appears

4. **Manual Sync:**
   - Click "Sync Now" button
   - All data synced immediately

## Troubleshooting

### D1 Provisioning Fails

**Symptoms:** "Failed to create D1 database" error

**Solutions:**
1. Check `CLOUDFLARE_API_TOKEN` has correct permissions (D1 Edit)
2. Verify `CLOUDFLARE_ACCOUNT_ID` is correct
3. Check Cloudflare account has D1 enabled (paid plan may be required)
4. Check rate limits (max 10 databases on free plan)

### Sync Not Working

**Symptoms:** Data not appearing in D1, "Sync failed" errors

**Solutions:**
1. Check D1 is provisioned: `GET /api/provision/:tenantId/status`
2. Verify table schema matches records being synced
3. Check worker logs: `npm run tail`
4. Verify tenant ID matches between POS and worker

### Schema Mismatch

**Symptoms:** "Table not found" or "Column not found" errors

**Solutions:**
1. Re-extract schema from SQLite
2. Drop and recreate D1 database with updated schema
3. Verify all migrations have run on local SQLite

## Architecture Benefits

### 1. Offline-First
- Local SQLite is always source of truth
- Full functionality without internet
- D1 is backup + multi-device layer

### 2. Modular Features
- Schema reflects restaurant type (QSR, fine dining, bar)
- Subscription-based table inclusion
- No schema drift between SQLite and D1

### 3. Performance
- Batch sync (500 records max per request)
- Tiered intervals based on data importance
- Idempotent sync (INSERT OR REPLACE)

### 4. Reliability
- Sync failures queued and retried
- Progress tracking for transparency
- Graceful degradation if D1 unavailable

## Next Steps

1. **Deploy worker** to production
2. **Test with real restaurant** data
3. **Monitor sync performance** and adjust intervals
4. **Add sync status indicator** to header
5. **Implement conflict resolution** for multi-device scenarios

## Support

For issues or questions:
- Check worker logs: `wrangler tail`
- Check POS console for sync errors
- Review Cloudflare D1 dashboard
- Check KV namespace for tenant metadata
