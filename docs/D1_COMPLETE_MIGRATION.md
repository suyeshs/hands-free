# D1 Complete Database Migration Guide

## Overview

This guide covers the **complete D1 schema migration** for the Restaurant POS AI system. The D1 database acts as the **cloud sync layer** for multi-device coordination.

**Total Tables**: 37 tables requiring D1 sync
**Local-Only Tables**: 9 tables (not included in D1)

## Architecture

```
┌──────────────────────────────────────────┐
│     POS Device (Tauri App + SQLite)      │
│  ┌────────────────────────────────────┐  │
│  │  Local SQLite (56 tables)          │  │
│  │  - 37 tables sync to D1            │  │
│  │  - 9 tables local-only             │  │
│  └────────────────────────────────────┘  │
│              ↓ (Service Worker)          │
└──────────────────────────────────────────┘
                 ↓ HTTPS
┌──────────────────────────────────────────┐
│      Cloudflare Worker + D1 Database     │
│  ┌────────────────────────────────────┐  │
│  │  D1 Database (37 tables)           │  │
│  │  - Menu, Sales, Staff, Inventory   │  │
│  │  - Attendance, Tips, Floor Plan    │  │
│  │  - i18n, Settings, HR/Payroll      │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Critical Requirements

### Schema Matching

**⚠️ CRITICAL**: The D1 schema MUST exactly match local SQLite schema for sync to work.

- Same table names (case-sensitive)
- Same column names (snake_case)
- Same data types (TEXT, REAL, INTEGER, BOOLEAN)
- Same defaults and constraints
- Same indexes

**Any mismatch will cause sync failures.**

## Migration Steps

### Step 1: Apply D1 Migration

```bash
# Navigate to your project
cd path/to/restaurant-pos-ai

# Apply the complete migration
wrangler d1 execute <YOUR_DATABASE_NAME> --file=./docs/d1-complete-migration.sql

# Verify tables were created (should show 37 tables)
wrangler d1 execute <YOUR_DATABASE_NAME> --command="SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"

# List all tables
wrangler d1 execute <YOUR_DATABASE_NAME> --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

### Step 2: Verify Schema Match

Compare local SQLite with D1:

```bash
# Local SQLite schema
sqlite3 /path/to/local/database.db ".schema menu_items"

# D1 schema
wrangler d1 execute <YOUR_DATABASE_NAME> --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='menu_items'"
```

They should be **identical**.

### Step 3: Update Cloudflare Worker

Your Cloudflare Worker needs sync endpoints for each table category. See [Worker Endpoints](#worker-endpoints) section below.

## Tables by Category

### Core Tables (9 tables)
High-priority real-time sync required:

1. **staff_users** - Staff authentication
2. **staff_login_history** - Login audit trail
3. **table_sessions** - Active dine-in orders
4. **aggregator_orders** - Third-party delivery orders
5. **kds_orders** - Kitchen display orders
6. **sales_transactions** - Completed sales (critical)
7. **daily_cash_registers** - Cash reconciliation
8. **cash_payouts** - Expense tracking
9. **out_of_stock_items** - Item availability

### Menu Tables (2 tables)
Menu shared across all devices:

10. **menu_categories** - Menu structure
11. **menu_items** - Menu content with pricing

### Floor Plan Tables (3 tables)
Floor plan configuration and real-time status:

12. **floor_sections** - Dining sections
13. **floor_tables** - Table status and QR codes
14. **floor_staff_assignments** - Staff-section mapping

### Inventory Tables (8 tables)
Conditional sync based on `enable_inventory_sync` setting:

15. **suppliers** - Vendor information
16. **inventory_items** - Stock levels
17. **recipe_ingredients** - Recipe mappings
18. **inventory_documents** - Invoice OCR results
19. **inventory_transactions** - Audit trail
20. **inventory_barcode_mappings** - Barcode lookups
21. **delivery_verification_sessions** - Delivery verification

### Tips Table (1 table)
Tip tracking for service staff:

22. **tips** - Tips separate from sales

### HR/Payroll Tables (11 tables)
Staff scheduling, attendance, and payroll:

23. **attendance_records** - Clock in/out tracking
24. **weekly_rosters** - Weekly schedules
25. **roster_assignments** - Individual shifts
26. **leave_requests** - Time-off requests
27. **leave_balances** - Available leave days
28. **staff_salary** - Salary configuration
29. **staff_advances** - Advance payments
30. **staff_deductions** - Deductions/penalties
31. **staff_bonuses** - Performance bonuses
32. **staff_attendance** - Payroll attendance
33. **staff_payslips** - Monthly payslips

### i18n Tables (4 tables)
Multi-language support:

34. **translation_keys** - Translation key registry
35. **translations** - Base translations
36. **tenant_translation_overrides** - Custom translations
37. **tenant_settings** - Tenant preferences

### Settings Table (1 table)
Restaurant configuration:

38. **restaurant_settings** - Restaurant settings (singleton)

## Worker Endpoints

Your Cloudflare Worker needs these sync endpoints:

### Menu Endpoints
```typescript
POST /api/menu/:tenantId/sync
GET /api/menu/:tenantId
```

### Sales Endpoints
```typescript
POST /api/sales/:tenantId/sync
GET /api/sales/:tenantId/summary
GET /api/sales/:tenantId/transactions
```

### Tips Endpoints
```typescript
POST /api/tips/:tenantId/sync
GET /api/tips/:tenantId/summary
GET /api/tips/:tenantId/list
```

### Staff Endpoints
```typescript
POST /api/staff/:tenantId/sync
GET /api/staff/:tenantId
POST /api/staff/:tenantId/login-history/sync
```

### Floor Plan Endpoints
```typescript
POST /api/floor-plan/:tenantId/sync
GET /api/floor-plan/:tenantId
```

### Inventory Endpoints (if enabled)
```typescript
POST /api/inventory/:tenantId/suppliers/sync
POST /api/inventory/:tenantId/items/sync
POST /api/inventory/:tenantId/recipes/sync
POST /api/inventory/:tenantId/documents/sync
POST /api/inventory/:tenantId/transactions/sync
POST /api/inventory/:tenantId/barcodes/sync
```

### Attendance Endpoints
```typescript
POST /api/attendance/:tenantId/records/sync
POST /api/attendance/:tenantId/rosters/sync
POST /api/attendance/:tenantId/leave/sync
```

### Payroll Endpoints
```typescript
POST /api/payroll/:tenantId/salary/sync
POST /api/payroll/:tenantId/advances/sync
POST /api/payroll/:tenantId/deductions/sync
POST /api/payroll/:tenantId/bonuses/sync
POST /api/payroll/:tenantId/payslips/sync
```

### i18n Endpoints
```typescript
POST /api/i18n/:tenantId/translations/sync
GET /api/i18n/:tenantId/translations
```

### Settings Endpoint
```typescript
POST /api/settings/:tenantId/sync
GET /api/settings/:tenantId
```

## Example Worker Implementation

### Generic Sync Handler

```typescript
// Generic sync handler for any table
async function syncTable(
  db: D1Database,
  tableName: string,
  records: any[],
  columns: string[]
): Promise<{ synced: number }> {
  if (records.length === 0) return { synced: 0 };

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ${tableName}
    (${columns.join(', ')})
    VALUES (${placeholders})
  `);

  const batch = records.map((record) =>
    stmt.bind(...columns.map((col) => record[col]))
  );

  await db.batch(batch);

  return { synced: records.length };
}

// Menu sync endpoint
app.post('/api/menu/:tenantId/sync', async (c) => {
  const { tenantId } = c.req.param();
  const { categories, menuItems } = await c.req.json();

  const db = c.env.DB;

  // Sync categories
  if (categories && categories.length > 0) {
    await syncTable(db, 'menu_categories', categories, [
      'id', 'name', 'sort_order', 'active', 'icon',
      'description', 'created_at', 'updated_at', 'name_translations'
    ]);
  }

  // Sync menu items
  if (menuItems && menuItems.length > 0) {
    await syncTable(db, 'menu_items', menuItems, [
      'id', 'category_id', 'name', 'description', 'price', 'image',
      'active', 'preparation_time', 'allergens', 'dietary_tags',
      'name_translations', 'description_translations'
    ]);
  }

  return c.json({
    success: true,
    synced: {
      categories: categories?.length || 0,
      menuItems: menuItems?.length || 0
    }
  });
});
```

## Service Worker Integration

The POS uses a Service Worker to handle background sync. See `src/services/sync/service-worker.ts`.

### Sync Flow

1. **Local Change**: User creates/updates data in SQLite
2. **Queue Record**: Record added to sync queue
3. **Service Worker**: Detects pending changes
4. **Sync to D1**: Calls Cloudflare Worker endpoint
5. **Mark Synced**: Updates `synced_at` timestamp

### Sync Intervals

From `TieredSyncManager.ts`:

- **Tier 1** (1 minute): orders, tips, sales
- **Tier 2** (3 minutes): staff login history, cash payouts, inventory transactions
- **Tier 3** (10 minutes): menu, staff, inventory items
- **Tier 4** (30 minutes): cash registers, recipes

## Data Types

### JSON Columns

These columns store JSON as TEXT strings:

- `order_data`, `items_json` - Order/transaction items
- `allergens`, `dietary_tags` - Menu item tags
- `name_translations`, `description_translations` - i18n data
- `section_ids`, `table_ids` - Floor plan assignments
- `breaks_json` - Attendance breaks
- `extracted_data` - OCR results
- `packing_charges_by_category` - Packing charges config

**Important**: Always use `JSON.stringify()` when syncing and `JSON.parse()` when reading.

### Timestamps

- **INTEGER timestamps**: Unix epoch (seconds or milliseconds)
  - `login_at`, `clock_in_at`, `created_at` (in attendance)

- **TEXT timestamps**: ISO 8601
  - `created_at`, `updated_at`, `synced_at` (in most tables)
  - Format: `2026-01-23T10:30:00Z`

### Boolean Fields

SQLite/D1 use INTEGER for boolean:
- `1` = true
- `0` = false

## Testing Checklist

### Phase 1: D1 Setup
- [ ] Apply migration to D1 database
- [ ] Verify all 37 tables created
- [ ] Check indexes were created
- [ ] Verify foreign key constraints

### Phase 2: Worker Endpoints
- [ ] Implement sync endpoints for each category
- [ ] Test with sample data
- [ ] Verify INSERT OR REPLACE logic
- [ ] Test batch operations
- [ ] Check error handling

### Phase 3: POS Integration
- [ ] Upload menu on POS
- [ ] Verify local SQLite save
- [ ] Check Service Worker queue
- [ ] Wait for sync (or trigger manually)
- [ ] Verify data in D1

### Phase 4: Multi-Device Sync
- [ ] Change data on Device A
- [ ] Wait for sync
- [ ] Verify data appears on Device B
- [ ] Test conflict resolution
- [ ] Verify last-write-wins logic

### Phase 5: Specific Features
- [ ] Menu items sync correctly
- [ ] Sales transactions sync
- [ ] Tips sync
- [ ] Staff attendance syncs
- [ ] Floor plan updates sync
- [ ] Inventory changes sync (if enabled)
- [ ] Settings sync across devices

## Troubleshooting

### Sync Fails: "Table not found"
- Verify D1 migration was applied successfully
- Check table name matches exactly (case-sensitive)
- List tables: `wrangler d1 execute <DB> --command="SELECT name FROM sqlite_master WHERE type='table'"`

### Sync Fails: "Column not found"
- Schema mismatch between local SQLite and D1
- Compare schemas using `.schema` command
- Re-apply migration if needed

### Data Not Appearing in D1
- Check Service Worker is running (DevTools → Application → Service Workers)
- Inspect IndexedDB queue: DevTools → Application → IndexedDB → `sync-queue`
- Check worker logs in Cloudflare dashboard
- Verify `activate_online` is enabled in restaurant_settings

### Duplicate Key Errors
- D1 uses last-write-wins (INSERT OR REPLACE)
- Check UNIQUE constraints are identical to SQLite
- Verify primary key conflicts

### Slow Sync Performance
- Use batch operations (db.batch())
- Limit batch size to 100-500 records
- Add indexes on frequently queried columns
- Check network latency

## Rollback Plan

If migration fails or causes issues:

```sql
-- List all tables
SELECT name FROM sqlite_master WHERE type='table';

-- Drop all tables (DESTRUCTIVE!)
-- Save this SQL and run only if necessary
DROP TABLE IF EXISTS staff_users;
DROP TABLE IF EXISTS staff_login_history;
-- ... (repeat for all 37 tables)

-- Or drop and recreate entire database
-- (Use Cloudflare dashboard to delete and recreate D1 database)
```

## Performance Optimization

### Indexes

The migration includes all necessary indexes. Key indexes:

- **tenant_id**: Most queries filter by tenant
- **created_at/updated_at**: Time-based queries
- **synced_at**: Sync status queries
- **Foreign keys**: Join performance

### Batch Operations

Always use `db.batch()` for multiple inserts:

```typescript
// Good ✅
const batch = records.map(r => stmt.bind(...values));
await db.batch(batch);

// Bad ❌
for (const record of records) {
  await db.prepare(...).bind(...).run();
}
```

### Query Optimization

Use prepared statements and proper indexes:

```typescript
// Good ✅
const stmt = db.prepare('SELECT * FROM menu_items WHERE category_id = ?1 AND active = 1');
const result = await stmt.bind(categoryId).all();

// Bad ❌
const result = await db.prepare(`SELECT * FROM menu_items WHERE category_id = '${categoryId}'`).all();
```

## Security Considerations

### Tenant Isolation

All queries MUST filter by `tenant_id`:

```typescript
// Good ✅
SELECT * FROM sales_transactions WHERE tenant_id = ?1

// Bad ❌ - Exposes all tenants' data!
SELECT * FROM sales_transactions
```

### API Authentication

Implement authentication in Worker:

```typescript
// Example: Validate tenant API key
async function validateTenant(tenantId: string, apiKey: string): Promise<boolean> {
  // Check against KV store or D1 table
  const stored = await env.KV.get(`tenant:${tenantId}:api_key`);
  return stored === apiKey;
}
```

### Rate Limiting

Implement rate limiting per tenant:

```typescript
// Example using Durable Objects
const rateLimit = await env.RATE_LIMITER.get(
  env.RATE_LIMITER.idFromName(tenantId)
);
const allowed = await rateLimit.fetch('/check');
```

## Monitoring

### Key Metrics

Monitor these in Cloudflare dashboard:

- **Sync requests/minute**: Track sync volume
- **Failed syncs**: Error rate
- **D1 query time**: Performance
- **Worker CPU time**: Resource usage
- **D1 database size**: Storage growth

### Logging

Add structured logging:

```typescript
console.log(JSON.stringify({
  level: 'info',
  tenant: tenantId,
  table: tableName,
  recordssynced: count,
  duration_ms: Date.now() - startTime
}));
```

## Support

For issues with D1 migration:

1. Check Cloudflare D1 documentation: https://developers.cloudflare.com/d1/
2. Verify schema match between local SQLite and D1
3. Check worker logs in Cloudflare dashboard
4. Test with small dataset first (1-10 records)
5. Use `wrangler d1 execute` for manual testing

## Next Steps

After completing this migration:

1. ✅ Apply D1 migration (`d1-complete-migration.sql`)
2. ✅ Implement Worker sync endpoints
3. ✅ Test each endpoint with sample data
4. ✅ Enable `activate_online` in POS settings
5. ✅ Test full sync flow from POS to D1
6. ✅ Verify multi-device coordination
7. ✅ Monitor sync performance and errors
8. ✅ Set up alerts for failed syncs
9. ✅ Document any tenant-specific customizations
10. ✅ Train staff on multi-device workflows

## Related Files

- **D1 Migration SQL**: `docs/d1-complete-migration.sql` (this migration)
- **Menu Migration Guide**: `docs/D1_MENU_MIGRATION.md` (menu-specific details)
- **Tips Migration Guide**: `docs/D1_TIPS_MIGRATION.md` (tips-specific details)
- **Local SQLite Migrations**: `src-tauri/migrations/*.sql` (source of truth)
- **Service Worker**: `src/services/sync/service-worker.ts`
- **Sync Manager**: `src/services/sync/TieredSyncManager.ts`
- **Worker Example**: `docs/cloudflare-worker-sales-endpoints.ts`

---

**Status**: ✅ Migration SQL Ready
**Tables**: 37 tables for D1 sync
**Version**: Matches SQLite schema v3.1.0
**Last Updated**: 2026-01-23
