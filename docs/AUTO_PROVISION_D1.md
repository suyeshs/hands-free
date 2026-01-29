# Per-Tenant D1 Database Architecture

## Overview

The Restaurant POS system uses **per-tenant D1 databases** - each tenant gets their own dedicated Cloudflare D1 database during provisioning. This provides complete database isolation and simplifies multi-device sync.

## Current Architecture

**Per-Tenant D1 Databases** with complete isolation:
- Each tenant gets their own dedicated D1 database
- Database naming: `{subdomain}_db` (e.g., `test-restaurant-123_db`)
- No `tenant_id` column needed - entire database belongs to one tenant
- Provisioned automatically during tenant creation via domain-service worker

### Benefits of Per-Tenant Databases

✅ **Complete Isolation**: Tenant data never mixes
✅ **Simpler Queries**: No need to filter by `tenant_id` in every query
✅ **Independent Scaling**: Each tenant's database scales independently
✅ **Security**: Database-level isolation prevents cross-tenant data leaks
✅ **Easy Backups**: Backup/restore per tenant without affecting others
✅ **Performance**: Smaller databases = faster queries

## Automatic Provisioning Flow

When a new tenant is created, the domain-service worker automatically:

```
1. Generate unique subdomain (e.g., "test-restaurant-123")
   ↓
2. Create D1 database via Cloudflare API
   - Database name: {subdomain}_db
   - Returns: database_id
   ↓
3. Apply POS schema (45 tables)
   - Execute d1-complete-migration.sql
   - Via Cloudflare D1 API
   ↓
4. Store tenant metadata in KV
   - tenant:{tenantId} -> database_id, database_name
   ↓
5. Tenant is ready to use
```

**Location**: `/platform/workers/domain-service/src/core/subdomain-service.ts`

The provisioning is fully automatic - no manual database creation needed.

## How POS App Finds Its Database

### Tenant Metadata Storage

Each tenant's database information is stored in KV:

**KV Namespace**: `TENANT_METADATA`
**Key**: `tenant:{tenantId}`
**Value**:
```json
{
  "tenant_id": "test-restaurant-123",
  "subdomain": "test-restaurant-123",
  "full_domain": "test-restaurant-123.handsfree.tech",
  "database_id": "abc123-def456-789...",
  "database_name": "test-restaurant-123_db",
  "kv_namespace_id": "...",
  "r2_bucket_name": "...",
  "created_at": "2026-01-23T..."
}
```

### On Application Start

The POS application retrieves its database information:

```typescript
// Get tenant ID (from activation or localStorage)
const tenantId = getTenantId();

// Fetch tenant metadata from Cloudflare Worker
const metadata = await fetch(`${apiUrl}/api/tenant-metadata/${tenantId}`);
const { database_id, database_name } = await metadata.json();

// Store database info for sync operations
localStorage.setItem('d1_database_id', database_id);
localStorage.setItem('d1_database_name', database_name);
```

### During Sync Operations

When syncing data to cloud:

```typescript
// Read database ID from metadata
const databaseId = localStorage.getItem('d1_database_id');
const tenantId = localStorage.getItem('tenantId');

// Sync to tenant-specific database
await fetch(`${apiUrl}/api/sync`, {
  method: 'POST',
  headers: {
    'X-Tenant-ID': tenantId,
    'X-Database-ID': databaseId, // Routes to correct tenant database
  },
  body: JSON.stringify({ data: syncPayload })
});
```

## Cloudflare Worker Routing

The Cloudflare Worker routes requests to the correct tenant database using the D1 API:

```typescript
// Cloudflare Worker endpoint
app.post('/api/sync', async (c) => {
  const tenantId = c.req.header('X-Tenant-ID');

  // Get tenant's database info from KV
  const metadata = await c.env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json');

  if (!metadata) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  // Execute query on tenant-specific database using Cloudflare API
  const result = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${metadata.database_id}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: 'INSERT INTO menu_items (...) VALUES (...)' })
    }
  );

  return c.json(await result.json());
});
```

**Note**: Since Workers don't support dynamic D1 bindings, use Cloudflare D1 API for per-tenant routing
    -- Example: await env.R2.get('migrations/d1-complete-migration.sql')
  `).raw();

  // Apply migration
  await db.batch([
    // Parse and execute migration SQL
    // Note: D1 doesn't support .exec() for multi-statement SQL
    // You'd need to split the migration into individual statements


## D1 Status Monitoring

### D1StatusCard Implementation

Update D1StatusCard to check tenant-specific database:

```typescript
// src/components/home/D1StatusCard.tsx

export function D1StatusCard() {
  const [status, setStatus] = useState<D1Status | null>(null);

  const checkD1Status = async () => {
    const tenantId = localStorage.getItem('tenantId');
    const apiUrl = localStorage.getItem('api-base-url');

    // Fetch status from tenant-specific database
    const response = await fetch(`${apiUrl}/api/d1-status/${tenantId}`);
    const data = await response.json();

    setStatus({
      isProvisioned: data.tableCount === 45,
      tableCount: data.tableCount || 0,
      requiredTables: 45,
      missingTables: data.missingTables || [],
      databaseId: data.databaseId,
      databaseName: data.databaseName,
      lastChecked: new Date().toISOString(),
    });
  };

  return (
    // UI shows tenant's database status
  );
}
```

### D1 Status Endpoint

Cloudflare Worker endpoint to check tenant database:

```typescript
/**
 * GET /api/d1-status/:tenantId
 * Returns D1 provisioning status for tenant's dedicated database
 */
app.get('/api/d1-status/:tenantId', async (c) => {
  const { tenantId } = c.req.param();

  // Get tenant's database info from KV
  const metadata = await c.env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json');

  if (!metadata) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  // Query tenant's D1 database via Cloudflare API
  const result = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${metadata.database_id}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      })
    }
  );

  const data = await result.json();
  const tableCount = data.result[0]?.results[0]?.count || 0;

  return c.json({
    success: true,
    tenantId,
    databaseId: metadata.database_id,
    databaseName: metadata.database_name,
    isProvisioned: tableCount >= 45,
    tableCount,
    requiredTables: 45,
    checkedAt: new Date().toISOString()
  });
});
```

## Comparison: Shared vs Per-Tenant

| Aspect | Shared Database (Old) | Per-Tenant Database (Current) |
|--------|----------------|------------------------------|
| **Isolation** | Row-level (tenant_id) | Database-level |
| **Security** | Medium | High |
| **Queries** | Must filter by tenant_id | No filtering needed |
| **Scaling** | All tenants limited by one DB | Each scales independently |
| **Backups** | All-or-nothing | Per-tenant |
| **Cost** | Lower (1 database) | Higher (N databases) |
| **Provisioning** | Once | Per tenant |
| **Complexity** | Simpler | More complex |

## Test the Implementation

```bash
# Get tenant metadata
curl https://handsfree-restaurant-client.suyesh.workers.dev/api/tenant-metadata/test-restaurant-123

# Should return:
# {
#   "tenant_id": "test-restaurant-123",
#   "database_id": "abc123-def456...",
#   "database_name": "test-restaurant-123_db"
# }

# Check D1 status for tenant
curl https://handsfree-restaurant-client.suyesh.workers.dev/api/d1-status/test-restaurant-123

# Should return:
# {
#   "success": true,
#   "tenantId": "test-restaurant-123",
#   "databaseId": "abc123...",
#   "databaseName": "test-restaurant-123_db",
#   "isProvisioned": true,
#   "tableCount": 45,
#   "requiredTables": 45,
#   "checkedAt": "2026-01-23T..."
# }
```

### Update D1StatusCard

The D1StatusCard automatically calls this endpoint and shows:
- ✅ Green when 45/45 tables provisioned
- ⚠️ Amber when tables are missing
- Database ID and name

## Best Practices

1. **Always provision during tenant creation** - Don't rely on lazy initialization
2. **Store database metadata in KV** - Fast lookups, no API calls
3. **Use Cloudflare D1 API for routing** - Workers don't support dynamic bindings
4. **Monitor provisioning status** - Track failures, retry if needed
5. **Apply complete schema upfront** - Don't split into multiple phases
6. **Backup tenant databases regularly** - Use Cloudflare's backup features
7. **Test provisioning flow end-to-end** - Ensure all 45 tables are created

## Adding Full POS Schema to Provisioner

To ensure tenants get the full 45-table POS schema during provisioning:

### Option 1: Update database-provisioner.ts

Replace the storefront schema with the complete POS schema:

```typescript
// /platform/workers/domain-service/src/core/database-provisioner.ts

private getSchemaSQL(): string {
  return POS_SCHEMA_SQL; // Import from d1-complete-migration.sql
}
```

### Option 2: Store Schema in R2

Store full schema in R2, fetch during provisioning:

```typescript
// Fetch complete schema from R2
const schemaObj = await env.R2_BUCKET.get('schemas/pos-complete-schema.sql');
const schemaSQL = await schemaObj.text();

// Apply to tenant database
await provisioner.executeSchema(databaseId, schemaSQL);
```

## Related Files

- **Domain Service**: `/platform/workers/domain-service/`
- **Database Provisioner**: `/platform/workers/domain-service/src/core/database-provisioner.ts`
- **Subdomain Service**: `/platform/workers/domain-service/src/core/subdomain-service.ts`
- **POS Schema**: `/docs/d1-complete-migration.sql`
- **Schema Sync Process**: `/SCHEMA_SYNC_PROCESS.md`
- **Sync Triggers**: `/SYNC_TRIGGERS.md`
- **D1 Status Card**: `/src/components/home/D1StatusCard.tsx`

---

**Last Updated**: 2026-01-23
**Architecture**: Per-Tenant D1 Databases
**Total Tables**: 45 (38 core + 7 bar management)
**Provisioning**: Automatic via domain-service worker
