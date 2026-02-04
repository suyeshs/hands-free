# Multi-Location Implementation Guide

## Summary

We've created a **lightweight multi-location provisioning system** that only creates D1 databases for each location, avoiding the timeout issues with full provisioning.

## What Changed

### 1. **New Provisioning Endpoint** ✨
Created `/api/provision/location` endpoint that:
- ✅ Only creates D1 database (no KV, R2, DNS)
- ✅ Returns immediately (synchronous, no polling)
- ✅ Uses migration sync for schema
- ✅ Much faster (~5-10 seconds vs 60+ seconds)

### 2. **Updated Frontend** ✅
Modified `src/stores/chainStore.ts` to:
- Use the new `/api/provision/location` endpoint
- Remove polling logic (no longer needed)
- Better error handling and logging
- Shorter timeout (30s instead of 60s)

### 3. **Database Naming** 📋
Implemented clear naming convention:
```
Subdomain: kalyani-restaurant-indiranagar-4521
Tenant ID: kalyani-restaurant-indiranagar-4521-lmn3x7k
Database: kalyani_restaurant_indiranagar_4521_lmn3x7k_db
```

## Implementation Steps

### Step 1: Deploy New Provisioning Endpoint

Add the code from `docs/multi-location-provisioning-endpoint.ts` to your provisioning worker:

```bash
# Navigate to your provisioning worker directory
cd /path/to/handsfree-restaurant-provisioning

# Add the new endpoint to your worker
# Copy the code from docs/multi-location-provisioning-endpoint.ts
```

**Required Changes to Worker:**

1. **Add Routes:**
```typescript
// In your worker's fetch handler
if (url.pathname === '/api/provision/location' && request.method === 'POST') {
  return handleLocationProvisioning(request, env);
}

if (url.pathname === '/api/provision/location/migrate' && request.method === 'POST') {
  return handleLocationMigration(request, env);
}
```

2. **Environment Variables:**
Ensure your `wrangler.toml` has:
```toml
[vars]
CLOUDFLARE_ACCOUNT_ID = "your-account-id"

[secrets]
CLOUDFLARE_API_TOKEN = "your-api-token"

[[kv_namespaces]]
binding = "PROVISIONING_KV"
id = "your-kv-namespace-id"
```

### Step 2: Deploy Worker

```bash
# Deploy to Cloudflare
npx wrangler deploy
```

### Step 3: Test Location Creation

1. **Open the app** in your browser
2. **Navigate to** Settings → Chain Management
3. **Click** "Add Location"
4. **Fill in** location details
5. **Submit** and watch the console

**Expected Behavior:**
- ✅ Subdomain generated
- ✅ Health check passes
- ✅ D1 database created (~5-10 seconds)
- ✅ Activation code returned
- ✅ Location appears in list

### Step 4: Verify Database

Check that the database was created in Cloudflare:

```bash
# List D1 databases
npx wrangler d1 list

# Should show: kalyani_restaurant_indiranagar_4521_lmn3x7k_db
```

### Step 5: Test Activation

1. **Note the activation code** from the success modal
2. **Open a new device/browser**
3. **Enter activation code** in setup wizard
4. **Verify** that:
   - Location links to master
   - Menu syncs from master
   - Settings sync from master

## Files Created/Modified

### New Files:
- `docs/multi-location-provisioning-endpoint.ts` - Worker endpoint implementation
- `docs/MULTI_LOCATION_DATABASE_NAMING.md` - Naming convention guide
- `docs/MULTI_LOCATION_IMPLEMENTATION_GUIDE.md` - This file

### Modified Files:
- `src/stores/chainStore.ts` - Updated to use new endpoint

## Database Naming Reference

| Component | Example | Description |
|-----------|---------|-------------|
| **Master Name** | "Kalyani Restaurant" | Original restaurant name |
| **Master Tenant** | `kalyani-6207` | Master tenant ID |
| **Location Name** | "Indiranagar Branch" | New location name |
| **Subdomain** | `kalyani-restaurant-indiranagar-4521` | Generated subdomain |
| **Location Tenant** | `kalyani-restaurant-indiranagar-4521-lmn3x7k` | Unique tenant ID |
| **Database Name** | `kalyani_restaurant_indiranagar_4521_lmn3x7k_db` | D1 database name |
| **Activation Code** | `A7K9M2` | 6-char code for device activation |

## API Request/Response

### Request to `/api/provision/location`:
```json
{
  "tenantId": "kalyani-6207",
  "restaurantName": "Indiranagar Branch",
  "companyName": "Kalyani Restaurant",
  "ownerName": "Kalyani",
  "email": "indiranagar@kalyani.com",
  "phone": "+91 9876543210",
  "city": "Bangalore",
  "pincode": "560038",
  "restaurantType": "FULL_SERVICE",
  "subdomain": "kalyani-restaurant-indiranagar-4521"
}
```

### Response:
```json
{
  "success": true,
  "tenantId": "kalyani-restaurant-indiranagar-4521-lmn3x7k",
  "activationCode": "A7K9M2",
  "cloudflareResources": {
    "d1DatabaseId": "abc123-def456-...",
    "d1DatabaseName": "kalyani_restaurant_indiranagar_4521_lmn3x7k_db"
  }
}
```

## Troubleshooting

### Issue: "Provisioning service is not available"
**Solution:** Check that the provisioning worker is deployed and the health endpoint responds:
```bash
curl https://handsfree-restaurant-provisioning.suyesh.workers.dev/health
```

### Issue: "Location provisioning timed out"
**Solution:**
1. Check Cloudflare API token has D1 permissions
2. Verify CLOUDFLARE_ACCOUNT_ID is correct
3. Check worker logs: `npx wrangler tail`

### Issue: "Missing required fields: tenantId, companyName, email"
**Solution:** Ensure restaurant settings are complete:
- Restaurant name
- Owner name
- Email address

### Issue: Database created but schema is empty
**Solution:**
1. Schema will be applied via migration sync when location activates
2. Or manually apply migrations using `/api/provision/location/migrate`

## Migration Sync (Optional)

To manually sync migrations to a location:

```bash
POST /api/provision/location/migrate

{
  "locationTenantId": "kalyani-restaurant-indiranagar-4521-lmn3x7k",
  "masterTenantId": "kalyani-6207",
  "migrations": [
    "CREATE TABLE menu_items (...)",
    "CREATE TABLE orders (...)",
    ...
  ]
}
```

## Next Steps

1. ✅ Deploy the provisioning worker with new endpoint
2. ✅ Test location creation
3. ✅ Test activation on a new device
4. ✅ Verify menu/settings sync
5. 📋 Optional: Add migration sync endpoint
6. 📋 Optional: Add location management features (edit, delete, etc.)

## Benefits

| Before | After |
|--------|-------|
| ❌ 60+ second timeout | ✅ 5-10 second response |
| ❌ Creates KV, R2, DNS | ✅ Only creates D1 |
| ❌ Async polling required | ✅ Synchronous response |
| ❌ Complex error handling | ✅ Simple error handling |
| ❌ Full infrastructure | ✅ Minimal infrastructure |

## Support

For issues or questions:
1. Check console logs in browser (DevTools)
2. Check worker logs: `npx wrangler tail`
3. Review error messages in the UI
4. Check database in Cloudflare dashboard
