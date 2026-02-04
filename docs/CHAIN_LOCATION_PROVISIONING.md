# Chain Location Provisioning System

## Overview

Complete multi-location restaurant chain provisioning with:
- ✅ **16-digit activation codes** (format: XXXX-XXXX-XXXX-XXXX)
- ✅ **AES-256-GCM encryption** for activation codes
- ✅ **Master tenant database storage** for secure code management
- ✅ **Parent tenant tagging** on all resources for efficient queries
- ✅ **Full infrastructure** (D1, KV, R2, Worker) per location
- ✅ **Async provisioning** via Durable Objects

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Master Tenant (HQ)                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Master D1 Database                                   │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ chain_location_activations                      │  │   │
│  │  │  - master_tenant_id (parent)                    │  │   │
│  │  │  - location_tenant_id (child)                   │  │   │
│  │  │  - encrypted_activation_code (AES-256)          │  │   │
│  │  │  - is_activated, activated_at                   │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Creates & Manages
                              ▼
        ┌───────────────────────────────────────┐
        │    Location 1                          │
        │    tenant: master-loc1-abc123          │
        │    ┌──────────────────────────────┐   │
        │    │ D1 (tagged: parent=master)   │   │
        │    │ KV (tagged: parent=master)   │   │
        │    │ R2 (tagged: parent=master)   │   │
        │    │ Worker (env: parent=master)  │   │
        │    └──────────────────────────────┘   │
        │    Activation: A7K9-M2X5-P3Q8-W4R6    │
        └───────────────────────────────────────┘

        ┌───────────────────────────────────────┐
        │    Location 2                          │
        │    tenant: master-loc2-def456          │
        │    ┌──────────────────────────────┐   │
        │    │ D1 (tagged: parent=master)   │   │
        │    │ KV (tagged: parent=master)   │   │
        │    │ R2 (tagged: parent=master)   │   │
        │    │ Worker (env: parent=master)  │   │
        │    └──────────────────────────────┘   │
        │    Activation: B5J2-N8K3-L9M4-X7Y1    │
        └───────────────────────────────────────┘
```

## 16-Digit Activation Code

### Format
```
XXXX-XXXX-XXXX-XXXX
```

**Example:** `A7K9-M2X5-P3Q8-W4R6`

### Character Set
- **Uppercase letters:** A-Z (excluding O, I for clarity)
- **Numbers:** 2-9 (excluding 0, 1 for clarity)
- **Total pool:** 32 characters (ABCDEFGHJKLMNPQRSTUVWXYZ23456789)

### Security
- **Entropy:** 80 bits (32^16 combinations)
- **Collision probability:** Negligible (1 in 1,208,925,819,614,629,174,706,176)
- **Encryption:** AES-256-GCM with PBKDF2 key derivation
- **Storage:** Encrypted in master tenant's D1 database

## Database Schema

### Master Tenant D1 Database

```sql
CREATE TABLE chain_location_activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_tenant_id TEXT NOT NULL,           -- Parent tenant ID
  location_tenant_id TEXT NOT NULL UNIQUE,  -- Child tenant ID
  location_name TEXT NOT NULL,
  encrypted_activation_code TEXT NOT NULL,  -- AES-256-GCM encrypted
  is_activated BOOLEAN DEFAULT 0,
  activated_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for efficient queries
  INDEX idx_master_tenant (master_tenant_id),
  INDEX idx_location_tenant (location_tenant_id)
);
```

### Example Data

| id | master_tenant_id | location_tenant_id | encrypted_activation_code | is_activated |
|----|------------------|-------------------|---------------------------|--------------|
| 1 | kalyani-6207 | kalyani-indiranagar-lmn3x7k | [base64 encrypted] | 0 |
| 2 | kalyani-6207 | kalyani-koramangala-xyz9a2b | [base64 encrypted] | 1 |

## API Endpoints

### 1. Create Chain Location

**Endpoint:** `POST /api/provision/chain-location`

**Request:**
```json
{
  "masterTenantId": "kalyani-6207",
  "restaurantName": "Indiranagar Branch",
  "companyName": "Kalyani Restaurant",
  "ownerName": "Kalyani",
  "email": "indiranagar@kalyani.com",
  "phone": "+91 9876543210",
  "city": "Bangalore",
  "pincode": "560038",
  "restaurantType": "FULL_SERVICE",
  "subdomain": "kalyani-indiranagar-4521"
}
```

**Response:**
```json
{
  "success": true,
  "provisioningId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "kalyani-indiranagar-4521-lmn3x7k",
  "activationCode": "A7K9-M2X5-P3Q8-W4R6"
}
```

### 2. Check Provisioning Status

**Endpoint:** `GET /api/provision/chain-location/status/:provisioningId`

**Response:**
```json
{
  "success": true,
  "provisioningId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "message": "Provisioning complete",
  "result": {
    "tenantId": "kalyani-indiranagar-4521-lmn3x7k",
    "masterTenantId": "kalyani-6207",
    "activationCode": "A7K9-M2X5-P3Q8-W4R6",
    "cloudflareResources": {
      "d1DatabaseId": "abc123-...",
      "d1DatabaseName": "kalyani_indiranagar_4521_lmn3x7k_db",
      "kvNamespaceId": "def456...",
      "r2BucketName": "kalyani-indiranagar-4521-lmn3x7k-storage",
      "workerUrl": "https://kalyani-indiranagar-4521-lmn3x7k.handsfree.workers.dev"
    }
  }
}
```

### 3. Verify Activation Code

**Endpoint:** `POST /api/provision/chain-location/verify-activation`

**Request:**
```json
{
  "activationCode": "A7K9-M2X5-P3Q8-W4R6",
  "masterTenantId": "kalyani-6207"
}
```

**Response (Success):**
```json
{
  "success": true,
  "locationTenantId": "kalyani-indiranagar-4521-lmn3x7k",
  "locationName": "Indiranagar Branch",
  "masterTenantId": "kalyani-6207"
}
```

**Response (Already Used):**
```json
{
  "success": false,
  "error": "This activation code has already been used"
}
```

**Response (Invalid):**
```json
{
  "success": false,
  "error": "Invalid activation code"
}
```

## Encryption Details

### Algorithm
- **Cipher:** AES-256-GCM
- **Key Derivation:** PBKDF2 (100,000 iterations, SHA-256)
- **IV:** 12 bytes random per encryption
- **Salt:** Fixed "handsfree-pos-chain"

### Encryption Process

```typescript
1. Generate random 16-digit code
2. Derive AES key from ENCRYPTION_KEY env var using PBKDF2
3. Generate random 12-byte IV
4. Encrypt code using AES-256-GCM
5. Combine IV + ciphertext
6. Encode as base64
7. Store in master DB
```

### Decryption Process

```typescript
1. Fetch encrypted code from master DB
2. Decode base64
3. Extract IV (first 12 bytes) and ciphertext
4. Derive same AES key using PBKDF2
5. Decrypt using AES-256-GCM
6. Compare with user input
```

## Parent Tenant Tagging

All Cloudflare resources are tagged with the parent tenant ID for:
- **Efficient queries** (fetch all locations for a master)
- **Resource management** (billing, cleanup)
- **Access control** (verify ownership)

### Resource Tags

```javascript
// D1 Database
{
  "resourceType": "d1",
  "resourceId": "abc123-def456-...",
  "masterTenantId": "kalyani-6207",
  "taggedAt": "2026-02-03T10:30:00Z"
}

// KV Namespace
{
  "resourceType": "kv",
  "resourceId": "def456...",
  "masterTenantId": "kalyani-6207",
  "taggedAt": "2026-02-03T10:30:00Z"
}

// R2 Bucket
{
  "resourceType": "r2",
  "resourceId": "kalyani-indiranagar-4521-lmn3x7k-storage",
  "masterTenantId": "kalyani-6207",
  "taggedAt": "2026-02-03T10:30:00Z"
}
```

### Querying by Parent

```typescript
// Get all D1 databases for a master tenant
const databases = await env.PROVISIONING_KV.list({ prefix: `resource-tag:d1:` });
const masterDatabases = databases.keys
  .filter(async (key) => {
    const tag = await env.PROVISIONING_KV.get(key.name, 'json');
    return tag.masterTenantId === 'kalyani-6207';
  });
```

## Worker Environment Variables

Each location's worker includes parent tenant reference:

```toml
# Location worker wrangler.toml
[env.production]
vars = { MASTER_TENANT_ID = "kalyani-6207" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "kalyani_indiranagar_4521_lmn3x7k_db"
database_id = "abc123-..."
```

This enables:
- **Menu sync** from master
- **Settings inheritance**
- **Cross-location queries**
- **Consolidated reporting**

## Frontend Integration

### Create Location

```typescript
import { useChainStore } from '@/stores/chainStore';

const { provisionLocationTenant } = useChainStore();

// Create new location
const result = await provisionLocationTenant(
  chainId,
  {
    locationName: "Indiranagar Branch",
    address: { ... },
    phone: "+91 9876543210",
    email: "indiranagar@kalyani.com",
    restaurantType: "FULL_SERVICE",
  },
  (step, progress) => {
    console.log(`${step}: ${progress}%`);
  }
);

// Result includes 16-digit activation code
console.log('Activation Code:', result.activationCode);
// Output: "A7K9-M2X5-P3Q8-W4R6"
```

### Display Activation Code

```tsx
<div className="activation-code">
  <h3>Location Activation Code</h3>
  <div className="code-display">
    {activationCode}
  </div>
  <button onClick={() => copyToClipboard(activationCode)}>
    Copy Code
  </button>
  <p className="help-text">
    Share this 16-digit code with the location manager to activate their device
  </p>
</div>
```

## Security Best Practices

### 1. Encryption Key Management
```bash
# Generate strong encryption key (32 bytes = 256 bits)
openssl rand -base64 32

# Store as Cloudflare secret
npx wrangler secret put ENCRYPTION_KEY
```

### 2. Access Control
- ✅ Only master tenant can create locations
- ✅ Only master tenant can view activation codes
- ✅ Activation codes are encrypted at rest
- ✅ One-time use (marked as activated after first use)

### 3. Rate Limiting
- Limit provisioning requests per master tenant
- Prevent brute-force activation attempts
- Monitor suspicious patterns

### 4. Audit Logging
```sql
CREATE TABLE chain_provisioning_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_tenant_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'create', 'activate', 'verify'
  location_tenant_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Benefits Over Previous Approach

| Feature | D1-Only Approach | Full Provisioning (New) |
|---------|------------------|-------------------------|
| **Infrastructure** | D1 only | D1 + KV + R2 + Worker |
| **Activation Code** | 6 chars | 16 digits (formatted) |
| **Code Security** | Plain text | AES-256-GCM encrypted |
| **Code Storage** | Provisioning KV | Master tenant D1 |
| **Parent Linking** | Manual | Auto-tagged on all resources |
| **Resource Queries** | Slow (scan all) | Fast (indexed by parent) |
| **Provisioning** | Synchronous | Async (Durable Object) |
| **Status Tracking** | None | Real-time polling |
| **Scalability** | Limited | Production-ready |

## Migration Path

If you have existing locations created with the old system:

```sql
-- Migrate old 6-char codes to new 16-digit encrypted codes
-- Run this in master tenant's D1

INSERT INTO chain_location_activations (
  master_tenant_id,
  location_tenant_id,
  location_name,
  encrypted_activation_code,
  is_activated,
  activated_at,
  created_at
)
SELECT
  master_tenant_id,
  location_tenant_id,
  location_name,
  [encrypt_with_new_system(activation_code)],
  1, -- Mark as activated
  created_at,
  created_at
FROM location_tenants
WHERE activation_code IS NOT NULL;
```

## Troubleshooting

### Issue: "Invalid activation code"
**Solution:**
1. Check code format (must be XXXX-XXXX-XXXX-XXXX)
2. Verify master tenant ID is correct
3. Check if code has already been used

### Issue: "Provisioning timeout"
**Solution:**
1. Check Durable Object logs: `npx wrangler tail`
2. Verify Cloudflare API token permissions
3. Check account quotas (D1, KV, R2)

### Issue: "Decryption failed"
**Solution:**
1. Verify ENCRYPTION_KEY is the same as when code was created
2. Check base64 encoding is correct
3. Ensure database hasn't been corrupted

## Next Steps

1. ✅ Deploy chain-location provisioning endpoint
2. ✅ Set up Durable Object binding
3. ✅ Configure encryption key
4. ✅ Test location creation
5. ✅ Test activation code verification
6. 📋 Set up monitoring and alerts
7. 📋 Implement rate limiting
8. 📋 Add audit logging
