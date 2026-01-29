# HandsFree Orders Worker

Cloudflare Worker for HandsFree restaurant POS system, providing:

- **D1 Database Provisioning**: Create D1 databases with custom schemas from POS
- **Data Synchronization**: Unified endpoint for syncing SQLite → D1
- **WebSocket Support**: Real-time order updates via Durable Objects
- **Order Queries**: REST API for querying orders

## Architecture

This worker replaces the need for R2-based schema provisioning. Instead, it:

1. Receives custom schema from POS (extracted from local SQLite)
2. Creates D1 database via Cloudflare API
3. Applies schema statements one by one
4. Stores metadata in KV for status tracking
5. Provides sync endpoints for incremental data updates

## Prerequisites

- Node.js 18+ or Bun
- Cloudflare account with Workers enabled
- Wrangler CLI: `npm install -g wrangler`

## Installation

```bash
cd workers/handsfree-orders
npm install
```

## Configuration

### 1. Set Cloudflare Account ID

Update `wrangler.jsonc`:

```jsonc
"vars": {
  "CLOUDFLARE_ACCOUNT_ID": "your-account-id-here"
}
```

### 2. Create KV Namespace

```bash
# Production
wrangler kv:namespace create "TENANT_METADATA"

# Preview (for development)
wrangler kv:namespace create "TENANT_METADATA" --preview
```

Update the KV namespace IDs in `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "TENANT_METADATA",
    "id": "YOUR_PRODUCTION_KV_ID",
    "preview_id": "YOUR_PREVIEW_KV_ID"
  }
]
```

### 3. Create Placeholder D1 Database

```bash
wrangler d1 create handsfree_orders_db
```

Update the database ID in `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "handsfree_orders_db",
    "database_id": "YOUR_D1_DATABASE_ID"
  }
]
```

**Note**: This is just a placeholder binding. Tenant-specific D1 databases are created dynamically via the provisioning endpoint.

### 4. Set Secrets

```bash
# Cloudflare API token with D1 and KV permissions
wrangler secret put CLOUDFLARE_API_TOKEN

# Optional: Cloudflare Access Service Token for authentication
wrangler secret put CF_ACCESS_CLIENT_ID
wrangler secret put CF_ACCESS_CLIENT_SECRET
```

**Cloudflare API Token Permissions:**
- Account > D1 > Edit
- Account > Workers KV Storage > Edit
- Account > Workers Scripts > Edit

## Development

```bash
# Start local development server
npm run dev

# Test endpoints locally
curl http://localhost:8787/health
```

## Deployment

```bash
# Deploy to production
npm run deploy

# View logs
npm run tail
```

## API Endpoints

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "handsfree-orders",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Provision D1 Database

```http
POST /api/provision/:tenantId
```

Request body:
```json
{
  "databaseName": "test-restaurant-123_db",
  "schema": [
    "CREATE TABLE IF NOT EXISTS sales_transactions (...)",
    "CREATE TABLE IF NOT EXISTS menu_items (...)",
    "CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_transactions(completed_at)"
  ]
}
```

Response:
```json
{
  "success": true,
  "databaseId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "databaseName": "test-restaurant-123_db",
  "tableCount": 25
}
```

### Check Provisioning Status

```http
GET /api/provision/:tenantId/status
```

Response:
```json
{
  "provisioned": true,
  "databaseId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "databaseName": "test-restaurant-123_db",
  "tableCount": 25,
  "provisionedAt": "2024-01-01T00:00:00.000Z",
  "schemaVersion": "1.0"
}
```

### Sync Data

```http
POST /api/sync/:tenantId
```

Request body:
```json
{
  "dataType": "sales",
  "records": [
    {
      "id": "sale-123",
      "tenant_id": "test-restaurant-123",
      "order_id": "order-456",
      "total_amount": 45.50,
      "payment_method": "card",
      "completed_at": "2024-01-01T12:00:00.000Z",
      "created_at": "2024-01-01T11:50:00.000Z",
      "updated_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

**Supported Data Types:**
- `sales` - Sales transactions
- `tips` - Tip records
- `menu` - Menu items and categories (send as `[{ items: [], categories: [] }]`)
- `staff` - Staff members
- `settings` - Restaurant settings
- `floor-plan` - Floor plan sections and tables (send as `[{ sections: [], tables: [] }]`)
- `inventory` - Bar inventory items and recipes (send as `[{ items: [], recipes: [] }]`)

Response:
```json
{
  "synced": 1,
  "failed": 0,
  "errors": []
}
```

### Query Orders

```http
GET /api/orders/:tenantId
```

Response:
```json
{
  "orders": [...],
  "count": 50
}
```

### WebSocket Connection

```http
ws://handsfree-orders.suyesh.workers.dev?tenantId=test-restaurant-123
```

Real-time order updates using Durable Objects.

## Testing

From the POS system:

```typescript
import { d1ProvisioningService } from './services/d1ProvisioningService';

// 1. Provision D1 for a tenant
const result = await d1ProvisioningService.provisionD1(
  'test-restaurant-123',
  '/path/to/test-restaurant-123.db',
  (progress) => {
    console.log(progress.message, progress.progress);
  }
);

// 2. Check status
const status = await d1ProvisioningService.checkStatus('test-restaurant-123');
console.log('D1 Provisioned:', status.provisioned);

// 3. Sync data
import { createD1SyncService } from './services/sync/D1SyncService';
const syncService = createD1SyncService('test-restaurant-123');
const syncResult = await syncService.syncSalesToD1();
console.log('Synced:', syncResult.synced, 'Failed:', syncResult.failed);
```

## Troubleshooting

### "Database not found" errors

- Ensure the placeholder D1 database exists in `wrangler.jsonc`
- Check that `CLOUDFLARE_ACCOUNT_ID` is correct
- Verify `CLOUDFLARE_API_TOKEN` has D1 permissions

### "Failed to create D1 database" errors

- Check Cloudflare API token permissions
- Verify account has D1 enabled (paid plan may be required)
- Check rate limits (max 10 databases per account on free plan)

### Sync errors

- Verify D1 is provisioned: `GET /api/provision/:tenantId/status`
- Check that table schema matches records being synced
- Look at worker logs: `npm run tail`

## Architecture Notes

### Why Schema from SQLite?

The schema is extracted from local SQLite instead of R2 because:

1. **Modular Features**: Different restaurant types (QSR, fine dining, bar) have different tables
2. **Subscription-Based**: Premium features add tables (inventory, multi-location)
3. **No Schema Drift**: D1 always matches local SQLite exactly
4. **Custom Configurations**: Each restaurant's D1 reflects their active features

### Offline-First Design

- Local SQLite is the source of truth
- D1 acts as cloud backup + multi-device sync layer
- POS remains fully functional without internet
- Sync queue retries failed uploads

### Performance

- Batch sync: Max 500 records per request
- Tiered sync intervals: 1min (sales) → 30min (inventory)
- Idempotent sync: `INSERT OR REPLACE` for safety
- WebSocket for real-time updates

## License

MIT
