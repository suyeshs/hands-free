# D1 Sync Debugging - Data Not Appearing in D1

## Problem

- ✅ Sync reports SUCCESS (5 menu items synced)
- ❌ D1 Studio shows empty `menu_items` table
- ❌ Verification endpoint returns 404

## Likely Causes

### 1. Database ID Mismatch (Most Likely)

The sync is writing to a different D1 database than the one shown in Studio (`munich-917l_db`).

**Check this**:
```sql
-- In your local SQLite database, run:
SELECT tenant_id, d1_database_id FROM tenant_config;
```

**In Cloudflare Dashboard**:
1. Go to D1 Databases
2. Find database: `munich-917l_db`
3. Check if this is the database bound to your worker

### 2. Worker Binding Issue

The worker may have the wrong D1 binding or is using a different database.

**Check in Cloudflare Dashboard**:
- Worker: `handsfree-tenant-router`
- Settings → Bindings
- Look for D1 Database binding
- Verify it points to `munich-917l_db`

### 3. Sync Endpoint Not Implementing Writes

The `/api/sync/:tenantId` endpoint might be accepting requests but not writing to D1.

**Check worker code**:
```typescript
// The endpoint should be doing this:
export async function handleSync(request, env) {
  const { dataType, records } = await request.json();

  // MUST write to D1
  for (const record of records) {
    await env.DB.prepare(
      'INSERT INTO menu_items (...) VALUES (...)'
    ).bind(...).run();
  }

  return { synced: records.length };
}
```

## Quick Diagnostic Steps

### Step 1: Check Tenant Config

Run this in your app's diagnostics console:

```typescript
import { invoke } from '@tauri-apps/api/core';

const config = await invoke('get_tenant_config');
console.log('Tenant ID:', config.tenantId);
console.log('D1 Database ID:', config.d1DatabaseId);
console.log('Orders Endpoint:', config.ordersEndpoint);
```

**Expected Output**:
```
Tenant ID: airarang-8131 (or similar)
D1 Database ID: <uuid> or munich-917l_db
Orders Endpoint: https://handsfree-tenant-router.suyesh.workers.dev
```

### Step 2: Verify D1 Database in Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **D1 Databases**
3. Find the database shown in Studio: `munich-917l_db`
4. Click on it
5. Check the **Database ID** (top right)
6. Compare with your tenant config's `d1DatabaseId`

### Step 3: Test Sync Endpoint Directly

```bash
# Test the sync endpoint manually
curl -X POST https://handsfree-tenant-router.suyesh.workers.dev/api/sync/airarang-8131 \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "menu_items",
    "records": [{
      "id": "test-item-1",
      "name": "Test Item",
      "category_id": "cat-test",
      "price": 9.99,
      "active": 1
    }]
  }'
```

**Expected Response**:
```json
{
  "synced": 1,
  "failed": 0,
  "errors": []
}
```

**Then check D1 Studio**:
- Refresh the `menu_items` table
- Should see the test item

### Step 4: Check Worker Logs

In Cloudflare Dashboard:
1. Go to Workers & Pages
2. Find `handsfree-tenant-router`
3. Click **Logs** (or use `wrangler tail`)
4. Run sync again
5. Look for:
   - Incoming requests to `/api/sync/:tenantId`
   - SQL statements being executed
   - Any errors

## Common Fixes

### Fix 1: Update D1 Database ID in Tenant Config

If the database ID is wrong or missing:

```typescript
// In your app, update the tenant config:
await invoke('update_tenant_config', {
  updates: {
    d1_database_id: 'correct-database-id-from-cloudflare'
  }
});
```

Or manually in SQLite:
```sql
UPDATE tenant_config
SET d1_database_id = 'correct-database-id'
WHERE tenant_id = 'your-tenant-id';
```

### Fix 2: Verify Worker Has Correct D1 Binding

In `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "munich-917l_db"
database_id = "your-actual-database-id"
```

Redeploy:
```bash
wrangler deploy
```

### Fix 3: Implement Sync Endpoint Properly

If the endpoint isn't writing to D1, the worker code needs:

```typescript
// workers/tenant-router/src/sync.ts
export async function handleSync(request: Request, env: Env): Promise<Response> {
  const { tenantId } = request.params;
  const { dataType, records } = await request.json();

  let synced = 0;
  let failed = 0;
  const errors = [];

  for (const record of records) {
    try {
      // CRITICAL: Actually write to D1
      if (dataType === 'menu_items') {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO menu_items
          (id, category_id, name, description, price, image, active, preparation_time, allergens, dietary_tags, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          record.id,
          record.category_id,
          record.name,
          record.description || '',
          record.price,
          record.image || null,
          record.active ? 1 : 0,
          record.preparation_time || 15,
          record.allergens || '[]',
          record.dietary_tags || '[]',
          tenantId
        ).run();

        synced++;
      }
    } catch (error) {
      failed++;
      errors.push(error.message);
    }
  }

  return Response.json({ synced, failed, errors });
}
```

## Verification Checklist

After applying fixes, verify:

- [ ] Tenant config has correct `d1DatabaseId`
- [ ] Worker has correct D1 binding
- [ ] Sync endpoint writes to D1 (not just returning success)
- [ ] Manual curl test creates data in D1
- [ ] App sync creates data in D1
- [ ] D1 Studio shows the data
- [ ] Verification endpoint returns data (not 404)

## Expected Working Flow

1. **Local SQLite**: Menu upload creates 4 items ✅
2. **Sync triggered**: TieredSyncManager calls D1SyncService
3. **HTTP request**: POST to `/api/sync/:tenantId` with records
4. **Worker receives**: `handsfree-tenant-router` gets request
5. **Worker writes**: Inserts records into D1 using `env.DB`
6. **D1 persists**: Data saved to `munich-917l_db`
7. **Studio shows**: Data visible in D1 Studio ✅

**Currently failing at step 5 or 6** - Worker either:
- Not receiving requests
- Not writing to D1
- Writing to wrong D1 database

## Debug Commands

### Check Local Data
```bash
# Find your local database
find ~ -name "airarang-8131.db" -o -name "*.db" | grep -v node_modules

# Query it
sqlite3 /path/to/your.db "SELECT COUNT(*) FROM menu_items;"
sqlite3 /path/to/your.db "SELECT id, name, price FROM menu_items LIMIT 5;"
```

### Check D1 Data
```bash
# Using Wrangler CLI
wrangler d1 execute munich-917l_db --command "SELECT COUNT(*) FROM menu_items"
wrangler d1 execute munich-917l_db --command "SELECT * FROM menu_items LIMIT 5"
```

### Check Worker Logs
```bash
# Tail worker logs
wrangler tail handsfree-tenant-router

# Then trigger a sync from your app
# You should see logs showing the sync request
```

## Next Steps

1. **Verify Database ID**: Check tenant config and Cloudflare dashboard match
2. **Test Sync Endpoint**: Use curl to manually insert data
3. **Check Worker Logs**: Confirm requests are reaching the worker
4. **Fix Worker Code**: Ensure it's actually writing to D1
5. **Redeploy**: Deploy updated worker configuration
6. **Test Again**: Run sync and check D1 Studio

## Contact Support

If still not working, provide:
- Tenant ID
- D1 Database ID (from config)
- D1 Database Name (from Studio)
- Worker logs during sync
- Sync response JSON
