# Menu Upload - Final Fix Complete

## Problem
Menu upload was failing with "Invalid restaurant subdomain" error after deploying server-side fixes.

## Root Cause
The R2 upload requests were missing the `X-Tenant-ID` header that the restaurant worker requires for routing.

## Solution
Added `X-Tenant-ID` header to ALL R2 upload requests in r2Uploader.ts:

### 1. Upload Initiation (POST /api/r2)
```typescript
const initiateResponse = await customFetch(`${this.apiBaseUrl}/api/r2`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId, // ✅ Added
  },
  body: JSON.stringify({
    tenantId,
    filename: file.name,
    mimeType: file.type,
    fileSize: file.size,
  }),
});
```

### 2. Chunk Upload (PUT /api/r2?key=...&uploadId=...&partNumber=...)
```typescript
const response = await customFetch(
  `${this.apiBaseUrl}/api/r2?key=${encodeURIComponent(r2Key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
  {
    method: 'PUT',
    headers: {
      'X-Tenant-ID': tenantId, // ✅ Added
    },
    body: chunk,
  }
);
```

### 3. Complete Upload (PATCH /api/r2)
```typescript
const completeResponse = await customFetch(`${this.apiBaseUrl}/api/r2`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId, // ✅ Added
  },
  body: JSON.stringify({
    r2Key,
    uploadId,
    parts: uploadedParts,
  }),
});
```

### 4. Parse Request (POST /api/admin/menu/parse-from-r2)
```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': tenantId, // ✅ Already present
};

if (authToken) {
  headers['Authorization'] = `Bearer ${authToken}`;
}

const response = await customFetch(`${apiBaseUrl}/api/admin/menu/parse-from-r2`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    tenantId,
    r2Key,
    filename,
    mimeType,
  }),
});
```

## Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        POS Desktop App                          │
│  (Tauri + React)                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ 1. POST /api/r2
                          │    Headers: X-Tenant-ID, Content-Type
                          │    Body: { tenantId, filename, mimeType, fileSize }
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Restaurant Worker                                  │
│  (handsfree-restaurant.suyesh.workers.dev)                     │
│                                                                 │
│  - Extracts tenantId from X-Tenant-ID header                   │
│  - Routes /api/r2 → proxies to Restaurant Client               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Proxy with headers:
                          │   X-Tenant-ID: the-big-burger
                          │   X-Original-Host: ...
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│            Restaurant Client (Next.js)                          │
│  (handsfree-restaurant-client.suyesh.workers.dev)              │
│                                                                 │
│  /app/api/r2/route.ts:                                         │
│  - POST: Initiate multipart upload → Returns uploadId          │
│  - PUT: Upload chunk → Returns etag                            │
│  - PATCH: Complete upload → Finalizes R2 object                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ R2 Key: tenants/the-big-burger/uploads/...
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare R2 Bucket                          │
│               (MENU_UPLOADS_BUCKET)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Files Modified

### POS Application
- **src/lib/r2Uploader.ts**
  - Added X-Tenant-ID header to POST /api/r2 (initiate)
  - Added X-Tenant-ID header to PUT /api/r2 (upload chunks)
  - Added X-Tenant-ID header to PATCH /api/r2 (complete)
  - Already had X-Tenant-ID in parseFileFromR2

### Server-Side (Already Deployed)
- **platform/workers/restaurant/src/index.ts**
  - Routes /api/r2 → proxies to restaurant-client
  - Routes /api/admin/menu/parse-from-r2 → proxies to restaurant-client

- **client/restaurant-client/app/api/admin/menu/parse-from-r2/route.ts**
  - Added Bearer token authentication support

- **client/restaurant-client/app/api/admin/menu/process-from-r2/route.ts**
  - Added Bearer token authentication support

## Testing Checklist

Before testing, rebuild the POS app:
```bash
cd /Users/stonepot-tech/projects/restaurant-pos-ai
npm run tauri build
```

Then test:

- [ ] Upload small file (<10MB) - single chunk
- [ ] Upload large file (>10MB) - multiple chunks
- [ ] Verify progress tracking displays correctly
- [ ] Confirm AI parsing completes without errors
- [ ] Review parsed items in modal
- [ ] Save items to SQLite and verify persistence
- [ ] Check worker logs for proper routing

## Expected Behavior

1. **R2 Upload**:
   - ✅ No "Invalid restaurant subdomain" error
   - ✅ Progress bar shows upload percentage
   - ✅ Returns R2 key: `tenants/the-big-burger/uploads/{timestamp}-{filename}`

2. **AI Parsing**:
   - ✅ Sends file to Gemini via restaurant-client
   - ✅ Returns parsed items with metadata
   - ✅ Shows summary (total, by type, warnings)

3. **Review & Save**:
   - ✅ Items appear in MenuItemReview modal
   - ✅ User can edit/delete items
   - ✅ Confirms save to SQLite
   - ✅ Items visible in menu management

## Architecture Summary

**Multi-Tenant Design**:
- Each tenant has isolated D1 database
- R2 objects are namespaced by tenant: `tenants/{tenantId}/uploads/...`
- X-Tenant-ID header provides tenant context throughout the request chain

**Worker Routing**:
- Restaurant Worker = Smart router + D1 handler for tenant-specific APIs
- Restaurant Client = Next.js app with R2/AI/File Search endpoints
- Service Bindings = Zero-latency worker-to-worker communication

**Authentication**:
- Web Client: Cookie-based (admin_access_token)
- POS Client: Bearer token (JWT from Supabase)
- Both supported by restaurant-client endpoints

## Status

✅ **All Changes Complete**

The menu upload flow should now work end-to-end:
- POS → Restaurant Worker → Restaurant Client → R2 Storage
- Parse → Restaurant Client → Gemini AI → Parsed Items
- Save → SQLite (local POS database)

**Next**: Test the upload flow in the POS app.
