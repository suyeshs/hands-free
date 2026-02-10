# Restaurant Provisioning Worker

Direct API for POS systems to provision new restaurant tenants without going through the admin panel.

## Architecture

This worker handles complete end-to-end provisioning:

1. **Infrastructure Provisioning**
   - Creates D1 database for tenant
   - Creates KV namespaces (data, cache, sessions)
   - Creates R2 bucket for images/files

2. **Database Schema**
   - Applies full restaurant POS schema
   - Creates all necessary tables
   - Inserts seed data

3. **Metadata Storage**
   - Stores tenant record in `TENANTS_DB` (handsfree-tenants)
   - Stores tenant metadata in `TENANT_METADATA` KV
   - Stores theme configuration

4. **Activation Code**
   - Generates 16-character activation code (XXXX-XXXX-XXXX-XXXX)
   - Stores in `TENANT_METADATA` KV for POS activation
   - Returns code to POS for immediate activation

## API Endpoints

### POST /api/provision

Provision a new restaurant tenant.

**Request Body:**
```json
{
  "tenantId": "my-restaurant-1234",
  "companyName": "My Restaurant",
  "email": "owner@restaurant.com",
  "phone": "+1234567890",
  "city": "San Francisco",
  "pincode": "94102",
  "businessCategory": "RESTAURANT"
}
```

**Response:**
```json
{
  "success": true,
  "tenant": {
    "tenantId": "my-restaurant-1234",
    "companyName": "My Restaurant",
    "subdomain": "my-restaurant-1234",
    "fullDomain": "my-restaurant-1234.handsfree.tech",
    "storeUrl": "https://my-restaurant-1234.handsfree.tech",
    "database_id": "202da87e-18d9-423c-bec5-79180158a3ad",
    "database_name": "my-restaurant-1234_db"
  },
  "activationCode": "A3B4-C5D6-E7F8-G9H2",
  "provisioning": {
    "tablesCreated": 16,
    "rowsInserted": 0,
    "storage": {
      "kvNamespaceData": "...",
      "kvNamespaceCache": "...",
      "kvNamespaceSessions": "...",
      "r2BucketName": "..."
    }
  },
  "createdAt": "2026-01-24T..."
}
```

### GET /api/status/{tenantId}

Check provisioning status of a tenant.

**Response:**
```json
{
  "success": true,
  "tenant": {
    "tenant_id": "my-restaurant-1234",
    "company_name": "My Restaurant",
    "subdomain": "my-restaurant-1234",
    "full_domain": "my-restaurant-1234.handsfree.tech",
    "store_url": "https://my-restaurant-1234.handsfree.tech",
    "status": "active",
    "created_at": "2026-01-24T...",
    "d1_database_id": "202da87e-18d9-423c-bec5-79180158a3ad"
  }
}
```

### GET /health

Health check endpoint.

## Deployment

```bash
# Deploy to production
npm run deploy

# Or using wrangler directly
wrangler deploy

# Tail logs
npm run tail
```

## Environment Variables

Set these via `wrangler secret put`:

```bash
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put CLOUDFLARE_STORAGE_TOKEN
```

## POS Integration

Update your POS app to call this worker directly:

```typescript
// Before (going through admin panel):
const response = await fetch('https://handsfree-admin.pages.dev/api/tenants', {...});

// After (direct to provisioning worker):
const response = await fetch('https://handsfree-restaurant-provisioning.suyesh.workers.dev/api/provision', {...});
```

## Benefits Over Admin Panel Flow

1. **Fewer failure points** - No middleman
2. **Faster provisioning** - One API call instead of two
3. **Better error handling** - Single transaction
4. **Easier debugging** - All logs in one place
5. **Automatic metadata consistency** - Everything stored in one flow
