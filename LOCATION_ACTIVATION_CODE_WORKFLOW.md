# Location Activation Code Workflow

## Overview
Enable instant location tenant setup using a verification/activation code. Location managers can enter a code and become operational immediately by pulling all data from the master's D1 database.

---

## Workflow

### Phase 1: Master Creates Location & Generates Code

```
Master → Settings → Chain Management → Add Location
↓
LocationProvisioningForm (name, address, phone, etc.)
↓
Click "Create Location"
↓
Backend creates:
├─ Location tenant record in location_tenants
├─ Generates unique activation code (e.g., "CAFE-INDR-8472")
├─ Stores code in location_tenants.activation_code
└─ Provisions D1 database data
↓
Success modal shows:
┌────────────────────────────────────────┐
│ ✅ Location Created!                   │
│                                        │
│ Location: Indiranagar Branch          │
│ Activation Code: CAFE-INDR-8472      │
│                                        │
│ Give this code to your location       │
│ manager to activate their device.     │
│                                        │
│ [Copy Code] [Print QR] [Close]        │
└────────────────────────────────────────┘
```

### Phase 2: Location Enters Code & Auto-Configures

```
Location Device (Fresh Install or Factory Reset)
↓
Setup Wizard → "How do you want to set up?"
├─ New Restaurant (Full Setup)
└─ Activate Location (Enter Code) ← Select this
    ↓
    Enter Activation Code: [CAFE-INDR-8472]
    ↓
    Click "Activate"
    ↓
    Validation & Setup:
    ├─ 1. Validate code with backend API
    ├─ 2. Get location metadata (tenant_id, chain_id, master_tenant_id)
    ├─ 3. Set up tenant_context (current_tenant_id = location_tenant_id)
    ├─ 4. Configure restaurant_settings:
    │      ├─ is_location = 1
    │      ├─ location_group_id = chain_id
    │      ├─ master_tenant_id = master_tenant_id
    │      ├─ current_location_name = location_name
    │      └─ chain_sync_enabled = 1
    ├─ 5. Save tenant_config (tenant_id, etc.)
    ├─ 6. Sync menu from D1 (pulls master's menu)
    ├─ 7. Sync floor plan template (optional)
    ├─ 8. Mark activation_code as used
    └─ 9. Redirect to /pos (Ready to operate!)
    ↓
    ✅ Location is live and operational
```

---

## Database Schema Changes

### 1. Update `location_tenants` Table

```sql
-- Migration 053: Location Activation Codes
ALTER TABLE location_tenants ADD COLUMN activation_code TEXT UNIQUE;
ALTER TABLE location_tenants ADD COLUMN activation_code_generated_at TEXT;
ALTER TABLE location_tenants ADD COLUMN activation_code_used_at TEXT;
ALTER TABLE location_tenants ADD COLUMN activated_by_device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_location_activation_code
ON location_tenants(activation_code)
WHERE activation_code IS NOT NULL;
```

### 2. Activation Code Format

```
Format: {PREFIX}-{LOCATION}-{RANDOM}
Example: CAFE-INDR-8472

Components:
- PREFIX: First 4 chars of chain name (uppercase, alphanumeric only)
- LOCATION: First 4 chars of location name (uppercase, alphanumeric only)
- RANDOM: 4-digit random number

Generation Logic:
const prefix = chainName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4).padEnd(4, 'X');
const location = locationName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4).padEnd(4, 'X');
const random = Math.floor(1000 + Math.random() * 9000);
const code = `${prefix}-${location}-${random}`;
```

---

## Implementation

### 1. Modify Location Provisioning (Master Side)

**File:** `src/components/locations/LocationProvisioningForm.tsx`

**Changes:**
- After successful provisioning, show activation code in success modal
- Add "Copy Code" and "Print QR" buttons
- Store activation code in response

```typescript
// After createLocation success:
const activationCode = response.activation_code;

// Show modal:
<ActivationCodeModal
  code={activationCode}
  locationName={locationName}
  onClose={() => handleSuccess()}
/>
```

### 2. Create Activation Code Modal Component

**New File:** `src/components/locations/ActivationCodeModal.tsx`

```typescript
interface ActivationCodeModalProps {
  code: string;
  locationName: string;
  onClose: () => void;
}

export function ActivationCodeModal({ code, locationName, onClose }: ActivationCodeModalProps) {
  return (
    <div className="modal">
      <div className="modal-content">
        <h2>✅ Location Created!</h2>
        <p>Location: {locationName}</p>

        <div className="activation-code-display">
          <h3>Activation Code</h3>
          <div className="code-box">
            {code}
          </div>
        </div>

        <p className="instructions">
          Give this code to your location manager to activate their device.
          The code can only be used once.
        </p>

        <div className="actions">
          <button onClick={() => navigator.clipboard.writeText(code)}>
            Copy Code
          </button>
          <button onClick={() => window.print()}>
            Print QR Code
          </button>
          <button onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Backend API Endpoint (Worker)

**File:** `workers/tenant-router/src/index.ts`

**New Endpoint:** `POST /api/locations/activate`

```typescript
// Activate location with code
app.post('/api/locations/activate', async (c) => {
  const { activation_code } = await c.req.json();

  // Validate code format
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-\d{4}$/.test(activation_code)) {
    return c.json({ error: 'Invalid activation code format' }, 400);
  }

  // Find location by activation code
  const stmt = c.env.DB.prepare(
    `SELECT
      location_id,
      location_tenant_id,
      location_name,
      chain_id,
      subdomain,
      address_line1,
      city,
      state,
      phone,
      activation_code_used_at
    FROM location_tenants
    WHERE activation_code = ?1`
  );

  const location = await stmt.bind(activation_code).first();

  if (!location) {
    return c.json({ error: 'Invalid activation code' }, 404);
  }

  // Check if already used
  if (location.activation_code_used_at) {
    return c.json({
      error: 'Activation code has already been used',
      used_at: location.activation_code_used_at
    }, 400);
  }

  // Get master_tenant_id from chain
  const chain = await c.env.DB.prepare(
    `SELECT master_tenant_id FROM restaurant_chains WHERE id = ?1`
  ).bind(location.chain_id).first();

  if (!chain) {
    return c.json({ error: 'Chain not found' }, 404);
  }

  // Mark code as used
  await c.env.DB.prepare(
    `UPDATE location_tenants
     SET activation_code_used_at = CURRENT_TIMESTAMP,
         activated_by_device_id = ?1
     WHERE location_id = ?2`
  ).bind('device-' + Date.now(), location.location_id).run();

  // Return location metadata for device setup
  return c.json({
    success: true,
    location: {
      location_id: location.location_id,
      location_tenant_id: location.location_tenant_id,
      location_name: location.location_name,
      chain_id: location.chain_id,
      master_tenant_id: chain.master_tenant_id,
      subdomain: location.subdomain,
      address: {
        line1: location.address_line1,
        city: location.city,
        state: location.state,
      },
      phone: location.phone,
    }
  });
});
```

### 4. Rust Command for Activation

**New File:** `src-tauri/src/commands/location_activation.rs`

```rust
use serde::{Deserialize, Serialize};
use rusqlite::{Connection, params};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivationCodeRequest {
    pub activation_code: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationMetadata {
    pub location_id: String,
    pub location_tenant_id: String,
    pub location_name: String,
    pub chain_id: String,
    pub master_tenant_id: String,
    pub subdomain: Option<String>,
    pub address_line1: String,
    pub city: String,
    pub state: String,
    pub phone: String,
}

/// Validate activation code and get location metadata from backend
#[tauri::command]
pub async fn validate_activation_code(
    activation_code: String,
) -> Result<LocationMetadata, String> {
    println!("[LocationActivation] Validating code: {}", activation_code);

    // Call backend API
    let client = reqwest::Client::new();
    let response = client
        .post("https://your-worker.workers.dev/api/locations/activate")
        .json(&serde_json::json!({
            "activation_code": activation_code
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Activation failed: {}", error_text));
    }

    let result: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let location = result.get("location")
        .ok_or_else(|| "Invalid response format".to_string())?;

    Ok(serde_json::from_value(location.clone())
        .map_err(|e| format!("Failed to parse location data: {}", e))?)
}

/// Configure device as location tenant after successful activation
#[tauri::command]
pub async fn configure_as_location(
    app: tauri::AppHandle,
    location: LocationMetadata,
) -> Result<(), String> {
    println!("[LocationActivation] Configuring as location: {}", location.location_name);

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // 1. Set up tenant_context
    conn.execute(
        "INSERT OR REPLACE INTO tenant_context (id, current_tenant_id, current_tenant_type, switched_at)
         VALUES (1, ?1, 'location', CURRENT_TIMESTAMP)",
        params![location.location_tenant_id],
    ).map_err(|e| format!("Failed to set tenant context: {}", e))?;

    // 2. Configure restaurant_settings
    conn.execute(
        "UPDATE restaurant_settings
         SET is_location = 1,
             location_group_id = ?1,
             master_tenant_id = ?2,
             current_location_name = ?3,
             chain_sync_enabled = 1,
             name = ?4,
             address_line1 = ?5,
             city = ?6,
             state = ?7,
             phone = ?8
         WHERE id = 1",
        params![
            location.chain_id,
            location.master_tenant_id,
            location.location_name,
            location.location_name,
            location.address_line1,
            location.city,
            location.state,
            location.phone,
        ],
    ).map_err(|e| format!("Failed to configure restaurant_settings: {}", e))?;

    // 3. Save tenant_config
    conn.execute(
        "INSERT OR REPLACE INTO tenant_config (id, tenant_id, subdomain)
         VALUES (1, ?1, ?2)",
        params![location.location_tenant_id, location.subdomain],
    ).map_err(|e| format!("Failed to save tenant config: {}", e))?;

    println!("[LocationActivation] Configuration complete");
    Ok(())
}
```

### 5. Setup Wizard - Add "Activate Location" Option

**File:** `src/components/settings/RestaurantDetailsWizard.tsx`

**Changes:**
- Add initial step: "Setup Type Selection"
- Options: "New Restaurant" or "Activate Location"
- If "Activate Location" selected, show activation code input

```typescript
// New initial screen:
<div className="wizard-step">
  <h2>How do you want to set up?</h2>

  <div className="setup-type-cards">
    <button onClick={() => setSetupType('new')}>
      <Store size={48} />
      <h3>New Restaurant</h3>
      <p>Complete setup wizard for a new restaurant</p>
    </button>

    <button onClick={() => setSetupType('activate')}>
      <MapPin size={48} />
      <h3>Activate Location</h3>
      <p>Enter activation code to set up as branch location</p>
    </button>
  </div>
</div>

// If activate selected:
<ActivationCodeInput onActivate={handleActivation} />
```

### 6. Activation Code Input Component

**New File:** `src/components/locations/ActivationCodeInput.tsx`

```typescript
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';

interface ActivationCodeInputProps {
  onActivate: () => void;
}

export function ActivationCodeInput({ onActivate }: ActivationCodeInputProps) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    setIsActivating(true);
    setError(null);

    try {
      // 1. Validate code and get location metadata
      const location = await invoke('validate_activation_code', {
        activationCode: code.toUpperCase().trim()
      });

      console.log('[Activation] Location metadata received:', location);

      // 2. Configure device as location tenant
      await invoke('configure_as_location', { location });

      // 3. Sync menu from master's D1
      await invoke('sync_menu_from_backend', {
        tenantId: location.master_tenant_id
      });

      // 4. Success! Redirect to POS
      console.log('[Activation] Setup complete, redirecting to POS');
      onActivate();
      navigate('/pos');

    } catch (err) {
      console.error('[Activation] Failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="activation-code-input">
      <h2>Activate Location</h2>
      <p>Enter the activation code provided by your master location</p>

      <input
        type="text"
        placeholder="CAFE-INDR-8472"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={14}
        className="code-input"
        disabled={isActivating}
      />

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <button
        onClick={handleActivate}
        disabled={!code || code.length < 14 || isActivating}
        className="activate-button"
      >
        {isActivating ? 'Activating...' : 'Activate Location'}
      </button>

      {isActivating && (
        <div className="progress-steps">
          <div className="step">✓ Validating code...</div>
          <div className="step">⏳ Configuring device...</div>
          <div className="step">⏳ Syncing menu...</div>
        </div>
      )}
    </div>
  );
}
```

---

## User Experience Flow

### Master's Perspective
```
1. Create location via form
2. Get activation code: CAFE-INDR-8472
3. Share code with location manager (SMS, WhatsApp, email, or verbal)
```

### Location Manager's Perspective
```
1. Install app on tablet/device
2. Open app → Setup wizard
3. Select "Activate Location"
4. Enter code: CAFE-INDR-8472
5. Click "Activate"
6. Wait 10-30 seconds (validation + sync)
7. ✅ Redirected to POS - ready to take orders!
```

---

## Security Considerations

1. **One-Time Use**: Code can only be used once
2. **Expiration**: Optional - add expiry (e.g., 7 days)
3. **Rate Limiting**: Limit activation attempts (max 5 per hour per IP)
4. **Code Format Validation**: Strict format prevents brute force
5. **Audit Trail**: Track which device used which code

---

## Migration Required

**New File:** `migrations/053_location_activation_codes.sql`

```sql
-- Migration 053: Location Activation Codes
-- Adds activation code functionality for location tenant setup

-- Add activation code columns to location_tenants
ALTER TABLE location_tenants ADD COLUMN activation_code TEXT UNIQUE;
ALTER TABLE location_tenants ADD COLUMN activation_code_generated_at TEXT;
ALTER TABLE location_tenants ADD COLUMN activation_code_used_at TEXT;
ALTER TABLE location_tenants ADD COLUMN activated_by_device_id TEXT;

-- Index for fast activation code lookups
CREATE INDEX IF NOT EXISTS idx_location_activation_code
ON location_tenants(activation_code)
WHERE activation_code IS NOT NULL;

-- Index for finding unused codes
CREATE INDEX IF NOT EXISTS idx_location_activation_unused
ON location_tenants(activation_code_used_at)
WHERE activation_code_used_at IS NULL;
```

---

## Testing Checklist

### Master Side
- [ ] Create location → activation code generated
- [ ] Activation code displayed in success modal
- [ ] "Copy Code" button works
- [ ] Code format is correct (XXXX-XXXX-9999)
- [ ] Code stored in location_tenants table

### Location Side
- [ ] Setup wizard shows "Activate Location" option
- [ ] Can enter activation code
- [ ] Invalid code shows error
- [ ] Valid code triggers activation
- [ ] Progress steps shown during activation
- [ ] Menu syncs from master
- [ ] Restaurant settings configured correctly
- [ ] Redirects to POS after success

### Edge Cases
- [ ] Used code shows "already used" error
- [ ] Expired code rejected (if expiry implemented)
- [ ] Network error handled gracefully
- [ ] Can retry after error
- [ ] Code is case-insensitive
- [ ] Hyphens optional when entering

---

## Benefits

1. **Instant Setup**: Location goes live in 30 seconds
2. **Zero Manual Configuration**: No need to enter tenant IDs, URLs, etc.
3. **Foolproof**: Code contains all metadata needed
4. **Scalable**: Easy to provision 10, 50, or 100 locations
5. **Secure**: One-time use prevents code sharing
6. **Auditable**: Know which device activated when

---

## Next Steps

1. **Implement migration 053** - Add activation code columns
2. **Update LocationProvisioningForm** - Generate and display code
3. **Create ActivationCodeModal** - Show code to master
4. **Add backend endpoint** - Validate and return metadata
5. **Create Rust commands** - validate_activation_code, configure_as_location
6. **Update Setup Wizard** - Add "Activate Location" path
7. **Create ActivationCodeInput** - Location enters code
8. **Test end-to-end** - Master creates → Location activates

This creates a seamless, production-ready activation workflow for location tenants!
