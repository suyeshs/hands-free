# Final Authentication Design - Zero OTP

## Core Principle

**No OTP verification anywhere. Phone number is collected but never verified.**

## Complete Authentication Flows

### 1. Initial Restaurant Setup (Desktop App)

```
Step 1: Restaurant Information
  ├── Restaurant name
  ├── Cuisine type
  ├── Address
  └── Phone number (stored, never verified)

Step 2: Owner Account
  ├── Email
  ├── Password
  └── Account created ✓

Step 3: Generate QR for Mobile (Optional)
  ├── Display QR code
  ├── Owner scans with mobile app
  └── Mobile device registered ✓

Step 4: Complete Setup
  └── Full access to dashboard
```

**Result:** Restaurant operational, no phone verification needed

### 2. Mobile Device Registration

```
Desktop App (Already Logged In):
  Settings → Devices → Add Device → QR Code Displayed

Mobile App (First Launch):
  1. Open app
  2. Tap "Scan QR Code"
  3. Scan QR from desktop
  4. Device registered instantly
  5. Setup biometric/PIN
  6. Dashboard access
```

**No phone number, no OTP, no typing**

### 3. Staff Device Registration

```
Desktop App (Manager):
  Staff Management → Select Staff → Generate QR

Mobile App (Staff):
  1. Scan QR code
  2. Device registered with staff permissions
  3. Setup PIN
  4. Limited dashboard access
```

### 4. Subsequent App Launches

```
1. App opens
2. Check device token
3. If valid → Auto-login to dashboard
4. If expired → Show QR scanner
```

## Database Schema

### `restaurant_tenants` - Remove verification fields

```sql
CREATE TABLE restaurant_tenants (
  tenant_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  phone TEXT, -- Stored but never verified
  email TEXT,
  address TEXT,
  cuisine_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);
```

### `registration_tokens` - QR code tokens

```sql
CREATE TABLE registration_tokens (
  token_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT, -- NULL for owner, set for staff
  role TEXT NOT NULL, -- 'owner' or 'staff'
  permissions TEXT, -- JSON array of permissions
  created_by TEXT NOT NULL, -- Who generated this QR
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL, -- 10 minutes from creation
  used_at DATETIME,
  used_by_device_id TEXT,
  is_active INTEGER DEFAULT 1,
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES restaurant_tenants(tenant_id)
);

CREATE INDEX idx_tokens_tenant ON registration_tokens(tenant_id);
CREATE INDEX idx_tokens_active ON registration_tokens(is_active, expires_at);
```

### `registered_devices` - Device management

```sql
CREATE TABLE registered_devices (
  device_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- owner_id or staff_id
  user_role TEXT NOT NULL, -- 'owner' or 'staff'
  device_name TEXT, -- e.g. "Samsung Galaxy S21"
  device_model TEXT,
  device_os TEXT,
  device_fingerprint TEXT NOT NULL UNIQUE,
  device_token_hash TEXT NOT NULL, -- SHA256 hash of device token
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  registered_via TEXT DEFAULT 'qr', -- 'qr' or 'manual'
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- 90 days from registration
  is_active INTEGER DEFAULT 1,
  revoked_at DATETIME,
  revoked_by TEXT,
  revoke_reason TEXT,
  FOREIGN KEY (tenant_id) REFERENCES restaurant_tenants(tenant_id)
);

CREATE INDEX idx_devices_tenant ON registered_devices(tenant_id);
CREATE INDEX idx_devices_user ON registered_devices(user_id);
CREATE INDEX idx_devices_active ON registered_devices(is_active, expires_at);
```

## API Endpoints

### Setup & Registration

#### 1. Create Account (Desktop Setup)

**POST** `/api/setup/create-account`

No authentication required (first-time setup)

Request:
```json
{
  "restaurant": {
    "name": "Coorg Food Company",
    "cuisine": "South Indian",
    "address": "MG Road, Bangalore",
    "phone": "+919876543210"
  },
  "owner": {
    "name": "Rajesh Kumar",
    "email": "rajesh@coorgfood.com",
    "password": "securepassword123"
  }
}
```

Response:
```json
{
  "success": true,
  "tenant": {
    "tenantId": "coorg-food-company-6163",
    "subdomain": "coorg-food-company-6163",
    "apiUrl": "https://coorg-food-company-6163.handsfree.tech"
  },
  "setupToken": "jwt-token",
  "expiresAt": "2026-02-05T18:00:00Z"
}
```

#### 2. Generate Device Registration QR

**POST** `/api/auth/qr/generate`

Headers: `Authorization: Bearer {token}`

Request:
```json
{
  "role": "owner",
  "userId": null,
  "expiresInMinutes": 10,
  "maxUses": 1
}
```

Response:
```json
{
  "success": true,
  "qrData": "handsfree://register?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token": {
    "tokenId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2026-02-05T10:10:00Z",
    "maxUses": 1
  }
}
```

#### 3. Register Device (Mobile App)

**POST** `/api/auth/device/register`

No authentication required (using QR token)

Request:
```json
{
  "registrationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "deviceInfo": {
    "deviceId": "uuid-v4",
    "deviceName": "Samsung Galaxy S21",
    "deviceModel": "SM-G991B",
    "deviceOs": "Android 13",
    "deviceFingerprint": "sha256-hash-of-hardware-id"
  }
}
```

Response:
```json
{
  "success": true,
  "deviceToken": "long-lived-90-day-jwt",
  "sessionToken": "short-lived-7-day-jwt",
  "tenant": {
    "tenantId": "coorg-food-company-6163",
    "tenantName": "Coorg Food Company",
    "subdomain": "coorg-food-company-6163",
    "apiUrl": "https://coorg-food-company-6163.handsfree.tech"
  },
  "user": {
    "userId": "owner-uuid",
    "name": "Rajesh Kumar",
    "role": "owner",
    "permissions": ["all"]
  },
  "device": {
    "deviceId": "uuid-v4",
    "registeredAt": "2026-02-05T10:00:00Z",
    "expiresAt": "2026-05-06T10:00:00Z"
  }
}
```

#### 4. Auto-Login with Device Token

**POST** `/api/auth/device/login`

No session token required (using device token)

Request:
```json
{
  "deviceToken": "long-lived-jwt",
  "deviceFingerprint": "sha256-hash-of-hardware-id"
}
```

Response:
```json
{
  "success": true,
  "sessionToken": "new-short-lived-jwt",
  "user": {
    "userId": "owner-uuid",
    "name": "Rajesh Kumar",
    "role": "owner",
    "permissions": ["all"]
  },
  "tenant": {
    "tenantId": "coorg-food-company-6163",
    "tenantName": "Coorg Food Company"
  }
}
```

### Device Management

#### 5. List Devices

**GET** `/api/auth/devices`

Headers: `Authorization: Bearer {sessionToken}`

Response:
```json
{
  "success": true,
  "devices": [
    {
      "deviceId": "uuid-1",
      "deviceName": "Samsung Galaxy S21",
      "deviceModel": "SM-G991B",
      "role": "owner",
      "registeredAt": "2026-02-05T09:00:00Z",
      "lastSeenAt": "2026-02-05T10:30:00Z",
      "expiresAt": "2026-05-06T09:00:00Z",
      "isActive": true,
      "isCurrent": true
    },
    {
      "deviceId": "uuid-2",
      "deviceName": "iPhone 13 Pro",
      "deviceModel": "iPhone14,3",
      "role": "owner",
      "registeredAt": "2026-01-20T14:00:00Z",
      "lastSeenAt": "2026-02-04T20:15:00Z",
      "expiresAt": "2026-04-21T14:00:00Z",
      "isActive": true,
      "isCurrent": false
    }
  ]
}
```

#### 6. Revoke Device

**POST** `/api/auth/devices/{deviceId}/revoke`

Headers: `Authorization: Bearer {sessionToken}`

Request:
```json
{
  "reason": "Device lost"
}
```

Response:
```json
{
  "success": true,
  "message": "Device revoked successfully",
  "revokedAt": "2026-02-05T10:45:00Z"
}
```

#### 7. Check QR Token Status (for desktop polling)

**GET** `/api/auth/qr/{tokenId}/status`

Headers: `Authorization: Bearer {sessionToken}`

Response (Not Used):
```json
{
  "success": true,
  "used": false,
  "expiresAt": "2026-02-05T10:10:00Z"
}
```

Response (Used):
```json
{
  "success": true,
  "used": true,
  "usedAt": "2026-02-05T10:02:00Z",
  "deviceName": "Samsung Galaxy S21",
  "deviceModel": "SM-G991B"
}
```

## JWT Token Structure

### Registration Token (QR Code)

```json
{
  "iss": "handsfree.tech",
  "sub": "device-registration",
  "typ": "registration",
  "tenantId": "coorg-food-company-6163",
  "tenantName": "Coorg Food Company",
  "apiUrl": "https://coorg-food-company-6163.handsfree.tech",
  "role": "owner",
  "userId": null,
  "permissions": ["all"],
  "tokenId": "uuid",
  "iat": 1738753200,
  "exp": 1738753800
}
```

### Device Token (90 days)

```json
{
  "iss": "handsfree.tech",
  "sub": "device-authentication",
  "typ": "device",
  "deviceId": "uuid",
  "tenantId": "coorg-food-company-6163",
  "userId": "owner-uuid",
  "role": "owner",
  "deviceFingerprint": "sha256-hash",
  "iat": 1738753200,
  "exp": 1746529200
}
```

### Session Token (7 days)

```json
{
  "iss": "handsfree.tech",
  "sub": "owner-uuid",
  "typ": "session",
  "tenantId": "coorg-food-company-6163",
  "role": "owner",
  "permissions": ["all"],
  "deviceId": "uuid",
  "iat": 1738753200,
  "exp": 1739358000
}
```

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DESKTOP APP (Setup)                       │
├─────────────────────────────────────────────────────────────┤
│  1. Enter restaurant info + owner email/password            │
│  2. POST /api/setup/create-account                          │
│  3. Receive setupToken                                      │
│  4. Settings → Generate QR for mobile                       │
│  5. POST /api/auth/qr/generate                              │
│  6. Display QR code                                         │
│  7. Poll GET /api/auth/qr/{tokenId}/status                  │
│  8. Show "Device Registered!" when used                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ QR Code
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (First Launch)                 │
├─────────────────────────────────────────────────────────────┤
│  1. Open app                                                │
│  2. Tap "Scan QR Code"                                      │
│  3. Scan QR code                                            │
│  4. Extract registrationToken from QR                       │
│  5. POST /api/auth/device/register                          │
│     - Send registrationToken + deviceInfo                   │
│  6. Receive deviceToken + sessionToken                      │
│  7. Store in SecureStorage                                  │
│  8. Setup biometric/PIN                                     │
│  9. Navigate to Dashboard                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Next Launch
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                MOBILE APP (Subsequent Launches)              │
├─────────────────────────────────────────────────────────────┤
│  1. App opens                                               │
│  2. Read deviceToken from SecureStorage                     │
│  3. POST /api/auth/device/login                             │
│     - Send deviceToken + deviceFingerprint                  │
│  4. Receive new sessionToken                                │
│  5. Auto-login to Dashboard                                 │
└─────────────────────────────────────────────────────────────┘
```

## Security Features

1. **QR Token Security**
   - Signed JWT (HMAC-SHA256)
   - 10-minute expiry
   - One-time use
   - Cryptographically secure random tokenId

2. **Device Fingerprint**
   - Hardware ID + OS version + App signature
   - SHA256 hashed
   - Validated on every device login
   - Prevents token theft

3. **Device Token**
   - 90-day expiry with auto-refresh
   - Bound to device fingerprint
   - Stored in platform secure storage
   - Revocable by owner

4. **Session Token**
   - 7-day expiry
   - Short-lived for API requests
   - Auto-refreshed from device token
   - Invalid if device revoked

## Benefits

✅ **Zero Friction** - No typing, no OTP, instant registration
✅ **Secure** - Device-bound authentication with fingerprinting
✅ **Fast** - 10 seconds to register vs 2 minutes with OTP
✅ **Multi-Device** - Easy to add multiple devices
✅ **Manageable** - Owner can see and revoke devices
✅ **Offline-Ready** - Device token works offline

## Implementation Priority

1. ✅ Backend: Registration token generation
2. ✅ Backend: Device registration endpoint
3. ✅ Backend: Device login endpoint
4. ✅ Mobile: QR scanner component
5. ✅ Mobile: Device registration flow
6. ✅ Desktop: QR generation in setup
7. ✅ Desktop: Device management UI

This is the final, production-ready authentication system with zero OTP requirements.
