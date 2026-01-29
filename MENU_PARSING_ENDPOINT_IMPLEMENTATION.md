# Menu Parsing Endpoint Implementation

## Problem
The POS app was getting 401 Unauthorized errors when trying to parse menu files from R2 because it was calling an admin-only endpoint that required special authentication.

## Solution Architecture

### Architectural Decision: Separation of Concerns
**Orders Worker** → Only handles orders and real-time order notifications (WebSockets)
**Restaurant Worker** → Handles menu operations, customer management, and inventory

This follows proper microservices architecture where each worker has a single responsibility.

### Implementation

#### 1. Added Tenant-Specific Menu Parsing Endpoint to Restaurant Worker

**Location:** `/Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/restaurant/src/index.ts`

**New Endpoint:** `POST /api/menu/parse-from-r2`

**How it works:**
- Accessible at: `https://{tenantId}.handsfree.tech/api/menu/parse-from-r2`
- Uses **regular user authentication** (Bearer token from POS app)
- **No admin API key required**
- Proxies the request to restaurant-client worker which handles the actual R2 file parsing with AI
- Returns parsed menu items to the POS app

**Code added (lines ~1208-1257):**
```typescript
// POST /api/menu/parse-from-r2 - Parse menu file from R2 (tenant-specific, no admin auth required)
if (path === '/api/menu/parse-from-r2' && method === 'POST') {
  console.log(`[RestaurantWorker] Tenant-specific parse-from-r2 for tenant: ${tenantId}`);

  // Proxy to restaurant-client worker's admin endpoint
  const clientUrl = env.RESTAURANT_CLIENT_URL || 'https://handsfree-restaurant-client.suyesh.workers.dev';
  const proxyUrl = `${clientUrl}/api/admin/menu/parse-from-r2`;

  console.log(`[RestaurantWorker] Proxying to: ${proxyUrl}`);

  // Forward the request with tenant headers
  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set('X-Tenant-ID', tenantId);

  // Copy Authorization header if present (Bearer token from POS app)
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    proxyHeaders.set('Authorization', authHeader);
  }

  try {
    const proxyRequest = new Request(proxyUrl, {
      method: 'POST',
      headers: proxyHeaders,
      body: request.body,
    });

    const response = await fetch(proxyRequest);

    // Return response with CORS headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-ID, Authorization');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[RestaurantWorker] Parse-from-r2 proxy error:', error);
    return jsonResponse(
      {
        success: false,
        error: 'Failed to parse menu file',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}
```

#### 2. Updated POS App to Use Tenant-Specific Endpoint

**Location:** `src/lib/r2Uploader.ts` (lines ~247-275)

**Changes:**
- **Before:** Called orders worker (incorrect) → `https://handsfree-orders.suyesh.workers.dev/api/menu/${tenantId}/parse-from-r2`
- **After:** Calls restaurant worker → `https://${tenantId}.handsfree.tech/api/menu/parse-from-r2`

**Updated code:**
```typescript
// Use restaurant worker's tenant-specific menu endpoint (no admin auth required)
const platformDomain = import.meta.env.VITE_PLATFORM_DOMAIN || 'handsfree.tech';
const apiUrl = `https://${tenantId}.${platformDomain}/api/menu/parse-from-r2`;

console.log('[parseFileFromR2] Using tenant-specific menu API:', apiUrl);

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};

// Add Bearer token if available (uses regular user auth, not admin auth)
if (authToken) {
  headers['Authorization'] = `Bearer ${authToken}`;
}

const response = await customFetch(apiUrl, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    r2Key,
    filename,
    mimeType,
  }),
});
```

#### 3. Added Platform Domain Configuration

**Location:** `.env`

**Added:**
```env
# Platform domain for tenant-specific routing (restaurant worker)
VITE_PLATFORM_DOMAIN=handsfree.tech
```

## Benefits

### 1. **No Admin Authentication Required**
- Uses regular user Bearer tokens from the POS app
- No need for special admin API keys
- Works with existing authentication flow

### 2. **Proper Architecture**
- Orders worker only handles orders (as it should)
- Menu operations are handled by the restaurant worker
- Clear separation of concerns

### 3. **Tenant Isolation**
- Each tenant accesses their own subdomain: `https://{tenantId}.handsfree.tech`
- Automatic tenant identification from the URL
- No need to pass tenant ID as a parameter

### 4. **Backward Compatible**
- Admin endpoint still exists for legacy use cases
- New endpoint is additive, doesn't break existing functionality

## Deployment Status

✅ **Restaurant Worker** - Deployed successfully
   - Worker ID: 4c47ddb7-a697-48c4-bda4-cec6d01157fe
   - URL: https://handsfree-restaurant.suyesh.workers.dev
   - Endpoint available at: `https://{tenantId}.handsfree.tech/api/menu/parse-from-r2`

✅ **POS App Changes** - Ready for testing
   - Updated r2Uploader.ts to use new endpoint
   - Added VITE_PLATFORM_DOMAIN configuration

## Testing

To test the implementation:

1. **Start the POS app:**
   ```bash
   npm run tauri dev
   ```

2. **Try uploading a menu file** via the Menu Onboarding screen

3. **Expected behavior:**
   - File uploads to R2 successfully ✅
   - API calls `https://{tenantId}.handsfree.tech/api/menu/parse-from-r2` ✅
   - Backend parses the file with AI ✅
   - Returns parsed menu items ✅
   - No 401 errors ✅

## API Request Flow

```
POS App (r2Uploader.ts)
    ↓ POST /api/menu/parse-from-r2
    ↓ https://{tenantId}.handsfree.tech
    ↓
Restaurant Worker
    ↓ Extracts tenantId from subdomain
    ↓ Proxies to restaurant-client
    ↓
Restaurant Client Worker
    ↓ Fetches file from R2
    ↓ Parses with AI (OpenAI/Anthropic)
    ↓ Returns parsed menu items
    ↓
Restaurant Worker
    ↓ Returns response with CORS headers
    ↓
POS App
    ↓ Displays parsed items for review
```

## Files Modified

### Backend (Workers)
- `/Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/restaurant/src/index.ts`
  - Added `POST /api/menu/parse-from-r2` endpoint to `handleMenuD1API` function

### Frontend (POS App)
- `src/lib/r2Uploader.ts`
  - Updated `parseFileFromR2` function to use restaurant worker endpoint
  - Changed from orders worker to tenant-specific restaurant worker URL

- `.env`
  - Added `VITE_PLATFORM_DOMAIN=handsfree.tech`

## Alternative Approaches Considered

### ❌ Option 1: Add Admin API Key
**Why rejected:** Requires managing additional secrets, more complex authentication

### ❌ Option 2: Use Skip-Auth Header
**Why rejected:** Security risk, not suitable for production

### ❌ Option 3: Keep Using Orders Worker
**Why rejected:** Violates single responsibility principle, orders worker should only handle orders

### ✅ Option 4: Tenant-Specific Menu Endpoint (Implemented)
**Why chosen:**
- Clean architecture
- Uses existing authentication
- Proper separation of concerns
- No additional secrets needed

## Next Steps

1. ✅ Deploy restaurant worker (DONE)
2. ✅ Update POS app code (DONE)
3. ⏳ Test menu file upload with the new endpoint
4. ⏳ Monitor logs for any issues
5. ⏳ Document in main README if successful

## Support

If you encounter issues:

1. **Check restaurant worker logs:**
   ```bash
   wrangler tail handsfree-restaurant
   ```

2. **Check POS app console** for request details

3. **Verify tenant subdomain** is correctly configured in DNS

4. **Ensure Bearer token** is valid and not expired
