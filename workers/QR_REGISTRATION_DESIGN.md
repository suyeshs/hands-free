# QR Code Device Registration Design

## Overview

Replace manual activation code entry with QR code scanning for instant, secure device registration.

## Benefits

✅ **No typing** - Scan QR, instant registration
✅ **No OTP** - Pre-authenticated via QR token
✅ **Faster onboarding** - 5 seconds vs 2 minutes
✅ **Fewer errors** - No typos in activation codes
✅ **Better security** - Time-limited, one-time-use tokens
✅ **Role-based** - QR can specify owner vs staff permissions

## User Flows

### Flow 1: Owner Registers New Device (Recommended)

**Prerequisites:**
- Owner is logged into web portal on desktop/another device

**Steps:**
1. **Web Portal**: Owner clicks "Add New Device"
2. **Web Portal**: System generates QR code with registration token
3. **Mobile App**: Owner opens app → "Scan QR to Register"
4. **Mobile App**: Scans QR code
5. **Mobile App**: App validates token with backend
6. **Mobile App**: Device registered, show biometric setup
7. **Mobile App**: Biometric enrolled → Dashboard

**Time:** ~10 seconds

### Flow 2: Staff Member Registration

**Prerequisites:**
- Manager/Owner generates staff QR from portal

**Steps:**
1. **Web Portal**: Manager selects staff member → "Generate Device QR"
2. **Web Portal**: QR displayed with staff permissions
3. **Mobile App**: Staff opens app → Scan QR
4. **Mobile App**: Device registered with staff role
5. **Mobile App**: Set PIN/Biometric → Dashboard

**Time:** ~10 seconds

### Flow 3: Fallback (No QR Access)

**For users who can't scan QR:**
1. Manual activation code entry (current flow)
2. Phone + OTP verification
3. Device registration

**Time:** ~2 minutes

## QR Code Payload Structure

### JWT Token (Signed by backend)

```json
{
  "iss": "handsfree.tech",
  "sub": "device-registration",
  "tenantId": "coorg-food-company-6163",
  "tenantName": "Coorg Food Company",
  "role": "owner",
  "userId": "optional-for-staff",
  "permissions": ["view_sales", "manage_menu", "manage_staff"],
  "registrationToken": "one-time-token-uuid",
  "iat": 1738753200,
  "exp": 1738753800, // 10 minutes expiry
  "apiUrl": "https://coorg-food-company-6163.handsfree.tech"
}
```

### QR Code Format

```
handsfree://register?token=<jwt-token>
```

**Example:**
```
handsfree://register?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Database Schema

### `registration_tokens` table

```sql
CREATE TABLE registration_tokens (
  token_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT, -- NULL for owner, set for staff
  role TEXT NOT NULL, -- 'owner' or 'staff'
  permissions TEXT, -- JSON array
  created_by TEXT NOT NULL, -- Who generated the QR
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  used_by_device_id TEXT,
  is_active INTEGER DEFAULT 1,
  max_uses INTEGER DEFAULT 1, -- Allow multi-use for staff onboarding
  use_count INTEGER DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES restaurant_tenants(tenant_id)
);

CREATE INDEX idx_tokens_tenant ON registration_tokens(tenant_id);
CREATE INDEX idx_tokens_active ON registration_tokens(tenant_id, is_active, expires_at);
```

## API Endpoints

### 1. Generate Registration QR (Web Portal)

**POST** `/api/auth/qr/generate`

Headers: `Authorization: Bearer {owner-session-token}`

Request:
```json
{
  "role": "owner",
  "userId": "optional-staff-user-id",
  "permissions": ["view_sales", "manage_menu"],
  "expiresInMinutes": 10,
  "maxUses": 1,
  "deviceName": "Owner's iPhone" // Optional hint
}
```

Response:
```json
{
  "success": true,
  "qrData": "handsfree://register?token=eyJhbGc...",
  "qrImage": "data:image/png;base64,iVBORw0KGgo...", // Base64 PNG
  "token": {
    "tokenId": "uuid",
    "expiresAt": "2026-02-05T10:10:00Z",
    "maxUses": 1
  }
}
```

### 2. Validate Registration Token (Mobile App)

**POST** `/api/auth/qr/validate`

Request:
```json
{
  "token": "jwt-from-qr-code",
  "deviceInfo": {
    "deviceId": "uuid-generated-by-app",
    "deviceName": "Samsung Galaxy S21",
    "deviceModel": "SM-G991B",
    "deviceOs": "Android 13",
    "deviceFingerprint": "hardware-id-hash"
  }
}
```

Response (Success):
```json
{
  "success": true,
  "tenant": {
    "tenantId": "coorg-food-company-6163",
    "tenantName": "Coorg Food Company",
    "apiUrl": "https://coorg-food-company-6163.handsfree.tech"
  },
  "user": {
    "role": "owner",
    "permissions": ["view_sales", "manage_menu", "manage_staff"]
  },
  "deviceToken": "long-lived-90-day-jwt",
  "sessionToken": "short-lived-7-day-jwt"
}
```

Response (Error):
```json
{
  "success": false,
  "error": "Token expired",
  "errorCode": "TOKEN_EXPIRED"
}
```

### 3. List Active Registration Tokens (Web Portal)

**GET** `/api/auth/qr/list`

Headers: `Authorization: Bearer {owner-session-token}`

Response:
```json
{
  "success": true,
  "tokens": [
    {
      "tokenId": "uuid-1",
      "role": "staff",
      "createdAt": "2026-02-05T09:00:00Z",
      "expiresAt": "2026-02-05T09:10:00Z",
      "isActive": true,
      "maxUses": 1,
      "useCount": 0,
      "usedByDevice": null
    },
    {
      "tokenId": "uuid-2",
      "role": "owner",
      "createdAt": "2026-02-04T14:30:00Z",
      "expiresAt": "2026-02-04T14:40:00Z",
      "isActive": false,
      "maxUses": 1,
      "useCount": 1,
      "usedByDevice": "Samsung Galaxy S21",
      "usedAt": "2026-02-04T14:32:00Z"
    }
  ]
}
```

### 4. Revoke Registration Token

**DELETE** `/api/auth/qr/{tokenId}`

Headers: `Authorization: Bearer {owner-session-token}`

Response:
```json
{
  "success": true,
  "message": "Registration token revoked"
}
```

## Mobile App Implementation

### 1. Add QR Scanner Dependency

```bash
bun add react-qr-reader @tauri-apps/plugin-camera
```

### 2. QR Scanner Component

```typescript
// src/components/auth/QRScanner.tsx
import { useState } from 'react';
import { Camera } from '@tauri-apps/plugin-camera';

export function QRScanner({ onScan }: { onScan: (data: string) => void }) {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState('');

  const handleScan = async () => {
    try {
      const permission = await Camera.requestPermissions();

      if (permission.camera !== 'granted') {
        setError('Camera permission denied');
        return;
      }

      // Open camera and scan QR
      const result = await Camera.scanQR();

      if (result && result.startsWith('handsfree://register?token=')) {
        onScan(result);
      } else {
        setError('Invalid QR code');
      }
    } catch (err) {
      setError('Failed to scan QR code');
    }
  };

  return (
    <div className="qr-scanner">
      <div className="camera-preview">
        {/* Camera viewfinder */}
      </div>

      {error && <p className="error">{error}</p>}

      <button onClick={handleScan}>
        Scan QR Code
      </button>

      <button onClick={() => onFallback()}>
        Enter code manually
      </button>
    </div>
  );
}
```

### 3. Updated Auth Flow

```typescript
// src/components/auth/AuthFlow.tsx
export function AuthFlow() {
  const [step, setStep] = useState<'qr' | 'manual'>('qr');

  const handleQRScan = async (qrData: string) => {
    // Extract token from URL
    const url = new URL(qrData);
    const token = url.searchParams.get('token');

    if (!token) {
      setError('Invalid QR code');
      return;
    }

    // Validate token and register device
    const deviceInfo = await getDeviceInfo();
    const result = await api.post('/api/auth/qr/validate', {
      token,
      deviceInfo,
    });

    if (result.success) {
      // Store tokens
      await SecureStorage.set('deviceToken', result.deviceToken);
      await SecureStorage.set('sessionToken', result.sessionToken);

      // Setup biometric
      setStep('biometric');
    }
  };

  if (step === 'qr') {
    return (
      <QRScanner
        onScan={handleQRScan}
        onFallback={() => setStep('manual')}
      />
    );
  }

  if (step === 'manual') {
    return <ActivationCodeScreen onVerified={handleActivationVerified} />;
  }

  // ... rest of flow
}
```

## Web Portal Implementation

### QR Code Generation Page

```typescript
// Owner portal: /devices/add

export function AddDeviceQR() {
  const [qrData, setQrData] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const generateQR = async (role: 'owner' | 'staff') => {
    const result = await api.post('/api/auth/qr/generate', {
      role,
      permissions: getPermissionsForRole(role),
      expiresInMinutes: 10,
      maxUses: 1,
    });

    setQrData(result.qrData);
    setExpiresAt(result.token.expiresAt);
  };

  return (
    <div className="add-device">
      <h1>Add New Device</h1>

      <div className="role-selection">
        <button onClick={() => generateQR('owner')}>
          Owner Device
        </button>
        <button onClick={() => generateQR('staff')}>
          Staff Device
        </button>
      </div>

      {qrData && (
        <div className="qr-display">
          <QRCode value={qrData} size={300} />

          <p>Scan this QR code with the Handsfree app</p>
          <p>Expires in: <Countdown to={expiresAt} /></p>

          <button onClick={() => setQrData('')}>
            Generate New QR
          </button>
        </div>
      )}
    </div>
  );
}
```

## Security Considerations

1. **Token Security**
   - JWT signed with backend secret
   - Short expiry (10 minutes)
   - One-time use (marked as used after validation)
   - Can be revoked before use

2. **QR Code Display**
   - Only show in secure environment (owner portal)
   - Don't screenshot/share QR codes
   - Auto-hide after expiry
   - Log who generated each QR

3. **Device Validation**
   - Verify device fingerprint matches
   - Rate limit token validation attempts
   - Block after 3 failed attempts

4. **Audit Trail**
   - Log all QR generations
   - Log all registration attempts
   - Track which device used which token

## Advanced Features

### Bulk Staff Onboarding

Generate multiple QR codes for staff training day:

```typescript
const generateBulkQRs = async (staffCount: number) => {
  const qrs = [];

  for (let i = 0; i < staffCount; i++) {
    const result = await api.post('/api/auth/qr/generate', {
      role: 'staff',
      permissions: ['view_orders', 'manage_orders'],
      expiresInMinutes: 60, // Longer for training session
      maxUses: 1,
    });

    qrs.push(result);
  }

  // Print QR codes as PDF
  generatePDF(qrs);
};
```

### Smart QR with Context

Add metadata to improve UX:

```json
{
  "tenantName": "Coorg Food Company",
  "locationName": "MG Road Branch",
  "deviceRole": "Kitchen Display",
  "setupInstructions": "https://docs.handsfree.tech/setup"
}
```

## Migration Strategy

### Phase 1: Add QR Support (Recommended)
1. Implement QR endpoints in backend
2. Add QR scanner to mobile app
3. Keep manual activation as fallback
4. Test with pilot users

### Phase 2: Web Portal QR Generation
1. Add "Generate QR" button to owner portal
2. Show active/expired tokens
3. Allow QR revocation

### Phase 3: Staff Onboarding
1. Bulk QR generation for staff
2. Role-based QR codes
3. Manager can generate staff QRs

### Phase 4: Deprecate Manual Entry (Optional)
1. Make QR the primary method
2. Keep manual as emergency fallback
3. Track usage metrics

## Comparison: Current vs QR

| Feature | Current (Manual) | QR Code |
|---------|------------------|---------|
| Time to register | ~2 minutes | ~10 seconds |
| User errors | High (typos) | None |
| Security | OTP required | Pre-authenticated |
| Multi-device | Manual per device | Scan per device |
| Staff onboarding | Slow | Fast (bulk QR) |
| User experience | Poor | Excellent |

## Recommendation

**Implement QR Registration as Primary Method**

Priority order:
1. ✅ Backend: Registration token generation + validation
2. ✅ Mobile: QR scanner + device registration
3. ✅ Web Portal: QR generation UI
4. ✅ Keep manual entry as fallback

This provides the best UX while maintaining security and flexibility.
