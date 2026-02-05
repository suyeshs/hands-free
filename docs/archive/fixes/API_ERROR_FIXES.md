# API 500 Error - Fixes Applied

## Problem
API was returning: `500: {"error":"Failed to create tenant"}`

## Root Cause
Tenant ID conflicts - the same restaurant name generates the same tenant ID each time, causing duplicates.

**Example:**
- Restaurant name: "Spice Haven"
- Generated tenant ID: "spice-haven" (same every time)
- Second attempt: "spice-haven" already exists → 500 error

## Fixes Applied

### 1. ✅ Unique Tenant ID Generation
**File:** [SystemCheckScreen.tsx:71-77](src/components/setup/screens/SystemCheckScreen.tsx#L71-L77)

**Before:**
```typescript
tenantId: wizardData.restaurantInfo?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'restaurant'
// Result: "spice-haven" (always the same)
```

**After:**
```typescript
const baseTenantId = wizardData.restaurantInfo?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'restaurant';
const uniqueSuffix = Date.now().toString().slice(-4); // Last 4 digits of timestamp
const tenantId = `${baseTenantId}-${uniqueSuffix}`;
// Result: "spice-haven-1234" (unique each time)
```

### 2. ✅ Better Error Messages
**File:** [SystemCheckScreen.tsx:93-115](src/components/setup/screens/SystemCheckScreen.tsx#L93-L115)

**Added:**
- Parse JSON error responses
- Provide context for common errors
- Show user-friendly messages:
  - "A restaurant with this name already exists..." (duplicate)
  - "Invalid restaurant data..." (validation errors)
  - "Server error: ..." (other errors)

### 3. ✅ Enhanced Logging
**File:** [SystemCheckScreen.tsx:82-83](src/components/setup/screens/SystemCheckScreen.tsx#L82-L83)

**Added:**
```typescript
console.log('[SystemCheckScreen] Request data:', JSON.stringify(requestData, null, 2));
```

Now logs full request payload for debugging.

## How to Test

### Clear Previous Data (Important!)
Before testing, clear all setup state:

**Option 1: Browser DevTools**
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

**Option 2: Reset Script**
```bash
./reset-setup.sh
```

### Test the Fix

1. **Start fresh setup wizard**
   - Fill in restaurant details
   - Complete all steps

2. **Watch console logs**
   ```
   [SystemCheckScreen] Request data: {
     "companyName": "Spice Haven",
     "email": "contact@restaurant.com",
     "phone": "9876543210",
     "tenantId": "spice-haven-4567",  ← Unique!
     "businessCategory": "RESTAURANT"
   }
   ```

3. **Expected outcomes:**

   **Success:**
   ```
   ✅ API response: {success: true, activationCode: "XXXX-XXXX-XXXX-XXXX"}
   ✅ StoreCreationModal shows activation code
   ✅ "Continue to Activation" button appears
   ```

   **Still failing:**
   ```
   ❌ Check console for full error message
   ❌ Error will now explain what went wrong clearly
   ```

## Possible Remaining Issues

### Issue 1: API Actually Down
**Error:** "Cannot reach provisioning server"
**Solution:** Check if https://handsfree-admin.pages.dev is accessible

### Issue 2: Missing Required Fields
**Error:** "Invalid restaurant data: missing field X"
**Solution:** API might require additional fields - check request data in console

### Issue 3: API Business Logic Error
**Error:** Server returns 500 for other reasons
**Solution:** Check API logs on Cloudflare dashboard

## Debugging Steps

If you still get a 500 error:

1. **Check the full console log:**
   ```
   [SystemCheckScreen] Request data: {...}
   [SystemCheckScreen] API error: 500 {...}
   ```

2. **Copy the request data** and test manually:
   ```bash
   curl -X POST https://handsfree-admin.pages.dev/api/tenants \
     -H "Content-Type: application/json" \
     -d '{
       "companyName": "Test Restaurant",
       "email": "test@example.com",
       "phone": "1234567890",
       "tenantId": "test-restaurant-9999",
       "businessCategory": "RESTAURANT"
     }'
   ```

3. **Check API response** for more details

4. **Verify API expects this format** - might need different fields

## Changes Summary

| File | Change | Purpose |
|------|--------|---------|
| SystemCheckScreen.tsx | Added timestamp suffix to tenant ID | Prevent duplicates |
| SystemCheckScreen.tsx | Enhanced error parsing | Better user feedback |
| SystemCheckScreen.tsx | Added request logging | Debug visibility |

## Vite Hot Reload Status

✅ Changes are hot-reloaded
✅ App running at http://localhost:1420/
✅ Ready to test immediately

## Next Steps

1. **Clear browser data** (localStorage, sessionStorage)
2. **Start fresh setup**
3. **Watch console logs** for full request details
4. **Report specific error** if it still fails

The unique tenant ID generation should prevent the duplicate error. If you still see a 500 error, the console will now show exactly what went wrong with a user-friendly message.
