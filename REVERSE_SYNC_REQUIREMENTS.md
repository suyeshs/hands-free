# Multi-Location Reverse Sync Requirements

## Current State ❌

**One-Way Sync Only**: Master → Location (menu only)

- ✅ Master pushes menu to locations
- ❌ Locations **DO NOT** sync data back to master
- ❌ Master **CANNOT** see location sales in real-time
- ❌ Consolidated reporting uses **MOCK DATA**

## Required: Bidirectional Sync Architecture

### Location → Master (Reverse Sync)

Locations need to sync back:

1. **Sales Transactions** (Real-Time)
   - Every completed order
   - Payment details
   - Items sold
   - Timestamps
   - → Master aggregates for consolidated reporting

2. **Inventory Levels** (Periodic)
   - Stock counts per location
   - Low stock alerts
   - → Master sees chain-wide inventory

3. **Staff Attendance** (Daily)
   - Clock in/out records
   - Break times
   - → Master sees labor costs across chain

4. **Menu Modifications** (Rare)
   - Location-specific pricing changes
   - Availability toggles (86'd items)
   - → Master sees what's available where

5. **Device Status** (Real-Time)
   - Online/offline status
   - Last sync timestamp
   - → Master monitors fleet health

---

## Implementation Plan

### Phase 1: Sales Data Sync (Priority: HIGH)

#### Architecture

```
Location Device (SQLite)
  ↓ Every order completion
  ↓ Batch: Every 5 minutes
  ↓
POST /api/chain/{chainId}/location/{locationId}/sales
  ↓
Master Worker (D1)
  ↓ Stores in: chain_sales_transactions
  ↓
Master Device (SQLite) pulls periodically
  ↓
Real-Time Sales Dashboard updates
```

#### Database Schema Changes

**Master D1** (add table):
```sql
CREATE TABLE chain_sales_transactions (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  location_tenant_id TEXT NOT NULL,

  -- Original transaction data
  order_id TEXT NOT NULL,
  total_amount REAL NOT NULL,
  tax_amount REAL,
  tip_amount REAL,
  payment_method TEXT,
  items_json TEXT, -- JSON array of items

  -- Metadata
  sale_timestamp TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  sync_batch_id TEXT,

  FOREIGN KEY (chain_id) REFERENCES restaurant_chains(id)
);

CREATE INDEX idx_chain_sales_chain_id ON chain_sales_transactions(chain_id);
CREATE INDEX idx_chain_sales_location_id ON chain_sales_transactions(location_id);
CREATE INDEX idx_chain_sales_timestamp ON chain_sales_transactions(sale_timestamp);
```

**Location SQLite** (add columns):
```sql
ALTER TABLE sales_transactions ADD COLUMN synced_to_master INTEGER DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN master_sync_at TEXT;
ALTER TABLE sales_transactions ADD COLUMN master_sync_batch_id TEXT;

CREATE INDEX idx_sales_master_sync ON sales_transactions(synced_to_master);
```

#### Rust Commands (Location Device)

```rust
// src-tauri/src/commands/chain_sync.rs

#[tauri::command]
pub async fn sync_sales_to_master(app: AppHandle) -> Result<u32, String> {
    // 1. Get location's master tenant ID
    let master_tenant_id = get_master_tenant_id(&app)?;
    if master_tenant_id.is_empty() {
        return Ok(0); // Not a location device
    }

    // 2. Get location tenant ID
    let location_tenant_id = get_current_tenant_id(&app)?;

    // 3. Query unsynced sales
    let unsynced_sales = db.query(
        "SELECT * FROM sales_transactions
         WHERE synced_to_master = 0
         ORDER BY created_at ASC
         LIMIT 100"
    )?;

    if unsynced_sales.is_empty() {
        return Ok(0);
    }

    // 4. Get chain ID from master
    let chain_id = get_chain_id_for_location(&master_tenant_id, &location_tenant_id).await?;

    // 5. Prepare batch payload
    let batch_id = uuid::Uuid::new_v4().to_string();
    let payload = json!({
        "chainId": chain_id,
        "locationId": location_tenant_id,
        "batchId": batch_id,
        "transactions": unsynced_sales.iter().map(|sale| {
            json!({
                "orderId": sale.order_id,
                "totalAmount": sale.total_amount,
                "taxAmount": sale.tax_amount,
                "tipAmount": sale.tip_amount,
                "paymentMethod": sale.payment_method,
                "items": sale.items_json,
                "saleTimestamp": sale.created_at,
            })
        }).collect::<Vec<_>>()
    });

    // 6. POST to master worker
    let worker_url = get_master_worker_url(&master_tenant_id).await?;
    let response = reqwest::Client::new()
        .post(format!("{}/api/chain/{}/location/{}/sync-sales",
            worker_url, chain_id, location_tenant_id))
        .json(&payload)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("Sync failed: HTTP {}", response.status()));
    }

    // 7. Mark as synced
    db.execute(
        "UPDATE sales_transactions
         SET synced_to_master = 1,
             master_sync_at = datetime('now'),
             master_sync_batch_id = ?1
         WHERE synced_to_master = 0",
        params![batch_id]
    )?;

    Ok(unsynced_sales.len() as u32)
}
```

#### Cloudflare Worker Endpoint (Master)

```typescript
// POST /api/chain/:chainId/location/:locationId/sync-sales

export async function handleLocationSalesSync(
  request: Request,
  env: Env,
  chainId: string,
  locationId: string
): Promise<Response> {
  // 1. Verify chain and location exist
  const chain = await env.DB.prepare(
    'SELECT * FROM restaurant_chains WHERE id = ?'
  ).bind(chainId).first();

  if (!chain) {
    return new Response('Chain not found', { status: 404 });
  }

  // 2. Parse batch
  const { batchId, transactions } = await request.json();

  // 3. Insert into chain_sales_transactions
  const stmt = env.DB.prepare(`
    INSERT INTO chain_sales_transactions (
      id, chain_id, location_id, location_tenant_id,
      order_id, total_amount, tax_amount, tip_amount,
      payment_method, items_json, sale_timestamp, synced_at, sync_batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `);

  const batch = env.DB.batch(
    transactions.map((txn: any) =>
      stmt.bind(
        crypto.randomUUID(),
        chainId,
        locationId,
        locationId, // location_tenant_id same as location_id
        txn.orderId,
        txn.totalAmount,
        txn.taxAmount,
        txn.tipAmount,
        txn.paymentMethod,
        JSON.stringify(txn.items),
        txn.saleTimestamp,
        batchId
      )
    )
  );

  await batch;

  // 4. Broadcast update via WebSocket (optional)
  // await notifyMasterDevices(chainId, 'sales_updated');

  return new Response(JSON.stringify({
    success: true,
    synced: transactions.length,
    batchId
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### Frontend Service (Location Device)

```typescript
// src/services/chainSalesSync.ts

class ChainSalesSyncService {
  private syncInterval: NodeJS.Timeout | null = null;

  async start() {
    // Sync every 5 minutes
    this.syncInterval = setInterval(async () => {
      try {
        const count = await invoke<number>('sync_sales_to_master');
        if (count > 0) {
          console.log(`[ChainSync] Synced ${count} sales to master`);
        }
      } catch (error) {
        console.error('[ChainSync] Failed to sync sales:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Initial sync
    await this.syncNow();
  }

  async syncNow() {
    const count = await invoke<number>('sync_sales_to_master');
    return count;
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const chainSalesSyncService = new ChainSalesSyncService();

// Auto-start on app load (location devices only)
if (await isLocationDevice()) {
  chainSalesSyncService.start();
}
```

#### Master Device: Pull Chain Sales

```rust
// src-tauri/src/commands/chain_sync.rs

#[tauri::command]
pub async fn fetch_chain_sales(
    app: AppHandle,
    chain_id: String,
    since: Option<String>
) -> Result<Vec<ChainSaleTransaction>, String> {
    // 1. Get master tenant ID
    let master_tenant_id = get_current_tenant_id(&app)?;

    // 2. Get master worker URL
    let worker_url = get_worker_url(&master_tenant_id).await?;

    // 3. Fetch from worker D1
    let url = if let Some(since_ts) = since {
        format!("{}/api/chain/{}/sales?since={}", worker_url, chain_id, since_ts)
    } else {
        format!("{}/api/chain/{}/sales", worker_url, chain_id)
    };

    let response = reqwest::get(&url).await?;

    if !response.status().is_success() {
        return Err(format!("Failed to fetch sales: HTTP {}", response.status()));
    }

    let sales: Vec<ChainSaleTransaction> = response.json().await?;

    // 4. Optionally cache in master SQLite for offline viewing
    // store_chain_sales_cache(&app, &sales)?;

    Ok(sales)
}
```

---

### Phase 2: Inventory Sync

```
Location Device
  ↓ Daily (3am)
  ↓
POST /api/chain/{chainId}/location/{locationId}/inventory
  ↓
Master D1: chain_inventory_snapshots
```

**Schema**:
```sql
CREATE TABLE chain_inventory_snapshots (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  items_json TEXT NOT NULL, -- [{itemId, name, quantity, unit}]
  synced_at TEXT NOT NULL,

  UNIQUE(chain_id, location_id, snapshot_date)
);
```

---

### Phase 3: Staff Attendance Sync

```
Location Device
  ↓ Real-time (on clock in/out)
  ↓
POST /api/chain/{chainId}/location/{locationId}/attendance
  ↓
Master D1: chain_attendance_records
```

---

### Phase 4: Menu Override Sync

```
Location Device
  ↓ When manager changes price/availability
  ↓
POST /api/chain/{chainId}/location/{locationId}/menu-overrides
  ↓
Master D1: chain_menu_overrides
  ↓
Master Dashboard shows what's available where
```

---

## Implementation Checklist

### Phase 1: Sales Sync (Immediate)
- [ ] Add chain_sales_transactions table to master D1 schema
- [ ] Add sync columns to location SQLite sales_transactions
- [ ] Create Rust command: sync_sales_to_master (location)
- [ ] Create Rust command: fetch_chain_sales (master)
- [ ] Create Worker endpoint: POST /sync-sales
- [ ] Create Worker endpoint: GET /chain/:id/sales
- [ ] Create ChainSalesSyncService (location frontend)
- [ ] Auto-start sync on location devices
- [ ] Update Real-Time Sales Dashboard to use real data (not mock)
- [ ] Add sync status indicator in location UI
- [ ] Add "Last Synced" timestamp display
- [ ] Add manual "Sync Now" button

### Phase 2: Inventory Sync
- [ ] Design inventory sync schema
- [ ] Implement daily snapshot job
- [ ] Create aggregated inventory dashboard
- [ ] Low stock alerts across chain

### Phase 3: Attendance Sync
- [ ] Sync clock in/out events
- [ ] Consolidated labor cost reporting
- [ ] Cross-location staff transfers

### Phase 4: Menu Override Sync
- [ ] Real-time override tracking
- [ ] "86'd items" visibility
- [ ] Location-specific pricing dashboard

---

## Benefits of Reverse Sync

1. **Real-Time Visibility**: Master sees all location sales instantly
2. **Accurate Reporting**: Consolidated reports use real data, not mocks
3. **Inventory Optimization**: See chain-wide stock levels
4. **Labor Management**: Track staff across all locations
5. **Menu Intelligence**: Know what's selling where

---

## Technical Considerations

### Conflict Resolution
- **Sales**: Append-only, no conflicts
- **Inventory**: Last-write-wins per item
- **Attendance**: Append-only, no conflicts
- **Menu Overrides**: Last-write-wins per item per location

### Offline Handling
- Queue syncs when offline
- Retry with exponential backoff
- Show sync status in UI (✓ Synced / ⏱ Pending / ⚠️ Failed)

### Performance
- Batch sales in groups of 100
- Sync every 5 minutes (configurable)
- Compress large payloads
- Index by chain_id, location_id, timestamp

### Security
- Verify chain membership before accepting data
- Validate location_tenant_id matches chain
- Rate limit sync endpoints
- Audit log all syncs

---

## Migration Path

1. Deploy Phase 1 (Sales Sync) to production
2. Monitor sync reliability for 1 week
3. Roll out Phase 2-4 incrementally
4. Deprecate mock data in Real-Time Sales Dashboard
5. Add analytics: "Total synced records", "Sync success rate"

---

**Status**: ⚠️ NOT IMPLEMENTED
**Priority**: 🔴 HIGH (required for production multi-location)
**Estimated Effort**: 2-3 weeks
