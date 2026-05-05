# Authentication Endpoints - Implementation Summary

## ✅ Completed Worker Endpoints

### 1. Tenant Verification Endpoint

**File**: `/platform/workers/restaurant-provisioning/src/index.ts`

**Endpoint**: `POST /api/verify-tenant`

**Purpose**: Validates activation code and returns tenant details for mobile app authentication

**Request Body**:
```json
{
  "activationCode": "XXXX-XXXX-XXXX-XXXX"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "tenantId": "uuid",
  "tenantName": "Airarang Restaurant",
  "subdomain": "airarang",
  "apiUrl": "https://airarang.handsfree.tech",
  "fullDomain": "airarang.handsfree.tech",
  "businessCategory": "restaurant"
}
```

**Error Responses**:
- 400: Missing activation code
- 403: Activation code already used
- 404: Invalid or expired activation code / Tenant not found
- 500: Internal server error

---

### 2. Owner Phone Verification Endpoint

**File**: `/platform/workers/tenant-router/tenant-worker/src/handlers/auth.ts`

**Endpoint**: `POST /api/auth/owner/verify-phone`

**Purpose**: Validates owner phone number and sends OTP via MSG91

**Request Body**:
```json
{
  "phone": "+919876543210"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "otpSent": true,
  "message": "OTP sent to your phone number",
  "phone": "+919876543210"
}
```

**Error Responses**:
- 400: Missing phone or invalid format (must be E.164)
- 403: Phone not registered as owner for this restaurant
- 404: Tenant not found
- 500: Failed to send OTP / Internal server error

---

### 3. Owner OTP Verification Endpoint

**File**: `/platform/workers/tenant-router/tenant-worker/src/handlers/auth.ts`

**Endpoint**: `POST /api/auth/owner/verify-otp`

**Purpose**: Verifies OTP and generates JWT token for owner authentication

**Request Body**:
```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "tenant-uuid",
    "phone": "+919876543210",
    "email": "owner@restaurant.com",
    "role": "owner",
    "tenantId": "tenant-uuid",
    "tenantName": "Airarang Restaurant",
    "subdomain": "airarang"
  }
}
```

**Error Responses**:
- 400: Missing phone or OTP
- 401: Invalid or expired OTP
- 404: Tenant not found
- 500: Internal server error

---

### 4. Staff Credentials Verification Endpoint

**File**: `/platform/workers/tenant-router/tenant-worker/src/handlers/auth.ts`

**Endpoint**: `POST /api/auth/staff/verify-credentials`

**Purpose**: Authenticates staff member with phone and PIN

**Request Body**:
```json
{
  "phone": "+919876543210",
  "pin": "1234"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "staff-uuid",
    "name": "Rajesh Kumar",
    "phone": "+919876543210",
    "role": "waiter",
    "tenantId": "tenant-uuid",
    "tenantName": "Airarang Restaurant",
    "subdomain": "airarang",
    "locationId": "loc-mg-road"
  }
}
```

**Error Responses**:
- 400: Missing phone or PIN
- 401: Invalid phone number or PIN
- 500: Internal server error

**Note**: In production, PIN should be hashed in the database

---

## Configuration Updates

### 1. Restaurant Provisioning Worker

**Changes**:
- Added `/api/verify-tenant` endpoint (line 159-263)
- Validates activation codes from KV store
- Returns tenant details for mobile app

### 2. Tenant Worker

**Files Modified**:
- `src/index.ts`: Added auth routes (lines 759-779)
- `src/handlers/auth.ts`: New file with auth handlers
- `wrangler.jsonc`: Added environment variables

**Environment Variables**:
```json
{
  "MSG91_VERIFY_WORKER_URL": "https://verify-msg91.handsfree.tech",
  "JWT_SECRET": "change-this-in-production-use-wrangler-secret"
}
```

---

## Authentication Flow

### Owner Mobile App:

```
1. Enter activation code → POST /api/verify-tenant
2. Enter phone → POST {apiUrl}/api/auth/owner/verify-phone (sends OTP)
3. Enter OTP → POST {apiUrl}/api/auth/owner/verify-otp (returns token)
4. All API calls use: Authorization: Bearer {token}
```

### Staff Mobile App:

```
1. Enter activation code → POST /api/verify-tenant
2. Enter phone + PIN → POST {apiUrl}/api/auth/staff/verify-credentials (returns token)
3. All API calls use: Authorization: Bearer {token}
```

---

## Security Features

- **Activation codes**: Single-use, KV-stored, normalized format
- **Phone verification**: E.164 format, OTP via MSG91
- **JWT tokens**: HMAC-SHA256, 7-day expiry
- **Staff auth**: PIN-based with active status check

---

## Deployment URLs

- **Provisioning**: `https://provisioning.handsfree.tech/api/verify-tenant`
- **Tenant Auth**: `https://{subdomain}.handsfree.tech/api/auth/*`
- **MSG91**: `https://verify-msg91.handsfree.tech` (internal)

---

## Next Steps

1. ✅ Worker endpoints implemented
2. ⏳ Test endpoints
3. ⏳ Implement mobile auth screens
4. ⏳ End-to-end testing

---

**Last Updated**: February 2026
**Status**: Implementation Complete - Ready for Testing
