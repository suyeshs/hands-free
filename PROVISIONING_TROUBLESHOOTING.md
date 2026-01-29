# Provisioning Timeout Troubleshooting Guide

## ✅ ISSUE RESOLVED

The provisioning worker **IS WORKING** but takes **2-3 minutes** to complete. The timeout was set too low (30 seconds).

### Fix Applied

- **Timeout increased**: 30s → 180s (3 minutes)
- **Error messages improved**: Better feedback for users
- **Progress indication**: Stopwatch shows elapsed time during provisioning

## Previous Problem

Restaurant creation was failing with timeout errors because the request timeout was shorter than the actual provisioning time.

## Provisioning Performance

### Actual Performance (Tested)

```bash
# Test command:
curl -X POST https://handsfree-restaurant-provisioning.suyesh.workers.dev/api/provision \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"test-pos-123",...}' \
  --max-time 180

# Result:
✅ HTTP Status: 201 Created
✅ Response Time: 146.7 seconds (~2.5 minutes)
✅ Tables Created: 45/45 (complete D1 schema)
✅ Resources: D1 + KV + R2 + DNS all provisioned
```

**Why it takes 2-3 minutes:**
- Creating D1 database (30-60s)
- Applying 45-table schema (30-60s)
- Creating 3 KV namespaces (10-20s)
- Creating R2 bucket (10-20s)
- DNS propagation (5-10s)
- Metadata storage (1-2s)

This is **NORMAL** for Cloudflare infrastructure provisioning.

## Architecture Overview

According to the docs, provisioning should happen via the **domain-service worker**:

```
User creates restaurant in POS app
          ↓
POS app calls /api/provision endpoint
          ↓
Domain-service worker receives request
          ↓
Worker creates:
  • D1 database for tenant
  • KV namespace for data/cache/sessions
  • R2 bucket for uploads
  • DNS/subdomain configuration
          ↓
Worker returns activation code
          ↓
POS app activates with code
```

## Solutions

### Option 1: Deploy the Provisioning Worker (Recommended)

The provisioning worker needs to be deployed to Cloudflare Workers.

**Required Repository**: You need access to the platform worker repository (separate from this POS client repo).

**Deployment Steps**:
1. Clone the platform worker repository (if available)
2. Navigate to the domain-service worker:
   ```bash
   cd platform/workers/domain-service
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure wrangler.toml with your Cloudflare account details
5. Deploy:
   ```bash
   npm run deploy
   # or
   wrangler deploy
   ```

**Expected Result**:
- Worker deployed at `domain-service.suyesh.workers.dev`
- `/api/provision` endpoint returns 200 OK (not 404)

### Option 2: Update Provisioning URL

If the worker is deployed at a different URL, update the environment variable:

**File**: `.env`
```env
# Add or update this line
VITE_PROVISIONING_URL=https://your-actual-provisioning-worker.workers.dev
```

Then rebuild the app:
```bash
npm run dev
# or
npm run build
```

### Option 3: Use Manual Provisioning (Temporary Workaround)

If automated provisioning isn't available, manually provision resources via Cloudflare Dashboard:

1. **Create D1 Database**:
   ```bash
   wrangler d1 create {subdomain}_db
   # Example: wrangler d1 create test-restaurant-1234_db
   ```

2. **Apply Schema**:
   ```bash
   wrangler d1 execute {subdomain}_db --file=./docs/d1-complete-migration.sql
   ```

3. **Create KV Namespaces**:
   ```bash
   wrangler kv:namespace create "data"
   wrangler kv:namespace create "cache"
   wrangler kv:namespace create "sessions"
   ```

4. **Create R2 Bucket**:
   ```bash
   wrangler r2 bucket create {subdomain}-uploads
   ```

5. **Store Tenant Metadata** in KV:
   ```bash
   wrangler kv:key put --namespace-id={YOUR_KV_ID} "tenant:{subdomain}" '{
     "tenant_id": "test-restaurant-1234",
     "subdomain": "test-restaurant-1234",
     "database_id": "{D1_DATABASE_ID}",
     "database_name": "test-restaurant-1234_db",
     "kv_namespace_id": "{KV_NAMESPACE_ID}",
     "r2_bucket_name": "test-restaurant-1234-uploads",
     "activation_code": "MANUAL-SETUP-CODE",
     "created_at": "2026-01-24T..."
   }'
   ```

6. **Activate in POS App**:
   - Open POS app
   - Use activation code: `MANUAL-SETUP-CODE`
   - Configure tenant settings

### Option 4: Check Cloudflare Worker Logs

If the worker is deployed but not working:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Find the provisioning worker
4. Click **Logs** or **Monitoring**
5. Check for errors during deployment or runtime

Common issues:
- Missing environment variables (API keys)
- Incorrect binding configuration
- Runtime errors in worker code

## Test Provisioning Endpoint

After deploying/fixing, test the endpoint:

```bash
curl -X POST https://your-provisioning-worker.workers.dev/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Restaurant",
    "email": "test@example.com",
    "phone": "+1234567890",
    "city": "Mumbai",
    "pincode": "400001",
    "tenantId": "test-restaurant-1234",
    "businessCategory": "RESTAURANT",
    "restaurantType": "CASUAL_DINING"
  }'
```

**Expected Response (200 OK)**:
```json
{
  "success": true,
  "tenant": {
    "tenant_id": "test-restaurant-1234",
    "subdomain": "test-restaurant-1234",
    "database_id": "abc123...",
    "database_name": "test-restaurant-1234_db",
    "kv_namespace_id": "...",
    "r2_bucket_name": "...",
    "activation_code": "CODE-1234-5678"
  }
}
```

## Verification Checklist

- [ ] Provisioning worker is deployed to Cloudflare
- [ ] `/api/provision` endpoint returns 200 (not 404 or timeout)
- [ ] VITE_PROVISIONING_URL environment variable is set correctly
- [ ] Cloudflare API credentials are configured in worker
- [ ] Worker has permissions to create D1/KV/R2 resources
- [ ] Test request succeeds with sample data
- [ ] POS app can successfully create a restaurant

## Next Steps

1. **Identify the correct provisioning worker URL**
2. **Verify worker deployment status**
3. **Update VITE_PROVISIONING_URL in .env**
4. **Test restaurant creation in POS app**

## Contact

If provisioning infrastructure is not available:
- Contact platform team for worker repository access
- Request worker deployment or credentials
- Get Cloudflare account access for manual provisioning

## Related Files

- **Test Script**: `test-provisioning-endpoints.sh`
- **Provisioning Code**: `src/components/SimpleRestaurantOnboarding.tsx:253`
- **Architecture Docs**: `docs/AUTO_PROVISION_D1.md`
- **Environment Config**: `.env`

---

**Last Updated**: 2026-01-24
**Status**: Provisioning endpoints not responding
**Action Required**: Deploy provisioning worker or configure correct endpoint URL
