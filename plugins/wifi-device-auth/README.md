# WiFi-Verified Device Authentication Plugin

> **Zero-OTP device authentication with WiFi verification for staff and biometric security**

## 🎯 Overview

This plugin eliminates OTP and PIN-based authentication, replacing it with a secure device-bound authentication system that verifies staff physical presence through WiFi network detection.

### Key Features

- ✅ **Zero OTP/PIN** - No SMS codes or PIN numbers to remember
- ✅ **WiFi Verification** - Staff must be on restaurant WiFi for initial registration
- ✅ **Device-Bound Security** - Hardware fingerprint-based authentication
- ✅ **Biometric Support** - Face ID / Touch ID / Fingerprint required
- ✅ **Remote Access** - Works anywhere after initial WiFi registration
- ✅ **Manager Flexibility** - Managers can register from anywhere
- ✅ **Device Management** - Revoke lost/stolen devices instantly

---

## 🔐 How It Works

### For Restaurant Owners/Managers

1. **Add Staff via Admin Panel**
   - Enter: Name, Phone, Role (cashier/kitchen/manager)
   - System generates registration token and 6-digit code
   - Invitation sent via SMS/WhatsApp/Email

2. **Staff Registers Device**
   - Staff downloads mobile app
   - Enters 6-digit code or scans QR code
   - **Must be on restaurant WiFi** (staff only, managers exempt)
   - Sets up biometric authentication
   - Device is registered for 90 days

3. **Daily Usage**
   - Staff opens app anywhere (home, office, restaurant)
   - Biometric authentication (Face ID/Touch ID)
   - Auto-login in <1 second
   - No WiFi requirement after initial registration

4. **Device Loss/Theft**
   - Admin revokes device from admin panel
   - Staff cannot access system anymore
   - Staff gets new invitation for new device
   - **Must re-register on restaurant WiFi**

---

## 📋 Installation

### 1. Build the Plugin

```bash
cd plugins/wifi-device-auth
./build.sh
```

This will:
- Compile Rust worker to WASM
- Optimize with wasm-opt (if available)
- Output: `worker/target/wasm32-unknown-unknown/release/wifi_device_auth_worker.wasm`

### 2. Apply Database Migration

```bash
# For single tenant
wrangler d1 execute {tenant-id}_db --remote \
  --file=migrations/001_wifi_device_auth.sql

# Or via provisioning API
curl -X POST https://your-domain.com/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"plugin_id": "wifi-device-auth", "tenant_id": "your-tenant-id"}'
```

### 3. Configure WiFi SSID

**Via Admin Panel**:
- Settings → Security → WiFi Authentication
- Enter your restaurant WiFi SSID
- Enable/disable WiFi verification

**Via API**:
```bash
curl -X PUT https://your-tenant.handsfree.tech/api/config/wifi \
  -H "Content-Type: application/json" \
  -d '{
    "wifi_ssid": "Restaurant_Guest_WiFi",
    "wifi_verification_enabled": true,
    "device_expiry_days": 90,
    "biometric_required": true
  }'
```

### 4. Deploy Worker

```bash
# Upload WASM to plugin registry
wrangler r2 object put PLUGIN_STORAGE/plugins/wifi-device-auth/1.0.0/worker.wasm \
  --file=worker/target/wasm32-unknown-unknown/release/wifi_device_auth_worker.wasm

# Deploy to tenant worker
# (Automatically handled by plugin installer)
```

---

## 🛠️ Configuration

### Plugin Settings (manifest.json)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `wifi_ssid` | string | *(required)* | Restaurant WiFi network name |
| `wifi_verification_enabled` | boolean | `true` | Require WiFi for staff registration |
| `device_expiry_days` | number | `90` | Days before device token expires |
| `biometric_required` | boolean | `true` | Require Face ID/Touch ID |
| `manager_bypass_wifi` | boolean | `true` | Managers can register anywhere |

### Database Tables

#### `tenant_config`
Stores WiFi SSID and authentication settings per tenant.

#### `staff_users` (modified)
Added fields:
- `phone` - For identification (not OTP)
- `registration_token` - Current active token
- `registration_token_expires_at` - Token expiry timestamp
- `device_registered` - 0 = pending, 1 = registered
- `invited_at` - When invitation was sent
- `registered_at` - When device was registered
- `allow_remote_access` - 1 for managers, 0 for staff

#### `registration_tokens`
Tracks all registration tokens:
- `token_id` - UUID
- `token_hash` - SHA256 of actual token
- `token_short_code` - 6-digit code for SMS
- `wifi_verification_required` - 0 for managers, 1 for staff
- `allowed_wifi_ssid` - Required SSID
- `expires_at` - 7 days from creation
- `used_at` - When token was used

#### `registered_devices`
Tracks all registered devices:
- `device_id` - UUID
- `device_fingerprint` - SHA256 hardware ID
- `device_token_hash` - SHA256 of device token
- `biometric_type` - faceID, touchID, fingerprint, none
- `registered_via_wifi` - SSID used during registration
- `last_seen_at` - Last login timestamp
- `expires_at` - 90 days from registration
- `is_active` - 0 = revoked, 1 = active
- `revoke_reason` - device_lost, employee_terminated, etc.

---

## 📡 API Endpoints

### Device Authentication

#### `POST /api/auth/device/register`
Register new device with WiFi verification.

**Request**:
```json
{
  "registrationToken": "uuid-token-from-invitation",
  "deviceInfo": {
    "deviceId": "uuid",
    "deviceName": "iPhone 13 Pro",
    "deviceModel": "iPhone14,3",
    "deviceOs": "iOS 17.2",
    "deviceFingerprint": "sha256-hardware-id"
  },
  "wifiSSID": "Restaurant_Guest_WiFi",
  "biometricType": "faceID"
}
```

**Response**:
```json
{
  "success": true,
  "deviceToken": "90-day-jwt",
  "sessionToken": "7-day-jwt",
  "user": {
    "userId": "uuid",
    "name": "John Doe",
    "role": "cashier",
    "phone": "+919876543210"
  },
  "tenant": {
    "tenantId": "restaurant-id",
    "name": "My Restaurant",
    "allowRemoteAccess": true
  }
}
```

#### `POST /api/auth/device/login`
Auto-login with device token.

**Request**:
```json
{
  "deviceToken": "90-day-jwt-from-secure-storage",
  "deviceFingerprint": "sha256-hardware-id"
}
```

**Response**:
```json
{
  "success": true,
  "sessionToken": "new-7-day-jwt",
  "user": {
    "userId": "uuid",
    "name": "John Doe",
    "role": "cashier"
  },
  "needsUpdate": false
}
```

### Admin Endpoints

#### `POST /api/admin/users`
Create new user and generate registration token.

**Request**:
```json
{
  "name": "Jane Smith",
  "phone": "+919876543211",
  "role": "cashier",
  "locationId": "branch-01"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "userId": "uuid",
    "name": "Jane Smith",
    "phone": "+919876543211",
    "role": "cashier",
    "registrationToken": "uuid-token",
    "shortCode": "123456",
    "qrCode": "handsfree://register?token=uuid-token",
    "expiresAt": 1707312000
  }
}
```

#### `POST /api/admin/users/:userId/regenerate-token`
Generate new registration token (if previous expired or lost).

#### `GET /api/admin/users/:userId/devices`
List all devices for a user (admin view).

#### `POST /api/auth/devices/:deviceId/revoke`
Revoke device access.

**Request**:
```json
{
  "reason": "device_lost",
  "requireBiometricReset": true
}
```

---

## 🔒 Security Features

### Physical Presence Verification
- **WiFi SSID Matching** - Staff must be on exact restaurant WiFi network
- **IP Address Logging** - Track registration location
- **GPS Coordinates** (optional) - Additional location verification

### Device Security
- **Hardware Fingerprint** - Unique device identification
- **Token Theft Protection** - Fingerprint must match on every login
- **Biometric Requirement** - Face ID / Touch ID / Fingerprint enforced
- **90-Day Expiry** - Tokens expire automatically
- **Instant Revocation** - Admin can revoke any device immediately

### Data Protection
- **SHA256 Token Hashing** - Tokens never stored in plaintext
- **JWT Signatures** - Tamper-proof session tokens
- **Secure Device IDs** - UUIDs prevent enumeration attacks

---

## 🧪 Testing

### Test WiFi Verification (Staff)

```bash
# Should succeed - correct WiFi
curl -X POST http://localhost:8787/api/auth/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "registrationToken": "valid-token",
    "deviceInfo": {...},
    "wifiSSID": "Restaurant_Guest_WiFi",
    "biometricType": "faceID"
  }'

# Should fail - wrong WiFi
curl -X POST http://localhost:8787/api/auth/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "registrationToken": "valid-token",
    "deviceInfo": {...},
    "wifiSSID": "Home_WiFi",
    "biometricType": "faceID"
  }'
# Error: "Please connect to restaurant WiFi to register"
```

### Test Manager Bypass

```bash
# Should succeed - manager can register anywhere
curl -X POST http://localhost:8787/api/auth/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "registrationToken": "manager-token",
    "deviceInfo": {...},
    "wifiSSID": "Any_WiFi",  # WiFi check bypassed
    "biometricType": "touchID"
  }'
```

### Test Device Revocation

```bash
# Revoke device
curl -X POST http://localhost:8787/api/auth/devices/device-uuid/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "device_lost",
    "requireBiometricReset": true
  }'

# Try to login with revoked device
curl -X POST http://localhost:8787/api/auth/device/login \
  -H "Content-Type: application/json" \
  -d '{
    "deviceToken": "revoked-device-token",
    "deviceFingerprint": "sha256-id"
  }'
# Error: "Device access has been revoked. Please contact your manager."
```

---

## 📱 Mobile App Integration

### iOS WiFi Detection

```swift
import NetworkExtension

func getCurrentWiFiSSID() -> String? {
    guard let interfaces = CNCopySupportedInterfaces() as? [String] else {
        return nil
    }

    for interface in interfaces {
        guard let info = CNCopyCurrentNetworkInfo(interface as CFString) as? [String: Any],
              let ssid = info[kCNNetworkInfoKeySSID as String] as? String else {
            continue
        }
        return ssid
    }

    return nil
}
```

### Android WiFi Detection

```kotlin
val wifiManager = context.getSystemService(Context.WIFI_SERVICE) as WifiManager
val wifiInfo = wifiManager.connectionInfo
val ssid = wifiInfo.ssid.removeSurrounding("\"")
```

### Device Registration Flow

```typescript
import { getCurrentWiFiSSID, getBiometricType } from '@/services/device';

async function registerDevice(registrationToken: string) {
  const wifiSSID = await getCurrentWiFiSSID();
  const biometricType = await getBiometricType();

  const response = await fetch('/api/auth/device/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registrationToken,
      deviceInfo: {
        deviceId: await getDeviceId(),
        deviceName: await getDeviceName(),
        deviceModel: await getDeviceModel(),
        deviceOs: await getDeviceOS(),
        deviceFingerprint: await getDeviceFingerprint()
      },
      wifiSSID,
      biometricType
    })
  });

  const { deviceToken, sessionToken } = await response.json();

  // Store tokens in secure storage
  await SecureStorage.setItem('deviceToken', deviceToken);
  await SecureStorage.setItem('sessionToken', sessionToken);
}
```

---

## 🚀 Migration from PIN/OTP Auth

### Step 1: Install Plugin
Apply database migration (adds new fields, keeps PIN column temporarily).

### Step 2: Configure WiFi
Set restaurant WiFi SSID in admin panel.

### Step 3: Create Registration Tokens
For each existing staff member, create registration token via admin panel.

### Step 4: Send Invitations
Invite staff to register devices on restaurant WiFi.

### Step 5: Monitor Progress
Track which staff have registered devices vs. still using PIN.

### Step 6: (Optional) Remove PIN Column
After all staff migrate, run cleanup script to remove `pin_hash` column.

**Cleanup Script** (only run when 100% migrated):
```sql
-- Verify all staff have devices
SELECT s.name, s.device_registered, COUNT(d.device_id) as device_count
FROM staff_users s
LEFT JOIN registered_devices d ON d.user_id = s.user_id AND d.is_active = 1
WHERE s.is_active = 1
GROUP BY s.name, s.device_registered
HAVING device_count = 0;

-- If above returns 0 rows, safe to proceed
-- See migrations/001_wifi_device_auth.sql for PIN removal steps
```

---

## 🐛 Troubleshooting

### "Invalid or expired registration token"
- Token expires after 7 days
- Generate new token via admin panel
- Ensure token is used only once

### "Please connect to restaurant WiFi to register"
- Verify staff is on correct WiFi network
- Check WiFi SSID matches exactly (case-sensitive)
- Ensure WiFi verification is enabled in settings
- Managers bypass WiFi check

### "Device already registered"
- Device fingerprint already exists in system
- Revoke old device first, then re-register
- Or user may be trying to register on multiple accounts

### "Device registration expired - please re-register on restaurant WiFi"
- Device token expired (90 days)
- Staff must physically go to restaurant
- Connect to WiFi and re-register with new token

---

## 📊 Analytics & Monitoring

### Key Metrics

- **Registration Success Rate** - % of invitations that result in device registration
- **WiFi Verification Failures** - How many staff try to register on wrong WiFi
- **Device Revocations** - Number of devices revoked (lost/stolen)
- **Active Devices Per User** - Average number of devices per staff member
- **Token Expiry Rate** - How often devices reach 90-day expiry

### Database Queries

```sql
-- Active devices by role
SELECT user_role, COUNT(*) as device_count
FROM registered_devices
WHERE is_active = 1 AND expires_at > unixepoch()
GROUP BY user_role;

-- Registration success rate
SELECT
  COUNT(*) as total_invitations,
  SUM(CASE WHEN device_registered = 1 THEN 1 ELSE 0 END) as registered,
  ROUND(SUM(CASE WHEN device_registered = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM staff_users
WHERE invited_at IS NOT NULL;

-- Devices expiring soon (next 7 days)
SELECT d.device_name, s.name as staff_name, d.expires_at
FROM registered_devices d
JOIN staff_users s ON d.user_id = s.user_id
WHERE d.is_active = 1
  AND d.expires_at BETWEEN unixepoch() AND unixepoch() + (7 * 24 * 60 * 60)
ORDER BY d.expires_at ASC;
```

---

## 🤝 Support

For issues or questions:
- **Documentation**: `/docs/wifi-device-auth.md`
- **GitHub Issues**: `https://github.com/your-repo/issues`
- **Email**: `support@handsfree.tech`

---

## 📜 License

MIT License - See LICENSE file for details

---

## 🎉 Acknowledgments

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Rust](https://www.rust-lang.org/)
- [jsonwebtoken](https://crates.io/crates/jsonwebtoken)
- [worker-rs](https://github.com/cloudflare/workers-rs)
