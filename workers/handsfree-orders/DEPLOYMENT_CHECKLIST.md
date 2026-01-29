# Deployment Checklist - HandsFree Orders Worker

Quick deployment guide for the cloud sync worker.

## Prerequisites

- [x] Cloudflare account with Workers enabled
- [x] Wrangler CLI installed (`npm install -g wrangler`)
- [x] Cloudflare API token with permissions:
  - Account > D1 > Edit
  - Account > Workers KV Storage > Edit
  - Account > Workers Scripts > Edit

## Step 1: Configure Wrangler

### 1.1 Get Your Account ID

```bash
wrangler whoami
# Copy your Account ID
```

### 1.2 Update wrangler.jsonc

```jsonc
{
  "vars": {
    "CLOUDFLARE_ACCOUNT_ID": "YOUR_ACCOUNT_ID_HERE",
    "WORKER_URL": "https://handsfree-orders.suyesh.workers.dev"
  }
}
```

## Step 2: Create Resources

### 2.1 Create KV Namespace

```bash
# Production
wrangler kv:namespace create "TENANT_METADATA"
# Output: ✅ Created namespace with id: abc123...

# Preview (for development)
wrangler kv:namespace create "TENANT_METADATA" --preview
# Output: ✅ Created namespace with id: def456...
```

Update `wrangler.jsonc`:
```jsonc
"kv_namespaces": [
  {
    "binding": "TENANT_METADATA",
    "id": "abc123...",           // Production ID
    "preview_id": "def456..."    // Preview ID
  }
]
```

### 2.2 Create Placeholder D1 Database

```bash
wrangler d1 create handsfree_orders_db
# Output: ✅ Successfully created DB 'handsfree_orders_db'
#         database_id: xyz789...
```

Update `wrangler.jsonc`:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "handsfree_orders_db",
    "database_id": "xyz789..."
  }
]
```

**Note:** This is just a placeholder binding. Tenant-specific D1 databases are created dynamically via the `/api/provision` endpoint.

## Step 3: Set Secrets

### 3.1 Cloudflare API Token

Create API token at: https://dash.cloudflare.com/profile/api-tokens

Required permissions:
- Account > D1 > Edit
- Account > Workers KV Storage > Edit
- Account > Workers Scripts > Edit

```bash
wrangler secret put CLOUDFLARE_API_TOKEN
# Paste your token when prompted
```

### 3.2 (Optional) Cloudflare Access Tokens

If using Cloudflare Access for authentication:

```bash
wrangler secret put CF_ACCESS_CLIENT_ID
wrangler secret put CF_ACCESS_CLIENT_SECRET
```

## Step 4: Deploy

### 4.1 Install Dependencies

```bash
npm install
```

### 4.2 Deploy to Production

```bash
npm run deploy
# or
wrangler deploy
```

Expected output:
```
✨ Built successfully
✅ Uploaded handsfree-orders
✅ Deployed handsfree-orders
   https://handsfree-orders.suyesh.workers.dev
```

### 4.3 Verify Deployment

```bash
# Health check
curl https://handsfree-orders.suyesh.workers.dev/health

# Expected response:
# {
#   "status": "ok",
#   "service": "handsfree-orders",
#   "version": "1.0.0",
#   "timestamp": "2024-01-01T00:00:00.000Z"
# }
```

## Step 5: Update POS Environment

Update `.env` in the POS app:

```bash
# Orders Worker API (for D1 provisioning and sync)
VITE_ORDERS_API_URL=https://handsfree-orders.suyesh.workers.dev

# Orders Worker endpoint for provisioning
VITE_ORDERS_ENDPOINT=https://handsfree-orders.suyesh.workers.dev
```

## Step 6: Test Provisioning

### 6.1 Test from POS

```typescript
// In POS app (Settings → Cloud Sync → Enable Cloud Sync)
const result = await invoke('provision_d1_via_worker', {
  tenantId: 'test-restaurant-123',
  workerUrl: 'https://handsfree-orders.suyesh.workers.dev/api/provision',
  databaseName: 'test-restaurant-123_db',
  schema: [
    'CREATE TABLE IF NOT EXISTS sales_transactions (...)',
    // ... more tables
  ],
});

console.log('Provisioning result:', result);
```

### 6.2 Verify D1 Database Created

Go to Cloudflare Dashboard → D1 Databases

Should see: `test-restaurant-123_db`

### 6.3 Test Sync

```typescript
// Create a sale in POS
// Wait 1 minute (Tier 1 sync interval)
// Check D1 database:

wrangler d1 execute test-restaurant-123_db \
  --remote \
  --command "SELECT * FROM sales_transactions LIMIT 5"
```

## Step 7: Monitoring

### 7.1 View Logs

```bash
# Real-time logs
npm run tail
# or
wrangler tail
```

### 7.2 Check Metrics

Go to Cloudflare Dashboard → Workers & Pages → handsfree-orders → Metrics

Monitor:
- Request count
- Error rate
- CPU time
- Duration

### 7.3 Check D1 Usage

Go to Cloudflare Dashboard → D1 Databases

Monitor:
- Database count
- Total rows
- Storage used
- Read/Write operations

## Troubleshooting

### Error: "Account ID not found"

**Solution:** Update `CLOUDFLARE_ACCOUNT_ID` in `wrangler.jsonc`

```bash
wrangler whoami
```

### Error: "Namespace not found"

**Solution:** Create KV namespace and update `wrangler.jsonc`

```bash
wrangler kv:namespace create "TENANT_METADATA"
```

### Error: "Database not found"

**Solution:** Create placeholder D1 database

```bash
wrangler d1 create handsfree_orders_db
```

### Error: "Unauthorized"

**Solution:** Check API token permissions

Required:
- Account > D1 > Edit
- Account > Workers KV Storage > Edit
- Account > Workers Scripts > Edit

### D1 Creation Fails

**Possible causes:**
1. Free plan limit (max 10 databases)
2. Rate limiting
3. Invalid database name (must be alphanumeric + underscore/hyphen)

**Solution:** Check Cloudflare D1 plan limits and database naming rules

## Rollback

If deployment fails or issues occur:

```bash
# Rollback to previous version
wrangler rollback

# Or deploy a specific version
wrangler rollback --version-id <version-id>
```

## Production Checklist

- [ ] Cloudflare account configured
- [ ] API token created with correct permissions
- [ ] KV namespace created and configured
- [ ] Placeholder D1 database created
- [ ] Secrets set (CLOUDFLARE_API_TOKEN)
- [ ] Worker deployed successfully
- [ ] Health check passes
- [ ] POS environment updated with worker URL
- [ ] Test provisioning completes
- [ ] Test sync works
- [ ] Monitoring configured
- [ ] Logs accessible

## Next Steps

1. Test with production restaurant data
2. Monitor sync performance
3. Adjust sync intervals based on usage
4. Implement alerting for failures
5. Set up backup/restore procedures

## Support

- Worker issues: Check `wrangler tail` logs
- D1 issues: Cloudflare Dashboard → D1
- KV issues: Cloudflare Dashboard → KV
- API docs: https://developers.cloudflare.com/workers/
