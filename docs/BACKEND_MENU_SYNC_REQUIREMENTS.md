# Backend Requirements: Automatic Menu Sync for Multi-Location

## Overview
The frontend has been updated to support automatic menu synchronization when location tenants activate. The backend needs to make **one simple change** to enable this feature.

---

## Required Backend Change

### Update `/api/pos/activate` Endpoint

**Current Response**:
```json
{
  "success": true,
  "data": {
    "tenantId": "location-tenant-456",
    "companyName": "Downtown Branch",
    "subdomain": "restaurant-downtown-1234",
    "apiBaseUrl": "https://restaurant-downtown-1234.handsfree.tech",
    "ordersEndpoint": "https://handsfree-orders.suyesh.workers.dev",
    "activated": true
  }
}
```

**Required Response** (add `masterTenantId` field):
```json
{
  "success": true,
  "data": {
    "tenantId": "location-tenant-456",
    "masterTenantId": "master-tenant-123",  // ← NEW FIELD
    "companyName": "Downtown Branch",
    "subdomain": "restaurant-downtown-1234",
    "apiBaseUrl": "https://restaurant-downtown-1234.handsfree.tech",
    "ordersEndpoint": "https://handsfree-orders.suyesh.workers.dev",
    "activated": true
  }
}
```

---

## Implementation Steps

### 1. Update Activation Endpoint Query

The backend needs to **JOIN** the `location_tenants` and `restaurant_chains` tables to retrieve the `master_tenant_id`.

**SQL Query Example**:
```sql
SELECT
  lt.location_tenant_id,
  lt.location_name,
  lt.subdomain,
  lt.d1_database_id,
  lt.kv_namespace_id,
  lt.r2_bucket_name,
  lt.worker_url,
  rc.master_tenant_id  -- ← JOIN to get master tenant ID
FROM location_tenants lt
LEFT JOIN restaurant_chains rc ON lt.chain_id = rc.id
WHERE lt.activation_code = ?
```

**Important Notes**:
- Use `LEFT JOIN` because master tenants (restaurants without a chain) won't have a `chain_id`
- For master tenants, `rc.master_tenant_id` will be `NULL`
- For location tenants, `rc.master_tenant_id` will contain the master's tenant ID

### 2. Update Response Structure

**TypeScript/Worker Implementation**:
```typescript
export async function handleActivation(
  request: Request,
  env: Env
): Promise<Response> {
  const { activationCode } = await request.json();

  // Query with JOIN to get master tenant ID
  const result = await env.DB.prepare(
    `SELECT
      lt.location_tenant_id,
      lt.location_name,
      lt.subdomain,
      lt.d1_database_id,
      lt.kv_namespace_id,
      lt.r2_bucket_name,
      lt.worker_url,
      rc.master_tenant_id
     FROM location_tenants lt
     LEFT JOIN restaurant_chains rc ON lt.chain_id = rc.id
     WHERE lt.activation_code = ?`
  ).bind(activationCode).first();

  if (!result) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid activation code'
    }), { status: 404 });
  }

  // Build response with masterTenantId
  const response = {
    success: true,
    data: {
      tenantId: result.location_tenant_id,
      masterTenantId: result.master_tenant_id || null,  // ← Include master tenant ID
      companyName: result.location_name,
      subdomain: result.subdomain,
      apiBaseUrl: `https://${result.subdomain}.handsfree.tech`,
      ordersEndpoint: import.meta.env.VITE_ORDERS_API_URL,
      activated: true,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## How It Works (Frontend Flow)

1. **Location device** enters activation code
2. **Backend** returns activation response with `masterTenantId`
3. **Frontend** detects `masterTenantId` and **automatically** calls:
   ```typescript
   invoke('fetch_and_load_master_menu', { masterTenantId })
   ```
4. **Rust command** fetches menu from `GET /api/menu/{masterTenantId}`
5. **Menu loaded** into location's local SQLite database
6. **Location POS** is ready to operate with master menu

**Zero manual intervention required!**

---

## Existing Endpoints (No Changes Needed)

The frontend uses the existing `GET /api/menu/{tenantId}` endpoint to fetch the menu:

```
GET /api/menu/{masterTenantId}
```

**Expected Response**:
```json
{
  "categories": [
    {
      "id": "cat-1",
      "name": "Appetizers",
      "nameHindi": "स्टार्टर",
      "description": "Delicious starters",
      "displayOrder": 1
    }
  ],
  "items": [
    {
      "id": "item-1",
      "name": "Chicken Tikka",
      "nameHindi": "चिकन टिक्का",
      "category": "cat-1",
      "description": "Grilled chicken",
      "price": 250,
      "photoUrl": "https://...",
      "cloudflareImageId": "abc123",
      "available": true,
      "isVegetarian": false,
      "spiceLevel": "medium",
      "displayOrder": 1
    }
  ]
}
```

This endpoint **already exists** and works correctly. No changes needed.

---

## Testing the Backend Change

### Test Case 1: Master Tenant Activation
**Activation Code**: Code for a **master** tenant (no chain)

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "tenantId": "master-tenant-123",
    "masterTenantId": null,  // ← NULL for master tenants
    "companyName": "Main Restaurant",
    ...
  }
}
```

**Frontend Behavior**: No menu sync (master tenant creates menu from scratch)

### Test Case 2: Location Tenant Activation
**Activation Code**: Code for a **location** tenant in a chain

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "tenantId": "location-tenant-456",
    "masterTenantId": "master-tenant-123",  // ← Master tenant ID
    "companyName": "Downtown Branch",
    ...
  }
}
```

**Frontend Behavior**: Automatically syncs menu from `master-tenant-123`

---

## Database Schema Reference

### `restaurant_chains` Table
```sql
CREATE TABLE restaurant_chains (
  id TEXT PRIMARY KEY,
  chain_name TEXT NOT NULL,
  master_tenant_id TEXT NOT NULL,  -- Links to master tenant
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### `location_tenants` Table
```sql
CREATE TABLE location_tenants (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,  -- Links to restaurant_chains.id
  location_tenant_id TEXT NOT NULL UNIQUE,
  location_name TEXT NOT NULL,
  activation_code TEXT NOT NULL UNIQUE,
  subdomain TEXT NOT NULL,
  ...
  FOREIGN KEY (chain_id) REFERENCES restaurant_chains(id)
);
```

**Relationship**:
```
location_tenants.chain_id → restaurant_chains.id
restaurant_chains.master_tenant_id → master tenant's ID
```

---

## Rollout Plan

### Phase 1: Backend Update (Required)
1. Update `/api/pos/activate` endpoint to include `masterTenantId`
2. Deploy to production
3. Test with both master and location tenant activation codes

### Phase 2: Automatic (No Action Needed)
- Existing location tenants: Menu sync happens on next activation
- New location tenants: Menu syncs automatically on first activation

### Phase 3: Future Enhancement (Optional)
- Add WebSocket notifications for real-time menu updates
- Implement "Push Menu" button to trigger immediate sync

---

## Summary

**Single Required Change**: Add `masterTenantId` to `/api/pos/activate` response

**How to Add It**:
1. JOIN `location_tenants` with `restaurant_chains`
2. Include `rc.master_tenant_id` in SELECT
3. Add to response JSON

**Expected Effort**: <30 minutes
**Impact**: Automatic menu sync for all location tenants

---

## Questions?

If you have any questions about the implementation, please reach out. The frontend is ready and waiting for this backend change!
