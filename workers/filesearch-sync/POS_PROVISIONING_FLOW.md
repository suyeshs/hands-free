# POS Provisioning & Menu Sync - Complete Flow

## Overview

The POS system provisions its D1 database and then syncs menu data across three systems: D1, KV, and File Search.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   POS APPLICATION                            │
│             (Local SQLite - Source of Truth)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
            ┌───────────────┼───────────────┐
            ↓               ↓               ↓
   ┌────────────────┐  ┌────────────┐  ┌──────────────┐
   │ Provision D1   │  │ Sync Data  │  │ Sync Menu    │
   │ (One-time)     │  │ (Ongoing)  │  │ (Automatic)  │
   └────────────────┘  └────────────┘  └──────────────┘
            ↓               ↓               ↓
   ┌────────────────┐  ┌────────────┐  ┌──────────────┐
   │ restaurant-    │  │ tenant-    │  │ filesearch-  │
   │ provisioning   │  │ {tenantId} │  │ sync         │
   └────────────────┘  └────────────┘  └──────────────┘
            ↓               ↓               ↓
   ┌────────────────┐  ┌────────────┐  ┌──────────────┐
   │ D1 + KV + R2   │  │ D1 → KV    │  │ KV → FS      │
   │ Created        │  │ Synced     │  │ Synced       │
   └────────────────┘  └────────────┘  └──────────────┘
```

---

## Phase 1: Initial Provisioning (One-Time)

### POS Workflow

```typescript
// 1. Extract SQLite schema from local database
const schema = await invoke('extract_sqlite_schema');

// 2. Upload schema to R2 (if custom schema needed)
await uploadSchemaToR2(tenantId, schema);

// 3. Provision tenant via restaurant-provisioning worker
const provisionResult = await invoke('provision_d1_via_worker', {
  tenantId: 'my-restaurant-1234',
  companyName: 'My Restaurant',
  email: 'owner@restaurant.com',
  phone: '+1234567890',
  city: 'San Francisco',
  pincode: '94102',
  businessCategory: 'RESTAURANT'
});

// 4. Store activation code
const { activationCode } = provisionResult;
await storeActivationCode(activationCode);
```

### Provisioning Worker Endpoint

**URL:** `https://handsfree-restaurant-provisioning.suyesh.workers.dev`

**Endpoint:** `POST /api/provision`

**Request:**
```json
{
  "tenantId": "my-restaurant-1234",
  "companyName": "My Restaurant",
  "email": "owner@restaurant.com",
  "phone": "+1234567890",
  "city": "San Francisco",
  "pincode": "94102",
  "businessCategory": "RESTAURANT"
}
```

**Response:**
```json
{
  "success": true,
  "tenant": {
    "tenantId": "my-restaurant-1234",
    "companyName": "My Restaurant",
    "subdomain": "my-restaurant-1234",
    "fullDomain": "my-restaurant-1234.handsfree.tech",
    "storeUrl": "https://my-restaurant-1234.handsfree.tech",
    "database_id": "202da87e-18d9-423c-bec5-79180158a3ad",
    "database_name": "my-restaurant-1234_db"
  },
  "activationCode": "A3B4-C5D6-E7F8-G9H2",
  "provisioning": {
    "tablesCreated": 16,
    "rowsInserted": 0,
    "storage": {
      "kvNamespaceData": "...",
      "kvNamespaceCache": "...",
      "kvNamespaceSessions": "...",
      "r2BucketName": "..."
    }
  },
  "createdAt": "2026-01-24T..."
}
```

### What Gets Created

1. **D1 Database**
   - Database ID: `{uuid}`
   - Database Name: `{tenantId}_db`
   - Schema: From R2 bucket or embedded default
   - Tables: All restaurant POS tables (menu, sales, staff, etc.)

2. **KV Namespaces**
   - `{subdomain}_data` - Main data storage
   - `{subdomain}_cache` - Caching layer
   - `{subdomain}_sessions` - Session management

3. **R2 Bucket**
   - `{subdomain}-media` - Image and file storage

4. **Tenant Worker**
   - Deployed in `handsfree-tenants` dispatch namespace
   - Has bindings to D1, KV, R2

5. **Activation Code**
   - 16-character code: `XXXX-XXXX-XXXX-XXXX`
   - Stored in `TENANT_METADATA` KV
   - Valid for 30 days

---

## Phase 2: Custom Schema Upload (Optional)

If POS has custom schema modifications:

### Upload Schema to R2

```typescript
// In POS Rust/Tauri
#[command]
pub async fn upload_custom_schema(
    tenant_id: String,
    schema_sql: String
) -> Result<(), String> {
    // Upload to R2 via backend API
    let url = format!(
        "https://stonepot-restaurant-334610188311.us-central1.run.app/api/schema/upload"
    );

    let payload = serde_json::json!({
        "tenantId": tenant_id,
        "schemaSQL": schema_sql,
        "version": "latest"
    });

    let client = reqwest::Client::new();
    let response = client.post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Failed to upload schema".to_string());
    }

    Ok(())
}
```

### R2 Schema Structure

```
R2 Bucket: pos-schemas
├── {tenantId}/
│   ├── pos-schema-latest.sql     ← Current schema
│   ├── pos-schema-v1.0.0.sql     ← Versioned schemas
│   ├── pos-schema-v1.1.0.sql
│   └── ...
└── default/
    └── pos-schema-latest.sql     ← Default schema
```

---

## Phase 3: Initial Data Sync

After provisioning, sync existing POS data to D1:

```typescript
// services/InitialD1Sync.ts
export async function performInitialSync(tenantId: string) {
  const tasks = [
    { name: 'sales', weight: 25 },
    { name: 'menu', weight: 15 },
    { name: 'tips', weight: 10 },
    { name: 'staff', weight: 10 },
    { name: 'inventory', weight: 10 },
    { name: 'settings', weight: 5 },
    { name: 'floor_plan', weight: 5 },
    { name: 'devices', weight: 5 },
    { name: 'cash_registers', weight: 5 },
    { name: 'cash_payouts', weight: 5 },
    { name: 'login_history', weight: 5 }
  ];

  let totalProgress = 0;

  for (const task of tasks) {
    // Sync data from SQLite to D1
    await syncTableToD1(task.name, tenantId);

    totalProgress += task.weight;
    updateProgress(totalProgress);
  }

  // After initial sync, trigger menu sync
  await triggerMenuSync(tenantId);
}
```

---

## Phase 4: Ongoing Menu Sync

### Automatic Sync After Menu Changes

```typescript
// In POS - after menu item save/update/delete
async function saveMenuItem(item: MenuItem) {
  // 1. Save to local SQLite (source of truth)
  await saveToLocalSQLite(item);

  // 2. Sync to D1 via tenant worker
  await fetch(
    `https://handsfree-orders.suyesh.workers.dev/api/menu/${tenantId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    }
  );

  // 3. Trigger menu sync webhook (non-blocking)
  fetch('https://filesearch-sync.suyesh.workers.dev/webhook/menu-updated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      trigger: 'pos_menu_update',
      itemsChanged: 1
    })
  }).catch(err => console.error('Sync webhook failed:', err));
}
```

### Menu Sync Worker Flow

When webhook is triggered:

```
Webhook Received
    ↓
Fetch Menu from D1 (via tenant worker)
    ↓
    ├─> D1 → KV Sync (fast, 100-200ms)
    │   └─> Build category hierarchy
    │       └─> Store in KV namespace
    │
    └─> D1 → File Search Sync (slow, 1-2s)
        └─> Format as AI markdown
            └─> Upload to Google File Search
                └─> Update sync metadata
```

### Sync Status Monitoring

```typescript
// Check sync status in POS UI
const status = await fetch(
  `https://filesearch-sync.suyesh.workers.dev/status/${tenantId}`
).then(r => r.json());

if (!status.status.inSync) {
  // Show warning
  showWarning(`Menu out of sync: ${status.status.errors[0]}`);

  // Offer manual sync
  if (userClicksSync) {
    await fetch(
      `https://filesearch-sync.suyesh.workers.dev/sync/full/${tenantId}`,
      { method: 'POST' }
    );
  }
}
```

---

## Complete POS Integration Code

### Rust/Tauri Commands

```rust
// src-tauri/src/commands/provisioning.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProvisionRequest {
    pub tenant_id: String,
    pub company_name: String,
    pub email: String,
    pub phone: String,
    pub city: String,
    pub pincode: String,
    pub business_category: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProvisionResponse {
    pub success: bool,
    pub tenant: TenantInfo,
    pub activation_code: String,
    pub provisioning: ProvisioningDetails,
}

#[command]
pub async fn provision_restaurant(
    request: ProvisionRequest
) -> Result<ProvisionResponse, String> {
    let url = "https://handsfree-restaurant-provisioning.suyesh.workers.dev/api/provision";

    let client = reqwest::Client::new();
    let response = client.post(url)
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Provisioning failed: {}", error_text));
    }

    let result: ProvisionResponse = response.json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[command]
pub async fn check_provisioning_status(
    tenant_id: String
) -> Result<ProvisionStatus, String> {
    let url = format!(
        "https://handsfree-restaurant-provisioning.suyesh.workers.dev/api/status/{}",
        tenant_id
    );

    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;

    let status: ProvisionStatus = response.json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(status)
}

#[command]
pub async fn trigger_initial_menu_sync(
    tenant_id: String
) -> Result<(), String> {
    // Trigger full sync after initial provisioning
    let url = format!(
        "https://filesearch-sync.suyesh.workers.dev/sync/full/{}",
        tenant_id
    );

    let client = reqwest::Client::new();
    let response = client.post(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Initial menu sync failed".to_string());
    }

    Ok(())
}
```

### TypeScript Services

```typescript
// services/provisioningService.ts

export interface ProvisioningRequest {
  tenantId: string;
  companyName: string;
  email: string;
  phone: string;
  city: string;
  pincode: string;
  businessCategory: string;
}

export async function provisionRestaurant(
  request: ProvisioningRequest
): Promise<ProvisioningResult> {
  // Call Rust command
  return await invoke('provision_restaurant', { request });
}

export async function performInitialSetup(
  tenantId: string
): Promise<void> {
  // 1. Initial data sync (SQLite → D1)
  await performInitialD1Sync(tenantId);

  // 2. Trigger menu sync (D1 → KV → File Search)
  await invoke('trigger_initial_menu_sync', { tenantId });

  // 3. Start ongoing tiered sync
  await startTieredSyncManager(tenantId);
}
```

---

## Testing the Complete Flow

### 1. Provision New Tenant

```bash
curl -X POST https://handsfree-restaurant-provisioning.suyesh.workers.dev/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-restaurant-001",
    "companyName": "Test Restaurant",
    "email": "test@restaurant.com",
    "phone": "+1234567890",
    "city": "Test City",
    "pincode": "12345",
    "businessCategory": "RESTAURANT"
  }'
```

### 2. Check Provisioning Status

```bash
curl https://handsfree-restaurant-provisioning.suyesh.workers.dev/api/status/test-restaurant-001
```

### 3. Check Menu Sync Status

```bash
curl https://filesearch-sync.suyesh.workers.dev/status/test-restaurant-001
```

### 4. Trigger Full Menu Sync

```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/sync/full/test-restaurant-001
```

---

## Monitoring

### View Provisioning Logs

```bash
wrangler tail --name handsfree-restaurant-provisioning
```

### View Menu Sync Logs

```bash
wrangler tail --name filesearch-sync
```

### View Tenant Worker Logs

```bash
wrangler tail --name handsfree-orders
```

---

## Troubleshooting

### Issue: "Provisioning failed - database creation timeout"

**Cause:** D1 API took too long to respond

**Fix:**
- Provisioning happens asynchronously via Durable Objects
- Check status endpoint after 30 seconds
- Retry if status shows "in_progress"

### Issue: "Menu sync shows needsSync = true"

**Cause:** File Search not synced after provisioning

**Fix:**
```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/sync/full/your-tenant-id
```

### Issue: "Activation code not working"

**Cause:** Code expired or not stored correctly

**Fix:**
- Activation codes valid for 30 days
- Check in KV: `pos_activation:{CODE}`
- Generate new one via provisioning API

---

## Summary

**Complete Flow:**

1. **POS Extracts Schema** → SQLite schema extraction
2. **POS Provisions Tenant** → Creates D1, KV, R2
3. **POS Uploads Data** → Initial sync SQLite → D1
4. **POS Triggers Menu Sync** → D1 → KV → File Search
5. **Ongoing Updates** → Automatic webhook-based sync

**Workers Involved:**

- **restaurant-provisioning** - One-time tenant setup
- **handsfree-orders** (router) - Routes to tenant workers
- **tenant-{tenantId}** - Tenant-specific D1 operations
- **filesearch-sync** - Menu synchronization (D1 → KV → FS)

**All CORS-enabled for POS access from any origin.**
