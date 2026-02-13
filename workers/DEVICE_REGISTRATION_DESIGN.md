# Device Registration & Authentication Design

## Problem
- OTP should only be needed once during initial device setup
- Subsequent app launches should be seamless
- Need to balance security with convenience

## Solution: Device Registration Workflow

### 1. Initial Device Registration (One-time)

```
User Flow:
1. Enter Activation Code → Verify Restaurant
2. Enter Phone Number → Send OTP
3. Enter OTP → Verify Identity
4. Register Device → Generate long-lived device token
5. Store Device Token → Encrypted local storage
```

**Backend Flow:**
- Generate unique `deviceId` (UUID)
- Create device record in database with:
  - `deviceId`
  - `tenantId`
  - `userId` (owner ID)
  - `deviceName` (e.g., "Samsung Galaxy S21")
  - `deviceFingerprint` (hardware ID + app signature)
  - `registeredAt`
  - `lastSeenAt`
  - `isActive`
- Generate long-lived JWT (90 days) with `deviceId` claim
- Return both short-lived session token (7 days) and device token

### 2. Subsequent App Launches (Auto-login)

```
User Flow:
1. App Opens → Check for device token
2. If valid → Auto-login to dashboard
3. If expired/invalid → Show phone + biometric screen (no OTP)
4. If no device token → Full registration flow
```

**Backend Flow:**
- Verify device token signature
- Check device is still active in database
- Check device hasn't been revoked
- Generate new session token
- Update `lastSeenAt` timestamp

### 3. Device Management

**Owner Portal Features:**
- List all registered devices
- See last active time for each device
- Revoke device access remotely
- Set device nickname
- View device registration history

**Security Features:**
- Max 5 devices per owner
- Auto-revoke devices inactive for 90+ days
- Detect suspicious device changes (fingerprint mismatch)
- Support for remote device wipe

## Database Schema

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
  device_token_hash TEXT NOT NULL, -- Hashed device token
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
CREATE INDEX idx_devices_active ON registered_devices(tenant_id, is_active);
```

## API Endpoints

### 1. Register Device (after OTP verification)

**POST** `/api/auth/device/register`

Request:
```json
{
  "phone": "+919876543210",
  "otp": "123456",
  "deviceInfo": {
    "deviceId": "uuid-generated-by-app",
    "deviceName": "Samsung Galaxy S21",
    "deviceModel": "SM-G991B",
    "deviceOs": "Android 13",
    "deviceFingerprint": "hardware-id-hash"
  }
}
```

Response:
```json
{
  "success": true,
  "sessionToken": "short-lived-7-day-jwt",
  "deviceToken": "long-lived-90-day-jwt",
  "user": { /* user details */ },
  "device": {
    "deviceId": "uuid",
    "registeredAt": "2026-02-05T10:00:00Z",
    "expiresAt": "2026-05-06T10:00:00Z"
  }
}
```

### 2. Authenticate with Device Token

**POST** `/api/auth/device/login`

Request:
```json
{
  "deviceToken": "long-lived-jwt",
  "deviceFingerprint": "hardware-id-hash"
}
```

Response:
```json
{
  "success": true,
  "sessionToken": "new-short-lived-jwt",
  "user": { /* user details */ }
}
```

### 3. Refresh Device Token

**POST** `/api/auth/device/refresh`

Request:
```json
{
  "deviceToken": "current-device-token"
}
```

Response:
```json
{
  "success": true,
  "deviceToken": "new-90-day-jwt",
  "expiresAt": "2026-08-05T10:00:00Z"
}
```

### 4. List User Devices

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
      "registeredAt": "2026-01-15T10:00:00Z",
      "lastSeenAt": "2026-02-05T09:30:00Z",
      "isActive": true,
      "isCurrent": true
    },
    {
      "deviceId": "uuid-2",
      "deviceName": "iPhone 13",
      "deviceModel": "iPhone14,5",
      "registeredAt": "2026-02-01T14:20:00Z",
      "lastSeenAt": "2026-02-04T18:45:00Z",
      "isActive": true,
      "isCurrent": false
    }
  ]
}
```

### 5. Revoke Device

**POST** `/api/auth/devices/{deviceId}/revoke`

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

## Mobile App Implementation

### Device Fingerprint Generation

```typescript
// Generate stable device fingerprint
async function generateDeviceFingerprint(): Promise<string> {
  const deviceInfo = await Device.getInfo();
  const deviceId = await Device.getId();

  const fingerprint = {
    id: deviceId.uuid,
    model: deviceInfo.model,
    platform: deviceInfo.platform,
    osVersion: deviceInfo.osVersion,
    manufacturer: deviceInfo.manufacturer,
  };

  // Hash the fingerprint for privacy
  const hash = await sha256(JSON.stringify(fingerprint));
  return hash;
}
```

### Auth Flow Logic

```typescript
async function initializeApp() {
  // 1. Check for device token
  const deviceToken = await SecureStorage.get('deviceToken');

  if (deviceToken) {
    // 2. Try to authenticate with device token
    const fingerprint = await generateDeviceFingerprint();

    try {
      const result = await deviceLogin(deviceToken, fingerprint);

      if (result.success) {
        // Auto-login successful
        setAuth(result.sessionToken, result.user);
        return;
      }
    } catch (error) {
      // Device token invalid or expired
      await SecureStorage.remove('deviceToken');
    }
  }

  // 3. No valid device token - show registration flow
  showAuthFlow();
}
```

### Storing Device Token

```typescript
async function registerDevice(phone: string, otp: string) {
  const deviceInfo = {
    deviceId: await generateDeviceId(),
    deviceName: await getDeviceName(),
    deviceModel: Device.model,
    deviceOs: `${Device.platform} ${Device.osVersion}`,
    deviceFingerprint: await generateDeviceFingerprint(),
  };

  const result = await api.post('/api/auth/device/register', {
    phone,
    otp,
    deviceInfo,
  });

  // Store tokens securely
  await SecureStorage.set('deviceToken', result.deviceToken);
  await SecureStorage.set('sessionToken', result.sessionToken);

  setAuth(result.sessionToken, result.user);
}
```

## Security Considerations

1. **Device Token Storage**
   - Use secure storage (Keychain on iOS, Keystore on Android)
   - Never store in plain SharedPreferences/UserDefaults
   - Encrypt at rest

2. **Device Fingerprint**
   - Hash hardware identifiers
   - Detect fingerprint changes (device compromise)
   - Validate on every request

3. **Token Rotation**
   - Session tokens: 7 days (short-lived)
   - Device tokens: 90 days (long-lived)
   - Auto-refresh before expiry
   - Support manual refresh

4. **Revocation**
   - Immediate effect on next API call
   - Push notification to inform user
   - Log all revocation events

5. **Rate Limiting**
   - Max 3 failed device login attempts per hour
   - Lock device after 5 failed attempts
   - Require OTP to unlock

## Alternative: Biometric + Device Token

For even better UX, combine device token with biometric:

```
First Launch:
1. Activation Code
2. Phone + OTP
3. Register Device + Enroll Biometric

Subsequent Launches:
1. Biometric Prompt (Face/Fingerprint)
2. If success → Use device token to get session
3. If fail → Fallback to phone + password (no OTP needed)
```

## Migration Plan

1. **Phase 1**: Implement device registration table and endpoints
2. **Phase 2**: Update mobile app to register device after OTP
3. **Phase 3**: Add device token auto-login logic
4. **Phase 4**: Add biometric support
5. **Phase 5**: Build device management UI in owner portal

## Benefits

✅ **Better UX**: OTP only needed once
✅ **Secure**: Device-bound tokens, revocable access
✅ **Manageable**: Owner can see and manage all devices
✅ **Scalable**: Works for multiple devices per user
✅ **Offline-friendly**: Session token works without network
✅ **Privacy**: Device fingerprints are hashed

## Recommendation

**Implement Device Registration** with these priorities:

1. **High Priority**: Device token registration and auto-login
2. **Medium Priority**: Device management UI
3. **Low Priority**: Biometric integration

This approach eliminates repeated OTP hassle while maintaining security through device-bound authentication.
