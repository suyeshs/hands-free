# Existing Worker Codebase Analysis
## Multi-Location Sync Architecture Discovery

**Analysis Date**: 2026-02-10
**Analyzed Codebase**: `/Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers`

---

## Executive Summary

The existing worker codebase **already has 80% of the multi-location infrastructure** in place! The architecture uses:
- **Location Groups** (equivalent to "chains" in our design)
- **Durable Objects** for real-time WebSocket coordination
- **D1 databases** per tenant for local storage
- **Sales sync** from POS → D1 (location-level)

### ✅ What Exists
1. Location group management (chains)
2. Sales sync from POS apps to tenant D1
3. Real-time Durable Objects for orders, staff, KDS
4. Menu master/sync strategy architecture

### ❌ What's Missing (Critical Gaps)
1. **Location D1 → Master D1 aggregation** (sales, inventory)
2. **Master D1 → Location D1 menu sync** (pull-based)
3. **Real consolidated reporting** (currently uses mock data)
4. **Chain-level Durable Object** for real-time coordination

---

## 1. Existing Infrastructure

### 1.1 Location Groups (Multi-Location Management)

**File**: `tenant-router/tenant-worker/src/handlers/location-groups.ts`

**Database Schema** (in TENANTS_DB):
```sql
-- location_groups table (equivalent to restaurant_chains)
CREATE TABLE location_groups (
  id INTEGER PRIMARY KEY,
  location_group_id TEXT UNIQUE,
  location_group_name TEXT,
  owner_admin_user_id TEXT,
  has_master_menu INTEGER DEFAULT 1,
  master_menu_tenant_id TEXT,
  menu_sync_strategy TEXT, -- 'push' or 'pull'
  headquarters_place_id TEXT,
  headquarters_address TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT,
  updated_at TEXT
);

-- location_group_locations (equivalent to location_tenants)
CREATE TABLE location_group_locations (
  id INTEGER PRIMARY KEY,
  location_group_id INTEGER,
  tenant_id TEXT UNIQUE,
  location_name TEXT,
  location_code TEXT,
  place_id TEXT,
  inherits_master_menu INTEGER DEFAULT 1,
  allow_price_overrides INTEGER DEFAULT 1,
  allow_availability_overrides INTEGER DEFAULT 1,
  allow_custom_items INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (location_group_id) REFERENCES location_groups(id)
);

-- location_group_staff_access (chain-wide staff)
CREATE TABLE location_group_staff_access (
  id INTEGER PRIMARY KEY,
  location_group_id INTEGER,
  staff_name TEXT,
  role TEXT,
  can_access_all_locations INTEGER DEFAULT 0,
  accessible_location_ids TEXT, -- JSON array
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (location_group_id) REFERENCES location_groups(id)
);
```

**API Endpoints**:
- `GET /locationGroups/:groupId` - Get group details
- `POST /locationGroups` - Create new group
- `GET /locationGroups/:groupId/locations` - List locations
- `POST /locationGroups/:groupId/locations` - Add location

**Key Features**:
- ✅ Master menu concept (`master_menu_tenant_id`)
- ✅ Menu sync strategy (`push` vs `pull`)
- ✅ Location-level menu overrides
- ✅ Chain-wide staff access control

---

### 1.2 Sales Sync (POS → Tenant D1)

**File**: `tenant-router/tenant-worker/src/handlers/sales.ts`

**Current Flow**:
```
POS App (SQLite)
  ↓ POST /sales/sync
  ↓ { transactions: [...] }
  ↓
Tenant D1: sales_transactions table
  ↓ tenant_id, invoice_number, grand_total, items_json
  ↓ Indexed by: (tenant_id, completed_at)
  ✅ Successfully synced
```

**Schema**:
```sql
CREATE TABLE sales_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  order_number TEXT,
  order_type TEXT NOT NULL,
  table_number INTEGER,
  source TEXT NOT NULL DEFAULT 'pos',
  subtotal REAL NOT NULL,
  service_charge REAL,
  cgst REAL,
  sgst REAL,
  discount REAL,
  round_off REAL,
  grand_total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT DEFAULT 'completed',
  items_json TEXT NOT NULL,
  cashier_name TEXT,
  staff_id TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_tenant_date ON sales_transactions(tenant_id, completed_at);
CREATE INDEX idx_sales_tenant_source ON sales_transactions(tenant_id, source);
CREATE UNIQUE INDEX idx_sales_tenant_invoice ON sales_transactions(tenant_id, invoice_number);
```

**Sync Engine**:
- Uses a unified `SyncEngine` with conflict resolution
- Batch size: 100 transactions
- Conflict strategy: `last-write-wins`
- Conflict key: `invoice_number`

**Existing Endpoints**:
- ✅ `POST /sales/sync` - Sync sales from POS to D1
- ✅ `GET /sales/summary?from=&to=` - Sales summary for tenant
- ✅ `GET /sales/breakdown` - Detailed breakdown

---

### 1.3 Durable Objects (Real-Time Coordination)

#### 1.3.1 OrderNotificationDO

**File**: `tenant-router/src/durable-objects/order-notification-do.ts`

**Purpose**: Real-time coordination for POS, KDS, and manager devices within a single location

**WebSocket Channels**:
- `order_created` - New orders broadcast
- `order_status_update` - Status changes
- `staff_sync` - Staff updates
- `floorplan_sync` - Floor plan changes
- `service_request` - Call waiter, etc.
- `out_of_stock` - 86'd items
- `sale_completed` - Real-time sales (fires D1 sync)

**Critical Feature**: Persists sales to D1 via tenant worker dispatch
```typescript
// When sale_completed is received:
await tenantWorker.fetch(
  new Request('https://internal/sales/sync', {
    method: 'POST',
    headers: { 'X-Tenant-Id': tenantId },
    body: JSON.stringify({ transactions: [transaction] })
  })
);
```

**Connections per DO**:
- Each tenant gets one DO instance
- Supports multiple device types: `pos | kds | manager`
- WebSocket hibernation support

---

#### 1.3.2 RealtimeCoordinator

**File**: `tenant-router/tenant-worker/src/durable-objects/RealtimeCoordinator.ts`

**Purpose**: Real-time updates for Owner and Staff mobile apps

**Subscriptions**:
- `sales` - Real-time sales stats
- `kds` - Kitchen order updates
- `team` - Staff clock in/out
- `activity` - Activity feed for owner app

**State Management**:
- Stores `kdsOrders` in Durable Object storage
- Stores `teamStatus` for active staff
- Background tasks: urgent order detection, cleanup

**Update Types**:
- `new-order` - Broadcast new order
- `staff-clock-in/out` - Team activity
- `sales-update` - Sales stats update
- `inventory-alert` - Low stock

---

#### 1.3.3 Other Durable Objects Found

**DeploymentStatusDO** (domain-service):
- Real-time deployment tracking
- WebSocket progress updates
- Used for tenant provisioning

**DomainManagerDO** (domain-service):
- Custom domain management
- SSL provisioning
- DNS validation

**ThemeSession, ConversationSession, ActiveOrderSession** (theme-edge-worker):
- Customer-facing app sessions

---

### 1.4 Chain Reporting (Mock Data Only!)

**File**: `tenant-router/tenant-worker/src/handlers/location-group-reports.ts`

**Current State**: ⚠️ **ALL REPORTS USE MOCK DATA**

```typescript
// handleLocationGroupSalesReport (line 56)
const mockReport = {
  chainId,
  totalSales: 125000.00,  // ← MOCK
  totalOrders: 1250,      // ← MOCK
  locationBreakdown: locations.results.map((loc, idx) => ({
    sales: 25000.00 - (idx * 2000),  // ← MOCK FORMULA
    orders: 250 - (idx * 20),        // ← MOCK FORMULA
  })),
  message: 'Using mock data - Real sales aggregation not yet implemented',
};
```

**Existing Endpoints** (all return mock data):
- `GET /chains/:chainId/reports/sales` - Sales report
- `GET /chains/:chainId/reports/menu` - Menu analytics
- `GET /chains/:chainId/reports/staff` - Staff report

**Why Mock Data?**
> "Real implementation would query each tenant's D1 database"

**Problem**: No aggregation layer exists to collect sales from all location D1 databases into a master D1.

---

## 2. Architecture Gaps Analysis

### 2.1 Missing: Location D1 → Master D1 Aggregation

**Current State**:
```
Location 1 POS → Location 1 D1 ✅
Location 2 POS → Location 2 D1 ✅
Location 3 POS → Location 3 D1 ✅
         ↓
      ❌ NO AGGREGATION TO MASTER D1
         ↓
   Master reports = MOCK DATA
```

**Required**:
```
Location 1 D1 ─┐
Location 2 D1 ─┼→ Master D1: chain_sales_transactions ✅
Location 3 D1 ─┘
         ↓
   Real-time chain reporting
```

**Implementation Needed**:
1. New table in Master D1: `chain_sales_transactions`
2. Sync service in each location worker: periodically push sales to master
3. Worker endpoints in master: `POST /chain/{groupId}/location/{tenantId}/sync-sales`
4. Replace mock data in `location-group-reports.ts` with real D1 queries

---

### 2.2 Missing: Master D1 → Location D1 Menu Sync

**Current State**:
- `master_menu_tenant_id` field exists ✅
- `menu_sync_strategy` field exists (`push` or `pull`) ✅
- **No actual sync implementation** ❌

**Required**:
```
Master D1 (master_menu_tenant_id)
  ↓ menu_categories, menu_items
  ↓ GET /master-data/:tenantId/menu
  ↓
Location D1: Pulls menu periodically
  ↓ Every 5 minutes or on startup
  ✅ Local menu updated
```

**Implementation Needed**:
1. Master worker endpoints:
   - `GET /master-data/:tenantId/menu/categories`
   - `GET /master-data/:tenantId/menu/items`
   - `GET /master-data/:tenantId/staff`
   - `GET /master-data/:tenantId/settings`
2. Location sync service (Rust or TypeScript):
   - Periodically fetch from master D1
   - Update local D1
   - Handle price/availability overrides
3. Conflict resolution for location-specific changes

---

### 2.3 Missing: Chain-Level Durable Object

**Current State**:
- ✅ OrderNotificationDO: Per-location real-time sync
- ✅ RealtimeCoordinator: Owner/staff app updates
- ❌ No chain-wide coordination DO

**Required**: `ChainCoordinatorDO`
```typescript
// One DO instance per location group
export class ChainCoordinatorDO {
  // Manage WebSocket connections from:
  // - Master device (owner/manager)
  // - All location devices

  // Broadcast events:
  // - sale_completed (from any location)
  // - menu_updated (from master)
  // - inventory_alert (from any location)
  // - staff_transfer (between locations)
}
```

**Why Needed?**
- Current DOs are single-location only
- Chain dashboard needs real-time updates across all locations
- Menu changes need instant propagation
- Inventory/staff movements need coordination

**Implementation Approach**:
- Extend existing `OrderNotificationDO` pattern
- Add chain-level subscription channels
- Location workers broadcast to ChainCoordinatorDO
- ChainCoordinatorDO broadcasts to master device + other locations

---

## 3. Recommended Implementation Plan

### Phase 1: Sales Aggregation (High Priority)
**Goal**: Replace mock data with real sales aggregation

**Steps**:
1. **Create Master D1 Schema** (in location group owner's D1):
   ```sql
   CREATE TABLE chain_sales_aggregated (
     id TEXT PRIMARY KEY,
     location_group_id INTEGER,
     location_tenant_id TEXT,
     invoice_number TEXT,
     grand_total REAL,
     items_json TEXT,
     completed_at TEXT,
     synced_at TEXT,
     UNIQUE(location_tenant_id, invoice_number)
   );

   CREATE INDEX idx_chain_sales_group_date
     ON chain_sales_aggregated(location_group_id, completed_at);
   ```

2. **Add Sync Endpoint** (in master tenant worker):
   ```typescript
   // POST /chain/:groupId/location/:tenantId/sync-sales
   export async function handleChainSalesSync(
     request: Request,
     env: Env,
     groupId: string,
     locationTenantId: string
   ): Promise<Response> {
     const { transactions } = await request.json();

     // Insert into chain_sales_aggregated
     // (similar to existing handleSalesSync)
   }
   ```

3. **Location-side Sync Service** (TypeScript/background job):
   ```typescript
   // Run every 5 minutes
   setInterval(async () => {
     const unsyncedSales = await getUnsyncedSales();

     await fetch(masterWorkerUrl + '/chain/{groupId}/location/{tenantId}/sync-sales', {
       method: 'POST',
       body: JSON.stringify({ transactions: unsyncedSales })
     });

     await markSalesAsSynced();
   }, 5 * 60 * 1000);
   ```

4. **Update Reports** (replace mock data):
   ```typescript
   // location-group-reports.ts
   export async function handleLocationGroupSalesReport(...) {
     const sales = await env.DB.prepare(`
       SELECT
         location_tenant_id,
         SUM(grand_total) as sales,
         COUNT(*) as orders
       FROM chain_sales_aggregated
       WHERE location_group_id = ? AND completed_at >= ? AND completed_at <= ?
       GROUP BY location_tenant_id
     `).bind(groupId, startDate, endDate).all();

     return Response.json({ success: true, sales: sales.results });
   }
   ```

**Estimated Time**: 2-3 days
**Impact**: Enables real consolidated reporting

---

### Phase 2: Master Menu Sync (Medium Priority)
**Goal**: Implement D1-centric menu sync (Master D1 → Location D1)

**Steps**:
1. **Master Endpoints** (in master tenant worker):
   ```typescript
   GET /master-data/:tenantId/menu/categories
   GET /master-data/:tenantId/menu/items
   ```

2. **Location Sync Command** (Rust or TypeScript):
   ```typescript
   async function syncMasterMenu() {
     const masterTenantId = getMasterTenantId();

     // Fetch from master D1
     const categories = await fetch(`${masterWorkerUrl}/master-data/${masterTenantId}/menu/categories`);
     const items = await fetch(`${masterWorkerUrl}/master-data/${masterTenantId}/menu/items`);

     // Update local D1
     await replaceMenuCategories(categories);
     await replaceMenuItems(items);
   }
   ```

3. **Handle Overrides**:
   ```sql
   CREATE TABLE menu_price_overrides (
     id INTEGER PRIMARY KEY,
     menu_item_id TEXT,
     override_price REAL,
     reason TEXT
   );
   ```

**Estimated Time**: 2-3 days
**Impact**: Enables centralized menu management

---

### Phase 3: Chain Durable Object (Low Priority, High Value)
**Goal**: Real-time updates for chain dashboards

**Implementation**:
1. **Create ChainCoordinatorDO**:
   ```typescript
   export class ChainCoordinatorDO extends DurableObject {
     // WebSocket channels: 'chain-sales', 'chain-menu', 'chain-inventory'

     async webSocketMessage(ws, message) {
       const data = JSON.parse(message);

       switch (data.type) {
         case 'sale_completed':
           // Broadcast to master device and other locations
           this.broadcast({ type: 'chain-sale', data }, 'chain-sales');
           break;

         case 'menu_updated':
           // Broadcast menu change to all locations
           this.broadcast({ type: 'chain-menu-update', data }, 'chain-menu');
           break;
       }
     }
   }
   ```

2. **Location Workers Connect**:
   ```typescript
   // On sale completion
   const chainDO = env.CHAIN_COORDINATOR.get(
     env.CHAIN_COORDINATOR.idFromName(locationGroupId)
   );

   await chainDO.fetch('/broadcast', {
     method: 'POST',
     body: JSON.stringify({ type: 'sale_completed', ...saleData })
   });
   ```

3. **Master Device Subscribes**:
   ```typescript
   const ws = new WebSocket(chainDOUrl + '/ws?channel=chain-sales');

   ws.onmessage = (event) => {
     const { type, data } = JSON.parse(event.data);

     if (type === 'chain-sale') {
       updateDashboard(data);
     }
   };
   ```

**Estimated Time**: 3-4 days
**Impact**: 100ms latency vs 5-minute polling, real-time chain visibility

---

### Phase 4: Inventory & Staff Sync (Future)
**Goal**: Complete the multi-location ecosystem

**Inventory Aggregation**:
```sql
CREATE TABLE chain_inventory_snapshots (
  location_group_id INTEGER,
  location_tenant_id TEXT,
  item_name TEXT,
  quantity REAL,
  unit TEXT,
  snapshot_date TEXT
);
```

**Staff Transfers**:
```sql
CREATE TABLE chain_staff_transfers (
  staff_id TEXT,
  from_location_id TEXT,
  to_location_id TEXT,
  transfer_date TEXT,
  status TEXT
);
```

---

## 4. Key Insights & Recommendations

### 4.1 Leverage Existing Patterns

✅ **DO**: Reuse existing patterns
- Copy `OrderNotificationDO` structure for `ChainCoordinatorDO`
- Extend `SyncEngine` for chain sales aggregation
- Follow same D1 table patterns (tenant_id, timestamps, indexes)

❌ **DON'T**: Reinvent the wheel
- Don't create new WebSocket patterns (use existing DO approach)
- Don't create new sync patterns (extend `SyncEngine`)
- Don't create new database schema conventions

---

### 4.2 Database Strategy

**Use Existing Databases**:
- ✅ `TENANTS_DB` - For location group metadata (already has `location_groups` table)
- ✅ Master tenant's `DB` - For aggregated sales (`chain_sales_aggregated`)
- ✅ Location tenant's `DB` - For local sales (already has `sales_transactions`)

**Don't Create**:
- ❌ New global "chain master D1" - Use master tenant's D1 instead
- ❌ Separate aggregation database - Keep data close to where it's queried

---

### 4.3 Terminology Alignment

**Existing Codebase** vs **Our Design**:
- `location_groups` ≈ `restaurant_chains` ✅ Use existing!
- `location_group_locations` ≈ `location_tenants` ✅ Use existing!
- `master_menu_tenant_id` ≈ `master_tenant_id` ✅ Already exists!
- `OrderNotificationDO` + `RealtimeCoordinator` ≈ Our `ChainCoordinatorDO` → Extend existing

**Recommendation**: Adopt existing terminology to avoid confusion

---

### 4.4 Integration Points

**Tauri POS App** needs updates:
1. Add location group sync service (TypeScript):
   ```typescript
   // src/services/chainSalesSync.ts
   import { invoke } from '@tauri-apps/api/core';

   setInterval(async () => {
     const unsyncedSales = await invoke('get_unsynced_sales');
     await syncToChainMaster(unsyncedSales);
   }, 5 * 60 * 1000);
   ```

2. Add master menu pull service:
   ```typescript
   // src/services/masterMenuSync.ts
   setInterval(async () => {
     await invoke('sync_master_menu_from_d1');
   }, 5 * 60 * 1000);
   ```

3. Connect to ChainCoordinatorDO WebSocket:
   ```typescript
   // If this is a master device
   if (isMasterDevice) {
     connectToChainWebSocket();
   }
   ```

---

## 5. Migration Path

### Step 1: Deploy Worker Changes (No Breaking Changes)
1. Add `chain_sales_aggregated` table to master D1
2. Add `/chain/:groupId/location/:tenantId/sync-sales` endpoint
3. Deploy updated workers

### Step 2: Deploy POS App Updates (Opt-In)
1. Add chain sync services
2. Enable only for beta testers
3. Monitor sync reliability

### Step 3: Update Reports (Replace Mock Data)
1. Update `handleLocationGroupSalesReport` to query real data
2. Keep mock data as fallback if no synced data exists
3. Gradually roll out

### Step 4: Real-Time Layer (Optional, Non-Breaking)
1. Deploy `ChainCoordinatorDO`
2. Enable for master devices only
3. Expand to location devices

---

## 6. Files to Modify

### Workers (handsfree-restaurant-new)
```
platform/workers/tenant-router/tenant-worker/src/
├── handlers/
│   ├── sales.ts                          (Add chain aggregation endpoint)
│   ├── location-group-reports.ts         (Replace mock data with real queries)
│   └── chain-sync.ts                     (NEW: Chain sync handlers)
├── durable-objects/
│   └── ChainCoordinator.ts               (NEW: Chain-level DO)
└── lib/
    └── syncEngine.ts                     (Extend for chain sync)
```

### POS App (restaurant-pos-ai)
```
src/
├── services/
│   ├── chainSalesSync.ts                 (NEW: Location → Master sync)
│   └── masterMenuSync.ts                 (NEW: Master → Location menu sync)
src-tauri/src/commands/
├── chain_sync.rs                         (NEW: Rust chain sync commands)
└── menu_sync.rs                          (UPDATE: Add D1 menu pull)
```

### Database Migrations
```
workers/tenant-router/migrations/
└── 00X_chain_sales_aggregation.sql       (NEW: Chain sales table)

restaurant-pos-ai/migrations/
└── 04X_chain_sync_metadata.sql           (NEW: Sync tracking tables)
```

---

## 7. Conclusion

### Summary
The existing worker codebase has **excellent foundations** for multi-location sync:
- ✅ Location group management exists
- ✅ Sales sync (POS → D1) exists
- ✅ Durable Objects pattern established
- ✅ Menu master concept exists

**Only 3 critical pieces missing**:
1. Location D1 → Master D1 aggregation (for real reporting)
2. Master D1 → Location D1 menu sync (pull-based)
3. Chain-level Durable Object (for real-time updates)

### Estimated Total Effort
- **Phase 1** (Sales Aggregation): 2-3 days → **Immediate value**
- **Phase 2** (Menu Sync): 2-3 days → Completes core functionality
- **Phase 3** (Chain DO): 3-4 days → Real-time experience
- **Total**: ~8-10 days for complete implementation

### Next Steps
1. ✅ **Immediate**: Implement Phase 1 (Sales Aggregation) to replace mock data
2. Run in production with beta customers for 1 week
3. Implement Phase 2 (Menu Sync) based on customer feedback
4. Implement Phase 3 (Chain DO) for premium tier customers

---

**Analysis Complete** 🎉
The codebase is well-structured and ready for multi-location enhancements!
