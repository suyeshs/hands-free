# Subscription Workflow Integration - Complete Guide

This document outlines the complete end-to-end integration of the subscription meals system with the Cloudflare Workers dispatch namespace architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop POS App                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Subscription Menu Manager (Admin UI)                      │ │
│  │  - Create cuisine types & subscription plans               │ │
│  │  - Create weekly menus & assign items                      │ │
│  │  - Publish menus for customer ordering                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Local SQLite Database                                     │ │
│  │  - subscription_plans                                      │ │
│  │  - subscription_cuisine_types                              │ │
│  │  - subscription_menu_weeks                                 │ │
│  │  - subscription_menu_items                                 │ │
│  │  - subscription_deliveries                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Subscription Plugin Sync Service                          │ │
│  │  plugins/subscription-meals/sync/SubscriptionPluginSync.ts │ │
│  │  - Manual sync trigger from UI                             │ │
│  │  - Syncs all subscription data to cloud                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS POST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (Multi-Tenant)                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Restaurant Router Worker                                  │ │
│  │  https://restaurant.guanix.com/api/*                       │ │
│  │  - Routes /api/subscriptions/* to tenant worker           │ │
│  │  - Strips /api prefix before dispatch                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼ Dispatch                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Tenant Worker (Workers for Platforms)                    │ │
│  │  tenant-router/tenant-worker/src/handlers/subscriptions.ts │ │
│  │                                                            │ │
│  │  API Endpoints:                                            │ │
│  │  • GET  /subscriptions/plans                              │ │
│  │  • GET  /subscriptions/cuisine-types                      │ │
│  │  • GET  /subscriptions/weeks                              │ │
│  │  • GET  /subscriptions/weeks/:weekId/items                │ │
│  │  • POST /subscriptions/customers                          │ │
│  │  • POST /subscriptions/preferences                        │ │
│  │  • GET  /subscriptions/deliveries                         │ │
│  │                                                            │ │
│  │  Sync Endpoints:                                          │ │
│  │  • POST /subscriptions/plans/sync                         │ │
│  │  • POST /subscriptions/cuisine-types/sync                 │ │
│  │  • POST /subscriptions/weeks/sync                         │ │
│  │  • POST /subscriptions/menu-items/sync                    │ │
│  │  • POST /subscriptions/deliveries/sync                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  D1 Database (Per-Tenant Isolation)                       │ │
│  │  - subscription_plans                                      │ │
│  │  - subscription_cuisine_types                              │ │
│  │  - subscription_menu_weeks                                 │ │
│  │  - subscription_menu_items                                 │ │
│  │  - subscription_customers                                  │ │
│  │  - subscription_preferences                                │ │
│  │  - subscription_deliveries                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │ API Calls
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Customer-Facing Applications                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Theme Edge Worker (Subscription Theme)                   │ │
│  │  workers/theme-edge-worker/src/multimodal-restaurant/     │ │
│  │           presets/coorg-subscription.ts                    │ │
│  │                                                            │ │
│  │  Features:                                                 │ │
│  │  - View weekly rotating menus by cuisine type             │ │
│  │  - Subscribe to meal plans                                │ │
│  │  - Select meals for the week                              │ │
│  │  - Choose delivery times                                  │ │
│  │  - Track delivery status                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Admin Setup Flow (Desktop POS → Cloud)

1. **Restaurant Admin creates subscription plans and menus:**
   - Open Subscription Menu Manager in desktop app
   - Import 150+ menu items (a la carte menu)
   - Create cuisine types (North Indian, South Indian, Chinese, etc.)
   - Create subscription plans (5-day, 10-day, 20-day)
   - Create weekly menus and assign items

2. **Data saved to local SQLite:**
   - All changes written to local database tables
   - Changes tracked for sync

3. **Sync to Cloud:**
   - Click "Sync Subscription Data" button
   - `SubscriptionPluginSync.ts` reads local data
   - Sends POST requests to worker sync endpoints
   - Worker stores in tenant-specific D1 database

### 2. Customer Ordering Flow (Cloud)

1. **Customer visits subscription theme website:**
   - Theme worker fetches published weekly menus
   - GET `/subscriptions/weeks?cuisine_type=North Indian&published=true`

2. **Customer subscribes:**
   - Selects subscription plan
   - POST `/subscriptions/customers` with delivery details

3. **Customer selects meals:**
   - Chooses items from weekly menu
   - POST `/subscriptions/preferences` with selected items

4. **Delivery management:**
   - Staff views deliveries by tower/date
   - GET `/subscriptions/deliveries?date=2026-02-15&tower=A`

### 3. Sync Flow (Bidirectional)

**POS → Cloud (Push):**
```typescript
// Triggered manually or on-update
const syncManager = getTieredSyncManager();
await syncManager.triggerPluginSync('subscription-meals');
```

Data flow:
1. Desktop app queries local SQLite
2. Converts snake_case → camelCase
3. POSTs to `/subscriptions/*/sync` endpoints
4. Worker validates and stores in D1
5. Returns sync result (synced count, errors)

**Cloud → POS (Pull):**
Future enhancement - currently one-way sync (POS to cloud)

## File Structure

### Worker Files (Cloud)

```
workers/
├── tenant-router/
│   └── tenant-worker/
│       └── src/
│           ├── handlers/
│           │   └── subscriptions.ts          # Subscription API handlers
│           └── index.ts                       # Router (updated with subscription routes)
└── restaurant/
    └── src/
        └── index.ts                           # Main router (dispatches to tenant worker)
```

### Plugin Files (Desktop)

```
plugins/
└── subscription-meals/
    ├── migrations/
    │   └── 001_initial_schema.sql            # Database schema
    ├── sync/
    │   └── SubscriptionPluginSync.ts         # Sync service (NEW)
    └── plugin.json                            # Plugin metadata
```

### Desktop App Files

```
src/
├── components/
│   └── subscriptions/
│       ├── SubscriptionMenuManager.tsx       # Main admin UI
│       └── SubscriptionMenuImporter.tsx      # Menu import UI
└── scripts/
    └── importSubscriptionMenuFromMd.ts       # Menu import logic
```

## API Endpoints Reference

### Public API (Customer-Facing)

Base URL: `https://restaurant.guanix.com/api`

#### Get Subscription Plans
```
GET /subscriptions/plans?active=true
```
Response:
```json
{
  "success": true,
  "tenantId": "tenant-123",
  "plans": [
    {
      "id": "plan-1",
      "name": "5-Day Weekday Plan",
      "price_per_week": 1500,
      "meals_per_week": 5,
      "delivery_days": "Mon,Tue,Wed,Thu,Fri",
      "meal_selection_limit": 5
    }
  ]
}
```

#### Get Weekly Menus
```
GET /subscriptions/weeks?cuisine_type=North Indian&published=true
```
Response:
```json
{
  "success": true,
  "weeks": [
    {
      "id": "week-1",
      "week_number": 7,
      "year": 2026,
      "cuisine_type": "North Indian",
      "start_date": "2026-02-10",
      "end_date": "2026-02-16",
      "published": 1
    }
  ]
}
```

#### Get Week Menu Items
```
GET /subscriptions/weeks/:weekId/items
```
Response:
```json
{
  "success": true,
  "weekId": "week-1",
  "items": [
    {
      "id": "smi-1",
      "menu_week_id": "week-1",
      "menu_item_id": "item-1",
      "name": "Butter Chicken",
      "price": 250,
      "available": 1,
      "dietary_tags": "[\"non-veg\"]"
    }
  ]
}
```

#### Create Subscription
```
POST /subscriptions/customers
```
Request:
```json
{
  "customerPhone": "+919876543210",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "subscriptionPlanId": "plan-1",
  "towerNumber": "A",
  "apartmentNumber": "101",
  "floorNumber": "1",
  "deliveryNotes": "Ring the bell twice"
}
```

#### Save Meal Preferences
```
POST /subscriptions/preferences
```
Request:
```json
{
  "subscriptionId": "sub-1",
  "menuWeekId": "week-1",
  "selectedItems": ["item-1", "item-2", "item-3"],
  "deliveryDay": "Monday",
  "deliveryTimeSlot": "7:00 PM - 8:00 PM",
  "specialInstructions": "Extra spicy"
}
```

### Admin/Sync API (Desktop POS)

#### Sync Subscription Plans
```
POST /subscriptions/plans/sync
Headers: X-Tenant-Id: tenant-123
```
Request:
```json
{
  "plans": [
    {
      "id": "plan-1",
      "tenantId": "tenant-123",
      "name": "5-Day Weekday Plan",
      "pricePerWeek": 1500,
      "mealsPerWeek": 5,
      "deliveryDays": "Mon,Tue,Wed,Thu,Fri",
      "cuisineTypes": "North Indian,South Indian",
      "mealSelectionLimit": 5,
      "createdAt": "2026-02-01T00:00:00Z",
      "updatedAt": "2026-02-01T00:00:00Z"
    }
  ]
}
```

## Implementation Checklist

### ✅ Completed

- [x] Worker subscription handler (`handlers/subscriptions.ts`)
- [x] Worker routing integration (added to `index.ts`)
- [x] Sync configurations (D1 schema mappings)
- [x] Desktop sync service (`SubscriptionPluginSync.ts`)
- [x] Desktop database schema (migrations)
- [x] Desktop UI components (SubscriptionMenuManager, SubscriptionMenuImporter)

### 🚧 Next Steps

1. **Test Desktop → Cloud Sync:**
   - Create test subscription plans in desktop app
   - Trigger sync and verify data in D1
   - Test error handling and retry logic

2. **Update Theme Worker:**
   - Replace hardcoded subscription data with API calls
   - Integrate weekly menu display
   - Implement customer subscription flow
   - Add meal preference selection UI

3. **Add Delivery Management:**
   - Desktop UI for viewing/managing deliveries
   - Delivery route optimization
   - Status updates sync

4. **Testing:**
   - End-to-end integration tests
   - Multi-tenant isolation verification
   - Performance testing with 100+ menu items

## Usage Examples

### Initialize Subscription Sync (Desktop App)

```typescript
// In your app initialization (e.g., App.tsx)
import { SubscriptionPluginSync } from '../plugins/subscription-meals/sync/SubscriptionPluginSync';

async function initializeSubscriptionSync(tenantId: string, dbPath: string) {
  const subscriptionSync = new SubscriptionPluginSync(
    tenantId,
    dbPath,
    'https://restaurant.guanix.com/api'
  );

  await subscriptionSync.initialize();
  console.log('Subscription sync initialized');
}
```

### Trigger Manual Sync (Admin UI)

```typescript
// In SubscriptionMenuManager.tsx
import { getTieredSyncManager } from '@/services/sync/TieredSyncManager';

const handleSyncToCloud = async () => {
  try {
    const syncManager = getTieredSyncManager();
    const result = await syncManager.triggerPluginSync('subscription-meals');

    console.log(`✓ Synced ${result.synced} records`);
    console.log(`✗ Failed ${result.failed} records`);
    console.log(`📋 Tables: ${result.tables.join(', ')}`);
  } catch (error) {
    console.error('Sync failed:', error);
  }
};
```

### Fetch Weekly Menu (Customer Theme)

```typescript
// In subscription theme component
async function fetchWeeklyMenu(cuisineType: string) {
  const response = await fetch(
    `/api/subscriptions/weeks?cuisine_type=${cuisineType}&published=true`
  );

  const data = await response.json();
  const currentWeek = data.weeks[0]; // Most recent week

  // Fetch items for this week
  const itemsResponse = await fetch(
    `/api/subscriptions/weeks/${currentWeek.id}/items`
  );

  const itemsData = await itemsResponse.json();
  return {
    week: currentWeek,
    items: itemsData.items
  };
}
```

## Database Sync Details

### Sync Engine Integration

The subscription sync uses the same `SyncEngine` as orders/sales:

```typescript
// In handlers/subscriptions.ts
import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

const subscriptionPlansSyncConfig: SyncTableConfig = {
  tableName: 'subscription_plans',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'tenantId', target: 'tenant_id', type: 'TEXT', required: true },
    // ... more columns
  ],
  batchSize: 50,
};

// Usage in handler
const syncEngine = createSyncEngine(env.DB, tenantId);
const result = await syncEngine.sync(subscriptionPlansSyncConfig, plans);
```

### Data Transformation

Desktop (snake_case) → Cloud (camelCase):

```typescript
// Desktop SQLite
{
  tenant_id: "tenant-123",
  price_per_week: 1500,
  meals_per_week: 5
}

// Transformed for API
{
  tenantId: "tenant-123",
  pricePerWeek: 1500,
  mealsPerWeek: 5
}

// Stored in D1 (snake_case)
{
  tenant_id: "tenant-123",
  price_per_week: 1500,
  meals_per_week: 5
}
```

## Security Considerations

1. **Tenant Isolation:**
   - All queries filtered by `tenant_id`
   - Worker dispatch ensures dedicated database per tenant
   - No cross-tenant data access

2. **Authentication:**
   - Desktop sync uses `X-Tenant-Id` header (validated by router)
   - Customer API will require JWT tokens (future)

3. **Data Validation:**
   - Required fields validated in handlers
   - Foreign key constraints in D1 schema
   - Input sanitization for SQL queries

## Monitoring and Debugging

### Logs to Check

```bash
# Worker logs (Cloudflare Dashboard)
wrangler tail --name handsfree-tenants

# Desktop logs (Browser DevTools Console)
[SubscriptionPluginSync] Syncing plans...
[SubscriptionPluginSync] Sync complete: 3 synced, 0 failed
```

### Common Issues

1. **Sync fails with "Plan not found":**
   - Ensure subscription plugin is installed
   - Check local database has data

2. **Worker returns 404:**
   - Verify routing is correct
   - Check `X-Tenant-Id` header is set

3. **Data not appearing in theme:**
   - Ensure weekly menu is published (`published = 1`)
   - Verify cuisine type filter matches

## Performance Optimization

1. **Batch Size:**
   - Plans/Weeks: 50 records per batch
   - Menu items: 100 records per batch

2. **Indexing:**
   - Indexed columns: `tenant_id`, `week_number`, `cuisine_type`
   - Composite indexes for common queries

3. **Caching:**
   - Theme worker can cache published menus (1 hour TTL)
   - Customer preferences cached per session

## Future Enhancements

1. **Real-time Updates:**
   - WebSocket integration for delivery status
   - Push notifications for meal reminders

2. **Analytics:**
   - Popular items tracking
   - Subscription churn analysis
   - Revenue forecasting

3. **Reverse Sync (Cloud → POS):**
   - Pull customer subscriptions to desktop
   - Sync delivery status updates
   - Bidirectional conflict resolution

## Support

For issues or questions:
- Check logs in desktop DevTools and Cloudflare Dashboard
- Review schema migrations in `plugins/subscription-meals/migrations/`
- Test sync with small data sets first
- Verify worker deployment with `wrangler deploy`
