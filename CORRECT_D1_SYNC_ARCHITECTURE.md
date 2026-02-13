# Correct D1-Centric Multi-Location Architecture

## Core Principle: D1 is Source of Truth

**Master Tenant D1** = Central cloud database for the entire chain
- Stores master menu, staff, settings, policies
- Receives sales, inventory, attendance from all locations
- Single source of truth for the entire chain

## Data Flow

### 1. Master Data Management

```
Master Device (Owner/Manager)
    ↓ Edit menu/staff/settings via UI
    ↓ Saves to local SQLite
    ↓
Sync to Master D1 (cloud)
    ↓ D1 becomes source of truth
    ↓
Available to all locations
```

**Tables Synced to Master D1**:
- `menu_categories`
- `menu_items`
- `staff_users`
- `restaurant_settings`
- `weekly_roster`
- `leave_requests`
- `floor_plans`
- `floor_plan_tables`

### 2. Location Pulls from Master D1

```
Location Device (Branch POS)
    ↓ Periodically (every 5 min or on startup)
    ↓
Fetch from Master Tenant D1
    ↓ GET /api/menu/{masterTenantId}
    ↓ GET /api/staff/{masterTenantId}
    ↓ GET /api/settings/{masterTenantId}
    ↓
Update Local SQLite
    ↓ Replace menu_categories
    ↓ Replace menu_items
    ↓ Update staff_users
    ↓ Update restaurant_settings
    ↓
Location operates with synced data
```

### 3. Location Pushes Operational Data to Master D1

```
Location Device (Branch POS)
    ↓ Sales, inventory, attendance tracked locally
    ↓
Batch sync to Master D1 (every 5 min)
    ↓ POST /api/chain/{chainId}/location/{locationId}/sales
    ↓ POST /api/chain/{chainId}/location/{locationId}/inventory
    ↓ POST /api/chain/{chainId}/location/{locationId}/attendance
    ↓
Master D1 stores in chain_* tables
    ↓ chain_sales_transactions
    ↓ chain_inventory_snapshots
    ↓ chain_attendance_records
    ↓
Master Device pulls aggregated data
    ↓ Real-Time Sales Dashboard
    ↓ Consolidated Reports
    ↓ Chain-wide Analytics
```

---

## Implementation Details

### Master Device → Master D1 Sync

**Currently Exists**: Yes, via cloud sync system

**Triggers**:
- Manual: "Sync to Cloud" button
- Auto: When online and changes detected

**Tables**:
```typescript
const MASTER_TABLES_TO_SYNC = [
  'menu_categories',
  'menu_items',
  'staff_users',
  'restaurant_settings',
  'weekly_roster',
  'leave_requests',
  'floor_plans',
  'floor_plan_tables',
  // Add more as needed
];
```

**Process**:
1. Master device detects changes (dirty flag)
2. Batches changes
3. POST to worker: `/api/sync/{tenantId}`
4. Worker stores in Master D1
5. Last sync timestamp updated

---

### Location Device ← Master D1 Sync

**Currently Exists**: Partially (menu only, via `fetch_and_load_master_menu`)

**Needs Enhancement**: Full sync of all master tables

#### New Rust Command: `sync_master_data_to_location`

```rust
// src-tauri/src/commands/chain_sync.rs

#[tauri::command]
pub async fn sync_master_data_to_location(app: AppHandle) -> Result<SyncSummary, String> {
    // 1. Check if this is a location device
    let master_tenant_id = get_master_tenant_id(&app)?;
    if master_tenant_id.is_empty() {
        return Err("Not a location device".to_string());
    }

    let location_tenant_id = get_current_tenant_id(&app)?;

    // 2. Get master worker URL
    let worker_url = get_master_worker_url(&master_tenant_id).await?;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());
    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut summary = SyncSummary::default();

    // 3. Sync Menu Categories
    let categories = fetch_master_menu_categories(&worker_url, &master_tenant_id).await?;
    db.execute("DELETE FROM menu_categories", [])?;
    for category in &categories {
        db.execute(
            "INSERT INTO menu_categories (id, name, name_hindi, description, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &category.id,
                &category.name,
                &category.name_hindi,
                &category.description,
                &category.sort_order,
                &category.created_at,
                &category.updated_at,
            ]
        )?;
    }
    summary.categories_synced = categories.len();

    // 4. Sync Menu Items
    let items = fetch_master_menu_items(&worker_url, &master_tenant_id).await?;
    db.execute("DELETE FROM menu_items", [])?;
    for item in &items {
        db.execute(
            "INSERT INTO menu_items (
                id, category_id, name, name_hindi, description, description_hindi,
                price, tax_percentage, photo_url, is_available, is_veg,
                preparation_time, calories, allergens, spice_level,
                created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                &item.id, &item.category_id, &item.name, &item.name_hindi,
                &item.description, &item.description_hindi, &item.price,
                &item.tax_percentage, &item.photo_url, &item.is_available,
                &item.is_veg, &item.preparation_time, &item.calories,
                &item.allergens, &item.spice_level, &item.created_at, &item.updated_at,
            ]
        )?;
    }
    summary.items_synced = items.len();

    // 5. Sync Staff Users
    let staff = fetch_master_staff(&worker_url, &master_tenant_id).await?;

    // For staff, we merge (not replace) to preserve location-specific staff
    // Only sync staff marked as "chain-wide" or "transferable"
    for staff_member in &staff {
        if staff_member.is_chain_wide {
            db.execute(
                "INSERT OR REPLACE INTO staff_users (
                    id, name, email, phone, pin, role, is_active, is_chain_wide,
                    created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    &staff_member.id, &staff_member.name, &staff_member.email,
                    &staff_member.phone, &staff_member.pin, &staff_member.role,
                    &staff_member.is_active, &staff_member.is_chain_wide,
                    &staff_member.created_at, &staff_member.updated_at,
                ]
            )?;
            summary.staff_synced += 1;
        }
    }

    // 6. Sync Restaurant Settings (merge, don't replace location-specific)
    let settings = fetch_master_settings(&worker_url, &master_tenant_id).await?;

    // Only sync specific global settings, preserve location-specific ones
    db.execute(
        "UPDATE restaurant_settings SET
            currency = ?1,
            timezone = ?2,
            default_tax_percentage = ?3,
            enable_tips = ?4,
            updated_at = datetime('now')
         WHERE id = 1",
        params![
            &settings.currency,
            &settings.timezone,
            &settings.default_tax_percentage,
            &settings.enable_tips,
        ]
    )?;
    summary.settings_synced = 1;

    // 7. Update last sync timestamp
    db.execute(
        "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
         VALUES ('last_master_sync', datetime('now'), datetime('now'))",
        []
    )?;

    Ok(summary)
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SyncSummary {
    pub categories_synced: usize,
    pub items_synced: usize,
    pub staff_synced: usize,
    pub settings_synced: usize,
}
```

#### Worker Endpoints (Master D1)

```typescript
// workers/handsfree-restaurant/src/index.ts

// GET /api/master-data/{masterTenantId}/menu/categories
export async function getMasterMenuCategories(
  env: Env,
  masterTenantId: string
): Promise<Response> {
  const categories = await env.DB.prepare(`
    SELECT * FROM menu_categories
    WHERE tenant_id = ?
    ORDER BY sort_order ASC
  `).bind(masterTenantId).all();

  return new Response(JSON.stringify(categories.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/master-data/{masterTenantId}/menu/items
export async function getMasterMenuItems(
  env: Env,
  masterTenantId: string
): Promise<Response> {
  const items = await env.DB.prepare(`
    SELECT * FROM menu_items
    WHERE tenant_id = ?
    ORDER BY category_id, name
  `).bind(masterTenantId).all();

  return new Response(JSON.stringify(items.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/master-data/{masterTenantId}/staff
export async function getMasterStaff(
  env: Env,
  masterTenantId: string
): Promise<Response> {
  const staff = await env.DB.prepare(`
    SELECT * FROM staff_users
    WHERE tenant_id = ? AND is_chain_wide = 1
    ORDER BY name
  `).bind(masterTenantId).all();

  return new Response(JSON.stringify(staff.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/master-data/{masterTenantId}/settings
export async function getMasterSettings(
  env: Env,
  masterTenantId: string
): Promise<Response> {
  const settings = await env.DB.prepare(`
    SELECT * FROM restaurant_settings
    WHERE tenant_id = ?
  `).bind(masterTenantId).first();

  return new Response(JSON.stringify(settings), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### Location Device: Auto Sync Service

```typescript
// src/services/masterDataSync.ts

class MasterDataSyncService {
  private syncInterval: NodeJS.Timeout | null = null;

  async start() {
    // Check if location device
    const isLocation = await this.isLocationDevice();
    if (!isLocation) {
      console.log('[MasterDataSync] Not a location device, skipping');
      return;
    }

    // Initial sync
    await this.syncNow();

    // Periodic sync every 5 minutes
    this.syncInterval = setInterval(async () => {
      await this.syncNow();
    }, 5 * 60 * 1000);
  }

  async syncNow() {
    try {
      console.log('[MasterDataSync] Syncing master data...');

      const summary = await invoke<SyncSummary>('sync_master_data_to_location');

      console.log('[MasterDataSync] ✅ Sync complete:', summary);
      console.log(`  Categories: ${summary.categories_synced}`);
      console.log(`  Items: ${summary.items_synced}`);
      console.log(`  Staff: ${summary.staff_synced}`);
      console.log(`  Settings: ${summary.settings_synced}`);

      // Refresh stores
      useMenuStore.getState().loadCategories();
      useMenuStore.getState().loadMenuItems();

      return summary;
    } catch (error) {
      console.error('[MasterDataSync] ❌ Sync failed:', error);
      throw error;
    }
  }

  async isLocationDevice(): Promise<boolean> {
    try {
      const masterTenantId = await invoke<string>('get_master_tenant_id');
      return masterTenantId.length > 0;
    } catch {
      return false;
    }
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const masterDataSyncService = new MasterDataSyncService();

// Auto-start in App.tsx
useEffect(() => {
  masterDataSyncService.start();
  return () => masterDataSyncService.stop();
}, []);
```

---

## Database Schema Changes

### Master D1 Schema (No changes needed)
Already has:
- `menu_categories`
- `menu_items`
- `staff_users`
- `restaurant_settings`

### Location SQLite Schema (Add sync tracking)

```sql
-- Track last sync from master
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Add chain-wide flag to staff
ALTER TABLE staff_users ADD COLUMN is_chain_wide INTEGER DEFAULT 0;

-- Add sync tracking to menu
ALTER TABLE menu_categories ADD COLUMN synced_from_master INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN synced_from_master INTEGER DEFAULT 0;
```

---

## Complete Data Flow

### Morning: Master Updates Menu

```
8:00 AM - Master Device
  ↓ Owner adds "Weekend Special Biryani"
  ↓ Saves to master SQLite
  ↓
8:01 AM - Auto Sync to Master D1
  ↓ POST /api/sync/{masterTenantId}
  ↓ Master D1 updated
  ↓
8:05 AM - All Locations Pull
  ↓ Location 1, 2, 3 sync (every 5 min)
  ↓ GET /api/master-data/{masterTenantId}/menu/items
  ↓ "Weekend Special Biryani" now available at all locations
```

### Throughout Day: Locations Sell

```
Location 1 - 12:30 PM
  ↓ Customer orders Biryani
  ↓ Sale recorded in location SQLite
  ↓
12:35 PM - Location Syncs to Master D1
  ↓ POST /api/chain/{chainId}/location/{loc1}/sales
  ↓ Master D1: chain_sales_transactions
  ↓
12:40 PM - Master Device Pulls Reports
  ↓ GET /api/chain/{chainId}/sales?since=today
  ↓ Real-Time Dashboard shows all location sales
  ↓ "Biryani sold: 23 (Loc1: 8, Loc2: 10, Loc3: 5)"
```

---

## Benefits of D1-Centric Architecture

1. **Single Source of Truth**: D1, not master device SQLite
2. **Multi-Master Editing**: Any authorized device can update master data
3. **Real-Time Propagation**: Changes available to all locations within 5 min
4. **Offline Resilience**: Locations queue syncs, retry when online
5. **Scalability**: Supports hundreds of locations
6. **Auditability**: All changes tracked in D1 with timestamps

---

## Migration from Current (SQLite-to-SQLite) to D1-Centric

### Step 1: Deploy Worker Endpoints
- Add GET /api/master-data/* endpoints
- Add POST /api/chain/*/location/*/sales endpoints

### Step 2: Update Location Sync Logic
- Replace `fetch_and_load_master_menu` (SQLite-based)
- With `sync_master_data_to_location` (D1-based)

### Step 3: Add Sync Services
- Location: `MasterDataSyncService` (pull from D1)
- Location: `ChainSalesSyncService` (push to D1)
- Master: `ChainReportingService` (pull aggregated from D1)

### Step 4: Update UI
- Show sync status in location UI
- Show last synced timestamp
- Manual "Sync Now" button
- Offline queue indicator

---

## Implementation Checklist

### Phase 1: D1 Endpoints (Master Worker)
- [ ] GET /api/master-data/:tenantId/menu/categories
- [ ] GET /api/master-data/:tenantId/menu/items
- [ ] GET /api/master-data/:tenantId/staff
- [ ] GET /api/master-data/:tenantId/settings
- [ ] POST /api/chain/:chainId/location/:locationId/sales
- [ ] POST /api/chain/:chainId/location/:locationId/inventory
- [ ] GET /api/chain/:chainId/sales (aggregated)

### Phase 2: Location Pull from D1
- [ ] Rust: `sync_master_data_to_location` command
- [ ] Frontend: `MasterDataSyncService` class
- [ ] Auto-start sync on location devices
- [ ] Sync status UI component
- [ ] Manual sync button

### Phase 3: Location Push to D1 (Reverse Sync)
- [ ] Rust: `sync_sales_to_master` command
- [ ] Rust: `sync_inventory_to_master` command
- [ ] Frontend: `ChainSalesSyncService` class
- [ ] Queue offline syncs in IndexedDB
- [ ] Retry logic with exponential backoff

### Phase 4: Master Pull Aggregated Data
- [ ] Rust: `fetch_chain_sales` command
- [ ] Rust: `fetch_chain_inventory` command
- [ ] Frontend: Real-Time Sales Dashboard (use real data)
- [ ] Frontend: Consolidated Reports (use real data)
- [ ] Remove all mock data

---

**Status**: ⚠️ Partially Implemented (menu sync exists but uses wrong source)
**Priority**: 🔴 CRITICAL (architectural correction needed)
**Next Step**: Deploy D1 endpoints, update sync commands to use D1
