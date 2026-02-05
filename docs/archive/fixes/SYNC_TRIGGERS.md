# Cloud Sync Triggers - Per-Tenant D1 Architecture

## Overview

The Restaurant POS system uses a **Service Worker-based background sync** mechanism with **per-tenant D1 databases**. Each tenant has their own dedicated Cloudflare D1 database for complete isolation. Data syncs automatically in the background without requiring manual intervention. All sync happens through the Service Worker and TieredSyncManager, routing to the tenant's specific database.

## Automatic Sync Triggers

### 1. Periodic Background Sync (Tiered Intervals)

The TieredSyncManager automatically syncs data at different intervals based on priority:

#### Tier 1: Critical Data (1 minute)
- **Orders** (`table_sessions`, `aggregator_orders`, `kds_orders`)
- **Tips** (`tips`)
- **Sales Transactions** (`sales_transactions`)

#### Tier 2: Important Data (3 minutes)
- **Staff Login History** (`staff_login_history`)
- **Cash Payouts** (`cash_payouts`)
- **Inventory Transactions** (`inventory_transactions`)

#### Tier 3: Configuration Data (10 minutes)
- **Menu Items** (`menu_categories`, `menu_items`)
- **Staff Data** (`staff_users`)
- **Inventory Items** (`inventory_items`)
- **Suppliers** (`suppliers`)

#### Tier 4: Bulk Data (30 minutes)
- **Cash Registers** (`daily_cash_registers`)
- **Recipe Ingredients** (`recipe_ingredients`)

### 2. Network Reconnection

When the device comes back online after being offline:
- Triggers `sync-all` event
- Processes all pending items in the offline queue
- Syncs all data types immediately

### 3. Data Change Events

When new data is created or modified locally:
- Record is added to IndexedDB sync queue
- Service Worker detects the pending record
- Sync happens at the next interval for that data type

### 4. On Application Start

When the POS application starts:
- TieredSyncManager starts all sync intervals
- Processes offline queue immediately
- Loads any pending changes from previous session

### 5. Manual Sync (Settings Only)

**Location**: Settings → System & Training → Cloud Sync

Users can trigger immediate sync of ALL data types via the Cloud Sync settings page:
- Calls `requestBackgroundSync('sync-all')`
- Syncs all 37 tables immediately
- Only available when online

## Sync Flow

```
Local SQLite Change
       ↓
IndexedDB Sync Queue
       ↓
Service Worker (background)
       ↓
Cloudflare Worker API (with tenant_id header)
       ↓
KV Lookup (tenant:{tenantId} -> database_id)
       ↓
Cloudflare D1 API (routes to tenant's specific database)
       ↓
Tenant's D1 Database (45 tables)
       ↓
Multi-device sync complete
```

### Per-Tenant Database Routing

Each sync request includes the tenant ID, which the Cloudflare Worker uses to route to the correct database:

1. **POS App**: Sends sync request with `X-Tenant-ID` header
2. **Cloudflare Worker**: Looks up tenant metadata from KV
3. **KV Returns**: `database_id` and `database_name` for that tenant
4. **Worker**: Executes query on tenant's database via Cloudflare D1 API
5. **Response**: Returns success/failure to POS app

This ensures complete database isolation between tenants.

## What Gets Synced

### Core Tables (9 tables)
- staff_users
- staff_login_history
- table_sessions
- aggregator_orders
- kds_orders
- sales_transactions
- daily_cash_registers
- cash_payouts
- out_of_stock_items

### Menu Tables (2 tables)
- menu_categories
- menu_items

### Floor Plan Tables (3 tables)
- floor_sections
- floor_tables
- floor_staff_assignments

### Inventory Tables (8 tables)
- suppliers
- inventory_items
- recipe_ingredients
- inventory_documents
- inventory_transactions
- inventory_barcode_mappings
- delivery_verification_sessions

### Tips Table (1 table)
- tips

### HR/Payroll Tables (11 tables)
- attendance_records
- weekly_rosters
- roster_assignments
- leave_requests
- leave_balances
- staff_salary
- staff_advances
- staff_deductions
- staff_bonuses
- staff_attendance
- staff_payslips

### i18n Tables (4 tables)
- translation_keys
- translations
- tenant_translation_overrides
- tenant_settings

### Settings Table (1 table)
- restaurant_settings

### Bar Management Tables (7 tables)
- bar_orders
- bar_inventory_items
- bar_recipes
- bar_recipe_ingredients
- bar_inventory_transactions
- bar_closing_sessions
- bar_closing_counts

**Total: 45 tables** (38 core POS + 7 bar management)

**Note**: Each tenant has their own dedicated D1 database containing these 45 tables. Data is completely isolated at the database level - no `tenant_id` filtering needed in queries.

## Monitoring Sync Status

### Cloud Sync Settings Page
**Path**: Settings → System & Training → Cloud Sync

Shows:
- Online/Offline status
- Last sync time for each data type
- Sync intervals
- Manual sync button
- Pending sync queue status

### D1 Status Card (Hub)
**Path**: Hub → D1 Database Status

Shows:
- Tenant's D1 database provisioning status
- Database ID and name
- Table count (should be 45/45)
- Green when all tables provisioned
- Amber when setup needed

**Architecture**: Checks the tenant-specific D1 database, not a shared database. Each tenant has their own isolated database.

## Files Involved

### Service Worker
- `src/services/sync/service-worker.ts` - Background sync event handler
- `src/services/sync/registerServiceWorker.ts` - Service Worker registration and sync triggers
- `src/services/sync/TieredSyncManager.ts` - Periodic sync intervals
- `src/services/sync/IncrementalSyncService.ts` - Incremental sync logic
- `src/services/sync/OfflineQueue.ts` - Offline queue management

### Components
- `src/components/admin/CloudSyncSettings.tsx` - Manual sync UI (Settings page)
- `src/components/home/D1StatusCard.tsx` - D1 provisioning status (Hub page)

### Database
- `docs/d1-complete-migration.sql` - D1 database schema (37 tables)
- `docs/D1_COMPLETE_MIGRATION.md` - Migration guide
- `src-tauri/migrations/*.sql` - Local SQLite migrations

## Important Notes

### ⚠️ Do NOT Add Manual Sync Buttons

Manual sync buttons should **NOT** be added to individual screens (Menu, Floor Plan, Inventory, etc.) because:

1. **Sync is automatic** - Background sync handles everything
2. **User confusion** - Multiple sync buttons create confusion
3. **Inconsistent UX** - Users don't know which button to use
4. **Unnecessary** - Sync happens in the background anyway

### ✅ Centralized Sync Control

All manual sync should go through:
- **Settings → System & Training → Cloud Sync** (for manual triggers)
- **Hub → D1 Status Card** (for monitoring)

This provides:
- Single source of truth
- Clear sync status
- Unified experience
- Better UX

## Debugging Sync Issues

### Check Service Worker Status
```javascript
// In browser console
navigator.serviceWorker.ready.then(reg => console.log(reg));
```

### Check IndexedDB Queue
1. Open DevTools → Application tab
2. IndexedDB → sync-queue
3. View pending-* stores

### Check Sync Timestamps
```javascript
// Last sync times stored in localStorage
localStorage.getItem('sync_last_orders');
localStorage.getItem('sync_last_menu');
// etc.
```

### Trigger Manual Sync (Console)
```javascript
// Import the function
import { requestBackgroundSync } from './services/sync/registerServiceWorker';

// Trigger sync
requestBackgroundSync('sync-all');
```

## API Endpoints Required

Cloudflare Worker must implement these sync endpoints. Each endpoint:
1. Extracts `tenantId` from URL or header
2. Looks up tenant's `database_id` from KV (`TENANT_METADATA`)
3. Executes queries on tenant's specific D1 database via Cloudflare API

**Sync Endpoints**:
- `POST /api/menu/:tenantId/sync` - Routes to tenant's database
- `POST /api/sales/:tenantId/sync` - Routes to tenant's database
- `POST /api/tips/:tenantId/sync` - Routes to tenant's database
- `POST /api/staff/:tenantId/sync` - Routes to tenant's database
- `POST /api/floor-plan/:tenantId/sync` - Routes to tenant's database
- `POST /api/inventory/:tenantId/{category}/sync` - Routes to tenant's database
- `POST /api/attendance/:tenantId/{type}/sync` - Routes to tenant's database
- `POST /api/payroll/:tenantId/{type}/sync` - Routes to tenant's database
- `POST /api/i18n/:tenantId/translations/sync` - Routes to tenant's database
- `POST /api/settings/:tenantId/sync` - Routes to tenant's database
- `GET /api/d1-status/:tenantId` - Checks tenant's database table count

**Metadata Endpoints**:
- `GET /api/tenant-metadata/:tenantId` - Returns database_id, database_name for tenant

See `docs/AUTO_PROVISION_D1.md` for per-tenant routing implementation examples.

---

**Last Updated**: 2026-01-23
**Version**: Matches D1 schema v3.1.0
**Architecture**: Per-Tenant D1 Databases (complete isolation)
**Total Tables**: 45 tables per tenant database
