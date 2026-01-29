# D1 Sync Implementation

Complete implementation for syncing local SQLite to Cloudflare D1 via Worker endpoints.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Local POS  │  ──────> │ Worker (API) │  ──────> │ D1 Database │
│  (SQLite)   │  Schema  │              │   HTTP   │  (Cloud)    │
└─────────────┘   +Data  └──────────────┘   API    └─────────────┘
```

## Worker Endpoints

The worker now provides these endpoints:

### 1. Provision Database
**POST** `/api/provision/:tenantId`

```json
{
  "databaseName": "tenant_abc_db",
  "schema": [
    "CREATE TABLE IF NOT EXISTS menu_items (...)",
    "CREATE INDEX IF NOT EXISTS ..."
  ]
}
```

**Response:**
```json
{
  "success": true,
  "databaseId": "uuid-here",
  "databaseName": "tenant_abc_db",
  "tableCount": 25
}
```

### 2. Sync Data
**POST** `/api/sync/:tenantId`

```json
{
  "dataType": "sales|tips|menu|staff|settings|floor-plan|inventory",
  "records": [...]
}
```

**Response:**
```json
{
  "success": true,
  "synced": 150,
  "failed": 2,
  "errors": ["Item xyz failed: ..."]
}
```

### 3. Check Status
**GET** `/api/provision/:tenantId/status`

**Response:**
```json
{
  "provisioned": true,
  "databaseId": "uuid-here",
  "databaseName": "tenant_abc_db",
  "tableCount": 25
}
```

## Rust Commands

### 1. Full Provisioning (First-time setup)

```rust
invoke('provision_d1_full', {
  tenantId: 'abc-123',
  dbPath: '/path/to/local.db',
  workerUrl: 'https://handsfree-tenant-router.suyesh.workers.dev'
})
```

This command:
1. Extracts schema from local SQLite
2. Creates D1 database via worker (or uses existing)
3. Syncs ALL data for all types:
   - Sales transactions
   - Tips
   - Menu (categories + items)
   - Staff
   - Settings
   - Floor plan (sections + tables)
   - Inventory (items + recipes)

**Returns:**
```typescript
{
  success: boolean;
  synced: number;        // Total records synced
  failed: number;        // Total records failed
  errors: string[];      // Error messages
  duration_ms: number;   // Total duration
}
```

### 2. Incremental Sync (Ongoing)

```rust
invoke('sync_to_d1', {
  tenantId: 'abc-123',
  dbPath: '/path/to/local.db',
  workerUrl: 'https://handsfree-tenant-router.suyesh.workers.dev',
  dataType: 'sales'  // or 'tips', 'menu', 'staff', etc.
})
```

Syncs only records for the specified data type.

### 3. Check Provisioning Status

```rust
invoke('check_d1_status', {
  tenantId: 'abc-123',
  workerUrl: 'https://handsfree-tenant-router.suyesh.workers.dev'
})
```

**Returns:**
```typescript
{
  provisioned: boolean;
  database_id?: string;
  database_name?: string;
  table_count?: number;
}
```

## Data Types

Each data type syncs specific tables:

| Data Type    | Tables Synced                  | Batch Format            |
|--------------|--------------------------------|-------------------------|
| `sales`      | `sales_transactions`          | Array of records        |
| `tips`       | `tips`                        | Array of records        |
| `menu`       | `menu_categories`, `menu_items` | `{categories:[], items:[]}` |
| `staff`      | `staff_users`                 | Array of records        |
| `settings`   | `restaurant_settings`         | Array (usually 1 record) |
| `floor-plan` | `floor_plan_sections`, `floor_plan_tables` | `{sections:[], tables:[]}` |
| `inventory`  | `bar_inventory_items`, `bar_recipes` | `{items:[], recipes:[]}` |

## Usage Example (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/core';

// First-time setup
async function initialSync() {
  const tenantId = 'my-restaurant-123';
  const dbPath = await getDatabasePath();
  const workerUrl = 'https://handsfree-tenant-router.suyesh.workers.dev';

  try {
    // Check if already provisioned
    const status = await invoke('check_d1_status', {
      tenantId,
      workerUrl
    });

    if (!status.provisioned) {
      // Full provision + data sync
      const result = await invoke('provision_d1_full', {
        tenantId,
        dbPath,
        workerUrl
      });

      console.log(`Synced ${result.synced} records`);
      if (result.errors.length > 0) {
        console.error('Errors:', result.errors);
      }
    }
  } catch (error) {
    console.error('Provisioning failed:', error);
  }
}

// Ongoing incremental sync
async function syncSales() {
  const result = await invoke('sync_to_d1', {
    tenantId: 'my-restaurant-123',
    dbPath: await getDatabasePath(),
    workerUrl: 'https://handsfree-tenant-router.suyesh.workers.dev',
    dataType: 'sales'
  });

  console.log(`Synced ${result.synced} sales records`);
}
```

## Deployment Checklist

### Worker Deployment

1. **Set API Token**:
   ```bash
   cd workers/handsfree-orders
   npx wrangler secret put CLOUDFLARE_API_TOKEN
   ```

2. **Deploy Worker**:
   ```bash
   npx wrangler deploy
   ```

3. **Verify**:
   ```bash
   curl https://handsfree-tenant-router.suyesh.workers.dev/health
   ```

### POS Configuration

1. Update `.env`:
   ```
   VITE_ORDERS_ENDPOINT=https://handsfree-tenant-router.suyesh.workers.dev
   ```

2. In your sync settings UI:
   - Enable cloud sync
   - Set worker URL
   - Run initial provisioning

## Error Handling

The system handles errors gracefully:

- **Database already exists**: Worker uses existing database
- **Network errors**: Returns error in response, local data unchanged
- **Partial failures**: Returns count of synced/failed records
- **Schema conflicts**: IF NOT EXISTS prevents errors

## Performance

- **Batch limits**:
  - Sales: 1000 records
  - Menu items: All (usually < 500)
  - Staff: All (usually < 100)

- **Worker execution**:
  - Uses HTTP API for D1 queries
  - No worker CPU limit issues
  - Handles large payloads

## Future Enhancements

1. **Incremental sync with timestamps**:
   - Track `last_synced_at` per table
   - Only sync changed records

2. **Bi-directional sync**:
   - Pull changes from D1 to local
   - Conflict resolution

3. **Real-time sync**:
   - WebSocket-based updates
   - Immediate propagation

## Troubleshooting

### Worker returns 500
- Check CLOUDFLARE_API_TOKEN is set
- Verify CLOUDFLARE_ACCOUNT_ID in wrangler.jsonc

### Provisioning fails
- Check database name format (letters, numbers, underscores only)
- Verify schema statements are valid SQL

### Sync returns 0 records
- Check database path is correct
- Verify tables exist in local SQLite
- Check WHERE clauses in extract functions
