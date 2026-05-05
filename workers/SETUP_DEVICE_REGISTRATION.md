# Owner Device Registration in Setup Workflow

## Context

The desktop Bun Tauri app has an initial setup workflow for new restaurants. During this setup, the owner should be able to register their mobile device seamlessly.

## Current Setup Workflow

**Desktop App (Bun Tauri):**
```
/settings → Initial Setup Wizard
│
├── 1. Restaurant Information
│   └── Name, cuisine type, address, phone
│
├── 2. Owner Account Creation
│   └── Email, password, phone verification
│
├── 3. Payment Configuration
│   └── Payment processor setup
│
└── 4. Complete → Dashboard
```

## Enhanced Setup Workflow (With Mobile Registration)

**Desktop App:**
```
/settings → Initial Setup Wizard
│
├── 1. Restaurant Information
│   └── Name, cuisine type, address, phone
│
├── 2. Owner Account Creation
│   └── Email, password, phone verification
│
├── 3. **Mobile Device Setup** [NEW]
│   ├── Display QR code for owner mobile app
│   ├── Wait for mobile device to scan
│   ├── Confirm device registered
│   └── Option: Skip (can add device later)
│
├── 4. Payment Configuration
│   └── Payment processor setup
│
└── 5. Complete → Dashboard
```

## Implementation in Settings

### Location in App

```
Desktop App Structure:
├── src/
│   ├── components/
│   │   ├── setup/
│   │   │   ├── SetupWizard.tsx
│   │   │   ├── RestaurantInfo.tsx
│   │   │   ├── OwnerAccount.tsx
│   │   │   ├── MobileDeviceSetup.tsx  ← NEW
│   │   │   └── PaymentConfig.tsx
│   │   │
│   │   └── settings/
│   │       ├── SettingsPage.tsx
│   │       ├── DeviceManagement.tsx  ← NEW
│   │       └── GenerateDeviceQR.tsx  ← NEW
```

### New Component: Mobile Device Setup Step

**File:** `src/components/setup/MobileDeviceSetup.tsx`

```typescript
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Smartphone, RefreshCw } from 'lucide-react';

interface MobileDeviceSetupProps {
  tenantId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function MobileDeviceSetup({
  tenantId,
  onComplete,
  onSkip,
}: MobileDeviceSetupProps) {
  const [qrData, setQrData] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [registeredDevice, setRegisteredDevice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateQR();

    // Poll for device registration
    const pollInterval = setInterval(checkRegistration, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  const generateQR = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/qr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('setupToken')}`,
        },
        body: JSON.stringify({
          role: 'owner',
          expiresInMinutes: 10,
          maxUses: 1,
        }),
      });

      const data = await response.json();

      setQrData(data.qrData);
      setTokenId(data.token.tokenId);
      setExpiresAt(data.token.expiresAt);
    } catch (error) {
      console.error('Failed to generate QR:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkRegistration = async () => {
    if (!tokenId) return;

    try {
      const response = await fetch(`/api/auth/qr/${tokenId}/status`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('setupToken')}`,
        },
      });

      const data = await response.json();

      if (data.used) {
        setDeviceRegistered(true);
        setRegisteredDevice(data.deviceName);
      }
    } catch (error) {
      // Ignore polling errors
    }
  };

  return (
    <div className="mobile-device-setup">
      <div className="setup-header">
        <Smartphone size={48} className="icon" />
        <h2>Setup Your Mobile Device</h2>
        <p>
          Scan this QR code with the Handsfree Owner mobile app to register
          your device
        </p>
      </div>

      <div className="setup-content">
        {!deviceRegistered ? (
          <>
            <div className="qr-container">
              {qrData ? (
                <QRCodeSVG value={qrData} size={300} level="M" />
              ) : (
                <div className="loading">Generating QR code...</div>
              )}
            </div>

            <div className="instructions">
              <h3>How to scan:</h3>
              <ol>
                <li>Download the Handsfree Owner app on your phone</li>
                <li>Open the app and tap "Scan QR Code"</li>
                <li>Point your camera at this QR code</li>
                <li>Your device will be registered automatically</li>
              </ol>
            </div>

            <div className="qr-actions">
              <button
                onClick={generateQR}
                disabled={loading}
                className="btn-secondary"
              >
                <RefreshCw size={16} />
                Regenerate QR
              </button>

              <p className="expiry-notice">
                QR code expires in{' '}
                <Countdown to={expiresAt} onExpire={generateQR} />
              </p>
            </div>
          </>
        ) : (
          <div className="success-state">
            <CheckCircle size={64} color="#10b981" />
            <h3>Mobile Device Registered!</h3>
            <p>{registeredDevice} has been successfully registered</p>
          </div>
        )}
      </div>

      <div className="setup-actions">
        {deviceRegistered ? (
          <button onClick={onComplete} className="btn-primary">
            Continue Setup
          </button>
        ) : (
          <>
            <button onClick={onSkip} className="btn-secondary">
              Skip for Now
            </button>
            <button onClick={onComplete} disabled className="btn-primary">
              Continue (scan QR first)
            </button>
          </>
        )}
      </div>

      <div className="help-text">
        <p>
          Don't have your phone? You can skip this step and register your
          device later from Settings → Devices
        </p>
      </div>
    </div>
  );
}
```

### Settings Page: Device Management

**File:** `src/components/settings/DeviceManagement.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Smartphone, Plus, Trash2 } from 'lucide-react';
import { GenerateDeviceQR } from './GenerateDeviceQR';

export function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const response = await fetch('/api/auth/devices', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    const data = await response.json();
    setDevices(data.devices);
  };

  const revokeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this device?')) return;

    await fetch(`/api/auth/devices/${deviceId}/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        reason: 'Revoked from desktop settings',
      }),
    });

    loadDevices();
  };

  return (
    <div className="device-management">
      <div className="section-header">
        <h2>Registered Devices</h2>
        <button onClick={() => setShowQRModal(true)} className="btn-primary">
          <Plus size={16} />
          Add Device
        </button>
      </div>

      <div className="devices-list">
        {devices.map((device) => (
          <div key={device.deviceId} className="device-card">
            <Smartphone size={24} />

            <div className="device-info">
              <h3>{device.deviceName}</h3>
              <p className="device-model">{device.deviceModel}</p>
              <p className="device-meta">
                Last seen: {formatDate(device.lastSeenAt)}
              </p>
            </div>

            <div className="device-actions">
              {device.isCurrent ? (
                <span className="badge-current">Current Device</span>
              ) : (
                <button
                  onClick={() => revokeDevice(device.deviceId)}
                  className="btn-danger-outline"
                >
                  <Trash2 size={16} />
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}

        {devices.length === 0 && (
          <div className="empty-state">
            <Smartphone size={48} />
            <p>No devices registered yet</p>
            <button
              onClick={() => setShowQRModal(true)}
              className="btn-primary"
            >
              Register Your First Device
            </button>
          </div>
        )}
      </div>

      {showQRModal && (
        <GenerateDeviceQR
          onClose={() => setShowQRModal(false)}
          onDeviceRegistered={loadDevices}
        />
      )}
    </div>
  );
}
```

### Modal: Generate Device QR

**File:** `src/components/settings/GenerateDeviceQR.tsx`

```typescript
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, CheckCircle } from 'lucide-react';

interface GenerateDeviceQRProps {
  onClose: () => void;
  onDeviceRegistered: () => void;
}

export function GenerateDeviceQR({
  onClose,
  onDeviceRegistered,
}: GenerateDeviceQRProps) {
  const [qrData, setQrData] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    generateQR();

    const pollInterval = setInterval(checkRegistration, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  const generateQR = async () => {
    const response = await fetch('/api/auth/qr/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        role: 'owner',
        expiresInMinutes: 10,
        maxUses: 1,
      }),
    });

    const data = await response.json();
    setQrData(data.qrData);
    setTokenId(data.token.tokenId);
  };

  const checkRegistration = async () => {
    if (!tokenId) return;

    const response = await fetch(`/api/auth/qr/${tokenId}/status`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    const data = await response.json();

    if (data.used) {
      setDeviceRegistered(true);
      setDeviceName(data.deviceName);

      setTimeout(() => {
        onDeviceRegistered();
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content qr-modal">
        <button onClick={onClose} className="modal-close">
          <X size={24} />
        </button>

        {!deviceRegistered ? (
          <>
            <h2>Scan QR Code to Register Device</h2>

            <div className="qr-display">
              {qrData && <QRCodeSVG value={qrData} size={300} />}
            </div>

            <p className="instructions">
              Open the Handsfree Owner app and scan this QR code
            </p>
          </>
        ) : (
          <div className="success-state">
            <CheckCircle size={64} color="#10b981" />
            <h3>Device Registered!</h3>
            <p>{deviceName} has been successfully registered</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Integration into Setup Wizard

**File:** `src/components/setup/SetupWizard.tsx`

```typescript
import { useState } from 'react';
import { RestaurantInfo } from './RestaurantInfo';
import { OwnerAccount } from './OwnerAccount';
import { MobileDeviceSetup } from './MobileDeviceSetup';
import { PaymentConfig } from './PaymentConfig';

export function SetupWizard() {
  const [step, setStep] = useState(1);
  const [tenantId, setTenantId] = useState('');

  const steps = [
    {
      number: 1,
      title: 'Restaurant Information',
      component: RestaurantInfo,
    },
    {
      number: 2,
      title: 'Owner Account',
      component: OwnerAccount,
    },
    {
      number: 3,
      title: 'Mobile Device Setup',
      component: MobileDeviceSetup, // NEW
    },
    {
      number: 4,
      title: 'Payment Configuration',
      component: PaymentConfig,
    },
  ];

  const CurrentStep = steps[step - 1].component;

  return (
    <div className="setup-wizard">
      <div className="wizard-progress">
        {steps.map((s) => (
          <div
            key={s.number}
            className={`step ${step === s.number ? 'active' : ''} ${
              step > s.number ? 'completed' : ''
            }`}
          >
            <div className="step-number">{s.number}</div>
            <div className="step-title">{s.title}</div>
          </div>
        ))}
      </div>

      <div className="wizard-content">
        <CurrentStep
          tenantId={tenantId}
          onComplete={() => setStep(step + 1)}
          onSkip={() => setStep(step + 1)} // Allow skipping mobile setup
        />
      </div>
    </div>
  );
}
```

## Backend: Check Registration Status Endpoint

**POST** `/api/auth/qr/{tokenId}/status`

```typescript
// tenant-worker/src/handlers/auth.ts

export async function checkQRTokenStatus(
  request: Request,
  env: Env,
  tokenId: string
): Promise<Response> {
  try {
    // Get token from database
    const token = await env.TENANTS_DB.prepare(
      `SELECT used_at, used_by_device_id
       FROM registration_tokens
       WHERE token_id = ?`
    )
      .bind(tokenId)
      .first();

    if (!token) {
      return Response.json(
        {
          success: false,
          error: 'Token not found',
        },
        { status: 404 }
      );
    }

    // Check if token has been used
    const used = !!token.used_at;

    if (used) {
      // Get device info
      const device = await env.TENANTS_DB.prepare(
        `SELECT device_name, device_model
         FROM registered_devices
         WHERE device_id = ?`
      )
        .bind(token.used_by_device_id)
        .first();

      return Response.json({
        success: true,
        used: true,
        deviceName: device?.device_name || 'Unknown Device',
        deviceModel: device?.device_model,
        usedAt: token.used_at,
      });
    }

    return Response.json({
      success: true,
      used: false,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
```

## User Experience Flow

### Happy Path

1. **Desktop Setup**
   ```
   Step 1: Restaurant Info → Filled
   Step 2: Owner Account → Phone verified
   Step 3: Mobile Setup → QR displayed
   ```

2. **Mobile Scan**
   ```
   Owner opens mobile app → Scans QR → Device registered
   ```

3. **Desktop Confirmation**
   ```
   Desktop detects registration → Shows success
   Step 3: Complete → Continue to Step 4
   ```

4. **Complete Setup**
   ```
   Step 4: Payment → Complete setup
   ```

### Skip Path

1. Owner clicks "Skip for Now" on Step 3
2. Continues to payment setup
3. Can register device later from Settings

### Later Registration

1. Owner opens desktop app
2. Goes to Settings → Devices
3. Clicks "Add Device"
4. QR modal appears
5. Scans with mobile → Registered

## Benefits

✅ **Integrated Experience** - Mobile registration part of setup
✅ **No Separate Login** - Mobile auto-authenticated via QR
✅ **Optional** - Can skip and do later
✅ **Visual Feedback** - Desktop shows when mobile scanned
✅ **Reusable** - Same QR generator for Settings page

## Recommendation

**Implement in this order:**

1. ✅ **Backend:** QR token generation + status check endpoint
2. ✅ **Desktop:** Mobile setup step in wizard
3. ✅ **Desktop:** Device management in Settings
4. ✅ **Mobile:** QR scanner (already designed)
5. ✅ **Polish:** Auto-refresh QR, better error handling

This creates a seamless onboarding experience where the owner can set up both desktop and mobile in one flow.
