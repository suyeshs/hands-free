# Tenant Provisioning - Complete Implementation

## Summary

The tenant provisioning flow now correctly captures and stores Cloudflare resource IDs (KV, R2, D1) returned from the backend API.

---

## ✅ What Changed

### 1. Extended TenantMetadata Interface
**File**: `src/services/tenantProvisioning.ts`

Added Cloudflare resources to tenant metadata:
```typescript
export interface TenantMetadata {
  // ... existing fields ...

  // NEW: Cloudflare storage resources
  cloudflareResources?: {
    kvNamespaceId?: string;      // KV namespace ID (data)
    kvCacheId?: string;          // KV namespace ID (cache)
    kvSessionsId?: string;       // KV namespace ID (sessions)
    r2BucketName?: string;        // R2 bucket name
    d1DatabaseId?: string;        // D1 database ID
    d1DatabaseName?: string;      // D1 database name
  };
}
```

### 2. Updated StoreCreationModal
**File**: `src/components/StoreCreationModal.tsx`

Now captures and passes full tenant data:
```typescript
// Store full tenant data including Cloudflare resources
setTenantData(result);

// Log Cloudflare resources
console.log('[StoreCreationModal] Cloudflare Resources:', {
  kvNamespaceId: result.kvNamespaceId,
  r2BucketName: result.r2BucketName,
  d1DatabaseId: result.d1DatabaseId,
  d1DatabaseName: result.d1DatabaseName,
});

// Pass to parent with activation code
onComplete(activationCode, tenantData);
```

### 3. Updated SimpleRestaurantOnboarding
**File**: `src/components/SimpleRestaurantOnboarding.tsx`

Accepts tenant data and stores Cloudflare resources:
```typescript
const handleCreationComplete = async (
  activationCode: string,
  tenantData?: any
) => {
  await storeTenantMetadata({
    // ... basic tenant info ...

    // Extract Cloudflare resources from backend response
    cloudflareResources: tenantData?.cloudflareResources || {
      kvNamespaceId: tenantData?.kvNamespaceId,
      r2BucketName: tenantData?.r2BucketName,
      d1DatabaseId: tenantData?.d1DatabaseId,
      d1DatabaseName: tenantData?.d1DatabaseName,
    },
  });
};
```

---

## 📋 Expected Backend Response

The backend `/api/tenants` endpoint should return:

```json
{
  "success": true,
  "tenantId": "coorg-food-company-1234",
  "subdomain": "coorg-food-company-1234",
  "activationCode": "ABC123XYZ789",
  "status": "PROVISIONED",

  // Option 1: Nested structure
  "cloudflareResources": {
    "kvNamespaceId": "a1b2c3d4e5f6g7h8",
    "r2BucketName": "handsfree-coorg-food-company-1234",
    "d1DatabaseId": "1234-5678-9abc-def0-1234-567890abcdef",
    "d1DatabaseName": "handsfree-coorg-food-company-1234"
  },

  // Option 2: Flat structure (also supported)
  "kvNamespaceId": "a1b2c3d4e5f6g7h8",
  "r2BucketName": "handsfree-coorg-food-company-1234",
  "d1DatabaseId": "1234-5678-9abc-def0-1234-567890abcdef",
  "d1DatabaseName": "handsfree-coorg-food-company-1234"
}
```

**Both formats are supported** - the code extracts from either structure.

---

## 🗄️ What Gets Stored

### In SQLite (`restaurant_settings` table):

```sql
INSERT INTO restaurant_settings (key, value)
VALUES ('tenant_metadata', '{
  "tenantId": "coorg-food-company-1234",
  "companyName": "The Coorg Food Company",
  "email": "owner@restaurant.com",
  "phone": "+91 98765 43210",
  "businessCategory": "RESTAURANT",
  "subdomain": "coorg-food-company-1234",
  "activationCode": "ABC123XYZ789",
  "status": "PROVISIONED",

  "cloudflareResources": {
    "kvNamespaceId": "a1b2c3d4e5f6g7h8",
    "r2BucketName": "handsfree-coorg-food-company-1234",
    "d1DatabaseId": "1234-5678-9abc-def0",
    "d1DatabaseName": "handsfree-coorg-food-company-1234"
  },

  "setupProgress": {
    "provisioned": true,
    "menuUploaded": false,
    "photosUploaded": false,
    "detailsCompleted": false,
    "staffAdded": false,
    "testOrderCompleted": false
  },

  "createdAt": "2025-01-22T10:30:00Z",
  "updatedAt": "2025-01-22T10:30:00Z"
}');
```

---

## 🔍 How to Access Cloudflare Resources

### From any component:

```typescript
import { getTenantMetadata } from '../services/tenantProvisioning';

// Get full tenant metadata
const metadata = await getTenantMetadata();

// Access Cloudflare resources
const { cloudflareResources } = metadata;

if (cloudflareResources) {
  console.log('KV Namespace:', cloudflareResources.kvNamespaceId);
  console.log('R2 Bucket:', cloudflareResources.r2BucketName);
  console.log('D1 Database:', cloudflareResources.d1DatabaseId);
  console.log('D1 Name:', cloudflareResources.d1DatabaseName);
}
```

### Use cases:

**1. Menu Sync Service**:
```typescript
// Sync menu to D1 database
const { d1DatabaseId } = metadata.cloudflareResources;
await syncMenuToD1(d1DatabaseId, menuItems);
```

**2. Image Upload Service**:
```typescript
// Upload images to R2 bucket
const { r2BucketName } = metadata.cloudflareResources;
await uploadImageToR2(r2BucketName, imageFile);
```

**3. Configuration Cache**:
```typescript
// Cache config in KV
const { kvNamespaceId } = metadata.cloudflareResources;
await updateKVCache(kvNamespaceId, 'menu', menuData);
```

---

## 🚀 Backend Implementation Guide

### What the Backend Should Do

When `POST /api/tenants` is called:

1. **Create Cloudflare Resources**:
```typescript
// 1. Create KV Namespace
const kv = await env.CF_API.createKVNamespace({
  title: `handsfree-${tenantId}`
});
const kvNamespaceId = kv.id;

// 2. Create R2 Bucket
const r2 = await env.CF_API.createR2Bucket({
  name: `handsfree-${tenantId}`
});
const r2BucketName = r2.name;

// 3. Create D1 Database
const d1 = await env.CF_API.createD1Database({
  name: `handsfree-${tenantId}`
});
const d1DatabaseId = d1.uuid;
const d1DatabaseName = d1.name;
```

2. **Initialize Resources**:
```typescript
// Set up KV with default config
await env.KV.put(`tenant:${tenantId}:config`, JSON.stringify({
  tenantId,
  status: 'PROVISIONED',
  createdAt: new Date().toISOString()
}));

// Initialize D1 schema
await env.D1.exec(`
  CREATE TABLE orders (...);
  CREATE TABLE menu_items (...);
  -- ... other tables
`);
```

3. **Store in Tenant KV**:
```typescript
// Store tenant metadata in global tenant KV
await env.TENANT_KV.put(tenantId, JSON.stringify({
  tenantId,
  subdomain,
  cloudflareResources: {
    kvNamespaceId,
    r2BucketName,
    d1DatabaseId,
    d1DatabaseName
  },
  status: 'PROVISIONED',
  createdAt: new Date().toISOString()
}));
```

4. **Return Response**:
```typescript
return Response.json({
  success: true,
  tenantId,
  subdomain,
  activationCode,
  status: 'PROVISIONED',
  cloudflareResources: {
    kvNamespaceId,
    r2BucketName,
    d1DatabaseId,
    d1DatabaseName
  }
});
```

---

## 🧪 Testing

### 1. Check Console Logs

After provisioning, check browser console:
```
[StoreCreationModal] Full API result: { success: true, ... }
[StoreCreationModal] Cloudflare Resources: {
  kvNamespaceId: "a1b2c3d4e5f6g7h8",
  r2BucketName: "handsfree-coorg-food-company-1234",
  d1DatabaseId: "1234-5678-9abc-def0",
  d1DatabaseName: "handsfree-coorg-food-company-1234"
}
[Restaurant Onboarding] Tenant data from backend: { ... }
[Restaurant Onboarding] Stored tenant metadata with Cloudflare resources locally
```

### 2. Check SQLite Database

```typescript
// In browser console (after provisioning)
const { getTenantMetadata } = await import('./services/tenantProvisioning');
const metadata = await getTenantMetadata();
console.log('Cloudflare Resources:', metadata.cloudflareResources);
```

Expected output:
```json
{
  "kvNamespaceId": "a1b2c3d4e5f6g7h8",
  "r2BucketName": "handsfree-coorg-food-company-1234",
  "d1DatabaseId": "1234-5678-9abc-def0",
  "d1DatabaseName": "handsfree-coorg-food-company-1234"
}
```

### 3. Test with Mock Data

If backend not ready, test with mock response:

```typescript
// In SimpleRestaurantOnboarding.tsx
const createRestaurant = async () => {
  // ... existing code ...

  // FOR TESTING: Return mock response
  return {
    success: true,
    tenantId: formData.subdomain,
    subdomain: formData.subdomain,
    activationCode: 'TEST123',
    cloudflareResources: {
      kvNamespaceId: 'mock-kv-123',
      r2BucketName: 'mock-bucket-123',
      d1DatabaseId: 'mock-d1-123',
      d1DatabaseName: 'mock-db-123'
    }
  };
};
```

---

## 📚 Documentation

See these files for more details:

- **[DATA_WORKFLOW_AND_ROUTING.md](DATA_WORKFLOW_AND_ROUTING.md)** - Complete data flow from onboarding to hub
- **[CLOUDFLARE_RESOURCES_USAGE.md](CLOUDFLARE_RESOURCES_USAGE.md)** - How KV, R2, and D1 are used
- **[CONTEXTUAL_ONBOARDING_COMPLETE.md](CONTEXTUAL_ONBOARDING_COMPLETE.md)** - Onboarding flow documentation

---

## ✅ Checklist

Backend team should ensure:

- [ ] `/api/tenants` endpoint returns Cloudflare resource IDs
- [ ] KV namespace is created and initialized
- [ ] R2 bucket is created with proper CORS
- [ ] D1 database is created with schema
- [ ] Worker is deployed with bindings to KV, R2, D1
- [ ] Tenant metadata is stored in tenant KV
- [ ] Response includes all resource IDs

Frontend (already complete):

- [x] `TenantMetadata` interface extended
- [x] `StoreCreationModal` captures tenant data
- [x] `SimpleRestaurantOnboarding` stores Cloudflare resources
- [x] `tenantProvisioning` service stores in SQLite
- [x] Documentation updated

---

## 🎯 Next Steps

1. **Backend**: Implement Cloudflare resource provisioning
2. **POS**: Use resource IDs for sync operations
3. **Admin Panel**: Display resource IDs in settings
4. **Monitoring**: Track resource usage and costs

---

Everything is now ready to receive and store Cloudflare resource IDs from the backend!
