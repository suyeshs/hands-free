# Menu Upload - Architecture Fix

## Problem
Menu upload was failing with Cloudflare "Page not found" error when trying to call the restaurant worker directly.

## Root Cause

### Worker Architecture
The Handsfree platform uses a multi-layer worker architecture:

```
┌────────────────────────────────────────────────────────────┐
│           handsfree-proxy worker                           │
│  - Routes *.handsfree.tech traffic                         │
│  - Extracts tenant ID from subdomain                       │
│  - Has HTTP routes configured                              │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      │ (Service binding - zero latency)
                      ▼
┌────────────────────────────────────────────────────────────┐
│           handsfree-restaurant worker                      │
│  - Handles tenant-specific operations                      │
│  - Routes to D1 databases                                  │
│  - ❌ NO HTTP ROUTES CONFIGURED ❌                         │
│  - Only accessible via service bindings                    │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      │ (HTTP fetch)
                      ▼
┌────────────────────────────────────────────────────────────┐
│         handsfree-restaurant-client (Next.js)              │
│  - R2 upload endpoints (/api/r2)                          │
│  - Parse endpoints (/api/admin/menu/parse-from-r2)        │
│  - ✅ HTTP ROUTES CONFIGURED ✅                           │
│  - Accessible via direct HTTPS requests                    │
└────────────────────────────────────────────────────────────┘
```

### Why Direct Restaurant Worker Calls Fail

From `platform/workers/restaurant/wrangler.jsonc` line 9:
```jsonc
// Note: No routes configured - traffic comes from handsfree-proxy worker via fetch()
```

The restaurant worker:
- Has **NO HTTP routes** configured
- Can **ONLY** be called via service bindings from handsfree-proxy
- Direct HTTPS calls to `https://handsfree-restaurant.suyesh.workers.dev` return **404**

### Why Subdomain Routing Doesn't Work for POS

The handsfree-proxy worker routes `*.handsfree.tech` subdomains:
- ✅ Works for web clients (browsers)
- ❌ Requires Workers for Platforms custom domain setup
- ❌ Not all tenants have subdomains configured
- ❌ Desktop POS shouldn't depend on DNS configuration

## Solution

### POS Architecture
For the desktop POS (Tauri app), use **direct restaurant-client access**:

```
┌─────────────────┐
│   POS Desktop   │
│   (Tauri App)   │
└────────┬────────┘
         │
         │ Direct HTTPS request
         │ Headers:
         │   - X-Tenant-ID: {tenantId}
         │   - Authorization: Bearer {token}
         │
         ▼
┌────────────────────────────────────────────┐
│   handsfree-restaurant-client              │
│   (https://handsfree-restaurant-client.    │
│    suyesh.workers.dev)                     │
│                                            │
│   ✅ HTTP routes configured                │
│   ✅ Accepts X-Tenant-ID header            │
│   ✅ Supports Bearer token auth            │
└────────────────────────────────────────────┘
```

### Files Modified

**src/lib/r2Uploader.ts:**

```typescript
constructor(tenantId: string, onProgress?: (progress: UploadProgress) => void) {
  // Use restaurant-client directly (restaurant worker has no HTTP routes configured)
  // Restaurant-client is a Next.js app that accepts direct HTTPS requests
  this.apiBaseUrl = `https://handsfree-restaurant-client.suyesh.workers.dev`;

  console.log('[R2Uploader] Using API base URL:', this.apiBaseUrl, 'for tenant:', tenantId);

  this.onProgress = onProgress;
}
```

And in `parseFileFromR2`:
```typescript
const customFetch = await getTauriFetch();

// Use restaurant-client directly (restaurant worker has no HTTP routes configured)
const apiBaseUrl = `https://handsfree-restaurant-client.suyesh.workers.dev`;
```

### Request Headers

All R2 requests now include:

1. **X-Tenant-ID** - For tenant context
   ```typescript
   headers: {
     'X-Tenant-ID': tenantId,
     'Content-Type': 'application/json'
   }
   ```

2. **Authorization** - For authenticated requests
   ```typescript
   headers: {
     'Authorization': `Bearer ${accessToken}`,
     'X-Tenant-ID': tenantId,
     'Content-Type': 'application/json'
   }
   ```

## Server-Side Configuration

The restaurant-client already has:
- ✅ HTTP routes configured for R2 endpoints
- ✅ Bearer token authentication support (deployed)
- ✅ X-Tenant-ID header support

**From `client/restaurant-client/app/api/admin/menu/parse-from-r2/route.ts`:**
```typescript
// SECURITY CHECK: Require admin authentication (cookie OR Bearer token)
const cookieHeader = request.headers.get('cookie') || '';
const authHeader = request.headers.get('authorization') || '';

const hasCookieAuth = cookieHeader.includes('admin_access_token');
const hasBearerAuth = authHeader.startsWith('Bearer ');

if (!hasCookieAuth && !hasBearerAuth) {
  return NextResponse.json(
    { error: 'Unauthorized: Admin authentication required' },
    { status: 401 }
  );
}
```

## Why This Solution Works

### For POS Desktop App
✅ **No DNS dependency** - Works regardless of subdomain configuration
✅ **Direct access** - Fewer network hops, lower latency
✅ **Independent** - Not affected by proxy worker changes
✅ **Reliable** - Restaurant-client is a stable Next.js deployment
✅ **Consistent auth** - Uses same Bearer token pattern as other POS APIs

### For Web Clients
✅ **Still works** - Web clients continue using subdomain routing
✅ **Cookie auth** - Existing cookie-based auth still supported
✅ **No changes needed** - Web client code unchanged

## Testing Checklist

Before testing, the POS needs to be rebuilt:
```bash
cd /Users/stonepot-tech/projects/restaurant-pos-ai
npm run tauri build
```

Test scenarios:
- [ ] Upload small file (<10MB) - single chunk
- [ ] Upload large file (>10MB) - multiple chunks
- [ ] Verify progress tracking
- [ ] Confirm AI parsing completes
- [ ] Review parsed items
- [ ] Save to SQLite
- [ ] Verify items persist

## Expected Behavior

1. **R2 Upload** (POST /api/r2):
   - Request goes directly to restaurant-client
   - X-Tenant-ID header provides tenant context
   - Returns upload ID and R2 key

2. **Chunk Upload** (PUT /api/r2):
   - Uploads file in 10MB chunks
   - Progress callback updates UI
   - Returns ETag for each chunk

3. **Complete Upload** (PATCH /api/r2):
   - Finalizes multipart upload
   - Returns success confirmation

4. **AI Parsing** (POST /api/admin/menu/parse-from-r2):
   - Requires Bearer token
   - Downloads file from R2
   - Parses with Gemini AI
   - Returns structured menu items

## Architecture Benefits

| Aspect | Web Clients | POS Desktop |
|--------|-------------|-------------|
| **Routing** | Subdomain-based | Direct HTTPS |
| **Auth** | Cookie | Bearer token |
| **Tenant Context** | From subdomain | X-Tenant-ID header |
| **DNS Dependency** | Yes | No |
| **Latency** | 3 hops | 1 hop |
| **Reliability** | Depends on proxy chain | Direct to service |

## Status

✅ **All Changes Complete**

The menu upload flow should now work end-to-end from the POS desktop app.
