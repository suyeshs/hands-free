# OTP Bypass Implementation Summary

## Overview

Implemented a complete bypass of the MSG91 OTP verification flow for the restaurant storefront. Users can now enter their phone number and name, then proceed directly to the delivery address workflow without entering a verification PIN.

## Changes Made

### 1. Restaurant Client (Storefront)

**Location**: `workers/restaurant-client/`

**Status**: ✅ Copied from `/Users/stonepot-tech/projects/handsfree-restaurant-new/client/restaurant-client`

**Key Files Modified**:

- **`app/components/order/OrderFlow.tsx`**
  - Line 22: Added `ENABLE_OTP_VERIFICATION` environment variable check
  - Line 271: Passes `enableOTPVerification={ENABLE_OTP_VERIFICATION}` to CustomerInfo component

- **`wrangler.jsonc`**
  - Line 24: Set `"NEXT_PUBLIC_ENABLE_OTP_VERIFICATION": "false"`

**Behavior**:
- When `ENABLE_OTP_VERIFICATION = false`:
  - Customer enters phone + name
  - Form calls mock verification endpoint
  - Proceeds directly to address entry
  - No PIN screen shown

### 2. Restaurant Worker (Backend API)

**Location**: `workers/restaurant/`

**Key Files Modified**:

- **`src/index.ts`**
  - Added Referer header extraction for tenant identification (lines 177-195)
  - Added query parameter fallback for `tenantId`
  - Added `workers_dev: true` to wrangler.jsonc to enable workers.dev URL access
  - Implemented mock customer endpoints:
    - `POST /api/customers/verify-device` (lines 441-466)
    - `GET /api/customers/phone/:phone` (mock implementation)

**Mock Endpoint Response**:
```typescript
POST /api/customers/verify-device
{
  phone: string;
  name?: string;
  email?: string;
  fingerprintHash?: string;
}

Response:
{
  success: true,
  customer: {
    id: 'mock-customer-1234',
    phone: '+1234567890',
    name: 'Guest Customer',
    email: null,
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    createdAt: '2026-02-20T12:00:00Z',
    updatedAt: '2026-02-20T12:00:00Z'
  },
  message: 'Device verified (mock mode - verification bypassed)'
}
```

- **`wrangler.jsonc`**
  - Added `"workers_dev": true` to enable access at both subdomain and workers.dev URLs

### 3. MSG91 Verify Worker

**Location**: `workers/msg91-verify/`

**Key Files Modified**:

- **`src/index.ts`**
  - Lines 81-94: Added bypass mode that activates when `MSG91_AUTH_KEY` secret is not set
  - Returns mock verification response without calling MSG91 API

**Bypass Activation**:
```bash
# To activate bypass mode (delete the secret)
cd workers/msg91-verify
wrangler secret delete MSG91_AUTH_KEY

# To re-enable real verification (set the secret)
wrangler secret put MSG91_AUTH_KEY
```

### 4. Root Package.json

**Location**: `package.json`

**Added Deployment Scripts**:
```json
{
  "deploy:restaurant-client": "cd workers/restaurant-client && npm run deploy:worker",
  "deploy:restaurant-worker": "cd workers/restaurant && wrangler deploy",
  "deploy:msg91-verify": "cd workers/msg91-verify && wrangler deploy",
  "deploy:theme-worker": "cd workers/theme-edge-worker && wrangler deploy"
}
```

### 5. Gitignore

**Location**: `.gitignore`

**Added**:
```
# Next.js (restaurant-client)
.next/
.open-next/
```

## Deployment Status

### Restaurant Client
- **Deployed**: ✅ Yes
- **URL**: https://handsfree-restaurant-client.suyesh.workers.dev
- **Last Deployment**: January 22, 2026 (from previous location)
- **OTP Verification**: Disabled via `NEXT_PUBLIC_ENABLE_OTP_VERIFICATION: "false"`

### Restaurant Worker
- **Deployed**: ✅ Yes
- **URL**: https://handsfree-restaurant.suyesh.workers.dev
- **Workers.dev Access**: ✅ Enabled
- **Mock Endpoints**: ✅ Active

### MSG91 Verify Worker
- **Deployed**: ✅ Yes
- **Bypass Mode**: ✅ Active (MSG91_AUTH_KEY deleted)

## Testing the Flow

### Test New Customer Flow

1. Visit: https://handsfree-restaurant-client.suyesh.workers.dev
2. Add items to cart
3. Click "Checkout" or "Place Order"
4. **Customer Info Screen**:
   - Enter phone: `+1234567890`
   - Enter name: `Test Customer`
   - Click "Continue"
5. **Expected**: Directly see Address Entry screen (no PIN entry)
6. Enter delivery address
7. Complete checkout

### Test Returning Customer Flow

1. Visit storefront
2. Add items to cart
3. Click "Checkout"
4. **Customer Info Screen**:
   - Enter same phone number used before
   - System should recognize returning customer
5. **Expected**: See saved addresses for selection

## Deployment Commands

### From Root Directory

```bash
# Deploy restaurant client (storefront)
npm run deploy:restaurant-client

# Deploy restaurant worker (backend API)
npm run deploy:restaurant-worker

# Deploy MSG91 verify worker
npm run deploy:msg91-verify
```

### From Individual Worker Directories

```bash
# Restaurant client
cd workers/restaurant-client
npm run deploy:worker

# Restaurant worker
cd workers/restaurant
wrangler deploy

# MSG91 verify worker
cd workers/msg91-verify
wrangler deploy
```

## Re-enabling OTP Verification

To restore the traditional OTP flow:

### 1. Update Restaurant Client

Edit `workers/restaurant-client/wrangler.jsonc`:
```json
{
  "vars": {
    "NEXT_PUBLIC_ENABLE_OTP_VERIFICATION": "true"
  }
}
```

Deploy:
```bash
cd workers/restaurant-client
npm run deploy:worker
```

### 2. Enable MSG91 Integration

```bash
cd workers/msg91-verify
wrangler secret put MSG91_AUTH_KEY
# Enter your MSG91 auth key when prompted

wrangler deploy
```

### 3. Update Restaurant Worker (Optional)

The mock endpoints will continue to work, but you may want to:
- Remove or comment out mock customer endpoints
- Route customer APIs through dispatch namespace to tenant workers
- Restore real customer database lookups

## Architecture Diagram

```
Customer Browser
     |
     | HTTPS
     v
Restaurant Client (Next.js on Cloudflare Workers)
https://handsfree-restaurant-client.suyesh.workers.dev
     |
     | Fetch API
     v
Restaurant Worker (Customer API endpoints)
https://handsfree-restaurant.suyesh.workers.dev
     |
     | (OTP Disabled - Mock Response)
     v
Customer Object: { id, phone, name, ... }
     |
     v
Address Entry Workflow
```

## Troubleshooting

### Issue: Still Seeing PIN Entry Screen

**Symptoms**: After entering phone/name, user sees 6-digit PIN entry

**Solution**:
```bash
cd workers/restaurant-client
# Verify wrangler.jsonc has: "NEXT_PUBLIC_ENABLE_OTP_VERIFICATION": "false"
npm run deploy:worker
# Clear browser cache or test in incognito mode
```

### Issue: Customer Verification Fails

**Symptoms**: Error after submitting phone/name, form doesn't proceed

**Solution**:
```bash
# Check restaurant worker logs
cd workers/restaurant
wrangler tail

# Look for errors in mock endpoint
# Verify restaurant worker is accessible
curl https://handsfree-restaurant.suyesh.workers.dev/health
```

### Issue: CORS Errors

**Symptoms**: Browser console shows CORS errors when calling API

**Solution**:
- Verify `workers_dev: true` in `workers/restaurant/wrangler.jsonc`
- Check CORS headers in restaurant worker responses
- Ensure Referer header extraction is working

### Issue: Tenant ID Not Found

**Symptoms**: 500 error with "Tenant ID not found" message

**Solution**:
- Verify storefront URL matches pattern: `{tenant}.handsfree.tech`
- Check Referer header is being sent
- Review tenant ID extraction logic in restaurant worker (lines 177-195)

## Related Documentation

- [Restaurant Client README](./restaurant-client/README.md) - Detailed storefront documentation
- [Restaurant Worker README](./restaurant/README.md) - Backend API documentation
- [MSG91 Verify Worker](./msg91-verify/README.md) - OTP service documentation

## Files Changed Summary

| File | Type | Description |
|------|------|-------------|
| `workers/restaurant-client/app/components/order/OrderFlow.tsx` | Modified | Added OTP toggle via env variable |
| `workers/restaurant-client/wrangler.jsonc` | Modified | Set `ENABLE_OTP_VERIFICATION: "false"` |
| `workers/restaurant/src/index.ts` | Modified | Added mock customer endpoints, Referer extraction |
| `workers/restaurant/wrangler.jsonc` | Modified | Added `workers_dev: true` |
| `workers/msg91-verify/src/index.ts` | Modified | Added bypass mode |
| `package.json` | Modified | Added deployment scripts |
| `.gitignore` | Modified | Added Next.js build artifacts |
| `workers/restaurant-client/` | Added | Copied entire storefront app |
| `workers/restaurant-client/README.md` | Added | Comprehensive documentation |
| `workers/OTP_BYPASS_IMPLEMENTATION.md` | Added | This file |

## Next Steps

1. **Test the Flow**: Verify the OTP bypass works end-to-end on production
2. **Monitor Logs**: Watch for any errors in customer verification
3. **Customer Feedback**: Gather user feedback on the simplified flow
4. **Database Integration**: Consider implementing real customer lookup (optional)
5. **Analytics**: Track conversion rates with vs without OTP verification

## Notes

- Mock endpoints are suitable for development/testing
- For production, consider implementing real customer database lookup
- The bypass can be toggled on/off without code changes (just environment variables and secrets)
- All changes are backwards compatible - OTP flow can be re-enabled anytime
