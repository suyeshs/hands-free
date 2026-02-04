# D1 Verification Endpoint Specification

This document specifies the D1 verification endpoint that needs to be implemented in the Cloudflare Worker to support data verification testing.

## Overview

The verification endpoint allows the POS system to confirm that synced data has actually arrived in the D1 database. This is critical for testing data integrity and sync reliability.

## Endpoint Specification

### POST `/api/sync/{tenantId}/verify`

Verifies that data exists in D1 for the specified tenant.

#### Request

**URL Parameters:**
- `tenantId` (string, required): The tenant identifier

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "tables": ["sales_transactions", "menu_items", "staff_users"]
}
```

**Body Schema:**
- `tables` (string[], required): Array of table names to check

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "tenantId": "tenant-123",
  "tables": {
    "sales_transactions": 145,
    "menu_items": 32,
    "staff_users": 8
  },
  "totalRecords": 185,
  "checkedAt": "2026-02-03T10:30:00.000Z"
}
```

**Response Schema:**
- `success` (boolean): Always true for successful requests
- `tenantId` (string): The tenant ID that was verified
- `tables` (object): Record counts per table
- `totalRecords` (number): Sum of all records across tables
- `checkedAt` (string): ISO timestamp of verification

**Error (404 Not Found):**
```json
{
  "success": false,
  "error": "Database not found for tenant",
  "tenantId": "tenant-123"
}
```

**Error (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid request: tables array is required"
}
```

## Implementation Example

### Cloudflare Worker (TypeScript)

```typescript
import { Env } from './types';

export async function handleVerifyRequest(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json();

    if (!body.tables || !Array.isArray(body.tables)) {
      return Response.json(
        {
          success: false,
          error: 'Invalid request: tables array is required',
        },
        { status: 400 }
      );
    }

    // Get D1 database for tenant
    const databaseId = await getTenantDatabaseId(env, tenantId);
    if (!databaseId) {
      return Response.json(
        {
          success: false,
          error: 'Database not found for tenant',
          tenantId,
        },
        { status: 404 }
      );
    }

    const db = env.D1_DATABASES[databaseId];
    if (!db) {
      return Response.json(
        {
          success: false,
          error: 'Database connection failed',
          tenantId,
        },
        { status: 500 }
      );
    }

    // Query record counts for each table
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (const tableName of body.tables) {
      // Sanitize table name to prevent SQL injection
      const sanitizedTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');

      try {
        const result = await db
          .prepare(`SELECT COUNT(*) as count FROM ${sanitizedTable}`)
          .first();

        const count = result?.count || 0;
        tableCounts[tableName] = count;
        totalRecords += count;
      } catch (error) {
        // Table doesn't exist or query failed
        tableCounts[tableName] = 0;
      }
    }

    return Response.json({
      success: true,
      tenantId,
      tables: tableCounts,
      totalRecords,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[D1 Verify] Error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to get database ID for tenant
async function getTenantDatabaseId(env: Env, tenantId: string): Promise<string | null> {
  // Implementation depends on your tenant → database mapping
  // Could be stored in KV, another D1 database, or hardcoded mapping

  // Example: Query tenant config from KV
  const config = await env.TENANT_CONFIG.get(tenantId, 'json');
  return config?.databaseId || null;
}
```

### Worker Route Registration

Add to your worker's routing:

```typescript
// In your worker's fetch handler
if (request.method === 'POST' && url.pathname.match(/^\/api\/sync\/([^/]+)\/verify$/)) {
  const tenantId = url.pathname.split('/')[3];
  return handleVerifyRequest(request, env, tenantId);
}
```

## Security Considerations

1. **Authentication**: Consider adding API key or JWT authentication
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **SQL Injection**: Always sanitize table names (use allowlist)
4. **CORS**: Configure appropriate CORS headers for browser requests

## Example CORS Headers

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS preflight
if (request.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}

// Add to response
return Response.json(data, { headers: corsHeaders });
```

## Testing the Endpoint

### Using curl

```bash
curl -X POST https://handsfree-orders.suyesh.workers.dev/api/sync/tenant-123/verify \
  -H "Content-Type: application/json" \
  -d '{"tables": ["sales_transactions", "menu_items"]}'
```

### Using JavaScript (Browser)

```javascript
const response = await fetch(
  'https://handsfree-orders.suyesh.workers.dev/api/sync/tenant-123/verify',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tables: ['sales_transactions', 'menu_items', 'staff_users'],
    }),
  }
);

const result = await response.json();
console.log('Verification result:', result);
```

## Performance Considerations

- **Caching**: Consider caching counts for large tables (with TTL)
- **Batch Queries**: Execute COUNT queries in parallel
- **Index Usage**: Ensure tables have appropriate indexes
- **Timeout**: Set reasonable timeout for multiple table queries

## Alternative: Record-Level Verification

For more precise verification, you can also implement record-level checking:

```typescript
// POST /api/sync/{tenantId}/verify-record
{
  "table": "sales_transactions",
  "recordId": "test-sale-1234567890"
}

// Response
{
  "success": true,
  "exists": true,
  "record": {
    "id": "test-sale-1234567890",
    "total_amount": 25.99,
    "created_at": "2026-02-03T10:00:00.000Z"
  }
}
```

This allows testing that specific synced records exist in D1.

## Monitoring and Logging

Implement logging for verification requests:

```typescript
console.log('[D1 Verify]', {
  tenantId,
  tables: body.tables,
  totalRecords,
  duration: Date.now() - startTime,
});
```

Track metrics:
- Verification requests per tenant
- Average verification duration
- Error rates
- Most frequently verified tables

## Integration with POS System

The POS system will use this endpoint in:

1. **Quick Test** (CloudSyncSettings component)
   - Creates test record
   - Syncs to D1
   - Verifies record exists

2. **Full Test Suite** (D1SyncTest page)
   - Runs comprehensive tests
   - Verifies all data types
   - Displays verification results

3. **Automated Monitoring** (future)
   - Periodic verification checks
   - Alert on verification failures
   - Data integrity dashboard
