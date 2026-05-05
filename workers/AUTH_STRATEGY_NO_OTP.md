# Authentication Strategy - No OTP Required

## Philosophy

**OTP is only required when accepting real payments, not for setup.**

- Setup should be frictionless
- Phone verification happens when money is involved
- Mobile device registration via QR (no OTP)

## Authentication Flows

### 1. Initial Restaurant Setup (Desktop)

**No OTP Required**

```
Step 1: Restaurant Information
  - Restaurant name
  - Cuisine type
  - Address
  - Phone number (stored, not verified)

Step 2: Owner Account
  - Email
  - Password
  - Account created

Step 3: Mobile Device Registration
  - Generate QR code
  - Mobile scans QR
  - Device registered automatically

Step 4: Complete
  - Dashboard accessible
  - Can view orders, menu, etc.
  - Cannot accept payments yet
```

**Status:** `phone_unverified`, `payment_disabled`

### 2. Payment Activation (When Needed)

**OTP Required (One-time)**

```
Trigger: Owner clicks "Enable Payments" or tries to accept first order

Step 1: Phone Verification
  - Send OTP to stored phone number
  - Enter OTP code
  - Phone verified ✓

Step 2: Payment Processor
  - Connect Stripe/Razorpay
  - Add bank details
  - KYC verification

Step 3: Payments Enabled
  - Can now accept payments
  - Phone verified for compliance
```

**Status:** `phone_verified`, `payment_enabled`

### 3. Mobile Device Registration (via QR)

**No OTP Required**

```
Desktop App:
  1. Owner logs in (already authenticated)
  2. Goes to Settings → Devices → "Add Device"
  3. QR code displayed

Mobile App:
  1. Download app
  2. Tap "Scan QR Code"
  3. Scan QR from desktop
  4. Device registered instantly
  5. Setup biometric/PIN
  6. Dashboard accessible
```

**Status:** Device registered, inherits owner permissions

### 4. Staff Device Registration (via QR)

**No OTP Required**

```
Desktop App (Manager):
  1. Goes to Staff → Select staff member
  2. Click "Generate QR for Device"
  3. QR code displayed

Mobile App (Staff):
  1. Download app
  2. Tap "Scan QR Code"
  3. Scan QR from manager
  4. Device registered with staff role
  5. Setup PIN
  6. Limited dashboard access
```

**Status:** Device registered, staff permissions

## Database Schema Changes

### `restaurant_tenants` table - Add phone verification status

```sql
ALTER TABLE restaurant_tenants
ADD COLUMN phone_verified INTEGER DEFAULT 0;

ALTER TABLE restaurant_tenants
ADD COLUMN phone_verified_at DATETIME;

ALTER TABLE restaurant_tenants
ADD COLUMN payment_enabled INTEGER DEFAULT 0;

ALTER TABLE restaurant_tenants
ADD COLUMN payment_enabled_at DATETIME;
```

### `registration_tokens` table (QR codes)

```sql
CREATE TABLE registration_tokens (
  token_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT, -- NULL for owner, set for staff
  role TEXT NOT NULL, -- 'owner' or 'staff'
  permissions TEXT, -- JSON array
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  used_by_device_id TEXT,
  is_active INTEGER DEFAULT 1,
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES restaurant_tenants(tenant_id)
);
```

### `registered_devices` table

```sql
CREATE TABLE registered_devices (
  device_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL, -- 'owner' or 'staff'
  device_name TEXT,
  device_model TEXT,
  device_os TEXT,
  device_fingerprint TEXT NOT NULL,
  device_token_hash TEXT NOT NULL,
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  registered_via TEXT, -- 'qr', 'manual', 'activation_code'
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1,
  revoked_at DATETIME,
  revoked_by TEXT,
  revoke_reason TEXT,
  FOREIGN KEY (tenant_id) REFERENCES restaurant_tenants(tenant_id)
);
```

## API Endpoints

### Setup Endpoints (No OTP)

#### 1. Create Restaurant & Owner Account

**POST** `/api/setup/create-account`

Request:
```json
{
  "restaurantInfo": {
    "name": "Coorg Food Company",
    "cuisine": "South Indian",
    "address": "MG Road, Bangalore",
    "phone": "+919876543210"
  },
  "ownerInfo": {
    "email": "owner@restaurant.com",
    "password": "securepassword123",
    "name": "Rajesh Kumar"
  }
}
```

Response:
```json
{
  "success": true,
  "tenantId": "coorg-food-company-6163",
  "subdomain": "coorg-food-company-6163",
  "apiUrl": "https://coorg-food-company-6163.handsfree.tech",
  "setupToken": "jwt-token-for-setup",
  "status": {
    "phoneVerified": false,
    "paymentEnabled": false
  }
}
```

#### 2. Generate QR for Mobile Device

**POST** `/api/setup/generate-device-qr`

Headers: `Authorization: Bearer {setupToken}`

Request:
```json
{
  "role": "owner",
  "expiresInMinutes": 10
}
```

Response:
```json
{
  "success": true,
  "qrData": "handsfree://register?token=eyJhbGc...",
  "tokenId": "uuid",
  "expiresAt": "2026-02-05T10:10:00Z"
}
```

#### 3. Mobile: Register Device via QR

**POST** `/api/auth/register-device`

Request:
```json
{
  "registrationToken": "jwt-from-qr",
  "deviceInfo": {
    "deviceId": "uuid",
    "deviceName": "Samsung Galaxy S21",
    "deviceModel": "SM-G991B",
    "deviceOs": "Android 13",
    "deviceFingerprint": "hardware-hash"
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
    "apiUrl": "https://coorg-food-company-6163.handsfree.tech"
  },
  "user": {
    "role": "owner",
    "permissions": ["all"]
  }
}
```

### Payment Activation Endpoints (OTP Required)

#### 4. Request Phone Verification (When enabling payments)

**POST** `/api/payment/verify-phone`

Headers: `Authorization: Bearer {sessionToken}`

Request:
```json
{
  "phone": "+919876543210"
}
```

Response:
```json
{
  "success": true,
  "otpSent": true,
  "message": "OTP sent to +919876543210",
  "otp": "123456" // TEST MODE ONLY
}
```

#### 5. Confirm Phone Verification

**POST** `/api/payment/confirm-phone`

Headers: `Authorization: Bearer {sessionToken}`

Request:
```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

Response:
```json
{
  "success": true,
  "phoneVerified": true,
  "verifiedAt": "2026-02-05T10:00:00Z"
}
```

#### 6. Enable Payment Processing

**POST** `/api/payment/enable`

Headers: `Authorization: Bearer {sessionToken}`

Request:
```json
{
  "paymentProcessor": "stripe",
  "stripeAccountId": "acct_xxxxx"
}
```

Response:
```json
{
  "success": true,
  "paymentEnabled": true,
  "processor": "stripe",
  "enabledAt": "2026-02-05T10:05:00Z"
}
```

### Device Management Endpoints

#### 7. List Registered Devices

**GET** `/api/devices`

Headers: `Authorization: Bearer {sessionToken}`

Response:
```json
{
  "success": true,
  "devices": [
    {
      "deviceId": "uuid-1",
      "deviceName": "Samsung Galaxy S21",
      "role": "owner",
      "registeredAt": "2026-02-05T09:00:00Z",
      "lastSeenAt": "2026-02-05T10:30:00Z",
      "isActive": true,
      "isCurrent": true
    }
  ]
}
```

#### 8. Revoke Device

**POST** `/api/devices/{deviceId}/revoke`

Headers: `Authorization: Bearer {sessionToken}`

Request:
```json
{
  "reason": "Lost device"
}
```

Response:
```json
{
  "success": true,
  "message": "Device revoked successfully"
}
```

## Mobile App Flow (Updated)

### First Launch

```typescript
async function initializeApp() {
  // 1. Check for device token
  const deviceToken = await SecureStorage.get('deviceToken');

  if (deviceToken) {
    // 2. Try auto-login with device token
    try {
      const session = await validateDeviceToken(deviceToken);

      if (session.success) {
        // Auto-login successful
        setAuth(session.sessionToken, session.user);
        navigateTo('dashboard');
        return;
      }
    } catch (error) {
      // Device token invalid/expired
      await SecureStorage.remove('deviceToken');
    }
  }

  // 3. No valid device token - show QR scanner
  navigateTo('qr-scanner');
}
```

### QR Registration

```typescript
async function handleQRScan(qrData: string) {
  // Parse QR code
  const url = new URL(qrData);
  const token = url.searchParams.get('token');

  // Get device info
  const deviceInfo = {
    deviceId: await generateDeviceId(),
    deviceName: await getDeviceName(),
    deviceModel: Device.model,
    deviceOs: `${Device.platform} ${Device.osVersion}`,
    deviceFingerprint: await generateDeviceFingerprint(),
  };

  // Register device
  const result = await api.post('/api/auth/register-device', {
    registrationToken: token,
    deviceInfo,
  });

  // Store tokens securely
  await SecureStorage.set('deviceToken', result.deviceToken);
  await SecureStorage.set('sessionToken', result.sessionToken);

  // Setup biometric
  await enrollBiometric();

  // Navigate to dashboard
  setAuth(result.sessionToken, result.user);
  navigateTo('dashboard');
}
```

## Desktop App Flow (Updated)

### Initial Setup Wizard

```typescript
const setupSteps = [
  {
    title: 'Restaurant Information',
    component: RestaurantInfoForm,
  },
  {
    title: 'Owner Account',
    component: OwnerAccountForm,
    // Email + Password only, no OTP
  },
  {
    title: 'Mobile Device Setup',
    component: QRDeviceRegistration,
    optional: true, // Can skip
  },
  {
    title: 'Complete',
    component: SetupComplete,
  },
];

// Note: Payment setup moved to settings
// Only shown when owner tries to enable payments
```

### Payment Activation (Settings)

```typescript
// Settings → Payment Configuration

function PaymentActivation() {
  const [step, setStep] = useState('verify-phone');

  if (step === 'verify-phone') {
    return <PhoneVerification onVerified={() => setStep('connect-processor')} />;
  }

  if (step === 'connect-processor') {
    return <PaymentProcessorSetup onComplete={() => setStep('complete')} />;
  }

  return <PaymentEnabled />;
}
```

## Benefits of This Approach

✅ **Frictionless Setup** - No OTP during initial setup
✅ **Secure Payments** - Phone verified before accepting money
✅ **Quick Mobile Access** - QR scan, instant registration
✅ **Compliance** - Phone verification for payment regulations
✅ **Multi-Device** - Easy to add new devices
✅ **Revocable** - Can disable devices remotely

## Security Considerations

1. **QR Token Security**
   - JWT signed with secret key
   - 10-minute expiry
   - One-time use
   - Revocable before use

2. **Device Token Security**
   - 90-day expiry
   - Bound to device fingerprint
   - Stored in secure storage
   - Automatically refreshed

3. **Payment Verification**
   - OTP required before enabling payments
   - Phone verified and stored
   - Compliance with payment regulations

4. **Account Takeover Prevention**
   - Email verification (optional)
   - Device fingerprint validation
   - Audit log of all device registrations
   - Alert owner of new device registrations

## Migration Plan

1. **Phase 1**: Remove OTP from setup flow
2. **Phase 2**: Implement QR registration endpoints
3. **Phase 3**: Update mobile app with QR scanner
4. **Phase 4**: Move payment activation to settings
5. **Phase 5**: Add device management UI

## Summary

**No OTP Needed For:**
- ❌ Initial restaurant setup
- ❌ Mobile device registration
- ❌ Staff device registration
- ❌ Daily app usage

**OTP Required For:**
- ✅ Payment activation (one-time)
- ✅ Sensitive account changes (optional)

This creates the best user experience while maintaining security where it matters most - financial transactions.
